var dragDrop = require('drag-drop');
var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');
var magnet = require('magnet-uri');
var crypto = require("crypto");

var bitstore = require('bitstore')({
  privateKey: 'KyjhazeX7mXpHedQsKMuGh56o3rh8hm8FGhU3H6HPqfP9pA4YeoS',
  network: 'testnet'
});

dragDrop('#drop', function (files) {
  files.forEach(function (file) {
    console.log(typeof file);
    console.log(file);
    bitstore.files.put(file, function (err, res) {
      console.log(arguments);
    });
    var reader = new FileReader();
    reader.addEventListener('load', function (e) {
      var arr = new Uint8Array(e.target.result);
      var buffer = new Buffer(arr);
      buffer.name = file.name;
      var sha1 = crypto.createHash('sha1').update(arr).digest("hex");
      createTorrent(buffer, function onTorrent (err, torrentBuffer) {
        var torrent = parseTorrent(torrentBuffer);
        console.log(torrent);
        var btih = torrent.infoHash;
        console.log('btih:', btih);
        console.log('sha1:', sha1);
        console.log('name:', file.name);
        console.log('size:', file.size);
        console.log('type:', file.type);
        var uri = magnet.encode({
          xt: [
            'urn:sha1:' + sha1,
            'urn:btih:' + btih
          ],
          tr: [
            'udp://tracker.webtorrent.io:80'
          ],
          xl: file.size,
          dn: file.name,
          as: 'https://bitstore.com/thing',
        });
        console.log(uri.length);
        console.log(uri);
      });
    });
    reader.readAsArrayBuffer(file);
  });
});