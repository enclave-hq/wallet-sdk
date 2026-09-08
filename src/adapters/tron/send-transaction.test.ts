import assert from 'node:assert/strict'
import test from 'node:test'
import { TronLinkAdapter } from './tronlink'
import { ChainType, WalletState } from '../../core/types'
import { createUniversalAddress } from '../../utils/address/universal-address'

function mockTronWeb(opts?: { built?: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const tronWeb = {
    address: {
      toHex: (s: string) => (s.startsWith('T') ? `41${'ab'.repeat(20)}` : s.replace(/^0x/i, '41')),
      fromHex: (s: string) => (s.startsWith('T') ? s : `T${'1'.repeat(33)}`),
    },
    transactionBuilder: {
      triggerSmartContract: async (...args: unknown[]) => {
        calls.push({ method: 'triggerSmartContract', args })
        return opts?.built ?? { transaction: { txID: 'built' } }
      },
      sendTrx: async (...args: unknown[]) => {
        calls.push({ method: 'sendTrx', args })
        return { txID: 'trx' }
      },
      extendExpiration: async (tx: unknown, sec: number) => {
        calls.push({ method: 'extendExpiration', args: [tx, sec] })
        return typeof tx === 'object' && tx
          ? { ...(tx as object), extendedBy: sec }
          : tx
      },
    },
    trx: {
      sign: async (tx: unknown) => ({ ...(typeof tx === 'object' && tx ? tx : {}), txID: 'signed-id' }),
      sendRawTransaction: async () => ({ result: true, txid: 'signed-id' }),
      getTransaction: async () => ({}),
    },
  }
  return { tronWeb, calls }
}

class TestAdapter extends TronLinkAdapter {
  constructor(private readonly provider: unknown) {
    super()
  }
  protected getBrowserProvider() {
    return this.provider
  }
}

function connected(adapter: TronLinkAdapter) {
  adapter.state = WalletState.CONNECTED
  adapter.currentAccount = {
    universalAddress: createUniversalAddress(195, 'T'.padEnd(34, '1')),
    nativeAddress: 'T'.padEnd(34, '1'),
    chainId: 195,
    chainType: ChainType.TRON,
    isActive: true,
  }
}

test('sendTransaction builds approve via function_selector + rawParameter', async () => {
  const { tronWeb, calls } = mockTronWeb()
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)

  const hash = await adapter.sendTransaction({
    to: '0x' + 'ab'.repeat(20),
    data: '0x095ea7b3' + '00'.repeat(64),
    value: '0x0',
    chainId: 195,
  })
  assert.equal(hash, 'signed-id')
  const trigger = calls.find((c) => c.method === 'triggerSmartContract')
  assert.ok(trigger)
  assert.equal(trigger!.args[1], 'approve(address,uint256)')
  const options = trigger!.args[2] as { rawParameter?: string }
  assert.equal(options.rawParameter, '00'.repeat(64))
})

test('sendTransaction maps depositWithIntentAndSend selector, not Hub depositWithIntent', async () => {
  const { tronWeb, calls } = mockTronWeb()
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)

  const hash = await adapter.sendTransaction({
    to: '0x' + 'ab'.repeat(20),
    data: '0x594fcde9' + '00'.repeat(64),
    value: '0x1',
    chainId: 195,
  })
  assert.equal(hash, 'signed-id')
  const trigger = calls.find((c) => c.method === 'triggerSmartContract')
  assert.ok(trigger)
  assert.equal(
    trigger!.args[1],
    'depositWithIntentAndSend(string,uint256,bytes32,bytes32,uint128)',
  )
  assert.notEqual(trigger!.args[1], 'depositWithIntent(string,uint256,bytes32)')
  const options = trigger!.args[2] as { feeLimit?: number }
  assert.equal(options.feeLimit, 150_000_000)
})

test('sendTransaction uses caller feeLimit when provided', async () => {
  const { tronWeb, calls } = mockTronWeb()
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)

  await adapter.sendTransaction({
    to: '0x' + 'ab'.repeat(20),
    data: '0x594fcde9' + '00'.repeat(64),
    value: '0x1',
    chainId: 195,
    feeLimit: 150_000_000,
  })
  const trigger = calls.find((c) => c.method === 'triggerSmartContract')
  assert.ok(trigger)
  assert.equal((trigger!.args[2] as { feeLimit?: number }).feeLimit, 150_000_000)
})

