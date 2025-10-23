import React from 'react'
import ReactDOM from 'react-dom/client'
import { WalletProvider } from '@enclave-hq/wallet-sdk/react'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>,
)

