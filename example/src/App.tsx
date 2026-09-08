import React, { useState } from 'react'
import { useWallet, useAccount, useConnect, useDisconnect, useSignMessage, useSignTransaction } from '@enclave-hq/wallet-sdk/react'
import { WalletType, ChainType, ConnectedWallet, DeepLinkAdapter, DeepLinkProviderType } from '@enclave-hq/wallet-sdk'
import { WalletDetector, getEVMWallets, getTronWallets } from '@enclave-hq/wallet-sdk'
import { ERC20_ABI, getUSDTAddress, getUSDCAddress } from './abis/erc20'
import './App.css'

function App() {
  const { walletManager, connectedWallets, switchPrimaryWallet, isRestoring } = useWallet()
  const { account, isConnected, address, chainId } = useAccount()
  const { connect, connectAdditional, isConnecting, error: connectError } = useConnect()
  const { disconnect, isDisconnecting } = useDisconnect()
  const { signMessage, isSigning, error: signError } = useSignMessage()
  const { signTransaction, isSigning: isSigningTx } = useSignTransaction()

  // 检测 Telegram Mini App 环境
  const [isTelegram, setIsTelegram] = React.useState(false)
  React.useEffect(() => {
    // @ts-ignore
    const isTG = !!(window.Telegram && window.Telegram.WebApp)
    setIsTelegram(isTG)
    if (isTG) {
      console.log('[App] Running in Telegram Mini App')
      // @ts-ignore
      const tg = window.Telegram.WebApp
      console.log('[App] Telegram WebApp info:', {
        version: tg.version,
        platform: tg.platform,
        isExpanded: tg.isExpanded,
        viewportHeight: tg.viewportHeight,
      })
    }
  }, [])

  const [messageToSign, setMessageToSign] = useState('Hello from Enclave Wallet SDK!')
  const [signature, setSignature] = useState<string>('')
  const [txSignature, setTxSignature] = useState<string>('')
  const [txRecipientAddress, setTxRecipientAddress] = useState('')
  const [txAmount, setTxAmount] = useState('1')
  const [availableWallets, setAvailableWallets] = useState<any[]>([])
  const [detectionDone, setDetectionDone] = useState(false)
  const [eventLogs, setEventLogs] = useState<Array<{ time: string; type: string; message: string }>>([])
  
  // Contract interaction states
  const [usdtBalance, setUsdtBalance] = useState<string>('')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('1')
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferTxHash, setTransferTxHash] = useState<string>('')
  const [contractError, setContractError] = useState<string>('')

  // Deep link states (通用 DeepLink 适配器)
  const [isDeepLinkAvailable, setIsDeepLinkAvailable] = useState(false)
  const [deepLinkProviderType, setDeepLinkProviderType] = useState<DeepLinkProviderType>(DeepLinkProviderType.TOKENPOCKET)
  const [deepLinkChainType, setDeepLinkChainType] = useState<ChainType>(ChainType.TRON)
  const [deepLinkChainId, setDeepLinkChainId] = useState<number>(195) // TRON Mainnet
  const [deepLinkAdapter, setDeepLinkAdapter] = useState<DeepLinkAdapter | null>(null)
  const [deepLinkMessage, setDeepLinkMessage] = useState('Hello from Deep Link!')
  const [deepLinkTxRecipient, setDeepLinkTxRecipient] = useState('')
  const [deepLinkTxAmount, setDeepLinkTxAmount] = useState('1')

  // 回调URL配置
  const CALLBACK_BASE_URL = 'https://wallet-test.enclave-hq.com'
  const CALLBACK_SCHEMA = `${CALLBACK_BASE_URL}${window.location.pathname}` // 客户端回调：钱包会打开这个URL
  const CALLBACK_URL = `${CALLBACK_BASE_URL}/api/callback` // 服务端回调：钱包会POST到这个URL

  // 检测深度链接可用性并初始化适配器
  React.useEffect(() => {
    const checkDeepLink = async () => {
      try {
        const adapter = new DeepLinkAdapter({
          providerType: deepLinkProviderType,
          callbackSchema: CALLBACK_SCHEMA, // 客户端回调URL
          callbackUrl: CALLBACK_URL, // 服务端回调URL（可选）
        })
        const available = await adapter.isAvailable()
        setDeepLinkAdapter(adapter)
        
        // 输出回调URL配置信息
        addLog('Info', `Callback Schema: ${CALLBACK_SCHEMA}`)
        addLog('Info', `Callback URL: ${CALLBACK_URL}`)
        
        // In Telegram Mini App, always enable operations even if detection fails
        // Deep links should work in Telegram Mini App on mobile platforms
        if (isTelegram) {
          setIsDeepLinkAvailable(true)
          addLog('Info', `Telegram Mini App detected - Deep link operations enabled`)
        } else {
          setIsDeepLinkAvailable(available)
          if (available) {
            addLog('Info', `Deep link available for ${deepLinkProviderType}`)
          } else {
            addLog('Warning', 'Deep link only available on mobile devices')
          }
        }
      } catch (error: any) {
        addLog('Error', `Failed to initialize deep link adapter: ${error.message}`)
        setIsDeepLinkAvailable(false)
      }
    }
    checkDeepLink()
  }, [deepLinkProviderType, isTelegram])

  // 页面加载时检查回调参数（处理从钱包返回的回调）
  React.useEffect(() => {
    const checkCallbackParams = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const actionId = urlParams.get('actionId')
      const result = urlParams.get('result')
      const error = urlParams.get('error')
      
      if (actionId || result || error) {
        addLog('Info', `Callback detected - actionId: ${actionId}, result: ${result ? 'present' : 'none'}, error: ${error || 'none'}`)
        // DeepLinkAdapter 会自动处理这些参数
      }
    }
    
    // 页面加载时检查
    checkCallbackParams()
    
    // 监听 URL 变化（用户从钱包返回时）
    const handlePopState = () => {
      checkCallbackParams()
    }
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // Add event log
  const addLog = (type: string, message: string) => {
    const time = new Date().toLocaleTimeString()
    setEventLogs(prev => [{ time, type, message }, ...prev].slice(0, 10)) // Keep only last 10 logs
  }

  // Get block explorer URL based on chain
  const getBlockExplorerUrl = (txHash: string, currentChainId: number, currentChainType: string): { url: string; name: string } => {
    if (currentChainType === ChainType.TRON) {
      const tid = (() => {
        const t = txHash.trim()
        return t.startsWith('0x') || t.startsWith('0X') ? t.slice(2) : t
      })()
      // Tron chains（TronScan tx 路径要求 64 位 hex，无 0x）
      if (currentChainId === 195) {
        return { url: `https://tronscan.org/#/transaction/${tid}`, name: 'Tronscan' }
      } else if (currentChainId === 2494104990) {
        return { url: `https://nile.tronscan.org/#/transaction/${tid}`, name: 'Tronscan (Nile)' }
      }
      return { url: `https://tronscan.org/#/transaction/${tid}`, name: 'Tronscan' }
    }

    // EVM chains
    switch (currentChainId) {
      case 1:
        return { url: `https://etherscan.io/tx/${txHash}`, name: 'Etherscan' }
      case 56:
        return { url: `https://bscscan.com/tx/${txHash}`, name: 'BscScan' }
      case 97:
        return { url: `https://testnet.bscscan.com/tx/${txHash}`, name: 'BscScan Testnet' }
      case 137:
        return { url: `https://polygonscan.com/tx/${txHash}`, name: 'PolygonScan' }
      case 80001:
        return { url: `https://mumbai.polygonscan.com/tx/${txHash}`, name: 'PolygonScan Mumbai' }
      case 42161:
        return { url: `https://arbiscan.io/tx/${txHash}`, name: 'Arbiscan' }
      case 421614:
        return { url: `https://sepolia.arbiscan.io/tx/${txHash}`, name: 'Arbiscan Sepolia' }
      case 10:
        return { url: `https://optimistic.etherscan.io/tx/${txHash}`, name: 'Optimism Explorer' }
      case 11155420:
        return { url: `https://sepolia-optimism.etherscan.io/tx/${txHash}`, name: 'Optimism Sepolia' }
      case 8453:
        return { url: `https://basescan.org/tx/${txHash}`, name: 'BaseScan' }
      case 84532:
        return { url: `https://sepolia.basescan.org/tx/${txHash}`, name: 'BaseScan Sepolia' }
      case 11155111:
        return { url: `https://sepolia.etherscan.io/tx/${txHash}`, name: 'Etherscan Sepolia' }
      case 5:
        return { url: `https://goerli.etherscan.io/tx/${txHash}`, name: 'Etherscan Goerli' }
      case 43114:
        return { url: `https://snowtrace.io/tx/${txHash}`, name: 'SnowTrace' }
      case 43113:
        return { url: `https://testnet.snowtrace.io/tx/${txHash}`, name: 'SnowTrace Testnet' }
      case 250:
        return { url: `https://ftmscan.com/tx/${txHash}`, name: 'FTMScan' }
      case 4002:
        return { url: `https://testnet.ftmscan.com/tx/${txHash}`, name: 'FTMScan Testnet' }
      default:
        return { url: `https://etherscan.io/tx/${txHash}`, name: 'Block Explorer' }
    }
  }

  // Detect wallets
  const detectWallets = async () => {
    const detector = new WalletDetector()
    
    // Quick detection first
    let wallets = await detector.detectAllWallets()
    
    // Log detection results for debugging
    console.log('[App] Detected wallets (before filtering):', wallets.map(w => ({
      type: w.walletType,
      isAvailable: w.isAvailable,
      hasAdapter: walletManager.hasAdapter(w.walletType),
    })))
    
    // Filter out wallets that don't have adapters registered
    // (e.g., WalletConnect without Project ID)
    wallets = wallets.map(wallet => {
      const hasAdapter = walletManager.hasAdapter(wallet.walletType)
      const finalAvailable = wallet.isAvailable && hasAdapter
      
      // Log why wallet is not available
      if (!finalAvailable) {
        if (!wallet.isAvailable) {
          console.log(`[App] Wallet ${wallet.walletType} not available (detection failed)`)
        } else if (!hasAdapter) {
          console.log(`[App] Wallet ${wallet.walletType} not available (adapter not registered)`)
          if (wallet.walletType === WalletType.WALLETCONNECT || wallet.walletType === WalletType.WALLETCONNECT_TRON) {
            console.warn(`[App] ⚠️ WalletConnect adapter not registered. Please check if VITE_WALLETCONNECT_PROJECT_ID is set in .env file.`)
          }
        }
      }
      
      return {
        ...wallet,
        isAvailable: finalAvailable,
      }
    })
    
    // Log final results
    console.log('[App] Available wallets (after filtering):', wallets.filter(w => w.isAvailable).map(w => w.walletType))
    console.log('[App] Unavailable wallets:', wallets.filter(w => !w.isAvailable).map(w => ({
      type: w.walletType,
      reason: !walletManager.hasAdapter(w.walletType) ? 'adapter not registered' : 'detection failed',
    })))
    
    setAvailableWallets(wallets)
    
    // If TronLink not detected, wait and retry (TronLink injection is async)
    const tronLinkWallet = wallets.find(w => w.walletType === WalletType.TRONLINK)
    if (!tronLinkWallet?.isAvailable) {
      addLog('Detecting', 'Waiting for TronLink...')
      const isTronLinkAvailable = await detector.waitForWallet(WalletType.TRONLINK, 3000)
      if (isTronLinkAvailable) {
        addLog('Success', 'TronLink is ready')
        // Re-detect all wallets
        wallets = await detector.detectAllWallets()
        // Filter again after re-detection
        wallets = wallets.map(wallet => ({
          ...wallet,
          isAvailable: wallet.isAvailable && walletManager.hasAdapter(wallet.walletType),
        }))
        setAvailableWallets(wallets)
      } else {
        addLog('Failed', 'TronLink not installed or not enabled')
      }
    }
    
    setDetectionDone(true)
  }

  // Connect wallet
  const handleConnect = async (type: WalletType) => {
    try {
      await connect(type)
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  // Connect wallet with multiple chains (for WalletConnect only)
  const handleConnectMultiChain = async (type: WalletType, chains: number[]) => {
    try {
      if (type === WalletType.WALLETCONNECT) {
        // Request multiple chains for WalletConnect
        await connect(type, chains)
        addLog('Info', `Connected to multiple chains: ${chains.join(', ')}`)
      } else {
        // For other wallets, use first chain
        await connect(type, chains[0])
        addLog('Info', `Connected to chain: ${chains[0]}`)
      }
    } catch (error) {
      console.error('Multi-chain connection error:', error)
      addLog('Error', `Multi-chain connection failed: ${error}`)
    }
  }

  // Connect additional wallet
  const handleConnectAdditional = async (type: WalletType) => {
    try {
      await connectAdditional(type)
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  // Disconnect wallet
  const handleDisconnect = async () => {
    try {
      await disconnect()
      setSignature('')
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  // Sign message
  const handleSignMessage = async () => {
    try {
      const sig = await signMessage(messageToSign)
      setSignature(sig)
    } catch (error) {
      console.error('Sign error:', error)
    }
  }

  // Sign transaction
  const handleSignTransaction = async () => {
    try {
      // Create different test transactions based on current wallet type
      if (account?.chainType === ChainType.EVM) {
        // EVM transaction example
        const tx = {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', // Test address
          value: '0x0', // 0 ETH
          data: '0x', // Empty data
        }
        const sig = await signTransaction(tx)
        setTxSignature(sig)
      } else if (account?.chainType === ChainType.TRON) {
        // Tron transaction example - create a USDT (TRC20) transfer transaction
        // For WalletConnect Tron, we need to create the transaction object first using TronWeb
        
        // Validate input
        if (!txRecipientAddress.trim()) {
          alert('Please enter recipient address')
          return
        }
        
        const recipientAddress = txRecipientAddress.trim()
        
        // Validate Tron address format
        if (!recipientAddress.match(/^T[1-9A-HJ-NP-Za-km-z]{33}$/)) {
          alert('Invalid Tron address format. Tron addresses start with T and are 34 characters long.')
          return
        }
        
        // Validate amount
        const amountNum = parseFloat(txAmount)
        if (isNaN(amountNum) || amountNum <= 0) {
          alert('Please enter a valid amount (greater than 0)')
          return
        }
        
        // Check if TronWeb is available (for creating transaction)
        const w = window as any
        if (!w.tronWeb && !w.tronLink?.tronWeb) {
          alert('TronWeb is required to create transactions. Please install TronLink extension.')
          return
        }

        const tronWeb = w.tronWeb || w.tronLink?.tronWeb
        
        try {
          // USDT (TRC20) contract address on Tron Mainnet
          const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
          
          // Transfer amount: USDT has 6 decimals, so convert to smallest unit
          const amount = Math.floor(amountNum * 1000000) // Convert to smallest unit (1 USDT = 1,000,000)
          
          addLog('Info', `Creating USDT transfer: ${amount / 1000000} USDT to ${recipientAddress}`)
          
          // Create USDT transfer transaction using TronWeb
          // transfer(address to, uint256 amount) - standard ERC20 transfer function
          const functionSelector = 'transfer(address,uint256)'
          
          // Parameters for TronWeb triggerSmartContract
          // Address should be in hex format (TronWeb will handle conversion)
          // Amount should be a string or number (TronWeb will handle encoding)
          const addressHex = tronWeb.address.toHex(recipientAddress)
          // Remove '41' prefix if present (Tron address prefix) and add '0x'
          const addressParam = addressHex.startsWith('41') 
            ? '0x' + addressHex.substring(2) 
            : addressHex.startsWith('0x') 
              ? addressHex 
              : '0x' + addressHex
          
          // Amount as string (TronWeb will encode it)
          const amountStr = amount.toString()
          
          addLog('Info', `Building transaction: ${amount / 1000000} USDT to ${recipientAddress}`)
          
          // Build the transaction using TronWeb triggerSmartContract
          const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
            USDT_CONTRACT_ADDRESS,
            functionSelector,
            {
              feeLimit: 100_000_000, // 100 TRX fee limit
              callValue: 0, // No TRX sent, only USDT
            },
            [
              { type: 'address', value: addressParam },
              { type: 'uint256', value: amountStr },
            ],
            account.nativeAddress
          )

          if (!transaction || !transaction.transaction) {
            throw new Error('Failed to build USDT transfer transaction')
          }

          addLog('Info', 'Transaction built, requesting signature...')

          // Sign the transaction using WalletConnect
          const signedTx = await signTransaction(transaction.transaction)
          
          // If signedTx is a string (txID), use it directly
          // If it's a JSON string, parse it
          let txHash: string
          try {
            const parsed = JSON.parse(signedTx)
            txHash = parsed.txID || parsed.txid || signedTx
          } catch {
            txHash = signedTx
          }
          
          setTxSignature(txHash)
          addLog('Success', `USDT transfer transaction signed: ${txHash}`)
        } catch (error: any) {
          console.error('Tron USDT transaction creation/signing error:', error)
          addLog('Error', `Failed to create/sign USDT transaction: ${error.message}`)
          alert(`Failed to create/sign USDT transaction: ${error.message}`)
        }
      }
    } catch (error) {
      console.error('Sign transaction error:', error)
    }
  }

  // Switch primary wallet
  const handleSwitchPrimary = async (chainType: ChainType) => {
    try {
      await switchPrimaryWallet(chainType)
    } catch (error) {
      console.error('Switch error:', error)
    }
  }

  // Deep link: Sign message
  const handleDeepLinkSignMessage = async () => {
    if (!deepLinkAdapter) {
      alert('Deep link adapter not initialized')
      return
    }

    try {
      // First, try to connect if not connected
      if (!deepLinkAdapter.isConnected()) {
        addLog('Info', `Connecting to ${deepLinkProviderType} via deep link...`)
        await deepLinkAdapter.connect(deepLinkChainId)
      }

      addLog('Info', `Opening ${deepLinkProviderType} for message signing...`)
      const signature = await deepLinkAdapter.signMessage(deepLinkMessage)
      addLog('Success', `Message signed successfully: ${signature.substring(0, 20)}...`)
      alert(`Message signed successfully!\nSignature: ${signature.substring(0, 20)}...`)
    } catch (error: any) {
      // Deep link may throw an error after opening the app
      // This is expected behavior for some providers
      if (error.message && (error.message.includes('opened') || error.message.includes('initiated'))) {
        addLog('Success', `Opened ${deepLinkProviderType} for signing. Signature will be returned via callback.`)
      } else {
        addLog('Error', `Deep link error: ${error.message}`)
        alert(`Deep link error: ${error.message}`)
      }
    }
  }

  // Deep link: Sign transaction
  const handleDeepLinkSignTransaction = async () => {
    if (!deepLinkAdapter) {
      alert('Deep link adapter not initialized')
      return
    }

    // Validate input
    if (!deepLinkTxRecipient.trim()) {
      alert('Please enter recipient address')
      return
    }

    const recipientAddress = deepLinkTxRecipient.trim()

    // Validate amount
    const amountNum = parseFloat(deepLinkTxAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount (greater than 0)')
      return
    }

    try {
      let transaction: any

      if (deepLinkChainType === ChainType.TRON) {
        // Validate Tron address format
        if (!recipientAddress.match(/^T[1-9A-HJ-NP-Za-km-z]{33}$/)) {
          alert('Invalid Tron address format. Tron addresses start with T and are 34 characters long.')
          return
        }

        // Check if TronWeb is available (for creating transaction)
        const w = window as any
        if (!w.tronWeb && !w.tronLink?.tronWeb) {
          alert('TronWeb is required to create transactions. Please install TronLink extension.')
          return
        }

        const tronWeb = w.tronWeb || w.tronLink?.tronWeb

        // USDT (TRC20) contract address on Tron Mainnet
        const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
        
        // Transfer amount: USDT has 6 decimals
        const amount = Math.floor(amountNum * 1000000)
        
        addLog('Info', `Creating USDT transfer transaction for deep link: ${amount / 1000000} USDT to ${recipientAddress}`)
        
        // Create USDT transfer transaction using TronWeb
        const functionSelector = 'transfer(address,uint256)'
        const addressHex = tronWeb.address.toHex(recipientAddress)
        const addressParam = addressHex.startsWith('41') 
          ? '0x' + addressHex.substring(2) 
          : addressHex.startsWith('0x') 
            ? addressHex 
            : '0x' + addressHex
        const amountStr = amount.toString()
        
        // Build the transaction
        const txResult = await tronWeb.transactionBuilder.triggerSmartContract(
          USDT_CONTRACT_ADDRESS,
          functionSelector,
          {
            feeLimit: 100_000_000,
            callValue: 0,
          },
          [
            { type: 'address', value: addressParam },
            { type: 'uint256', value: amountStr },
          ],
          account?.nativeAddress || tronWeb.defaultAddress.base58
        )

        if (!txResult || !txResult.transaction) {
          throw new Error('Failed to build USDT transfer transaction')
        }

        transaction = txResult.transaction
      } else {
        // EVM chain - create a simple transfer transaction
        // For EVM, we'll create a basic transaction object
        // In a real app, you would use viem or ethers.js to build the transaction
        transaction = {
          to: recipientAddress,
          value: `0x${BigInt(Math.floor(amountNum * 1e18)).toString(16)}`, // Convert to wei
          chainId: deepLinkChainId,
        }
        addLog('Info', `Creating EVM transfer transaction for deep link: ${amountNum} ETH to ${recipientAddress}`)
      }

      // First, try to connect if not connected
      if (!deepLinkAdapter.isConnected()) {
        addLog('Info', `Connecting to ${deepLinkProviderType} via deep link...`)
        await deepLinkAdapter.connect(deepLinkChainId)
      }

      addLog('Info', 'Transaction built, opening wallet app for signing...')
      
      // Sign using deep link
      const signature = await deepLinkAdapter.signTransaction(transaction)
      addLog('Success', `Transaction signed successfully: ${signature.substring(0, 20)}...`)
      alert(`Transaction signed successfully!\nSignature: ${signature.substring(0, 20)}...`)
    } catch (error: any) {
      // Deep link may throw an error after opening the app
      // This is expected behavior for some providers
      if (error.message && (error.message.includes('opened') || error.message.includes('initiated'))) {
        addLog('Success', `Opened ${deepLinkProviderType} for transaction signing. Signature will be returned via callback.`)
      } else {
        addLog('Error', `Deep link transaction error: ${error.message}`)
        alert(`Deep link transaction error: ${error.message}`)
      }
    }
  }

  // Switch chain (EVM only)
  const handleSwitchChain = async (newChainId: number) => {
    try {
      await walletManager.requestSwitchChain(newChainId)
    } catch (error) {
      console.error('Chain switch error:', error)
    }
  }

  // Read USDT balance
  const handleReadUSDTBalance = async () => {
    if (!chainId || !address) return
    
    setIsLoadingBalance(true)
    setContractError('')
    
    try {
      const usdtAddress = getUSDTAddress(chainId)
      if (!usdtAddress) {
        setContractError(`Chain ${chainId} does not have USDT configured`)
        setIsLoadingBalance(false)
        return
      }

      // Read balance using readContract
      const balance = await walletManager.readContract(
        usdtAddress,
        ERC20_ABI,
        'balanceOf',
        [address]
      )

      // Read decimals
      const decimals = await walletManager.readContract(
        usdtAddress,
        ERC20_ABI,
        'decimals',
        []
      )

      // Format balance (USDT typically has 6 decimals, but we read it from contract)
      const balanceStr = balance.toString()
      const decimalsNum = Number(decimals)
      const formattedBalance = (Number(balanceStr) / Math.pow(10, decimalsNum)).toFixed(decimalsNum)
      
      setUsdtBalance(formattedBalance)
      addLog('Contract Read', `USDT Balance: ${formattedBalance}`)
    } catch (error: any) {
      console.error('Read balance error:', error)
      setContractError(error.message || 'Failed to read balance')
    } finally {
      setIsLoadingBalance(false)
    }
  }

  // USDT transfer
  const handleUSDTTransfer = async () => {
    if (!chainId || !transferTo || !transferAmount || !account?.chainType) return
    
    setIsTransferring(true)
    setContractError('')
    setTransferTxHash('')
    
    try {
      const usdtAddress = getUSDTAddress(chainId)
      if (!usdtAddress) {
        setContractError(`Chain ${chainId} does not have USDT configured`)
        setIsTransferring(false)
        return
      }

      // Validate address format
      const trimmedAddress = transferTo.trim()
      if (account.chainType === ChainType.EVM) {
        // EVM address validation
        if (!trimmedAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          setContractError('Invalid EVM address format. Expected: 0x followed by 40 hex characters')
          setIsTransferring(false)
          return
        }
      } else if (account.chainType === ChainType.TRON) {
        // Tron address validation
        if (!trimmedAddress.match(/^T[a-zA-Z0-9]{33}$/)) {
          setContractError('Invalid Tron address format. Expected: T followed by 33 characters')
          setIsTransferring(false)
          return
        }
      }

      // Read decimals first
      const decimals = await walletManager.readContract(
        usdtAddress,
        ERC20_ABI,
        'decimals',
        []
      )

      // Convert amount to wei (considering decimals)
      const decimalsNum = Number(decimals)
      const amount = Math.floor(Number(transferAmount) * Math.pow(10, decimalsNum))

      // Write to contract (transfer)
      const txHash = await walletManager.writeContract(
        usdtAddress,
        ERC20_ABI,
        'transfer',
        [trimmedAddress, amount.toString()]
      )

      setTransferTxHash(txHash)
      addLog('Contract Transaction', `USDT Transfer Successful: ${txHash.slice(0, 20)}...`)
      
      // Refresh balance after a delay
      setTimeout(() => {
        handleReadUSDTBalance()
      }, 2000)
    } catch (error: any) {
      console.error('Transfer error:', error)
      setContractError(error.message || 'Transfer failed')
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        addLog('Transaction Cancelled', 'User cancelled the transfer')
      }
    } finally {
      setIsTransferring(false)
    }
  }

  // Listen to wallet events
  React.useEffect(() => {
    if (!walletManager) return

    const handleAccountChanged = (newAccount: any) => {
      if (newAccount) {
        addLog('Account Changed', `New account: ${newAccount.nativeAddress.slice(0, 10)}...`)
      } else {
        addLog('Account Disconnected', 'Wallet disconnected or locked')
      }
    }

    const handleChainChanged = (chainId: number) => {
      addLog('Chain Changed', `Switched to chain ID: ${chainId}`)
    }

    const handlePrimaryWalletSwitched = (newPrimary: any, oldPrimary: any, chainType: string) => {
      addLog('Primary Wallet Switched', `From ${oldPrimary?.chainType || 'N/A'} to ${chainType}`)
    }

    const handleDisconnected = () => {
      addLog('Disconnected', 'Wallet disconnected')
    }

    // Register event listeners
    walletManager.on('accountChanged', handleAccountChanged)
    walletManager.on('chainChanged', handleChainChanged)
    walletManager.on('primaryWalletSwitched', handlePrimaryWalletSwitched)
    walletManager.on('disconnected', handleDisconnected)

    return () => {
      // Cleanup event listeners
      walletManager.off('accountChanged', handleAccountChanged)
      walletManager.off('chainChanged', handleChainChanged)
      walletManager.off('primaryWalletSwitched', handlePrimaryWalletSwitched)
      walletManager.off('disconnected', handleDisconnected)
    }
  }, [walletManager])

  React.useEffect(() => {
    detectWallets()
  }, [])

  return (
    <div className="App">
      {/* Telegram Mini App 环境提示 */}
      {isTelegram && (
        <div style={{
          padding: '10px',
          background: '#0088cc',
          color: 'white',
          marginBottom: '20px',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          📱 Running in Telegram Mini App
          {/* @ts-ignore */}
          {window.Telegram?.WebApp?.version && (
            <span style={{ marginLeft: '10px', opacity: 0.8 }}>
              (v{window.Telegram.WebApp.version})
            </span>
          )}
        </div>
      )}
      <header className="App-header">
        <h1>🔐 Enclave Wallet SDK Demo</h1>
        <p className="subtitle">Multi-chain wallet adapter for EVM & Tron</p>
      </header>

      <main className="App-main">
        {/* Restoring Connection Status */}
        {isRestoring && (
          <section className="section">
            <div className="info-box" style={{ textAlign: 'center', padding: '1rem' }}>
              <p>🔄 Restoring wallet connection...</p>
            </div>
          </section>
        )}

        {/* Wallet Status */}
        <section className="section">
          <h2>📊 Wallet Status</h2>
          <div className="status-card">
            <div className="status-item">
              <span className="label">Status:</span>
              <span className={`value ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '✅ Connected' : '❌ Not Connected'}
              </span>
            </div>
            {isConnected && account && (
              <>
                <div className="status-item">
                  <span className="label">Address:</span>
                  <span className="value monospace">{address}</span>
                </div>
                <div className="status-item">
                  <span className="label">Chain ID:</span>
                  <span className="value">{chainId}</span>
                </div>
                <div className="status-item">
                  <span className="label">Chain Type:</span>
                  <span className="value">{account.chainType.toUpperCase()}</span>
                </div>
                <div className="status-item">
                  <span className="label">Universal Address:</span>
                  <span className="value monospace small">{account.universalAddress}</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Wallet Detection */}
        {!isConnected && (
          <section className="section">
            <h2>🔍 Available Wallets</h2>
            {!detectionDone && (
              <button onClick={detectWallets} className="btn btn-secondary">
                Detect Wallets
              </button>
            )}
            {detectionDone && (
              <>
                <div className="wallet-grid">
                  <div className="wallet-category">
                    <h3>EVM Wallets</h3>
                    <div className="wallet-buttons">
                      {availableWallets
                        .filter((w) => w.chainType === ChainType.EVM)
                        .map((wallet) => (
                          <div key={wallet.walletType} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleConnect(wallet.walletType)}
                            className={`btn ${wallet.isAvailable ? 'btn-primary' : 'btn-disabled'}`}
                            disabled={!wallet.isAvailable || isConnecting}
                          >
                            {wallet.isAvailable ? '✅' : '❌'} {wallet.walletType}
                          </button>
                            {/* Multi-chain button for WalletConnect */}
                            {wallet.walletType === WalletType.WALLETCONNECT && wallet.isAvailable && (
                              <button
                                onClick={() => handleConnectMultiChain(wallet.walletType, [1, 56, 137, 42161, 10, 8453])}
                                className="btn btn-secondary"
                                disabled={isConnecting}
                                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                                title="Connect to multiple chains: Ethereum (1), BSC (56), Polygon (137), Arbitrum (42161), Optimism (10), Base (8453)"
                              >
                                🔗 Multi-Chain (ETH, BSC, Polygon, Arbitrum, Optimism, Base)
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="wallet-category">
                    <h3>Tron Wallets</h3>
                    <div className="wallet-buttons">
                      {availableWallets
                        .filter((w) => w.chainType === ChainType.TRON)
                        .map((wallet) => (
                          <button
                            key={wallet.walletType}
                            onClick={() => handleConnect(wallet.walletType)}
                            className={`btn ${wallet.isAvailable ? 'btn-primary' : 'btn-disabled'}`}
                            disabled={!wallet.isAvailable || isConnecting}
                          >
                            {wallet.isAvailable ? '✅' : '❌'} {wallet.walletType}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
                <button onClick={detectWallets} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
                  🔄 Re-detect Wallets
                </button>
              </>
            )}
            {connectError && (
              <div className="error-message">Error: {connectError.message}</div>
            )}
          </section>
        )}

        {/* Connected Wallets */}
        {isConnected && connectedWallets.length > 0 && (
          <section className="section">
            <h2>💼 Connected Wallets ({connectedWallets.length})</h2>
            <div className="connected-wallets">
              {connectedWallets.map((wallet) => (
                <div
                  key={wallet.chainType}
                  className={`wallet-card ${wallet.isPrimary ? 'primary' : ''}`}
                >
                  <div className="wallet-card-header">
                    <span className="wallet-type">
                      {wallet.isPrimary && '⭐ '}
                      {wallet.walletType} ({wallet.chainType.toUpperCase()})
                    </span>
                    {!wallet.isPrimary && (
                      <button
                        onClick={() => handleSwitchPrimary(wallet.chainType)}
                        className="btn btn-small"
                      >
                        Set as Primary
                      </button>
                    )}
                  </div>
                  <div className="wallet-card-body">
                    <div className="wallet-info">
                      <span className="label">Address:</span>
                      <span className="value monospace small">
                        {wallet.account.nativeAddress}
                      </span>
                    </div>
                    <div className="wallet-info">
                      <span className="label">Chain ID:</span>
                      <span className="value">{wallet.account.chainId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Message Signing Test */}
        {isConnected && (
          <section className="section">
            <h2>✍️ Sign Message</h2>
            <div className="sign-container">
              <textarea
                value={messageToSign}
                onChange={(e) => setMessageToSign(e.target.value)}
                placeholder="Enter message to sign..."
                rows={3}
                className="textarea"
              />
              <button
                onClick={handleSignMessage}
                disabled={isSigning || !messageToSign}
                className="btn btn-primary"
              >
                {isSigning ? 'Signing...' : 'Sign Message'}
              </button>
              {signature && (
                <div className="signature-result">
                  <strong>Signature:</strong>
                  <code className="signature-value">{signature}</code>
                </div>
              )}
              {signError && (
                <div className="error-message">Error: {signError.message}</div>
              )}
            </div>
          </section>
        )}

        {/* Transaction Signing Test */}
        {isConnected && (
          <section className="section">
            <h2>🔏 Sign Transaction</h2>
            <div className="sign-container">
              <div className="info-box">
                <p>
                  <strong>Current Wallet Type:</strong> {account?.chainType?.toUpperCase()}
                </p>
                <p className="small">
                  {account?.chainType === ChainType.EVM
                    ? '✅ EVM Wallet - Will sign a test transaction'
                    : '⚠️ Tron Wallet - Requires complete transaction object (created via TronWeb)'}
                </p>
              </div>
              {account?.chainType === ChainType.TRON && (
                <>
                  <div className="input-group">
                    <label>
                      <strong>Recipient Address (Tron):</strong>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="TQn9Y2khEsLMWDmHXz5Y8j5K5K5K5K5K5K5K"
                      value={txRecipientAddress}
                      onChange={(e) => setTxRecipientAddress(e.target.value)}
                      disabled={isSigningTx}
                    />
                  </div>
                  <div className="input-group">
                    <label>
                      <strong>Amount (USDT):</strong>
                    </label>
                    <input
                      type="number"
                      className="input"
                      placeholder="1"
                      min="0"
                      step="0.000001"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      disabled={isSigningTx}
                    />
                  </div>
                </>
              )}
              <button
                onClick={handleSignTransaction}
                disabled={isSigningTx || (account?.chainType === ChainType.TRON && (!txRecipientAddress.trim() || !txAmount))}
                className="btn btn-primary"
              >
                {isSigningTx ? 'Signing...' : 'Sign Transaction'}
              </button>
              {txSignature && (
                <div className="signature-result">
                  <strong>Transaction Signature:</strong>
                  <code className="signature-value">{txSignature}</code>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Universal Deep Link Test */}
        <section className="section">
          <h2>🔗 Universal Deep Link (Mobile / Telegram Mini App)</h2>
          <div className="info-box">
            <p>
              <strong>Deep Link Status:</strong>{' '}
              {isDeepLinkAvailable ? (
                <span style={{ color: 'green' }}>
                  ✅ Available {isTelegram ? '(Telegram Mini App)' : '(Mobile Device)'}
                </span>
              ) : (
                <span style={{ color: 'orange' }}>
                  ⚠️ Only available on mobile devices or Telegram Mini App
                </span>
              )}
            </p>
            <p className="small">
              Deep links can sign directly without establishing a connection first.
              The wallet app will open and use the user's account automatically.
              {isTelegram && (
                <>
                  <br />
                  <strong>Telegram Mini App:</strong> Deep links work in Telegram Mini App on mobile platforms.
                </>
              )}
            </p>
          </div>

          {/* Always show operations in Telegram Mini App, or if deep link is available */}
          {(isDeepLinkAvailable || isTelegram) && (
            <>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>
                  <strong>Select Wallet Provider:</strong>
                </label>
                <select
                  value={deepLinkProviderType}
                  onChange={(e) => setDeepLinkProviderType(e.target.value as DeepLinkProviderType)}
                  className="input"
                >
                  <option value={DeepLinkProviderType.TOKENPOCKET}>TokenPocket (EVM + TRON)</option>
                  <option value={DeepLinkProviderType.IMTOKEN}>ImToken (EVM + TRON)</option>
                  <option value={DeepLinkProviderType.METAMASK}>MetaMask (EVM)</option>
                  <option value={DeepLinkProviderType.OKX}>OKX (EVM + TRON)</option>
                  <option value={DeepLinkProviderType.TRONLINK}>TronLink (TRON)</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>
                  <strong>Select Chain Type:</strong>
                </label>
                <select
                  value={deepLinkChainType}
                  onChange={(e) => {
                    const chainType = e.target.value as ChainType
                    setDeepLinkChainType(chainType)
                    // Set default chain ID based on chain type
                    if (chainType === ChainType.TRON) {
                      setDeepLinkChainId(195) // TRON Mainnet
                    } else {
                      setDeepLinkChainId(1) // Ethereum Mainnet
                    }
                  }}
                  className="input"
                >
                  <option value={ChainType.EVM}>EVM (Ethereum, BSC, Polygon, etc.)</option>
                  <option value={ChainType.TRON}>TRON</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>
                  <strong>Chain ID:</strong>
                </label>
                <input
                  type="number"
                  value={deepLinkChainId}
                  onChange={(e) => setDeepLinkChainId(parseInt(e.target.value) || 1)}
                  className="input"
                  placeholder="1 (Ethereum) or 195 (TRON)"
                />
              </div>

              {/* Deep Link: Sign Message */}
              <div className="contract-section" style={{ marginBottom: '1.5rem' }}>
                <h3>1️⃣ Sign Message via Deep Link</h3>
                <div className="input-group">
                  <label>
                    <strong>Message to Sign:</strong>
                  </label>
                  <textarea
                    value={deepLinkMessage}
                    onChange={(e) => setDeepLinkMessage(e.target.value)}
                    placeholder="Enter message to sign..."
                    rows={2}
                    className="textarea"
                  />
                </div>
                <button
                  onClick={handleDeepLinkSignMessage}
                  disabled={!deepLinkMessage.trim()}
                  className="btn btn-primary"
                >
                  📱 Open {deepLinkProviderType} to Sign Message
                </button>
                <div className="info-box" style={{ marginTop: '0.5rem' }}>
                  <p className="small">
                    ⚠️ Note: Deep link will open the wallet app. Signature result will be returned via callback URL.
                    {isTelegram && !isDeepLinkAvailable && (
                      <> In Telegram Mini App, deep links may work even if detection shows unavailable.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Deep Link: Sign Transaction */}
              <div className="contract-section">
                <h3>2️⃣ Sign Transaction via Deep Link</h3>
                <div className="info-box">
                  <p className="small">
                    {deepLinkChainType === ChainType.TRON
                      ? 'This will create a USDT (TRC20) transfer transaction and open the wallet app for signing. TronWeb is required to build the transaction.'
                      : 'This will create a transaction and open the wallet app for signing. For EVM chains, you can sign any transaction object.'}
                  </p>
                </div>
                <div className="input-group">
                  <label>
                    <strong>Recipient Address ({deepLinkChainType === ChainType.TRON ? 'Tron' : 'EVM'}):</strong>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder={deepLinkChainType === ChainType.TRON ? 'TQn9Y2khEsLMWDmHXz5Y8j5K5K5K5K5K5K5K' : '0x...'}
                    value={deepLinkTxRecipient}
                    onChange={(e) => setDeepLinkTxRecipient(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>
                    <strong>Amount ({deepLinkChainType === ChainType.TRON ? 'USDT' : 'Native Currency'}):</strong>
                  </label>
                  <input
                    type="number"
                    className="input"
                    placeholder="1"
                    min="0"
                    step="0.000001"
                    value={deepLinkTxAmount}
                    onChange={(e) => setDeepLinkTxAmount(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleDeepLinkSignTransaction}
                  disabled={!deepLinkTxRecipient.trim() || !deepLinkTxAmount}
                  className="btn btn-primary"
                >
                  📱 Open {deepLinkProviderType} to Sign Transaction
                </button>
                <div className="info-box" style={{ marginTop: '0.5rem' }}>
                  <p className="small">
                    ⚠️ Note: Deep link will open the wallet app. Transaction signature will be returned via callback URL.
                    You need to implement callback handling to receive the signature result.
                    {isTelegram && !isDeepLinkAvailable && (
                      <> In Telegram Mini App, deep links may work even if detection shows unavailable.</>
                    )}
                  </p>
                </div>
              </div>
            </>
          )}

          {!isDeepLinkAvailable && (
            <div className="info-box">
              <p>
                <strong>💡 How to test Deep Link:</strong>
              </p>
              <ul style={{ textAlign: 'left', marginTop: '0.5rem' }}>
                <li>Open this page on a mobile device (iOS/Android) or in Telegram Mini App</li>
                <li>Ensure the selected wallet app (TokenPocket, ImToken, MetaMask, OKX, or TronLink) is installed</li>
                <li>Deep link will automatically open the wallet app</li>
                <li>Signature results are returned via callback URL (requires server-side handling)</li>
                {isTelegram && (
                  <li>
                    <strong>Telegram Mini App:</strong> Deep links work on mobile platforms (iOS/Android), 
                    but may not work on web platform
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>

        {/* Contract Interaction (EVM & TRON) */}
        {isConnected && (
          <section className="section">
            <h2>📜 Contract Interaction - {account?.chainType?.toUpperCase()}</h2>
            
            {/* Read USDT Balance */}
            <div className="contract-section">
              <h3>1️⃣ Read Contract - USDT Balance</h3>
              <div className="info-box">
                <p>
                  <strong>Current Chain:</strong> Chain ID {chainId}
                </p>
                <p className="small">
                  {getUSDTAddress(chainId!)
                    ? `✅ USDT Contract: ${getUSDTAddress(chainId!)}`
                    : '❌ Current chain has no USDT contract configured'}
                </p>
              </div>
              
              <button
                onClick={handleReadUSDTBalance}
                disabled={isLoadingBalance || !getUSDTAddress(chainId!)}
                className="btn btn-primary"
              >
                {isLoadingBalance ? 'Loading...' : '🔍 Read USDT Balance'}
              </button>
              
              {usdtBalance && (
                <div className="balance-result">
                  <strong>💰 Your USDT Balance:</strong>
                  <div className="balance-value">{usdtBalance} USDT</div>
                </div>
              )}
            </div>

            {/* USDT Transfer */}
            <div className="contract-section">
              <h3>2️⃣ Write Contract - USDT Transfer</h3>
              <div className="transfer-form">
                <div className="form-group">
                  <label>Recipient Address:</label>
                  <input
                    type="text"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    placeholder={
                      account?.chainType === ChainType.TRON 
                        ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' 
                        : '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
                    }
                    className="input"
                  />
                  <span className="input-hint">
                    {account?.chainType === ChainType.TRON 
                      ? '⚠️ Tron address format: T + 33 characters (Base58)' 
                      : '⚠️ EVM address format: 0x + 40 hex characters'}
                  </span>
                </div>
                <div className="form-group">
                  <label>Amount:</label>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="1.0"
                    min="0"
                    step="0.000001"
                    className="input"
                  />
                  <span className="input-hint">USDT</span>
                </div>
                <button
                  onClick={handleUSDTTransfer}
                  disabled={isTransferring || !transferTo || !transferAmount || !getUSDTAddress(chainId!)}
                  className="btn btn-primary"
                >
                  {isTransferring ? 'Transferring...' : '💸 Transfer USDT'}
                </button>
              </div>

              {transferTxHash && chainId && account?.chainType && (
                <div className="signature-result">
                  <strong>✅ Transaction Hash:</strong>
                  <code className="signature-value">{transferTxHash}</code>
                  {(() => {
                    const explorer = getBlockExplorerUrl(transferTxHash, chainId, account.chainType)
                    return (
                      <a
                        href={explorer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-external"
                      >
                        View on {explorer.name} →
                      </a>
                    )
                  })()}
                </div>
              )}
            </div>

            {contractError && (
              <div className="error-message">
                <strong>⚠️ Error:</strong> {contractError}
              </div>
            )}

            <div className="info-box" style={{ marginTop: '1.5rem' }}>
              <p className="small">
                💡 <strong>Tips:</strong> 
                <br />
                • readContract: Free on-chain data reading (balanceOf, decimals, etc.)
                <br />
                • writeContract: Send transactions to modify on-chain state (transfer, approve, etc.)
                <br />
                • Ensure wallet has sufficient native tokens for gas fees 
                {account?.chainType === ChainType.EVM ? '(ETH/BNB/MATIC)' : '(TRX/Energy)'}
              </p>
            </div>
          </section>
        )}

        {/* Chain Switch (EVM Only) */}
        {isConnected && account?.chainType === ChainType.EVM && (
          <section className="section">
            <h2>🔄 Switch Chain (EVM Only)</h2>
            <div className="chain-buttons">
              <button onClick={() => handleSwitchChain(1)} className="btn btn-secondary">
                Ethereum Mainnet (1)
              </button>
              <button onClick={() => handleSwitchChain(56)} className="btn btn-secondary">
                BSC Mainnet (56)
              </button>
              <button onClick={() => handleSwitchChain(137)} className="btn btn-secondary">
                Polygon Mainnet (137)
              </button>
              <button onClick={() => handleSwitchChain(11155111)} className="btn btn-secondary">
                Sepolia Testnet (11155111)
              </button>
            </div>
          </section>
        )}

        {/* Connect Additional Wallet */}
        {isConnected && (
          <section className="section">
            <h2>➕ Connect Additional Wallet</h2>
            <div className="wallet-buttons">
              {availableWallets
                .filter((w) => !connectedWallets.some((cw) => cw.walletType === w.walletType))
                .map((wallet) => (
                  <button
                    key={wallet.walletType}
                    onClick={() => handleConnectAdditional(wallet.walletType)}
                    className={`btn ${wallet.isAvailable ? 'btn-primary' : 'btn-disabled'}`}
                    disabled={!wallet.isAvailable || isConnecting}
                  >
                    {wallet.isAvailable ? '✅' : '❌'} {wallet.walletType}
                  </button>
                ))}
            </div>
          </section>
        )}

        {/* Disconnect */}
        {isConnected && (
          <section className="section">
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="btn btn-danger"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </section>
        )}

        {/* Event Log */}
        <section className="section">
          <h2>📡 Event Log (Real-time)</h2>
          <div className="event-log">
            {eventLogs.length === 0 ? (
              <p className="event-log-empty">Waiting for wallet events...</p>
            ) : (
              eventLogs.map((log, index) => (
                <div key={index} className={`event-log-item event-${log.type}`}>
                  <span className="event-time">{log.time}</span>
                  <span className="event-type">{log.type}</span>
                  <span className="event-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
          <div className="event-log-hint">
            <p>💡 Tips:</p>
            <ul>
              <li>Switch accounts in MetaMask → Automatically detected and displayed</li>
              <li>Switch networks in MetaMask → Automatically detected and displayed</li>
              <li>Click "Set as Primary" to switch primary wallet → Display switch event</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="App-footer">
        <p>
          Built with{' '}
          <a href="https://github.com/enclave-hq/enclave" target="_blank" rel="noopener noreferrer">
            @enclave-hq/wallet-sdk
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App