test('sendTransaction does not sendRaw when TronLink tx is already on chain', async () => {
  const { tronWeb } = mockTronWeb()
  let broadcasts = 0
  tronWeb.trx.getTransaction = async () => ({ txID: 'signed-id', raw_data: {} })
  tronWeb.trx.sendRawTransaction = async () => {
    broadcasts += 1
    return { result: true, txid: 'signed-id' }
  }
  const g = globalThis as { tronLink?: unknown }
  const prev = g.tronLink
  g.tronLink = {}
  try {
    const adapter = new TestAdapter(tronWeb)
    connected(adapter)
    const hash = await adapter.sendTransaction({
      to: '0x' + 'ab'.repeat(20),
      data: '0x095ea7b3' + '00'.repeat(64),
      value: '0x0',
      chainId: 195,
    })
    assert.equal(hash, 'signed-id')
    assert.equal(broadcasts, 0)
  } finally {
    if (prev === undefined) delete g.tronLink
    else g.tronLink = prev
  }
})

test('sendTransaction broadcasts once when TronLink sign never landed', async () => {
  const { tronWeb } = mockTronWeb()
  let broadcasts = 0
  tronWeb.trx.getTransaction = async () => ({})
  tronWeb.trx.sendRawTransaction = async () => {
    broadcasts += 1
    return { result: true, txid: 'signed-id' }
  }
  const g = globalThis as { tronLink?: unknown }
  const prev = g.tronLink
  g.tronLink = {}
  try {
    const adapter = new TestAdapter(tronWeb)
    connected(adapter)
    const hash = await adapter.sendTransaction({
      to: '0x' + 'ab'.repeat(20),
      data: '0x095ea7b3' + '00'.repeat(64),
      value: '0x0',
      chainId: 195,
    })
    assert.equal(hash, 'signed-id')
    assert.equal(broadcasts, 1)
  } finally {
    if (prev === undefined) delete g.tronLink
    else g.tronLink = prev
  }
})

test('sendTransaction fails when broadcast 429s and tx is not on chain', async () => {
  const { tronWeb } = mockTronWeb()
  tronWeb.trx.sendRawTransaction = async () => {
    throw new Error('429 (Too Many Requests)')
  }
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)
  await assert.rejects(
    () =>
      adapter.sendTransaction({
        to: '0x' + 'ab'.repeat(20),
        data: '0x095ea7b3' + '00'.repeat(64),
        value: '0x0',
        chainId: 195,
      }),
    /429/,
  )
})

test('sendTransaction returns txID when broadcast 429s but tx already landed', async () => {
  const { tronWeb } = mockTronWeb()
  tronWeb.trx.getTransaction = async () => ({ txID: 'signed-id', raw_data: {} })
  tronWeb.trx.sendRawTransaction = async () => {
    throw new Error('429 (Too Many Requests)')
  }
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)
  const hash = await adapter.sendTransaction({
    to: '0x' + 'ab'.repeat(20),
    data: '0x095ea7b3' + '00'.repeat(64),
    value: '0x0',
    chainId: 195,
  })
  assert.equal(hash, 'signed-id')
})

test('sendTransaction surfaces TronLink sign rejection instead of txHash coerce error', async () => {
  const { tronWeb } = mockTronWeb()
  tronWeb.trx.sign = async () => ({ code: 'USER_CANCEL', message: 'Confirmation declined by user' })
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)
  await assert.rejects(
    () =>
      adapter.sendTransaction({
        to: '0x' + 'ab'.repeat(20),
        data: '0x095ea7b3' + '00'.repeat(64),
        value: '0x0',
        chainId: 195,
      }),
    /Confirmation declined by user/,
  )
})

test('sendTransaction signs a prebuilt Tron transaction object', async () => {
  const { tronWeb, calls } = mockTronWeb()
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)
  const hash = await adapter.sendTransaction({
    txID: 'prebuilt',
    raw_data: { contract: [] },
  })
  assert.equal(hash, 'signed-id')
  assert.ok(calls.some((c) => c.method === 'extendExpiration'))
})

test('sendTransaction extends unsigned expiration before sign', async () => {
  const { tronWeb, calls } = mockTronWeb()
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)
  await adapter.sendTransaction({
    to: '0x' + 'ab'.repeat(20),
    data: '0x095ea7b3' + '00'.repeat(64),
    value: '0x0',
    chainId: 195,
  })
  const extend = calls.find((c) => c.method === 'extendExpiration')
  assert.ok(extend)
  assert.equal(extend!.args[1], 9 * 60)
})

test('sendTransaction rebuilds once after Transaction expired', async () => {
  const { tronWeb, calls } = mockTronWeb()
  let signs = 0
  tronWeb.trx.sign = async () => {
    signs += 1
    if (signs === 1) {
      throw new Error('5472616e73616374696f6e2065787069726564')
    }
    return { txID: 'signed-id' }
  }
  const adapter = new TestAdapter(tronWeb)
  connected(adapter)
  const hash = await adapter.sendTransaction({
    to: '0x' + 'ab'.repeat(20),
    data: '0x095ea7b3' + '00'.repeat(64),
    value: '0x0',
    chainId: 195,
  })
  assert.equal(hash, 'signed-id')
  assert.equal(signs, 2)
  assert.equal(calls.filter((c) => c.method === 'triggerSmartContract').length, 2)
})
