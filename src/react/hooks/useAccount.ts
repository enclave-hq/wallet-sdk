/**
 * useAccount Hook
 * 获取当前账户信息
 */

import { useWallet } from '../WalletContext'
import { Account } from '../../core/types'

export interface UseAccountResult {
  account: Account | null
  isConnected: boolean
  address: string | null
  chainId: number | null
  universalAddress: string | null
}

/**
 * useAccount Hook
 */
export function useAccount(): UseAccountResult {
  const { account, isConnected } = useWallet()

  return {
    account,
    isConnected,
    address: account?.nativeAddress || null,
    chainId: account?.chainId || null,
    universalAddress: account?.universalAddress || null,
  }
}

