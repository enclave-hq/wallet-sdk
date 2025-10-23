/**
 * 支持的钱包列表
 */

import { ChainType, WalletType } from '../core/types'

/**
 * 钱包元数据
 */
export interface WalletMetadata {
  type: WalletType
  name: string
  chainType: ChainType
  icon?: string
  downloadUrl?: string
  description?: string
}

/**
 * 支持的钱包列表
 */
export const SUPPORTED_WALLETS: Record<WalletType, WalletMetadata> = {
  [WalletType.METAMASK]: {
    type: WalletType.METAMASK,
    name: 'MetaMask',
    chainType: ChainType.EVM,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
    downloadUrl: 'https://metamask.io/download/',
    description: 'The most popular Ethereum wallet',
  },

  [WalletType.WALLETCONNECT]: {
    type: WalletType.WALLETCONNECT,
    name: 'WalletConnect',
    chainType: ChainType.EVM,
    icon: 'https://avatars.githubusercontent.com/u/37784886',
    downloadUrl: 'https://walletconnect.com/',
    description: 'Connect to 170+ wallets',
  },

  [WalletType.COINBASE_WALLET]: {
    type: WalletType.COINBASE_WALLET,
    name: 'Coinbase Wallet',
    chainType: ChainType.EVM,
    icon: 'https://www.coinbase.com/img/favicon/favicon-96x96.png',
    downloadUrl: 'https://www.coinbase.com/wallet',
    description: 'Coinbase self-custody wallet',
  },

  [WalletType.TRONLINK]: {
    type: WalletType.TRONLINK,
    name: 'TronLink',
    chainType: ChainType.TRON,
    icon: 'https://www.tronlink.org/static/logoIcon.svg',
    downloadUrl: 'https://www.tronlink.org/',
    description: 'The official Tron wallet',
  },

  [WalletType.WALLETCONNECT_TRON]: {
    type: WalletType.WALLETCONNECT_TRON,
    name: 'WalletConnect (Tron)',
    chainType: ChainType.TRON,
    downloadUrl: 'https://walletconnect.com/',
    description: 'WalletConnect for Tron',
  },

  [WalletType.PRIVATE_KEY]: {
    type: WalletType.PRIVATE_KEY,
    name: 'Private Key',
    chainType: ChainType.EVM, // 可以用于任何链
    description: 'Import wallet using private key (for development)',
  },
}

/**
 * 根据类型获取钱包元数据
 */
export function getWalletMetadata(type: WalletType): WalletMetadata | undefined {
  return SUPPORTED_WALLETS[type]
}

/**
 * 获取所有 EVM 钱包
 */
export function getEVMWallets(): WalletMetadata[] {
  return Object.values(SUPPORTED_WALLETS).filter(
    wallet => wallet.chainType === ChainType.EVM
  )
}

/**
 * 获取所有 Tron 钱包
 */
export function getTronWallets(): WalletMetadata[] {
  return Object.values(SUPPORTED_WALLETS).filter(
    wallet => wallet.chainType === ChainType.TRON
  )
}

