/**
 * TronLink 适配器
 */

import { BrowserWalletAdapter } from '../base/browser-wallet-adapter'
import {
  WalletType,
  ChainType,
  WalletState,
  Account,
} from '../../core/types'
import { createUniversalAddress } from '../../utils/address/universal-address'
import { ConnectionRejectedError, SignatureRejectedError } from '../../core/errors'

/**
 * TronLink 适配器
 */
export class TronLinkAdapter extends BrowserWalletAdapter {
  readonly type = WalletType.TRONLINK
  readonly chainType = ChainType.TRON
  readonly name = 'TronLink'
  readonly icon = 'https://www.tronlink.org/static/logoIcon.svg'

  // Tron 主网链 ID
  private static readonly TRON_MAINNET_CHAIN_ID = 195

  /**
   * 连接钱包
   */
  async connect(chainId?: number): Promise<Account> {
    await this.ensureAvailable()

    try {
      this.setState(WalletState.CONNECTING)

      const tronWeb = this.getTronWeb()

      // 请求连接
      const result = await tronWeb.request({
        method: 'tron_requestAccounts',
      })

      if (!result || !result.code || result.code !== 200) {
        throw new ConnectionRejectedError(this.type)
      }

      // 获取当前地址
      const address = tronWeb.defaultAddress?.base58
      if (!address) {
        throw new Error('Failed to get Tron address')
      }

      // Tron 主网的链 ID
      const tronChainId = chainId || TronLinkAdapter.TRON_MAINNET_CHAIN_ID

      // 创建账户信息
      const account: Account = {
        universalAddress: createUniversalAddress(tronChainId, address),
        nativeAddress: address,
        chainId: tronChainId,
        chainType: ChainType.TRON,
        isActive: true,
      }

      this.setState(WalletState.CONNECTED)
      this.setAccount(account)
      this.setupEventListeners()

      return account
    } catch (error: any) {
      this.setState(WalletState.ERROR)
      this.setAccount(null)

      if (error.code === 4001 || error.message?.includes('User rejected')) {
        throw new ConnectionRejectedError(this.type)
      }

      throw error
    }
  }

  /**
   * 签名消息
   * 
   * Note: TronLink supports two signing methods:
   * - trx.sign(): Signs a transaction object
   * - trx.signMessageV2(): Signs a plain text message (what we use here)
   */
  async signMessage(message: string): Promise<string> {
    this.ensureConnected()

    try {
      const tronWeb = this.getTronWeb()

      // Use signMessageV2 for plain text message signing (not transaction signing)
      // This is equivalent to personal_sign in EVM
      if (typeof tronWeb.trx.signMessageV2 === 'function') {
        // signMessageV2 returns a hex signature
        const signature = await tronWeb.trx.signMessageV2(message)
        return signature
      } else {
        // Fallback to older method if signMessageV2 not available
        // Note: This might not work correctly for message signing
        console.warn('[TronLink] signMessageV2 not available, falling back to sign()')
        const signature = await tronWeb.trx.sign(message)
        return signature
      }
    } catch (error: any) {
      if (error.message?.includes('User rejected') || error.message?.includes('Confirmation declined')) {
        throw new SignatureRejectedError()
      }
      
      // Better error message for invalid input
      if (error.message?.includes('Invalid transaction')) {
        throw new Error('Invalid message format. For transaction signing, use signTransaction() instead.')
      }
      
      throw error
    }
  }

  /**
   * 签名交易
   * 
   * Note: This uses trx.sign() which is specifically for signing transaction objects.
   * For plain text message signing, use signMessage() instead.
   */
  async signTransaction(transaction: any): Promise<string> {
    this.ensureConnected()

    try {
      const tronWeb = this.getTronWeb()

      // TronLink's trx.sign() expects a transaction object
      // The transaction should be properly formatted with fields like:
      // - txID, raw_data, raw_data_hex, etc.
      const signature = await tronWeb.trx.sign(transaction)

      return signature
    } catch (error: any) {
      if (error.message?.includes('User rejected') || error.message?.includes('Confirmation declined')) {
        throw new SignatureRejectedError('Transaction signature was rejected by user')
      }
      
      // Better error message for invalid input
      if (error.message?.includes('Invalid transaction')) {
        throw new Error('Invalid transaction format. Please provide a properly formatted Tron transaction object.')
      }
      
      throw error
    }
  }

