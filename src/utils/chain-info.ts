/**
 * Chain information constants
 *
 * EVM Chain ID: wallet / RPC / MetaMask `eth_chainId` (e.g. Arbitrum One = 42161).
 * SLIP-44 ID: Enclave 系统链标识；L2 等无官方 SLIP-44 的链使用 1000000 + EVM Chain ID
 *（与 @enclave-hq/chain-utils 一致，例如 Arbitrum = 1042161）。
 */

import { 
  ChainType,
  nativeToSlip44,
  slip44ToNative,
  ChainInfo as ChainUtilsChainInfo
} from '@enclave-hq/chain-utils'

/** Custom SLIP-44 for EVM chains without an official SLIP-44 coin type */
export function slip44FromEvmChainId(evmChainId: number): number {
  return 1_000_000 + evmChainId
}

/** EVM Chain ID from custom SLIP-44 (1000000 + evm) */
export function evmChainIdFromCustomSlip44(slip44: number): number | null {
  if (slip44 >= 1_000_000 && slip44 < 2_000_000) {
    return slip44 - 1_000_000
  }
  return null
}

/** Well-known EVM native chain IDs */
export const EVM_CHAIN_ID = {
  ETHEREUM: 1,
  BSC: 56,
  BSC_TESTNET: 97,
  POLYGON: 137,
  POLYGON_AMOY: 80002,
  TRON: 195,
  ARBITRUM_ONE: 42161,
  ARBITRUM_SEPOLIA: 421614,
  OPTIMISM: 10,
  BASE: 8453,
  AVALANCHE_C: 43114,
  SEPOLIA: 11155111,
} as const

/** Well-known SLIP-44 chain IDs (Enclave / chain-utils) */
export const SLIP44_CHAIN_ID = {
  ETHEREUM: 60,
  BSC: 714,
  POLYGON: 966,
  TRON: 195,
  ARBITRUM_ONE: 1042161,
  ARBITRUM_SEPOLIA: 10421614,
  OPTIMISM: 1000010,
  BASE: 1008453,
  AVALANCHE_C: 9000,
} as const

/**
 * Extended chain information interface (adds RPC and explorer URLs)
 */
export interface ChainInfo extends Omit<ChainUtilsChainInfo, 'nativeChainId' | 'slip44'> {
  id: number  // Native chain ID
  slip44?: number  // SLIP-44 ID (optional)
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls?: string[]
  iconUrls?: string[]
}

/**
 * Predefined chain information
 */
