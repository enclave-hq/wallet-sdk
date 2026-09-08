import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extendUnsignedTronTxExpiration,
  isTronTransactionExpiredError,
} from './tron-tx-build.ts'

test('isTronTransactionExpiredError recognizes ASCII and hex wire forms', () => {
  assert.equal(isTronTransactionExpiredError('Transaction expired'), true)
  assert.equal(
    isTronTransactionExpiredError(new Error('5472616e73616374696f6e2065787069726564')),
    true,
  )
  assert.equal(isTronTransactionExpiredError({ message: 'TRANSACTION_EXPIRATION_ERROR' }), true)
  assert.equal(isTronTransactionExpiredError('BANDWITH_ERROR'), false)
})

test('extendUnsignedTronTxExpiration uses TronWeb helper when present', async () => {
  const calls: unknown[] = []
  const tronWeb = {
    transactionBuilder: {
      extendExpiration: async (tx: unknown, sec: number) => {
        calls.push([tx, sec])
        return { ...(tx as object), ok: true }
      },
    },
  }
  const out = await extendUnsignedTronTxExpiration(tronWeb, { txID: 'a' }, 120)
  assert.deepEqual(calls, [[{ txID: 'a' }, 120]])
  assert.equal((out as { ok?: boolean }).ok, true)
})
