import React, { useState } from 'react'
import { useWallet, useAccount, useConnect, useDisconnect, useSignMessage, useSignTransaction } from '@enclave-hq/wallet-sdk/react'
import { WalletType, ChainType, ConnectedWallet } from '@enclave-hq/wallet-sdk'
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

  const [messageToSign, setMessageToSign] = useState('Hello from Enclave Wallet SDK!')
  const [signature, setSignature] = useState<string>('')
  const [txSignature, setTxSignature] = useState<string>('')
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

  // Add event log
  const addLog = (type: string, message: string) => {
    const time = new Date().toLocaleTimeString()
    setEventLogs(prev => [{ time, type, message }, ...prev].slice(0, 10)) // Keep only last 10 logs
  }

  // Get block explorer URL based on chain
  const getBlockExplorerUrl = (txHash: string, currentChainId: number, currentChainType: string): { url: string; name: string } => {
    if (currentChainType === ChainType.TRON) {
      // Tron chains
      if (currentChainId === 195) {
        return { url: `https://tronscan.org/#/transaction/${txHash}`, name: 'Tronscan' }
      } else if (currentChainId === 2494104990) {
        return { url: `https://nile.tronscan.org/#/transaction/${txHash}`, name: 'Tronscan (Nile)' }
      }
      return { url: `https://tronscan.org/#/transaction/${txHash}`, name: 'Tronscan' }
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
        // Tron transaction example - requires a complete transaction object
        // Note: This requires a real Tron transaction object
        alert('Tron transaction signing requires creating a complete transaction object first. Please use TronWeb API to create a transaction, then call signTransaction.')
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
                    : '⚠️ Tron Wallet - Requires complete transaction object'}
                </p>
              </div>
              <button
                onClick={handleSignTransaction}
                disabled={isSigningTx}
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

