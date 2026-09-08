/** TronGrid / TronWeb getTransactionInfo payload (fields we actually read). */
export type TronTxInfoLike = {
  id?: string
  blockNumber?: number
  blockHash?: string
  contract_address?: string
  receipt?: { result?: string; energy_usage_total?: number }
  log?: unknown[]
}

export type TronTxLike = {
  txID?: string
  ret?: Array<{ contractRet?: string }>
}

/** Empty `{}` means solidity node has not indexed the tx yet. */
export function tronInfoLooksReady(info: TronTxInfoLike | null | undefined): boolean {
  if (!info || typeof info !== 'object') return false
  if (typeof info.id === 'string' && info.id.length > 0) return true
  if (typeof info.blockNumber === 'number' && info.blockNumber > 0) return true
  if (info.receipt?.result) return true
  return false
}

export function tronInfoFailed(info: TronTxInfoLike): boolean {
  const r = info.receipt?.result
  if (!r) return false
  return r !== 'SUCCESS'
}

export function tronTxContractRet(tx: TronTxLike | null | undefined): string | undefined {
  const ret = tx?.ret?.[0]?.contractRet
  return typeof ret === 'string' && ret.length > 0 ? ret : undefined
}
