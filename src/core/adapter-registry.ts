/**
 * Adapter Registry
 */

import { IWalletAdapter, WalletType, ChainType } from './types'
import { MetaMaskAdapter } from '../adapters/evm/metamask'
import { TronLinkAdapter } from '../adapters/tron/tronlink'
import { EVMPrivateKeyAdapter } from '../adapters/evm/private-key'

/**
 * Adapter Registry
 */
export class AdapterRegistry {
  private adapters: Map<WalletType, () => IWalletAdapter> = new Map()

  constructor() {
    this.registerDefaultAdapters()
  }

  /**
   * Register default adapters
   */
  private registerDefaultAdapters(): void {
    // EVM adapters
    this.register(WalletType.METAMASK, () => new MetaMaskAdapter())
    this.register(WalletType.PRIVATE_KEY, () => new EVMPrivateKeyAdapter())

    // Tron adapters
    this.register(WalletType.TRONLINK, () => new TronLinkAdapter())
  }

  /**
   * Register adapter
   */
  register(type: WalletType, factory: () => IWalletAdapter): void {
    this.adapters.set(type, factory)
  }

  /**
   * Get adapter
   */
  getAdapter(type: WalletType): IWalletAdapter | null {
    const factory = this.adapters.get(type)
    if (!factory) {
      return null
    }
    return factory()
  }

  /**
   * Check if adapter is registered
   */
  has(type: WalletType): boolean {
    return this.adapters.has(type)
  }

  /**
   * Get all registered adapter types
   */
  getRegisteredTypes(): WalletType[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * 根据链类型获取适配器类型列表
   */
  getAdapterTypesByChainType(chainType: ChainType): WalletType[] {
    const types: WalletType[] = []

    for (const type of this.adapters.keys()) {
      const adapter = this.getAdapter(type)
      if (adapter && adapter.chainType === chainType) {
        types.push(type)
      }
    }

    return types
  }
}


