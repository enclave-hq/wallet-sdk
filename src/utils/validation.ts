/**
 * 验证工具函数
 */

import { isValidEVMAddress } from './address/evm-utils'
import { isValidTronAddress } from './address/tron-converter'
import { ChainType } from '../core/types'
import { getChainType } from './chain-info'

/**
 * 根据链类型验证地址
 */
export function validateAddress(address: string, chainType: ChainType): boolean {
  switch (chainType) {
    case ChainType.EVM:
      return isValidEVMAddress(address)
    case ChainType.TRON:
      return isValidTronAddress(address)
    default:
      return false
  }
}

/**
 * 根据链 ID 验证地址
 */
export function validateAddressForChain(address: string, chainId: number): boolean {
  const chainType = getChainType(chainId)
  if (!chainType) {
    return false
  }
  return validateAddress(address, chainType)
}

/**
 * 验证链 ID
 */
export function isValidChainId(chainId: number): boolean {
  return Number.isInteger(chainId) && chainId > 0
}

/**
 * 验证签名
 */
export function isValidSignature(signature: string): boolean {
  // 基本验证：以 0x 开头，长度为 132（65 字节）
  return /^0x[0-9a-fA-F]{130}$/.test(signature)
}

/**
 * 验证交易哈希
 */
export function isValidTransactionHash(txHash: string, chainType: ChainType): boolean {
  switch (chainType) {
    case ChainType.EVM:
      // EVM: 0x + 64 hex chars
      return /^0x[0-9a-fA-F]{64}$/.test(txHash)
    case ChainType.TRON:
      // Tron: 64 hex chars (no 0x prefix)
      return /^[0-9a-fA-F]{64}$/.test(txHash)
    default:
      return false
  }
}


