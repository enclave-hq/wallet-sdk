/**
 * Normalize TronLink authorize responses (legacy tron_requestAccounts + TIP-1102).
 *
 * Legacy codes: 200 ok · 4000 pending popup · 4001 user rejected · "" locked.
 * Modern eth_requestAccounts: address string[].
 */

export type TronAuthorizeInterpretation =
  | { kind: 'ok' }
  | { kind: 'rejected' }
  | { kind: 'locked' }
  | { kind: 'pending' }
  | { kind: 'unknown'; raw: unknown }

export function interpretTronAuthorizeResult(result: unknown): TronAuthorizeInterpretation {
  if (result === '' || result === null || result === undefined) {
    return { kind: 'locked' }
  }
  if (Array.isArray(result) && result.some((a) => typeof a === 'string' && a.trim())) {
    return { kind: 'ok' }
  }
  if (typeof result === 'object' && result !== null && 'code' in result) {
    const code = Number((result as { code: unknown }).code)
    if (code === 200) return { kind: 'ok' }
    if (code === 4001) return { kind: 'rejected' }
    if (code === 4000) return { kind: 'pending' }
  }
  return { kind: 'unknown', raw: result }
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === 'function'
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer != null) clearTimeout(timer)
  }
}
