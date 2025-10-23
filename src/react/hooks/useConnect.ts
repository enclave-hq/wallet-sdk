/**
 * useConnect Hook
 * 连接钱包
 */

import { useState } from 'react'
import { useWallet } from '../WalletContext'
import { WalletType, Account } from '../../core/types'

export interface UseConnectResult {
  connect: (type: WalletType, chainId?: number) => Promise<Account>
  connectAdditional: (type: WalletType, chainId?: number) => Promise<Account>
  isConnecting: boolean
  error: Error | null
}

/**
 * useConnect Hook
 */
export function useConnect(): UseConnectResult {
  const { connect: contextConnect, connectAdditional: contextConnectAdditional } = useWallet()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const connect = async (type: WalletType, chainId?: number): Promise<Account> => {
    setIsConnecting(true)
    setError(null)

    try {
      const account = await contextConnect(type, chainId)
      return account
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const connectAdditional = async (type: WalletType, chainId?: number): Promise<Account> => {
    setIsConnecting(true)
    setError(null)

    try {
      const account = await contextConnectAdditional(type, chainId)
      return account
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  return {
    connect,
    connectAdditional,
    isConnecting,
    error,
  }
}

