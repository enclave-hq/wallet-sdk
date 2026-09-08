/**
 * WalletConnect Adapter
 */

import EthereumProvider from '@walletconnect/ethereum-provider'
import { createWalletClient, createPublicClient, custom, http, type WalletClient, type PublicClient } from 'viem'
import { WalletAdapter } from '../base/wallet-adapter'
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
import { 
  ConnectionRejectedError, 
  SignatureRejectedError, 
  TransactionFailedError,
  ConfigurationError,
} from '../../core/errors'
import { evmPersonalSignParams, toEip1193Quantity } from '../../utils/hex'
import { getChainInfo, normalizeToEvmChainId } from '../../utils/chain-info'

/**
 * WalletConnect Adapter
 */
export class WalletConnectAdapter extends WalletAdapter {
  readonly type = WalletType.WALLETCONNECT
  readonly chainType = ChainType.EVM
  readonly name = 'WalletConnect'
  readonly icon = 'https://avatars.githubusercontent.com/u/37784886'

  private provider: InstanceType<typeof EthereumProvider> | null = null
  private walletClient: WalletClient | null = null
  private publicClient: PublicClient | null = null
  private projectId: string
  private supportedChains: number[] = [] // Store supported chains from connection

  // Static provider instance to avoid multiple initializations
  private static providerInstance: InstanceType<typeof EthereumProvider> | null = null
  private static providerProjectId: string | null = null
  private static providerChains: number[] | null = null // Store the chains used during initialization
  private static isInitializing: boolean = false
  private static initPromise: Promise<InstanceType<typeof EthereumProvider>> | null = null

  constructor(projectId: string) {
    super()
    if (!projectId) {
      throw new ConfigurationError('WalletConnect projectId is required')
    }
    this.projectId = projectId
  }

