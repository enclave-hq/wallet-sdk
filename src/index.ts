/**
 * @enclave-hq/wallet-sdk
 * 
 * Multi-chain wallet adapter for Enclave
 * Supports EVM and Tron ecosystems
 */

// ===== Core =====
export { WalletManager } from './core/wallet-manager'
export { AdapterRegistry } from './core/adapter-registry'

// ===== Types =====
export type {
  Account,
  UniversalAddress,
  IWalletAdapter,
  WalletManagerConfig,
  WalletManagerEvents,
  ConnectedWallet,
  ContractReadParams,
  ContractWriteParams,
  TransactionReceipt,
  AddChainParams,
  WalletHistoryRecord,
  StorageData,
  WalletAvailability,
  EVMTransaction,
  TronTransaction,
  Transaction,
} from './core/types'

export {
  ChainType,
  WalletType,
  WalletState,
} from './core/types'

// ===== Errors =====
export {
  WalletSDKError,
  WalletNotConnectedError,
  WalletNotAvailableError,
  ConnectionRejectedError,
  ChainNotSupportedError,
  SignatureRejectedError,
  TransactionFailedError,
  MethodNotSupportedError,
  ConfigurationError,
  NetworkError,
} from './core/errors'

// ===== Adapters =====
export { WalletAdapter } from './adapters/base/wallet-adapter'
export { BrowserWalletAdapter } from './adapters/base/browser-wallet-adapter'
export { MetaMaskAdapter } from './adapters/evm/metamask'
export { TronLinkAdapter } from './adapters/tron/tronlink'
export { EVMPrivateKeyAdapter } from './adapters/evm/private-key'

// ===== Auth =====
export { AuthMessageGenerator } from './auth/message-generator'
export { SignatureVerifier } from './auth/signature-verifier'
export type { AuthMessageParams } from './auth/message-generator'

// ===== Detection =====
export { WalletDetector } from './detection/detector'
export { SUPPORTED_WALLETS, getWalletMetadata, getEVMWallets, getTronWallets } from './detection/supported-wallets'
export type { WalletMetadata } from './detection/supported-wallets'

// ===== Utils =====
export {
  createUniversalAddress,
  parseUniversalAddress,
  isValidUniversalAddress,
  getChainIdFromUniversalAddress,
  getAddressFromUniversalAddress,
  compareUniversalAddresses,
} from './utils/address/universal-address'

export {
  isValidEVMAddress,
  formatEVMAddress,
  compareEVMAddresses,
  shortenAddress,
} from './utils/address/evm-utils'

export {
  isValidTronAddress,
  isValidTronHexAddress,
  compareTronAddresses,
  shortenTronAddress,
} from './utils/address/tron-converter'

export {
  CHAIN_INFO,
  getChainInfo,
  getChainType,
  isEVMChain,
  isTronChain,
} from './utils/chain-info'

export type { ChainInfo } from './utils/chain-info'

export {
  validateAddress,
  validateAddressForChain,
  isValidChainId,
  isValidSignature,
  isValidTransactionHash,
} from './utils/validation'

export {
  isHex,
  toHex,
  fromHex,
  numberToHex,
  hexToNumber,
  ensureHexPrefix,
  removeHexPrefix,
} from './utils/hex'

// ===== Default Export =====
import { WalletManager as WM } from './core/wallet-manager'
export default WM

