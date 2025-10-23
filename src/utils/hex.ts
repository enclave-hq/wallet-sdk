/**
 * Hex 工具函数
 */

/**
 * 判断是否为有效的 Hex 字符串
 */
export function isHex(value: string): boolean {
  return /^0x[0-9a-fA-F]*$/.test(value)
}

/**
 * 将字符串转换为 Hex
 */
export function toHex(value: string): string {
  let hex = ''
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16)
  }
  return `0x${hex}`
}

/**
 * 将 Hex 转换为字符串
 */
export function fromHex(hex: string): string {
  const hexString = hex.startsWith('0x') ? hex.slice(2) : hex
  let str = ''
  for (let i = 0; i < hexString.length; i += 2) {
    str += String.fromCharCode(parseInt(hexString.substr(i, 2), 16))
  }
  return str
}

/**
 * 将数字转换为 Hex
 */
export function numberToHex(value: number | bigint): string {
  return `0x${value.toString(16)}`
}

/**
 * 将 Hex 转换为数字
 */
export function hexToNumber(hex: string): number {
  return parseInt(hex, 16)
}

/**
 * 确保 Hex 字符串有 0x 前缀
 */
export function ensureHexPrefix(value: string): string {
  return value.startsWith('0x') ? value : `0x${value}`
}

/**
 * 移除 Hex 字符串的 0x 前缀
 */
export function removeHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

