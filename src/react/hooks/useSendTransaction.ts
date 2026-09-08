/**
 * useSendTransaction Hook
 * 发送交易（钱包广播）
 */

import { useState } from 'react'
import { useWallet } from '../WalletContext'

export interface UseSendTransactionResult {
  sendTransaction: (transaction: any) => Promise<string>
  isSending: boolean
  error: Error | null
}

/**
 * useSendTransaction Hook
 */
export function useSendTransaction(): UseSendTransactionResult {
  const { sendTransaction: contextSendTransaction } = useWallet()
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const sendTransaction = async (transaction: any): Promise<string> => {
    setIsSending(true)
    setError(null)

    try {
      const hash = await contextSendTransaction(transaction)
      return hash
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      throw error
    } finally {
      setIsSending(false)
    }
  }

  return {
    sendTransaction,
    isSending,
    error,
  }
}
