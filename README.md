# Open Publish

[![Build Status](http://drone.d.blockai.com/api/badge/github.com/blockai/openpublish/status.svg?branch=master)](http://drone.d.blockai.com/github.com/blockai/openpublish)

A publishing protocol for registering media as a digital asset on the Bitcoin blockchain.

Open Publish aims to give ownership of digital media back to the individual and allow individuals to create contracts for licensing and micropayment channels using Bitcoin. Think combining Proof of Existence, OpenAssets and a royalty payment mechanism.

Like BlockSign, digital media is represented as a cryptographic digest but in a content-addressable format that works seamlessly with IPFS, BitTorrent and WebTorrent. This content-addressable representation is provably signed, timestamped, and recorded in perpetuity by the Bitcoin blockchain in a format compatible with the BitTorrent Magnet URI scheme and IPFS address scheme.

The Open Publish protocol allows claiming ownership over a digital asset that can be used by other products to represent a limited and non-exclusive copyright of this document.

The Open Publish protocol allows for transfering partial ownership of these digital assets.

Any honest third-party software can read the state of ownership from the Bitcoin blockchain and create software that directs payments to the legitimate owners of the content in the form of direct tips, monthly subscriptions or various synchronization licenses modeled on existing intellectual property systems.

For example, someone could write software that displays media with a consumer Bitcoin wallet allowing for people to easily and directly tip the rights-holders.

It assumes that the wallet address that posted the Open Publish registration transaction to the Bitcoin blockchain is controlled by the owner of the registered media.

Blockai cannot control what assets are registered on the Bitcoin blockchain so it is up to individual developers or development teams to make sure they honor their local rules and regulations pertaining to copyright. For example, Blockai will not display content that is deemed to not be owned by the claimant Bitcoin address, fully adhering to any DMCA notices.

# Install

`npm install openpublish`

# Browser Usage

In our examples we're going to use ```test-common-wallet``` to create our wallet.

This simple wallet and the Open Publish API adhere to the [Common Wallet](https://github.com/blockai/abstract-common-wallet) standard.

## Bitcoin Wallet

We will assume that this wallet is owned and operated by Alice.

```js
var aliceWallet = testCommonWallet({
  seed: "some-random-very-long-and-super-safe-passphrase",
  network: "testnet",
  commonBlockchain: commonBlockchain
});
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

Files can be hosted on any existing web servers at the expense of the owner. A private service by Blockai called [Bitstore](https://github.com/blockai/bitstore-client) is a content-addressable file hosting and distribution service that uses Bitcoin public key infrastructure for authentication and payment. All files hosted on Bitstore are seeded on both BitTorrent and WebTorrent. As it uses Bitcoin wallets for authentication no account creation is necessary which makes it very convenient for application developers.

In this example, Alice is using her wallet along with a file that she draged and dropped on to a web page.

```javascript
var openpublish = require('openpublish');

var file; // a browser File object returned from drop or file select form
var fileUri; // a permalink to the above file

openpublish.register({
  file: file,
  uri: fileUri,
  commonWallet: aliceWallet,
  commonBlockchain: commonBlockchain
}, function(err, receipt) {
  var registerData = receipt.data;
  var sha1 = registerData.sha1; // the SHA-1 that represents your media file
  var blockcastTx = receipt.blockcastTx;
  var txid = blockcastTx.txid; // the Bitcoin transaction where the first payload of the the data is embedded
  var transactionTotal = blockcastTx.transactionTotal; // the number of Bitcoin transactions in the data payload
});
```

## Transfering ownership of digital assets

Open Publish allows for rights-holders to transfer partial ownership of the digital assets that represent their registered works, in a manner similar to how rights are transfered in music and book publishing.

In this example, Alice's is transfering part ownership of her digital asset to her friend Bob.

Alice started with 100,000,000 of total value in her asset when she first registered her media file.

After this transaction has been signed by both wallets and cleared by the Bitcoin network, Alice will have 70,000,000 and Bob will have 30,000,000.

Transfers are only valid for a set number of days before full ownership reverts back to Alice.

```js
var bobWallet = testCommonWallet({
  seed: "another-random-very-long-and-super-safe-passphrase",
  network: "testnet",
  commonBlockchain: commonBlockchain
});

openpublish.transfer({
    assetValue: 30000000, // the number of assets that Alice is transfering
    bitcoinValue: 5000000, // the number of bitcoin that Bob is transfering
    ttl: 365, // the number of days that the transfer is valid for before reverting back to Alice
    sha1: registerData.sha1,
    assetWallet: aliceWallet,
    bitcoinWallet: bobWallet,
    commonBlockchain: commonBlockchain
  }, function(err, receipt) {
    var blockcastTx = receipt.blockcastTx;
    var txid = blockcastTx.txid; // the Bitcoin transaction where the first payload of the the data is embedded
    var transactionTotal = blockcastTx.transactionTotal; // the number of Bitcoin transactions in the data payload
  });
});
```

## Public stream

Open Publish transactions are native Bitcoin transactions. This means they are broadcast and stored on all nodes in the Bitcoin network. Anyone can freely stream, read, and write their own Open Publish transactions in same equal-access manner as native Bitcoin transactions. Open Publish takes advantage of the unique distributed yet single-source-of-truth nature of the Bitcoin blockchain.

What this means is that neither Blockai nor any other private entity is required to register with Open Publish.

### Open Publish State

Blockai runs and maintains it's own Open Publish state machine which can be query about the state of ownership for individual assets, to get a list of assets owned by a particular Bitcoin address, to see the tips associated with a particular asset or owner, and more.

Check out the [```openpublish-state```](https://github.com/blockai/openpublish-state) for more info.

### Scanning without using Blockai's Open Publish State

Here we're scanning for a list of Open Published documents for our wallet. During these early development stages Open Publish uses the [Blockcast](https://github.com/blockai/blockcast) protocol to embed data in the blockchain. As the protocol matures it will support additional small footprint formats.

In this example we're querying the bitcoin blockchain for all of Alice's transactions and then scanning them one by one to look for all of her Open Publish registrations.

```javascript
commonBlockchain.Addresses.Transactions([aliceWallet.address], function(err, addresses_transactions) {
  var transactions = addresses_transactions[0];
  var openPublishDocuments = [];
  transactions.forEach(function(tx) {
    blockcast.scanSingle({
      txid: tx.txid,
      commonBlockchain: commonBlockchain
    }, function(err, body) {
      if (!message) {
        return;
      }
      var data = JSON.parse(body);
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

## Tipping and Micropayments

Open Publish comes with some very basic tipping functionalities. The tip will only be valid if the destination address matches the owner of the asset as registered on the blockchain.

In this example, Alice found a really great photograph that is represented by the SHA-1 ```d1aef793e057364f8bd7a0344b4aa77be4aa7561```. She used ```openpublish-state``` to find out the wallet address of the rights-holder and then sent them a tip in bitcoin.

```js
var sha1 = "d1aef793e057364f8bd7a0344b4aa77be4aa7561";

openpublishState.findDoc({
  sha1: sha1
}, function(err, openpublishDoc) {
  var tipDestinationAddress = openpublishDoc.sourceAddresses[0];
  openpublish.tip({
    destination: tipDestinationAddress,
    sha1: sha1,
    amount: 10000, // in satoshi
    commonWallet: aliceWallet,
    commonBlockchain: commonBlockchain
  }, function(error, tipTx) {
    var propagateResponse = tipTx.propagateResponse;
    var txid = tipTx.txid;
  });
});
```
