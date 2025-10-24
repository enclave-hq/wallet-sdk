/**
 * useSignTransaction Hook
 * 签名交易
 */

import { useState } from 'react'
import { useWallet } from '../WalletContext'

export interface UseSignTransactionResult {
  signTransaction: (transaction: any) => Promise<string>
  isSigning: boolean
  error: Error | null
}

/**
 * useSignTransaction Hook
 */
export function useSignTransaction(): UseSignTransactionResult {
  const { signTransaction: contextSignTransaction } = useWallet()
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const signTransaction = async (transaction: any): Promise<string> => {
    setIsSigning(true)
    setError(null)

    try {
      const signature = await contextSignTransaction(transaction)
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
    signTransaction,
    isSigning,
    error,
  }
}


