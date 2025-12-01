/**
 * Deep Link Provider Base Interface
 * 
 * 定义深度链接提供者的标准接口
 * 每个钱包（TokenPocket、TronLink、ImToken 等）都需要实现此接口
 */

export interface DeepLinkCallback {
  actionId: string
  resolve: (value: any) => void
  reject: (error: any) => void
}

export interface DeepLinkSignMessageParams {
  message: string
  chainId?: number
}

export interface DeepLinkSignTransactionParams {
  transaction: any
  chainId?: number
}

export interface DeepLinkConnectParams {
  chainId?: number
}

/**
 * 深度链接提供者接口
 * 
 * 每个钱包都需要实现此接口，提供自己的深度链接格式和回调处理
 */
export interface IDeepLinkProvider {
  /**
   * 提供者名称
   */
  readonly name: string

  /**
   * 提供者图标
   */
  readonly icon: string

  /**
   * 检查是否可用（移动设备检测等）
   */
  isAvailable(): Promise<boolean>

  /**
   * 构建签名消息的深度链接
   */
  buildSignMessageLink(params: DeepLinkSignMessageParams): {
    url: string
    actionId: string
    callbackSchema?: string
    callbackUrl?: string
  }

  /**
   * 构建签名交易的深度链接
   */
  buildSignTransactionLink(params: DeepLinkSignTransactionParams): {
    url: string
    actionId: string
    callbackSchema?: string
    callbackUrl?: string
  }

  /**
   * 构建连接的深度链接（如果支持）
   */
  buildConnectLink?(params: DeepLinkConnectParams): {
    url: string
    actionId?: string
  }

  /**
   * 处理回调结果
   * 从 URL 参数或回调数据中提取结果
   */
  parseCallbackResult(urlParams: URLSearchParams): {
    actionId: string | null
    result: any | null
    error: string | null
  }

  /**
   * 获取默认的回调 Schema
   * 如果用户未指定，使用此默认值
   */
  getDefaultCallbackSchema?(): string
}

