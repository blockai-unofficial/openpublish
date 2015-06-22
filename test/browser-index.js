var bitcoin = require('bitcoinjs-lib');

document.getElementById("generate-wallet").addEventListener("click", function(event) {

  var seedString = document.getElementById("brainwallet-seed").value;
  seed = bitcoin.crypto.sha256(seedString);
  wallet = new bitcoin.Wallet(seed, bitcoin.networks.testnet);
  address = wallet.generateAddress();
  document.getElementById("wallet-address").innerHTML = address;

});

var xhr = require('xhr');

document.getElementById("get-wallet").addEventListener("click", function(event) {

  xhr("https://www.blockai.com/chain/testnet/addresses/" + address, function(err, res, body) {
    var data = JSON.parse(body);
    var balance = data.balance*100000000;
    document.getElementById("balance").innerHTML = balance;
  });

});

var bitstore = require("bitstore");

document.getElementById("generate-bitstore-client").addEventListener("click", function(event) {

  var signMessage = function (message, cb) {
    var key = wallet.getPrivateKey(0);
    var network = bitcoin.networks.testnet;
    cb(null, bitcoin.Message.sign(key, message, network).toString('base64'));
  };

  bitstoreClient = bitstore({
    network: 'testnet',
    address: address,
    signMessage: signMessage
  });

  bitstoreClient.wallet.get(function (err, res) {
    bitstoreDepositAddress = res.body.deposit_address;
    bitstoreBalance = res.body.balance;
    document.getElementById("bitstore-deposit-address").innerHTML = bitstoreDepositAddress;
    document.getElementById("bitstore-balance").innerHTML = bitstoreBalance;
  });

});

document.getElementById("get-unspents").addEventListener("click", function(event) {

  getUnspentOutputs = function(callback) {
    xhr("https://www.blockai.com/chain/testnet/addresses/" + address + "/unspents", function(err, res, body) {
      var unspentOutputs = JSON.parse(body);
      unspentOutputs.forEach(function(utxo) {
        utxo.txHash = utxo.hash;
        utxo.index = utxo.outputIndex;
      });
      callback(err, unspentOutputs);
    });
  };

  getUnspentOutputs(function(err, unspentOutputs) {
    wallet.setUnspentOutputs(unspentOutputs);
    unspentOutputsJSON = JSON.stringify(unspentOutputs, null, 4);
    document.getElementById("unspent-outputs-json").innerHTML = unspentOutputsJSON;
  });

});

document.getElementById("create-transaction").addEventListener("click", function(event) {

  newTx = wallet.createTx(bitstoreDepositAddress, 100000, 1000, address);
  newTxJSON = JSON.stringify({
    inputCount: newTx.ins.length,
    outputCount: newTx.outs.length,
    txHash: newTx.getId()
  }, null, 4);
  document.getElementById("new-tx-json").innerHTML = newTxJSON;

  var __ct = {
    "inputCount": 1,
    "outputCount": 2,
    "txHash": "3260105d69aafd6d94dd682a74bba57e96836263140299b582a6ecc0497d5585"
  } 

});

document.getElementById("sign-and-post-transaction").addEventListener("click", function(event) {

  signTransaction = function(tx, callback) {
    callback(false, wallet.signWith(tx, [address]))
  };

  postTransaction = function(signedTxHex, callback) {
    xhr({
      uri: 'https://www.blockai.com/chain/testnet/transactions/send',
      method: 'POST',
      json: {
        transactionHex: signedTxHex
      }
    }, function(err, resp, body) {
      callback(err, body);
    });
  };

  signTransaction(newTx, function(err, signedTx) {
    signedTxHex = signedTx.toHex();
    postTransaction(signedTxHex, function(err, postTransactionReceipt) {
      postTransactionReceiptJSON = JSON.stringify(postTransactionReceipt, null, 4);
      document.getElementById("post-transaction-receipt-json").innerHTML = postTransactionReceiptJSON;
    });
  });

  // example
  var __ptreceipt = {
    "response": "success",
    "hash": "3260105d69aafd6d94dd682a74bba57e96836263140299b582a6ecc0497d5585"
  }

});

