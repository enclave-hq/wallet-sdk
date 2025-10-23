/**
 * useSignMessage Hook
 * 签名消息
 */

import { useState } from 'react'
import { useWallet } from '../WalletContext'

export interface UseSignMessageResult {
  signMessage: (message: string) => Promise<string>
  isSigning: boolean
  error: Error | null
}

/**
 * useSignMessage Hook
 */
export function useSignMessage(): UseSignMessageResult {
  const { signMessage: contextSignMessage } = useWallet()
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const signMessage = async (message: string): Promise<string> => {
    setIsSigning(true)
    setError(null)

    try {
      const signature = await contextSignMessage(message)
      return signature
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      throw error
    } finally {
      setIsSigning(false)
    }
  }

  return {
    signMessage,
    isSigning,
    error,
  }
}

