/**
 * WalletConnect Tron Adapter
 * 
 * Uses @tronweb3/walletconnect-tron official package for TRON WalletConnect support
 */

import { WalletConnectWallet, WalletConnectChainID } from '@tronweb3/walletconnect-tron'
import { WalletAdapter } from '../base/wallet-adapter'
import {
  WalletType,
  ChainType,
  WalletState,
  Account,
  ContractReadParams,
  ContractWriteParams,
  TransactionReceipt,
} from '../../core/types'
import { createUniversalAddress } from '../../utils/address/universal-address'
import { 
  ConnectionRejectedError, 
  SignatureRejectedError, 
  ConfigurationError,
} from '../../core/errors'

/**
 * WalletConnect Tron Adapter
 * 
 * Uses the official @tronweb3/walletconnect-tron package for better compatibility
 */
export class WalletConnectTronAdapter extends WalletAdapter {
  readonly type = WalletType.WALLETCONNECT_TRON
  readonly chainType = ChainType.TRON
  readonly name = 'WalletConnect (Tron)'
  readonly icon = 'https://avatars.githubusercontent.com/u/37784886'

  private wallet: WalletConnectWallet | null = null
  private projectId: string
  private currentAddress: string | null = null

  // Tron 主网链 ID
  private static readonly TRON_MAINNET_CHAIN_ID = 195

  // Static wallet instance to avoid multiple initializations
  private static walletInstance: WalletConnectWallet | null = null
  private static walletProjectId: string | null = null

  constructor(projectId: string) {
    super()
    if (!projectId) {
      throw new ConfigurationError('WalletConnect projectId is required')
    }
    this.projectId = projectId
  }

