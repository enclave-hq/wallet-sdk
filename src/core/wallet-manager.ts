/**
 * Wallet Manager (Core)
 */

import { TypedEventEmitter } from './events'
import { AdapterRegistry } from './adapter-registry'
import {
  Account,
  ChainType,
  WalletType,
  IWalletAdapter,
  WalletManagerConfig,
  WalletManagerEvents,
  ConnectedWallet,
  StorageData,
  WalletHistoryRecord,
  TransactionReceipt,
  AddChainParams,
} from './types'
import {
  WalletNotConnectedError,
  WalletNotAvailableError,
} from './errors'
import { EVMPrivateKeyAdapter } from '../adapters/evm/private-key'
import { QRCodeSigner } from '../utils/qrcode-signer'
import type { QRCodeSignerConfig } from '../utils/qrcode-signer'

/**
 * Wallet Manager
 */
export class WalletManager extends TypedEventEmitter<WalletManagerEvents> {
  private config: Required<WalletManagerConfig>
  private registry: AdapterRegistry

  // Primary wallet
  private primaryWallet: IWalletAdapter | null = null

  // Connected wallet pool
  private connectedWallets: Map<ChainType, IWalletAdapter> = new Map()

  constructor(config: WalletManagerConfig = {}) {
    super()

    this.config = {
      enableStorage: config.enableStorage ?? true,
      storagePrefix: config.storagePrefix ?? 'enclave_wallet_',
      defaultChainId: config.defaultChainId ?? 1,
      defaultTronChainId: config.defaultTronChainId ?? 195,
      walletConnectProjectId: config.walletConnectProjectId ?? '',
    }

    this.registry = new AdapterRegistry(this.config)

    // Note: No longer auto-restoring connection in constructor
    // Async operations should be handled in WalletProvider by calling restoreFromStorage()
  }

  // ===== Connection Management =====

  /**
   * Check if adapter is registered for a wallet type
   */
  hasAdapter(type: WalletType): boolean {
    return this.registry.has(type)
  }

  /**
   * Connect primary wallet
   */
  async connect(type: WalletType, chainId?: number | number[]): Promise<Account> {
    const adapter = this.registry.getAdapter(type)
    if (!adapter) {
      throw new WalletNotAvailableError(type)
    }

    // Check if available
    const isAvailable = await adapter.isAvailable()
    if (!isAvailable) {
      throw new WalletNotAvailableError(type)
    }

    // Connect wallet
    const account = await adapter.connect(chainId)

    // Set as primary wallet
    this.setPrimaryWallet(adapter)

    // Add to connected wallet pool
    this.connectedWallets.set(adapter.chainType, adapter)

    // Setup event listeners
    this.setupAdapterListeners(adapter, true)

    // Save to storage
    if (this.config.enableStorage) {
      this.saveToStorage()
    }

    return account
  }

  /**
   * Connect additional wallet (without changing primary wallet)
   */
  async connectAdditional(type: WalletType, chainId?: number | number[]): Promise<Account> {
    const adapter = this.registry.getAdapter(type)
    if (!adapter) {
      throw new WalletNotAvailableError(type)
    }

    const isAvailable = await adapter.isAvailable()
    if (!isAvailable) {
      throw new WalletNotAvailableError(type)
    }

    // Support both single chain ID and array of chain IDs for multi-chain support
    const account = await adapter.connect(chainId)

    // Add to connected wallet pool (without setting as primary)
    this.connectedWallets.set(adapter.chainType, adapter)

    // Setup event listeners
    this.setupAdapterListeners(adapter, false)

    if (this.config.enableStorage) {
      this.saveToStorage()
    }

    return account
  }

  /**
   * Connect with private key (for development/testing only)
   */
  async connectWithPrivateKey(privateKey: string, chainId?: number): Promise<Account> {
    const adapter = new EVMPrivateKeyAdapter()
    adapter.setPrivateKey(privateKey)

    const account = await adapter.connect(chainId || this.config.defaultChainId)

    this.setPrimaryWallet(adapter)
    this.connectedWallets.set(adapter.chainType, adapter)
    this.setupAdapterListeners(adapter, true)

    return account
  }

