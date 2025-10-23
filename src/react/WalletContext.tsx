/**
 * React Context for Wallet SDK
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { WalletManager } from '../core/wallet-manager'
import { Account, WalletType, ConnectedWallet, ChainType } from '../core/types'

/**
 * Wallet Context 类型
 */
export interface WalletContextValue {
  // 状态
  walletManager: WalletManager
  account: Account | null
  isConnected: boolean
  connectedWallets: ConnectedWallet[]

  // 方法
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

  // 更新连接的钱包列表
  const updateConnectedWallets = useCallback(() => {
    setConnectedWallets(walletManager.getConnectedWallets())
  }, [walletManager])

  // 连接钱包
  const connect = useCallback(async (type: WalletType, chainId?: number) => {
    const account = await walletManager.connect(type, chainId)
    setAccount(account)
    updateConnectedWallets()
    return account
  }, [walletManager, updateConnectedWallets])

  // 连接额外的钱包
  const connectAdditional = useCallback(async (type: WalletType, chainId?: number) => {
    const account = await walletManager.connectAdditional(type, chainId)
    updateConnectedWallets()
    return account
  }, [walletManager, updateConnectedWallets])

  // 断开连接
  const disconnect = useCallback(async () => {
    await walletManager.disconnect()
    setAccount(null)
    updateConnectedWallets()
  }, [walletManager, updateConnectedWallets])

  // 切换主钱包
  const switchPrimaryWallet = useCallback(async (chainType: ChainType) => {
    const account = await walletManager.switchPrimaryWallet(chainType)
    setAccount(account)
    updateConnectedWallets()
    return account
  }, [walletManager, updateConnectedWallets])

  // 签名消息
  const signMessage = useCallback(async (message: string) => {
    return walletManager.signMessage(message)
  }, [walletManager])

  // 签名交易
  const signTransaction = useCallback(async (transaction: any) => {
    return walletManager.signTransaction(transaction)
  }, [walletManager])

  // 监听事件
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

    // 初始化账户
    setAccount(walletManager.getPrimaryAccount())
    updateConnectedWallets()

    return () => {
      walletManager.off('accountChanged', handleAccountChanged)
      walletManager.off('chainChanged', handleChainChanged)
      walletManager.off('disconnected', handleDisconnected)
      walletManager.off('primaryWalletSwitched', handlePrimaryWalletSwitched)
    }
  }, [walletManager, updateConnectedWallets])

  const value: WalletContextValue = {
    walletManager,
    account,
    isConnected: account !== null,
    connectedWallets,
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

