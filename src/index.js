var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');
var magnet = require('magnet-uri');
var crypto = require("crypto");
var blockcast = require("blockcast");



var post = function(options, callback) {
  var file = options.file;
  var keywords = options.keywords;
  var title = options.title;
  var uri = options.uri;
  var reader = new FileReader();
  reader.addEventListener('load', function (e) {
    var arr = new Uint8Array(e.target.result);
    var buffer = new Buffer(arr);
    buffer.name = file.name;
    var sha1 = crypto.createHash('sha1').update(arr).digest("hex");
    createTorrent(buffer, function onTorrent (err, torrentBuffer) {
      var torrent = parseTorrent(torrentBuffer);
      var btih = torrent.infoHash;
      var magnetUri = magnet.encode({
        xt: [
          'urn:sha1:' + sha1,
          'urn:btih:' + btih
        ],
        tr: [
          'udp://tracker.webtorrent.io:80'
        ],
        xl: file.size,
        dn: file.name,
        as: uri,
      });
      var receipt = {
        magnetUri: magnetUri,
        btih: btih,
        sha1: sha1,
        name: file.name,
        size: file.size,
        type: file.type,
        title: title,
        uri: uri,
        keywords: keywords
      }
      callback(false, receipt);
    });
  });
  reader.readAsArrayBuffer(file);
};

var OpenPublish = {
  post: post
};

module.exports = OpenPublish;