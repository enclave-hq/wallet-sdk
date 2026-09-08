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
  ISigner,
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
export { WalletConnectAdapter } from './adapters/evm/wallet-connect'
export { TronLinkAdapter } from './adapters/tron/tronlink'
export {
  scheduleRpc,
  throttleTronWeb,
  rpcGate,
  tronRpcGate,
} from './adapters/tron/rpc-gate'
export {
  detectTronLinkInjector,
  publishAfterTronLinkSign,
  skipWalletBroadcastAfterSign,
  tronTxLooksOnChain,
} from './adapters/tron/tron-broadcast'
export { EVMPrivateKeyAdapter } from './adapters/evm/private-key'
// Deep Link (通用深度链接，与 WalletConnect 同级)
export { DeepLinkAdapter, DeepLinkProviderType } from './adapters/deep-link/adapter'
export type { IDeepLinkProvider } from './adapters/deep-link/providers/base'
export type {
  DeepLinkCallback,
  DeepLinkSignMessageParams,
  DeepLinkSignTransactionParams,
  DeepLinkConnectParams,
} from './adapters/deep-link/providers/base'
export { TokenPocketDeepLinkProvider } from './adapters/deep-link/providers/tokenpocket'
export { TronLinkDeepLinkProvider } from './adapters/deep-link/providers/tronlink'
export { ImTokenDeepLinkProvider } from './adapters/deep-link/providers/imtoken'
export { MetaMaskDeepLinkProvider } from './adapters/deep-link/providers/metamask'
export { OKXDeepLinkProvider } from './adapters/deep-link/providers/okx'
// Legacy: 保留旧的 TronDeepLinkAdapter 以保持向后兼容
export { TronDeepLinkAdapter, DeepLinkWalletType } from './adapters/tron/deep-link'

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

// QR Code Signer
export { QRCodeSigner } from './utils/qrcode-signer'
export type {
  QRCodeSignerConfig,
  QRCodeSignResult,
} from './utils/qrcode-signer'
export { QRCodeSignStatus } from './utils/qrcode-signer'

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
  EVM_CHAIN_ID,
  SLIP44_CHAIN_ID,
  getChainInfo,
  getChainInfoBySlip44Id,
  getChainType,
  isEVMChain,
  isTronChain,
  isKnownEvmChain,
  getSlip44,
  getNativeChainId,
  evmChainIdToSlip44,
  slip44ToEvmChainId,
  normalizeToSlip44,
  normalizeToEvmChainId,
  slip44FromEvmChainId,
  evmChainIdFromCustomSlip44,
  getAllChains,
} from './utils/chain-info'

export type { ChainInfo } from './utils/chain-info'

export { nativeToSlip44, slip44ToNative } from '@enclave-hq/chain-utils'

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
  toEip1193Quantity,
  coerceWalletHexString,
  asNonEmptyTrimmedString,
  utf8ToPersonalSignHex,
  evmPersonalSignParams,
  hexToNumber,
  ensureHexPrefix,
  removeHexPrefix,
  humanizeTronWireMessage,
} from './utils/hex'

// ===== Default Export =====
import { WalletManager as WM } from './core/wallet-manager'
export default WM

