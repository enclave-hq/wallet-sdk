/**
 * Normalize Tron / TronLink `accountsChanged` payloads across wallet versions.
 *
 * Supported shapes:
 * - TIP-1193: `string[]` (e.g. `['T...']`; `[]` = locked / disconnected)
 * - Legacy TronLink: `{ address: { base58: 'T...' } }` or `{ address: 'T...' }`
 * - Polling helper: `{ address: { base58: 'T...' } }`
 */
export function resolveTronAccountsChangedAddress(data: unknown): string | null {
  if (data == null) return null

  if (Array.isArray(data)) {
    const first = data[0]
    return typeof first === 'string' && first.trim() ? first.trim() : null
  }

  if (typeof data === 'string') {
    const trimmed = data.trim()
    return trimmed ? trimmed : null
  }

  if (typeof data !== 'object') return null
  const row = data as Record<string, unknown>

  if (typeof row.address === 'string' && row.address.trim()) {
    return row.address.trim()
  }

  if (row.address && typeof row.address === 'object') {
    const nested = row.address as Record<string, unknown>
    if (typeof nested.base58 === 'string' && nested.base58.trim()) {
      return nested.base58.trim()
    }
  }

  return null
}
