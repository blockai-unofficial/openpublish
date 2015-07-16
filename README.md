# Open Publish

A publishing protocol for registering media as a digital asset on the Bitcoin blockchain.

Open Publish aims to give ownership of digital media back to the individual and allow individuals to create contracts for licensing and micropayment channels using Bitcoin. Think combining BlockSign, OpenAssets and a royalty payment mechanism.

Like BlockSign, digital media is represented as a cryptographic digest but in a content-addressable format that works seamlessly with BitTorrent and WebTorrent. This content-addressable representation is provably signed, timestamped, and recorded in perpetuity by the Bitcoin blockchain in a format compatible with the BitTorrent Magnet URI scheme.

The Open Publish protocol allows claiming ownership over a digital asset that can be used by other products to represent a limited and non-exclusive copyright of this document.

Any honest third-party software can read the state of ownership from the Bitcoin blockchain and create software that directs payments to the legitimate owners of the content in the form of direct tips, monthly subscriptions or various synchronization licenses modeled on existing intellectual property systems.

For example, someone could write software that displays media with a consumer Bitcoin wallet allowing for people to easily and directly tip the rights-holders.

It assumes that the wallet address that posted the Open Publish registration transaction to the Bitcoin blockchain is controlled by the owner of the registered media.

# Install

`npm install openpublish`

# Browser Usage

In our examples we're going to use ```bitcoinjs-lib``` to create our wallet.

## Bitcoin Wallet

```javascript
var bitcoin = require("bitcoinjs-lib");

var seed = bitcoin.crypto.sha256("test");
var wallet = new bitcoin.Wallet(seed, bitcoin.networks.testnet);
var address = wallet.generateAddress();

var signRawTransaction = function(txHex, cb) {
  var tx = bitcoin.Transaction.fromHex(txHex);
  var signedTx = wallet.signWith(tx, [address]);
  var txid = signedTx.getId();
  var signedTxHex = signedTx.toHex();
  cb(false, signedTxHex, txid);
};

var commonWallet = {
  signRawTransaction: signRawTransaction,
  address: address
}
```

We'll need to provide an instance of a commonBlockchain which will provide functions for signing a transaction, propagating a trasnaction, and looking up a transaction by ```txid```.

In this example we're using the in memory version that is provided by ```mem-common-blockchain```.


```javascript
var commonBlockchain = require("mem-common-blockchain")({
  type: "local"
});

// or we could connect to testnet

// commonBlockchain = require('blockcypher-unofficial')({
//   network: "testnet"
// });
```

## Register Media with an Open Publish transaction posted to the Bitcoin network

Hosting and distribution of content is not the goal of Open Publish although an optional link to the content can be part of the metadata.

```javascript
var file; // a browser File object returned from drop or file select form
var fileUri; // a permalink to the above file

openpublish.register({
  file: file,
  uri: fileUri,
  commonWallet: commonWallet,
  commonBlockchain: commonBlockchain
}, function(err, receipt) {
  var blockcastTx = receipt.blockcastTx;
  var txid = blockcastTx.txid; // the Bitcoin transaction where the first payload of the the data is embedded
});

```

## Public stream

Open Publish transactions are native Bitcoin transactions. This means they are broadcast and stored on all nodes in the Bitcoin network. Anyone can freely stream, read, and write their own Open Publish transactions in same equal-access manner as native Bitcoin transactions. Open Publish takes advantage of the unique distributed yet single-source-of-truth nature of the Bitcoin blockchain.

What this means is that neither Blockai nor any other private entity is required to register with Open Publish.

Here we're scanning for a list of Open Published documents for our wallet. Open Publish uses the Blockcast protocol to embed data in the blockchain.

```javascript
commonBlockchain.Addresses.Transactions([commonWallet.address], function(err, addresses_transactions) {
  var transactions = addresses_transactions[0];
  var openPublishDocuments = [];
  transactions.forEach(function(tx) {
    blockcast.scanSingle({
      txid: tx.txid,
      commonBlockchain: commonBlockchain
    }, function(err, message) {
      if (!message) {
        return;
      }
      var data = JSON.parse(message);
      if (!data) {
        return;
      }
      if (data.op == "r") {
        openPublishDocuments.push(data);
      }
    });
  });
});
```
