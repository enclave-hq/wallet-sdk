/**
 * 适配器注册表
 */

import { IWalletAdapter, WalletType, ChainType } from './types'
import { MetaMaskAdapter } from '../adapters/evm/metamask'
import { TronLinkAdapter } from '../adapters/tron/tronlink'
import { EVMPrivateKeyAdapter } from '../adapters/evm/private-key'

/**
 * 适配器注册表
 */
export class AdapterRegistry {
  private adapters: Map<WalletType, () => IWalletAdapter> = new Map()

  constructor() {
    this.registerDefaultAdapters()
  }

  /**
   * 注册默认适配器
   */
  private registerDefaultAdapters(): void {
    // EVM 适配器
    this.register(WalletType.METAMASK, () => new MetaMaskAdapter())
    this.register(WalletType.PRIVATE_KEY, () => new EVMPrivateKeyAdapter())

    // Tron 适配器
    this.register(WalletType.TRONLINK, () => new TronLinkAdapter())
  }

  /**
   * 注册适配器
   */
  register(type: WalletType, factory: () => IWalletAdapter): void {
    this.adapters.set(type, factory)
  }

  /**
   * 获取适配器
   */
  getAdapter(type: WalletType): IWalletAdapter | null {
    const factory = this.adapters.get(type)
    if (!factory) {
      return null
    }
    return factory()
  }

  /**
   * 判断适配器是否已注册
   */
  has(type: WalletType): boolean {
    return this.adapters.has(type)
  }

  /**
   * 获取所有已注册的适配器类型
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


