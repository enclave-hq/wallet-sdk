/**
 * Wallet Detector
 */

import { WalletType, ChainType, WalletAvailability } from '../core/types'
import { SUPPORTED_WALLETS } from './supported-wallets'

/**
 * Wallet Detector
 */
export class WalletDetector {
  /**
   * Detect all wallet availability
   */
  async detectAllWallets(): Promise<WalletAvailability[]> {
    const walletTypes = Object.values(WalletType).filter(
      type => type !== WalletType.PRIVATE_KEY // Private key wallet does not need detection
    )

    const results = await Promise.all(
      walletTypes.map(type => this.detectWallet(type))
    )

    return results
  }

  /**
   * Detect specific wallet
   */
  async detectWallet(walletType: WalletType): Promise<WalletAvailability> {
    const metadata = SUPPORTED_WALLETS[walletType]
    
    if (!metadata) {
      return {
        walletType,
        chainType: ChainType.EVM, // Default
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
   * Determine if wallet is available
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
        // WalletConnect does not need installation, always available
        return true

      case WalletType.PRIVATE_KEY:
        // Private key wallet is always available
        return true

      default:
        return false
    }
  }

  /**
   * 检测 MetaMask（现在支持所有 window.ethereum 钱包）
   */
  private isMetaMaskAvailable(): boolean {
    const w = window as any
    // 支持所有提供 window.ethereum 接口的钱包
    return !!w.ethereum
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


