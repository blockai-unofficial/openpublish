/* global jasmine, describe, expect, it */

jasmine.getEnv().defaultTimeoutInterval = 50000

var openpublish = require('../src/index')
var blockcast = require('blockcast')
var bitcoin = require('bitcoinjs-lib')
var File = require('file-api').File
var fs = require('fs')
var shasum = require('shasum')

var txHexToJSON = require('bitcoin-tx-hex-to-json')

var env = require('node-env-file')
env('./.env', { raise: false })

var BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN

var commonBlockchain = require('blockcypher-unofficial')({
  key: BLOCKCYPHER_TOKEN,
  network: 'testnet'
})

var testCommonWallet = require('test-common-wallet')

var aliceWallet = testCommonWallet({
  seed: 'test',
  network: 'testnet',
  commonBlockchain: commonBlockchain
})

var bobWallet = testCommonWallet({
  seed: 'test1',
  network: 'testnet',
  commonBlockchain: commonBlockchain
})

var inMemoryCommonBlockchain = require('mem-common-blockchain')()

var inMemoryAliceWallet = testCommonWallet({
  seed: 'test',
  network: 'testnet',
  commonBlockchain: inMemoryCommonBlockchain
})

var createRandomString = function (length) {
  var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'
  var output = ''
  for (var i = 0; i < length; i++) {
    var r = Math.floor(Math.random() * characters.length)
    output += characters.substring(r, r + 1)
  }
  return output
}

var createRandomFile = function (options, callback) {
  var fileName = options.fileName
  var string = options.string
  var path = './test/' + fileName
  fs.writeFile(path, string, function (err) {
    if (err) { } // TODO
    callback(path)
  })
}

var sha1 = 'dc724af18fbdd4e59189f5fe768a5f8311527050'

