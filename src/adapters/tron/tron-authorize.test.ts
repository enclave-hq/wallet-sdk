import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { interpretTronAuthorizeResult, isThenable } from './tron-authorize'

describe('interpretTronAuthorizeResult', () => {
  it('treats empty string as locked (not user reject)', () => {
    assert.deepEqual(interpretTronAuthorizeResult(''), { kind: 'locked' })
    assert.deepEqual(interpretTronAuthorizeResult(null), { kind: 'locked' })
  })

  it('accepts legacy code 200 and TIP-1102 address arrays', () => {
    assert.deepEqual(interpretTronAuthorizeResult({ code: 200, message: 'ok' }), { kind: 'ok' })
    assert.deepEqual(interpretTronAuthorizeResult(['TMeDftdKp1Mq1yqnUT4iA6XM36sqVXTZmg']), {
      kind: 'ok',
    })
  })

  it('distinguishes pending vs rejected', () => {
    assert.deepEqual(interpretTronAuthorizeResult({ code: 4000 }), { kind: 'pending' })
    assert.deepEqual(interpretTronAuthorizeResult({ code: 4001 }), { kind: 'rejected' })
  })

  it('does not treat unknown payloads as reject', () => {
    assert.deepEqual(interpretTronAuthorizeResult({ code: 999 }), {
      kind: 'unknown',
      raw: { code: 999 },
    })
  })
})

describe('isThenable', () => {
  it('detects promises only', () => {
    assert.equal(isThenable(Promise.resolve(1)), true)
    assert.equal(isThenable(true), false)
    assert.equal(isThenable(null), false)
  })
})
