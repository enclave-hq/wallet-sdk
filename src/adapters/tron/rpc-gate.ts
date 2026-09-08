/**
 * Process-wide serial RPC queue. Every chain RPC (TronGrid, EVM HTTP, …)
 * must go through {@link scheduleRpc} so callers never stampede the node.
 */

export const RPC_MIN_INTERVAL_MS = 1500
/** @deprecated Use {@link RPC_MIN_INTERVAL_MS} */
export const TRON_RPC_MIN_INTERVAL_MS = RPC_MIN_INTERVAL_MS

const WRAPPED = Symbol.for('enclave.tronRpcGate')

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number; response?: { status?: number } })?.status
    ?? (error as { response?: { status?: number } })?.response?.status
  if (status === 429) return true
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return /429|too many requests|rate limit/i.test(msg)
}

export class SerialRpcGate {
  private chain: Promise<void> = Promise.resolve()
  private nextAt = 0

  constructor(private readonly minIntervalMs: number) {}

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const wait = this.nextAt - Date.now()
      if (wait > 0) await delay(wait)
      let extra = this.minIntervalMs
      try {
        return await withRateLimitRetry(fn)
      } catch (error) {
        if (isRateLimitError(error)) extra = Math.max(extra, 4000)
        throw error
      } finally {
        this.nextAt = Date.now() + extra
      }
    })
    this.chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelayMs = 2000,
): Promise<T> {
  let backoff = initialDelayMs
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (!isRateLimitError(error) || i === retries) throw error
      await delay(backoff)
      backoff *= 2
    }
  }
  throw new Error('rate-limit retry exhausted')
}

/** One queue for the whole page — Tron and EVM share it. */
export const rpcGate = new SerialRpcGate(RPC_MIN_INTERVAL_MS)
/** @deprecated Use {@link rpcGate} / {@link scheduleRpc} */
export const tronRpcGate = rpcGate

/**
 * Library entry: enqueue one RPC round-trip and run it when the gate is free.
 * All frontend chain RPC must call this (or go through a wrapper that does).
 */
export function scheduleRpc<T>(work: () => Promise<T>): Promise<T> {
  return rpcGate.schedule(work)
}

function wrapFn(target: object | null | undefined, key: string): void {
  if (!target) return
  const rec = target as Record<string, unknown>
  const orig = rec[key]
  if (typeof orig !== 'function') return
  const fn = orig as ((...args: unknown[]) => unknown) & { [WRAPPED]?: boolean }
  if (fn[WRAPPED]) return
  const gated = function gatedRpc(this: unknown, ...args: unknown[]) {
    return scheduleRpc(() => Promise.resolve(fn.apply(this, args)))
  }
  gated[WRAPPED] = true
  rec[key] = gated
}

/**
 * Serialize TronWeb HTTP (fullNode / solidityNode). Falls back to trx / builder
 * methods when node.request is not exposed (some TronLink builds).
 */
export function throttleTronWeb<T>(tronWeb: T): T {
  const tw = tronWeb as T & { [WRAPPED]?: boolean } & {
    fullNode?: { request?: unknown }
    solidityNode?: { request?: unknown }
    eventServer?: { request?: unknown }
    trx?: object
    transactionBuilder?: object
  }
  if (!tw || tw[WRAPPED]) return tronWeb

  const nodes = [tw.fullNode, tw.solidityNode, tw.eventServer]
  let wrappedNode = false
  for (const node of nodes) {
    if (node && typeof node.request === 'function') {
      wrapFn(node, 'request')
      wrappedNode = true
    }
  }
  if (!wrappedNode) {
    wrapFn(tw.trx, 'getTransactionInfo')
    wrapFn(tw.trx, 'getTransaction')
    wrapFn(tw.trx, 'getConfirmedTransaction')
    wrapFn(tw.trx, 'getBalance')
    wrapFn(tw.transactionBuilder, 'triggerSmartContract')
    wrapFn(tw.transactionBuilder, 'triggerConstantContract')
    wrapFn(tw.transactionBuilder, 'sendTrx')
  }

  tw[WRAPPED] = true
  return tronWeb
}