  /**
   * Disconnect primary wallet
   */
  async disconnect(): Promise<void> {
    if (!this.primaryWallet) {
      return
    }

    // Save chainType first, as it may be cleared after disconnect()
    const chainType = this.primaryWallet.chainType

    await this.primaryWallet.disconnect()

    // Remove listeners
    this.removeAdapterListeners(this.primaryWallet)

    // Remove from connected wallet pool
    this.connectedWallets.delete(chainType)

    this.primaryWallet = null

    // Clear storage when disconnecting (important: prevents auto-restore on page reload)
    // This ensures that if user explicitly disconnects, the connection won't be restored automatically
    if (this.config.enableStorage) {
      this.clearStorage()
    }

    this.emit('disconnected')
  }

  /**
   * Disconnect all wallets
   */
  async disconnectAll(): Promise<void> {
    const wallets = Array.from(this.connectedWallets.values())

    for (const wallet of wallets) {
      await wallet.disconnect()
      this.removeAdapterListeners(wallet)
    }

    this.primaryWallet = null
    this.connectedWallets.clear()

    if (this.config.enableStorage) {
      this.clearStorage()
    }

    this.emit('disconnected')
  }

  // ===== Primary Wallet Management =====

  /**
   * Switch primary wallet
   */
  async switchPrimaryWallet(chainType: ChainType): Promise<Account> {
    const adapter = this.connectedWallets.get(chainType)
    if (!adapter || !adapter.currentAccount) {
      throw new WalletNotConnectedError(`Wallet for chain type ${chainType} not connected`)
    }

    const oldPrimary = this.primaryWallet?.currentAccount || null

    // Remove listeners from old primary wallet
    if (this.primaryWallet) {
      this.removeAdapterListeners(this.primaryWallet)
    }

    // Set new primary wallet
    this.setPrimaryWallet(adapter)

    // Setup listeners for new primary wallet
    this.setupAdapterListeners(adapter, true)

    if (this.config.enableStorage) {
      this.saveToStorage()
    }

    this.emit('primaryWalletSwitched', adapter.currentAccount, oldPrimary, chainType)

    return adapter.currentAccount
  }

  /**
   * Get primary wallet account
   */
  getPrimaryAccount(): Account | null {
    return this.primaryWallet?.currentAccount || null
  }

  /**
   * Get all connected wallets
   */
  getConnectedWallets(): ConnectedWallet[] {
    return Array.from(this.connectedWallets.values()).map(adapter => ({
      account: adapter.currentAccount!,
      walletType: adapter.type,
      chainType: adapter.chainType,
      isPrimary: adapter === this.primaryWallet,
      canSwitchChain: this.canSwitchChain(adapter),
      adapter,
    }))
  }

  /**
   * Get wallet by chain type
   */
  getWalletByChainType(chainType: ChainType): IWalletAdapter | null {
    return this.connectedWallets.get(chainType) || null
  }

  // ===== Signing =====

  /**
   * Sign message with primary wallet
   */
  async signMessage(message: string): Promise<string> {
    if (!this.primaryWallet) {
      throw new WalletNotConnectedError()
    }

    return this.primaryWallet.signMessage(message)
  }

  /**
   * Sign message with wallet of specified chain type
   */
  async signMessageWithChainType(message: string, chainType?: ChainType): Promise<string> {
    if (!chainType) {
      return this.signMessage(message)
    }

    const adapter = this.connectedWallets.get(chainType)
    if (!adapter) {
      throw new WalletNotConnectedError(`Wallet for chain type ${chainType}`)
    }

    return adapter.signMessage(message)
  }

