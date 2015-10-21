var blockcast = require('blockcast')
var createTorrent = require('create-torrent')
var FileReader = typeof (window) !== 'undefined' ? window.FileReader : require('filereader')
var parseTorrent = require('parse-torrent')
var multihash = require('multihashes')
var bs58 = require('bs58')
var crypto = require('crypto')
var opentip = require('./opentip')

var register = function (options, callback) {
  getData(options, function (err, data) {
    if (err) { } // TODO
    var dataJSON = JSON.stringify(data)
    blockcast.post({
      data: dataJSON,
      fee: options.fee,
      commonWallet: options.commonWallet,
      commonBlockchain: options.commonBlockchain,
      propagationStatus: options.propagationStatus,
      buildStatus: options.buildStatus
    }, function (err, blockcastTx) {
      if (err) { } // TODO
      var receipt = {
        data: data,
        blockcastTx: blockcastTx
      }
      callback(false, receipt)
    })
  })
}

var transfer = function (options, callback) {
  var assetValue = options.assetValue
  var bitcoinValue = options.bitcoinValue
  var sha1 = options.sha1
  var ttl = options.ttl
  var data = {
    op: 't',
    sha1: sha1,
    value: assetValue,
    ttl: ttl
  }
  var dataJSON = JSON.stringify(data)
  var assetWallet = options.assetWallet
  var bitcoinWallet = options.bitcoinWallet
  var bitcoinWalletSignPrimaryTxHex = options.bitcoinWalletSignPrimaryTxHex || function (txHex, callback) { bitcoinWallet.signRawTransaction({txHex: txHex, input: 0}, callback) }
  bitcoinWallet.createTransaction({
    destinationAddress: assetWallet.address,
    value: bitcoinValue,
    skipSign: true
  }, function (err, primaryTxHex) {
    if (err) { } // TODO
    blockcast.post({
      primaryTxHex: primaryTxHex,
      signPrimaryTxHex: bitcoinWalletSignPrimaryTxHex,
      data: dataJSON,
      fee: options.fee,
      commonWallet: assetWallet,
      commonBlockchain: options.commonBlockchain,
      propagationStatus: options.propagationStatus,
      buildStatus: options.buildStatus
    }, function (err, blockcastTx) {
      if (err) { } // TODO
      var receipt = {
        data: data,
        blockcastTx: blockcastTx
      }
      callback(false, receipt)
    })
  })
}

var getPayloadsLength = function (options, callback) {
  getData(options, function (err, data) {
    if (err) { } // TODO
    var dataJSON = JSON.stringify(data)
    blockcast.payloadsLength({data: dataJSON}, function (err, payloadsLength) {
      callback(err, payloadsLength)
    })
  })
}

var getData = function (options, callback) {
  var file = options.file
  var keywords = options.keywords
  var title = options.title
  var uri = options.uri
  var sha1 = options.sha1
  var reader = new FileReader()
  reader.addEventListener('load', function (e) {
    var arr = new Uint8Array(e.target.result)
    var buffer = new Buffer(arr)
    buffer.name = file.name
    if (!sha1) {
      if (typeof (window) === 'undefined') {
        sha1 = crypto.createHash('sha1').update(buffer).digest('hex')
      } else {
        sha1 = crypto.createHash('sha1').update(arr).digest('hex')
      }
    }
    var sha256Buffer
    if (typeof (window) === 'undefined') {
      sha256Buffer = crypto.createHash('sha256').update(buffer).digest('buffer')
    } else {
      sha256Buffer = new Buffer(crypto.createHash('sha256').update(arr).digest('hex'), 'hex')
    }
    var sha256MultihashBuffer = multihash.encode(sha256Buffer, 'sha2-256')
    var ipfs = bs58.encode(sha256MultihashBuffer)
    createTorrent(buffer, function onTorrent (err, torrentBuffer) {
      var torrent = parseTorrent(torrentBuffer)
      var btih = torrent.infoHash
      var data = {
        op: 'r',
        btih: btih,
        sha1: sha1,
        ipfs: ipfs
      }
      if (file.name) {
        data.name = file.name
      }
      if (file.size) {
        data.size = file.size
      }
      if (file.type) {
        data.type = file.type
      }
      if (title) {
        data.title = title
      }
      if (uri) {
        data.uri = uri
      }
      if (keywords) {
        data.keywords = keywords
      }
      callback(err, data)
    })
  })
  reader.readAsArrayBuffer(file)
}

