/**
 * Deep Link Adapter
 * 
 * 通用深度链接适配器，与 WalletConnect 同级
 * 支持多链（EVM、TRON等）
 * 使用提供者模式，支持不同的钱包（TokenPocket、ImToken、TronLink等）
 */

import { WalletAdapter } from '../base/wallet-adapter'
import {
  WalletType,
  ChainType,
  WalletState,
  Account,
} from '../../core/types'
import { 
  ConnectionRejectedError, 
  SignatureRejectedError,
  WalletNotConnectedError,
} from '../../core/errors'
import { createUniversalAddress } from '../../utils/address/universal-address'
import type { IDeepLinkProvider } from './providers/base'

/**
 * Deep Link Provider Type
 * 支持的深度链接提供者类型
 */
export enum DeepLinkProviderType {
  TOKENPOCKET = 'tokenpocket',
  TRONLINK = 'tronlink',
  IMTOKEN = 'imtoken',
  METAMASK = 'metamask',
  OKX = 'okx',
}

/**
 * Deep Link Adapter Configuration
 */
export interface DeepLinkAdapterConfig {
  providerType: DeepLinkProviderType
  callbackUrl?: string
  callbackSchema?: string
}

/**
 * Deep Link Adapter
 * 
 * 通用的深度链接适配器，支持多链和多个钱包提供者
 */
export class DeepLinkAdapter extends WalletAdapter {
  readonly type: WalletType
  readonly chainType: ChainType
  readonly name: string
  readonly icon: string

  private provider: IDeepLinkProvider
  private currentChainId: number | null = null
  private currentChainType: ChainType | null = null

  // Static map to store pending actions across all instances
  // Key: actionId, Value: { resolve, reject }
  private static pendingActions: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map()

  constructor(config: DeepLinkAdapterConfig) {
    super()

    // Create provider instance based on type
    this.provider = this.createProvider(config)

    // Set adapter metadata based on provider
    this.name = `${this.provider.name} (Deep Link)`
    this.icon = this.provider.icon

    // Determine chain type from provider's supported chains
    // For now, we'll use the first supported chain type
    // In the future, this could be determined during connect()
    if (this.provider.supportedChainTypes.includes(ChainType.EVM)) {
      this.chainType = ChainType.EVM
      this.type = WalletType.DEEP_LINK_EVM
    } else if (this.provider.supportedChainTypes.includes(ChainType.TRON)) {
      this.chainType = ChainType.TRON
      this.type = WalletType.DEEP_LINK_TRON
    } else {
      // Default to EVM if unknown
      this.chainType = ChainType.EVM
      this.type = WalletType.DEEP_LINK_EVM
    }

    // Setup callback handler
    if (typeof window !== 'undefined') {
      this.setupCallbackHandler()
    }
  }

  /**
   * Create provider instance based on type
   */
  private createProvider(config: DeepLinkAdapterConfig): IDeepLinkProvider {
    switch (config.providerType) {
      case DeepLinkProviderType.TOKENPOCKET: {
        const { TokenPocketDeepLinkProvider } = require('./providers/tokenpocket')
        return new TokenPocketDeepLinkProvider({
          callbackUrl: config.callbackUrl,
          callbackSchema: config.callbackSchema,
        })
      }
      case DeepLinkProviderType.TRONLINK: {
        const { TronLinkDeepLinkProvider } = require('./providers/tronlink')
        return new TronLinkDeepLinkProvider()
      }
      case DeepLinkProviderType.IMTOKEN: {
        const { ImTokenDeepLinkProvider } = require('./providers/imtoken')
        return new ImTokenDeepLinkProvider({
          callbackUrl: config.callbackUrl,
          callbackSchema: config.callbackSchema,
        })
      }
      case DeepLinkProviderType.METAMASK: {
        const { MetaMaskDeepLinkProvider } = require('./providers/metamask')
        return new MetaMaskDeepLinkProvider()
      }
      case DeepLinkProviderType.OKX: {
        const { OKXDeepLinkProvider } = require('./providers/okx')
        return new OKXDeepLinkProvider()
      }
      default:
        throw new Error(`Unsupported deep link provider type: ${config.providerType}`)
    }
  }

