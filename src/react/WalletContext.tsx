/**
 * React Context for Wallet SDK
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { WalletManager } from '../core/wallet-manager'
import { Account, WalletType, ConnectedWallet, ChainType } from '../core/types'

/**
 * Wallet Context Type
 */
export interface WalletContextValue {
  // State
  walletManager: WalletManager
  account: Account | null
  isConnected: boolean
  connectedWallets: ConnectedWallet[]
  isRestoring: boolean  // Whether connection is being restored

  // Methods
  connect: (type: WalletType, chainId?: number) => Promise<Account>
  connectAdditional: (type: WalletType, chainId?: number) => Promise<Account>
  disconnect: () => Promise<void>
  switchPrimaryWallet: (chainType: ChainType) => Promise<Account>
  signMessage: (message: string) => Promise<string>
  signTransaction: (transaction: any) => Promise<string>
}

/**
 * Wallet Context
 */
const WalletContext = createContext<WalletContextValue | null>(null)

/**
 * Wallet Provider Props
 */
export interface WalletProviderProps {
  children: ReactNode
  walletManager?: WalletManager
}

/**
 * Wallet Provider
 */
export function WalletProvider({ children, walletManager: externalWalletManager }: WalletProviderProps) {
  const [walletManager] = useState(() => externalWalletManager || new WalletManager())
  const [account, setAccount] = useState<Account | null>(null)
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([])
  const [isRestoring, setIsRestoring] = useState(true)

  // Update connected wallets list
  const updateConnectedWallets = useCallback(() => {
    setConnectedWallets(walletManager.getConnectedWallets())
  }, [walletManager])

  // Connect wallet
  const connect = useCallback(async (type: WalletType, chainId?: number) => {
    const account = await walletManager.connect(type, chainId)
    setAccount(account)
    updateConnectedWallets()
    return account
  }, [walletManager, updateConnectedWallets])

  // Connect additional wallet
  const connectAdditional = useCallback(async (type: WalletType, chainId?: number) => {
    const account = await walletManager.connectAdditional(type, chainId)
    updateConnectedWallets()
    return account
  }, [walletManager, updateConnectedWallets])

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    await walletManager.disconnect()
    setAccount(null)
    updateConnectedWallets()
  }, [walletManager, updateConnectedWallets])

  // Switch primary wallet
  const switchPrimaryWallet = useCallback(async (chainType: ChainType) => {
    const account = await walletManager.switchPrimaryWallet(chainType)
    setAccount(account)
    updateConnectedWallets()
    return account
  }, [walletManager, updateConnectedWallets])

  // Sign message
  const signMessage = useCallback(async (message: string) => {
    return walletManager.signMessage(message)
  }, [walletManager])

  // Sign transaction
  const signTransaction = useCallback(async (transaction: any) => {
    return walletManager.signTransaction(transaction)
  }, [walletManager])

  // Auto-restore connection (only on mount)
  useEffect(() => {
    const restoreConnection = async () => {
      try {
        // Try to restore connection from storage
        const restoredAccount = await walletManager.restoreFromStorage()
        if (restoredAccount) {
          setAccount(restoredAccount)
          updateConnectedWallets()
        }
      } catch (error) {
        console.debug('Failed to restore wallet connection:', error)
      } finally {
        setIsRestoring(false)
      }
    }

    restoreConnection()
  }, [walletManager, updateConnectedWallets])

  // Listen to events
  useEffect(() => {
    const handleAccountChanged = (newAccount: Account | null) => {
      setAccount(newAccount)
      updateConnectedWallets()
    }

    const handleChainChanged = (_chainId: number, newAccount: Account) => {
      setAccount(newAccount)
      updateConnectedWallets()
    }

    const handleDisconnected = () => {
      setAccount(null)
      updateConnectedWallets()
    }

    const handlePrimaryWalletSwitched = (newPrimary: Account) => {
      setAccount(newPrimary)
      updateConnectedWallets()
    }

    walletManager.on('accountChanged', handleAccountChanged)
    walletManager.on('chainChanged', handleChainChanged)
    walletManager.on('disconnected', handleDisconnected)
    walletManager.on('primaryWalletSwitched', handlePrimaryWalletSwitched)

    // Initialize account (if already connected)
    if (!isRestoring) {
      const primaryAccount = walletManager.getPrimaryAccount()
      if (primaryAccount) {
        setAccount(primaryAccount)
        updateConnectedWallets()
      }
    }

    return () => {
      walletManager.off('accountChanged', handleAccountChanged)
      walletManager.off('chainChanged', handleChainChanged)
      walletManager.off('disconnected', handleDisconnected)
      walletManager.off('primaryWalletSwitched', handlePrimaryWalletSwitched)
    }
  }, [walletManager, updateConnectedWallets, isRestoring])

  const value: WalletContextValue = {
    walletManager,
    account,
    isConnected: account !== null,
    connectedWallets,
    isRestoring,
    connect,
    connectAdditional,
    disconnect,
    switchPrimaryWallet,
    signMessage,
    signTransaction,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

/**
 * useWallet Hook
 */
export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

