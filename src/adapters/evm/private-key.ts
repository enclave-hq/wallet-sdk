/**
 * EVM 私钥适配器
 * 用于开发和测试，不推荐在生产环境中使用
 */

import { createWalletClient, createPublicClient, http, type WalletClient, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
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
import { formatEVMAddress } from '../../utils/address/evm-utils'
import { TransactionFailedError } from '../../core/errors'
import { getChainInfo } from '../../utils/chain-info'

/**
 * EVM 私钥适配器
 */
export class EVMPrivateKeyAdapter extends WalletAdapter {
  readonly type = WalletType.PRIVATE_KEY
  readonly chainType = ChainType.EVM
  readonly name = 'Private Key (EVM)'

  private privateKey: string | null = null
  private walletClient: WalletClient | null = null
  private publicClient: PublicClient | null = null

  /**
   * 连接（导入私钥）
   */
  async connect(chainId: number = 1): Promise<Account> {
    if (!this.privateKey) {
      throw new Error('Private key not set. Call setPrivateKey() first.')
    }

    try {
      this.setState(WalletState.CONNECTING)

      // 从私钥创建账户
      const account = privateKeyToAccount(this.privateKey as `0x${string}`)

      // 创建客户端
      this.walletClient = createWalletClient({
        account,
        chain: this.getViemChain(chainId),
        transport: http(),
      })

      this.publicClient = createPublicClient({
        chain: this.getViemChain(chainId) as any,
        transport: http(),
      }) as any

      // 创建账户信息
      const address = formatEVMAddress(account.address)
      const accountInfo: Account = {
        universalAddress: createUniversalAddress(chainId, address),
        nativeAddress: address,
        chainId,
        chainType: ChainType.EVM,
        isActive: true,
      }

      this.setState(WalletState.CONNECTED)
      this.setAccount(accountInfo)

      return accountInfo
    } catch (error) {
      this.setState(WalletState.ERROR)
      this.setAccount(null)
      throw error
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.privateKey = null
    this.walletClient = null
    this.publicClient = null
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
    this.emitDisconnected()
  }

  /**
   * 检查是否可用（私钥钱包总是可用）
   */
  async isAvailable(): Promise<boolean> {
    return true
  }

  /**
   * 设置私钥
   */
  setPrivateKey(privateKey: string): void {
    // 确保私钥有 0x 前缀
    this.privateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  }

  /**
   * 签名消息
   */
  async signMessage(message: string): Promise<string> {
    this.ensureConnected()

    if (!this.walletClient || !this.walletClient.account) {
      throw new Error('Wallet client not initialized')
    }

    const signature = await this.walletClient.signMessage({
      message,
      account: this.walletClient.account,
    })

    return signature
  }

  /**
   * 签名 TypedData
   */
  async signTypedData(typedData: any): Promise<string> {
    this.ensureConnected()

    if (!this.walletClient || !this.walletClient.account) {
      throw new Error('Wallet client not initialized')
    }

    const signature = await this.walletClient.signTypedData({
      ...typedData,
      account: this.walletClient.account,
    })

    return signature
  }

  /**
   * 切换链
   */
  async switchChain(chainId: number): Promise<void> {
    this.ensureConnected()

    // 重新创建客户端
    const account = this.walletClient!.account!

    this.walletClient = createWalletClient({
      account,
      chain: this.getViemChain(chainId),
      transport: http(),
    })

    this.publicClient = createPublicClient({
      chain: this.getViemChain(chainId) as any,
      transport: http(),
    }) as any

    // 更新账户信息
    const updatedAccount: Account = {
      ...this.currentAccount!,
      chainId,
      universalAddress: createUniversalAddress(chainId, this.currentAccount!.nativeAddress),
    }
    this.setAccount(updatedAccount)
    this.emitChainChanged(chainId)
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
  }

  /**
   * 估算 gas
   */
  async estimateGas(params: ContractWriteParams): Promise<bigint> {
    if (!this.publicClient || !this.currentAccount) {
      throw new Error('Client not initialized')
    }

    const gas = await this.publicClient.estimateContractGas({
      address: params.address as `0x${string}`,
      abi: params.abi,
      functionName: params.functionName,
      ...(params.args ? { args: params.args as readonly any[] } : {}),
      value: params.value ? BigInt(params.value) : undefined,
      account: this.currentAccount.nativeAddress as `0x${string}`,
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
    return this.publicClient
  }

  /**
   * 获取 Signer
   */
  getSigner(): WalletClient | null {
    return this.walletClient
  }

  /**
   * 获取 viem chain 配置
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

