
var bitcoin = require("bitcoinjs-lib");

var header = "♥";
var headerHex = "e299a5";

var signFromTransactionHex = function(signTransactionHex) {
  if (!signTransactionHex) {
    return false;
  }
  return function(tx, callback) {
    var txHex = tx.tx.toHex();
    signTransactionHex(txHex, function(error, signedTxHex) {
      var signedTx = bitcoin.TransactionBuilder.fromTransaction(bitcoin.Transaction.fromHex(signedTxHex));
      callback(error, signedTx);
    });
  };
};

var create = function(options, callback) {
  var commonWallet = options.commonWallet;
  var commonBlockchain = options.commonBlockchain;
  var openpublishSha1 = options.openpublishSha1;
  var tipDestinationAddress = options.tipDestinationAddress;
  var tipAmount = options.tipAmount || 10000;
  var data = new Buffer(headerHex + openpublishSha1, "hex");
  var signTransaction = signFromTransactionHex(commonWallet.signRawTransaction);
  options.signTransaction = signTransaction;
  var address = commonWallet.address;
  var fee = options.fee || 1000;
  var payloadScript = bitcoin.Script.fromChunks([bitcoin.opcodes.OP_RETURN, data]);
  var tx = new bitcoin.TransactionBuilder();
  commonBlockchain.Addresses.Unspents([address], function(err, addresses_unspents) {
    var unspentOutputs = addresses_unspents[0];
    var compare = function(a,b) {
      if (a.value < b.value)
        return -1;
      if (a.value > b.value)
        return 1;
      return 0;
    };
    unspentOutputs.sort(compare);
    var unspentValue = 0;
    for (var i = unspentOutputs.length - 1; i >= 0; i--) {
      var unspentOutput = unspentOutputs[i];
      if (unspentOutput.value === 0) {
        continue;
      }
      unspentValue += unspentOutput.value;
      tx.addInput(unspentOutput.txid, unspentOutput.vout);
      if (unspentValue - fee - tipAmount >= 0) {
        break;
      }
    };
    tx.addOutput(payloadScript, 0);
    tx.addOutput(tipDestinationAddress, tipAmount);

    if (unspentValue - fee - tipAmount > 0) {
      tx.addOutput(address, unspentValue - fee - tipAmount);
    }

    // AssertionError: Number of addresses must match number of transaction inputs
    // this seems to be a bug in bitcoinjs-lib
    // it is checking for assert.equal(tx.ins.length, addresses.length, 'Number of addresses must match number of transaction inputs')
    // but that doesn't make sense because the number of ins doesn't have anything to do with the number of addresses...
    // the solution is to upgrade bitcoinjs-min.js

    signTransaction(tx, function(err, signedTx) {
      var signedTxBuilt = signedTx.build();
      var signedTxHex = signedTxBuilt.toHex();
      var txid = signedTxBuilt.getId();
      callback(false, signedTxHex, txid);
    });

  });
};

var scanSingle = function(options, callback) {
  if (options.tx) {
    return scan({transactions:[tx]}, function(err, tips) {
      callback(err, tips[0]);
    });
  }
  else {
    var txid = options.txid;
    var commonBlockchain = options.commonBlockchain;
    return commonBlockchain.Transactions.Get([txid], function(err, txs) {
      var tx = txs[0];
      scan({transactions:[tx]}, function(err, tips) {
        callback(err, tips[0]);
      });
    });
  }
};

var scan = function(options, callback) {
  var transactions = options.transactions;
  var tips = [];
  transactions.forEach(function(tx) {
    if (!tx) {
      return;
    }
    var tip = {};
    var sources = [];
    var value;
    var tipDestinationAddresses = [];
    var tipAmount = 0;
    tx.vin.forEach(function(input) {
      var sourceAddress = input.addresses[0];
      if (sourceAddress) {
        sources.push(sourceAddress);
      }
    });
    tx.vout.forEach(function(output) {
      if (output.scriptPubKey.type == 'nulldata') {
        var scriptPubKey = output.scriptPubKey.hex;
        if (scriptPubKey.slice(0,2) == "6a") {
          var data = scriptPubKey.slice(4, 84);
          if (data.slice(0,6) == headerHex && data.length == 46) {
            tip.openpublishSha1 = data.slice(6, 46);
          }
        }
      }
      else if (output.scriptPubKey.type == 'pubkeyhash') {
        var destinationAddress = output.scriptPubKey.addresses[0];
        if (!value || output.value < value) {
          value = output.value;
        }
        if (sources.indexOf(destinationAddress) < 0) {
          tipAmount += output.value;
          tipDestinationAddresses.push(destinationAddress);
        }
      }
    });
    tip.tipDestinationAddresses = tipDestinationAddresses;
    tip.tipAmount = tipAmount;
    if (tip.tipDestinationAddresses.length == 0 && typeof(value) != "undefined") {
      tip.tipDestinationAddresses = [sources];
      tip.tipAmount = value;
    }
    tips.push(tip)
  });
  callback(false, tips)
};

var opentip = {
  create: create,
  scan: scan,
  scanSingle: scanSingle
}

module.exports = opentip;