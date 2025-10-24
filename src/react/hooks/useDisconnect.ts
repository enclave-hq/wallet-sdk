/**
 * useDisconnect Hook
 * 断开钱包连接
 */

import { useState } from 'react'
import { useWallet } from '../WalletContext'

export interface UseDisconnectResult {
  disconnect: () => Promise<void>
  isDisconnecting: boolean
  error: Error | null
}

/**
 * useDisconnect Hook
 */
export function useDisconnect(): UseDisconnectResult {
  const { disconnect: contextDisconnect } = useWallet()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const disconnect = async (): Promise<void> => {
    setIsDisconnecting(true)
    setError(null)

    try {
      await contextDisconnect()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      throw error
    } finally {
      setIsDisconnecting(false)
    }
  }

  return {
    disconnect,
    isDisconnecting,
    error,
  }
}


