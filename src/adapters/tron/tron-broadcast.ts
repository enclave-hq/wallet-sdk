import { isRateLimitError } from './rpc-gate'
import { walletErrorMessageFromEnvelope } from '../../utils/hex'

export function broadcastLooksRateLimited(broadcast: unknown, error?: unknown): boolean {
  if (error && isRateLimitError(error)) return true
  if (isRateLimitError(broadcast)) return true
  const text = typeof broadcast === 'string' ? broadcast : JSON.stringify(broadcast ?? '')
  return /429|too many requests|rate limit/i.test(text)
}

export function broadcastAlreadyInFlight(broadcast: unknown): boolean {
  const text = typeof broadcast === 'string' ? broadcast : JSON.stringify(broadcast ?? '')
  return /DUP_TRANSACTION|transaction already|already exists/i.test(text)
}

/**
 * TronLink's confirm popup already POSTs /wallet/broadcasttransaction.
 * Skip the immediate second shot; still publish if the tx never landed.
 */
export function skipWalletBroadcastAfterSign(args: {
  signedTxId?: string
  hasTronLink?: boolean
}): boolean {
  return Boolean((args.signedTxId || '').trim() && args.hasTronLink)
}

export function tronTxLooksOnChain(tx: unknown): boolean {
  if (!tx || typeof tx !== 'object') return false
  const rec = tx as { txID?: unknown; raw_data?: unknown; ret?: unknown }
  if (!rec.txID && !rec.raw_data && !rec.ret) return false
  return true
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function onChain(getTransaction: ((txId: string) => Promise<unknown>) | undefined, txId: string) {
  if (!getTransaction || !txId) return false
  try {
    return tronTxLooksOnChain(await getTransaction(txId))
  } catch {
    return false
  }
}

/** After TronLink sign: use the wallet broadcast if it landed, otherwise sendRaw once. */
export async function publishAfterTronLinkSign(args: {
  signedTxId: string
  hasTronLink: boolean
  getTransaction?: (txId: string) => Promise<unknown>
  sendRaw: () => Promise<unknown>
  waitMs?: number
}): Promise<string> {
  const signedTxId = args.signedTxId.trim()
  if (args.hasTronLink && signedTxId) {
    if ((args.waitMs ?? 0) > 0) await delay(args.waitMs ?? 0)
    if (await onChain(args.getTransaction, signedTxId)) return signedTxId
  }
  try {
    const broadcast = await args.sendRaw()
    const envelopeErr = walletErrorMessageFromEnvelope(broadcast)
    if (envelopeErr) throw new Error(envelopeErr)
    const id = resolveBroadcastTxId({ signedTxId, broadcast })
    if (id && !broadcastLooksRateLimited(broadcast)) return id
    if (await onChain(args.getTransaction, signedTxId)) return signedTxId
    if (id) return id
    throw new Error(
      broadcast && typeof broadcast === 'object' && 'message' in broadcast
        ? String((broadcast as { message?: unknown }).message ?? '')
        : 'TRON broadcast failed',
    )
  } catch (error) {
    if (await onChain(args.getTransaction, signedTxId)) return signedTxId
    if (signedTxId && broadcastAlreadyInFlight(error)) return signedTxId
    throw error
  }
}

export function detectTronLinkInjector(
  root: { tronLink?: unknown } | undefined =
    typeof globalThis !== 'undefined' ? (globalThis as { tronLink?: unknown }) : undefined,
): boolean {
  return Boolean(root?.tronLink)
}

/**
 * TronLink often broadcasts on `trx.sign`. Our follow-up `sendRawTransaction`
 * then 429s or DUP_TRANSACTION — if we already have txID, the tx is in-flight.
 */
function asBroadcast(raw: unknown): { result?: unknown; txid?: string; message?: string } | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as { result?: unknown; txid?: string; message?: string }
}

export function resolveBroadcastTxId(args: {
  signedTxId?: string
  broadcast?: unknown
  error?: unknown
}): string | null {
  const broadcast = asBroadcast(args.broadcast)
  const signed = (args.signedTxId || '').trim()
  const broadcastId = String(broadcast?.txid ?? '').trim()
  const ok = broadcast?.result === true || String(broadcast?.result ?? '') === 'true'
  if (ok) return signed || broadcastId || null
  if (
    signed &&
    (broadcastLooksRateLimited(args.broadcast, args.error) ||
      broadcastAlreadyInFlight(args.broadcast))
  ) {
    return signed
  }
  return null
}
