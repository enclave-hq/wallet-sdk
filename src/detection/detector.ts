/**
 * 钱包检测器
 */

import { WalletType, ChainType, WalletAvailability } from '../core/types'
import { SUPPORTED_WALLETS } from './supported-wallets'

/**
 * 钱包检测器
 */
export class WalletDetector {
  /**
   * 检测所有钱包可用性
   */
  async detectAllWallets(): Promise<WalletAvailability[]> {
    const walletTypes = Object.values(WalletType).filter(
      type => type !== WalletType.PRIVATE_KEY // 私钥钱包不需要检测
    )

    const results = await Promise.all(
      walletTypes.map(type => this.detectWallet(type))
    )

    return results
  }

  /**
   * 检测特定钱包
   */
  async detectWallet(walletType: WalletType): Promise<WalletAvailability> {
    const metadata = SUPPORTED_WALLETS[walletType]
    
    if (!metadata) {
      return {
        walletType,
        chainType: ChainType.EVM, // 默认
        isAvailable: false,
        detected: false,
      }
    }

    const isAvailable = await this.isWalletAvailable(walletType)

    return {
      walletType,
      chainType: metadata.chainType,
      isAvailable,
      downloadUrl: metadata.downloadUrl,
      detected: isAvailable,
    }
  }

  /**
   * 判断钱包是否可用
   */
  private async isWalletAvailable(walletType: WalletType): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false
    }

    switch (walletType) {
      case WalletType.METAMASK:
        return this.isMetaMaskAvailable()

      case WalletType.TRONLINK:
        return this.isTronLinkAvailable()

      case WalletType.COINBASE_WALLET:
        return this.isCoinbaseWalletAvailable()

      case WalletType.WALLETCONNECT:
      case WalletType.WALLETCONNECT_TRON:
        // WalletConnect 不需要安装，总是可用
        return true

      case WalletType.PRIVATE_KEY:
        // 私钥钱包总是可用
        return true

      default:
        return false
    }
  }

  /**
   * 检测 MetaMask
   */
  private isMetaMaskAvailable(): boolean {
    const w = window as any
    return !!(w.ethereum && w.ethereum.isMetaMask)
  }

  /**
   * 检测 TronLink
   */
  private isTronLinkAvailable(): boolean {
    const w = window as any
    return !!(w.tronLink || w.tronWeb)
  }

  /**
   * 检测 Coinbase Wallet
   */
  private isCoinbaseWalletAvailable(): boolean {
    const w = window as any
    return !!(w.ethereum && w.ethereum.isCoinbaseWallet)
  }

  /**
   * 等待钱包加载（有些钱包可能延迟注入）
   */
  async waitForWallet(
    walletType: WalletType,
    timeout: number = 3000
  ): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (await this.isWalletAvailable(walletType)) {
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return false
  }
}

