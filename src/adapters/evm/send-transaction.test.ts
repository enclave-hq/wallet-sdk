import assert from 'node:assert/strict'
import test from 'node:test'
import { MetaMaskAdapter } from './metamask'
import { ChainType, WalletState } from '../../core/types'
import { createUniversalAddress } from '../../utils/address/universal-address'

test('sendTransaction uses eth_sendTransaction and returns hash', async () => {
  const calls: unknown[] = []
  const provider = {
    request: async (args: { method: string; params?: unknown[] }) => {
      calls.push(args)
      return '0xabc123'
    },
  }

  class TestAdapter extends MetaMaskAdapter {
    protected getBrowserProvider() {
      return provider
    }
  }

  const adapter = new TestAdapter()
  adapter.state = WalletState.CONNECTED
  adapter.currentAccount = {
    universalAddress: createUniversalAddress(60, '0x1234567890123456789012345678901234567890'),
    nativeAddress: '0x1234567890123456789012345678901234567890',
    chainId: 60,
    chainType: ChainType.EVM,
    isActive: true,
  }

  const hash = await adapter.sendTransaction({ to: '0x1', data: '0xdead' })
  assert.equal(hash, '0xabc123')
  assert.equal((calls[0] as { method: string }).method, 'eth_sendTransaction')

  const tx = ((calls[0] as { params: unknown[] }).params[0] as { chainId: string })
  assert.equal(tx.chainId, '0x1', 'SLIP-44 chainId 60 must normalize to EVM chainId 1 (0x1)')
})

test('sendTransaction normalizes explicit SLIP-44 chainId to EVM hex', async () => {
  const calls: unknown[] = []
  const provider = {
    request: async (args: { method: string; params?: unknown[] }) => {
      calls.push(args)
      return '0xdef456'
    },
  }

  class TestAdapter extends MetaMaskAdapter {
    protected getBrowserProvider() {
      return provider
    }
  }

  const adapter = new TestAdapter()
  adapter.state = WalletState.CONNECTED
  adapter.currentAccount = {
    universalAddress: createUniversalAddress(60, '0x1234567890123456789012345678901234567890'),
    nativeAddress: '0x1234567890123456789012345678901234567890',
    chainId: 60,
    chainType: ChainType.EVM,
    isActive: true,
  }

  await adapter.sendTransaction({ to: '0x1', chainId: 60 })
  const tx = ((calls[0] as { params: unknown[] }).params[0] as { chainId: string })
  assert.equal(tx.chainId, '0x1')
})

test('sendTransaction passes through explicit EVM chainId as hex', async () => {
  const calls: unknown[] = []
  const provider = {
    request: async (args: { method: string; params?: unknown[] }) => {
      calls.push(args)
      return '0x789abc'
    },
  }

  class TestAdapter extends MetaMaskAdapter {
    protected getBrowserProvider() {
      return provider
    }
  }

  const adapter = new TestAdapter()
  adapter.state = WalletState.CONNECTED
  adapter.currentAccount = {
    universalAddress: createUniversalAddress(714, '0x1234567890123456789012345678901234567890'),
    nativeAddress: '0x1234567890123456789012345678901234567890',
    chainId: 714,
    chainType: ChainType.EVM,
    isActive: true,
  }

  await adapter.sendTransaction({ to: '0x1', chainId: 56 })
  const tx = ((calls[0] as { params: unknown[] }).params[0] as { chainId: string })
  assert.equal(tx.chainId, '0x38')
})
