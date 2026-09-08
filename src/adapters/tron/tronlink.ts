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
import { encodeFunctionData } from 'viem'
import { resolveTronAccountsChangedAddress } from './tron-accounts-changed'
import { isRateLimitError, throttleTronWeb } from './rpc-gate'
import { detectTronLinkInjector, publishAfterTronLinkSign } from './tron-broadcast'
import { walletErrorMessageFromEnvelope, asNonEmptyTrimmedString } from '../../utils/hex'
import { tronInfoFailed, tronInfoLooksReady } from './tron-receipt'
import { coerceWalletHexString } from '../../utils/hex'
import {
  extendUnsignedTronTxExpiration,
  isTronTransactionExpiredError,
} from './tron-tx-build'
import {
  interpretTronAuthorizeResult,
  isThenable,
  withTimeout,
} from './tron-authorize'

/**
 * 重试机制（带指数退避）
 * 特别处理 429 (Too Many Requests) 错误
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 500
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMsg = error?.message || String(error)
      const errorLower = errorMsg.toLowerCase()
      
      // 检查是否是 429 错误或速率限制错误
      const isRateLimitError = 
        error?.response?.status === 429 ||
        error?.status === 429 ||
        errorLower.includes('429') ||
        errorLower.includes('rate limit') ||
        errorLower.includes('too many requests') ||
        error?.code === 'ERR_BAD_REQUEST' && error?.response?.status === 429
      
      if (isRateLimitError && attempt < maxRetries - 1) {
        // 指数退避：延迟时间 = initialDelay * 2^attempt
        const delay = initialDelay * Math.pow(2, attempt)
        console.warn(`[TronLink] 遇到速率限制 (429)，等待 ${delay}ms 后重试 (${attempt + 1}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // 如果不是速率限制错误，或者重试次数已用完，直接抛出错误
      throw error
    }
  }
  
  throw lastError
}

const TRON_CALLDATA_SELECTORS: Record<string, string> = {
  '095ea7b3': 'approve(address,uint256)',
  f50efe38: 'depositWithIntent(string,uint256,bytes32)',
  '67802632': 'deposit(string,uint256,bytes32)',
  '9f629052': 'depositAndSend(string,uint256,bytes32,bytes32,uint128)',
  '594fcde9': 'depositWithIntentAndSend(string,uint256,bytes32,bytes32,uint128)',
}

function callValueSun(value: unknown): number {
  if (value == null || value === '' || value === '0x' || value === '0x0') return 0
  const n = typeof value === 'bigint' ? value : BigInt(String(value))
  if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('TRON callValue out of safe integer range')
  }
  return Number(n)
}

function toTriggerContractBase58(tronWeb: any, raw: string): string {
  let s = raw.trim()
  const { toHex, fromHex } = tronWeb.address ?? {}
  if (typeof toHex !== 'function' || typeof fromHex !== 'function') {
    throw new Error('TronWeb.address.toHex / fromHex unavailable')
  }
  if (/^0x41[0-9a-fA-F]{40}$/.test(s)) s = s.slice(2)
  return fromHex(toHex(s))
}

function tronTriggerModeFromCalldata(data: string): {
  kind: 'rawParameter' | 'input'
  functionSelector?: string
  rawParameter?: string
  input?: string
} {
  const hex = data.trim().replace(/^0x/i, '').toLowerCase()
  if (hex.length < 8) {
    return { kind: 'input', input: data.startsWith('0x') ? data : `0x${hex}` }
  }
  const selector = hex.slice(0, 8)
  const named = TRON_CALLDATA_SELECTORS[selector]
  if (named) {
    return { kind: 'rawParameter', functionSelector: named, rawParameter: hex.slice(8) }
  }
  return { kind: 'input', input: `0x${hex}` }
}

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
  async connect(chainId?: number | number[]): Promise<Account> {
    await this.ensureAvailable()

    const targetChainId = Array.isArray(chainId) ? chainId[0] : chainId

    try {
      this.setState(WalletState.CONNECTING)

      const w = window as any
      let tronWeb = this.getTronWeb()

      // ready is often a boolean — only await real thenables (never hang on `true`).
      if (isThenable(tronWeb.ready)) {
        await withTimeout(Promise.resolve(tronWeb.ready), 5_000, 'TronWeb.ready').catch((err) => {
          console.warn('[TronLink] ready wait skipped', err)
        })
      }

      let address = this.readTronAddress(tronWeb)

      if (!address) {
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          address = this.readTronAddress(tronWeb)
          if (address) break
        }
      }

      if (!address) {
        await this.requestTronAuthorization(w)
        // After TIP-1102 auth, usable tronWeb may appear on window.tron.tronWeb.
        tronWeb = this.getTronWeb()
        address = await this.pollTronAddress(tronWeb, 60)
      }

      if (!address) {
        throw new Error(
          'Failed to get Tron address. Unlock TronLink, approve this site, and try again.',
        )
      }

      const tronChainId = targetChainId || TronLinkAdapter.TRON_MAINNET_CHAIN_ID

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

      if (
        error instanceof ConnectionRejectedError ||
        error?.code === 4001 ||
        /user rejected|rejected by user/i.test(String(error?.message ?? ''))
      ) {
        throw error instanceof ConnectionRejectedError
          ? error
          : new ConnectionRejectedError(this.type)
      }

      throw error
    }
  }

  private readTronAddress(tronWeb: any): string | undefined {
    let address = asNonEmptyTrimmedString(tronWeb?.defaultAddress?.base58)
    if (
      !address &&
      tronWeb?.defaultAddress?.hex &&
      tronWeb.address &&
      typeof tronWeb.address.fromHex === 'function'
    ) {
      try {
        address = asNonEmptyTrimmedString(
          tronWeb.address.fromHex(tronWeb.defaultAddress.hex),
        )
      } catch {
        /* ignore */
      }
    }
    return address
  }

  private async pollTronAddress(tronWeb: any, attempts: number): Promise<string | undefined> {
    for (let i = 0; i < attempts; i++) {
      const address = this.readTronAddress(tronWeb)
      if (address) return address
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return undefined
  }

  /**
   * Prefer modern window.tron + eth_requestAccounts, then legacy tron_requestAccounts.
   * Locked / pending / unknown must not be treated as user-reject (SPA was swallowing that).
   */
  private async requestTronAuthorization(w: any): Promise<void> {
    const REQUEST_MS = 120_000

    if (w.tron && typeof w.tron.request === 'function') {
      try {
        console.info('[TronLink] authorize via window.tron eth_requestAccounts')
        const result = await withTimeout(
          w.tron.request({ method: 'eth_requestAccounts' }),
          REQUEST_MS,
          'tron eth_requestAccounts',
        )
        const interp = interpretTronAuthorizeResult(result)
        console.info('[TronLink] tron eth_requestAccounts result', { interp, result })
        if (interp.kind === 'ok' || interp.kind === 'pending') return
        if (interp.kind === 'rejected') throw new ConnectionRejectedError(this.type)
        if (interp.kind === 'locked') {
          throw new Error('TronLink is locked — unlock the extension and try again')
        }
      } catch (error: any) {
        if (error instanceof ConnectionRejectedError) throw error
        if (/locked/i.test(String(error?.message ?? ''))) throw error
        if (
          error?.code === 4001 ||
          /user rejected|rejected by user/i.test(String(error?.message ?? ''))
        ) {
          throw new ConnectionRejectedError(this.type)
        }
        console.warn('[TronLink] window.tron authorize failed, trying legacy tronLink', error)
      }
    }

    if (w.tronLink && typeof w.tronLink.request === 'function') {
      console.info('[TronLink] authorize via tronLink.tron_requestAccounts')
      const result = await withTimeout(
        w.tronLink.request({ method: 'tron_requestAccounts' }),
        REQUEST_MS,
        'tron_requestAccounts',
      )
      const interp = interpretTronAuthorizeResult(result)
      console.info('[TronLink] tron_requestAccounts result', { interp, result })
      if (interp.kind === 'ok' || interp.kind === 'pending') return
      if (interp.kind === 'rejected') throw new ConnectionRejectedError(this.type)
      if (interp.kind === 'locked') {
        throw new Error('TronLink is locked — unlock the extension and try again')
      }
      // Unknown shape — continue and poll defaultAddress.
      return
    }

    console.warn('[TronLink] no request() on window.tron / window.tronLink — polling address only')
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
        // signMessageV2 returns a hex signature (sometimes wrapped)
        const signature = await tronWeb.trx.signMessageV2(message)
        return coerceWalletHexString(signature, 'TronLink signature')
      } else {
        // Fallback to older method if signMessageV2 not available
        // Note: trx.sign() on a string may return a signed tx object, not hex.
        console.warn('[TronLink] signMessageV2 not available, falling back to sign()')
        const signature = await tronWeb.trx.sign(message)
        return coerceWalletHexString(signature, 'TronLink signature')
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
   * Unified send API (same `{ to, data, value }` shape as EVM adapters).
   * TronLink has no eth_sendTransaction — build via triggerSmartContract, then sign + broadcast.
   *
   * Build happens *before* the wallet popup. TRON default expiration is ~60s from build,
   * so we extend the unsigned tx and rebuild once on "Transaction expired" (user stared
   * at the confirm sheet too long — wallets do not rebuild on tap).
   */
  async sendTransaction(transaction: any): Promise<string> {
    this.ensureConnected()
    const tronWeb = this.getTronWeb()
    const owner = this.currentAccount!.nativeAddress

    if (transaction?.raw_data || (transaction?.txID && !transaction?.to)) {
      const unsigned = await extendUnsignedTronTxExpiration(tronWeb, transaction)
      return this.broadcastSignedTronTx(await tronWeb.trx.sign(unsigned))
    }

    const to = String(transaction?.to ?? '').trim()
    const data = String(transaction?.data ?? '').trim()
    if (!to) {
      throw new Error('sendTransaction requires `to`')
    }

    const callValue = callValueSun(transaction?.value)
    if (!data || data === '0x') {
      if (callValue <= 0) throw new Error('sendTransaction requires data or a positive value')
      const buildTrx = async () => {
        const unsigned = await tronWeb.transactionBuilder.sendTrx(
          toTriggerContractBase58(tronWeb, to),
          callValue,
          owner,
        )
        return extendUnsignedTronTxExpiration(tronWeb, unsigned)
      }
      return this.signBuiltTronTxWithExpireRetry(tronWeb, buildTrx)
    }

    const contractBase58 = toTriggerContractBase58(tronWeb, to)
    const mode = tronTriggerModeFromCalldata(data)
    // depositWithIntentAndSend burns ~1.2M energy + penalty; TronWeb default
    // feeLimit 100 TRX ≈ 1e6 energy dies on LOG2 (OUT_OF_ENERGY). Default 150 TRX.
    const feeLimitRaw = Number(transaction?.feeLimit)
    const feeLimit =
      Number.isFinite(feeLimitRaw) && feeLimitRaw > 0 ? Math.floor(feeLimitRaw) : 150_000_000
    const options = {
      feeLimit,
      callValue,
      ...(mode.kind === 'rawParameter'
        ? { rawParameter: mode.rawParameter }
        : { input: mode.input }),
    }
    const buildContract = async () => {
      const built = (await retryWithBackoff(
        () =>
          tronWeb.transactionBuilder.triggerSmartContract(
            contractBase58,
            mode.kind === 'rawParameter' ? mode.functionSelector : '',
            options,
            [],
            owner,
          ),
        3,
        500,
      )) as { transaction?: unknown; result?: { message?: string } }
      if (!built?.transaction) {
        throw new Error(built?.result?.message || 'Failed to build TRON transaction')
      }
      return extendUnsignedTronTxExpiration(tronWeb, built.transaction)
    }
    return this.signBuiltTronTxWithExpireRetry(tronWeb, buildContract)
  }

  /** Build → sign → broadcast; on expiration, rebuild once with a fresh ref block. */
  private async signBuiltTronTxWithExpireRetry(
    tronWeb: { trx: { sign: (tx: unknown) => Promise<any> } },
    buildUnsigned: () => Promise<unknown>,
  ): Promise<string> {
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      const unsigned = await buildUnsigned()
      try {
        return await this.broadcastSignedTronTx(await tronWeb.trx.sign(unsigned))
      } catch (err) {
        lastErr = err
        if (attempt === 0 && isTronTransactionExpiredError(err)) continue
        throw err
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'TRON sign failed'))
  }

  private async broadcastSignedTronTx(signedTx: { txID?: string; [k: string]: unknown }): Promise<string> {
    const signErr = walletErrorMessageFromEnvelope(signedTx)
    if (signErr) throw new Error(signErr)
    const signedTxId = typeof signedTx?.txID === 'string' ? signedTx.txID : ''
    const tw = this.getTronWeb()
    return publishAfterTronLinkSign({
      signedTxId,
      hasTronLink: detectTronLinkInjector(),
      getTransaction: (id) => tw.trx.getTransaction(id),
      sendRaw: () => tw.trx.sendRawTransaction(signedTx),
      waitMs: 800,
    })
  }

  /**
   * 读取合约
   * 参考 webserver 的实现，使用 TronWeb 合约实例的标准 call() 方法
   * 带 TronGrid 限流 + 429 重试
   */
  async readContract<T = any>(params: ContractReadParams): Promise<T> {
    this.ensureConnected()

    const doRead = async (): Promise<T> => {
      const tronWeb = this.getTronWeb()
      if (!this.currentAccount) {
        throw new Error('No account connected')
      }
      try {
        const contract = await tronWeb.contract(params.abi, params.address)
        const method = contract[params.functionName]
        if (!method || typeof method !== 'function') {
          throw new Error(`Function ${params.functionName} not found in contract ABI`)
        }
        const result = await method(...(params.args || [])).call()
        return result as T
      } catch (method1Error: any) {
        console.warn('⚠️ [方法1] TronWeb标准方法失败，尝试方法2:', method1Error.message)
        const contract2 = await (tronWeb as any).contract().at(params.address)
        const method2 = contract2[params.functionName]
        if (!method2 || typeof method2 !== 'function') {
          throw new Error(`Function ${params.functionName} not found in contract`)
        }
        const result = await method2(...(params.args || [])).call()
        return result as T
      }
    }

    try {
      return await retryWithBackoff(doRead, 3, 800)
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
      // TRON FeeLimit: 150 TRX default (was 100). depositWithIntentAndSend needs
      // ~1.2M energy; 100 TRX feeLimit dies on LOG2 (OUT_OF_ENERGY).
      const feeLimitRaw = Number((params as { feeLimit?: number }).feeLimit)
      const TRON_FEE_LIMIT =
        Number.isFinite(feeLimitRaw) && feeLimitRaw > 0 ? Math.floor(feeLimitRaw) : 150_000_000
      const options = {
        feeLimit: TRON_FEE_LIMIT,
        callValue: params.value || 0, // 发送的 TRX 数量（单位：SUN）
      }
      
      // 检查是否有 tuple[] 类型的参数
      const hasTupleArray = functionAbi.inputs.some((input: any) => input.type === 'tuple[]')
      
      console.log('[TronLink] 检查 tuple[] 类型:', {
        hasTupleArray,
        inputs: functionAbi.inputs.map((i: any) => ({ name: i.name, type: i.type })),
      })
      
      let tx: any
      
      if (hasTupleArray) {
        // 对于包含 tuple[] 的函数，使用 viem 手动编码参数，然后使用 TronWeb 的底层 API
        console.log('[TronLink] 检测到 tuple[] 参数，使用手动编码方式')
        
        // 准备参数：将 TRON Base58 地址转换为 hex 格式（viem 需要）
        const processedArgs = params.args!.map((argValue: any, index: number) => {
          const input = functionAbi.inputs[index]
          
          // 处理 address 类型：转换为 hex 格式（viem 需要）
          if (input.type === 'address' && typeof argValue === 'string') {
            if (argValue.startsWith('T') && argValue.length === 34) {
              // Base58 地址，转换为 hex
              const hexAddress = tronWeb.address.toHex(argValue)
              return hexAddress.startsWith('0x') ? hexAddress : `0x${hexAddress}`
            }
            return argValue.startsWith('0x') ? argValue : `0x${argValue}`
          }
          
          // 处理 tuple[] 类型：保持原样（viem 会处理）
          if (input.type === 'tuple[]' && Array.isArray(argValue)) {
            return argValue.map((tupleItem: any) => {
              if (input.components && Array.isArray(input.components)) {
                const processedTuple: any = {}
                input.components.forEach((component: any) => {
                  let value = tupleItem[component.name]
                  
                  // 处理 tuple 中的 address 类型
                  if (component.type === 'address' && typeof value === 'string') {
                    if (value.startsWith('T') && value.length === 34) {
                      const hexAddress = tronWeb.address.toHex(value)
                      value = hexAddress.startsWith('0x') ? hexAddress : `0x${hexAddress}`
                    } else if (!value.startsWith('0x')) {
                      value = `0x${value}`
                    }
                  }
                  
                  processedTuple[component.name] = value
                })
                return processedTuple
              }
              return tupleItem
            })
          }
          
          // 处理 tuple 类型（单个 tuple）
          if (input.type === 'tuple' && typeof argValue === 'object' && !Array.isArray(argValue)) {
            if (input.components && Array.isArray(input.components)) {
              const processedTuple: any = {}
              input.components.forEach((component: any) => {
                let value = argValue[component.name]
                
                // 处理 tuple 中的 address 类型
                if (component.type === 'address' && typeof value === 'string') {
                  if (value.startsWith('T') && value.length === 34) {
                    const hexAddress = tronWeb.address.toHex(value)
                    value = hexAddress.startsWith('0x') ? hexAddress : `0x${hexAddress}`
                  } else if (!value.startsWith('0x')) {
                    value = `0x${value}`
                  }
                }
                
                processedTuple[component.name] = value
              })
              return processedTuple
            }
          }
          
          return argValue
        })
        
        console.log('[TronLink] 处理后的参数（用于 viem 编码）:', processedArgs)
        
        // 使用 viem 编码函数调用数据
        const encodedData = encodeFunctionData({
          abi: [functionAbi],
          functionName: params.functionName,
          args: processedArgs as any,
        })
        
        console.log('[TronLink] 编码后的数据:', encodedData)
        
        // 提取函数选择器（前4字节）和参数数据
        const functionSelector = encodedData.slice(0, 10) // 0x + 4 bytes = 10 chars
        const parameterData = encodedData.slice(10) // 剩余的参数数据
        
        console.log('[TronLink] 函数选择器:', functionSelector)
        console.log('[TronLink] 参数数据:', parameterData)
        
        // 构建函数签名（用于 TronWeb API）
        const functionSignature = params.functionName + '(' + functionAbi.inputs.map((i: any) => i.type).join(',') + ')'
        
        // 移除 0x 前缀（TronWeb 的 rawParameter 期望的格式）
        const parameterHexClean = parameterData.startsWith('0x') ? parameterData.slice(2) : parameterData
        
        // 使用 TronWeb 的 triggerSmartContract 方法，传递 rawParameter
        // 这样可以避免直接调用 TronGrid API 导致的 CORS 问题
        // TronWeb 会通过其内部机制处理 RPC 调用
        console.log('[TronLink] 使用 TronWeb triggerSmartContract (rawParameter)...', {
          contractAddress: params.address,
          functionSelector: functionSignature,
          encodedDataLength: parameterHexClean.length,
        })
        
        // 添加重试机制（特别处理 429 错误）
        tx = await retryWithBackoff(
          () => tronWeb.transactionBuilder.triggerSmartContract(
            params.address, // Base58 格式的合约地址
            functionSignature, // 函数签名（用于识别函数）
            {
              feeLimit: options.feeLimit,
              callValue: options.callValue,
              rawParameter: parameterHexClean, // 使用 rawParameter 直接提供编码后的数据
            },
            [], // parameter 留空（因为使用 rawParameter）
            this.currentAccount!.nativeAddress // Base58 格式的发送地址
          ),
          3, // 最多重试 3 次
          500 // 初始延迟 500ms
        )
        
        console.log('[TronLink] 使用 TronWeb API 构建的交易:', tx)
      } else {
        // 对于不包含 tuple[] 的函数，使用原来的方式
        // 构建参数数组
        const parameter = functionAbi.inputs.map((input: any, index: number) => {
          const argValue = params.args![index]
          
          // 处理 tuple 类型（单个 tuple）
          if (input.type === 'tuple' && typeof argValue === 'object' && !Array.isArray(argValue)) {
            if (input.components && Array.isArray(input.components)) {
              return {
                type: input.type,
                value: input.components.map((component: any) => ({
                  type: component.type,
                  value: argValue[component.name]
                }))
              }
            }
          }
          
          // 处理 address 类型：确保是 Base58 格式
          if (input.type === 'address' && typeof argValue === 'string') {
            // 如果已经是 Base58 格式（以 T 开头），直接使用
            if (argValue.startsWith('T') && argValue.length === 34) {
              return {
                type: input.type,
                value: argValue
              }
            }
            // 如果是 hex 格式，转换为 Base58
            try {
              const base58Address = tronWeb.address.fromHex(argValue.startsWith('0x') ? argValue : `0x${argValue}`)
              return {
                type: input.type,
                value: base58Address
              }
            } catch (e) {
              // 转换失败，使用原始值
              return {
                type: input.type,
                value: argValue
              }
            }
          }
          
          // 其他类型直接返回
          return {
            type: input.type,
            value: argValue
          }
        })
        
        console.log('[TronLink] Transaction options:', options)
        console.log('[TronLink] Parameters:', parameter)
        
        // 构建函数选择器（参考 webserver 的实现）
        const functionSelector = params.functionName + '(' + functionAbi.inputs.map((i: any) => i.type).join(',') + ')'
        
        console.log('[TronLink] Function selector:', functionSelector)
        console.log('[TronLink] Transaction options:', options)
        console.log('[TronLink] Parameters:', parameter)
        
        // 使用 triggerSmartContract 触发合约（参考 webserver 的实现）
        // 添加重试机制（特别处理 429 错误）
        tx = await retryWithBackoff(
          () => tronWeb.transactionBuilder.triggerSmartContract(
            params.address,
            functionSelector,
            options,
            parameter,
            this.currentAccount!.nativeAddress
          ),
          3, // 最多重试 3 次
          500 // 初始延迟 500ms
        )
      }
      
      console.log('[TronLink] Transaction built:', tx)
      
      // 验证交易构建结果
      if (!tx || !tx.transaction) {
        throw new Error('Failed to build transaction')
      }
      
      // 请求用户签名（参考 webserver 的实现）
      console.log('[TronLink] Requesting user signature...')
      const signedTx = await tronWeb.trx.sign(tx.transaction)
      return this.broadcastSignedTronTx(signedTx)
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
      // TronLink's injected.js already hits api.trongrid.io on sign/broadcast.
      // Do not poll immediately or double-call getTransaction — free tier is 3 rps.
      await new Promise((resolve) => setTimeout(resolve, 8000))
      const deadline = Date.now() + 180_000
      let delayMs = 8000

      while (Date.now() < deadline) {
        try {
          const txInfo = await tronWeb.trx.getTransactionInfo(txHash)

          if (tronInfoLooksReady(txInfo)) {
            const receipt: TransactionReceipt = {
              transactionHash: txHash,
              blockNumber: txInfo.blockNumber || 0,
              blockHash: txInfo.blockHash || '',
              from: this.currentAccount!.nativeAddress,
              to: txInfo.contract_address || '',
              status: tronInfoFailed(txInfo) ? 'failed' : 'success',
              gasUsed: (txInfo.receipt?.energy_usage_total || 0).toString(),
              logs: txInfo.log || [],
            }

            if (receipt.status === 'failed') {
              const reason = String(txInfo?.receipt?.result || 'FAILED').toUpperCase()
              throw new TransactionFailedError(
                txHash,
                reason === 'OUT_OF_ENERGY'
                  ? 'OUT_OF_ENERGY: feeLimit/energy exhausted before contract finished'
                  : `Transaction failed on Tron network (${reason})`,
              )
            }

            return receipt
          }
        } catch (error) {
          if (error instanceof TransactionFailedError) throw error
          if (isRateLimitError(error)) {
            await new Promise((resolve) => setTimeout(resolve, 12000))
            continue
          }
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs))
        delayMs = Math.min(delayMs + 2000, 15000)
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
    // Modern TronLink: usable tronWeb lives on window.tron after authorize.
    // Legacy: window.tronWeb / window.tronLink.tronWeb.
    const fromTron =
      w.tron?.tronWeb && w.tron.tronWeb !== false ? w.tron.tronWeb : undefined
    return fromTron || w.tronWeb || w.tronLink?.tronWeb
  }

  /**
   * 获取 TronWeb 实例
   */
  private getTronWeb(): any {
    const provider = this.getBrowserProvider()
    if (!provider) {
      throw new Error('未检测到 TronWeb 兼容的钱包。请安装 TronLink 或其他 TronWeb 兼容的钱包。')
    }
    return throttleTronWeb(provider)
  }

  /**
   * 获取下载链接
   */
  protected getDownloadUrl(): string {
    return 'https://www.tronlink.org/'
  }

  /**
   * 设置事件监听
   *
   * TronLink 各版本事件源不一致：优先 TIP-1193 `window.tron`，兼容旧 `tronLink.on`，
   * 并始终启用轮询兜底（仅依赖 on 时，切账户经常不更新）。
   */
  protected setupEventListeners(): void {
    if (typeof window === 'undefined') return

    const w = window as any

    const attach = (target: any, label: string) => {
      if (!target || typeof target.on !== 'function') return false
      try {
        target.on('accountsChanged', this.handleAccountsChanged)
        if (typeof target.on === 'function') {
          target.on('disconnect', this.handleDisconnect)
        }
        return true
      } catch (error) {
        console.warn(`[TronLink] ${label} event attach failed:`, error)
        return false
      }
    }

    attach(w.tron, 'window.tron')
    attach(w.tronLink, 'window.tronLink')

    // Backup: defaultAddress can change without a reliable event on some builds.
    this.startPolling()
  }

  /**
   * 移除事件监听
   */
  protected removeEventListeners(): void {
    if (typeof window === 'undefined') return

    const w = window as any

    const detach = (target: any) => {
      if (!target) return
      try {
        if (typeof target.removeListener === 'function') {
          target.removeListener('accountsChanged', this.handleAccountsChanged)
          target.removeListener('disconnect', this.handleDisconnect)
        } else if (typeof target.off === 'function') {
          target.off('accountsChanged', this.handleAccountsChanged)
          target.off('disconnect', this.handleDisconnect)
        }
      } catch (error) {
        console.warn('TronWeb wallet event detach failed:', error)
      }
    }

    detach(w.tron)
    detach(w.tronLink)
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

    this.pollingInterval = setInterval(() => {
      try {
        const tronWeb = this.getTronWeb()
        // Locked TronLink may set base58 to false — never treat as string.
        const currentAddress = this.readTronAddress(tronWeb)

        if (currentAddress && currentAddress !== this.lastKnownAddress) {
          this.lastKnownAddress = currentAddress
          this.handleAccountsChanged([currentAddress])
        } else if (!currentAddress && this.lastKnownAddress) {
          this.lastKnownAddress = null
          this.handleAccountsChanged([])
        }
      } catch {
        // ignore polling errors
      }
    }, 1500)
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * 处理账户变化（TIP-1193 string[] + legacy object）
   */
  private handleAccountsChanged = (data: unknown) => {
    const address = resolveTronAccountsChangedAddress(data)

    if (!address) {
      this.setState(WalletState.DISCONNECTED)
      this.setAccount(null)
      this.emitAccountChanged(null)
      return
    }

    if (this.currentAccount?.nativeAddress === address) {
      this.lastKnownAddress = address
      return
    }

    const chainId = this.currentAccount?.chainId ?? TronLinkAdapter.TRON_MAINNET_CHAIN_ID
    const account: Account = {
      universalAddress: createUniversalAddress(chainId, address),
      nativeAddress: address,
      chainId,
      chainType: ChainType.TRON,
      isActive: true,
    }
    this.lastKnownAddress = address
    this.setAccount(account)
    this.emitAccountChanged(account)
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

