import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveTronAccountsChangedAddress } from './tron-accounts-changed'

describe('resolveTronAccountsChangedAddress', () => {
  it('parses TIP-1193 string[]', () => {
    assert.equal(
      resolveTronAccountsChangedAddress(['TQKLs3GzCNLjzyCvaPWSrqcpUGUhadxm7P']),
      'TQKLs3GzCNLjzyCvaPWSrqcpUGUhadxm7P',
    )
    assert.equal(resolveTronAccountsChangedAddress([]), null)
  })

  it('parses legacy TronLink objects', () => {
    assert.equal(
      resolveTronAccountsChangedAddress({
        address: { base58: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' },
      }),
      'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8',
    )
    assert.equal(
      resolveTronAccountsChangedAddress({
        address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8',
      }),
      'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8',
    )
  })

  it('rejects empty / unknown payloads', () => {
    assert.equal(resolveTronAccountsChangedAddress(null), null)
    assert.equal(resolveTronAccountsChangedAddress(undefined), null)
    assert.equal(resolveTronAccountsChangedAddress({}), null)
    assert.equal(resolveTronAccountsChangedAddress(''), null)
  })
})
