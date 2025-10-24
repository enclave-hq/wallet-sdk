/**
 * Universal Address 工具
 * 格式: "chainId:address"
 */

import type { UniversalAddress } from '../../core/types'

/**
 * 创建 Universal Address
 */
export function createUniversalAddress(
  chainId: number,
  address: string
): UniversalAddress {
  return `${chainId}:${address}`
}

/**
 * 解析 Universal Address
 */
export function parseUniversalAddress(universalAddress: UniversalAddress): {
  chainId: number
  address: string
} | null {
  const parts = universalAddress.split(':')
  if (parts.length !== 2) {
    return null
  }
  
  const chainId = parseInt(parts[0], 10)
  if (isNaN(chainId)) {
    return null
  }
  
  return {
    chainId,
    address: parts[1],
  }
}

/**
 * 验证 Universal Address 格式
 */
export function isValidUniversalAddress(universalAddress: string): boolean {
  return parseUniversalAddress(universalAddress) !== null
}

/**
 * 从 Universal Address 提取链 ID
 */
export function getChainIdFromUniversalAddress(
  universalAddress: UniversalAddress
): number | null {
  const parsed = parseUniversalAddress(universalAddress)
  return parsed ? parsed.chainId : null
}

/**
 * 从 Universal Address 提取地址
 */
export function getAddressFromUniversalAddress(
  universalAddress: UniversalAddress
): string | null {
  const parsed = parseUniversalAddress(universalAddress)
  return parsed ? parsed.address : null
}

/**
 * 比较两个 Universal Address 是否相同
 */
export function compareUniversalAddresses(
  a: UniversalAddress,
  b: UniversalAddress
): boolean {
  return a.toLowerCase() === b.toLowerCase()
}


