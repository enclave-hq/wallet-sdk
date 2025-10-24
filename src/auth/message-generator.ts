/**
 * 认证消息生成器
 */

import { ChainType } from '../core/types'

/**
 * 认证消息参数
 */
export interface AuthMessageParams {
  domain: string
  nonce: string
  chainId: number
  timestamp: number
  statement?: string
}

/**
 * 认证消息生成器
 */
export class AuthMessageGenerator {
  constructor(private readonly domain: string) {}

  /**
   * 生成认证消息
   */
  generateAuthMessage(
    chainType: ChainType,
    nonce: string,
    chainId: number,
    timestamp: number = Date.now(),
    statement?: string
  ): string {
    switch (chainType) {
      case ChainType.EVM:
        return this.generateEIP191Message({
          domain: this.domain,
          nonce,
          chainId,
          timestamp,
          statement,
        })
      case ChainType.TRON:
        return this.generateTIP191Message({
          domain: this.domain,
          nonce,
          chainId,
          timestamp,
          statement,
        })
      default:
        throw new Error(`Unsupported chain type: ${chainType}`)
    }
  }

  /**
   * 生成 EIP-191 格式的认证消息
   */
  private generateEIP191Message(params: AuthMessageParams): string {
    const lines = [
      `${params.domain} wants you to sign in.`,
      '',
    ]

    if (params.statement) {
      lines.push(params.statement, '')
    }

    lines.push(
      `Nonce: ${params.nonce}`,
      `Chain ID: ${params.chainId}`,
      `Issued At: ${new Date(params.timestamp).toISOString()}`
    )

    return lines.join('\n')
  }

  /**
   * 生成 TIP-191 格式的认证消息
   */
  private generateTIP191Message(params: AuthMessageParams): string {
    // TIP-191 与 EIP-191 格式相同，但使用 "Tron" 而不是 "Ethereum"
    const lines = [
      `${params.domain} wants you to sign in with your Tron account.`,
      '',
    ]

    if (params.statement) {
      lines.push(params.statement, '')
    }

    lines.push(
      `Nonce: ${params.nonce}`,
      `Chain ID: ${params.chainId}`,
      `Issued At: ${new Date(params.timestamp).toISOString()}`
    )

    return lines.join('\n')
  }

  /**
   * 生成随机 nonce
   */
  static generateNonce(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }
}