describe('open-publish', function () {
  var fileBuffer = new Buffer('testing')
  var fileName = 'test.txt'
  var fileType = 'text/plain'
  var fileTitle = 'A text file for testing'
  var fileKeywords = 'test, text, txt'
  var fileBtih = '335400c43179bb1ad0085289e4e60c0574e6252e'
  var fileSha1 = 'dc724af18fbdd4e59189f5fe768a5f8311527050'
  var fileIpfs = 'QmcJf1w9bVpquGdzCp86pX4K21Zcn7bJBUtrBP1cr2NFuR'

  it('should get the number of transaction payloads', function (done) {
    var file = new File({
      name: fileName,
      type: fileType,
      buffer: fileBuffer
    })
    openpublish.getPayloadsLength({
      file: file,
      title: fileTitle,
      keywords: fileKeywords,
      commonWallet: aliceWallet,
      commonBlockchain: commonBlockchain
    }, function (err, payloadsLength) {
      if (err) { } // TODO
      expect(payloadsLength).toBe(3)
      done()
    })
  })

  it('Alice should publish a small text file', function (done) {
    var file = new File({
      name: fileName,
      type: fileType,
      buffer: fileBuffer
    })
    openpublish.register({
      file: file,
      title: fileTitle,
      keywords: fileKeywords,
      commonWallet: aliceWallet,
      commonBlockchain: commonBlockchain
    }, function (err, receipt) {
      if (err) { } // TODO
      console.log(receipt)
      var data = receipt.data
      expect(data.op).toBe('r')
      expect(data.btih).toBe(fileBtih)
      expect(data.sha1).toBe(fileSha1)
      expect(data.ipfs).toBe(fileIpfs)
      expect(data.name).toBe(fileName)
      expect(data.size).toBe(fileBuffer.length)
      expect(data.type).toBe(fileType)
      expect(data.title).toBe(fileTitle)
      expect(data.uri).not.toBeDefined()
      expect(data.keywords).toBe(fileKeywords)
      var blockcastTx = receipt.blockcastTx
      expect(blockcastTx.txid).toBeDefined()
      expect(blockcastTx.transactionTotal).toBe(3)
      done()
    })
  })

  it('Alice should register then transfer some ownership to Bob', function (done) {
    var randomBufferSize = 48
    var randomFileName = 'randomFile.txt'
    var randomString = createRandomString(randomBufferSize)
    var assetValue = 50000000
    var bitcoinValue = 12345
    var bobWalletSignPrimaryTxHex = function (txHex, callback) {
      var tx = txHexToJSON(txHex)
      expect(tx.vin.length).toBe(2)
      expect(tx.vout.length).toBe(4)
      expect(tx.vout[0].value).toBe(bitcoinValue)
      expect(tx.vout[2].value).toBe(0)
      expect(tx.vout[0].scriptPubKey.type).toBe('pubkeyhash')
      expect(tx.vout[1].scriptPubKey.type).toBe('pubkeyhash')
      expect(tx.vout[2].scriptPubKey.type).toBe('nulldata')
      expect(tx.vout[3].scriptPubKey.type).toBe('pubkeyhash')
      bobWallet.signRawTransaction({txHex: txHex, input: 0}, callback)
    }
    createRandomFile({string: randomString, fileName: randomFileName}, function (path) {
      var randomFile = new File(path)
      randomFile.size = randomBufferSize
      var ttl = 365
      openpublish.register({
        file: randomFile,
        commonWallet: aliceWallet,
        commonBlockchain: commonBlockchain
      }, function (err, receipt) {
        if (err) { } // TODO
        console.log(receipt)
        var registerData = receipt.data
        var sha1 = registerData.sha1
        openpublish.transfer({
          assetValue: assetValue,
          bitcoinValue: bitcoinValue,
          ttl: ttl,
          sha1: sha1,
          assetWallet: aliceWallet,
          bitcoinWallet: bobWallet,
          bitcoinWalletSignPrimaryTxHex: bobWalletSignPrimaryTxHex,
          commonBlockchain: commonBlockchain
        }, function (err, receipt) {
          if (err) { } // TODO
          console.log(receipt)
          var transferData = receipt.data
          expect(transferData.op).toBe('t')
          expect(transferData.sha1).toBe(sha1)
          expect(transferData.value).toBe(assetValue)
          expect(transferData.ttl).toBe(ttl)
          expect(receipt.blockcastTx.txid).toBeDefined()
          done()
        })
      })
    })
  })

  it("Bob should propose a bid on one of Alice's assets", function (done) {
    var assetValue = 50000000
    var bitcoinValue = 12345
    var ttl = 365
    openpublish.createBid({
      assetValue: assetValue,
      bitcoinValue: bitcoinValue,
      ttl: ttl,
      sha1: sha1,
      assetAddress: aliceWallet.address,
      bitcoinWallet: bobWallet,
      commonBlockchain: commonBlockchain
    }, function (err, proposedBid) {
      if (err) { } // TODO
      expect(proposedBid.assetValue).toBe(assetValue)
      done()
    })
  })

  it("Bob should propose a bid on one of Alice's assets and she should accept, and then Bob should sign and post", function (done) {
    var assetValue = 50000000
    var bitcoinValue = 12345
    var ttl = 365
    openpublish.createBid({
      assetValue: assetValue,
      bitcoinValue: bitcoinValue,
      ttl: ttl,
      sha1: sha1,
      assetAddress: aliceWallet.address,
      bitcoinWallet: bobWallet,
      commonBlockchain: commonBlockchain
    }, function (err, proposedBid) {
      if (err) { } // TODO
      // console.log(proposedBid)
      proposedBid.assetWallet = aliceWallet
      proposedBid.commonBlockchain = commonBlockchain
      openpublish.acceptBid(proposedBid, function (err, acceptedBid) {
        // console.log(err, acceptedBid)
        acceptedBid.bitcoinWallet = bobWallet
        acceptedBid.commonBlockchain = commonBlockchain
        openpublish.transferAcceptedBid(acceptedBid, function (err, receipt) {
          console.log(err, receipt)
          expect(receipt.transfer.assetValue).toBe(assetValue)
          expect(receipt.transfer.assetAddress).toBe(aliceWallet.address)
          expect(receipt.transfer.bitcoinValue).toBe(bitcoinValue)
          expect(receipt.transfer.bitcoinAddress).toBe(bobWallet.address)
          done()
        })
      })
    })
  })

  it('should find an open publish register transaction', function (done) {
    openpublish.scanSingle({
      txid: '1a1a36bed1de5a46ae1c85c2a4efe53201b7cd650911576aba331279275b0e25',
      commonBlockchain: commonBlockchain
    }, function (err, data) {
      if (err) { } // TODO
      expect(data.op).toBe('r')
      expect(data.addr).toBe('msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ')
      expect(data.btih).toBe(fileBtih)
      expect(data.sha1).toBe(fileSha1)
      expect(data.name).toBe(fileName)
      expect(data.size).toBe(fileBuffer.length)
      expect(data.type).toBe(fileType)
      expect(data.title).toBe(fileTitle)
      expect(data.uri).not.toBeDefined()
      expect(data.keywords).toBe(fileKeywords)
      done()
    })
  })

  it('should process an open publish register transaction', function (done) {
    blockcast.scanSingle({
      txid: '1a1a36bed1de5a46ae1c85c2a4efe53201b7cd650911576aba331279275b0e25',
      commonBlockchain: commonBlockchain
    }, function (err, rawData, addresses, primaryTx) {
      if (err) { } // TODO
      var data = openpublish.processRegistration(JSON.parse(rawData), primaryTx)
      expect(data.op).toBe('r')
      expect(data.addr).toBe('msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ')
      expect(data.btih).toBe(fileBtih)
      expect(data.sha1).toBe(fileSha1)
      expect(data.name).toBe(fileName)
      expect(data.size).toBe(fileBuffer.length)
      expect(data.type).toBe(fileType)
      expect(data.title).toBe(fileTitle)
      expect(data.uri).not.toBeDefined()
      expect(data.keywords).toBe(fileKeywords)
      done()
    })
  })

  it('should find an open publish transfer transaction', function (done) {
    var txid = '8f495d095ab55839675af686b98dc5b437ad3d8789546c9c5521feabbe104d70'
    openpublish.scanSingle({
      txid: txid,
      commonBlockchain: commonBlockchain
    }, function (err, data) {
      if (err) { } // TODO
      expect(data.assetValue).toBe(50000000)
      expect(data.assetAddress).toBe('msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ')
      expect(data.bitcoinValue).toBe(12345)
      expect(data.bitcoinAddress).toBe('mwaj74EideMcpe4cjieuPFpqacmpjtKSk1')
      expect(data.sha1).toBe('78d4fdf50ab5c2528b9a1b69baac7fe9819f0670')
      expect(data.ttl).toBe(365)
      done()
    })
  })

  it('should process an open publish transfer transaction', function (done) {
    var txid = '8f495d095ab55839675af686b98dc5b437ad3d8789546c9c5521feabbe104d70'
    blockcast.scanSingle({
      txid: txid,
      commonBlockchain: commonBlockchain
    }, function (err, rawData, addresses, primaryTx) {
      if (err) { } // TODO
      var data = openpublish.processTransfer(JSON.parse(rawData), primaryTx)
      expect(data.assetValue).toBe(50000000)
      expect(data.assetAddress).toBe('msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ')
      expect(data.bitcoinValue).toBe(12345)
      expect(data.bitcoinAddress).toBe('mwaj74EideMcpe4cjieuPFpqacmpjtKSk1')
      expect(data.sha1).toBe('78d4fdf50ab5c2528b9a1b69baac7fe9819f0670')
      expect(data.ttl).toBe(365)
      done()
    })
  })

  it('should publish and then find an open publish transaction (inMemoryCommonBlockchain)', function (done) {
    var file = new File({
      name: fileName,
      type: fileType,
      buffer: fileBuffer
    })
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
    }, function (err, receipt) {
      if (err) { } // TODO
      var blockcastTx = receipt.blockcastTx
      var txid = blockcastTx.txid
      openpublish.scanSingle({
        txid: txid,
        commonBlockchain: inMemoryCommonBlockchain
      }, function (err, data) {
        if (err) { } // TODO
        expect(data.op).toBe('r')
        expect(data.addr).toBe('msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ')
        expect(data.btih).toBe(fileBtih)
        expect(data.sha1).toBe(fileSha1)
        expect(data.name).toBe(fileName)
        expect(data.size).toBe(fileBuffer.length)
        expect(data.type).toBe(fileType)
        expect(data.title).toBe(fileTitle)
        expect(data.uri).not.toBeDefined()
        expect(data.keywords).toBe(fileKeywords)
        done()
      })
    })
  })

  it('Alice should tip an openpublish document', function (done) {
    var amount = 20000
    var destination = 'mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR'
    openpublish.tip({
      destination: destination,
      sha1: sha1,
      amount: amount,
      commonWallet: aliceWallet,
      commonBlockchain: commonBlockchain
    }, function (err, tipTx) {
      if (err) { } // TODO
      console.log(tipTx)
      expect(tipTx.tipDestinationAddress).toBe(destination)
      expect(tipTx.openpublishSha1).toBe(sha1)
      expect(tipTx.tipAmount).toBe(amount)
      expect(tipTx.txid).toBeDefined()
      expect(tipTx.propagateResponse).toBe('success')
      done()
    })
  })

  it('Bob should tip an openpublish document', function (done) {
    var amount = 20000
    var destination = 'mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR'
    openpublish.tip({
      destination: destination,
      sha1: sha1,
      amount: amount,
      commonWallet: bobWallet,
      commonBlockchain: commonBlockchain
    }, function (err, tipTx) {
      if (err) { } // TODO
      console.log(tipTx)
      expect(tipTx.tipDestinationAddress).toBe(destination)
      expect(tipTx.openpublishSha1).toBe(sha1)
      expect(tipTx.tipAmount).toBe(amount)
      expect(tipTx.txid).toBeDefined()
      expect(tipTx.propagateResponse).toBe('success')
      done()
    })
  })

  it('should scan an opentip', function (done) {
    var txid = 'b32192c9d2d75a8a28dd4034ea61eacb0dfe4f226acb502cfe108df20fbddebc'
    openpublish.scanSingle({
      txid: txid,
      commonBlockchain: commonBlockchain
    }, function (err, tip) {
      if (err) { } // TODO
      expect(tip.openpublishSha1).toBe(sha1)
      expect(tip.tipAmount).toBe(20000)
      expect(tip.tipDestinationAddresses[0]).toBe('mqMsBiNtGJdwdhKr12TqyRNE7RTvEeAkaR')
      done()
    })
  })

  it('should preorder and register a name (inMemoryCommonBlockchain)', function (done) {
    var name = 'test'
    openpublish.preorderName({
      name: name,
      commonWallet: inMemoryAliceWallet,
      commonBlockchain: inMemoryCommonBlockchain
    }, function (err, preordeReceipt) {
      if (err) { } // TODO
      openpublish.registerName({
        name: name,
        commonWallet: inMemoryAliceWallet,
        commonBlockchain: inMemoryCommonBlockchain
      }, function (err, registerReceipt) {
        if (err) { } // TODO
        var data = registerReceipt.data
        var doc = data.doc
        var sha1 = shasum(JSON.stringify(data.doc))
        var verify = bitcoin.Message.verify(inMemoryAliceWallet.address, doc.signedName, doc.name, bitcoin.networks.testnet)
        expect(verify).toBe(true)
        expect(sha1).toBe(data.sha1)
        expect(name).toBe(doc.name)
        expect(sha1).toBe(preordeReceipt.data.sha1)
        expect(name).toBe(preordeReceipt.name)
        done()
      })
    })
  })
})
