jasmine.getEnv().defaultTimeoutInterval = 50000;

var openpublish = require("../src/index");

var bitcoin = require("bitcoinjs-lib");
var File = require("file-api").File;
var blockcast = require("blockcast");
var fs = require('fs');
var crypto = require("crypto");
var request = require("request");

var commonBlockchain;
if (process.env.CHAIN_API_KEY_ID && process.env.CHAIN_API_KEY_SECRET) {
  var ChainAPI = require("chain-unofficial");
  commonBlockchain = ChainAPI({
    network: "testnet", 
    key: process.env.CHAIN_API_KEY_ID, 
    secret: process.env.CHAIN_API_KEY_SECRET
  });
}
else {
  commonBlockchain = require("mem-common-blockchain")();
}

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

var address = "n3PDRtKoHXHNt8FU17Uu9Te81AnKLa7oyU";
var privateKeyWIF = "KyjhazeX7mXpHedQsKMuGh56o3rh8hm8FGhU3H6HPqfP9pA4YeoS";

var sha1 = "dc724af18fbdd4e59189f5fe768a5f8311527050";

var bitstore = require('bitstore')({
  privateKey: privateKeyWIF,
  network: 'testnet'
});

var signFromPrivateKeyWIF = function(privateKeyWIF) {
  return function(txHex, callback) {
    var tx = bitcoin.Transaction.fromHex(txHex);
    var key = bitcoin.ECKey.fromWIF(privateKeyWIF);
    tx.sign(0, key); 
    var txid = tx.getId();
    var signedTxHex = tx.toHex();
    callback(false, signedTxHex, txid);
  }
};

var signRawTransaction = signFromPrivateKeyWIF(privateKeyWIF);

var commonWallet = {
  signRawTransaction: signRawTransaction,
  address: address
}

describe("open-publish", function() {

  var fileBuffer = new Buffer("testing");
  var fileName = "test.txt";
  var fileType = "text/plain";
  var fileTitle =  "A text file for testing";
  var fileKeywords = "test, text, txt";
  var fileBtih = "335400c43179bb1ad0085289e4e60c0574e6252e";
  var fileSha1 = "dc724af18fbdd4e59189f5fe768a5f8311527050";

  var testData0 = {
    op: "r",
    btih: fileBtih,
    sha1: fileSha1,
    name: fileName,
    size: fileBuffer.length,
    type: fileType,
    title: fileTitle,
    keywords: fileKeywords
  }

  var file = new File({ 
    name: fileName,
    type: fileType,
    buffer: fileBuffer
  });

  it("should publish a small text file", function(done) {
    openpublish.register({
      file: file,
      title: fileTitle,
      keywords: fileKeywords,
      commonWallet: commonWallet,
      commonBlockchain: commonBlockchain
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
      expect(blockcastTx.txid).toBeDefined();
      expect(blockcastTx.transactionTotal).toBe(5);
      done();
    });
  });

  it("should find an open publish transaction", function(done) {

    openpublish.register({
      file: file,
      title: fileTitle,
      keywords: fileKeywords,
      name: fileName,
      sha1: fileSha1,
      btih: fileBtih,
      size: fileBuffer.legnth,
      type: fileType,
      commonWallet: commonWallet,
      commonBlockchain: commonBlockchain
    }, function(err, receipt) {
      var blockcastTx = receipt.blockcastTx;
      var txid = blockcastTx.txid;
      setTimeout(function() {
        openpublish.scanSingle({
          txid: txid,
          commonBlockchain: commonBlockchain
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
      }, 1500);
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
        // update
        randomFile.size = randomBufferSize; // this janky File object we're using needs a little help figuring out the size
        openpublish.register({
          uri: uri,
          file: randomFile,
          commonWallet: commonWallet,
          commonBlockchain: commonBlockchain
        }, function(err, receipt) {
          var blockcastTx = receipt.blockcastTx;
          var txid = blockcastTx.txid;
          expect(txid).toBeDefined();
          setTimeout(function() {
            blockcast.scanSingle({
              txid: txid,
              commonBlockchain: commonBlockchain
            }, function(err, message) {
              var data = JSON.parse(message);
              expect(data.op).toBe("r");
              expect(data.sha1).toBe(bistoreSha1);
              expect(data.name).toBe(randomFileName);
              expect(data.size).toBe(randomBufferSize);
              expect(data.type).toBe(bitstoreMimetype);
              expect(data.uri).toBe(uri);
              request(uri, function(err, res, body) {
                expect(body).toBe(randomString);
                done();
              });
            });
          }, 3000);
        });
      });
    });
  });

  it("should tip an openpublish document", function(done) {
    var amount = 20000;
    var destination = "mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR";
    openpublish.tip({
      destination: destination,
      sha1: sha1,
      amount: amount,
      commonWallet: commonWallet,
      commonBlockchain: commonBlockchain
    }, function(error, tipTx) {
      expect(tipTx.tipDestinationAddress).toBe(destination);
      expect(tipTx.openpublishSha1).toBe(sha1);
      expect(tipTx.tipAmount).toBe(amount);
      expect(tipTx.txid).toBeDefined();
      expect(tipTx.propagateResponse).toBe('success');
      done();
    });
  });

  it("should scan an opentip", function(done) {
    var txid = "7235a656b4f3e578e00c9980d4ea868d8de89a8616e019ccf68db9f0c1d1a6ff";
    openpublish.scanSingle({
      txid: txid,
      commonBlockchain: commonBlockchain
    }, function(err, tip) {
      expect(tip.openpublishSha1).toBe(sha1);
      expect(tip.tipAmount).toBe(20000);
      expect(tip.tipDestinationAddresses[0]).toBe("mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR");
      done();
    });
  });

});