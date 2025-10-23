import React, { useState } from 'react'
import { useWallet, useAccount, useConnect, useDisconnect, useSignMessage } from '@enclave-hq/wallet-sdk/react'
import { WalletType, ChainType, ConnectedWallet } from '@enclave-hq/wallet-sdk'
import { WalletDetector, getEVMWallets, getTronWallets } from '@enclave-hq/wallet-sdk'
import './App.css'

function App() {
  const { walletManager, connectedWallets, switchPrimaryWallet } = useWallet()
  const { account, isConnected, address, chainId } = useAccount()
  const { connect, connectAdditional, isConnecting, error: connectError } = useConnect()
  const { disconnect, isDisconnecting } = useDisconnect()
  const { signMessage, isSigning, error: signError } = useSignMessage()

  const [messageToSign, setMessageToSign] = useState('Hello from Enclave Wallet SDK!')
  const [signature, setSignature] = useState<string>('')
  const [availableWallets, setAvailableWallets] = useState<any[]>([])
  const [detectionDone, setDetectionDone] = useState(false)
  const [eventLogs, setEventLogs] = useState<Array<{ time: string; type: string; message: string }>>([])

  // 添加事件日志
  const addLog = (type: string, message: string) => {
    const time = new Date().toLocaleTimeString()
    setEventLogs(prev => [{ time, type, message }, ...prev].slice(0, 10)) // 只保留最近 10 条
  }

  // 检测钱包
  const detectWallets = async () => {
    const detector = new WalletDetector()
    
    // 先快速检测一次
    let wallets = await detector.detectAllWallets()
    setAvailableWallets(wallets)
    
    // 如果 TronLink 未检测到，等待并重试（TronLink 注入是异步的）
    const tronLinkWallet = wallets.find(w => w.walletType === WalletType.TRONLINK)
    if (!tronLinkWallet?.isAvailable) {
      addLog('检测中', '等待 TronLink 加载...')
      const isTronLinkAvailable = await detector.waitForWallet(WalletType.TRONLINK, 3000)
      if (isTronLinkAvailable) {
        addLog('检测成功', 'TronLink 已就绪')
        // 重新检测所有钱包
        wallets = await detector.detectAllWallets()
        setAvailableWallets(wallets)
      } else {
        addLog('检测失败', 'TronLink 未安装或未启用')
      }
    }
    
    setDetectionDone(true)
  }

  // 连接钱包
  const handleConnect = async (type: WalletType) => {
    try {
      await connect(type)
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  // 连接额外的钱包
  const handleConnectAdditional = async (type: WalletType) => {
    try {
      await connectAdditional(type)
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  // 断开连接
  const handleDisconnect = async () => {
    try {
      await disconnect()
      setSignature('')
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  // 签名消息
  const handleSignMessage = async () => {
    try {
      const sig = await signMessage(messageToSign)
      setSignature(sig)
    } catch (error) {
      console.error('Sign error:', error)
    }
  }

  // 切换主钱包
  const handleSwitchPrimary = async (chainType: ChainType) => {
    try {
      await switchPrimaryWallet(chainType)
    } catch (error) {
      console.error('Switch error:', error)
    }
  }

  // 切换链（仅 EVM）
  const handleSwitchChain = async (newChainId: number) => {
    try {
      await walletManager.requestSwitchChain(newChainId)
    } catch (error) {
      console.error('Chain switch error:', error)
    }
  }

  // 监听钱包事件
  React.useEffect(() => {
    if (!walletManager) return

    const handleAccountChanged = (newAccount: any) => {
      if (newAccount) {
        addLog('账户切换', `新账户: ${newAccount.nativeAddress.slice(0, 10)}...`)
      } else {
        addLog('账户断开', '钱包已断开或锁定')
      }
    }

    const handleChainChanged = (chainId: number) => {
      addLog('链切换', `切换到链 ID: ${chainId}`)
    }

    const handlePrimaryWalletSwitched = (newPrimary: any, oldPrimary: any, chainType: string) => {
      addLog('主钱包切换', `从 ${oldPrimary?.chainType || 'N/A'} 切换到 ${chainType}`)
    }

    const handleDisconnected = () => {
      addLog('断开连接', '钱包已断开')
    }

    // 注册事件监听
    walletManager.on('accountChanged', handleAccountChanged)
    walletManager.on('chainChanged', handleChainChanged)
    walletManager.on('primaryWalletSwitched', handlePrimaryWalletSwitched)
    walletManager.on('disconnected', handleDisconnected)

    return () => {
      // 清理事件监听
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
        {/* 钱包状态 */}
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

        {/* 钱包检测 */}
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
                  🔄 重新检测钱包
                </button>
              </>
            )}
            {connectError && (
              <div className="error-message">Error: {connectError.message}</div>
            )}
          </section>
        )}

        {/* 已连接的钱包 */}
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

        {/* 签名测试 */}
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

        {/* 链切换（仅 EVM） */}
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

        {/* 连接额外钱包 */}
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

        {/* 断开连接 */}
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

        {/* 事件日志 */}
        <section className="section">
          <h2>📡 Event Log (实时监听)</h2>
          <div className="event-log">
            {eventLogs.length === 0 ? (
              <p className="event-log-empty">等待钱包事件...</p>
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
            <p>💡 提示：</p>
            <ul>
              <li>在 MetaMask 中切换账户 → 自动检测并显示</li>
              <li>在 MetaMask 中切换网络 → 自动检测并显示</li>
              <li>点击"Set as Primary"切换主钱包 → 显示切换事件</li>
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

