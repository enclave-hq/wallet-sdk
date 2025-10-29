/**
 * Chain information constants
 */

import { 
  ChainType,
  nativeToSlip44,
  slip44ToNative,
  ChainInfo as ChainUtilsChainInfo
} from '@enclave-hq/chain-utils'

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
    rpcUrls: ['https://eth.llamarpc.com'],
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
      'https://data-seed-prebsc-1-s1.binance.org:8545' // 原来的主节点作为最后备选
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
    slip44: 1042161,  // Custom SLIP-44 (1000000 + 42161)
    name: 'Arbitrum One',
    chainType: ChainType.EVM,
    symbol: 'ETH',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  
  // Optimism
  10: {
    id: 10,
    slip44: 1000010,  // Custom SLIP-44 (1000000 + 10)
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
 * Get SLIP-44 ID from native chain ID
 */
export function getSlip44(chainId: number): number | null {
  // Check local config first
  const localInfo = CHAIN_INFO[chainId]
  if (localInfo?.slip44) {
    return localInfo.slip44
  }
  
  // Fall back to chain-utils
  return nativeToSlip44(chainId)
}

/**
 * Get native chain ID from SLIP-44 ID
 */
export function getNativeChainId(slip44: number): number | string | null {
  return slip44ToNative(slip44)
}

/**
 * Get all supported chains (combines local and chain-utils data)
 */
export function getAllChains(): ChainInfo[] {
  return Object.values(CHAIN_INFO)
}