export const CHAIN_INFO: Record<number, ChainInfo> = {
  // EVM Mainnet
  1: {
    id: 1,
    slip44: 60,  // Ethereum SLIP-44
    name: 'Ethereum Mainnet',
    chainType: ChainType.EVM,
    symbol: 'ETH',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    // 使用支持浏览器 CORS 的公共 RPC，避免 dapp 域名被跨域拦截（如 eth.llamarpc.com 无 CORS 头）
    rpcUrls: [
      'https://cloudflare-eth.com',
      'https://rpc.ankr.com/eth',
      'https://eth.llamarpc.com',
    ],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  
  // EVM Testnets
  11155111: {
    id: 11155111,
    name: 'Sepolia Testnet',
    chainType: ChainType.EVM,
    symbol: 'ETH',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  
  // Binance Smart Chain
  56: {
    id: 56,
    slip44: 714,  // BSC SLIP-44
    name: 'BNB Smart Chain',
    chainType: ChainType.EVM,
    symbol: 'BNB',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  
  97: {
    id: 97,
    name: 'BNB Smart Chain Testnet',
    chainType: ChainType.EVM,
    symbol: 'BNB',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: [
      'https://data-seed-prebsc-2-s1.binance.org:8545',
      'https://data-seed-prebsc-1-s2.binance.org:8545',
      'https://data-seed-prebsc-2-s2.binance.org:8545',
      'https://data-seed-prebsc-1-s3.binance.org:8545',
      'https://data-seed-prebsc-2-s3.binance.org:8545',
      'https://data-seed-prebsc-1-s1.binance.org:8545' // Original main node as last fallback
    ],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  },
  
  // Polygon
  137: {
    id: 137,
    slip44: 966,  // Polygon SLIP-44
    name: 'Polygon Mainnet',
    chainType: ChainType.EVM,
    symbol: 'MATIC',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  
  80002: {
    id: 80002,
    name: 'Polygon Amoy Testnet',
    chainType: ChainType.EVM,
    symbol: 'MATIC',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://www.oklink.com/amoy'],
  },
  
  // Tron
  195: {
    id: 195,
    slip44: 195,  // Tron SLIP-44
    name: 'Tron Mainnet',
    chainType: ChainType.TRON,
    symbol: 'TRX',
    nativeCurrency: {
      name: 'TRX',
      symbol: 'TRX',
      decimals: 6,
    },
    rpcUrls: ['https://api.trongrid.io'],
    blockExplorerUrls: ['https://tronscan.org'],
  },
  
  // Arbitrum
  42161: {
    id: 42161,
    slip44: SLIP44_CHAIN_ID.ARBITRUM_ONE,
    name: 'Arbitrum One',
    chainType: ChainType.EVM,
    symbol: 'ETH',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
    ],
    blockExplorerUrls: ['https://arbiscan.io'],
  },

  421614: {
    id: 421614,
    slip44: SLIP44_CHAIN_ID.ARBITRUM_SEPOLIA,
    name: 'Arbitrum Sepolia',
    chainType: ChainType.EVM,
    symbol: 'ETH',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  },
  
  // Optimism
  10: {
    id: 10,
    slip44: SLIP44_CHAIN_ID.OPTIMISM,
    name: 'Optimism',
    chainType: ChainType.EVM,
    symbol: 'ETH',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },

  // Base
  8453: {
    id: 8453,
    slip44: SLIP44_CHAIN_ID.BASE,
    name: 'Base',
    chainType: ChainType.EVM,
    symbol: 'ETH',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
    ],
    blockExplorerUrls: ['https://basescan.org'],
  },
  
  // Avalanche
  43114: {
    id: 43114,
    slip44: 9000,  // Avalanche SLIP-44
    name: 'Avalanche C-Chain',
    chainType: ChainType.EVM,
    symbol: 'AVAX',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18,
    },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
}

/**
 * Get chain information
 */
export function getChainInfo(chainId: number): ChainInfo | undefined {
  return CHAIN_INFO[chainId]
}

/**
 * Get chain type
 */
export function getChainType(chainId: number): ChainType | undefined {
  return CHAIN_INFO[chainId]?.chainType
}

/**
 * Check if chain is EVM
 */
export function isEVMChain(chainId: number): boolean {
  return getChainType(chainId) === ChainType.EVM
}

/**
 * Check if chain is Tron
 */
export function isTronChain(chainId: number): boolean {
  return getChainType(chainId) === ChainType.TRON
}

/**
 * Get SLIP-44 ID from EVM native chain ID (MetaMask / WalletConnect `chainId`).
 */
export function getSlip44(chainId: number): number | null {
  const localInfo = CHAIN_INFO[chainId]
  if (localInfo?.slip44) {
    return localInfo.slip44
  }
  return nativeToSlip44(chainId)
}

/**
 * Alias: EVM Chain ID → SLIP-44 (same as {@link getSlip44}).
 */
export function evmChainIdToSlip44(evmChainId: number): number | null {
  return getSlip44(evmChainId)
}

/**
 * Get EVM native chain ID from SLIP-44 ID.
 */
export function getNativeChainId(slip44: number): number | string | null {
  return slip44ToNative(slip44)
}

/**
 * Alias: SLIP-44 → EVM Chain ID when the native id is numeric.
 */
export function slip44ToEvmChainId(slip44: number): number | null {
  const native = slip44ToNative(slip44)
  return typeof native === 'number' ? native : null
}

/**
 * Normalize an id that may be either EVM Chain ID or SLIP-44 to SLIP-44.
 * Ethereum mainnet: EVM 1 → SLIP-44 60.
 */
export function normalizeToSlip44(chainId: number): number {
  const fromEvm = getSlip44(chainId)
  if (fromEvm != null) {
    return fromEvm
  }
  if (getChainInfoBySlip44Id(chainId)) {
    return chainId
  }
  return chainId
}

/**
 * Normalize an id that may be either SLIP-44 or EVM Chain ID to EVM Chain ID.
 */
export function normalizeToEvmChainId(chainId: number): number {
  const fromSlip = slip44ToEvmChainId(chainId)
  if (fromSlip != null) {
    return fromSlip
  }
  if (CHAIN_INFO[chainId]) {
    return chainId
  }
  return chainId
}

/**
 * Chain metadata by SLIP-44 id (from local CHAIN_INFO).
 */
export function getChainInfoBySlip44Id(slip44: number): ChainInfo | undefined {
  return Object.values(CHAIN_INFO).find((c) => c.slip44 === slip44)
}

/**
 * Whether this EVM chain id is in wallet-sdk CHAIN_INFO.
 */
export function isKnownEvmChain(chainId: number): boolean {
  return CHAIN_INFO[chainId]?.chainType === ChainType.EVM
}

/**
 * Get all supported chains (combines local and chain-utils data)
 */
export function getAllChains(): ChainInfo[] {
  return Object.values(CHAIN_INFO)
}

