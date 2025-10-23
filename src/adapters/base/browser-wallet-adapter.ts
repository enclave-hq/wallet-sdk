/**
 * 浏览器钱包适配器基类
 * 用于 MetaMask、TronLink 等浏览器插件钱包
 */

import { WalletAdapter } from './wallet-adapter'
import { WalletState } from '../../core/types'
import { WalletNotAvailableError } from '../../core/errors'

/**
 * 浏览器钱包适配器基类
 */
export abstract class BrowserWalletAdapter extends WalletAdapter {
  /**
   * 获取浏览器中的钱包 provider
   */
  protected abstract getBrowserProvider(): any | undefined

  /**
   * 检查钱包是否可用
   */
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false
    }
    return this.getBrowserProvider() !== undefined
  }

  /**
   * 确保钱包已安装
   */
  protected async ensureAvailable(): Promise<void> {
    const isAvailable = await this.isAvailable()
    if (!isAvailable) {
      throw new WalletNotAvailableError(
        this.type,
        this.getDownloadUrl()
      )
    }
  }

  /**
   * 获取下载链接
   */
  protected abstract getDownloadUrl(): string

  /**
   * 设置事件监听
   */
  protected abstract setupEventListeners(): void

  /**
   * 移除事件监听
   */
  protected abstract removeEventListeners(): void

  /**
   * 断开连接时清理
   */
  async disconnect(): Promise<void> {
    this.removeEventListeners()
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
    this.emitDisconnected()
  }
}

