jasmine.getEnv().defaultTimeoutInterval = 50000;

var openpublish = require("../src/index");

var Bitcoin = require("bitcoinjs-lib");
var Chain = require("chain-node");
var File = require("file-api").File;
var blockcast = require("blockcast");
var fs = require('fs');
var crypto = require("crypto");
var request = require("request");

var createRandomString = function(length) {
  var characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
  var output = '';
  for (var i = 0; i < length; i++) {
    var r = Math.floor(Math.random() * characters.length);
    output += characters.substring(r, r + 1);
  }
  return output;
};

var createRandomFile = function(options, callback) {
  var fileName = options.fileName;
  var string = options.string;
  var path = "./test/" + fileName;
  fs.writeFile(path, string, function(err) {
    callback(path);
  });
};

var CHAIN_API_KEY_ID = process.env.CHAIN_API_KEY_ID;
var CHAIN_API_KEY_SECRET = process.env.CHAIN_API_KEY_SECRET;

var chain = new Chain({
  keyId: CHAIN_API_KEY_ID,
  keySecret: CHAIN_API_KEY_SECRET,
  blockChain: 'testnet3'
});

var address = "n3PDRtKoHXHNt8FU17Uu9Te81AnKLa7oyU";
var privateKeyWIF = "KyjhazeX7mXpHedQsKMuGh56o3rh8hm8FGhU3H6HPqfP9pA4YeoS";

var sha1 = "dc724af18fbdd4e59189f5fe768a5f8311527050";

var bitstore = require('bitstore')({
  privateKey: privateKeyWIF,
  network: 'testnet'
});

var signFromPrivateKeyWIF = function(privateKeyWIF) {
  return function(tx, callback) {
    var key = Bitcoin.ECKey.fromWIF(privateKeyWIF);
    tx.sign(0, key); 
    callback(false, tx);
  }
};

var signTransaction = signFromPrivateKeyWIF(privateKeyWIF);

var signMessageBase64 = function (message, callback) {
  var key = bitcoin.ECKey.fromWIF(privateKeyWIF);
  var network = bitcoin.networks.testnet;
  callback(false, bitcoin.Message.sign(key, message, network).toString('base64'));
}

var propagateTransaction = function(transactionHex, callback) {
  chain.sendTransaction(transactionHex, function(err, resp) {
    callback(err, resp);
  });
};

