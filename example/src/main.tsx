import React from 'react'
import ReactDOM from 'react-dom/client'
import { WalletProvider } from '@enclave-hq/wallet-sdk/react'
import { WalletManager } from '@enclave-hq/wallet-sdk'
import App from './App'
import './index.css'

// WalletConnect Project ID
// Get your project ID from https://cloud.walletconnect.com/
// For testing, you can use a demo project ID or create your own
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

// Initialize WalletManager with WalletConnect support
const walletManager = new WalletManager({
  walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider walletManager={walletManager}>
      <App />
    </WalletProvider>
  </React.StrictMode>,
)

