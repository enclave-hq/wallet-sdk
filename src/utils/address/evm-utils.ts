/**
 * EVM 地址工具
 */

import { getAddress, isAddress } from 'viem'

/**
 * 验证 EVM 地址
 */
export function isValidEVMAddress(address: string): boolean {
  return isAddress(address)
}

/**
 * 格式化 EVM 地址（checksum）
 */
export function formatEVMAddress(address: string): string {
  if (!isAddress(address)) {
    throw new Error(`Invalid EVM address: ${address}`)
  }
  return getAddress(address)
}

/**
 * 比较两个 EVM 地址是否相同
 */
export function compareEVMAddresses(a: string, b: string): boolean {
  try {
    return getAddress(a) === getAddress(b)
  } catch {
    return false
  }
}

/**
 * 缩短地址显示
 * 例如: 0x1234...5678
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!isAddress(address)) {
    return address
  }
  const formatted = getAddress(address)
  return `${formatted.substring(0, chars + 2)}...${formatted.substring(42 - chars)}`
}

