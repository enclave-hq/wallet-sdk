/**
 * TRON unsigned txs default to ~60s expiration from build time.
 * Wallet confirm is often slower (rent energy UI → read popup → tap confirm),
 * so we extend before sign and rebuild once if the node still rejects as expired.
 */

import { humanizeTronWireMessage } from '../../utils/hex'

/** Extra seconds beyond the node default (~60s). Total window ≈ 10 minutes. */
export const TRON_SIGN_EXPIRATION_EXTEND_SEC = 9 * 60

export function isTronTransactionExpiredError(err: unknown): boolean {
  const texts: string[] = []
  if (typeof err === 'string') texts.push(err)
  else if (err instanceof Error) texts.push(err.message)
  else if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    for (const k of ['message', 'msg', 'error', 'code'] as const) {
      if (typeof o[k] === 'string') texts.push(o[k] as string)
    }
  }
  for (const raw of texts) {
    const msg = humanizeTronWireMessage(raw)
    if (/transaction\s*expired/i.test(msg)) return true
    if (/TRANSACTION_EXPIRATION/i.test(msg)) return true
  }
  return false
}

type TronWebLike = {
  transactionBuilder?: {
    extendExpiration?: (tx: unknown, extensionSec: number) => Promise<unknown> | unknown
  }
}

/** Prefer TronWeb.extendExpiration so txID / raw_data_hex stay consistent. */
export async function extendUnsignedTronTxExpiration(
  tronWeb: TronWebLike,
  unsigned: unknown,
  extensionSec: number = TRON_SIGN_EXPIRATION_EXTEND_SEC,
): Promise<unknown> {
  if (!unsigned || typeof unsigned !== 'object') return unsigned
  const extend = tronWeb.transactionBuilder?.extendExpiration
  if (typeof extend !== 'function') return unsigned
  const sec = Math.floor(extensionSec)
  if (!(sec > 0)) return unsigned
  try {
    const next = await extend.call(tronWeb.transactionBuilder, unsigned, sec)
    return next ?? unsigned
  } catch {
    // Older injectors may lack / fail extend; sign the original ~60s window.
    return unsigned
  }
}
