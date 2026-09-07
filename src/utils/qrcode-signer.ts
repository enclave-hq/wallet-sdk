/**
 * QR Code Signer
 * 
 * 二维码签名工具类，支持生成二维码并轮询签名结果
 */

import QRCode from 'qrcode'
import { SignatureRejectedError, NetworkError } from '../core/errors'

/**
 * 二维码签名配置
 */
export interface QRCodeSignerConfig {
  /** 签名请求 ID（用于轮询结果） */
  requestId: string
  /** 签名请求 URL（二维码内容） */
  requestUrl: string
  /** 轮询结果的后端 API URL */
  pollUrl?: string
  /** 轮询间隔（毫秒），默认 2000ms */
  pollInterval?: number
  /** 超时时间（毫秒），默认 300000ms (5分钟) */
  timeout?: number
  /** 自定义轮询函数 */
  pollFn?: (requestId: string) => Promise<QRCodeSignResult | null>
}

/**
 * 二维码签名结果
 */
export interface QRCodeSignResult {
  /** 签名是否完成 */
  completed: boolean
  /** 签名结果（hex string） */
  signature?: string
  /** 错误信息 */
  error?: string
  /** 签名者地址 */
  signer?: string
}

/**
 * 二维码签名状态
 */
export enum QRCodeSignStatus {
  /** 等待扫描 */
  WAITING = 'waiting',
  /** 已扫描，等待确认 */
  PENDING = 'pending',
  /** 签名成功 */
  SUCCESS = 'success',
  /** 签名失败 */
  FAILED = 'failed',
  /** 超时 */
  TIMEOUT = 'timeout',
  /** 已取消 */
  CANCELLED = 'cancelled',
}

/**
 * QR Code Signer
 * 
 * 用于生成二维码并轮询签名结果的工具类
 */
export class QRCodeSigner {
  private config: Required<Omit<QRCodeSignerConfig, 'pollFn'>> & { pollFn?: QRCodeSignerConfig['pollFn'] }
  private pollTimer: NodeJS.Timeout | null = null
  private timeoutTimer: NodeJS.Timeout | null = null
  private status: QRCodeSignStatus = QRCodeSignStatus.WAITING
  private qrCodeDataUrl: string | null = null
  private result: QRCodeSignResult | null = null

  constructor(config: QRCodeSignerConfig) {
    this.config = {
      requestId: config.requestId,
      requestUrl: config.requestUrl,
      pollUrl: config.pollUrl || '',
      pollInterval: config.pollInterval || 2000,
      timeout: config.timeout || 300000, // 5 minutes
      pollFn: config.pollFn,
    }
  }

  /**
   * 生成二维码图片（Data URL）
   */
  async generateQRCode(options?: {
    width?: number
    margin?: number
    color?: {
      dark?: string
      light?: string
    }
  }): Promise<string> {
    if (this.qrCodeDataUrl) {
      return this.qrCodeDataUrl
    }

    try {
      const qrCodeOptions: QRCode.QRCodeToDataURLOptions = {
        width: options?.width || 300,
        margin: options?.margin || 2,
        color: {
          dark: options?.color?.dark || '#000000',
          light: options?.color?.light || '#FFFFFF',
        },
      }

      this.qrCodeDataUrl = await QRCode.toDataURL(this.config.requestUrl, qrCodeOptions)
      return this.qrCodeDataUrl
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 开始轮询签名结果
   */
  async startPolling(
    onStatusChange?: (status: QRCodeSignStatus) => void,
    onResult?: (result: QRCodeSignResult) => void
  ): Promise<string> {
    if (this.status === QRCodeSignStatus.SUCCESS && this.result?.signature) {
      return this.result.signature
    }

    if (this.status === QRCodeSignStatus.CANCELLED || this.status === QRCodeSignStatus.TIMEOUT) {
      throw new SignatureRejectedError('Signature request was cancelled or timed out')
    }

    // 设置超时
    this.timeoutTimer = setTimeout(() => {
      this.stopPolling()
      this.status = QRCodeSignStatus.TIMEOUT
      onStatusChange?.(this.status)
      throw new SignatureRejectedError('Signature request timed out')
    }, this.config.timeout)

    // 开始轮询
    return new Promise<string>((resolve, reject) => {
      const poll = async () => {
        try {
          let result: QRCodeSignResult | null = null

          if (this.config.pollFn) {
            // 使用自定义轮询函数
            result = await this.config.pollFn(this.config.requestId)
          } else if (this.config.pollUrl) {
            // 使用默认 HTTP 轮询
            result = await this.defaultPoll(this.config.requestId)
          } else {
            // 没有轮询配置，等待用户手动完成
            return
          }

          if (result?.completed) {
            this.stopPolling()
            this.result = result

            if (result.signature) {
              this.status = QRCodeSignStatus.SUCCESS
              onStatusChange?.(this.status)
              onResult?.(result)
              resolve(result.signature)
            } else if (result.error) {
              this.status = QRCodeSignStatus.FAILED
              onStatusChange?.(this.status)
              reject(new SignatureRejectedError(result.error))
            }
          } else if (result) {
            // 已扫描但未完成
            if (this.status === QRCodeSignStatus.WAITING) {
              this.status = QRCodeSignStatus.PENDING
              onStatusChange?.(this.status)
            }
            // 继续轮询
            this.pollTimer = setTimeout(poll, this.config.pollInterval)
          } else {
            // 继续轮询
            this.pollTimer = setTimeout(poll, this.config.pollInterval)
          }
        } catch (error) {
          this.stopPolling()
          this.status = QRCodeSignStatus.FAILED
          onStatusChange?.(this.status)
          reject(error)
        }
      }

      // 开始第一次轮询
      poll()
    })
  }

  /**
   * 默认 HTTP 轮询函数
   */
  private async defaultPoll(requestId: string): Promise<QRCodeSignResult | null> {
    if (!this.config.pollUrl) {
      return null
    }

    try {
      const url = `${this.config.pollUrl}?requestId=${encodeURIComponent(requestId)}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // 请求不存在，继续轮询
          return null
        }
        throw new NetworkError(`Poll request failed: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        completed: data.completed === true,
        signature: data.signature,
        error: data.error,
        signer: data.signer,
      }
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error
      }
      // 网络错误，继续轮询
      return null
    }
  }

  /**
   * 停止轮询
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
  }

  /**
   * 取消签名请求
   */
  cancel(): void {
    this.stopPolling()
    this.status = QRCodeSignStatus.CANCELLED
  }

  /**
   * 获取当前状态
   */
  getStatus(): QRCodeSignStatus {
    return this.status
  }

  /**
   * 获取二维码 URL
   */
  getQRCodeUrl(): string {
    return this.config.requestUrl
  }

  /**
   * 获取结果
   */
  getResult(): QRCodeSignResult | null {
    return this.result
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopPolling()
    this.qrCodeDataUrl = null
    this.result = null
    this.status = QRCodeSignStatus.WAITING
  }
}



