  /**
   * Check if WalletConnect is available
   */
  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined'
  }

  /**
   * Restore session from existing wallet (for storage restoration)
   */
  async restoreSession(chainId?: number | number[]): Promise<Account | null> {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      // For restoreSession, use first chain ID if array is provided
      const targetChainId = Array.isArray(chainId) ? (chainId[0] || WalletConnectTronAdapter.TRON_MAINNET_CHAIN_ID) : (chainId || WalletConnectTronAdapter.TRON_MAINNET_CHAIN_ID)

      // Initialize wallet if not already initialized
      if (!WalletConnectTronAdapter.walletInstance || 
          WalletConnectTronAdapter.walletProjectId !== this.projectId) {
        this.initializeWallet()
      }

      this.wallet = WalletConnectTronAdapter.walletInstance

      if (!this.wallet) {
        return null
      }

      // Check if wallet is already connected
      const status = await this.wallet.checkConnectStatus()
      if (status && status.address) {
        this.currentAddress = status.address
        const account: Account = {
          universalAddress: createUniversalAddress(targetChainId, status.address),
          nativeAddress: status.address,
          chainId: targetChainId,
          chainType: ChainType.TRON,
          isActive: true,
        }
        this.setState(WalletState.CONNECTED)
        this.setAccount(account)
        this.setupEventListeners()
        return account
      }

      return null
    } catch (error) {
      console.debug('[WalletConnect Tron] Restore session failed:', error)
      return null
    }
  }

  /**
   * Initialize WalletConnect wallet instance
   */
  private initializeWallet(): void {
    if (WalletConnectTronAdapter.walletInstance && 
        WalletConnectTronAdapter.walletProjectId === this.projectId) {
      return
    }

    // Create new wallet instance
    WalletConnectTronAdapter.walletInstance = new WalletConnectWallet({
      network: WalletConnectChainID.Mainnet, // Use mainnet by default
      options: {
        projectId: this.projectId,
        metadata: {
          name: 'Enclave Wallet SDK',
          description: 'Multi-chain wallet adapter for Enclave',
          url: typeof window !== 'undefined' ? window.location.origin : '',
          icons: ['https://walletconnect.com/walletconnect-logo.svg'],
        },
      },
    })

    WalletConnectTronAdapter.walletProjectId = this.projectId
  }

  /**
   * Connect wallet
   */
  async connect(chainId?: number | number[]): Promise<Account> {
    if (typeof window === 'undefined') {
      throw new Error('WalletConnect requires a browser environment')
    }

    // Prevent multiple simultaneous connection attempts
    const currentState = this.state
    if (currentState === WalletState.CONNECTING) {
      console.warn('[WalletConnect Tron] Connection already in progress, waiting...')
      let attempts = 0
      while (this.state === WalletState.CONNECTING && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      if (this.state === WalletState.CONNECTED && this.currentAccount) {
        return this.currentAccount
      }
      if (this.state === WalletState.CONNECTING) {
        throw new Error('Connection timeout - previous connection attempt is still pending')
      }
    }

    // If already connected, return current account
    if (this.state === WalletState.CONNECTED && this.currentAccount) {
      return this.currentAccount
    }

    try {
      this.setState(WalletState.CONNECTING)

      // For WalletConnect Tron, use first chain ID if array is provided (single chain only)
      const targetChainId = Array.isArray(chainId) ? (chainId[0] || WalletConnectTronAdapter.TRON_MAINNET_CHAIN_ID) : (chainId || WalletConnectTronAdapter.TRON_MAINNET_CHAIN_ID)

      // Initialize wallet if needed
      if (!WalletConnectTronAdapter.walletInstance || 
          WalletConnectTronAdapter.walletProjectId !== this.projectId) {
        this.initializeWallet()
      }

      this.wallet = WalletConnectTronAdapter.walletInstance

      if (!this.wallet) {
        throw new Error('Failed to initialize WalletConnect wallet')
      }

      // Connect to wallet
      const { address } = await this.wallet.connect()

      if (!address) {
        throw new ConnectionRejectedError(this.type)
      }

      this.currentAddress = address

      // Create account info
      const account: Account = {
        universalAddress: createUniversalAddress(targetChainId, address),
        nativeAddress: address,
        chainId: targetChainId,
        chainType: ChainType.TRON,
        isActive: true,
      }

      this.setState(WalletState.CONNECTED)
      this.setAccount(account)
      this.setupEventListeners()

      return account
    } catch (error: any) {
      this.setState(WalletState.ERROR)
      this.setAccount(null)
      this.currentAddress = null

      if (error.message?.includes('rejected') || error.code === 4001) {
        throw new ConnectionRejectedError(this.type)
      }

      throw error
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    // Remove event listeners first
    this.removeEventListeners()

    // Disconnect wallet if exists
    if (this.wallet) {
      try {
        await this.wallet.disconnect()
      } catch (error) {
        console.warn('[WalletConnect Tron] Error during disconnect:', error)
      }
    }

    // Clean up instance state (but keep static wallet for reuse)
    this.wallet = null
    this.currentAddress = null
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
    this.emitDisconnected()
  }

  /**
   * Sign message
   */
  async signMessage(message: string): Promise<string> {
    this.ensureConnected()

    try {
      if (!this.wallet) {
        throw new Error('Wallet not initialized')
      }

      const signature = await this.wallet.signMessage(message)

      // Handle different response formats
      if (typeof signature === 'string') {
        return signature
      } else if (signature && typeof signature === 'object') {
        if ('signature' in signature) {
          return (signature as any).signature
        } else if ('result' in signature) {
          return (signature as any).result
        } else {
          return JSON.stringify(signature)
        }
      }

      throw new Error('Invalid signature format returned from wallet')
    } catch (error: any) {
      console.error('[WalletConnect Tron] Sign message error:', error)

      let errorMessage = 'Unknown error'
      if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.error?.message) {
        errorMessage = error.error.message
      } else {
        try {
          errorMessage = JSON.stringify(error)
        } catch {
          errorMessage = String(error)
        }
      }

      if (errorMessage?.includes('rejected') ||
          errorMessage?.includes('declined') ||
          errorMessage?.includes('User rejected') ||
          error?.code === 4001 ||
          error?.code === 'USER_REJECTED' ||
          error?.error?.code === 4001) {
        throw new SignatureRejectedError()
      }

      if (errorMessage?.includes('not supported') ||
          errorMessage?.includes('method not found') ||
          errorMessage?.includes('Method not found') ||
          error?.code === -32601 ||
          error?.error?.code === -32601) {
        throw new Error('tron_signMessage is not supported by the connected wallet. Please use TronLink extension instead.')
      }

      throw new Error(`WalletConnect Tron sign message failed: ${errorMessage}`)
    }
  }

  /**
   * Sign transaction
   * 
   * @param transaction - Tron transaction object (created via TronWeb API)
   * @returns Signed transaction object or signature
   */
  async signTransaction(transaction: any): Promise<string> {
    this.ensureConnected()

    try {
      if (!this.wallet) {
        throw new Error('Wallet not initialized')
      }

      if (!transaction) {
        throw new Error('Transaction object is required')
      }

      console.log('[WalletConnect Tron] Signing transaction:', {
        hasRawData: !!transaction.raw_data,
        hasRawDataHex: !!transaction.raw_data_hex,
        hasTxID: !!transaction.txID,
      })

      // Use official package's signTransaction method
      const result = await this.wallet.signTransaction(transaction)

      // Handle different response formats
      if (typeof result === 'string') {
        return result
      } else if (result && typeof result === 'object') {
        // If result is a signed transaction object, extract txID or return the object
        if ('txID' in result && typeof result.txID === 'string') {
          return result.txID
        } else if ('txid' in result && typeof result.txid === 'string') {
          return result.txid
        } else if ('signature' in result) {
          // Return the signed transaction object as JSON string
          return JSON.stringify(result)
        } else {
          // Return the full result as JSON string
          return JSON.stringify(result)
        }
      }

      throw new Error('Invalid signature format returned from wallet')
    } catch (error: any) {
      console.error('[WalletConnect Tron] Sign transaction error:', error)

      let errorMessage = 'Unknown error'
      if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.error?.message) {
        errorMessage = error.error.message
      } else if (error?.data?.message) {
        errorMessage = error.data.message
      } else {
        try {
          errorMessage = JSON.stringify(error)
        } catch {
          errorMessage = String(error)
        }
      }

      if (errorMessage?.includes('rejected') ||
          errorMessage?.includes('declined') ||
          errorMessage?.includes('User rejected') ||
          error?.code === 4001 ||
          error?.code === 'USER_REJECTED' ||
          error?.error?.code === 4001) {
        throw new SignatureRejectedError('Transaction signature was rejected by user')
      }

      if (errorMessage?.includes('not supported') ||
          errorMessage?.includes('method not found') ||
          errorMessage?.includes('Method not found') ||
          errorMessage?.includes('Not support') ||
          error?.code === -32601 ||
          error?.error?.code === -32601) {
        throw new Error('tron_signTransaction is not supported by the connected wallet. Please use TronLink extension instead.')
      }

      throw new Error(`WalletConnect Tron sign transaction failed: ${errorMessage}`)
    }
  }

  /**
   * Read contract (not supported by WalletConnect)
   */
  async readContract<T = any>(_params: ContractReadParams): Promise<T> {
    this.ensureConnected()
    throw new Error('WalletConnect Tron does not support direct contract reading. Please use TronLink extension or direct Tron RPC calls for read operations.')
  }

  /**
   * Write contract (not yet implemented)
   */
  async writeContract(_params: ContractWriteParams): Promise<string> {
    throw new Error('Contract write not yet implemented for WalletConnect Tron')
  }

  /**
   * Estimate gas (not yet implemented)
   */
  async estimateGas(_params: ContractWriteParams): Promise<bigint> {
    throw new Error('Gas estimation not yet implemented for WalletConnect Tron')
  }

  /**
   * Wait for transaction (not yet implemented)
   */
  async waitForTransaction(_txHash: string, _confirmations?: number): Promise<TransactionReceipt> {
    throw new Error('Transaction waiting not yet implemented for WalletConnect Tron')
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.wallet) {
      return
    }

    // Listen for account changes
    this.wallet.on('accountsChanged', (accounts: string[]) => {
      if (accounts && accounts.length > 0 && accounts[0] !== this.currentAddress) {
        const newAddress = accounts[0]
        this.currentAddress = newAddress
        if (this.currentAccount) {
          const newAccount: Account = {
            ...this.currentAccount,
            nativeAddress: newAddress,
            universalAddress: createUniversalAddress(this.currentAccount.chainId, newAddress),
          }
          this.setAccount(newAccount)
          this.emit('accountChanged', newAccount)
        }
      } else if (!accounts || accounts.length === 0) {
        // Accounts array is empty, meaning wallet disconnected
        this.disconnect()
      }
    })

    // Listen for disconnect
    this.wallet.on('disconnect', () => {
      this.disconnect()
    })
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    if (!this.wallet) {
      return
    }

    this.wallet.removeAllListeners('accountsChanged')
    this.wallet.removeAllListeners('disconnect')
  }

  /**
   * Get provider (returns wallet instance)
   */
  getProvider(): WalletConnectWallet | null {
    return this.wallet
  }

  /**
   * Clear static wallet instance (for complete cleanup)
   */
  static clearWalletInstance(): void {
    if (WalletConnectTronAdapter.walletInstance) {
      WalletConnectTronAdapter.walletInstance.disconnect().catch(() => {
        // Ignore errors
      })
      WalletConnectTronAdapter.walletInstance = null
      WalletConnectTronAdapter.walletProjectId = null
    }
  }
}
