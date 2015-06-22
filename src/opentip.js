
var Bitcoin = require("bitcoinjs-lib");

var header = "♥";
var headerHex = "e299a5";

var signFromPrivateKeyWIF = function(privateKeyWIF) {
  return function(tx, callback) {
    var key = Bitcoin.ECKey.fromWIF(privateKeyWIF);
    tx.sign(0, key); 
    callback(false, tx);
  }
};

var signFromTransactionHex = function(signTransactionHex) {
  if (!signTransactionHex) {
    return false;
  }
  return function(tx, callback) {
    var txHex = tx.tx.toHex();
    signTransactionHex(txHex, function(error, signedTxHex) {
      var signedTx = Bitcoin.TransactionBuilder.fromTransaction(Bitcoin.Transaction.fromHex(signedTxHex));
      callback(error, signedTx);
    });
  };
};

var create = function(options, callback) {
  var openpublishSha1 = options.openpublishSha1;
  var tipDestinationAddress = options.tipDestinationAddress;
  var tipAmount = options.tipAmount || 10000;
  var data = new Buffer(headerHex + openpublishSha1, "hex");
  var signTransaction = options.signTransaction || signFromTransactionHex(options.signTransactionHex) || signFromPrivateKeyWIF(options.privateKeyWIF);
  options.signTransaction = signTransaction;
  var address = options.address;
  var fee = options.fee || 1000;
  var payloadScript = Bitcoin.Script.fromChunks([Bitcoin.opcodes.OP_RETURN, data]);
  var tx = new Bitcoin.TransactionBuilder();
  var unspentOutputs = options.unspentOutputs;
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
    tx.addInput(unspentOutput.txHash, unspentOutput.index);
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
    var txHash = signedTxBuilt.getId();
    callback(false, signedTxHex, txHash);
  });
};

var scanSingle = function(options, callback) {
  if (options.tx) {
    return scan({transactions:[tx]}, function(err, tips) {
      callback(err, tips[0]);
    });
  }
  else {
    var txHash = options.txHash;
    var getTransaction = options.getTransaction;
    return getTransaction(txHash, function(err, tx) {
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
    var tip = {};
    var sources = [];
    var value;
    var tipDestinationAddresses = [];
    var tipAmount = 0;
    tx.inputs.forEach(function(input) {
      var sourceAddress = input.address;
      if (sourceAddress) {
        sources.push(sourceAddress);
      }
    });
    tx.outputs.forEach(function(output) {
      if (output.type == 'nulldata') {
        var scriptPubKey = output.scriptPubKey;
        if (scriptPubKey.slice(0,2) == "6a") {
          var data = scriptPubKey.slice(4, 84);
          if (data.slice(0,6) == headerHex && data.length == 46) {
            tip.openpublishSha1 = data.slice(6, 46);
          }
        }
      }
      else if (output.type == 'pubkeyhash') {
        var destinationAddress = output.address;
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