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
   * Check if running in Telegram environment (Mini App or Web)
   * Both Telegram Mini App (in client) and Telegram Web (web.telegram.org) 
   * provide window.Telegram.WebApp API, so they are treated the same way.
   */
  private isTelegramMiniApp(): boolean {
    if (typeof window === 'undefined') return false
    // @ts-ignore
    const tg = window.Telegram?.WebApp
    if (!tg) return false
    
    // Log platform info for debugging
    // @ts-ignore
    const platform = tg.platform || 'unknown'
    console.log('[WalletConnect Tron] Telegram environment detected:', {
      platform: platform,
      version: tg.version,
      isMiniApp: platform !== 'web', // Mini App if not web platform
      isWeb: platform === 'web',      // Telegram Web if web platform
    })
    
    return true
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

      // Initialize wallet if not already initialized (pass chainId to ensure correct network)
      if (!WalletConnectTronAdapter.walletInstance || 
          WalletConnectTronAdapter.walletProjectId !== this.projectId) {
        this.initializeWallet(targetChainId)
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
   * @param chainId - Optional chain ID to determine network (default: Mainnet)
   */
  private initializeWallet(chainId?: number): void {
    if (WalletConnectTronAdapter.walletInstance && 
        WalletConnectTronAdapter.walletProjectId === this.projectId) {
      return
    }

    // Get valid URL for metadata
    // In Telegram Mini App, window.location.origin might be invalid or empty
    // Also support serveo.net and other tunnel services for development
    let appUrl = ''
    if (typeof window !== 'undefined') {
      try {
        // Try to get origin from window.location
        if (window.location && window.location.origin) {
          appUrl = window.location.origin
        } else if (window.location && window.location.href) {
          // Fallback: extract origin from href
          const url = new URL(window.location.href)
          appUrl = url.origin
        }
      } catch (error) {
        console.warn('[WalletConnect Tron] Failed to get origin from window.location:', error)
      }
      
      // Check if current URL is from serveo.net or other tunnel services
      // These URLs should be allowed in WalletConnect Cloud project settings
      if (appUrl && (
        appUrl.includes('serveo.net') ||
        appUrl.includes('loca.lt') ||
        appUrl.includes('ngrok.io') ||
        appUrl.includes('ngrok-free.app') ||
        appUrl.includes('cloudflared.io')
      )) {
        console.log('[WalletConnect Tron] Detected tunnel service URL:', appUrl)
        console.log('[WalletConnect Tron] ⚠️ Make sure this URL is added to WalletConnect Cloud project allowlist')
      }
      
      // If still empty, try to get from Telegram WebApp
      if (!appUrl) {
        // @ts-ignore
        const tg = window.Telegram?.WebApp
        if (tg && tg.initDataUnsafe?.start_param) {
          // Use a default URL if we can't determine the origin
          appUrl = 'https://enclave.network'
        } else {
          appUrl = 'https://enclave.network' // Default fallback URL
        }
      }
    } else {
      appUrl = 'https://enclave.network' // Server-side fallback
    }

    // Ensure URL is valid (must be https:// or http://)
    if (!appUrl || (!appUrl.startsWith('http://') && !appUrl.startsWith('https://'))) {
      appUrl = 'https://enclave.network'
    }

    // Valid icons array (must be valid URLs)
    const icons = [
      'https://walletconnect.com/walletconnect-logo.svg',
      'https://avatars.githubusercontent.com/u/37784886', // WalletConnect GitHub avatar
    ]

    // Determine network based on chainId
    // WalletConnectChainID.Mainnet = TRON Mainnet
    // WalletConnectChainID.Shasta = TRON Testnet (Shasta)
    // WalletConnectChainID.Nile = TRON Testnet (Nile)
    let network = WalletConnectChainID.Mainnet // Default to mainnet
    
    if (chainId !== undefined) {
      // TRON Mainnet chain ID is 195
      if (chainId === 195 || chainId === WalletConnectTronAdapter.TRON_MAINNET_CHAIN_ID) {
        network = WalletConnectChainID.Mainnet
      } else if (chainId === 201910292) {
        // TRON Testnet (Shasta)
        network = WalletConnectChainID.Shasta
      } else if (chainId === 2494104990) {
        // TRON Testnet (Nile)
        network = WalletConnectChainID.Nile
      }
    }

    // Log detailed metadata configuration for debugging
    const metadataInfo = {
      name: 'Enclave Wallet SDK',
      description: 'Multi-chain wallet adapter for Enclave',
      url: appUrl,
      icons: icons,
      network: network,
      chainId: chainId,
      isTelegram: this.isTelegramMiniApp(),
      projectId: this.projectId,
      urlValid: appUrl && (appUrl.startsWith('http://') || appUrl.startsWith('https://')),
      iconsValid: icons && icons.length > 0 && icons.every(icon => icon && icon.startsWith('http')),
      currentLocation: typeof window !== 'undefined' ? window.location.href : 'N/A',
      telegramPlatform: (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.platform) || 'N/A',
    }
    
    console.log('[WalletConnect Tron] Initializing with metadata:', metadataInfo)
    
    // Warn if configuration might be invalid
    if (!metadataInfo.urlValid) {
      console.warn('[WalletConnect Tron] ⚠️ Invalid URL in metadata:', appUrl)
    }
    if (!metadataInfo.iconsValid) {
      console.warn('[WalletConnect Tron] ⚠️ Invalid icons in metadata:', icons)
    }

    // Create new wallet instance
    // According to official docs: https://developers.tron.network/docs/walletconnect-tron
    //
    // IMPORTANT: If no wallets are registered in WalletConnect Explorer for TRON:
    // - explorerRecommendedWalletIds will have no effect (wallets not in Explorer)
    // - The AppKit will show a QR code for scanning
    // - Users can still connect by scanning the QR code with any WalletConnect-compatible wallet
    // - Deep link (wc://) may work if the wallet app supports it
    //
    // The @tronweb3/walletconnect-tron package uses createAppKit with allWallets: 'HIDE',
    // which means it only shows wallets discovered via WalletConnect Explorer API.
    // If Explorer has no TRON wallets, it will fall back to QR code display.
    //
    // Connection flow:
    // 1. If no wallets in Explorer → Shows QR code
    // 2. User scans QR code with wallet app (TokenPocket, etc.)
    // 3. Wallet app connects via WalletConnect protocol
    // 4. Connection established
    console.log('[WalletConnect Tron] Initializing wallet...', {
      network,
      chainId,
      note: 'If no wallets are in WalletConnect Explorer for TRON, QR code will be displayed for scanning',
    })
    
    WalletConnectTronAdapter.walletInstance = new WalletConnectWallet({
      network: network,
      options: {
        projectId: this.projectId,
        metadata: {
          name: 'Enclave Wallet SDK',
          description: 'Multi-chain wallet adapter for Enclave',
          url: appUrl,
          icons: icons,
        },
      },
      // Theme configuration
      themeMode: 'light',
      themeVariables: {
        '--w3m-z-index': 10000, // Ensure modal appears above Telegram UI
      },
      // Web3Modal configuration for recommended wallets
      // According to official docs: https://developers.tron.network/docs/walletconnect-tron
      // Note: If no wallets are registered in WalletConnect Explorer for TRON,
      // explorerRecommendedWalletIds will have no effect, and QR code will be shown instead.
      // @ts-ignore - web3ModalConfig is supported but may not be in TypeScript types
      web3ModalConfig: {
        themeMode: 'light',
        themeVariables: {
          '--w3m-z-index': 10000,
        },
        /**
         * Recommended Wallets are fetched from WalletConnect explore api:
         * https://walletconnect.com/explorer?type=wallet&version=2
         * 
         * IMPORTANT: If wallets are not registered in Explorer for TRON, this list will be ignored.
         * The AppKit will show a QR code instead, which users can scan with any WalletConnect-compatible wallet.
         * 
         * Wallet IDs (for reference, may not work if not in Explorer):
         * - TokenPocket: 20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66
         * - TronLink: 1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369
         */
        explorerRecommendedWalletIds: [
          // These IDs are kept for when wallets register in WalletConnect Explorer
          // Currently, if no TRON wallets are in Explorer, QR code will be shown
          '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66', // TokenPocket
          '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // TronLink
          '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // TokenPocket (backup)
        ],
      },
    } as any)

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

      // Initialize wallet if needed (pass chainId to ensure correct network)
      if (!WalletConnectTronAdapter.walletInstance || 
          WalletConnectTronAdapter.walletProjectId !== this.projectId) {
        this.initializeWallet(targetChainId)
      }

      this.wallet = WalletConnectTronAdapter.walletInstance

      if (!this.wallet) {
        throw new Error('Failed to initialize WalletConnect wallet')
      }

      // Get network info for error reporting
      let network = WalletConnectChainID.Mainnet
      if (targetChainId === 195) {
        network = WalletConnectChainID.Mainnet
      } else if (targetChainId === 201910292) {
        network = WalletConnectChainID.Shasta
      } else if (targetChainId === 2494104990) {
        network = WalletConnectChainID.Nile
      }

      // Connect to wallet
      // In Telegram Mini App, this may trigger a deep link (wc://) to open the wallet app
      // The official @tronweb3/walletconnect-tron package handles this automatically
      // However, "Invalid App Configuration" error may occur if:
      // 1. Metadata URL/icons are invalid
      // 2. Deep link (wc://) cannot be handled in Telegram Mini App
      // 3. Network/chainId mismatch
      let address: string
      try {
        console.log('[WalletConnect Tron] Attempting to connect...', {
          network,
          chainId: targetChainId,
          isTelegram: this.isTelegramMiniApp(),
          projectId: this.projectId,
        })
        
        const result = await this.wallet.connect()
        address = result.address

        if (!address) {
          throw new ConnectionRejectedError(this.type)
        }
        
        // Log connection success for debugging
        console.log('[WalletConnect Tron] Connection successful:', {
          address,
          network,
          chainId: targetChainId,
          isTelegram: this.isTelegramMiniApp(),
        })
      } catch (error: any) {
        const errorMessage = error.message || String(error)
        const errorCode = error.code || error.error?.code
        const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''
        
        // Extract more detailed error information
        let detailedError = errorMessage
        if (error.error) {
          if (typeof error.error === 'string') {
            detailedError = error.error
          } else if (error.error.message) {
            detailedError = error.error.message
          } else if (error.error.data) {
            detailedError = JSON.stringify(error.error.data)
          }
        }
        
        // Check for common error patterns
        const isNoWalletFound = 
          errorMessage.includes('没有找到支持的钱包') ||
          errorMessage.includes('No matching wallet') ||
          errorMessage.includes('No wallet found') ||
          errorMessage.includes('找不到钱包') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('no matching')
        
        const isTimeout = 
          errorMessage.includes('timeout') ||
          errorMessage.includes('超时') ||
          errorCode === 'TIMEOUT'
        
        const isRejected = 
          errorMessage.includes('rejected') ||
          errorMessage.includes('拒绝') ||
          errorCode === 4001

        // WalletConnect relay reject: origin not allowlisted for this projectId
        const isOriginNotAllowed =
          errorCode === 3000 ||
          /origin not allowed/i.test(errorMessage) ||
          /Unauthorized:\s*origin not allowed/i.test(errorMessage)
        
        // Get current metadata configuration for error reporting
        const currentMetadata = this.wallet ? {
          // Try to get metadata from wallet instance if available
          projectId: this.projectId,
          network: network,
        } : null
        
        // Build detailed error information
        const errorDetails = {
          error: errorMessage,
          detailedError: detailedError,
          code: errorCode,
          isTelegram: this.isTelegramMiniApp(),
          network: network,
          chainId: targetChainId,
          projectId: this.projectId,
          metadata: currentMetadata,
          // Get URL from window.location if available
          currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
          telegramPlatform: (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.platform) || 'N/A',
          errorType: isNoWalletFound ? 'NO_WALLET_FOUND' : 
                     isTimeout ? 'TIMEOUT' : 
                     isRejected ? 'REJECTED' : 
                     'UNKNOWN',
        }
        
        console.error('[WalletConnect Tron] Connection error - Full details:', errorDetails)
        console.error('[WalletConnect Tron] Error object:', error)
        console.error('[WalletConnect Tron] Error stack:', error.stack)
        
        // Handle "No wallet found" error specifically
        if (isNoWalletFound) {
          const noWalletErrorDetails = [
            `\n=== WalletConnect Tron: No Matching Wallet Found ===`,
            `Error: ${errorMessage}`,
            `Detailed: ${detailedError}`,
            `Code: ${errorCode || 'N/A'}`,
            ``,
            `Environment:`,
            `  - Telegram Mini App: ${this.isTelegramMiniApp() ? 'Yes' : 'No'}`,
            `  - Platform: ${errorDetails.telegramPlatform}`,
            `  - Current URL: ${errorDetails.currentUrl}`,
            ``,
            `Configuration:`,
            `  - Project ID: ${this.projectId ? 'Set' : 'Missing'}`,
            `  - Network: ${network}`,
            `  - Chain ID: ${targetChainId}`,
            `  - Metadata URL: ${typeof window !== 'undefined' ? window.location.origin : 'N/A'}`,
            ``,
            `Possible Causes:`,
            `  1. No WalletConnect-compatible wallet (TokenPocket, etc.) installed on device`,
            `  2. Wallet app not opened or not responding to deep link (wc://)`,
            `  3. Deep link handling issue in Telegram Mini App environment`,
            `  4. WalletConnect session timeout (user took too long to approve)`,
            `  5. Network connectivity issue preventing WalletConnect relay connection`,
            ``,
            `Solutions:`,
            `  1. Ensure TokenPocket or other WalletConnect-compatible wallet is installed`,
            `  2. Try opening the wallet app manually before connecting`,
            `  3. In Telegram Mini App, ensure the deep link popup is not blocked`,
            `  4. Try connecting again (may need to wait a few seconds)`,
            `  5. Check network connection and WalletConnect relay server accessibility`,
            ``,
            `For more details, see the error object logged above.`,
            `===========================================\n`,
          ].join('\n')
          
          console.error(noWalletErrorDetails)
          
          throw new ConnectionRejectedError(
            `WalletConnect Tron: 没有找到支持的钱包 (No matching wallet found)\n\n` +
            `可能的原因：\n` +
            `1. 设备上未安装支持 WalletConnect 的钱包（如 TokenPocket）\n` +
            `2. 钱包应用未打开或未响应 deep link (wc://)\n` +
            `3. 在 Telegram Mini App 中，deep link 处理可能有问题\n` +
            `4. 连接超时（用户未及时批准）\n` +
            `5. 网络连接问题\n\n` +
            `解决方案：\n` +
            `1. 确保已安装 TokenPocket 或其他支持 WalletConnect 的钱包\n` +
            `2. 尝试手动打开钱包应用后再连接\n` +
            `3. 在 Telegram Mini App 中，确保 deep link 弹窗未被阻止\n` +
            `4. 稍等几秒后重试连接\n` +
            `5. 检查网络连接和 WalletConnect 中继服务器可访问性\n\n` +
            `详细错误信息请查看控制台日志。`
          )
        }
        
        // Check if it's a configuration error (often related to deep links in Telegram Mini App)
        if (errorMessage.includes('Invalid') || 
            errorMessage.includes('Configuration') ||
            errorMessage.includes('App Config') ||
            errorMessage.includes('Invalid App')) {
          
          // Build detailed configuration error message
          const configErrorDetails = [
            `\n=== WalletConnect Tron Configuration Error ===`,
            `Error: ${errorMessage}`,
            `Detailed: ${detailedError}`,
            `Code: ${errorCode || 'N/A'}`,
            `\nEnvironment:`,
            `  - Telegram Mini App: ${this.isTelegramMiniApp() ? 'Yes' : 'No'}`,
            `  - Platform: ${errorDetails.telegramPlatform}`,
            `  - Current URL: ${errorDetails.currentUrl}`,
            `\nConfiguration:`,
            `  - Project ID: ${this.projectId ? 'Set' : 'Missing'}`,
            `  - Network: ${network}`,
            `  - Chain ID: ${targetChainId}`,
            `\nPossible Causes:`,
            `  1. Deep link (wc://) handling issue in Telegram Mini App`,
            `  2. Invalid metadata configuration (URL or icons not accessible)`,
            `  3. Network/chainId mismatch`,
            `  4. WalletConnect project ID not configured correctly`,
            `  5. Domain not added to WalletConnect Cloud allowlist`,
            `\nPlease check:`,
            `  - WalletConnect Project ID is valid and active`,
            `  - Domain is added to WalletConnect Cloud allowlist (for serveo.net, etc.)`,
            `  - Metadata URL is accessible: Check console for metadata logs`,
            `  - Icons are accessible: Check console for icon URLs`,
            `  - Network matches chainId: Expected ${network} for chainId ${targetChainId}`,
            `\nFor more details, see the error object logged above.`,
            `===========================================\n`,
          ].join('\n')
          
          console.error(configErrorDetails)
          
          throw new ConfigurationError(
            `WalletConnect Tron connection failed: ${errorMessage}\n\n` +
            `Configuration Details:\n` +
            `- Telegram Mini App: ${this.isTelegramMiniApp() ? 'Yes' : 'No'}\n` +
            `- Platform: ${errorDetails.telegramPlatform}\n` +
            `- Origin: ${origin || '(unknown)'}\n` +
            `- Project ID: ${this.projectId ? 'Set' : 'Missing'}\n` +
            `- Network: ${network}\n` +
            `- Chain ID: ${targetChainId}\n\n` +
            `This "Invalid App Configuration" error may be caused by:\n` +
            `1. Deep link (wc://) handling issue in Telegram Mini App\n` +
            `2. Invalid metadata configuration (URL or icons)\n` +
            `3. Network/chainId mismatch\n` +
            `4. Domain not added to WalletConnect Cloud allowlist\n\n` +
            `Please check the console for detailed error information.`
          )
        }

        // Handle WalletConnect Cloud origin allowlist errors with a very explicit action item
        if (isOriginNotAllowed) {
          throw new ConfigurationError(
            `WalletConnect Tron relayer rejected this origin (code 3000: Unauthorized: origin not allowed).\n\n` +
            `Fix:\n` +
            `1) Open WalletConnect Cloud → your project (${this.projectId})\n` +
            `2) Add this site origin to the allowlist:\n` +
            `   - ${origin || '(unknown origin)'}\n\n` +
            `Common dev origins to allow:\n` +
            `- http://localhost:5173\n` +
            `- http://192.168.0.221:5173 (your LAN dev URL)\n` +
            `- https://wallet-test.enclave-hq.com (your Cloudflare Tunnel/custom domain)\n\n` +
            `Original error: ${errorMessage}`
          )
        }
        
        // Handle timeout errors
        if (isTimeout) {
          throw new ConnectionRejectedError(
            `WalletConnect Tron connection timeout. Please try again and ensure your wallet app is open and ready.`
          )
        }
        
        // Handle user rejection
        if (isRejected) {
          throw new ConnectionRejectedError(this.type)
        }
        
        throw error
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
        throw new Error('tron_signMessage is not supported by the connected wallet. Please use a wallet that supports WalletConnect Tron signing, or use TronLink extension for browser-based signing.')
      }

      throw new Error(`WalletConnect Tron sign message failed: ${errorMessage}`)
    }
  }

  /**
   * Sign transaction
   * 
   * @param transaction - Tron transaction object
   *                      Can be created using TronWeb (if available) or any TRON transaction builder
   *                      Format: { raw_data: {...}, raw_data_hex: "...", txID: "..." }
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
        throw new Error('tron_signTransaction is not supported by the connected wallet. Please use a wallet that supports WalletConnect Tron signing, or use TronLink extension for browser-based signing.')
      }

      throw new Error(`WalletConnect Tron sign transaction failed: ${errorMessage}`)
    }
  }

  /**
   * Read contract (not supported by WalletConnect)
   */
  async readContract<T = any>(_params: ContractReadParams): Promise<T> {
    this.ensureConnected()
    throw new Error('WalletConnect Tron does not support direct contract reading. Please use direct Tron RPC calls or a wallet extension (like TronLink) for read operations.')
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