  /**
   * 获取 Provider
   */
  getProvider(): any {
    return this.getTronWeb()
  }

  /**
   * 获取浏览器中的 TronWeb
   */
  protected getBrowserProvider(): any | undefined {
    if (typeof window === 'undefined') {
      return undefined
    }
    const w = window as any
    return w.tronWeb || w.tronLink?.tronWeb
  }

  /**
   * 获取 TronWeb 实例
   */
  private getTronWeb(): any {
    const provider = this.getBrowserProvider()
    if (!provider) {
      throw new Error('TronWeb not found')
    }
    return provider
  }

  /**
   * 获取下载链接
   */
  protected getDownloadUrl(): string {
    return 'https://www.tronlink.org/'
  }

  /**
   * 设置事件监听
   */
  protected setupEventListeners(): void {
    // TronLink 事件监听
    if (typeof window === 'undefined') return

    const w = window as any
    
    // TronLink 的事件监听方式可能因版本而异
    // 某些版本使用 tronLink.on，某些版本使用 addEventListener
    try {
      if (w.tronLink && typeof w.tronLink.on === 'function') {
        w.tronLink.on('accountsChanged', this.handleAccountsChanged)
        w.tronLink.on('disconnect', this.handleDisconnect)
      } else if (w.tronWeb && w.tronWeb.eventServer) {
        // 备用方案：使用轮询检测账户变化
        this.startPolling()
      }
    } catch (error) {
      console.warn('TronLink event listener setup failed:', error)
      // 降级到轮询
      this.startPolling()
    }
  }

  /**
   * 移除事件监听
   */
  protected removeEventListeners(): void {
    if (typeof window === 'undefined') return

    const w = window as any

    try {
      if (w.tronLink && typeof w.tronLink.off === 'function') {
        w.tronLink.off('accountsChanged', this.handleAccountsChanged)
        w.tronLink.off('disconnect', this.handleDisconnect)
      }
    } catch (error) {
      console.warn('TronLink event listener removal failed:', error)
    }

    this.stopPolling()
  }

  /**
   * 轮询检测账户变化（备用方案）
   */
  private pollingInterval: NodeJS.Timeout | null = null
  private lastKnownAddress: string | null = null

  private startPolling(): void {
    if (this.pollingInterval) return

    this.lastKnownAddress = this.currentAccount?.nativeAddress || null

    this.pollingInterval = setInterval(async () => {
      try {
        const tronWeb = this.getTronWeb()
        const currentAddress = tronWeb.defaultAddress?.base58

        if (currentAddress && currentAddress !== this.lastKnownAddress) {
          this.lastKnownAddress = currentAddress
          this.handleAccountsChanged({ address: { base58: currentAddress } })
        } else if (!currentAddress && this.lastKnownAddress) {
          this.lastKnownAddress = null
          this.handleAccountsChanged(null)
        }
      } catch (error) {
        // 忽略轮询错误
      }
    }, 2000) // 每 2 秒检查一次
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * 处理账户变化
   */
  private handleAccountsChanged = (data: any) => {
    if (!data || !data.address) {
      // 用户断开连接
      this.setState(WalletState.DISCONNECTED)
      this.setAccount(null)
      this.emitAccountChanged(null)
    } else {
      // 用户切换账户
      const address = data.address.base58 || data.address
      const account: Account = {
        universalAddress: createUniversalAddress(this.currentAccount!.chainId, address),
        nativeAddress: address,
        chainId: this.currentAccount!.chainId,
        chainType: ChainType.TRON,
        isActive: true,
      }
      this.setAccount(account)
      this.emitAccountChanged(account)
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect = () => {
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
    this.emitDisconnected()
  }
}