  /**
   * Check if WalletConnect is available
   * WalletConnect is always available (it's a web-based connection)
   * Also works in Telegram Mini Apps
   */
  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined'
  }

  /**
   * Check if running in Telegram environment (Mini App or Web)
   * Both Telegram Mini App (in client) and Telegram Web (web.telegram.org) 
   * provide window.Telegram.WebApp API, so they are treated the same way.
   * 
   * Reference: https://docs.reown.com/appkit/integrations/telegram-mini-apps
   */
  private isTelegramMiniApp(): boolean {
    if (typeof window === 'undefined') return false
    
    // Check for Telegram WebApp API
    // This works in both:
    // - Telegram Mini App (in Telegram client: iOS, Android, Desktop)
    // - Telegram Web (web.telegram.org)
    // @ts-ignore
    const tg = window.Telegram?.WebApp
    if (!tg) return false
    
    // Log platform info for debugging
    // @ts-ignore
    const platform = tg.platform || 'unknown'
    console.log('[WalletConnect] Telegram environment detected:', {
      platform: platform,
      version: tg.version,
      isMiniApp: platform !== 'web', // Mini App if not web platform
      isWeb: platform === 'web',      // Telegram Web if web platform
    })
    
    return true
  }

  /**
   * Get Telegram WebApp instance if available
   */
  private getTelegramWebApp(): any {
    if (typeof window === 'undefined') return null
    // @ts-ignore
    return window.Telegram?.WebApp || null
  }

  /**
   * Close Telegram deep link popup (wc:// links)
   * In Telegram Mini Apps, WalletConnect may open a wc:// deep link popup
   * that doesn't automatically close after the operation completes.
   * This method attempts to close it by:
   * 1. Trying to close any open windows/popups
   * 2. Using Telegram WebApp API if available
   * 3. Navigating back or closing the popup
   */
  private closeTelegramDeepLinkPopup(): void {
    if (!this.isTelegramMiniApp()) {
      return
    }

    try {
      const tg = this.getTelegramWebApp()
      if (!tg) {
        return
      }

      // Method 1: Try to close any open windows (popups opened by WalletConnect)
      // Check if there are any child windows or popups
      if (typeof window !== 'undefined') {
        // Try to close any popup windows that might have been opened
        // Note: We can't directly access popup windows due to CORS, but we can try to focus back
        window.focus()
        
        // Method 2: Use Telegram WebApp's back button or close functionality
        // If there's a back button visible, it might indicate a popup is open
        if (tg.BackButton && tg.BackButton.isVisible) {
          // Simulate back button click to close the popup
          console.log('[WalletConnect] Closing Telegram deep link popup via BackButton')
          // Note: We can't programmatically click the back button, but we can hide it
          // The popup should close automatically when the operation completes
        }

        // Method 3: Wait a bit and then try to close any wc:// protocol handlers
        // Some wallets may leave the popup open, so we try to close it after a delay
        setTimeout(() => {
          // Try to detect if a popup is still open by checking window focus
          if (document.hasFocus()) {
            // Main window has focus, popup might have closed
            console.log('[WalletConnect] Main window has focus, popup likely closed')
          } else {
            // Try to bring focus back to main window
            window.focus()
            console.log('[WalletConnect] Attempted to focus main window to close popup')
          }
        }, 500) // Wait 500ms for the wallet to process the response

        // Method 4: Listen for visibility change (popup closing)
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            console.log('[WalletConnect] Page became visible, popup may have closed')
            // Clean up listener
            document.removeEventListener('visibilitychange', handleVisibilityChange)
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        
        // Clean up listener after 2 seconds
        setTimeout(() => {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }, 2000)
      }
    } catch (error) {
      console.warn('[WalletConnect] Error closing Telegram deep link popup:', error)
    }
  }

  /**
   * Connect wallet
   * 
   * @param chainId - Single chain ID or array of chain IDs to request
   *                  If array is provided, wallet will be requested to connect to multiple chains
   *                  When multiple chains are requested, the wallet can switch between them
   *                  Default: 1 (Ethereum Mainnet)
   * 
   * @example
   * // Single chain
   * await adapter.connect(1) // Ethereum only
   * 
   * @example
   * // Multiple chains
   * await adapter.connect([1, 56, 137]) // Ethereum, BSC, Polygon
   */
  async connect(chainId?: number | number[]): Promise<Account> {
    if (typeof window === 'undefined') {
      throw new Error('WalletConnect requires a browser environment')
    }

    // First, check if we have a static provider instance that's already connected
    // This handles cases where state was lost (e.g., page refresh) but provider still has session
    if (WalletConnectAdapter.providerInstance && 
        WalletConnectAdapter.providerProjectId === this.projectId) {
      const existingProvider = WalletConnectAdapter.providerInstance
      if (existingProvider.accounts && existingProvider.accounts.length > 0) {
        // Provider has active session, reuse it
        this.provider = existingProvider
        
        // Support both single chain ID and array of chain IDs
        let targetChains: number[]
        if (Array.isArray(chainId)) {
          targetChains = chainId.length > 0 ? chainId : [1]
        } else if (chainId) {
          targetChains = [chainId]
        } else {
          targetChains = [1] // Default to Ethereum Mainnet
        }

        // Update supported chains if new chains are requested
        const existingChains = this.supportedChains || []
        const mergedChains = [...new Set([...existingChains, ...targetChains])]
        this.supportedChains = mergedChains

        // Get current chain ID
        const currentChainId = existingProvider.chainId || targetChains[0]
        const address = formatEVMAddress(existingProvider.accounts[0])
        
        // Create account info
        const account: Account = {
          universalAddress: createUniversalAddress(currentChainId, address),
          nativeAddress: address,
          chainId: currentChainId,
          chainType: ChainType.EVM,
          isActive: true,
        }

        this.setState(WalletState.CONNECTED)
        this.setAccount(account)
        
        // Setup event listeners if not already set up
        if (!this.walletClient) {
          const viemChain = this.getViemChain(currentChainId) as any
          this.walletClient = createWalletClient({
            account: existingProvider.accounts[0] as `0x${string}`,
            chain: viemChain,
            transport: custom(existingProvider),
          })
          
          const chainInfo = getChainInfo(currentChainId)
          const primaryRpcUrl = chainInfo?.rpcUrls[0]
          this.publicClient = createPublicClient({
            chain: viemChain,
            transport: primaryRpcUrl ? http(primaryRpcUrl) : custom(existingProvider),
          }) as any
          
          this.setupEventListeners()
        }

        console.log('[WalletConnect] Reusing existing provider session')
        return account
      }
    }

    // Check if already connected - reuse existing connection
    if (this.state === WalletState.CONNECTED && this.currentAccount && this.provider) {
      // Check if provider still has active session
      if (this.provider.accounts && this.provider.accounts.length > 0) {
        // If already connected, check if we need to update supported chains
        // Support both single chain ID and array of chain IDs
        let targetChains: number[]
        if (Array.isArray(chainId)) {
          targetChains = chainId.length > 0 ? chainId : [1]
        } else if (chainId) {
          targetChains = [chainId]
        } else {
          targetChains = [1] // Default to Ethereum Mainnet
        }

        // Update supported chains if new chains are requested
        // Merge with existing chains to avoid losing previously connected chains
        const existingChains = this.supportedChains || []
        const mergedChains = [...new Set([...existingChains, ...targetChains])]
        this.supportedChains = mergedChains

        // Return existing account
        console.log('[WalletConnect] Already connected, reusing existing connection')
        return this.currentAccount
      } else {
        // Provider exists but no accounts, reset state
        this.setState(WalletState.DISCONNECTED)
        this.setAccount(null)
        this.provider = null
      }
    }

    try {
      this.setState(WalletState.CONNECTING)

      // Support both single chain ID and array of chain IDs
      let targetChains: number[]
      if (Array.isArray(chainId)) {
        targetChains = chainId.length > 0 ? chainId : [1]
      } else if (chainId) {
        targetChains = [chainId]
      } else {
        targetChains = [1] // Default to Ethereum Mainnet
      }

      // Store supported chains for later use
      this.supportedChains = targetChains

      // Initialize WalletConnect provider with multiple chains
      // EthereumProvider v2 requires:
      // - chains: primary chain (required, at least one)
      // - optionalChains: additional chains (required, at least one)
      const primaryChain = targetChains[0]
      const optionalChains = targetChains.slice(1)

      // Build init options
      // For Telegram Mini Apps, we may need to adjust the modal behavior
      const isTelegram = this.isTelegramMiniApp()
      const telegramWebApp = this.getTelegramWebApp()
      
      // Get valid URL for metadata
      // In Telegram Mini App, window.location.origin might be invalid or empty
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
          console.warn('[WalletConnect] Failed to get origin from window.location:', error)
        }
        
        // If still empty, use default URL
        if (!appUrl) {
          appUrl = 'https://enclave.network' // Default fallback URL
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
      
      const initOptions: any = {
        projectId: this.projectId,
        chains: [primaryChain], // Primary chain (required)
        showQrModal: true, // QR modal works in Telegram Mini Apps
        metadata: {
          name: 'Enclave Wallet SDK',
          description: 'Multi-chain wallet adapter for Enclave',
          url: appUrl,
          icons: icons,
        },
      }

      // Telegram environment specific configuration (Mini App or Web)
      // Both Telegram Mini App and Telegram Web provide the same WebApp API
      // Reference: https://docs.reown.com/appkit/integrations/telegram-mini-apps
      if (isTelegram && telegramWebApp) {
        // @ts-ignore
        const platform = telegramWebApp.platform || 'unknown'
        const isMiniApp = platform !== 'web'
        console.log('[WalletConnect] Detected Telegram environment:', {
          platform: platform,
          isMiniApp: isMiniApp,
          isWeb: platform === 'web',
        })
        
        // Telegram WebApp can expand to full screen for better QR code display
        // This works in both Mini App and Telegram Web
        if (telegramWebApp.isExpanded === false) {
          telegramWebApp.expand()
        }
      }

      // Add optionalChains if there are additional chains
      if (optionalChains.length > 0) {
        initOptions.optionalChains = optionalChains
      } else {
        // If only one chain, still need to provide optionalChains (can be empty or same as chains)
        // Some versions require optionalChains to be present
        initOptions.optionalChains = [primaryChain]
      }

      // Check if provider is already initialized
      const hasExistingProvider = WalletConnectAdapter.providerInstance && 
          WalletConnectAdapter.providerProjectId === this.projectId
      
      // Check if we need to reinitialize due to different chains
      const needsReinit = hasExistingProvider && 
          WalletConnectAdapter.providerChains !== null &&
          JSON.stringify(WalletConnectAdapter.providerChains.sort()) !== JSON.stringify(targetChains.sort())
      
      if (needsReinit) {
        // Provider exists but with different chains, need to disconnect and reinitialize
        console.log('[WalletConnect] Provider initialized with different chains, reinitializing...', {
          existing: WalletConnectAdapter.providerChains,
          requested: targetChains,
        })
        
        const existingProvider = WalletConnectAdapter.providerInstance
        if (existingProvider) {
          try {
            // Disconnect existing provider
            if (existingProvider.accounts && existingProvider.accounts.length > 0) {
              await existingProvider.disconnect()
            }
          } catch (error) {
            console.warn('[WalletConnect] Error disconnecting existing provider:', error)
          }
        }
        
        // Clear static instance to allow reinitialization
        WalletConnectAdapter.providerInstance = null
        WalletConnectAdapter.providerChains = null
      }
      
      // Use singleton pattern to avoid multiple initializations
      if (WalletConnectAdapter.providerInstance && 
          WalletConnectAdapter.providerProjectId === this.projectId) {
        // Reuse existing provider instance
        this.provider = WalletConnectAdapter.providerInstance
        console.log('[WalletConnect] Reusing existing provider instance')
        
        // IMPORTANT: Check if provider already has accounts BEFORE calling enable()
        // If it does, we're already connected and should skip enable()
        if (this.provider.accounts && this.provider.accounts.length > 0) {
          console.log('[WalletConnect] Provider already has accounts, skipping enable()')
          // Skip to account retrieval - don't call enable()
        } else {
          // Provider exists but no accounts, need to enable
          // Check if there's a session that might interfere
          const hasSession = this.provider.session !== undefined && this.provider.session !== null
          console.log('[WalletConnect] Provider has no accounts, calling enable() to show QR modal')
          console.log('[WalletConnect] Provider state:', {
            accounts: this.provider.accounts,
            chainId: this.provider.chainId,
            hasSession,
            sessionTopic: this.provider.session?.topic,
          })
          
          // If there's a session but no accounts, it might be a stale session
          // Disconnect it first to ensure clean state
          if (hasSession && (!this.provider.accounts || this.provider.accounts.length === 0)) {
            console.log('[WalletConnect] Found stale session, disconnecting before reconnecting...')
            try {
              await this.provider.disconnect()
              // Wait a bit for disconnect to complete
              await new Promise(resolve => setTimeout(resolve, 100))
            } catch (disconnectError) {
              console.warn('[WalletConnect] Error disconnecting stale session:', disconnectError)
              // Continue anyway
            }
          }
          
          try {
            // enable() returns a promise that resolves when connection is established
            // But accounts might not be immediately available, so we'll wait for them
            console.log('[WalletConnect] Calling enable()...')
            const enableResult = await this.provider.enable()
            console.log('[WalletConnect] enable() completed, result:', enableResult)
            console.log('[WalletConnect] Provider state after enable():', {
              accounts: this.provider.accounts,
              chainId: this.provider.chainId,
              session: this.provider.session ? {
                topic: (this.provider.session as any).topic,
                namespaces: (this.provider.session as any).namespaces ? Object.keys((this.provider.session as any).namespaces) : 'none',
              } : 'none',
            })
          } catch (error: any) {
            console.error('[WalletConnect] enable() error:', error)
            // Check if this is a real user rejection or a state issue
            if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('User rejected')) {
              throw new ConnectionRejectedError(this.type)
            }
            throw error
          }
        }
      } else if (WalletConnectAdapter.providerInstance && 
                 WalletConnectAdapter.providerProjectId === this.projectId) {
        // Provider exists but not connected, reuse it
        this.provider = WalletConnectAdapter.providerInstance
        console.log('[WalletConnect] Reusing existing provider instance (not connected)')
        
        // Check if provider already has accounts
        if (this.provider.accounts && this.provider.accounts.length > 0) {
          console.log('[WalletConnect] Provider already has accounts after init, skipping enable()')
        } else {
          const hasSession = this.provider.session !== undefined && this.provider.session !== null
          console.log('[WalletConnect] Provider has no accounts, calling enable() to show QR modal')
          console.log('[WalletConnect] Provider state:', {
            accounts: this.provider.accounts,
            chainId: this.provider.chainId,
            hasSession,
            sessionTopic: this.provider.session?.topic,
          })
          
          if (hasSession && (!this.provider.accounts || this.provider.accounts.length === 0)) {
            console.log('[WalletConnect] Found stale session after init, disconnecting before reconnecting...')
            try {
              await this.provider.disconnect()
              await new Promise(resolve => setTimeout(resolve, 100))
            } catch (disconnectError) {
              console.warn('[WalletConnect] Error disconnecting stale session:', disconnectError)
            }
          }
          
          try {
            await this.provider.enable()
          } catch (error: any) {
            console.error('[WalletConnect] enable() error:', error)
            if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('User rejected')) {
              throw new ConnectionRejectedError(this.type)
            }
            throw error
          }
        }
      } else if (WalletConnectAdapter.isInitializing && WalletConnectAdapter.initPromise) {
        // Wait for ongoing initialization
        console.log('[WalletConnect] Waiting for ongoing initialization...')
        this.provider = await WalletConnectAdapter.initPromise
        WalletConnectAdapter.providerInstance = this.provider
        WalletConnectAdapter.providerProjectId = this.projectId
        WalletConnectAdapter.providerChains = targetChains // Store the chains used
        
        // Check if provider already has accounts after initialization
        if (this.provider.accounts && this.provider.accounts.length > 0) {
          console.log('[WalletConnect] Provider already has accounts after init, skipping enable()')
        } else {
          try {
            await this.provider.enable()
          } catch (error: any) {
            if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('User rejected')) {
              throw new ConnectionRejectedError(this.type)
            }
            throw error
          }
        }
      } else {
        // Initialize new provider with requested chains
        console.log('[WalletConnect] Initializing new provider with chains:', {
          primary: primaryChain,
          optional: optionalChains,
          all: targetChains,
        })
        
        WalletConnectAdapter.isInitializing = true
        WalletConnectAdapter.initPromise = EthereumProvider.init(initOptions)
        
        try {
          this.provider = await WalletConnectAdapter.initPromise
          WalletConnectAdapter.providerInstance = this.provider
          WalletConnectAdapter.providerProjectId = this.projectId
          WalletConnectAdapter.providerChains = targetChains // Store the chains used
          
          // Check if provider already has accounts (session restored from storage)
          if (this.provider.accounts && this.provider.accounts.length > 0) {
            console.log('[WalletConnect] Provider has restored session, skipping enable()')
          } else {
            // Not connected yet, enable provider (this will show QR code modal)
            const hasSession = this.provider.session !== undefined && this.provider.session !== null
            console.log('[WalletConnect] New provider initialized, calling enable() to show QR modal')
            console.log('[WalletConnect] Provider state:', {
              accounts: this.provider.accounts,
              chainId: this.provider.chainId,
              hasSession,
              sessionTopic: this.provider.session?.topic,
            })
            
            // If there's a session but no accounts, it might be a stale session
            if (hasSession && (!this.provider.accounts || this.provider.accounts.length === 0)) {
              console.log('[WalletConnect] Found stale session after init, disconnecting before reconnecting...')
              try {
                await this.provider.disconnect()
                await new Promise(resolve => setTimeout(resolve, 100))
              } catch (disconnectError) {
                console.warn('[WalletConnect] Error disconnecting stale session:', disconnectError)
              }
            }
            
            try {
              await this.provider.enable()
            } catch (error: any) {
              console.error('[WalletConnect] enable() error:', error)
              if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('User rejected')) {
                throw new ConnectionRejectedError(this.type)
              }
              throw error
            }
          }
        } finally {
          WalletConnectAdapter.isInitializing = false
          WalletConnectAdapter.initPromise = null
        }
      }

      // Get accounts - WalletConnect v2 stores accounts in session.namespaces.eip155.accounts
      // Format: CAIP-10 "eip155:chainId:address" (e.g., "eip155:1:0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb")
      // Reference: https://specs.walletconnect.com/2.0/specs/clients/sign/namespaces
      let accounts = this.provider.accounts
      
      // If provider.accounts is empty, extract from session.namespaces.eip155.accounts
      if (!accounts || accounts.length === 0) {
        console.log('[WalletConnect] provider.accounts is empty, checking session.namespaces.eip155.accounts...')
        
        const session = this.provider.session as any
        if (session && session.namespaces?.eip155?.accounts) {
          // Extract addresses from CAIP-10 format: "eip155:chainId:address"
          const sessionAccounts = session.namespaces.eip155.accounts.map((acc: string) => {
            // CAIP-10 format: "eip155:chainId:address"
            const parts = acc.split(':')
            if (parts.length >= 3 && parts[0] === 'eip155') {
              return parts[2] // Extract address (third part)
            }
            return null
          }).filter((addr: string | null) => addr !== null && addr.startsWith('0x')) as string[]
          
          if (sessionAccounts.length > 0) {
            // Remove duplicates
            const uniqueAccounts = [...new Set(sessionAccounts)]
            console.log('[WalletConnect] Found accounts in session.namespaces.eip155.accounts:', {
              raw: session.namespaces.eip155.accounts,
              extracted: uniqueAccounts,
              chains: session.namespaces.eip155.chains,
            })
            accounts = uniqueAccounts
          }
        }
      }
      
      // If still no accounts, wait a bit for provider.accounts to be populated
      if (!accounts || accounts.length === 0) {
        console.log('[WalletConnect] Accounts not available, waiting for provider.accounts to populate...')
        
        const maxWaitTime = 3000 // 3 seconds
        const checkInterval = 100 // Check every 100ms
        const maxChecks = maxWaitTime / checkInterval
        
        for (let i = 0; i < maxChecks; i++) {
          await new Promise(resolve => setTimeout(resolve, checkInterval))
          accounts = this.provider.accounts
          
          if (accounts && accounts.length > 0) {
            console.log(`[WalletConnect] Accounts available after ${(i + 1) * checkInterval}ms`)
            break
          }
        }
      }
      
      if (!accounts || accounts.length === 0) {
        // Get detailed provider state for debugging
        const session = this.provider.session as any
        const providerState = {
          providerAccounts: this.provider.accounts,
          providerChainId: this.provider.chainId,
          session: session ? {
            exists: true,
            topic: session.topic,
            namespaces: session.namespaces ? Object.keys(session.namespaces) : 'none',
            eip155Namespace: session.namespaces?.eip155 ? {
              accounts: session.namespaces.eip155.accounts, // CAIP-10 format
              chains: session.namespaces.eip155.chains,      // CAIP-2 format
              methods: session.namespaces.eip155.methods,
              events: session.namespaces.eip155.events,
            } : 'none',
            // Log full session structure for debugging
            fullSession: JSON.stringify(session, null, 2),
          } : 'none',
          // Check if provider has any other properties that might contain accounts
          providerKeys: Object.keys(this.provider),
        }
        
        console.error('[WalletConnect] No accounts available after enable() and wait', providerState)
        console.error('[WalletConnect] Full provider object:', this.provider)
        console.error('[WalletConnect] Full session object:', session)
        console.error('[WalletConnect] Session namespaces structure:', session?.namespaces)
        
        // Don't throw ConnectionRejectedError - this is a technical issue, not user rejection
        throw new Error('WalletConnect connection established but no accounts available. Please check session.namespaces.eip155.accounts in the console logs above.')
      }

      // Get current chain ID (use first chain as default if multiple chains requested)
      const currentChainId = this.provider.chainId || targetChains[0]

      // Create viem chain config
      const viemChain = this.getViemChain(currentChainId) as any

      // Create wallet client
      this.walletClient = createWalletClient({
        account: accounts[0] as `0x${string}`,
        chain: viemChain,
        transport: custom(this.provider),
      })

      // Create public client (use configured RPC for reads)
      const chainInfo = getChainInfo(currentChainId)
      const primaryRpcUrl = chainInfo?.rpcUrls[0]
      
      this.publicClient = createPublicClient({
        chain: viemChain,
        transport: primaryRpcUrl ? http(primaryRpcUrl) : custom(this.provider),
      }) as any

      // Create account info
      const address = formatEVMAddress(accounts[0])
      const account: Account = {
        universalAddress: createUniversalAddress(currentChainId, address),
        nativeAddress: address,
        chainId: currentChainId,
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

      // WalletConnect relay reject: origin not allowlisted for this projectId
      const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''
      const errorCode = error?.code
      const errorMessage = error?.message || String(error)
      const isOriginNotAllowed =
        errorCode === 3000 ||
        /origin not allowed/i.test(errorMessage) ||
        /Unauthorized:\s*origin not allowed/i.test(errorMessage)

      // Log the actual error for debugging
      const session = this.provider?.session as any
      const providerState = this.provider ? {
        accounts: this.provider.accounts,
        chainId: this.provider.chainId,
        session: session ? {
          exists: true,
          topic: session.topic,
          namespaces: session.namespaces ? Object.keys(session.namespaces) : 'none',
          eip155Namespace: session.namespaces?.eip155 ? {
            accounts: session.namespaces.eip155.accounts,
            chains: session.namespaces.eip155.chains,
            methods: session.namespaces.eip155.methods,
            events: session.namespaces.eip155.events,
          } : 'none',
        } : 'none',
        providerKeys: Object.keys(this.provider),
      } : 'no provider'
      
      console.error('[WalletConnect] Connection error:', {
        error,
        code: error.code,
        message: error.message,
        stack: error.stack,
        providerState,
      })
      
      // Also log full provider and session for detailed debugging
      if (this.provider) {
        console.error('[WalletConnect] Full provider object:', this.provider)
        console.error('[WalletConnect] Full session object:', session)
      }

      // Only treat as user rejection if it's explicitly a rejection error
      // Don't treat other errors (like "no accounts") as user rejection
      if (error.code === 4001 || 
          (error.message && (
            error.message.includes('User rejected') || 
            error.message.includes('rejected by user') ||
            error.message.includes('User cancelled')
          ))) {
        throw new ConnectionRejectedError(this.type)
      }

      if (isOriginNotAllowed) {
        throw new ConfigurationError(
          `WalletConnect relayer rejected this origin (code 3000: Unauthorized: origin not allowed).\n\n` +
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

      // For other errors, re-throw with original error message
      throw error
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    if (this.provider) {
      try {
        await this.provider.disconnect()
      } catch (error) {
        // Ignore disconnect errors
        console.warn('[WalletConnect] Error during disconnect:', error)
      }
      
      // Clear static instance if it matches this adapter's provider
      if (WalletConnectAdapter.providerInstance === this.provider) {
        WalletConnectAdapter.providerInstance = null
        WalletConnectAdapter.providerProjectId = null
        WalletConnectAdapter.providerChains = null
      }
      
      this.provider = null
    }

    this.removeEventListeners()
    this.walletClient = null
    this.publicClient = null
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
      if (!this.provider) {
        throw new Error('Provider not initialized')
      }

      const signature = await this.provider.request({
        method: 'personal_sign',
        params: evmPersonalSignParams(message, this.currentAccount!.nativeAddress),
      })

      // In Telegram Mini App, close any wc:// deep link popups after signing
      this.closeTelegramDeepLinkPopup()

      return signature as string
    } catch (error: any) {
      if (error.code === 4001 || error.message?.includes('rejected')) {
        throw new SignatureRejectedError()
      }
      throw error
    }
  }

  /**
   * Sign TypedData (EIP-712)
   */
  async signTypedData(typedData: any): Promise<string> {
    this.ensureConnected()

    try {
      if (!this.provider) {
        throw new Error('Provider not initialized')
      }

      const signature = await this.provider.request({
        method: 'eth_signTypedData_v4',
        params: [this.currentAccount!.nativeAddress, JSON.stringify(typedData)],
      })

      // In Telegram Mini App, close any wc:// deep link popups after signing
      this.closeTelegramDeepLinkPopup()

      return signature as string
    } catch (error: any) {
      if (error.code === 4001 || error.message?.includes('rejected')) {
        throw new SignatureRejectedError()
      }
      throw error
    }
  }

  /**
   * Sign transaction
   */
  async signTransaction(transaction: any): Promise<string> {
    this.ensureConnected()

    try {
      if (!this.provider) {
        throw new Error('Provider not initialized')
      }

      const tx = {
        from: this.currentAccount!.nativeAddress,
        to: transaction.to,
        value: toEip1193Quantity(transaction.value),
        data: transaction.data || '0x',
        gas: toEip1193Quantity(transaction.gas),
        gasPrice:
          transaction.gasPrice && transaction.gasPrice !== 'auto'
            ? toEip1193Quantity(transaction.gasPrice)
            : undefined,
        maxFeePerGas: toEip1193Quantity(transaction.maxFeePerGas),
        maxPriorityFeePerGas: toEip1193Quantity(transaction.maxPriorityFeePerGas),
        nonce: transaction.nonce !== undefined
          ? `0x${transaction.nonce.toString(16)}` : undefined,
        chainId: transaction.chainId || this.currentAccount!.chainId,
      }

      const signature = await this.provider.request({
        method: 'eth_signTransaction',
        params: [tx],
      })

      // In Telegram Mini App, close any wc:// deep link popups after signing
      this.closeTelegramDeepLinkPopup()

      return signature as string
    } catch (error: any) {
      if (error.code === 4001 || error.message?.includes('rejected')) {
        throw new SignatureRejectedError('Transaction signature was rejected by user')
      }
      throw error
    }
  }

  /**
   * Send transaction (broadcast via wallet)
   */
  async sendTransaction(transaction: any): Promise<string> {
    this.ensureConnected()

    try {
      if (!this.provider) {
        throw new Error('Provider not initialized')
      }

      const tx = {
        from: this.currentAccount!.nativeAddress,
        to: transaction.to,
        value: toEip1193Quantity(transaction.value),
        data: transaction.data || '0x',
        gas: toEip1193Quantity(transaction.gas),
        gasPrice:
          transaction.gasPrice && transaction.gasPrice !== 'auto'
            ? toEip1193Quantity(transaction.gasPrice)
            : undefined,
        maxFeePerGas: toEip1193Quantity(transaction.maxFeePerGas),
        maxPriorityFeePerGas: toEip1193Quantity(transaction.maxPriorityFeePerGas),
        nonce: transaction.nonce !== undefined
          ? `0x${transaction.nonce.toString(16)}` : undefined,
        chainId: `0x${normalizeToEvmChainId(transaction.chainId ?? this.currentAccount!.chainId).toString(16)}`,
      }

      const hash = await this.provider.request({
        method: 'eth_sendTransaction',
        params: [tx],
      })

      this.closeTelegramDeepLinkPopup()

      return hash as string
    } catch (error: any) {
      if (error.code === 4001 || error.message?.includes('rejected')) {
        throw new SignatureRejectedError('Transaction was rejected by user')
      }
      throw error
    }
  }

  /**
   * Get supported chains from current connection
   * Returns the chains that were requested during connection
   */
  getSupportedChains(): number[] {
    return [...this.supportedChains]
  }

  /**
   * Switch chain
   * 
   * Note: WalletConnect v2 with mobile wallets may not support chain switching reliably.
   * Some wallets may ignore the switch request or fail silently.
   * It's recommended to include all needed chains in the initial connection.
   * 
   * Reference: https://specs.walletconnect.com/2.0/specs/clients/sign/namespaces
   */
  async switchChain(chainId: number): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    // Check if chain is in the supported chains list
    const session = this.provider.session as any
    const supportedChains = session?.namespaces?.eip155?.chains || []
    const targetChainCAIP = `eip155:${chainId}`
    
    // Check if chain is in the session's approved chains
    const isChainApproved = supportedChains.includes(targetChainCAIP)
    
    if (!isChainApproved) {
      console.warn(`[WalletConnect] Chain ${chainId} (${targetChainCAIP}) not in session approved chains:`, supportedChains)
      console.warn('[WalletConnect] Chain switching may fail. Consider including all chains in initial connection.')
    }

    try {
      console.log(`[WalletConnect] Attempting to switch to chain ${chainId} (${targetChainCAIP})`)
      
      const result = await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })

      // Success returns null
      if (result !== null && result !== undefined) {
        console.warn('[WalletConnect] wallet_switchEthereumChain returned non-null result:', result)
      }

      // Verify the switch actually happened by checking provider.chainId
      // Note: Some wallets may not update this immediately
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait a bit for chain to update
      
      const currentChainId = this.provider.chainId
      if (currentChainId !== chainId) {
        console.warn(`[WalletConnect] Chain switch may have failed. Expected ${chainId}, got ${currentChainId}`)
        console.warn('[WalletConnect] Some mobile wallets may not support chain switching via WalletConnect.')
        console.warn('[WalletConnect] User may need to manually switch chains in the wallet app.')
        // Don't throw error - some wallets may not support switching but still allow transactions
      }

      // Update account info
      if (this.currentAccount) {
        const updatedAccount: Account = {
          ...this.currentAccount,
          chainId,
          universalAddress: createUniversalAddress(chainId, this.currentAccount.nativeAddress),
        }
        this.setAccount(updatedAccount)
        this.emitChainChanged(chainId)

        // Update viem clients
        const viemChain = this.getViemChain(chainId) as any
        const chainInfo = getChainInfo(chainId)
        const primaryRpcUrl = chainInfo?.rpcUrls[0]

        this.walletClient = createWalletClient({
          account: this.currentAccount.nativeAddress as `0x${string}`,
          chain: viemChain,
          transport: custom(this.provider),
        })

        this.publicClient = createPublicClient({
          chain: viemChain,
          transport: primaryRpcUrl ? http(primaryRpcUrl) : custom(this.provider),
        }) as any
      }
    } catch (error: any) {
      console.error('[WalletConnect] Chain switch error:', {
        chainId,
        errorCode: error.code,
        errorMessage: error.message,
        supportedChains,
      })

      // Chain doesn't exist (error code 4902), try to add it
      if (error.code === 4902) {
        console.log(`[WalletConnect] Chain ${chainId} not found in wallet, attempting to add...`)
        const chainInfo = getChainInfo(chainId)
        if (chainInfo) {
          try {
            await this.addChain({
              chainId: chainInfo.id,
              chainName: chainInfo.name,
              nativeCurrency: chainInfo.nativeCurrency,
              rpcUrls: chainInfo.rpcUrls,
              blockExplorerUrls: chainInfo.blockExplorerUrls,
            })
            // Try switching again after adding
            console.log(`[WalletConnect] Chain added, attempting to switch again...`)
            await this.switchChain(chainId)
          } catch (addError: any) {
            console.error('[WalletConnect] Failed to add chain:', addError)
            throw new Error(`Failed to add chain ${chainId}: ${addError.message}`)
          }
        } else {
          throw new Error(`Chain ${chainId} not supported`)
        }
      } else if (error.code === 4001) {
        // User rejected
        throw new Error('User rejected chain switch')
      } else if (error.code === 4100) {
        // Unsupported method
        throw new Error('Wallet does not support wallet_switchEthereumChain. Please switch chains manually in your wallet app.')
      } else {
        // Other errors - may indicate wallet doesn't support switching
        console.warn('[WalletConnect] Chain switch may not be supported by this wallet. User may need to switch manually.')
        throw error
      }
    }
  }

  /**
   * Add chain
   */
  async addChain(chainConfig: AddChainParams): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    await this.provider.request({
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
   * Read contract
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
   * Write contract
   */
  async writeContract(params: ContractWriteParams): Promise<string> {
    this.ensureConnected()

    if (!this.walletClient) {
      throw new Error('Wallet client not initialized')
    }

    try {
      // Build transaction options
      const txOptions: any = {
        address: params.address as `0x${string}`,
        abi: params.abi,
        functionName: params.functionName,
        ...(params.args ? { args: params.args as readonly any[] } : {}),
        value: params.value ? BigInt(params.value) : undefined,
        gas: params.gas ? BigInt(params.gas) : undefined,
      }

      // Handle gas pricing (EIP-1559 or legacy)
      if (params.maxFeePerGas || params.maxPriorityFeePerGas) {
        if (params.maxFeePerGas) {
          txOptions.maxFeePerGas = BigInt(params.maxFeePerGas)
        }
        if (params.maxPriorityFeePerGas) {
          txOptions.maxPriorityFeePerGas = BigInt(params.maxPriorityFeePerGas)
        }
      } else if (params.gasPrice && params.gasPrice !== 'auto') {
        txOptions.gasPrice = BigInt(params.gasPrice)
      } else {
        // Auto-estimate gas fees
        if (this.publicClient) {
          try {
            const feesPerGas = await this.publicClient.estimateFeesPerGas().catch(() => null)
            if (feesPerGas) {
              const minPriorityFeeWei = BigInt(100_000_000) // 0.1 Gwei
              const maxPriorityFeePerGas = feesPerGas.maxPriorityFeePerGas > minPriorityFeeWei 
                ? feesPerGas.maxPriorityFeePerGas 
                : minPriorityFeeWei
              
              const adjustedMaxFeePerGas = feesPerGas.maxFeePerGas > maxPriorityFeePerGas
                ? feesPerGas.maxFeePerGas
                : maxPriorityFeePerGas + BigInt(1_000_000_000)
              
              txOptions.maxFeePerGas = adjustedMaxFeePerGas
              txOptions.maxPriorityFeePerGas = maxPriorityFeePerGas
            } else {
              const gasPrice = await this.publicClient.getGasPrice()
              txOptions.gasPrice = gasPrice
            }
          } catch (err) {
            // Let viem auto-estimate
          }
        }
      }

      const txHash = await this.walletClient.writeContract(txOptions as any)
      
      // In Telegram Mini App, close any wc:// deep link popups after transaction
      this.closeTelegramDeepLinkPopup()
      
      return txHash
    } catch (error: any) {
      if (error.code === 4001 || error.message?.includes('rejected')) {
        throw new SignatureRejectedError('Transaction was rejected by user')
      }
      throw error
    }
  }

  /**
   * Estimate gas
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
   * Wait for transaction
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
   * Get provider
   */
  getProvider(): any {
    return this.provider
  }

  /**
   * Get signer
   */
  getSigner(): WalletClient | null {
    return this.walletClient
  }

  /**
   * Setup event listeners
   */
  protected setupEventListeners(): void {
    if (!this.provider) return

    this.provider.on('accountsChanged', this.handleAccountsChanged)
    this.provider.on('chainChanged', this.handleChainChanged)
    this.provider.on('disconnect', this.handleDisconnect)
  }

  /**
   * Remove event listeners
   */
  protected removeEventListeners(): void {
    if (!this.provider) return

    this.provider.removeListener('accountsChanged', this.handleAccountsChanged)
    this.provider.removeListener('chainChanged', this.handleChainChanged)
    this.provider.removeListener('disconnect', this.handleDisconnect)
  }

  /**
   * Handle accounts changed
   */
  private handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      this.setState(WalletState.DISCONNECTED)
      this.setAccount(null)
      this.emitAccountChanged(null)
    } else {
      const address = formatEVMAddress(accounts[0])
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
   * Handle chain changed
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

      // Update viem clients
      const viemChain = this.getViemChain(chainId) as any
      const chainInfo = getChainInfo(chainId)
      const primaryRpcUrl = chainInfo?.rpcUrls[0]

      if (this.provider) {
        this.walletClient = createWalletClient({
          account: this.currentAccount.nativeAddress as `0x${string}`,
          chain: viemChain,
          transport: custom(this.provider),
        })

        this.publicClient = createPublicClient({
          chain: viemChain,
          transport: primaryRpcUrl ? http(primaryRpcUrl) : custom(this.provider),
        }) as any
      }
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect = () => {
    this.setState(WalletState.DISCONNECTED)
    this.setAccount(null)
    // Clear static instance if it matches this adapter's provider
    if (WalletConnectAdapter.providerInstance === this.provider) {
      WalletConnectAdapter.providerInstance = null
      WalletConnectAdapter.providerProjectId = null
    }
    
    this.provider = null
    this.walletClient = null
    this.publicClient = null
    this.emitDisconnected()
  }

  /**
   * Get viem chain config
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

    // Default config
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

