import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tronInfoFailed, tronInfoLooksReady, tronTxContractRet } from './tron-receipt'

test('empty info is not ready', () => {
  assert.equal(tronInfoLooksReady({}), false)
  assert.equal(tronInfoLooksReady(null), false)
})

test('id or blockNumber or receipt.result counts as ready', () => {
  assert.equal(tronInfoLooksReady({ id: 'abc' }), true)
  assert.equal(tronInfoLooksReady({ blockNumber: 12 }), true)
  assert.equal(tronInfoLooksReady({ receipt: { result: 'SUCCESS' } }), true)
})

test('receipt.result other than SUCCESS is failed', () => {
  assert.equal(tronInfoFailed({ receipt: { result: 'SUCCESS' } }), false)
  assert.equal(tronInfoFailed({ receipt: { result: 'REVERT' } }), true)
  assert.equal(tronInfoFailed({}), false)
})

test('reads first contractRet', () => {
  assert.equal(tronTxContractRet({ ret: [{ contractRet: 'SUCCESS' }] }), 'SUCCESS')
  assert.equal(tronTxContractRet({}), undefined)
})
