import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  coerceWalletHexString,
  asNonEmptyTrimmedString,
  evmPersonalSignParams,
  fromHex,
  humanizeTronWireMessage,
  toEip1193Quantity,
  toHex,
  utf8ToPersonalSignHex,
} from './hex.ts'

describe('asNonEmptyTrimmedString', () => {
  it('rejects TronLink locked / non-string defaultAddress fields', () => {
    assert.equal(asNonEmptyTrimmedString(false), undefined)
    assert.equal(asNonEmptyTrimmedString(true), undefined)
    assert.equal(asNonEmptyTrimmedString({ weird: true }), undefined)
    assert.equal(asNonEmptyTrimmedString(null), undefined)
    assert.equal(asNonEmptyTrimmedString('  '), undefined)
    assert.equal(asNonEmptyTrimmedString(' TJYeasTPa6gpEEfYqUjZgLSjDiPZb4xD6T '), 'TJYeasTPa6gpEEfYqUjZgLSjDiPZb4xD6T')
  })
})

describe('toHex / fromHex', () => {
  it('round-trips UTF-8 (not charCodeAt Latin-1)', () => {
    assert.equal(fromHex(toHex('Sign in')), 'Sign in')
    assert.equal(fromHex(toHex('签入')), '签入')
    assert.equal(toHex('A'), '0x41')
  })
})

describe('evmPersonalSignParams', () => {
  it('hex-encodes UTF-8 and lowercases the signer address (TokenPocket)', () => {
    const [hex, addr] = evmPersonalSignParams(
      'Sign in to Zekion Application',
      '0xAbC0000000000000000000000000000000000001',
    )
    assert.equal(addr, '0xabc0000000000000000000000000000000000001')
    assert.equal(hex, utf8ToPersonalSignHex('Sign in to Zekion Application'))
    assert.match(hex, /^0x[0-9a-f]+$/)
    assert.equal(
      new TextDecoder().decode(Uint8Array.from(hex.slice(2).match(/../g)!.map((b) => parseInt(b, 16)))),
      'Sign in to Zekion Application',
    )
  })

  it('does not double-encode an already-hex message', () => {
    const [hex] = evmPersonalSignParams(
      '0x6869',
      '0x1111111111111111111111111111111111111111',
    )
    assert.equal(hex, '0x6869')
  })

  it('rejects a non-EVM address', () => {
    assert.throws(
      () => evmPersonalSignParams('hi', 'TJYeasTPa6gp4yNd8GEoXQiK1Fb5aG1j2A'),
      /personal_sign address/,
    )
  })
})

describe('toEip1193Quantity', () => {
  it('preserves 0n / 0 / 0x0 (truthy ? would drop these)', () => {
    assert.equal(toEip1193Quantity(0n), '0x0')
    assert.equal(toEip1193Quantity(0), '0x0')
    assert.equal(toEip1193Quantity('0x0'), '0x0')
  })

  it('encodes positive bigint fees', () => {
    const fee = 45_921_801_897_763n
    assert.equal(toEip1193Quantity(fee), `0x${fee.toString(16)}`)
  })

  it('returns undefined for empty', () => {
    assert.equal(toEip1193Quantity(undefined), undefined)
    assert.equal(toEip1193Quantity(null), undefined)
    assert.equal(toEip1193Quantity(''), undefined)
  })
})

describe('coerceWalletHexString', () => {
  it('passes through a hex string', () => {
    assert.equal(
      coerceWalletHexString('  0xdead  ', 'signature'),
      '0xdead',
    )
  })

  it('unwraps wallet objects (TronLink / WC sign result, tx hash wrapper)', () => {
    assert.equal(
      coerceWalletHexString({ signature: '0xsig' }, 'signature'),
      '0xsig',
    )
    assert.equal(
      coerceWalletHexString({ hash: '0xabc' }, 'txHash'),
      '0xabc',
    )
    assert.equal(
      coerceWalletHexString({ txID: 'a'.repeat(64) }, 'txHash'),
      'a'.repeat(64),
    )
  })

  it('unwraps EVM wallet sendTransaction objects (not Tron)', () => {
    const hash = `0x${'ab'.repeat(32)}`
    assert.equal(coerceWalletHexString({ txHash: hash }, 'txHash'), hash)
    assert.equal(
      coerceWalletHexString({ result: { hash } }, 'txHash'),
      hash,
    )
    assert.equal(
      coerceWalletHexString({ data: { transactionHash: hash } }, 'txHash'),
      hash,
    )
    assert.equal(
      coerceWalletHexString(
        { jsonrpc: '2.0', result: { hash } },
        'txHash',
      ),
      hash,
    )
    assert.equal(coerceWalletHexString([hash], 'txHash'), hash)
    assert.equal(
      coerceWalletHexString(
        { hash, signature: { r: `0x${'11'.repeat(32)}`, s: `0x${'22'.repeat(32)}` } },
        'txHash',
      ),
      hash,
    )
  })

  it('does not treat EVM tx calldata or addresses as a hash', () => {
    assert.throws(
      () =>
        coerceWalletHexString(
          { to: '0x1234567890123456789012345678901234567890', data: `0x${'cd'.repeat(40)}` },
          'txHash',
        ),
      /txHash is not a hex string \(got object keys=/,
    )
  })

  it('throws wallet message for TronLink { code, message } envelopes', () => {
    assert.throws(
      () =>
        coerceWalletHexString(
          { code: 'USER_CANCEL', message: 'Confirmation declined by user' },
          'txHash',
        ),
      /Confirmation declined by user/,
    )
  })

  it('hex-encodes a Uint8Array', () => {
    assert.equal(
      coerceWalletHexString(Uint8Array.from([0xde, 0xad]), 'signature'),
      '0xdead',
    )
  })

  it('rejects numbers (viem hexToBytes would throw n.slice is not a function)', () => {
    assert.throws(
      () => coerceWalletHexString(1, 'txHash'),
      /txHash is not a hex string/,
    )
  })
})

describe('humanizeTronWireMessage', () => {
  it('decodes bare hex ASCII Transaction expired', () => {
    assert.equal(
      humanizeTronWireMessage('5472616e73616374696f6e2065787069726564'),
      'Transaction expired',
    )
  })

  it('leaves normal text alone', () => {
    assert.equal(humanizeTronWireMessage('BANDWITH_ERROR'), 'BANDWITH_ERROR')
  })
})
