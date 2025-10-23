/**
 * MetaMask 适配器
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
 * MetaMask 适配器
 */
export class MetaMaskAdapter extends BrowserWalletAdapter {
  readonly type = WalletType.METAMASK
  readonly chainType = ChainType.EVM
  readonly name = 'MetaMask'
  readonly icon = 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg'

  private walletClient: WalletClient | null = null
  private publicClient: PublicClient | null = null

  /**
   * 连接钱包
   */
  async connect(chainId?: number): Promise<Account> {
    await this.ensureAvailable()

    try {
      this.setState(WalletState.CONNECTING)

      const provider = this.getBrowserProvider()

      // 请求账户
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new ConnectionRejectedError(this.type)
      }

      // 获取当前链 ID
      const currentChainId = await provider.request({
        method: 'eth_chainId',
      })
      const parsedChainId = parseInt(currentChainId, 16)

      // 如果指定了链 ID 且不匹配，尝试切换
      if (chainId && chainId !== parsedChainId) {
        await this.switchChain(chainId)
      }

      // 创建客户端
      this.walletClient = createWalletClient({
        account: accounts[0] as `0x${string}`,
        transport: custom(provider),
      })

      const finalChainId = chainId || parsedChainId

      this.publicClient = createPublicClient({
        chain: this.getViemChain(finalChainId) as any,
        transport: http(),
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
   * 切换链
   */
  async switchChain(chainId: number): Promise<void> {
    this.ensureConnected()

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
      const txHash = await this.walletClient.writeContract({
        address: params.address as `0x${string}`,
        abi: params.abi,
        functionName: params.functionName,
        ...(params.args ? { args: params.args as readonly any[] } : {}),
        value: params.value ? BigInt(params.value) : undefined,
        gas: params.gas ? BigInt(params.gas) : undefined,
        gasPrice: params.gasPrice ? BigInt(params.gasPrice) : undefined,
      } as any)

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
    return w.ethereum && w.ethereum.isMetaMask ? w.ethereum : undefined
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