var processRegistration = function (obj, tx) {
  if (!obj || !tx || !obj.op || !obj.op === 'r') {
    return false
  }
  var address = tx.vin[0].addresses[0]
  obj.addr = address
  return obj
}

var processTransfer = function (obj, tx) {
  if (!obj || !tx || !obj.op || !obj.op === 't') {
    return false
  }
  var bitcoinOutput
  var assetOutput
  tx.vout.forEach(function (output) {
    // nulldata must be output index 0 or 2
    if (output.scriptPubKey.type === 'nulldata' && (output.index === 0 || output.index === 2)) {
      assetOutput = output
    }
  })
  // the bitcoinOutput is dependent on the location of the assetOutput
  if (assetOutput.index === 2) {
    bitcoinOutput = tx.vout[0]
  } else {
    bitcoinOutput = tx.vout[2]
  }
  if (!bitcoinOutput || !assetOutput) {
    return obj // return false ?
  }
  obj.assetValue = obj.value
  delete (obj.value)
  obj.assetAddress = bitcoinOutput.scriptPubKey.addresses[0] // the bitcoin is sent to the owner who is exchanging assets
  obj.bitcoinValue = bitcoinOutput.value
  // the bitcoinAddress that is receiving the asset from the assetAddress must but the other input address
  tx.vin.forEach(function (input) {
    var address = input.addresses[0]
    if (address !== obj.assetAddress) {
      obj.bitcoinAddress = address
    }
  })
  return obj
}

var scanSingle = function (options, callback) {
  var opentipScan = function (blockcastErr) {
    opentip.scanSingle(options, function (err, tip) {
      if (err) { } // TODO
      if (tip) {
        callback(false, tip)
      } else {
        callback(blockcastErr, false)
      }
    })
  }

  blockcast.scanSingle(options, function (err, rawData, addresses, primaryTx) {
    if (err || !rawData) {
      return opentipScan(err)
    }
    try {
      var data = JSON.parse(rawData)
      if (data.op) {
        var openpublishOperation
        if (data.op === 'r') {
          openpublishOperation = processRegistration(data, primaryTx)
        } else if (data.op === 't') {
          openpublishOperation = processTransfer(data, primaryTx)
        }
        callback(false, openpublishOperation)
      } else {
        return opentipScan(false)
      }
    } catch (e) {
      return opentipScan(e)
    }
  })
}

var tip = function (options, callback) {
  var commonBlockchain = options.commonBlockchain
  if (options.sha1) {
    options.openpublishSha1 = options.sha1
  }
  if (options.amount) {
    options.tipAmount = options.amount
  }
  if (options.destination) {
    options.tipDestinationAddress = options.destination
  }
  opentip.create(options, function (err, signedTxHex, txid) {
    if (err) {
      callback(err, null)
    } else {
      var propagateResponse = function (err, res) {
        var tipTx = {
          openpublishSha1: options.openpublishSha1,
          tipDestinationAddress: options.tipDestinationAddress,
          tipAmount: options.tipAmount,
          txid: txid
        }
        if (err) {
          tipTx.propagateResponse = 'failure'
        } else {
          tipTx.propagateResponse = 'success'
        }
        callback(err, tipTx)
      }
      commonBlockchain.Transactions.Propagate(signedTxHex, propagateResponse)
    }
  })
}

var OpenPublish = {
  register: register,
  transfer: transfer,
  tip: tip,
  scanSingle: scanSingle,
  getData: getData,
  getPayloadsLength: getPayloadsLength,
  processRegistration: processRegistration,
  processTransfer: processTransfer
}

module.exports = OpenPublish
