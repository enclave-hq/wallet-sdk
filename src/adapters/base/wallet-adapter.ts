/**
 * 钱包适配器基类
 */

import EventEmitter from 'eventemitter3'
import {
  WalletType,
  ChainType,
  WalletState,
  Account,
  IWalletAdapter,
  ContractReadParams,
  ContractWriteParams,
  TransactionReceipt,
} from '../../core/types'
import { WalletNotConnectedError, MethodNotSupportedError } from '../../core/errors'

/**
 * 钱包适配器基类
 */
export abstract class WalletAdapter extends EventEmitter implements IWalletAdapter {
  // 元数据
  abstract readonly type: WalletType
  abstract readonly chainType: ChainType
  abstract readonly name: string
  readonly icon?: string

  // 状态
  state: WalletState = WalletState.DISCONNECTED
  currentAccount: Account | null = null

  // 连接管理
  abstract connect(chainId?: number): Promise<Account>
  abstract disconnect(): Promise<void>
  abstract isAvailable(): Promise<boolean>

  // 签名
  abstract signMessage(message: string): Promise<string>

  /**
   * Get the signer's address (implements ISigner interface)
   * Returns the native address of the current account
   */
  async getAddress(): Promise<string> {
    this.ensureConnected()
    if (!this.currentAccount) {
      throw new WalletNotConnectedError(this.type)
    }
    return this.currentAccount.nativeAddress
  }

  signTransaction?(_transaction: any): Promise<string> {
    throw new MethodNotSupportedError('signTransaction', this.type)
  }

  signTypedData?(_typedData: any): Promise<string> {
    throw new MethodNotSupportedError('signTypedData', this.type)
  }

  // 链切换（默认不支持）
  switchChain?(_chainId: number): Promise<void> {
    throw new MethodNotSupportedError('switchChain', this.type)
  }

  addChain?(_chainConfig: any): Promise<void> {
    throw new MethodNotSupportedError('addChain', this.type)
  }

  // 合约调用（默认不支持）
  async readContract<T = any>(_params: ContractReadParams): Promise<T> {
    throw new MethodNotSupportedError('readContract', this.type)
  }

  async writeContract(_params: ContractWriteParams): Promise<string> {
    throw new MethodNotSupportedError('writeContract', this.type)
  }

  async estimateGas(_params: ContractWriteParams): Promise<bigint> {
    throw new MethodNotSupportedError('estimateGas', this.type)
  }

  async waitForTransaction(_txHash: string, _confirmations?: number): Promise<TransactionReceipt> {
    throw new MethodNotSupportedError('waitForTransaction', this.type)
  }

  // Provider 访问
  abstract getProvider(): any

  getSigner?(): any {
    throw new MethodNotSupportedError('getSigner', this.type)
  }

  // 工具方法
  protected ensureConnected(): void {
    if (this.state !== WalletState.CONNECTED || !this.currentAccount) {
      throw new WalletNotConnectedError(this.type)
    }
  }

  protected setState(state: WalletState): void {
    this.state = state
  }

  protected setAccount(account: Account | null): void {
    this.currentAccount = account
  }

  protected emitAccountChanged(account: Account | null): void {
    this.emit('accountChanged', account)
  }

  protected emitChainChanged(chainId: number): void {
    this.emit('chainChanged', chainId)
  }

  protected emitDisconnected(): void {
    this.emit('disconnected')
  }

  protected emitError(error: Error): void {
    this.emit('error', error)
  }

  // EventEmitter 方法（从 EventEmitter3 继承）
  // removeAllListeners 已经由 EventEmitter 提供
}

