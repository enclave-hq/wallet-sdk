import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  broadcastAlreadyInFlight,
  broadcastLooksRateLimited,
  detectTronLinkInjector,
  resolveBroadcastTxId,
  skipWalletBroadcastAfterSign,
  tronTxLooksOnChain,
} from './tron-broadcast'

test('429 broadcast with signed txID is accepted', () => {
  assert.equal(broadcastLooksRateLimited({ message: '429 Too Many Requests' }), true)
  assert.equal(
    resolveBroadcastTxId({
      signedTxId: 'abc',
      broadcast: { result: false, message: 'Too Many Requests' },
    }),
    'abc',
  )
})

test('DUP_TRANSACTION with signed txID is accepted', () => {
  assert.equal(broadcastAlreadyInFlight({ code: 'DUP_TRANSACTION_ERROR' }), true)
  assert.equal(
    resolveBroadcastTxId({
      signedTxId: 'abc',
      broadcast: { result: false, message: 'DUP_TRANSACTION_ERROR' },
    }),
    'abc',
  )
})

test('failed broadcast without rate-limit or dup is rejected', () => {
  assert.equal(
    resolveBroadcastTxId({
      signedTxId: 'abc',
      broadcast: { result: false, message: 'BANDWITH_ERROR' },
    }),
    null,
  )
})

test('empty {} is not on chain', () => {
  assert.equal(tronTxLooksOnChain({}), false)
  assert.equal(tronTxLooksOnChain({ txID: 'abc', raw_data: {} }), true)
})

test('TronLink + signed txID skips our second broadcast', () => {
  assert.equal(skipWalletBroadcastAfterSign({ signedTxId: 'abc', hasTronLink: true }), true)
  assert.equal(skipWalletBroadcastAfterSign({ signedTxId: 'abc', hasTronLink: false }), false)
  assert.equal(skipWalletBroadcastAfterSign({ signedTxId: '', hasTronLink: true }), false)
  assert.equal(detectTronLinkInjector({ tronLink: {} }), true)
  assert.equal(detectTronLinkInjector({}), false)
})

test('successful broadcast returns txID', () => {
  assert.equal(
    resolveBroadcastTxId({
      signedTxId: 'abc',
      broadcast: { result: true, txid: 'abc' },
    }),
    'abc',
  )
})
