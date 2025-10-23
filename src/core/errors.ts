/**
 * 错误类型定义
 */

/**
 * 基础错误类
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
 * 钱包未连接错误
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
 * 钱包不可用错误
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
 * 连接被拒绝错误
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
 * 链不支持错误
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
 * 签名被拒绝错误
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
 * 交易失败错误
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
 * 方法不支持错误
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

