/**
 * TRON Deep Link Adapter
 * 
 * Supports deep linking to mobile TRON wallets (TokenPocket, TronLink, etc.)
 * Uses wallet-specific URL schemes to launch mobile wallet apps
 * 
 * References:
 * - TokenPocket: https://help.tokenpocket.pro/developer-cn/scan-protocol/tron
 * - TronLink: https://docs.tronlink.org/zh/mobile/deeplink
 */

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
import { 
  ConnectionRejectedError, 
  SignatureRejectedError,
  MethodNotSupportedError,
} from '../../core/errors'

/**
 * Supported deep link wallet types
 */
export enum DeepLinkWalletType {
  TOKENPOCKET = 'tokenpocket',
  TRONLINK = 'tronlink',
}

/**
 * TRON Deep Link Adapter
 * 
 * Supports connecting to mobile TRON wallets via deep links
 * This is useful when WalletConnect is not available or when you want
 * to directly launch a specific wallet app
 */
export class TronDeepLinkAdapter extends WalletAdapter {
  readonly type = WalletType.TRONLINK // Reuse TRONLINK type for now
  readonly chainType = ChainType.TRON
  readonly name: string
  readonly icon: string

  private walletType: DeepLinkWalletType
  private callbackUrl?: string
  private callbackSchema?: string
  private pendingActions: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map()

  // TRON Mainnet chain ID
  private static readonly TRON_MAINNET_CHAIN_ID = 195

  constructor(
    walletType: DeepLinkWalletType = DeepLinkWalletType.TOKENPOCKET,
    options?: {
      callbackUrl?: string
      callbackSchema?: string
    }
  ) {
    super()
    this.walletType = walletType
    this.callbackUrl = options?.callbackUrl
    this.callbackSchema = options?.callbackSchema
    
    // Set name and icon based on wallet type
    if (walletType === DeepLinkWalletType.TOKENPOCKET) {
      this.name = 'TokenPocket (Deep Link)'
      this.icon = 'https://tokenpocket.pro/icon.png'
    } else if (walletType === DeepLinkWalletType.TRONLINK) {
      this.name = 'TronLink (Deep Link)'
      this.icon = 'https://www.tronlink.org/static/logoIcon.svg'
    } else {
      this.name = 'TRON Deep Link'
      this.icon = 'https://www.tronlink.org/static/logoIcon.svg'
    }

    // Setup callback handler for TokenPocket
    if (walletType === DeepLinkWalletType.TOKENPOCKET && typeof window !== 'undefined') {
      this.setupCallbackHandler()
    }
  }