  /**
   * Setup callback handler for deep link results
   */
  private setupCallbackHandler(): void {
    if (typeof window === 'undefined') {
      return
    }

    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const result = this.provider.parseCallbackResult(urlParams)
      
      if (result.actionId && DeepLinkAdapter.pendingActions.has(result.actionId)) {
        const callback = DeepLinkAdapter.pendingActions.get(result.actionId)!
        
        if (result.error) {
          callback.reject(new Error(result.error))
        } else if (result.result) {
          callback.resolve(result.result)
        }
        
        DeepLinkAdapter.pendingActions.delete(result.actionId)
      }
    }

    // Listen for URL changes
    window.addEventListener('popstate', handleUrlChange)
    window.addEventListener('hashchange', handleUrlChange)
    
    // Check on initial load
    handleUrlChange()
  }

  /**
   * Check if deep link is available
   */
  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable()
  }

  /**
   * Connect to wallet via deep link
   * 
   * Note: Deep links typically don't support persistent connections
   * This method may throw ConnectionRejectedError as deep links are
   * primarily used for signing operations, not connection
   */
  async connect(chainId?: number | number[]): Promise<Account> {
    // Extract first chain ID if array is provided
    const targetChainId = Array.isArray(chainId) ? chainId[0] : (chainId || 1)
    
    // Determine chain type from chain ID
    // For now, we'll use a simple heuristic:
    // - Chain ID 195 = TRON Mainnet
    // - Other chain IDs = EVM chains
    let chainType: ChainType
    if (targetChainId === 195) {
      chainType = ChainType.TRON
    } else {
      chainType = ChainType.EVM
    }

    // Check if provider supports this chain type
    if (!this.provider.supportedChainTypes.includes(chainType)) {
      throw new Error(
        `Provider ${this.provider.name} does not support chain type ${chainType}`
      )
    }

    // Deep links typically don't support connection
    // They're used for signing operations
    // If the provider supports connect, we can try it
    if (this.provider.buildConnectLink) {
      const linkInfo = this.provider.buildConnectLink({
        chainId: targetChainId,
        chainType: chainType,
      })

      if (linkInfo.actionId) {
        // If there's a callback mechanism, wait for it
        return new Promise<Account>((resolve, reject) => {
          DeepLinkAdapter.pendingActions.set(linkInfo.actionId!, {
            resolve: (result: any) => {
              // Extract address from result
              // The result format depends on the provider
              // For now, we'll assume the result contains an address
              const address = result?.address || result?.account || result
              if (!address || typeof address !== 'string') {
                reject(new ConnectionRejectedError('Invalid connection result: no address found'))
                return
              }

              const account: Account = {
                universalAddress: createUniversalAddress(targetChainId, address),
                nativeAddress: address,
                chainId: targetChainId,
                chainType: chainType,
                isActive: true,
              }

              this.setState(WalletState.CONNECTED)
              this.setAccount(account)
              this.emit('connected', account)
              resolve(account)
            },
            reject: (error: any) => {
              this.setState(WalletState.DISCONNECTED)
              reject(error)
            },
          })
          window.location.href = linkInfo.url
          
          setTimeout(() => {
            if (DeepLinkAdapter.pendingActions.has(linkInfo.actionId!)) {
              DeepLinkAdapter.pendingActions.delete(linkInfo.actionId!)
              this.setState(WalletState.DISCONNECTED)
              reject(new ConnectionRejectedError('Deep link connection timeout'))
            }
          }, 30000)
        })
      } else {
        // No callback, just open the link
        window.location.href = linkInfo.url
        throw new ConnectionRejectedError(
          'Deep link connection initiated. Please complete the connection in your wallet app.'
        )
      }
    } else {
      // Provider doesn't support connection
      throw new ConnectionRejectedError(
        `Deep link connection is not supported by ${this.provider.name}. ` +
        'Deep links are primarily used for signing operations.'
      )
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
    this.currentChainId = null
    this.currentChainType = null
    this.emitDisconnected()
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    this.ensureConnected()

    if (!this.currentChainId || !this.currentChainType) {
      throw new WalletNotConnectedError(this.type)
    }

    const linkInfo = this.provider.buildSignMessageLink({
      message,
      chainId: this.currentChainId,
      chainType: this.currentChainType,
    })

    // If there's a callback mechanism, wait for the result
    if (linkInfo.callbackSchema || linkInfo.callbackUrl) {
      return new Promise<string>((resolve, reject) => {
        DeepLinkAdapter.pendingActions.set(linkInfo.actionId, { resolve, reject })
        window.location.href = linkInfo.url

        setTimeout(() => {
          if (DeepLinkAdapter.pendingActions.has(linkInfo.actionId)) {
            DeepLinkAdapter.pendingActions.delete(linkInfo.actionId)
            reject(new SignatureRejectedError('Message signature timeout'))
          }
        }, 30000)
      })
    } else {
      // No callback mechanism, just open the link
      window.location.href = linkInfo.url
      throw new SignatureRejectedError(
        'Deep link signature initiated. Please complete the signature in your wallet app.'
      )
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(transaction: any): Promise<string> {
    this.ensureConnected()

    if (!this.currentChainId || !this.currentChainType) {
      throw new WalletNotConnectedError(this.type)
    }

    const linkInfo = this.provider.buildSignTransactionLink({
      transaction,
      chainId: this.currentChainId,
      chainType: this.currentChainType,
    })

    // If there's a callback mechanism, wait for the result
    if (linkInfo.callbackSchema || linkInfo.callbackUrl) {
      return new Promise<string>((resolve, reject) => {
        DeepLinkAdapter.pendingActions.set(linkInfo.actionId, { resolve, reject })
        window.location.href = linkInfo.url

        setTimeout(() => {
          if (DeepLinkAdapter.pendingActions.has(linkInfo.actionId)) {
            DeepLinkAdapter.pendingActions.delete(linkInfo.actionId)
            reject(new SignatureRejectedError('Transaction signature timeout'))
          }
        }, 30000)
      })
    } else {
      // No callback mechanism, just open the link
      window.location.href = linkInfo.url
      throw new SignatureRejectedError(
        'Deep link transaction signature initiated. Please complete the signature in your wallet app.'
      )
    }
  }

  /**
   * Get provider (not applicable for deep links)
   */
  getProvider(): any {
    // Deep links don't provide a direct provider object
    return null
  }

  /**
   * Static method to handle callback from wallet apps
   * This can be called from anywhere in the application
   */
  static handleCallback(): void {
    if (typeof window === 'undefined') {
      return
    }

    const urlParams = new URLSearchParams(window.location.search)
    // We need to know which provider to use, but we can't determine that from the URL alone
    // This method should be called with a specific provider instance
    // For now, we'll iterate through all pending actions
    const actionId = urlParams.get('actionId')
    if (actionId && DeepLinkAdapter.pendingActions.has(actionId)) {
      const callback = DeepLinkAdapter.pendingActions.get(actionId)!
      const result = urlParams.get('result')
      const error = urlParams.get('error')

      if (error) {
        callback.reject(new Error(error))
      } else if (result) {
        try {
          const parsedResult = JSON.parse(decodeURIComponent(result))
          callback.resolve(parsedResult)
        } catch (e) {
          callback.resolve(result)
        }
      }

      DeepLinkAdapter.pendingActions.delete(actionId)
    }
  }

  /**
   * Set current account (called after successful connection)
   */
  protected setAccount(account: Account | null): void {
    this.currentAccount = account
    if (account) {
      this.currentChainId = account.chainId
      this.currentChainType = account.chainType
    }
  }

  /**
   * Emit disconnected event
   */
  protected emitDisconnected(): void {
    this.emit('disconnected')
  }
}

