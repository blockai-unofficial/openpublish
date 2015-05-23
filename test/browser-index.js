var dragDrop = require('drag-drop');
var OpenPublish = require("../src/index");

var bitstore = require('bitstore')({
  privateKey: 'KyjhazeX7mXpHedQsKMuGh56o3rh8hm8FGhU3H6HPqfP9pA4YeoS',
  network: 'testnet'
});

dragDrop('#drop', function (files) {
  files.forEach(function (file) {
    // bitstore.files.put(file, function (err, res) {
    //   console.log(arguments);
    // });
    OpenPublish.post({
      file: file
    }, function(err, receipt) {
      console.log(err, receipt);
    });
  });
});