var dragDrop = require('drag-drop');

dragDrop('#drop', function (files) {
  files.forEach(function (droppedFile) {
    file = droppedFile;
    bitstoreClient.files.put(file, function (err, res) {
      var receipt = res.body;
      hash_sha1 = receipt.hash_sha1;
      hash_btih = receipt.hash_btih;
      uri = receipt.uri;
      size = receipt.size;
      torrent = receipt.torrent;
      document.getElementById("hash_sha1").innerHTML = hash_sha1;
      document.getElementById("hash_btih").innerHTML = hash_btih;
      document.getElementById("size").innerHTML = size;
      document.getElementById("uri").innerHTML = uri;
    });
  });
});

var openpublish = require("../src/index");

document.getElementById("open-publish-file").addEventListener("click", function(event) {

  getUnspentOutputs(function(err, unspentOutputs) {
    console.log(file, uri, address, unspentOutputs, signTransaction, signTransaction);
    openpublish.register({
      file: file,
      uri: uri,
      address: address,
      unspentOutputs: unspentOutputs,
      signTransaction: signTransaction,
      propagateTransaction: postTransaction
    }, function(err, receipt) {
      var openPublishReceiptJSON = JSON.stringify(receipt, null, 4);
      document.getElementById("open-publish-receipt-json").innerHTML = openPublishReceiptJSON;

    });
  });

  // example
  var __opreceipt = {
    "data": {
      "op": "r",
      "btih": "6a4b25d836b34a2617b69cfbeb9868f8f3ca6193",
      "sha1": "633a7b692789f9d807aa59cf8dead3f06f67834d",
      "name": "tip-button.gif",
      "size": 14384,
      "type": "image/gif",
      "uri": "http://bitstore-test.d.syskall.com/msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ/sha1/633a7b692789f9d807aa59cf8dead3f06f67834d"
    },
    "blockcastTx": {
      "txHash": "9fbdfa21065b4e93779a25168b65893d589998bd852b95338b29875352f6c7a0",
      "data": "{\"op\":\"r\",\"btih\":\"6a4b25d836b34a2617b69cfbeb9868f8f3ca6193\",\"sha1\":\"633a7b692789f9d807aa59cf8dead3f06f67834d\",\"name\":\"tip-button.gif\",\"size\":14384,\"type\":\"image/gif\",\"uri\":\"http://bitstore-test.d.syskall.com/msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ/sha1/633a7b692789f9d807aa59cf8dead3f06f67834d\"}",
      "transactionTotal": 6
    }
  };

});

var blockcast = require("blockcast");

document.getElementById("scan-address").addEventListener("click", function(event) {

  getTransaction = function(txHash, callback) {
    xhr("https://www.blockai.com/chain/testnet/tx/" + txHash, function(err, res, body) {
      var rawTx = JSON.parse(body);
      var rawOutputs = rawTx.outputs;
      var rawInputs = rawTx.inputs;
      var outputs = [];
      rawOutputs.forEach(function(rawOutput) {
        outputs.push({
          scriptPubKey: rawOutput.script_hex,
          nextTxHash: rawOutput.spending_transaction
        });
      });
      var inputs = [];
      rawInputs.forEach(function(rawInput) {
        inputs.push({
          address: rawInput.addresses[0]
        });
      });
      var transaction = {
        inputs: inputs,
        outputs: outputs
      }
      callback(err, transaction);
    });
  }

  xhr("https://www.blockai.com/chain/testnet/addresses/" + address, function(err, res, body) {
    var data = JSON.parse(body);
    var transactions = data.transactions;
    var openPublishDocuments = [];
    transactions.forEach(function(tx) {
      blockcast.scanSingle({
        txHash: tx.hash,
        getTransaction: getTransaction
      }, function(err, message) {
        if (!message) {
          return;
        }
        var data = JSON.parse(message);
        if (!data) {
          return;
        }
        if (data.op == "r") {
          var openPublishDocJSON = JSON.stringify(data, null, 4);
          document.getElementById("open-publish-transactions").innerHTML = document.getElementById("open-publish-transactions").innerHTML + "\n\n" + openPublishDocJSON;
        }
      });
    });
  });

});
