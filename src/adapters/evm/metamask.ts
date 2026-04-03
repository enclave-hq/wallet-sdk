/**
 * MetaMask Adapter
 */

import { createWalletClient, createPublicClient, custom, http, type WalletClient, type PublicClient } from 'viem'
import { BrowserWalletAdapter } from '../base/browser-wallet-adapter'
import {
  WalletType,
  ChainType,
  WalletState,
  Account,
  AddChainParams,
  ContractReadParams,
  ContractWriteParams,
  TransactionReceipt,
} from '../../core/types'
import { createUniversalAddress } from '../../utils/address/universal-address'
import { formatEVMAddress } from '../../utils/address/evm-utils'
import { ConnectionRejectedError, SignatureRejectedError, TransactionFailedError } from '../../core/errors'
import { getChainInfo } from '../../utils/chain-info'

/**
 * MetaMask Adapter
 */
export class MetaMaskAdapter extends BrowserWalletAdapter {
  readonly type = WalletType.METAMASK
  readonly chainType = ChainType.EVM
  readonly name = 'MetaMask'
  readonly icon = 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg'

  private walletClient: WalletClient | null = null
  private publicClient: PublicClient | null = null

  /**
   * Connect wallet
   */
  async connect(chainId?: number | number[]): Promise<Account> {
    await this.ensureAvailable()
    
    // For MetaMask, use first chain ID if array is provided
    const targetChainId = Array.isArray(chainId) ? chainId[0] : chainId

    try {
      this.setState(WalletState.CONNECTING)

      const provider = this.getBrowserProvider()

      // Request accounts
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new ConnectionRejectedError(this.type)
      }

      // Get current chain ID
      const currentChainId = await provider.request({
        method: 'eth_chainId',
      })
      const parsedChainId = parseInt(currentChainId, 16)

      // If chain ID is specified and doesn't match, try to switch
      // For MetaMask, use first chain ID if array is provided
      if (targetChainId && targetChainId !== parsedChainId) {
        await this.switchChain(targetChainId)
      }

      const finalChainId = targetChainId || parsedChainId
      const viemChain = this.getViemChain(finalChainId) as any

      // Create clients (need to specify chain to support writeContract)
      this.walletClient = createWalletClient({
        account: accounts[0] as `0x${string}`,
        chain: viemChain,
        transport: custom(provider),
      })

      // Use our configured RPC nodes for read operations to avoid MetaMask internal RPC issues
      const chainInfo = getChainInfo(finalChainId)
      const primaryRpcUrl = chainInfo?.rpcUrls[0] // Use first (most reliable) RPC node
      
      this.publicClient = createPublicClient({
        chain: viemChain,
        transport: primaryRpcUrl ? http(primaryRpcUrl) : custom(provider), // 优先使用我们的 RPC，降级到 MetaMask provider
      }) as any

      // 创建账户信息
      const address = formatEVMAddress(accounts[0])
      const account: Account = {
        universalAddress: createUniversalAddress(finalChainId, address),
        nativeAddress: address,
        chainId: finalChainId,
        chainType: ChainType.EVM,
        isActive: true,
      }

      this.setState(WalletState.CONNECTED)
      this.setAccount(account)
      this.setupEventListeners()

      return account
    } catch (error: any) {
      this.setState(WalletState.ERROR)
      this.setAccount(null)

      if (error.code === 4001) {
        throw new ConnectionRejectedError(this.type)
      }

      throw error
    }
  }

  /**
   * 签名消息
   */
  async signMessage(message: string): Promise<string> {
    this.ensureConnected()

    try {
      const provider = this.getBrowserProvider()
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, this.currentAccount!.nativeAddress],
      })

      return signature
    } catch (error: any) {
      if (error.code === 4001) {
        throw new SignatureRejectedError()
      }
      throw error
    }
  }

  /**
   * 签名 TypedData (EIP-712)
   */
  async signTypedData(typedData: any): Promise<string> {
    this.ensureConnected()

    try {
      const provider = this.getBrowserProvider()
      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [this.currentAccount!.nativeAddress, JSON.stringify(typedData)],
      })

      return signature
    } catch (error: any) {
      if (error.code === 4001) {
        throw new SignatureRejectedError()
      }
      throw error
    }
  }

  /**
   * 签名交易
   * 
   * Note: This signs a raw transaction without sending it.
   * The transaction can be broadcast later using the returned signature.
   */
  async signTransaction(transaction: any): Promise<string> {
    this.ensureConnected()

    try {
      const provider = this.getBrowserProvider()
      
      // Prepare transaction object with proper formatting
      const tx = {
        from: this.currentAccount!.nativeAddress,
        to: transaction.to,
        value: transaction.value ? `0x${BigInt(transaction.value).toString(16)}` : undefined,
        data: transaction.data || '0x',
        gas: transaction.gas ? `0x${BigInt(transaction.gas).toString(16)}` : undefined,
        gasPrice: transaction.gasPrice && transaction.gasPrice !== 'auto' ? `0x${BigInt(transaction.gasPrice).toString(16)}` : undefined,
        maxFeePerGas: transaction.maxFeePerGas ? `0x${BigInt(transaction.maxFeePerGas).toString(16)}` : undefined,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? `0x${BigInt(transaction.maxPriorityFeePerGas).toString(16)}` : undefined,
        nonce: transaction.nonce !== undefined ? `0x${transaction.nonce.toString(16)}` : undefined,
        chainId: transaction.chainId || this.currentAccount!.chainId,
      }

      // Sign the transaction
      const signature = await provider.request({
        method: 'eth_signTransaction',
        params: [tx],
      })

      return signature
    } catch (error: any) {
      if (error.code === 4001) {
        throw new SignatureRejectedError('Transaction signature was rejected by user')
      }
      throw error
    }
  }

  /**
   * 切换链
   */
  async switchChain(chainId: number): Promise<void> {
    // 在连接过程中允许切换链，不需要检查连接状态
    const provider = this.getBrowserProvider()

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })

      // 更新账户信息
      if (this.currentAccount) {
        const updatedAccount: Account = {
          ...this.currentAccount,
          chainId,
          universalAddress: createUniversalAddress(chainId, this.currentAccount.nativeAddress),
        }
        this.setAccount(updatedAccount)
        this.emitChainChanged(chainId)
      }
    } catch (error: any) {
      // 链不存在，尝试添加
      if (error.code === 4902) {
        const chainInfo = getChainInfo(chainId)
        if (chainInfo) {
          await this.addChain({
            chainId: chainInfo.id,
            chainName: chainInfo.name,
            nativeCurrency: chainInfo.nativeCurrency,
            rpcUrls: chainInfo.rpcUrls,
            blockExplorerUrls: chainInfo.blockExplorerUrls,
          })
          // 添加成功后再次尝试切换
          await this.switchChain(chainId)
        } else {
          throw new Error(`Chain ${chainId} not supported`)
        }
      } else {
        throw error
      }
    }
  }

  /**
   * 添加链
   */
  async addChain(chainConfig: AddChainParams): Promise<void> {
    const provider = this.getBrowserProvider()

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${chainConfig.chainId.toString(16)}`,
        chainName: chainConfig.chainName,
        nativeCurrency: chainConfig.nativeCurrency,
        rpcUrls: chainConfig.rpcUrls,
        blockExplorerUrls: chainConfig.blockExplorerUrls,
      }],
    })
  }

  /**
   * 请求切换账户
   * 弹出 MetaMask 账户选择界面，让用户选择或切换到目标地址
   * @param targetAddress 目标地址（可选），如果提供，会在切换后验证是否匹配
   * @returns 切换后的账户信息
   */
  async requestSwitchAccount(targetAddress?: string): Promise<Account> {
    const provider = this.getBrowserProvider()
    if (!provider) {
      throw new Error('MetaMask provider not available')
    }

    try {
      // 使用 wallet_requestPermissions 请求账户权限，会弹出账户选择界面
      await provider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      })

      // 获取新选择的账户
      const accounts = await provider.request({
        method: 'eth_accounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new ConnectionRejectedError(this.type)
      }

      const address = formatEVMAddress(accounts[0])
      
      // 如果提供了目标地址，验证是否匹配
      if (targetAddress && address.toLowerCase() !== targetAddress.toLowerCase()) {
        throw new Error(`请在 MetaMask 中选择地址 ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}，当前选择的是 ${address.slice(0, 6)}...${address.slice(-4)}`)
      }

      // 更新账户信息
      const chainId = this.currentAccount?.chainId || 1
      const account: Account = {
        universalAddress: createUniversalAddress(chainId, address),
        nativeAddress: address,
        chainId,
        chainType: ChainType.EVM,
        isActive: true,
      }
      
      this.setAccount(account)
      this.emitAccountChanged(account)

      // 更新 walletClient
      const viemChain = this.getViemChain(chainId)
      this.walletClient = createWalletClient({
        account: address as `0x${string}`,
        chain: viemChain,
        transport: custom(provider),
      })

      return account
    } catch (error: any) {
      if (error.code === 4001) {
        throw new ConnectionRejectedError(this.type)
      }
      throw error
    }
  }

  /**
   * 读取合约
   */
  async readContract<T = any>(params: ContractReadParams): Promise<T> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized')
    }

    const result = await this.publicClient.readContract({
      address: params.address as `0x${string}`,
      abi: params.abi,
      functionName: params.functionName,
      ...(params.args ? { args: params.args as readonly any[] } : {}),
    } as any)

    return result as T
  }

  /**
   * 写入合约
   */
  async writeContract(params: ContractWriteParams): Promise<string> {
    this.ensureConnected()

    if (!this.walletClient) {
      throw new Error('Wallet client not initialized')
    }

    try {
      // 调试日志
      console.log('🔍 [MetaMask writeContract] Gas params:', {
        gasPrice: params.gasPrice,
        maxFeePerGas: params.maxFeePerGas,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      });
      
      // 构建交易选项
      const txOptions: any = {
        address: params.address as `0x${string}`,
        abi: params.abi,
        functionName: params.functionName,
        ...(params.args ? { args: params.args as readonly any[] } : {}),
        value: params.value ? BigInt(params.value) : undefined,
        gas: params.gas ? BigInt(params.gas) : undefined,
      };

      // EIP-1559 网络优先使用 maxFeePerGas 和 maxPriorityFeePerGas
      // 如果提供了 EIP-1559 参数，使用它们；否则如果提供了 gasPrice，使用 gasPrice；否则让 viem 自动获取
      if (params.maxFeePerGas || params.maxPriorityFeePerGas) {
        // 使用 EIP-1559 参数
        if (params.maxFeePerGas) {
          txOptions.maxFeePerGas = BigInt(params.maxFeePerGas);
        }
        if (params.maxPriorityFeePerGas) {
          txOptions.maxPriorityFeePerGas = BigInt(params.maxPriorityFeePerGas);
        }
        // 在 EIP-1559 网络中，不应该同时设置 gasPrice
        console.log('🔍 [MetaMask writeContract] Using EIP-1559 gas params');
      } else if (params.gasPrice) {
        // Legacy 网络或明确指定 gasPrice
        if (params.gasPrice === 'auto') {
          // 让 viem 自动获取 gas price（会根据网络类型自动选择 EIP-1559 或 Legacy）
          console.log('🔍 [MetaMask writeContract] Auto gas price - letting viem decide');
        } else {
          txOptions.gasPrice = BigInt(params.gasPrice);
          console.log('🔍 [MetaMask writeContract] Using legacy gasPrice');
        }
      } else {
        // 没有提供任何 gas 参数，主动获取并设置合理的 gas 费用
        console.log('🔍 [MetaMask writeContract] No gas params - fetching and setting reasonable gas fees');
        
        // 获取当前网络的 gas 费用信息并设置
        if (this.publicClient) {
          try {
            // 尝试获取 EIP-1559 费用（如果网络支持）
            const feesPerGas = await this.publicClient.estimateFeesPerGas().catch(() => null);
            if (feesPerGas) {
              // 确保 maxPriorityFeePerGas 有合理的最小值（至少 0.1 Gwei = 100000000 wei）
              // 如果太小，MetaMask 可能会使用默认值导致费用过高
              const minPriorityFeeWei = BigInt(100_000_000); // 0.1 Gwei
              const maxPriorityFeePerGas = feesPerGas.maxPriorityFeePerGas > minPriorityFeeWei 
                ? feesPerGas.maxPriorityFeePerGas 
                : minPriorityFeeWei;
              
              // maxFeePerGas 应该至少是 baseFee + priorityFee
              // 如果估算的 maxFeePerGas 太小，增加一些缓冲
              const adjustedMaxFeePerGas = feesPerGas.maxFeePerGas > maxPriorityFeePerGas
                ? feesPerGas.maxFeePerGas
                : maxPriorityFeePerGas + BigInt(1_000_000_000); // 至少增加 1 Gwei
              
              // 设置 EIP-1559 参数
              txOptions.maxFeePerGas = adjustedMaxFeePerGas;
              txOptions.maxPriorityFeePerGas = maxPriorityFeePerGas;
              
              const maxFeePerGasGwei = Number(adjustedMaxFeePerGas) / 1e9;
              const maxPriorityFeePerGasGwei = Number(maxPriorityFeePerGas) / 1e9;
              
              console.log('💰 [MetaMask writeContract] Set gas fees (EIP-1559):', {
                maxFeePerGas: `${maxFeePerGasGwei.toFixed(6)} Gwei`,
                maxPriorityFeePerGas: `${maxPriorityFeePerGasGwei.toFixed(6)} Gwei`,
                maxFeePerGasWei: adjustedMaxFeePerGas.toString(),
                maxPriorityFeePerGasWei: maxPriorityFeePerGas.toString(),
                note: '已设置合理的 gas 费用，避免 MetaMask 使用默认值',
              });
            } else {
              // 回退到 Legacy gas price
              const gasPrice = await this.publicClient.getGasPrice();
              txOptions.gasPrice = gasPrice;
              
              const gasPriceGwei = Number(gasPrice) / 1e9;
              console.log('💰 [MetaMask writeContract] Set gas price (Legacy):', {
                gasPrice: `${gasPriceGwei.toFixed(6)} Gwei`,
                gasPriceWei: gasPrice.toString(),
              });
            }
          } catch (err) {
            console.warn('⚠️ [MetaMask writeContract] Failed to estimate gas fees, letting viem auto-estimate:', err);
          }
        }
      }
      
      const txHash = await this.walletClient.writeContract(txOptions as any)

      return txHash
    } catch (error: any) {
      if (error.code === 4001) {
        throw new SignatureRejectedError('Transaction was rejected by user')
      }
      throw error
    }
  }

  /**
   * 估算 gas
   */
  async estimateGas(params: ContractWriteParams): Promise<bigint> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized')
    }

    const gas = await this.publicClient.estimateContractGas({
      address: params.address as `0x${string}`,
      abi: params.abi,
      functionName: params.functionName,
      ...(params.args ? { args: params.args as readonly any[] } : {}),
      value: params.value ? BigInt(params.value) : undefined,
      account: this.currentAccount!.nativeAddress as `0x${string}`,
    } as any)

    return gas
  }

  /**
   * 等待交易确认
   */
  async waitForTransaction(txHash: string, confirmations: number = 1): Promise<TransactionReceipt> {
    if (!this.publicClient) {
      throw new Error('Public client not initialized')
    }

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations,
    })

    if (receipt.status === 'reverted') {
      throw new TransactionFailedError(txHash, 'Transaction reverted')
    }

    return {
      transactionHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      blockHash: receipt.blockHash,
      from: receipt.from,
      to: receipt.to || undefined,
      status: receipt.status === 'success' ? 'success' : 'failed',
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
      logs: receipt.logs,
    }
  }

  /**
   * 获取 Provider
   */
  getProvider(): any {
    return this.getBrowserProvider()
  }

  /**
   * 获取 Signer
   */
  getSigner(): WalletClient | null {
    return this.walletClient
  }

  /**
   * 获取浏览器中的 MetaMask provider
   */
  protected getBrowserProvider(): any | undefined {
    if (typeof window === 'undefined') {
      return undefined
    }
    const w = window as any
    // 支持所有提供 window.ethereum 接口的钱包（MetaMask、TP钱包、Trust Wallet等）
    return w.ethereum ? w.ethereum : undefined
  }

  /**
   * 获取下载链接
   */
  protected getDownloadUrl(): string {
    return 'https://metamask.io/download/'
  }

  /**
   * 设置事件监听
   */
  protected setupEventListeners(): void {
    const provider = this.getBrowserProvider()
    if (!provider) return

    provider.on('accountsChanged', this.handleAccountsChanged)
    provider.on('chainChanged', this.handleChainChanged)
    provider.on('disconnect', this.handleDisconnect)
  }

  /**
   * 移除事件监听
   */
  protected removeEventListeners(): void {
    const provider = this.getBrowserProvider()
    if (!provider) return

    provider.removeListener('accountsChanged', this.handleAccountsChanged)
    provider.removeListener('chainChanged', this.handleChainChanged)
    provider.removeListener('disconnect', this.handleDisconnect)
  }

  /**
   * 处理账户变化
   * 
   * 注意：MetaMask 的行为
   * - 切换到已连接的账户：触发事件，返回新账户 ['0xNewAddress']
   * - 切换到未连接的账户：不触发事件（用户需要手动断开和重新连接）
   * - 锁定钱包：触发事件，返回空数组 []
   */
  private handleAccountsChanged = (accounts: string[]) => {
    console.log('[MetaMask] accountsChanged event triggered:', accounts)
    
    if (accounts.length === 0) {
      // 用户锁定钱包或手动断开连接
      console.log('[MetaMask] Disconnecting: wallet locked or manually disconnected')
      this.setState(WalletState.DISCONNECTED)
      this.setAccount(null)
      this.emitAccountChanged(null)
    } else {
      // 用户在已连接的账户之间切换
      const address = formatEVMAddress(accounts[0])
      console.log('[MetaMask] Account changed to:', address)
      const account: Account = {
        universalAddress: createUniversalAddress(this.currentAccount!.chainId, address),
        nativeAddress: address,
        chainId: this.currentAccount!.chainId,
        chainType: ChainType.EVM,
        isActive: true,
      }
      this.setAccount(account)
      this.emitAccountChanged(account)
    }
  }

  /**
   * 处理链变化
   */
  private handleChainChanged = (chainIdHex: string) => {
    const chainId = parseInt(chainIdHex, 16)

    if (this.currentAccount) {
      const account: Account = {
        ...this.currentAccount,
        chainId,
        universalAddress: createUniversalAddress(chainId, this.currentAccount.nativeAddress),
      }
      this.setAccount(account)
      this.emitChainChanged(chainId)
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect = () => {
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
    this.emitDisconnected()
  }

  /**
   * 获取 viem chain 配置（简化版）
   */
  private getViemChain(chainId: number): any {
    const chainInfo = getChainInfo(chainId)
    if (chainInfo) {
      return {
        id: chainId,
        name: chainInfo.name,
        network: chainInfo.name.toLowerCase().replace(/\s+/g, '-'),
        nativeCurrency: chainInfo.nativeCurrency,
        rpcUrls: {
          default: { http: chainInfo.rpcUrls },
          public: { http: chainInfo.rpcUrls },
        },
        blockExplorers: chainInfo.blockExplorerUrls ? {
          default: { name: 'Explorer', url: chainInfo.blockExplorerUrls[0] },
        } : undefined,
      }
    }

    // 默认配置
    return {
      id: chainId,
      name: `Chain ${chainId}`,
      network: `chain-${chainId}`,
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: {
        default: { http: [] },
        public: { http: [] },
      },
    }
  }
}

