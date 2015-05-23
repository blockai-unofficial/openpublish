var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');
var magnet = require('magnet-uri');
var crypto = require("crypto");
var blockcast = require("blockcast");

var FileReader = typeof(window) != "undefined" ? window.FileReader : require("filereader");

var post = function(options, callback) {
  var file = options.file;
  var keywords = options.keywords;
  var title = options.title;
  var uri = options.uri;
  var address = options.address;
  var unspentOutputs = options.unspentOutputs;
  var propagateTransaction = options.propagateTransaction;
  var propagationStatus = options.propagationStatus;
  var signTransaction = options.signTransaction;
  var reader = new FileReader();
  reader.addEventListener('load', function (e) {
    var arr = new Uint8Array(e.target.result);
    var buffer = new Buffer(arr);
    buffer.name = file.name;
    var sha1;
    if (typeof(window) == "undefined") {
      sha1 = crypto.createHash('sha1').update(buffer).digest("hex");
    }
    else {
      sha1 = crypto.createHash('sha1').update(arr).digest("hex");
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
      var dataJSON = JSON.stringify(data);
      blockcast.post({
        data: dataJSON,
        address: address,
        unspentOutputs: unspentOutputs,
        propagateTransaction: propagateTransaction,
        propagationStatus: propagationStatus,
        signTransaction: signTransaction
      }, function(error, blockcastTx) {
        var receipt = {
          data: data,
          blockcastTx: blockcastTx
        };
        callback(false, receipt);
      });
    });
  });
  reader.readAsArrayBuffer(file);
};

var OpenPublish = {
  post: post
};

module.exports = OpenPublish;