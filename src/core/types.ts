/**
 * Core type definitions
 */

import { ChainType as ChainUtilsChainType } from '@enclave-hq/chain-utils'

// ========== Enumerations ==========

/**
 * Chain type (re-exported from chain-utils)
 */
export const ChainType = ChainUtilsChainType
export type ChainType = ChainUtilsChainType

/**
 * Wallet Types
 */
export enum WalletType {
  METAMASK = 'metamask',
  WALLETCONNECT = 'walletconnect',
  COINBASE_WALLET = 'coinbase-wallet',
  TRONLINK = 'tronlink',
  WALLETCONNECT_TRON = 'walletconnect-tron',
  PRIVATE_KEY = 'private-key',
}

/**
 * Wallet States
 */
export enum WalletState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

// ========== Account Related ==========

/**
 * Universal Address (chain-agnostic address)
 * Format: "chainId:address"
 */
export type UniversalAddress = string

/**
 * Account Information
 */
export interface Account {
  /** Universal Address (chainId:address) */
  universalAddress: UniversalAddress
  /** Native address (e.g., 0x... or T...) */
  nativeAddress: string
  /** Chain ID */
  chainId: number
  /** Chain Type */
  chainType: ChainType
  /** Whether this is an active account */
  isActive: boolean
  /** Account balance (optional) */
  balance?: string
  /** Account name (optional) */
  name?: string
}

// ========== Adapter Related ==========

/**
 * 钱包适配器接口
 */
export interface IWalletAdapter {
  // 元数据
  readonly type: WalletType
  readonly chainType: ChainType
  readonly name: string
  readonly icon?: string
  
  // 状态
  state: WalletState
  currentAccount: Account | null
  
  // 连接管理
  connect(chainId?: number): Promise<Account>
  disconnect(): Promise<void>
  isAvailable(): Promise<boolean>
  
  // 签名
  signMessage(message: string): Promise<string>
  signTransaction?(transaction: Transaction): Promise<string>
  signTypedData?(typedData: any): Promise<string>
  
  // 链切换（仅 EVM 支持）
  switchChain?(chainId: number): Promise<void>
  addChain?(chainConfig: AddChainParams): Promise<void>
  
  // 合约调用
  readContract?<T = any>(params: ContractReadParams): Promise<T>
  writeContract?(params: ContractWriteParams): Promise<string>
  estimateGas?(params: ContractWriteParams): Promise<bigint>
  waitForTransaction?(txHash: string, confirmations?: number): Promise<TransactionReceipt>
  
  // Provider 访问
  getProvider(): any
  getSigner?(): any
  
  // 事件监听
  on(event: string, handler: (...args: any[]) => void): void
  off(event: string, handler: (...args: any[]) => void): void
  removeAllListeners(event?: string): void
}

/**
 * 合约读取参数
 */
export interface ContractReadParams {
  address: string
  abi: any[]
  functionName: string
  args?: any[]
}

/**
 * 合约写入参数
 */
export interface ContractWriteParams extends ContractReadParams {
  value?: string  // 发送的原生代币数量（wei）
  gas?: number
  gasPrice?: string
}

/**
 * EVM 交易参数
 */
export interface EVMTransaction {
  to: string
  value?: string | bigint
  data?: string
  gas?: string | bigint
  gasPrice?: string | bigint
  maxFeePerGas?: string | bigint
  maxPriorityFeePerGas?: string | bigint
  nonce?: number
  chainId?: number
}

/**
 * Tron 交易参数
 */
export interface TronTransaction {
  // Tron 交易格式
  txID?: string
  raw_data?: any
  raw_data_hex?: string
  visible?: boolean
}

/**
 * 通用交易类型
 */
export type Transaction = EVMTransaction | TronTransaction

/**
 * 交易回执
 */
export interface TransactionReceipt {
  transactionHash: string
  blockNumber: number
  blockHash: string
  from: string
  to?: string
  status: 'success' | 'failed'
  gasUsed: string
  effectiveGasPrice?: string
  logs?: any[]
}

/**
 * 添加链参数
 */
export interface AddChainParams {
  chainId: number
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls?: string[]
  iconUrls?: string[]
}

// ========== WalletManager 相关 ==========

/**
 * WalletManager 配置
 */
export interface WalletManagerConfig {
  /** 是否启用自动存储（localStorage） */
  enableStorage?: boolean
  /** 存储键前缀 */
  storagePrefix?: string
  /** 默认链 ID（EVM） */
  defaultChainId?: number
  /** 默认 Tron 链 ID */
  defaultTronChainId?: number
  /** WalletConnect 项目 ID */
  walletConnectProjectId?: string
}

/**
 * 已连接的钱包信息
 */
export interface ConnectedWallet {
  /** 账户信息 */
  account: Account
  /** 钱包类型 */
  walletType: WalletType
  /** Chain Type */
  chainType: ChainType
  /** 是否为主钱包 */
  isPrimary: boolean
  /** 是否支持链切换 */
  canSwitchChain: boolean
  /** 适配器实例 */
  adapter: IWalletAdapter
}

// ========== 事件相关 ==========

/**
 * WalletManager 事件类型
 */
export interface WalletManagerEvents extends Record<string, (...args: any[]) => void> {
  // 主钱包事件
  accountChanged: (account: Account | null) => void
  chainChanged: (chainId: number, account: Account) => void
  disconnected: () => void
  
  // 任意钱包事件
  walletAccountChanged: (chainType: ChainType, account: Account | null, isPrimary: boolean) => void
  walletChainChanged: (chainType: ChainType, chainId: number, account: Account, isPrimary: boolean) => void
  walletDisconnected: (chainType: ChainType, isPrimary: boolean) => void
  
  // 主钱包切换
  primaryWalletSwitched: (newPrimary: Account, oldPrimary: Account | null, chainType: ChainType) => void
  
  // 错误
  error: (error: Error) => void
}

// ========== 存储相关 ==========

/**
 * 存储的钱包历史记录
 */
export interface WalletHistoryRecord {
  universalAddress: UniversalAddress
  nativeAddress: string
  chainId: number
  chainType: ChainType
  walletType: WalletType
  lastConnected: number  // 时间戳
  name?: string
}

/**
 * 存储的数据结构
 */
export interface StorageData {
  /** 当前 Universal Address */
  current: UniversalAddress | null
  /** 主钱包类型（用于自动恢复连接） */
  primaryWalletType?: WalletType
  /** 主钱包的 ChainID（用于自动恢复连接） */
  primaryChainId?: number
  /** 历史记录 */
  history: WalletHistoryRecord[]
}

// ========== 钱包检测 ==========

/**
 * 钱包可用性信息
 */
export interface WalletAvailability {
  walletType: WalletType
  chainType: ChainType
  isAvailable: boolean
  downloadUrl?: string
  detected: boolean
}

