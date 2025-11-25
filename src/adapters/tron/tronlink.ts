/**
 * TronWeb 兼容钱包适配器
 * 支持所有提供 TronWeb 接口的钱包，包括但不限于：
 * - TronLink
 * - TokenPocket
 * - 其他 TronWeb 兼容的钱包
 */

import { BrowserWalletAdapter } from '../base/browser-wallet-adapter'
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
import { ConnectionRejectedError, SignatureRejectedError, TransactionFailedError } from '../../core/errors'

/**
 * TronWeb 兼容钱包适配器
 * 支持所有提供 window.tronWeb 或 window.tronLink.tronWeb 接口的钱包
 */
export class TronLinkAdapter extends BrowserWalletAdapter {
  readonly type = WalletType.TRONLINK
  readonly chainType = ChainType.TRON
  readonly name = 'TronWeb'
  readonly icon = 'https://www.tronlink.org/static/logoIcon.svg'

  // Tron 主网链 ID
  private static readonly TRON_MAINNET_CHAIN_ID = 195

  /**
   * 连接钱包
   */
  async connect(chainId?: number): Promise<Account> {
    await this.ensureAvailable()

    try {
      this.setState(WalletState.CONNECTING)

      const w = window as any
      const tronWeb = this.getTronWeb()

      // 优先使用 TronLink 特定的 request API（如果存在）
      if (w.tronLink && typeof w.tronLink.request === 'function') {
        try {
          const result = await w.tronLink.request({
            method: 'tron_requestAccounts',
          })

          if (!result || result.code !== 200) {
            throw new ConnectionRejectedError(this.type)
          }
        } catch (error: any) {
          // 如果用户拒绝连接
          if (error.code === 4001 || error.message?.includes('User rejected') || error.message?.includes('rejected')) {
            throw new ConnectionRejectedError(this.type)
          }
          // 其他错误继续，尝试直接获取地址
        }
      }

      // 等待 TronWeb 就绪（如果支持 ready 属性）
      if (tronWeb.ready) {
        await tronWeb.ready
      }

      // 获取当前地址
      // 标准 TronWeb API: tronWeb.defaultAddress.base58
      let address = tronWeb.defaultAddress?.base58
      
      // 如果还没有地址，尝试从 hex 地址转换（某些钱包可能只提供 hex）
      if (!address && tronWeb.defaultAddress?.hex && tronWeb.address && typeof tronWeb.address.fromHex === 'function') {
        try {
          address = tronWeb.address.fromHex(tronWeb.defaultAddress.hex)
        } catch (e) {
          // 转换失败，继续尝试其他方式
        }
      }

      // 如果仍然没有地址，等待一小段时间让钱包初始化
      if (!address) {
        // 某些钱包需要时间初始化，等待最多 2 秒
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 100))
          address = tronWeb.defaultAddress?.base58
          if (address) break
        }
      }

      if (!address) {
        throw new Error('Failed to get Tron address. Please make sure your wallet is unlocked and try again.')
      }

      // Tron 主网的链 ID
      const tronChainId = chainId || TronLinkAdapter.TRON_MAINNET_CHAIN_ID

      // 创建账户信息
      const account: Account = {
        universalAddress: createUniversalAddress(tronChainId, address),
        nativeAddress: address,
        chainId: tronChainId,
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

      if (error.code === 4001 || error.message?.includes('User rejected')) {
        throw new ConnectionRejectedError(this.type)
      }

      throw error
    }
  }

  /**
   * 签名消息
   * 
   * Note: TronWeb 兼容钱包支持两种签名方法：
   * - trx.sign(): 签名交易对象
   * - trx.signMessageV2(): 签名纯文本消息（我们使用此方法）
   */
  async signMessage(message: string): Promise<string> {
    this.ensureConnected()

    try {
      const tronWeb = this.getTronWeb()

      // Use signMessageV2 for plain text message signing (not transaction signing)
      // This is equivalent to personal_sign in EVM
      if (typeof tronWeb.trx.signMessageV2 === 'function') {
        // signMessageV2 returns a hex signature
        const signature = await tronWeb.trx.signMessageV2(message)
        return signature
      } else {
        // Fallback to older method if signMessageV2 not available
        // Note: This might not work correctly for message signing
        console.warn('[TronLink] signMessageV2 not available, falling back to sign()')
        const signature = await tronWeb.trx.sign(message)
        return signature
      }
    } catch (error: any) {
      if (error.message?.includes('User rejected') || error.message?.includes('Confirmation declined')) {
        throw new SignatureRejectedError()
      }
      
      // Better error message for invalid input
      if (error.message?.includes('Invalid transaction')) {
        throw new Error('Invalid message format. For transaction signing, use signTransaction() instead.')
      }
      
      throw error
    }
  }

  /**
   * 签名交易
   * 
   * Note: This uses trx.sign() which is specifically for signing transaction objects.
   * For plain text message signing, use signMessage() instead.
   */
  async signTransaction(transaction: any): Promise<string> {
    this.ensureConnected()

    try {
      const tronWeb = this.getTronWeb()

      // TronLink's trx.sign() expects a transaction object
      // The transaction should be properly formatted with fields like:
      // - txID, raw_data, raw_data_hex, etc.
      const signature = await tronWeb.trx.sign(transaction)

      return signature
    } catch (error: any) {
      if (error.message?.includes('User rejected') || error.message?.includes('Confirmation declined')) {
        throw new SignatureRejectedError('Transaction signature was rejected by user')
      }
      
      // Better error message for invalid input
      if (error.message?.includes('Invalid transaction')) {
        throw new Error('Invalid transaction format. Please provide a properly formatted Tron transaction object.')
      }
      
      throw error
    }
  }

  /**
   * 读取合约
   * 参考 webserver 的实现，使用 TronWeb 合约实例的标准 call() 方法
   */
  async readContract<T = any>(params: ContractReadParams): Promise<T> {
    this.ensureConnected()

    try {
      const tronWeb = this.getTronWeb()
      
      if (!this.currentAccount) {
        throw new Error('No account connected')
      }
      
      // 方法1: 使用 TronWeb 标准方法（参考 webserver 的实现）
      try {
        // 创建合约实例（使用 ABI）
        const contract = await tronWeb.contract(params.abi, params.address)
        
        // 获取方法
        const method = contract[params.functionName]
        if (!method || typeof method !== 'function') {
          throw new Error(`Function ${params.functionName} not found in contract ABI`)
        }
        
        // 直接调用 call() 方法（不需要传入地址参数）
        // 这是 TronWeb 的标准只读调用方式
        const result = await method(...(params.args || [])).call()
        
        return result as T
      } catch (method1Error: any) {
        // 如果方法1失败，尝试方法2：不使用 ABI，直接使用合约地址
        console.warn('⚠️ [方法1] TronWeb标准方法失败，尝试方法2:', method1Error.message)
        
        try {
          // 方法2: 不使用 ABI，直接使用合约地址（某些钱包可能不支持 ABI）
          const contract2 = await (tronWeb as any).contract().at(params.address)
          const method2 = contract2[params.functionName]
          
          if (!method2 || typeof method2 !== 'function') {
            throw new Error(`Function ${params.functionName} not found in contract`)
          }
          
          const result = await method2(...(params.args || [])).call()
          return result as T
        } catch (method2Error: any) {
          console.error('⚠️ [方法2] 也失败:', method2Error.message)
          // 如果两种方法都失败，抛出原始错误
          throw method1Error
        }
      }
    } catch (error: any) {
      console.error('Read contract error:', error)
      throw new Error(`Failed to read contract: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * 写入合约
   */
  async writeContract(params: ContractWriteParams): Promise<string> {
    this.ensureConnected()

    try {
      const tronWeb = this.getTronWeb()
      
      console.log('[TronLink] writeContract params:', {
        address: params.address,
        functionName: params.functionName,
        args: params.args,
        value: params.value,
        gas: params.gas,
      })
      
      // 验证参数
      if (!params.args || params.args.length === 0) {
        throw new Error('Contract function arguments are required')
      }
      
      // 检查参数是否包含 undefined
      const hasUndefined = params.args.some(arg => arg === undefined || arg === null)
      if (hasUndefined) {
        console.error('[TronLink] Invalid args detected:', params.args)
        throw new Error(`Invalid contract arguments: some arguments are undefined or null`)
      }
      
      // 使用 TronWeb 的 transactionBuilder.triggerSmartContract API
      // 这是更底层、更可靠的 API
      
      // 构建函数签名
      const functionAbi = params.abi.find((item: any) => 
        item.name === params.functionName && item.type === 'function'
      )
      
      if (!functionAbi) {
        throw new Error(`Function ${params.functionName} not found in ABI`)
      }
      
      console.log('[TronLink] Function ABI:', functionAbi)
      console.log('[TronLink] Calling with args:', params.args)
      
      // 准备交易参数
      const options = {
        feeLimit: params.gas || 100_000_000, // 默认 100 TRX 的能量限制
        callValue: params.value || 0, // 发送的 TRX 数量（单位：SUN）
      }
      
      // 构建参数数组
      const parameter = functionAbi.inputs.map((input: any, index: number) => ({
        type: input.type,
        value: params.args![index]
      }))
      
      console.log('[TronLink] Transaction options:', options)
      console.log('[TronLink] Parameters:', parameter)
      
      // 构建函数选择器（参考 webserver 的实现）
      const functionSelector = params.functionName + '(' + functionAbi.inputs.map((i: any) => i.type).join(',') + ')'
      
      console.log('[TronLink] Function selector:', functionSelector)
      console.log('[TronLink] Transaction options:', options)
      console.log('[TronLink] Parameters:', parameter)
      
      // 使用 triggerSmartContract 触发合约（参考 webserver 的实现）
      const tx = await tronWeb.transactionBuilder.triggerSmartContract(
        params.address,
        functionSelector,
        options,
        parameter,
        this.currentAccount!.nativeAddress
      )
      
      console.log('[TronLink] Transaction built:', tx)
      
      // 验证交易构建结果
      if (!tx || !tx.transaction) {
        throw new Error('Failed to build transaction')
      }
      
      // 请求用户签名（参考 webserver 的实现）
      console.log('[TronLink] Requesting user signature...')
      const signedTx = await tronWeb.trx.sign(tx.transaction)
      console.log('[TronLink] Transaction signed:', signedTx)
      
      // ✅ 从签名的交易中提取 txID（这是最可靠的方式，参考 webserver）
      const txID = signedTx.txID
      console.log('[TronLink] Transaction hash (txID):', txID)
      
      // 广播交易（参考 webserver 的实现）
      console.log('[TronLink] Broadcasting transaction...')
      const broadcast = await tronWeb.trx.sendRawTransaction(signedTx)
      console.log('[TronLink] Broadcast result:', broadcast)
      
      // 验证广播结果
      if (broadcast && broadcast.result === true) {
        // 广播成功，返回交易哈希
        return txID || broadcast.txid || ''
      } else {
        // 广播失败，但如果有 txID，仍然返回（交易可能已经上链）
        if (txID) {
          console.warn('[TronLink] Broadcast returned false but txID exists:', txID)
          return txID
        }
        throw new Error(broadcast?.message || 'Transaction broadcast failed')
      }
    } catch (error: any) {
      console.error('Write contract error:', error)
      
      if (error.message?.includes('User rejected') || error.message?.includes('Confirmation declined')) {
        throw new SignatureRejectedError('Transaction was rejected by user')
      }
      
      throw new Error(`Failed to write contract: ${error.message}`)
    }
  }

  /**
   * 等待交易确认
   */
  async waitForTransaction(txHash: string, _confirmations: number = 1): Promise<TransactionReceipt> {
    try {
      const tronWeb = this.getTronWeb()
      
      // 等待交易确认
      let attempts = 0
      const maxAttempts = 60 // 最多等待 60 秒
      
      while (attempts < maxAttempts) {
        try {
          const txInfo = await tronWeb.trx.getTransactionInfo(txHash)
          
          if (txInfo && txInfo.id) {
            // 交易已确认
            const receipt: TransactionReceipt = {
              transactionHash: txHash,
              blockNumber: txInfo.blockNumber || 0,
              blockHash: txInfo.blockHash || '',
              from: this.currentAccount!.nativeAddress,
              to: txInfo.contract_address || '',
              status: txInfo.receipt?.result === 'SUCCESS' ? 'success' : 'failed',
              gasUsed: (txInfo.receipt?.energy_usage_total || 0).toString(),
              logs: txInfo.log || [],
            }
            
            if (receipt.status === 'failed') {
              throw new TransactionFailedError(txHash, 'Transaction failed on Tron network')
            }
            
            return receipt
          }
        } catch (error) {
          // 交易可能还未确认，继续等待
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }
      
      throw new Error('Transaction confirmation timeout')
    } catch (error: any) {
      throw new Error(`Failed to wait for transaction: ${error.message}`)
    }
  }

  /**
   * 获取 Provider
   */
  getProvider(): any {
    return this.getTronWeb()
  }

  /**
   * 获取浏览器中的 TronWeb 实例
   * 支持所有 TronWeb 兼容的钱包，包括：
   * - TronLink (window.tronLink.tronWeb 或 window.tronWeb)
   * - TokenPocket (window.tronWeb)
   * - 其他提供 window.tronWeb 接口的钱包
   */
  protected getBrowserProvider(): any | undefined {
    if (typeof window === 'undefined') {
      return undefined
    }
    const w = window as any
    // 优先使用 window.tronWeb（所有 TronWeb 兼容钱包都提供）
    // 如果没有，则尝试 window.tronLink.tronWeb（TronLink 特定）
    return w.tronWeb || w.tronLink?.tronWeb
  }

  /**
   * 获取 TronWeb 实例
   */
  private getTronWeb(): any {
    const provider = this.getBrowserProvider()
    if (!provider) {
      throw new Error('未检测到 TronWeb 兼容的钱包。请安装 TronLink 或其他 TronWeb 兼容的钱包。')
    }
    return provider
  }

  /**
   * 获取下载链接
   */
  protected getDownloadUrl(): string {
    return 'https://www.tronlink.org/'
  }

  /**
   * 设置事件监听
   */
  protected setupEventListeners(): void {
    // TronWeb 兼容钱包事件监听
    if (typeof window === 'undefined') return

    const w = window as any
    
    // TronWeb 兼容钱包的事件监听方式可能因钱包而异
    // TronLink 使用 tronLink.on，其他钱包可能使用不同的方式
    try {
      if (w.tronLink && typeof w.tronLink.on === 'function') {
        // TronLink 特定的事件监听
        w.tronLink.on('accountsChanged', this.handleAccountsChanged)
        w.tronLink.on('disconnect', this.handleDisconnect)
      } else if (w.tronWeb && w.tronWeb.eventServer) {
        // 其他 TronWeb 兼容钱包可能使用 eventServer
        // 备用方案：使用轮询检测账户变化
        this.startPolling()
      } else {
        // 如果没有事件监听支持，使用轮询
        this.startPolling()
      }
    } catch (error) {
      console.warn('TronWeb 钱包事件监听设置失败，使用轮询方式:', error)
      // 降级到轮询
      this.startPolling()
    }
  }

  /**
   * 移除事件监听
   */
  protected removeEventListeners(): void {
    if (typeof window === 'undefined') return

    const w = window as any

    try {
      if (w.tronLink && typeof w.tronLink.off === 'function') {
        // TronLink 特定的事件移除
        w.tronLink.off('accountsChanged', this.handleAccountsChanged)
        w.tronLink.off('disconnect', this.handleDisconnect)
      }
    } catch (error) {
      console.warn('TronWeb 钱包事件监听移除失败:', error)
    }

    this.stopPolling()
  }

  /**
   * 轮询检测账户变化（备用方案）
   */
  private pollingInterval: NodeJS.Timeout | null = null
  private lastKnownAddress: string | null = null

  private startPolling(): void {
    if (this.pollingInterval) return

    this.lastKnownAddress = this.currentAccount?.nativeAddress || null

    this.pollingInterval = setInterval(async () => {
      try {
        const tronWeb = this.getTronWeb()
        const currentAddress = tronWeb.defaultAddress?.base58

        if (currentAddress && currentAddress !== this.lastKnownAddress) {
          this.lastKnownAddress = currentAddress
          this.handleAccountsChanged({ address: { base58: currentAddress } })
        } else if (!currentAddress && this.lastKnownAddress) {
          this.lastKnownAddress = null
          this.handleAccountsChanged(null)
        }
      } catch (error) {
        // 忽略轮询错误
      }
    }, 2000) // 每 2 秒检查一次
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * 处理账户变化
   */
  private handleAccountsChanged = (data: any) => {
    if (!data || !data.address) {
      // 用户断开连接
      this.setState(WalletState.DISCONNECTED)
      this.setAccount(null)
      this.emitAccountChanged(null)
    } else {
      // 用户切换账户
      const address = data.address.base58 || data.address
      const account: Account = {
        universalAddress: createUniversalAddress(this.currentAccount!.chainId, address),
        nativeAddress: address,
        chainId: this.currentAccount!.chainId,
        chainType: ChainType.TRON,
        isActive: true,
      }
      this.setAccount(account)
      this.emitAccountChanged(account)
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
}

