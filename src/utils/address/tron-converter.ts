/**
 * Tron 地址转换工具
 */

/**
 * 验证 Tron 地址（Base58 格式）
 */
export function isValidTronAddress(address: string): boolean {
  // Tron 地址以 T 开头，长度为 34
  if (!address || typeof address !== 'string') {
    return false
  }
  if (address.length !== 34 || !address.startsWith('T')) {
    return false
  }
  // Base58 字符集
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/
  return base58Regex.test(address)
}

/**
 * 验证 Tron 地址（Hex 格式）
 */
export function isValidTronHexAddress(address: string): boolean {
  // Tron Hex 地址以 41 开头，长度为 42
  if (!address || typeof address !== 'string') {
    return false
  }
  if (address.length !== 42 || !address.startsWith('41')) {
    return false
  }
  const hexRegex = /^[0-9a-fA-F]+$/
  return hexRegex.test(address.substring(2))
}

/**
 * 比较两个 Tron 地址是否相同
 */
export function compareTronAddresses(a: string, b: string): boolean {
  // 简单比较（实际应该转换为同一格式后比较）
  return a === b
}

/**
 * 缩短 Tron 地址显示
 * 例如: TJmm...d7PK
 */
export function shortenTronAddress(address: string, chars = 4): string {
  if (!isValidTronAddress(address)) {
    return address
  }
  return `${address.substring(0, chars + 1)}...${address.substring(34 - chars)}`
}

/**
 * 注意：完整的 Tron 地址转换（Base58 <-> Hex）需要额外的库
 * 如 tronweb 或 @tronscan/client
 * 这里只提供基础验证功能
 */

