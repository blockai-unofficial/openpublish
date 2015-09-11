jasmine.getEnv().defaultTimeoutInterval = 50000;

var openpublish = require("../src/index");

var bitcoin = require("bitcoinjs-lib");
var File = require("file-api").File;
var blockcast = require("blockcast");
var fs = require('fs');
var crypto = require("crypto");
var request = require("request");

var txHexToJSON = require('bitcoin-tx-hex-to-json');

var env = require('node-env-file');
env('./.env', { raise: false });

var BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN;

var commonBlockchain = require('blockcypher-unofficial')({
  key: BLOCKCYPHER_TOKEN,
  network: "testnet"
});

var testCommonWallet = require('test-common-wallet');

var aliceWallet = testCommonWallet({
  seed: "test",
  network: "testnet",
  commonBlockchain: commonBlockchain
});

var bobWallet = testCommonWallet({
  seed: "test1",
  network: "testnet",
  commonBlockchain: commonBlockchain
});

var inMemoryCommonBlockchain = require("mem-common-blockchain")();

var inMemoryAliceWallet = testCommonWallet({
  seed: "test",
  network: "testnet",
  commonBlockchain: inMemoryCommonBlockchain
});

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

var sha1 = "dc724af18fbdd4e59189f5fe768a5f8311527050";

describe("open-publish", function() {

  var fileBuffer = new Buffer("testing");
  var fileName = "test.txt";
  var fileType = "text/plain";
  var fileTitle =  "A text file for testing";
  var fileKeywords = "test, text, txt";
  var fileBtih = "335400c43179bb1ad0085289e4e60c0574e6252e";
  var fileSha1 = "dc724af18fbdd4e59189f5fe768a5f8311527050";
  var fileIpfs = "QmcJf1w9bVpquGdzCp86pX4K21Zcn7bJBUtrBP1cr2NFuR";

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

  it("should get the number of transaction payloads", function(done) {
    var file = new File({
      name: fileName,
      type: fileType,
      buffer: fileBuffer
    });
    openpublish.getPayloadsLength({
      file: file,
      title: fileTitle,
      keywords: fileKeywords,
      commonWallet: aliceWallet,
      commonBlockchain: commonBlockchain
    }, function(err, payloadsLength) {
      expect(payloadsLength).toBe(6);
      done();
    });
  });

  it("should publish a small text file", function(done) {
    var file = new File({
      name: fileName,
      type: fileType,
      buffer: fileBuffer
    });
    openpublish.register({
      file: file,
      title: fileTitle,
      keywords: fileKeywords,
      commonWallet: aliceWallet,
      commonBlockchain: commonBlockchain
    }, function(err, receipt) {
      var data = receipt.data;
      expect(data.op).toBe("r");
      expect(data.btih).toBe(fileBtih);
      expect(data.sha1).toBe(fileSha1);
      expect(data.ipfs).toBe(fileIpfs);
      expect(data.name).toBe(fileName);
      expect(data.size).toBe(fileBuffer.length);
      expect(data.type).toBe(fileType);
      expect(data.title).toBe(fileTitle);
      expect(data.uri).not.toBeDefined();
      expect(data.keywords).toBe(fileKeywords);
      var blockcastTx = receipt.blockcastTx;
      expect(blockcastTx.txid).toBeDefined();
      expect(blockcastTx.transactionTotal).toBe(6);
      done();
    });
  });

  it("should register then transfer ownership", function(done) {

    var randomBufferSize = 48;
    var randomFileName = 'randomFile.txt';
    var randomString = createRandomString(randomBufferSize);

    var assetValue = 50000000;
    var bitcoinValue = 12345;

    var bobWalletSignPrimaryTxHex = function(txHex, callback) {
      var tx = txHexToJSON(txHex);
      expect(tx.vin.length).toBe(2);
      expect(tx.vout.length).toBe(4);
      expect(tx.vout[0].value).toBe(bitcoinValue);
      expect(tx.vout[2].value).toBe(0);
      expect(tx.vout[0].scriptPubKey.type).toBe("pubkeyhash");
      expect(tx.vout[1].scriptPubKey.type).toBe("pubkeyhash");
      expect(tx.vout[2].scriptPubKey.type).toBe("nulldata");
      expect(tx.vout[3].scriptPubKey.type).toBe("pubkeyhash");
      bobWallet.signRawTransaction({txHex: txHex, input: 0}, callback);
    };

    createRandomFile({string: randomString, fileName: randomFileName}, function(path) {

      var randomFile = new File(path);
      randomFile.size = randomBufferSize;

      var ttl = 365;

      openpublish.register({
        file: randomFile,
        commonWallet: aliceWallet,
        commonBlockchain: commonBlockchain
      }, function(err, receipt) {

        var registerData = receipt.data;
        var sha1 = registerData.sha1;

        openpublish.transfer({
          assetValue: assetValue,
          bitcoinValue: bitcoinValue,
          ttl: ttl,
          sha1: sha1,
          assetWallet: aliceWallet,
          bitcoinWallet: bobWallet,
          bitcoinWalletSignPrimaryTxHex: bobWalletSignPrimaryTxHex,
          commonBlockchain: commonBlockchain
        }, function(err, receipt) {
          var transferData = receipt.data;
          expect(transferData.op).toBe("t");
          expect(transferData.sha1).toBe(sha1);
          expect(transferData.value).toBe(assetValue);
          expect(transferData.ttl).toBe(ttl);
          expect(receipt.blockcastTx.txid).toBeDefined();
          done();
        });
      });
    });
  });

  it("should find an open publish register transaction", function(done) {
    openpublish.scanSingle({
      txid: '35780ddbbf5722f714ef0c5f3899634f745ea5b760acec48e6b1283bf4ac3658',
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
  });

  it("should publish and then find an open publish transaction (inMemoryCommonBlockchain)", function(done) {
    var file = new File({
      name: fileName,
      type: fileType,
      buffer: fileBuffer
    });
    openpublish.register({
      file: file,
      title: fileTitle,
      keywords: fileKeywords,
      name: fileName,
      sha1: fileSha1,
      btih: fileBtih,
      size: fileBuffer.legnth,
      type: fileType,
      commonWallet: inMemoryAliceWallet,
      commonBlockchain: inMemoryCommonBlockchain
    }, function(err, receipt) {
      var blockcastTx = receipt.blockcastTx;
      var txid = blockcastTx.txid;
      openpublish.scanSingle({
        txid: txid,
        commonBlockchain: inMemoryCommonBlockchain
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
  });

  it("should tip an openpublish document", function(done) {
    var amount = 20000;
    var destination = "mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR";
    openpublish.tip({
      destination: destination,
      sha1: sha1,
      amount: amount,
      commonWallet: aliceWallet,
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
    var txid = "b32192c9d2d75a8a28dd4034ea61eacb0dfe4f226acb502cfe108df20fbddebc";
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