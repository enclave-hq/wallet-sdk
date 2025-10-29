/**
 * Error Type Definitions
 */

/**
 * Base Error Class
 */
export class WalletSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'WalletSDKError'
    Object.setPrototypeOf(this, WalletSDKError.prototype)
  }
}

/**
 * Wallet Not Connected Error
 */
export class WalletNotConnectedError extends WalletSDKError {
  constructor(walletType?: string) {
    super(
      walletType
        ? `Wallet ${walletType} is not connected`
        : 'No wallet is connected',
      'WALLET_NOT_CONNECTED',
      { walletType }
    )
    this.name = 'WalletNotConnectedError'
  }
}

/**
 * Wallet Not Available Error
 */
export class WalletNotAvailableError extends WalletSDKError {
  constructor(walletType: string, downloadUrl?: string) {
    super(
      `Wallet ${walletType} is not available. Please install it first.`,
      'WALLET_NOT_AVAILABLE',
      { walletType, downloadUrl }
    )
    this.name = 'WalletNotAvailableError'
  }
}

/**
 * Connection Rejected Error
 */
export class ConnectionRejectedError extends WalletSDKError {
  constructor(walletType: string) {
    super(
      `Connection to ${walletType} was rejected by user`,
      'CONNECTION_REJECTED',
      { walletType }
    )
    this.name = 'ConnectionRejectedError'
  }
}

/**
 * Chain Not Supported Error
 */
export class ChainNotSupportedError extends WalletSDKError {
  constructor(chainId: number, walletType: string) {
    super(
      `Chain ${chainId} is not supported by ${walletType}`,
      'CHAIN_NOT_SUPPORTED',
      { chainId, walletType }
    )
    this.name = 'ChainNotSupportedError'
  }
}

/**
 * Signature Rejected Error
 */
export class SignatureRejectedError extends WalletSDKError {
  constructor(message?: string) {
    super(
      message || 'Signature was rejected by user',
      'SIGNATURE_REJECTED'
    )
    this.name = 'SignatureRejectedError'
  }
}

/**
 * Transaction Failed Error
 */
export class TransactionFailedError extends WalletSDKError {
  constructor(txHash: string, reason?: string) {
    super(
      `Transaction ${txHash} failed${reason ? `: ${reason}` : ''}`,
      'TRANSACTION_FAILED',
      { txHash, reason }
    )
    this.name = 'TransactionFailedError'
  }
}

/**
 * Method Not Supported Error
 */
export class MethodNotSupportedError extends WalletSDKError {
  constructor(method: string, walletType: string) {
    super(
      `Method ${method} is not supported by ${walletType}`,
      'METHOD_NOT_SUPPORTED',
      { method, walletType }
    )
    this.name = 'MethodNotSupportedError'
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends WalletSDKError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', details)
    this.name = 'ConfigurationError'
  }
}

/**
 * 网络错误
 */
export class NetworkError extends WalletSDKError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}