  /**
   * Create QR code signer for message signing
   * 
   * This method creates a QR code signer that can be used to display a QR code
   * for users to scan with their wallet app to sign a message.
   * 
   * @param message - Message to sign
   * @param config - QR code signer configuration
   * @returns QRCodeSigner instance
   * 
   * @example
   * ```typescript
   * const signer = walletManager.createQRCodeSigner('Hello World', {
   *   requestId: 'sign-123',
   *   requestUrl: 'https://example.com/sign?requestId=sign-123&message=Hello%20World',
   *   pollUrl: 'https://api.example.com/sign/status',
   * })
   * 
   * const qrCodeUrl = await signer.generateQRCode()
   * const signature = await signer.startPolling()
   * ```
   */
  createQRCodeSigner(
    message: string,
    config: Omit<QRCodeSignerConfig, 'requestId' | 'requestUrl'> & {
      requestId: string
      requestUrl: string
    }
  ): QRCodeSigner {
    return new QRCodeSigner({
      ...config,
      // Encode message in request URL if not already encoded
      requestUrl: config.requestUrl.includes(encodeURIComponent(message))
        ? config.requestUrl
        : `${config.requestUrl}${config.requestUrl.includes('?') ? '&' : '?'}message=${encodeURIComponent(message)}`,
    })
  }

  /**
   * Sign TypedData (EVM only)
   */
  async signTypedData(typedData: any, chainType?: ChainType): Promise<string> {
    const adapter = chainType
      ? this.connectedWallets.get(chainType)
      : this.primaryWallet

    if (!adapter) {
      throw new WalletNotConnectedError()
    }

    if (!adapter.signTypedData) {
      throw new Error(`signTypedData not supported by ${adapter.type}`)
    }

    return adapter.signTypedData(typedData)
  }

  /**
   * Sign transaction (with primary wallet)
   */
  async signTransaction(transaction: any): Promise<string> {
    if (!this.primaryWallet) {
      throw new WalletNotConnectedError()
    }

    if (!this.primaryWallet.signTransaction) {
      throw new Error(`signTransaction not supported by ${this.primaryWallet.type}`)
    }

    return this.primaryWallet.signTransaction(transaction)
  }

  /**
   * Sign transaction with wallet of specified chain type
   */
  async signTransactionWithChainType(transaction: any, chainType?: ChainType): Promise<string> {
    if (!chainType) {
      return this.signTransaction(transaction)
    }

    const adapter = this.connectedWallets.get(chainType)
    if (!adapter) {
      throw new WalletNotConnectedError(`Wallet for chain type ${chainType}`)
    }

    if (!adapter.signTransaction) {
      throw new Error(`signTransaction not supported by ${adapter.type}`)
    }

    return adapter.signTransaction(transaction)
  }

  // ===== Chain Switching =====

  /**
   * Request chain switch (EVM only)
   */
  async requestSwitchChain(chainId: number, options?: {
    addChainIfNotExists?: boolean
    chainConfig?: AddChainParams
  }): Promise<Account> {
    if (!this.primaryWallet) {
      throw new WalletNotConnectedError()
    }

    if (!this.primaryWallet.switchChain) {
      throw new Error(`Chain switching not supported by ${this.primaryWallet.type}`)
    }

    try {
      await this.primaryWallet.switchChain(chainId)
      return this.primaryWallet.currentAccount!
    } catch (error: any) {
      // If chain doesn't exist and auto-add is configured
      if (options?.addChainIfNotExists && options.chainConfig && this.primaryWallet.addChain) {
        await this.primaryWallet.addChain(options.chainConfig)
        await this.primaryWallet.switchChain(chainId)
        return this.primaryWallet.currentAccount!
      }
      throw error
    }
  }

  /**
   * Request account switch (opens wallet account selector)
   * @param targetAddress Optional target address to verify after switching
   * @returns The new account after switching
   */
  async requestSwitchAccount(targetAddress?: string): Promise<Account> {
    if (!this.primaryWallet) {
      throw new WalletNotConnectedError()
    }

    if (!this.primaryWallet.requestSwitchAccount) {
      throw new Error(`Account switching not supported by ${this.primaryWallet.type}`)
    }

    const account = await this.primaryWallet.requestSwitchAccount(targetAddress)
    
    // Save to storage after account switch
    if (this.config.enableStorage) {
      this.saveToStorage()
    }

    return account
  }

