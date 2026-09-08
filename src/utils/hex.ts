/**
 * Hex 工具函数
 */

/**
 * Safe non-empty trimmed string — TronLink may expose `false` / objects on
 * `defaultAddress.base58` when locked; never call `.trim()` on those.
 */
export function asNonEmptyTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/**
 * 判断是否为有效的 Hex 字符串
 */
export function isHex(value: string): boolean {
  return /^0x[0-9a-fA-F]*$/.test(value)
}

function utf8BytesToHex(bytes: Uint8Array): string {
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/** UTF-8 string → `0x` hex. For wallet `personal_sign` prefer {@link utf8ToPersonalSignHex}. */
export function toHex(value: string): string {
  return utf8BytesToHex(new TextEncoder().encode(value))
}

const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/
const HEX_UTF8_RE = /^0x(?:[0-9a-fA-F]{2})+$/

/**
 * EIP-1193 `personal_sign` first param: UTF-8 bytes as 0x-hex.
 * MetaMask accepts a raw string; TokenPocket / several mobile injectors only
 * accept hex and compare the address to `eth_accounts` (usually lowercase).
 *
 * Pass-through only when the *entire* string is 0x + even hex octets (already
 * encoded). A UTF-8 payload that merely contains a hex substring is encoded.
 * Do not use this to sign a hex string as literal text.
 */
export function utf8ToPersonalSignHex(message: string): string {
  if (HEX_UTF8_RE.test(message) && message.length >= 4) return message
  return toHex(message)
}

/** `[hexMessage, lowercaseAddress]` for `ethereum.request({ method: 'personal_sign' })`. */
export function evmPersonalSignParams(message: string, address: string): [string, string] {
  const addr = address.trim()
  if (!EVM_ADDR_RE.test(addr)) {
    throw new TypeError(`personal_sign address must be 0x + 40 hex, got: ${address}`)
  }
  return [utf8ToPersonalSignHex(message), addr.toLowerCase()]
}

/** `0x` hex → UTF-8 string. Inverse of {@link toHex}. */
export function fromHex(hex: string): string {
  const hexString = hex.startsWith('0x') ? hex.slice(2) : hex
  if (hexString.length % 2 !== 0) {
    throw new TypeError('fromHex: odd hex length')
  }
  const bytes = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hexString.slice(i * 2, i * 2 + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * 将数字转换为 Hex
 */
export function numberToHex(value: number | bigint): string {
  return `0x${value.toString(16)}`
}

/**
 * EIP-1193 tx quantity (`value` / `gas` / fees).
 * Use nullish checks — never `value ?` (drops legitimate `0n` / `0` / `"0x0"`).
 */
export function toEip1193Quantity(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) return trimmed.toLowerCase() === '0x' ? '0x0' : trimmed
    return numberToHex(BigInt(trimmed))
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return numberToHex(BigInt(value))
  }
  throw new TypeError(`unsupported EIP-1193 quantity: ${typeof value}`)
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

/**
 * Tron nodes often return ASCII errors as bare hex (`5472616e…` = "Transaction expired").
 * Decode when the payload is even-length hex of printable ASCII; otherwise leave as-is.
 */
export function humanizeTronWireMessage(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const hexBody = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed
  if (!/^[0-9a-fA-F]+$/.test(hexBody) || hexBody.length < 8 || hexBody.length % 2 !== 0) {
    return trimmed
  }
  try {
    const bytes = new Uint8Array(hexBody.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Number.parseInt(hexBody.slice(i * 2, i * 2 + 2), 16)
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim()
    if (!decoded || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)) return trimmed
    if (/^[\x20-\x7E]+$/.test(decoded)) return decoded
    return trimmed
  } catch {
    return trimmed
  }
}

/** EIP-1193 / wallet wrappers that carry the hex as a string (or nested object). */
const HEX_STRING_KEYS = [
  'signature',
  'result',
  'hash',
  'transactionHash',
  'txHash',
  'txID',
  'txid',
  'txId',
  'transaction_hash',
  'tx_hash',
  '_hex',
] as const

/** Envelopes whose value is another object — never treat string `data` as a hash (calldata). */
const NEST_OBJECT_KEYS = ['result', 'data', 'tx', 'transaction', 'payload'] as const

/**
 * TronLink / JSON-RPC style failure envelopes (`{ code, message }`) that some
 * wallets return instead of throwing.
 */
export function walletErrorMessageFromEnvelope(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as Record<string, unknown>
  const msg = rec.message
  if (typeof msg === 'string' && msg.trim()) {
    if ('code' in rec) return humanizeTronWireMessage(msg)
    if (rec.result === false) return humanizeTronWireMessage(msg)
  }
  if (typeof rec.error === 'string' && rec.error.trim()) {
    return humanizeTronWireMessage(rec.error)
  }
  if (rec.error && typeof rec.error === 'object') {
    const nested = walletErrorMessageFromEnvelope(rec.error)
    if (nested) return nested
  }
  return null
}

/**
 * Wallet adapters sometimes return a wrapped object / bytes instead of a hex
 * string. Downstream viem `hexToBytes` then throws `n.slice is not a function`.
 */
export function coerceWalletHexString(value: unknown, label: string): string {
  return coerceWalletHexStringInner(value, label, 0)
}

function coerceWalletHexStringInner(value: unknown, label: string, depth: number): string {
  if (depth > 4) {
    throw new TypeError(`${label} is not a hex string (nested too deep)`)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) throw new TypeError(`${label} is empty`)
    return trimmed
  }
  if (value instanceof Uint8Array) {
    if (value.length === 0) throw new TypeError(`${label} is empty`)
    return `0x${Array.from(value, (b) => b.toString(16).padStart(2, '0')).join('')}`
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView
    return coerceWalletHexStringInner(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      label,
      depth + 1,
    )
  }
  if (Array.isArray(value) && value.length > 0) {
    return coerceWalletHexStringInner(value[0], label, depth + 1)
  }
  if (value && typeof value === 'object') {
    const walletErr = walletErrorMessageFromEnvelope(value)
    if (walletErr) throw new Error(walletErr)
    const rec = value as Record<string, unknown>
    for (const key of HEX_STRING_KEYS) {
      const inner = rec[key]
      if (typeof inner === 'string' && inner.trim()) return inner.trim()
      if (inner instanceof Uint8Array) {
        return coerceWalletHexStringInner(inner, label, depth + 1)
      }
      // Nested hash/result objects (JSON-RPC / OKX). Do not walk ethers Signature { r, s, v }.
      if (key !== 'signature' && inner && typeof inner === 'object') {
        try {
          return coerceWalletHexStringInner(inner, label, depth + 1)
        } catch {
          continue
        }
      }
    }
    for (const key of NEST_OBJECT_KEYS) {
      const inner = rec[key]
      if (!inner || typeof inner !== 'object') continue
      try {
        return coerceWalletHexStringInner(inner, label, depth + 1)
      } catch {
        continue
      }
    }
    const keys = Object.keys(rec).slice(0, 16).join(',')
    throw new TypeError(
      `${label} is not a hex string (got object keys=${keys || '(none)'})`,
    )
  }
  throw new TypeError(`${label} is not a hex string (got ${typeof value})`)
}


