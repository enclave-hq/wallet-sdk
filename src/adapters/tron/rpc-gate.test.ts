import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SerialRpcGate,
  isRateLimitError,
  scheduleRpc,
  throttleTronWeb,
  withRateLimitRetry,
} from './rpc-gate'

test('scheduleRpc is the shared library queue', async () => {
  const order: number[] = []
  await Promise.all([
    scheduleRpc(async () => {
      order.push(1)
      return 1
    }),
    scheduleRpc(async () => {
      order.push(2)
      return 2
    }),
  ])
  assert.deepEqual(order, [1, 2])
})

test('SerialRpcGate runs calls one-by-one with min interval', async () => {
  const gate = new SerialRpcGate(40)
  const started: number[] = []
  await Promise.all([
    gate.schedule(async () => {
      started.push(Date.now())
      return 1
    }),
    gate.schedule(async () => {
      started.push(Date.now())
      return 2
    }),
  ])
  assert.equal(started.length, 2)
  assert.ok(started[1]! - started[0]! >= 35)
})

test('isRateLimitError matches 429 text and status', () => {
  assert.equal(isRateLimitError(new Error('429 (Too Many Requests)')), true)
  assert.equal(isRateLimitError({ status: 429 }), true)
  assert.equal(isRateLimitError(new Error('network down')), false)
})

test('withRateLimitRetry retries 429 then succeeds', async () => {
  let n = 0
  const out = await withRateLimitRetry(async () => {
    n += 1
    if (n < 2) throw new Error('Too Many Requests')
    return 'ok'
  }, 3, 1)
  assert.equal(out, 'ok')
  assert.equal(n, 2)
})

test('throttleTronWeb wraps solidityNode.request once', async () => {
  const calls: string[] = []
  const tw = {
    solidityNode: {
      request: async (path: string) => {
        calls.push(path)
        return { id: '1' }
      },
    },
  }
  throttleTronWeb(tw)
  throttleTronWeb(tw)
  await tw.solidityNode.request('/walletsolidity/gettransactioninfobyid')
  assert.equal(calls.length, 1)
})