  /**
   * Ensure the current account matches the target address
   * If not matching, request account switch
   * @param targetAddress The address that should be active
   * @returns The account (either existing or after switch)
   */
  async ensureAccount(targetAddress: string): Promise<Account> {
    const currentAccount = this.getPrimaryAccount()
    
    if (!currentAccount) {
      throw new WalletNotConnectedError()
    }

    // Check if current account matches target
    if (currentAccount.nativeAddress.toLowerCase() === targetAddress.toLowerCase()) {
      return currentAccount
    }

    // Need to switch account
    console.log(`[WalletManager] Current account ${currentAccount.nativeAddress} doesn't match target ${targetAddress}, requesting switch...`)
    return this.requestSwitchAccount(targetAddress)
  }

  // ===== Contract Calls =====

  /**
   * Read contract
   */
  async readContract<T = any>(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    chainType?: ChainType
  ): Promise<T> {
    const adapter = chainType
      ? this.connectedWallets.get(chainType)
      : this.primaryWallet

    if (!adapter) {
      throw new WalletNotConnectedError()
    }

    if (!adapter.readContract) {
      throw new Error(`readContract not supported by ${adapter.type}`)
    }

    return adapter.readContract({ address, abi, functionName, args })
  }

  /**
   * Write contract
   */
  async writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    options?: {
      value?: string
      gas?: number
      gasPrice?: string  // Legacy gas price (for pre-EIP-1559 networks)
      maxFeePerGas?: string  // EIP-1559: Maximum fee per gas (in wei)
      maxPriorityFeePerGas?: string  // EIP-1559: Maximum priority fee per gas (in wei)
    },
    chainType?: ChainType
  ): Promise<string> {
    const adapter = chainType
      ? this.connectedWallets.get(chainType)
      : this.primaryWallet

    if (!adapter) {
      throw new WalletNotConnectedError()
    }

    if (!adapter.writeContract) {
      throw new Error(`writeContract not supported by ${adapter.type}`)
    }

    return adapter.writeContract({
      address,
      abi,
      functionName,
      args,
      ...options,
    })
  }

  /**
   * Estimate gas
   */
  async estimateGas(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    chainType?: ChainType
  ): Promise<bigint> {
    const adapter = chainType
      ? this.connectedWallets.get(chainType)
      : this.primaryWallet

    if (!adapter) {
      throw new WalletNotConnectedError()
    }

    if (!adapter.estimateGas) {
      throw new Error(`estimateGas not supported by ${adapter.type}`)
    }

    return adapter.estimateGas({ address, abi, functionName, args })
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string,
    confirmations?: number,
    chainType?: ChainType
  ): Promise<TransactionReceipt> {
    const adapter = chainType
      ? this.connectedWallets.get(chainType)
      : this.primaryWallet

    if (!adapter) {
      throw new WalletNotConnectedError()
    }

    if (!adapter.waitForTransaction) {
      throw new Error(`waitForTransaction not supported by ${adapter.type}`)
    }

    return adapter.waitForTransaction(txHash, confirmations)
  }

  // ===== Provider Access =====

  /**
   * Get primary wallet Provider
   */
  getProvider(): any {
    if (!this.primaryWallet) {
      throw new WalletNotConnectedError()
    }

    return this.primaryWallet.getProvider()
  }

  /**
   * Get Provider by chain type
   */
  getProviderByChainType(chainType: ChainType): any {
    const adapter = this.connectedWallets.get(chainType)
    if (!adapter) {
      throw new WalletNotConnectedError(`Wallet for chain type ${chainType}`)
    }

    return adapter.getProvider()
  }

  // ===== Private Methods =====

  /**
   * Set primary wallet
   */
  private setPrimaryWallet(adapter: IWalletAdapter): void {
    this.primaryWallet = adapter
  }

  /**
   * Check if wallet supports chain switching
   */
  private canSwitchChain(adapter: IWalletAdapter): boolean {
    return !!adapter.switchChain
  }

  /**
   * Setup adapter event listeners
   */
  private setupAdapterListeners(adapter: IWalletAdapter, isPrimary: boolean): void {
    adapter.on('accountChanged', (account: Account | null) => {
      if (isPrimary) {
        this.emit('accountChanged', account)
      }
      this.emit('walletAccountChanged', adapter.chainType, account, isPrimary)

      if (this.config.enableStorage) {
        this.saveToStorage()
      }
    })

    adapter.on('chainChanged', (chainId: number) => {
      if (isPrimary && adapter.currentAccount) {
        this.emit('chainChanged', chainId, adapter.currentAccount)
      }
      if (adapter.currentAccount) {
        this.emit('walletChainChanged', adapter.chainType, chainId, adapter.currentAccount, isPrimary)
      }

      if (this.config.enableStorage) {
        this.saveToStorage()
      }
    })

    adapter.on('disconnected', () => {
      if (isPrimary) {
        this.emit('disconnected')
      }
      this.emit('walletDisconnected', adapter.chainType, isPrimary)

      this.connectedWallets.delete(adapter.chainType)

      if (adapter === this.primaryWallet) {
        this.primaryWallet = null
      }

      if (this.config.enableStorage) {
        this.saveToStorage()
      }
    })

    adapter.on('error', (error: Error) => {
      this.emit('error', error)
    })
  }

  /**
   * Remove adapter event listeners
   */
  private removeAdapterListeners(adapter: IWalletAdapter | null): void {
    if (!adapter) return
    adapter.removeAllListeners()
  }

  // ===== Storage =====

  /**
   * Save to storage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined' || !this.config.enableStorage) {
      return
    }

    const data: StorageData = {
      current: this.primaryWallet?.currentAccount?.universalAddress || null,
      primaryWalletType: this.primaryWallet?.type,
      primaryChainId: this.primaryWallet?.currentAccount?.chainId,
      history: this.getHistoryRecords(),
    }

    try {
      localStorage.setItem(
        `${this.config.storagePrefix}data`,
        JSON.stringify(data)
      )
    } catch (error) {
      console.error('Failed to save wallet data to storage:', error)
    }
  }

  /**
   * Restore from storage
   * Returns a Promise that can be used for auto-reconnection
   */
  async restoreFromStorage(): Promise<Account | null> {
    if (typeof window === 'undefined' || !this.config.enableStorage) {
      return null
    }

    try {
      const stored = localStorage.getItem(`${this.config.storagePrefix}data`)
      if (!stored) {
        console.debug('[WalletManager] No stored wallet data found')
        return null
      }

      const data: StorageData = JSON.parse(stored)
      console.debug('[WalletManager] Restoring from storage:', data)
      
      // Cannot restore if primary wallet info is missing
      if (!data.primaryWalletType || !data.current) {
        console.debug('[WalletManager] Missing primary wallet info in storage')
        return null
      }

      // Get adapter
      const adapter = this.registry.getAdapter(data.primaryWalletType)
      if (!adapter) {
        console.debug('[WalletManager] Adapter not found for type:', data.primaryWalletType)
        return null
      }

      // Check if wallet is available
      const isAvailable = await adapter.isAvailable()
      if (!isAvailable) {
        console.debug('[WalletManager] Wallet not available:', data.primaryWalletType)
        return null
      }

      console.debug('[WalletManager] Wallet is available, attempting restoration')

      // For browser wallets (e.g., MetaMask), try to silently get authorized accounts first
      if (adapter.chainType === ChainType.EVM && data.primaryWalletType === WalletType.METAMASK) {
        try {
          // Try to silently get authorized accounts (no popup)
          const provider = typeof window !== 'undefined' ? (window as any).ethereum : null
          if (provider) {
            const accounts = await provider.request({
              method: 'eth_accounts',
            })

            console.debug('[WalletManager] Checking authorized accounts:', accounts)

            if (accounts && accounts.length > 0) {
              // Check if account matches saved address
              const savedAddress = data.current.split(':')[1] // Extract address from universalAddress
              const currentAddress = accounts[0].toLowerCase()
              
              console.debug('[WalletManager] Comparing addresses - saved:', savedAddress, 'current:', currentAddress)
              
              if (currentAddress === savedAddress.toLowerCase()) {
                // Authorized account found and address matches, call connect directly
                // If account is already authorized, eth_requestAccounts should not popup
                console.debug('[WalletManager] Address matches, attempting connect (should be silent if already authorized)')
                try {
                  const account = await adapter.connect(data.primaryChainId)
                  
                  // Set as primary wallet and setup listeners
                  this.setPrimaryWallet(adapter)
                  this.connectedWallets.set(adapter.chainType, adapter)
                  this.setupAdapterListeners(adapter, true)
                  this.emit('accountChanged', account)
                  
                  console.debug('[WalletManager] Connect successful')
                  return account
                } catch (connectError: any) {
                  // If connection fails (might be user rejection), fail silently
                  console.debug('[WalletManager] Connect failed (might be user rejection):', connectError?.message)
                  return null
                }
              } else {
                console.debug('[WalletManager] Address mismatch, will try normal connect')
              }
            } else {
              console.debug('[WalletManager] No authorized accounts found')
            }
          }
        } catch (silentError) {
          // Silent connection failed, continue with normal connection
          console.debug('Silent connection failed, trying normal connection:', silentError)
        }
      }

      // For TronLink, similar handling
      if (adapter.chainType === ChainType.TRON && data.primaryWalletType === WalletType.TRONLINK) {
        try {
          const tronWeb = (adapter as any).getTronWeb?.()
          if (tronWeb && tronWeb.defaultAddress?.base58) {
            // TronLink is authorized, connect directly
            const account = await adapter.connect(data.primaryChainId)
            
            // Set as primary wallet
            this.setPrimaryWallet(adapter)
            this.connectedWallets.set(adapter.chainType, adapter)
            this.setupAdapterListeners(adapter, true)
            this.emit('accountChanged', account)
            
            return account
          }
        } catch (silentError) {
          console.debug('Silent TronLink connection failed:', silentError)
        }
      }

      // For WalletConnect Tron, use restoreSession method to avoid re-initialization
      if (data.primaryWalletType === WalletType.WALLETCONNECT_TRON) {
        try {
          // Use restoreSession method which initializes provider once and checks for existing session
          const wcAdapter = adapter as any
          if (typeof wcAdapter.restoreSession === 'function') {
            console.debug('[WalletManager] Attempting to restore WalletConnect Tron session...')
            const account = await wcAdapter.restoreSession(data.primaryChainId)
            
            if (account) {
              // Session restored successfully
              console.debug('[WalletManager] WalletConnect Tron session restored successfully')
              
              // Set as primary wallet
              this.setPrimaryWallet(adapter)
              this.connectedWallets.set(adapter.chainType, adapter)
              this.setupAdapterListeners(adapter, true)
              this.emit('accountChanged', account)
              
              return account
            } else {
              console.debug('[WalletManager] No valid WalletConnect Tron session found')
              // No valid session found - don't try to connect again as it will cause duplicate initialization
              // Just return null to indicate restoration failed
              return null
            }
          }
        } catch (restoreError) {
          console.debug('[WalletManager] WalletConnect Tron restore failed:', restoreError)
          // Don't try to connect again - restoration failed, user needs to manually connect
          return null
        }
      }

      // Try normal connection (may popup) - only for non-WalletConnect Tron wallets
      const account = await adapter.connect(data.primaryChainId)

      // Set as primary wallet
      this.setPrimaryWallet(adapter)
      this.connectedWallets.set(adapter.chainType, adapter)
      this.setupAdapterListeners(adapter, true)

      // Don't save to storage here again to avoid loop
      this.emit('accountChanged', account)

      return account
    } catch (error) {
      // Silently handle errors, might be user rejection or wallet unavailable
      console.debug('Failed to restore wallet from storage:', error)
      return null
    }
  }

  /**
   * Clear storage
   */
  private clearStorage(): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      localStorage.removeItem(`${this.config.storagePrefix}data`)
    } catch (error) {
      console.error('Failed to clear wallet data from storage:', error)
    }
  }

  /**
   * Get history records
   */
  private getHistoryRecords(): WalletHistoryRecord[] {
    const records: WalletHistoryRecord[] = []

    for (const adapter of this.connectedWallets.values()) {
      if (adapter.currentAccount) {
        records.push({
          universalAddress: adapter.currentAccount.universalAddress,
          nativeAddress: adapter.currentAccount.nativeAddress,
          chainId: adapter.currentAccount.chainId,
          chainType: adapter.chainType,
          walletType: adapter.type,
          lastConnected: Date.now(),
          name: adapter.currentAccount.name,
        })
      }
    }

    return records
  }
}

