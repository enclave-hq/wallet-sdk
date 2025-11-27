/**
 * Adapter Registry
 */

import { IWalletAdapter, WalletType, ChainType, WalletManagerConfig } from './types'
import { MetaMaskAdapter } from '../adapters/evm/metamask'
import { TronLinkAdapter } from '../adapters/tron/tronlink'
import { EVMPrivateKeyAdapter } from '../adapters/evm/private-key'
import { WalletConnectAdapter } from '../adapters/evm/wallet-connect'
import { WalletConnectTronAdapter } from '../adapters/tron/wallet-connect'

/**
 * Adapter Registry
 */
export class AdapterRegistry {
  private adapters: Map<WalletType, () => IWalletAdapter> = new Map()
  private config: WalletManagerConfig

  constructor(config: WalletManagerConfig = {}) {
    this.config = config
    this.registerDefaultAdapters()
  }

  /**
   * Register default adapters
   */
  private registerDefaultAdapters(): void {
    // EVM adapters
    this.register(WalletType.METAMASK, () => new MetaMaskAdapter())
    this.register(WalletType.PRIVATE_KEY, () => new EVMPrivateKeyAdapter())
    
    // Wallet Connect adapter (only register if projectId is provided)
    if (this.config.walletConnectProjectId) {
      this.register(WalletType.WALLETCONNECT, () => 
        new WalletConnectAdapter(this.config.walletConnectProjectId!)
      )
      // Wallet Connect Tron adapter
      this.register(WalletType.WALLETCONNECT_TRON, () => 
        new WalletConnectTronAdapter(this.config.walletConnectProjectId!)
      )
    }

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


