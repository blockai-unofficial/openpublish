# Open Publish

A publishing protocol for registering media as a digital asset on the Bitcoin blockchain.

Registering media
---

In our examples we're going to use ```bitcoinjs-lib``` to create our wallet.

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

In this example we're using the in memory version that is provided by ```abstract-common-blockchain```.


```javascript
var commonBlockchain = require("abstract-common-blockchain")({
  type: "local"
});

// or we could connect to testnet

// commonBlockchain = require('blockcypher-unofficial')({
//   network: "testnet"
// });
```

And finally we're ready to register.

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

Scan for a document from a single transaction
---

We can also provide the txid from the first transaction's payload.

```javascript
blockcast.scanSingle({
  txid: '',
  commonBlockchain: commonBlockchain
}, function(err, blockcastDocument) {
  console.log(blockcastDocument.data);
});

```