var bitcoin = require('bitcoinjs-lib');

document.getElementById("generate-wallet").addEventListener("click", function(event) {

  var seedString = document.getElementById("brainwallet-seed").value;
  seed = bitcoin.crypto.sha256(seedString);
  wallet = new bitcoin.Wallet(seed, bitcoin.networks.testnet);
  address = wallet.generateAddress();
  document.getElementById("wallet-address").innerHTML = address;

});

var bitstore = require("bitstore");

document.getElementById("generate-bitstore-client").addEventListener("click", function(event) {

  var signMessage = function (message, cb) {
    var key = bitcoin.ECKey.fromWIF(wallet.getPrivateKey(0).toWIF());
    var network = bitcoin.networks.testnet;
    cb(null, bitcoin.Message.sign(key, message, network).toString('base64'));
  };

  bitstoreClient = bitstore({
    network: 'testnet',
    address: address,
    signMessage: signMessage
  });

  bitstoreClient.wallet.get(function (err, res) {
    bitstoreDepositAddress = res.body.deposit_address;
    bitstoreBalance = res.body.balance;
    document.getElementById("bitstore-deposit-address").innerHTML = bitstoreDepositAddress;
    document.getElementById("bitstore-balance").innerHTML = bitstoreBalance;
  });

});

var dragDrop = require('drag-drop');

dragDrop('#drop', function (files) {
  files.forEach(function (file) {
    bitstoreClient.files.put(file, function (err, res) {
      var receipt = res.body;
      var hash_sha1 = receipt.hash_sha1;
      var hash_btih = receipt.hash_btih;
      var uri = receipt.uri;
      var size = receipt.size;
      var torrent = receipt.torrent;
      document.getElementById("hash_sha1").innerHTML = hash_sha1;
      document.getElementById("hash_btih").innerHTML = hash_btih;
      document.getElementById("size").innerHTML = size;
      document.getElementById("uri").innerHTML = uri;
    });
  });
});