var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');
var magnet = require('magnet-uri');
var crypto = require("crypto");
var blockcast = require("blockcast");
var opentip = require("./opentip");

var FileReader = typeof(window) != "undefined" ? window.FileReader : require("filereader");

var register = function(options, callback) {
  getData(options, function(err, data) {
    var dataJSON = JSON.stringify(data);
    blockcast.post({
      data: dataJSON,
      commonWallet: options.commonWallet,
      commonBlockchain: options.commonBlockchain,
      propagationStatus: options.propagationStatus,
      buildStatus: options.buildStatus
    }, function(error, blockcastTx) {
      var receipt = {
        data: data,
        blockcastTx: blockcastTx
      };
      callback(false, receipt);
    });
  });
}

var getPayloadsLength = function(options, callback) {
  getData(options, function(err, data) {
    var dataJSON = JSON.stringify(data);
    blockcast.payloadsLength({data: dataJSON}, function(err, payloadsLength) {
      callback(err, payloadsLength);
    });
  });
}

var getData = function(options, callback) {
  var file = options.file;
  var keywords = options.keywords;
  var title = options.title;
  var uri = options.uri;
  var sha1 = options.sha1;
  var reader = new FileReader();
  reader.addEventListener('load', function (e) {
    var arr = new Uint8Array(e.target.result);
    var buffer = new Buffer(arr);
    buffer.name = file.name;
    if (!sha1) {
      if (typeof(window) == "undefined") {
        sha1 = crypto.createHash('sha1').update(buffer).digest("hex");
      }
      else {
        sha1 = crypto.createHash('sha1').update(arr).digest("hex");
      }
    }
    createTorrent(buffer, function onTorrent (err, torrentBuffer) {
      var torrent = parseTorrent(torrentBuffer);
      var btih = torrent.infoHash;
      var data = {
        op: "r",
        btih: btih,
        sha1: sha1,
        name: file.name,
        size: file.size,
        type: file.type,
        title: title,
        uri: uri,
        keywords: keywords
      };
      callback(err, data);
    });
  });
  reader.readAsArrayBuffer(file);
};

var scanSingle = function(options, callback) {

  var opentipScan = function(blockcastErr) {
    opentip.scanSingle(options, function(err, tip) {
      if (tip) {
        callback(false, tip)
      }
      else {
        callback(blockcastErr, false);
      }
    });
  }

  blockcast.scanSingle(options, function(err, message) {
    if (err || !message) {
      return opentipScan(err);
    }
    try {
      var data = JSON.parse(message);
      if (data.op = "r") {
        callback(false, data);
      }
      else {
        return opentipScan(false);
      }
    }
    catch(e) {
      return opentipScan(e);
    }
  });


};

var tip = function(options, callback) {
  var commonBlockchain = options.commonBlockchain;
  if (options.sha1) {
    options.openpublishSha1 = options.sha1;
  }
  if (options.amount) {
    options.tipAmount = options.amount;
  }
  if (options.destination) {
    options.tipDestinationAddress = options.destination;
  }
  opentip.create(options, function(err, signedTxHex, txid) {
    if (err) {
      callback (err, null);
    }
    else {
      var propagateResponse = function(err, res) {
        var tipTx = {
          openpublishSha1: options.openpublishSha1,
          tipDestinationAddress: options.tipDestinationAddress,
          tipAmount: options.tipAmount,
          txid: txid
        }
        if (err) {
          tipTx.propagateResponse = "failure";
        }
        else {
          tipTx.propagateResponse = "success";
        }
        callback(err, tipTx);
      }
      commonBlockchain.Transactions.Propagate(signedTxHex, propagateResponse);
    }
  });
};

var OpenPublish = {
  register: register,
  tip: tip,
  scanSingle: scanSingle,
  getData: getData,
  getPayloadsLength: getPayloadsLength
};

module.exports = OpenPublish;