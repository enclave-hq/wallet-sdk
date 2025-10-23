/**
 * 签名验证器
 */

import { verifyMessage } from 'viem'
import { ChainType } from '../core/types'

/**
 * 签名验证器
 */
export class SignatureVerifier {
  /**
   * 验证签名
   */
  async verifySignature(
    message: string,
    signature: string,
    expectedAddress: string,
    chainType: ChainType
  ): Promise<boolean> {
    switch (chainType) {
      case ChainType.EVM:
        return this.verifyEIP191Signature(message, signature, expectedAddress)
      case ChainType.TRON:
        return this.verifyTIP191Signature(message, signature, expectedAddress)
      default:
        throw new Error(`Unsupported chain type: ${chainType}`)
    }
  }

  /**
   * 验证 EIP-191 签名
   */
  private async verifyEIP191Signature(
    message: string,
    signature: string,
    expectedAddress: string
  ): Promise<boolean> {
    try {
      const isValid = await verifyMessage({
        address: expectedAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      })

      return isValid
    } catch (error) {
      console.error('EIP-191 signature verification failed:', error)
      return false
    }
  }

  /**
   * 验证 TIP-191 签名
   * 注意：这里需要 TronWeb 或类似库来验证 Tron 签名
   * 这是一个占位实现
   */
  private async verifyTIP191Signature(
    _message: string,
    _signature: string,
    _expectedAddress: string
  ): Promise<boolean> {
    // TODO: 实现 Tron 签名验证
    // 需要使用 TronWeb 的 verifyMessage 方法
    console.warn('TIP-191 signature verification not implemented yet')
    return false
  }
}

