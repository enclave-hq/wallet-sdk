/**
 * React Integration for @enclave-hq/wallet-sdk
 */

// Context & Provider
export { WalletProvider, useWallet } from './WalletContext'
export type { WalletContextValue, WalletProviderProps } from './WalletContext'

// Hooks
export { useAccount } from './hooks/useAccount'
export { useConnect } from './hooks/useConnect'
export { useDisconnect } from './hooks/useDisconnect'
export { useSignMessage } from './hooks/useSignMessage'
export { useSignTransaction } from './hooks/useSignTransaction'
export { useQRCodeSigner } from './hooks/useQRCodeSigner'

export type { UseAccountResult } from './hooks/useAccount'
export type { UseConnectResult } from './hooks/useConnect'
export type { UseDisconnectResult } from './hooks/useDisconnect'
export type { UseSignMessageResult } from './hooks/useSignMessage'
export type { UseSignTransactionResult } from './hooks/useSignTransaction'
export type { UseQRCodeSignerResult } from './hooks/useQRCodeSigner'

// Components
export { QRCodeModal } from './components/QRCodeModal'
export type { QRCodeModalProps } from './components/QRCodeModal'