  /**
   * Setup callback handler for TokenPocket deep link results
   * 
   * According to TokenPocket docs:
   * - callbackUrl: Wallet sends result to this URL (server-side callback)
   * - callbackSchema: Wallet launches H5 app through this schema (client-side callback)
   * 
   * For H5 apps, we use callbackSchema to receive results in the same page
   */
  private setupCallbackHandler(): void {
    if (typeof window === 'undefined') {
      return
    }

    // Listen for page visibility change (user returns from wallet app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[TronDeepLink] Page became visible, user may have returned from wallet app')
        // Check if there's a callback in URL parameters
        this.checkCallbackFromUrl()
      }
    })

    // Check URL parameters on load (in case app was opened via callbackSchema)
    this.checkCallbackFromUrl()
  }

  /**
   * Check if callback result is in URL parameters
   * TokenPocket may append callback results to URL when using callbackSchema
   */
  private checkCallbackFromUrl(): void {
    if (typeof window === 'undefined') {
      return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const actionId = urlParams.get('actionId')
    const result = urlParams.get('result')
    const error = urlParams.get('error')

    if (actionId && this.pendingActions.has(actionId)) {
      const { resolve, reject } = this.pendingActions.get(actionId)!
      
      if (error) {
        reject(new Error(error))
      } else if (result) {
        try {
          const parsedResult = JSON.parse(decodeURIComponent(result))
          resolve(parsedResult)
        } catch (e) {
          resolve(result)
        }
      }
      
      this.pendingActions.delete(actionId)
      
      // Clean URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }

  /**
   * Check if deep link is available (mobile device or Telegram Mini App)
   * 
   * Note: In Telegram Mini App, we're more lenient - even if platform detection
   * fails, deep links may still work, so the caller should handle Telegram Mini App
   * separately if needed.
   */
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false
    }

    // Check if in Telegram Mini App (which can run on mobile)
    // @ts-ignore
    const isTelegramMiniApp = !!(window.Telegram && window.Telegram.WebApp)
    if (isTelegramMiniApp) {
      // @ts-ignore
      const platform = window.Telegram.WebApp.platform || 'unknown'
      // @ts-ignore
      const version = window.Telegram.WebApp.version || 'unknown'
      
      // Telegram Mini App on mobile platforms (ios, android) can use deep links
      // Even on web platform, deep links might work in some cases
      // So we return true for Telegram Mini App to be more permissive
      console.log(`[TronDeepLink] Telegram Mini App detected, platform: ${platform}, version: ${version}`)
      
      // If platform is unknown, try to detect from user agent
      if (platform === 'unknown') {
        const userAgent = navigator.userAgent || ''
        if (/iPhone|iPad|iPod/i.test(userAgent)) {
          console.log(`[TronDeepLink] Detected iOS from user agent`)
        } else if (/Android/i.test(userAgent)) {
          console.log(`[TronDeepLink] Detected Android from user agent`)
        }
      }
      
      // Return true for Telegram Mini App - let the app decide based on platform
      // The example app can handle this more gracefully
      return true
    }

    // Deep links work on mobile devices
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )

    return isMobile
  }


  /**
   * Connect wallet via deep link
   * 
   * IMPORTANT: Deep links for TRON wallets are primarily for SIGNING, not connection.
   * TokenPocket and TronLink deep links support:
   * - Signing transactions: tron:signTransaction-version=1.0&protocol=TokenPocket&network=tron&chain_id=195&data={...}
   * - Signing messages: tron:signMessage-version=1.0&protocol=TokenPocket&network=tron&chain_id=195&data={...}
   * 
   * For CONNECTION, you should use:
   * - WalletConnect (recommended for mobile)
   * - Browser extension (TronWeb/TronLink)
   * 
   * Note: You can sign directly using signMessage() or signTransaction() without calling connect() first.
   * The wallet app will open and use the user's account automatically.
   * 
   * This method attempts to open the wallet app, but cannot establish a connection
   * or retrieve the wallet address directly. The user must complete connection
   * through WalletConnect or browser extension after opening the app.
   */
  async connect(chainId?: number | number[]): Promise<Account> {
    if (typeof window === 'undefined') {
      throw new Error('Deep link requires a browser environment')
    }

    // For deep link adapter, use first chain ID if array is provided
    const targetChainId = Array.isArray(chainId) 
      ? (chainId[0] || TronDeepLinkAdapter.TRON_MAINNET_CHAIN_ID) 
      : (chainId || TronDeepLinkAdapter.TRON_MAINNET_CHAIN_ID)

    try {
      this.setState(WalletState.CONNECTING)

      // Check if deep link is available (mobile device or Telegram Mini App)
      const isAvailable = await this.isAvailable()
      if (!isAvailable) {
        // @ts-ignore
        const isTelegram = !!(window.Telegram && window.Telegram.WebApp)
        if (isTelegram) {
          // @ts-ignore
          const platform = window.Telegram?.WebApp?.platform || 'unknown'
          throw new Error(
            `Deep link is not available in Telegram Mini App on ${platform} platform. ` +
            `Please use WalletConnect or browser extension, or test on a mobile device.`
          )
        } else {
          throw new Error('Deep link is only available on mobile devices or Telegram Mini App. Please use WalletConnect or browser extension.')
        }
      }

      // Construct deep link URL to open wallet app
      let deepLinkUrl = ''
      
      if (this.walletType === DeepLinkWalletType.TOKENPOCKET) {
        // TokenPocket: Open app (connection must be done via WalletConnect)
        // TokenPocket deep links are for signing, not connection
        // But we can open the app to help user get started
        // Using tpoutside:// format (official format)
        const actionId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        const param = {
          action: 'login', // Login action to open wallet
          actionId: actionId,
          blockchains: [{
            chainId: String(targetChainId),
            network: 'tron'
          }],
          dappName: 'Enclave Wallet SDK',
          dappIcon: 'https://walletconnect.com/walletconnect-logo.svg',
          protocol: 'TokenPocket',
          version: '1.0',
          expired: 1602, // 30 minutes
        }
        const encodedParam = encodeURIComponent(JSON.stringify(param))
        deepLinkUrl = `tpoutside://pull.activity?param=${encodedParam}`
      } else if (this.walletType === DeepLinkWalletType.TRONLINK) {
        // TronLink: Open app
        deepLinkUrl = `tronlink://open?action=connect&network=tron`
      }

      if (!deepLinkUrl) {
        throw new Error(`Unsupported wallet type: ${this.walletType}`)
      }

      console.log(`[TronDeepLink] ===== Connect via Deep Link =====`)
      console.log(`[TronDeepLink] Wallet Type:`, this.walletType)
      console.log(`[TronDeepLink] Chain ID:`, targetChainId)
      console.log(`[TronDeepLink] Deep Link URL:`, deepLinkUrl)
      console.log(`[TronDeepLink] Note: Deep links are for signing, not connection. ` +
        `After opening the app, please use WalletConnect to establish connection.`)
      console.log(`[TronDeepLink] ==================================`)

      // Open deep link
      // This will attempt to open the wallet app
      window.location.href = deepLinkUrl

      // Wait a bit for the app to open
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Deep links cannot return connection status or address
      // User must complete connection via WalletConnect or browser extension
      throw new ConnectionRejectedError(
        `已打开 ${this.walletType === DeepLinkWalletType.TOKENPOCKET ? 'TokenPocket' : 'TronLink'} 应用。\n\n` +
        `注意：深度链接主要用于签名交易，不能直接建立连接。\n\n` +
        `请使用以下方式完成连接：\n` +
        `1. 在钱包应用中使用 WalletConnect 扫描二维码\n` +
        `2. 或使用浏览器扩展（如 TronLink）连接\n\n` +
        `Deep link opened ${this.walletType} app. ` +
        `Please use WalletConnect or browser extension to complete the connection.`
      )

    } catch (error: any) {
      this.setState(WalletState.ERROR)
      this.setAccount(null)

      if (error instanceof ConnectionRejectedError) {
        throw error
      }

      throw new Error(`Failed to open ${this.walletType} via deep link: ${error.message}`)
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
  }

  /**
   * Sign message via deep link
   * 
   * TokenPocket deep link format for signing:
   * tron:signMessage-version=1.0&protocol=TokenPocket&network=tron&chain_id=195&data={message}
   * 
   * Reference: https://help.tokenpocket.pro/developer-cn/scan-protocol/tron
   * 
   * Note: Deep links can sign directly without establishing a connection first.
   * The wallet app will open and use the user's account to sign the message.
   * The signature result will be returned via callback URL or app-to-app communication.
   */
  async signMessage(message: string): Promise<string> {
    // Deep links don't require connection - they directly open the wallet app
    // The wallet app already has the user's account information

    if (typeof window === 'undefined') {
      throw new Error('Deep link requires a browser environment')
    }

    const isAvailable = await this.isAvailable()
    if (!isAvailable) {
      // @ts-ignore
      const isTelegram = !!(window.Telegram && window.Telegram.WebApp)
      if (isTelegram) {
        // @ts-ignore
        const platform = window.Telegram?.WebApp?.platform || 'unknown'
        throw new Error(
          `Deep link signing is not available in Telegram Mini App on ${platform} platform. ` +
          `Please use WalletConnect or test on a mobile device.`
        )
      } else {
        throw new Error('Deep link signing is only available on mobile devices or Telegram Mini App.')
      }
    }

    // Construct deep link for signing
    let deepLinkUrl = ''
    
    if (this.walletType === DeepLinkWalletType.TOKENPOCKET) {
      // TokenPocket sign message deep link
      // Using tpoutside://pull.activity format (recommended by official docs)
      // See: https://help.tokenpocket.pro/developer-en/wallet/pull-up-wallet-with-deeplink
      // 
      // Alternative format (QRCode Protocol): tron:signMessage-version=1.0&protocol=TokenPocket&network=tron&chain_id=195&data={message}
      // But this format may not work reliably, so we use tpoutside:// format
      
      // Generate unique actionId
      const actionId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      
      // Build param object according to TokenPocket docs
      const param = {
        action: 'sign',
        actionId: actionId,
        message: message,
        hash: false,
        signType: 'ethPersonalSign', // For TRON, we use ethPersonalSign as it's similar
        memo: 'TRON message signature',
        blockchains: [{
          chainId: '195', // TRON Mainnet chain ID as string
          network: 'tron'
        }],
        dappName: 'Enclave Wallet SDK',
        dappIcon: 'https://walletconnect.com/walletconnect-logo.svg',
        protocol: 'TokenPocket',
        version: '1.1.8',
        expired: 0, // No expiration
        // callbackUrl: optional, if you want to receive callback
        // callbackSchema: optional, custom schema for callback
      }
      
      const encodedParam = encodeURIComponent(JSON.stringify(param))
      deepLinkUrl = `tpoutside://pull.activity?param=${encodedParam}`
      
      console.log(`[TronDeepLink] Using TokenPocket tpoutside:// format for signMessage`)
      console.log(`[TronDeepLink] Param object:`, param)
    } else if (this.walletType === DeepLinkWalletType.TRONLINK) {
      // TronLink sign message deep link (if supported)
      const encodedMessage = encodeURIComponent(message)
      deepLinkUrl = `tronlink://signMessage?message=${encodedMessage}`
    }

    if (!deepLinkUrl) {
      throw new MethodNotSupportedError('signMessage', this.type)
    }

    console.log(`[TronDeepLink] ===== Sign Message via Deep Link =====`)
    console.log(`[TronDeepLink] Wallet Type:`, this.walletType)
    console.log(`[TronDeepLink] Message:`, message)
    console.log(`[TronDeepLink] Deep Link URL:`, deepLinkUrl)
    console.log(`[TronDeepLink] Full URL length:`, deepLinkUrl.length)
    console.log(`[TronDeepLink] ========================================`)

    // Open deep link
    window.location.href = deepLinkUrl

    // Note: Deep links don't return the signature directly
    // The wallet app will handle signing and may return the result via callback
    // This is a limitation of deep link approach
    throw new Error(
      `Deep link opened ${this.walletType} for signing. ` +
      `The signature will be handled by the wallet app. ` +
      `This adapter cannot retrieve the signature directly from deep links. ` +
      `Consider using WalletConnect or browser extension for programmatic signing.`
    )
  }

  /**
   * Sign transaction via deep link
   * 
   * TokenPocket deep link format:
   * tron:signTransaction-version=1.0&protocol=TokenPocket&network=tron&chain_id=195&data={transaction}
   * 
   * Reference: https://help.tokenpocket.pro/developer-cn/scan-protocol/tron
   * 
   * Note: Deep links can sign directly without establishing a connection first.
   * The wallet app will open and use the user's account to sign the transaction.
   * The transaction data should be a JSON string containing the TRON transaction object.
   * The signature result will be returned via callback URL or app-to-app communication.
   */
  async signTransaction(transaction: any): Promise<string> {
    // Deep links don't require connection - they directly open the wallet app
    // The wallet app already has the user's account information

    if (typeof window === 'undefined') {
      throw new Error('Deep link requires a browser environment')
    }

    const isAvailable = await this.isAvailable()
    if (!isAvailable) {
      // @ts-ignore
      const isTelegram = !!(window.Telegram && window.Telegram.WebApp)
      if (isTelegram) {
        // @ts-ignore
        const platform = window.Telegram?.WebApp?.platform || 'unknown'
        throw new Error(
          `Deep link signing is not available in Telegram Mini App on ${platform} platform. ` +
          `Please use WalletConnect or test on a mobile device.`
        )
      } else {
        throw new Error('Deep link signing is only available on mobile devices or Telegram Mini App.')
      }
    }

    // Construct deep link for transaction signing
    let deepLinkUrl = ''
    let actionId = ''
    let param: any = null
    
    if (this.walletType === DeepLinkWalletType.TOKENPOCKET) {
      // TokenPocket sign transaction deep link
      // Using tpoutside://pull.activity format (recommended by official docs)
      // See: https://help.tokenpocket.pro/developer-en/wallet/pull-up-wallet-with-deeplink
      // 
      // Alternative format (QRCode Protocol): tron:signTransaction-version=1.0&protocol=TokenPocket&network=tron&chain_id=195&data={transaction}
      // But this format may not work reliably, so we use tpoutside:// format
      
      // Generate unique actionId
      actionId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      
      // Prepare transaction data
      let transactionData: string
      if (typeof transaction === 'string') {
        transactionData = transaction
      } else if (transaction.raw_data_hex) {
        // If transaction has raw_data_hex, use it directly
        transactionData = JSON.stringify(transaction)
      } else {
        // Convert transaction object to JSON string
        transactionData = JSON.stringify(transaction)
      }
      
      // Build param object according to TokenPocket docs
      // See: https://help.tokenpocket.pro/developer-en/wallet/pull-up-wallet-with-deeplink
      // For TRON, we need to convert the transaction to the format TokenPocket expects
      param = {
        action: 'pushTransaction',
        actionId: actionId,
        txData: transactionData, // Transaction data as JSON string
        blockchains: [{
          chainId: '195', // TRON Mainnet chain ID as string
          network: 'tron'
        }],
        dappName: 'Enclave Wallet SDK',
        dappIcon: 'https://walletconnect.com/walletconnect-logo.svg',
        protocol: 'TokenPocket',
        version: '1.1.8',
        expired: 0, // No expiration
      }

      // Add callback configuration
      // callbackUrl: Server-side callback (wallet sends POST request to this URL)
      // callbackSchema: Client-side callback (wallet opens H5 app with this schema)
      // For H5 apps, callbackSchema is more suitable
      if (this.callbackSchema) {
        param.callbackSchema = this.callbackSchema
      } else if (this.callbackUrl) {
        param.callbackUrl = this.callbackUrl
      } else {
        // Default: use current page URL as callbackSchema
        // TokenPocket will append ?actionId=xxx&result=xxx to the URL
        if (typeof window !== 'undefined' && window.location) {
          param.callbackSchema = `${window.location.protocol}//${window.location.host}${window.location.pathname}`
        }
      }
      
      const encodedParam = encodeURIComponent(JSON.stringify(param))
      deepLinkUrl = `tpoutside://pull.activity?param=${encodedParam}`
      
      console.log(`[TronDeepLink] Using TokenPocket tpoutside:// format for signTransaction`)
      console.log(`[TronDeepLink] Param object (without txData):`, { ...param, txData: '[TRANSACTION DATA]' })
    } else if (this.walletType === DeepLinkWalletType.TRONLINK) {
      // TronLink sign transaction deep link (if supported)
      // Reference: https://docs.tronlink.org/zh/mobile/deeplink
      const transactionData = typeof transaction === 'string' 
        ? transaction 
        : JSON.stringify(transaction)
      const encodedData = encodeURIComponent(transactionData)
      deepLinkUrl = `tronlink://signTransaction?transaction=${encodedData}`
    }

    if (!deepLinkUrl) {
      throw new MethodNotSupportedError('signTransaction', this.type)
    }

    console.log(`[TronDeepLink] ===== Sign Transaction via Deep Link =====`)
    console.log(`[TronDeepLink] Wallet Type:`, this.walletType)
    console.log(`[TronDeepLink] Transaction:`, transaction)
    console.log(`[TronDeepLink] Transaction keys:`, transaction ? Object.keys(transaction) : 'N/A')
    if (transaction && typeof transaction === 'object') {
      console.log(`[TronDeepLink] Transaction has raw_data:`, !!transaction.raw_data)
      console.log(`[TronDeepLink] Transaction has raw_data_hex:`, !!transaction.raw_data_hex)
      console.log(`[TronDeepLink] Transaction has txID:`, !!transaction.txID)
    }
    if (actionId) {
      console.log(`[TronDeepLink] Action ID:`, actionId)
    }
    if (param) {
      console.log(`[TronDeepLink] Callback Schema:`, param.callbackSchema || param.callbackUrl || 'None')
    }
    console.log(`[TronDeepLink] Deep Link URL:`, deepLinkUrl)
    console.log(`[TronDeepLink] Full URL length:`, deepLinkUrl.length)
    if (deepLinkUrl.length > 200) {
      console.log(`[TronDeepLink] URL (first 200 chars):`, deepLinkUrl.substring(0, 200) + '...')
      console.log(`[TronDeepLink] URL (last 100 chars):`, '...' + deepLinkUrl.substring(deepLinkUrl.length - 100))
    }
    console.log(`[TronDeepLink] ===========================================`)

    // For TokenPocket with callbackSchema, we can wait for the callback
    if (this.walletType === DeepLinkWalletType.TOKENPOCKET && param && param.callbackSchema) {
      // Create a promise that will be resolved when callback is received
      return new Promise<string>((resolve, reject) => {
        this.pendingActions.set(actionId, { resolve, reject })
        
        // Open deep link
        window.location.href = deepLinkUrl
        
        // Set timeout (30 seconds)
        setTimeout(() => {
          if (this.pendingActions.has(actionId)) {
            this.pendingActions.delete(actionId)
            reject(new Error('Transaction signature timeout: No response from wallet app'))
          }
        }, 30000)
      })
    }

    // Open deep link
    window.location.href = deepLinkUrl

    // Note: Deep links don't return the signature directly
    throw new SignatureRejectedError(
      `已打开 ${this.walletType === DeepLinkWalletType.TOKENPOCKET ? 'TokenPocket' : 'TronLink'} 进行交易签名。\n\n` +
      `注意：深度链接无法直接返回签名结果。\n\n` +
      `签名结果将通过以下方式返回：\n` +
      `1. 钱包应用的回调 URL\n` +
      `2. 应用间通信（App-to-App）\n\n` +
      `如需程序化获取签名，请使用 WalletConnect 或浏览器扩展。\n\n` +
      `Deep link opened ${this.walletType} for transaction signing. ` +
      `The signature will be handled by the wallet app via callback. ` +
      `For programmatic signing, use WalletConnect or browser extension.`
    )
  }

  /**
   * Read contract (not supported via deep link)
   */
  async readContract<T = any>(_params: ContractReadParams): Promise<T> {
    throw new MethodNotSupportedError('readContract', this.type)
  }

  /**
   * Write contract (not supported via deep link)
   */
  async writeContract(_params: ContractWriteParams): Promise<string> {
    throw new MethodNotSupportedError('writeContract', this.type)
  }

  /**
   * Estimate gas (not supported)
   */
  async estimateGas(_params: ContractWriteParams): Promise<bigint> {
    throw new MethodNotSupportedError('estimateGas', this.type)
  }

  /**
   * Wait for transaction (not supported)
   */
  async waitForTransaction(_txHash: string, _confirmations?: number): Promise<TransactionReceipt> {
    throw new MethodNotSupportedError('waitForTransaction', this.type)
  }

  /**
   * Get provider (not applicable for deep links)
   */
  getProvider(): any {
    return null
  }
}

