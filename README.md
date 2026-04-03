# @enclave-hq/wallet-sdk

> Multi-chain wallet adapter for Enclave - supports EVM and Tron ecosystems

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 📋 Overview

**@enclave-hq/wallet-sdk** is a powerful, extensible wallet adapter library that provides a unified interface for connecting to multiple blockchain wallets across different ecosystems (EVM and Tron).

### Key Features

- **🔗 Multi-Chain Support**: Unified interface for EVM (Ethereum, BSC, Polygon, etc.) and Tron
- **🔌 Multiple Wallets**: MetaMask, TronLink, WalletConnect, and private key support
- **⚡️ Easy Integration**: Simple API with React hooks
- **🎯 Type-Safe**: Full TypeScript support with comprehensive type definitions
- **🔐 Secure**: Standard-compliant signing (EIP-191, TIP-191, EIP-712)
- **📦 Tree-Shakeable**: Modern build system with ESM and CJS support
- **🎨 Extensible**: Plugin-based architecture for adding new wallets and chains

## 📦 Installation

```bash
npm install @enclave-hq/wallet-sdk
# or
yarn add @enclave-hq/wallet-sdk
# or
pnpm add @enclave-hq/wallet-sdk
```

## 🚀 Quick Start

### Basic Usage (Vanilla JS/TS)

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

// Create wallet manager
const walletManager = new WalletManager()

// Connect to MetaMask
const account = await walletManager.connect(WalletType.METAMASK, 1) // Ethereum Mainnet

console.log('Connected:', account.universalAddress)
// Output: "1:0x1234567890123456789012345678901234567890"

// Sign a message
const signature = await walletManager.signMessage('Hello World')

// Disconnect
await walletManager.disconnect()
```

### React Integration

```tsx
import React from 'react'
import { WalletProvider, useWallet, useAccount, useConnect } from '@enclave-hq/wallet-sdk/react'
import { WalletType } from '@enclave-hq/wallet-sdk'

// 1. Wrap your app with WalletProvider
function App() {
  return (
    <WalletProvider>
      <YourApp />
    </WalletProvider>
  )
}

// 2. Use wallet hooks in your components
function YourApp() {
  const { account, isConnected } = useAccount()
  const { connect, isConnecting } = useConnect()
  const { disconnect } = useWallet()

  const handleConnect = async () => {
    try {
      await connect(WalletType.METAMASK)
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  if (!isConnected) {
    return (
      <button onClick={handleConnect} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
      </button>
    )
  }

  return (
    <div>
      <p>Connected: {account?.nativeAddress}</p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  )
}
```

### QR Code Signing (扫码签名)

```tsx
import React, { useState } from 'react'
import { useQRCodeSigner, QRCodeModal } from '@enclave-hq/wallet-sdk/react'

function SignButton() {
  const [showModal, setShowModal] = useState(false)
  
  const { qrCodeDataUrl, status, startSign, cancel, error } = useQRCodeSigner({
    requestId: `sign-${Date.now()}`,
    requestUrl: `https://example.com/sign?requestId=sign-${Date.now()}`,
    pollUrl: 'https://api.example.com/sign/status',
  })

  const handleSign = async () => {
    setShowModal(true)
    try {
      const signature = await startSign()
      console.log('Signature:', signature)
      setShowModal(false)
    } catch (error) {
      console.error('Sign failed:', error)
    }
  }

  return (
    <>
      <button onClick={handleSign}>扫码签名</button>
      
      <QRCodeModal
        isOpen={showModal}
        onClose={() => {
          cancel()
          setShowModal(false)
        }}
        qrCodeDataUrl={qrCodeDataUrl}
        status={status}
        error={error}
        title="使用钱包扫码签名"
      />
    </>
  )
}
```

## 🎯 Core Concepts

### Universal Address

A chain-agnostic address format: `chainId:address`

```typescript
// Example:
"1:0x1234..." // Ethereum Mainnet
"56:0x5678..." // BSC Mainnet
"195:TJmm..." // Tron Mainnet
```

### Primary Wallet + Connected Wallets Pool

The SDK uses a hybrid architecture where you can:
- Connect multiple wallets simultaneously (EVM + Tron)
- Designate one as the "primary wallet" for default operations
- Switch the primary wallet dynamically

```typescript
// Connect MetaMask as primary wallet
await walletManager.connect(WalletType.METAMASK)

// Connect TronLink as additional wallet
await walletManager.connectAdditional(WalletType.TRONLINK)

// Switch primary wallet to TronLink
await walletManager.switchPrimaryWallet(ChainType.TRON)

// Get all connected wallets
const wallets = walletManager.getConnectedWallets()
```

## 📚 Supported Wallets

| Wallet | Chain Type | Status |
|--------|------------|--------|
| MetaMask | EVM | ✅ Supported |
| TronLink | Tron | ✅ Supported |
| WalletConnect | EVM | ✅ Supported |
| WalletConnect Tron | Tron | ✅ Supported |
| Coinbase Wallet | EVM | 🚧 Coming Soon |
| Private Key | EVM/Tron | ✅ Dev Only |
| QR Code Signing | EVM/Tron | ✅ Supported |

## 📖 Documentation

Full documentation is available in the `/docs` folder:

- [Architecture Design](../docs/wallet-sdk/ARCHITECTURE.md)
- [Design Goals](../docs/wallet-sdk/DESIGN.md)
- [API Reference](../docs/wallet-sdk/API接口.md)
- [Integration Guide](../docs/wallet-sdk/INTEGRATION.md)
- [State Management](../docs/wallet-sdk/STATE_AND_ACCOUNT.md)
- [Standards & Signing](../docs/wallet-sdk/STANDARDS.md)
- [QR Code Signing](./docs/QR_CODE_SIGNING.md) - 二维码签名功能
- [TRON Wallet Signing](./docs/TRON_WALLET_SIGNING.md) - TRON 钱包签名支持

## 🧪 Running the Example

A fully functional example application is included:

```bash
cd example
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the demo.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Watch mode (for development)
npm run dev

# Run linter
npm run lint

# Type check
npm run type-check
```

## 📄 License

MIT © Enclave Team

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](../CONTRIBUTING.md) for details.

## 🔗 Links

- [Enclave Documentation](../README.md)
- [GitHub Repository](https://github.com/enclave-hq/enclave)
- [Report Issues](https://github.com/enclave-hq/enclave/issues)

---

**Built with ❤️ by the Enclave Team**
