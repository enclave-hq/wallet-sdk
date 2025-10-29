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

    this.registry = new AdapterRegistry()

    // Restore previous connections
    if (this.config.enableStorage) {
      this.restoreFromStorage()
    }
  }

  // ===== Connection Management =====

  /**
   * Connect primary wallet
   */
  async connect(type: WalletType, chainId?: number): Promise<Account> {
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
  async connectAdditional(type: WalletType, chainId?: number): Promise<Account> {
    const adapter = this.registry.getAdapter(type)
    if (!adapter) {
      throw new WalletNotAvailableError(type)
    }

    const isAvailable = await adapter.isAvailable()
    if (!isAvailable) {
      throw new WalletNotAvailableError(type)
    }

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

    if (this.config.enableStorage) {
      this.saveToStorage()
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

    // 移除旧主钱包的监听
    if (this.primaryWallet) {
      this.removeAdapterListeners(this.primaryWallet)
    }

    // 设置新主钱包
    this.setPrimaryWallet(adapter)

    // 设置新主钱包的监听
    this.setupAdapterListeners(adapter, true)

    if (this.config.enableStorage) {
      this.saveToStorage()
    }

    this.emit('primaryWalletSwitched', adapter.currentAccount, oldPrimary, chainType)

    return adapter.currentAccount
  }

  /**
   * 获取主钱包账户
   */
  getPrimaryAccount(): Account | null {
    return this.primaryWallet?.currentAccount || null
  }

  /**
   * 获取所有已连接的钱包
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
   * 根据链类型获取钱包
   */
  getWalletByChainType(chainType: ChainType): IWalletAdapter | null {
    return this.connectedWallets.get(chainType) || null
  }

  // ===== 签名 =====

  /**
   * 使用主钱包签名
   */
  async signMessage(message: string): Promise<string> {
    if (!this.primaryWallet) {
      throw new WalletNotConnectedError()
    }

    return this.primaryWallet.signMessage(message)
  }

  /**
   * 使用指定链类型的钱包签名
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
   * 签名 TypedData（仅 EVM）
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
   * 签名交易（使用主钱包）
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
   * 使用指定链类型的钱包签名交易
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

  // ===== 链切换 =====

  /**
   * 请求切换链（仅 EVM）
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
      // 如果链不存在且配置了自动添加
      if (options?.addChainIfNotExists && options.chainConfig && this.primaryWallet.addChain) {
        await this.primaryWallet.addChain(options.chainConfig)
        await this.primaryWallet.switchChain(chainId)
        return this.primaryWallet.currentAccount!
      }
      throw error
    }
  }

  // ===== 合约调用 =====

  /**
   * 读取合约
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
   * 写入合约
   */
  async writeContract(
    address: string,
    abi: any[],
    functionName: string,
    args?: any[],
    options?: {
      value?: string
      gas?: number
      gasPrice?: string
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
   * 估算 Gas
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
   * 等待交易确认
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

  // ===== Provider 访问 =====

  /**
   * 获取主钱包 Provider
   */
  getProvider(): any {
    if (!this.primaryWallet) {
      throw new WalletNotConnectedError()
    }

    return this.primaryWallet.getProvider()
  }

  /**
   * 获取指定链类型的 Provider
   */
  getProviderByChainType(chainType: ChainType): any {
    const adapter = this.connectedWallets.get(chainType)
    if (!adapter) {
      throw new WalletNotConnectedError(`Wallet for chain type ${chainType}`)
    }

    return adapter.getProvider()
  }

  // ===== 私有方法 =====

  /**
   * 设置主钱包
   */
  private setPrimaryWallet(adapter: IWalletAdapter): void {
    this.primaryWallet = adapter
  }

  /**
   * 判断钱包是否支持链切换
   */
  private canSwitchChain(adapter: IWalletAdapter): boolean {
    return !!adapter.switchChain
  }

  /**
   * 设置适配器事件监听
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
   * 移除适配器事件监听
   */
  private removeAdapterListeners(adapter: IWalletAdapter | null): void {
    if (!adapter) return
    adapter.removeAllListeners()
  }

  // ===== 存储 =====

  /**
   * 保存到存储
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined' || !this.config.enableStorage) {
      return
    }

    const data: StorageData = {
      current: this.primaryWallet?.currentAccount?.universalAddress || null,
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
   * 从存储恢复
   */
  private restoreFromStorage(): void {
    // 注意：自动重连可能需要用户授权，这里只是读取历史记录
    // 实际重连需要用户主动调用 connect()
  }

  /**
   * 清除存储
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
   * 获取历史记录
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