var getTransaction = function(txHash, callback) {
  chain.getTransaction(txHash, function(err, resp) {
    var rawTx = resp;
    var rawOutputs = rawTx.outputs;
    var rawInputs = rawTx.inputs;
    var outputs = [];
    rawOutputs.forEach(function(rawOutput) {
      var address = rawOutput.addresses ? rawOutput.addresses[0] : false;
      outputs.push({
        type: rawOutput.script_type,
        address: address,
        scriptPubKey: rawOutput.script_hex,
        nextTxHash: rawOutput.spending_transaction,
        value: rawOutput.value
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
};

var getUnspentOutputs = function(address, callback) {
  chain.getAddressUnspents(address, function(err, resp) {
    var rawUnspentOutputs = resp;
    var unspentOutputs = [];
    for (var i = 0; i < rawUnspentOutputs.length; i++) {
      var rawUnspentOutput = rawUnspentOutputs[i];
      var unspentOutput = {
        txHash: rawUnspentOutput.transaction_hash,
        value: rawUnspentOutput.value,
        index: rawUnspentOutput.output_index,
        address: address,
        confirmations: rawUnspentOutput.confirmations,
        scriptPubKey: rawUnspentOutput.script_hex
      };
      unspentOutputs.push(unspentOutput);
    }
    callback(false, unspentOutputs);
  });
};

describe("open-publish", function() {

  var fileBuffer = new Buffer("testing");
  var fileName = "test.txt";
  var fileType = "text/plain";
  var fileTitle =  "A text file for testing";
  var fileKeywords = "test, text, txt";
  var fileBtih = "335400c43179bb1ad0085289e4e60c0574e6252e";
  var fileSha1 = "dc724af18fbdd4e59189f5fe768a5f8311527050";

  var file = new File({ 
    name: fileName,
    type: fileType,
    buffer: fileBuffer
  });

  it("should publish a small text file", function(done) {
    getUnspentOutputs(address, function(err, unspentOutputs) {
      openpublish.register({
        file: file,
        title: fileTitle,
        keywords: fileKeywords,
        address: address,
        unspentOutputs: unspentOutputs,
        signTransaction: signTransaction,
        propagateTransaction: propagateTransaction
      }, function(err, receipt) {
        var data = receipt.data;
        expect(data.op).toBe("r");
        expect(data.btih).toBe(fileBtih);
        expect(data.sha1).toBe(fileSha1);
        expect(data.name).toBe(fileName);
        expect(data.size).toBe(fileBuffer.length);
        expect(data.type).toBe(fileType);
        expect(data.title).toBe(fileTitle);
        expect(data.uri).not.toBeDefined();
        expect(data.keywords).toBe(fileKeywords);
        var blockcastTx = receipt.blockcastTx;
        expect(blockcastTx.txHash).toBeDefined();
        expect(blockcastTx.transactionTotal).toBe(5);
        done();
      });
    });
  });

  it("should find an open publish transaction", function(done) {
    var txHash = "03af5bf0b3fe25db04b684ab41bea8cdd127e57822602b8545beaf06685967c8";
    openpublish.scanSingle({
      txHash: txHash,
      getTransaction: getTransaction
    }, function(err, data) {
      expect(data.op).toBe("r");
      expect(data.btih).toBe(fileBtih);
      expect(data.sha1).toBe(fileSha1);
      expect(data.name).toBe(fileName);
      expect(data.size).toBe(fileBuffer.length);
      expect(data.type).toBe(fileType);
      expect(data.title).toBe(fileTitle);
      expect(data.uri).not.toBeDefined();
      expect(data.keywords).toBe(fileKeywords);
      done();
    });
  });

  it("should post to bitstore and then register with open publish", function(done) {
    var randomBufferSize = 48;
    var randomFileName = 'randomFile.txt';
    var randomString = createRandomString(randomBufferSize);
    createRandomFile({string: randomString, fileName: randomFileName}, function(path) {
      var randomFile = new File(path);
      bitstore.files.put(path, function (err, res) {
        var receipt = res.body;
        var uri = receipt.uri;
        var bistoreSha1 = receipt.hash_sha1;
        var bitstoreMimetype = receipt.mimetype;
        expect(receipt.size).toBe(randomBufferSize);
        expect(receipt.mimetype).toBe('text/plain');
        expect(receipt.filename).toBe(randomFileName);
        expect(uri).toBeDefined();
        getUnspentOutputs(address, function(err, unspentOutputs) {
          randomFile.size = randomBufferSize; // this janky File object we're using needs a little help figuring out the size
          openpublish.register({
            uri: uri,
            file: randomFile,
            address: address,
            unspentOutputs: unspentOutputs,
            signTransaction: signTransaction,
            propagateTransaction: propagateTransaction
          }, function(err, receipt) {
            var blockcastTx = receipt.blockcastTx;
            var txHash = blockcastTx.txHash;
            expect(txHash).toBeDefined();
            setTimeout(function() {
              blockcast.scanSingle({
                txHash: txHash,
                getTransaction: getTransaction
              }, function(err, message) {
                var data = JSON.parse(message);
                expect(data.op).toBe("r");
                expect(data.sha1).toBe(bistoreSha1);
                expect(data.name).toBe(randomFileName);
                expect(data.size).toBe(randomBufferSize);
                expect(data.type).toBe(bitstoreMimetype);
                expect(data.uri).toBe(uri);
                request(data.uri, function(err, res, body) {
                  expect(body).toBe(randomString);
                  done();
                });
              });
            }, 3000);
          });
        });
      });
    });
  });

  it("should tip an openpublish document", function(done) {
    var amount = 20000;
    var destination = "mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR";
    getUnspentOutputs(address, function(err, unspentOutputs) {
      openpublish.tip({
        destination: destination,
        sha1: sha1,
        address: address,
        amount: amount,
        unspentOutputs: unspentOutputs,
        propagateTransaction: propagateTransaction,
        signTransaction: signTransaction
      }, function(error, tipTx) {
        expect(tipTx.tipDestinationAddress).toBe(destination);
        expect(tipTx.openpublishSha1).toBe(sha1);
        expect(tipTx.tipAmount).toBe(amount);
        expect(tipTx.txHash).toBeDefined();
        expect(tipTx.propagateResponse).toBe('success');
        done();
      });
    });
  });

  it("should scan an opentip", function(done) {
    var txHash = "7235a656b4f3e578e00c9980d4ea868d8de89a8616e019ccf68db9f0c1d1a6ff";
    openpublish.scanSingle({
      txHash:txHash,
      getTransaction: getTransaction
    }, function(err, tip) {
      expect(tip.openpublishSha1).toBe(sha1);
      expect(tip.tipAmount).toBe(20000);
      expect(tip.tipDestinationAddresses[0]).toBe("mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR");
      done();
    });
  });

});