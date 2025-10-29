# 🚀 Wallet SDK Quick Start Guide

## 📦 Building the SDK

```bash
# 1. Navigate to wallet-sdk directory
cd wallet-sdk

# 2. Install dependencies
npm install

# 3. Build the SDK
npm run build
```

After building, you'll see the `dist/` directory containing:
- `index.js` - CommonJS format
- `index.mjs` - ES Module format
- `index.d.ts` - TypeScript type definitions
- `react/` - React integration layer

## 🧪 Running the Example App

```bash
# 1. Navigate to example directory
cd example

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open your browser and visit [http://localhost:3000](http://localhost:3000)

## 🎯 Example App Features

The example app demonstrates all core Wallet SDK features:

### 1. **Wallet Connection**
- Detect available wallets in browser (MetaMask, TronLink)
- One-click wallet connection
- Support for connecting multiple wallets

### 2. **Account Management**
- Display current connected account information
- Display all connected wallets
- Switch primary wallet

### 3. **Signing Features**
- Sign arbitrary messages
- Real-time signature result display

### 4. **Chain Switching**
- Switch to different EVM chains (Ethereum, BSC, Polygon, Sepolia)
- Automatically handle chain addition (if chain not in wallet)

### 5. **Event Listening**
- Automatically detect account changes
- Automatically detect chain changes
- Real-time UI updates

## 🔧 Development Tips

### Using Watch Mode

During development, you can run both SDK watch mode and example app simultaneously:

```bash
# Terminal 1: SDK watch mode
cd wallet-sdk
npm run dev

# Terminal 2: Example app
cd wallet-sdk/example
npm run dev
```

This way, when you modify SDK code, the example app will automatically reload.

### Testing Different Wallets

1. **MetaMask (EVM)**
   - Ensure MetaMask extension is installed in browser
   - Switch to the network you want to test

2. **TronLink (Tron)**
   - Ensure TronLink extension is installed in browser
   - Default connection to Tron mainnet (Chain ID: 195)

3. **Private Key Wallet (Development)**
   - For development and testing only
   - Do not use in production environment

## 📝 Code Examples

### Basic Connection

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager()

// Connect MetaMask
const account = await walletManager.connect(WalletType.METAMASK, 1)
console.log('Connected:', account.universalAddress)
```

### React Hooks

```tsx
import { useWallet, useAccount, useConnect } from '@enclave-hq/wallet-sdk/react'

function MyComponent() {
  const { account, isConnected } = useAccount()
  const { connect } = useConnect()

  return (
    <button onClick={() => connect(WalletType.METAMASK)}>
      {isConnected ? account?.nativeAddress : 'Connect'}
    </button>
  )
}
```

### Signing Messages

```typescript
// Basic signing
const signature = await walletManager.signMessage('Hello World')

// Sign with specific chain type wallet
const signature = await walletManager.signMessageWithChainType(
  'Hello Tron',
  ChainType.TRON
)
```

### Contract Calls

```typescript
// Read contract
const balance = await walletManager.readContract(
  '0x...tokenAddress',
  erc20Abi,
  'balanceOf',
  ['0x...userAddress']
)

// Write contract
const txHash = await walletManager.writeContract(
  '0x...tokenAddress',
  erc20Abi,
  'transfer',
  ['0x...recipientAddress', '1000000000000000000']
)

// Wait for transaction confirmation
const receipt = await walletManager.waitForTransaction(txHash)
```

## 🐛 Common Issues

### 1. "Wallet not available" Error

**Cause**: Wallet extension not installed or not loaded

**Solution**:
- Ensure corresponding wallet extension is installed (MetaMask/TronLink)
- Refresh page and retry
- Check browser console for errors

### 2. "Connection rejected" Error

**Cause**: User rejected connection request in wallet

**Solution**:
- Click "Connect" in wallet popup
- Check if wallet is unlocked

### 3. "Chain not supported" Error

**Cause**: Wallet doesn't support or hasn't added the chain

**Solution**:
```typescript
await walletManager.requestSwitchChain(chainId, {
  addChainIfNotExists: true,
  chainConfig: {
    chainId: 56,
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
  }
})
```

### 4. Build Errors

If you encounter build errors, try:

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Clean build artifacts and rebuild
rm -rf dist
npm run build
```

## 📚 Next Steps

- Check out the complete [API Documentation](../docs/wallet-sdk/API接口.md)
- Learn about [Architecture Design](../docs/wallet-sdk/ARCHITECTURE.md)
- Follow the [Integration Guide](../docs/wallet-sdk/INTEGRATION.md)

## 💡 Tips

1. **Use private key wallet for development**: Quick testing without browser extensions
2. **Use event listeners**: Real-time response to account and chain changes
3. **Error handling**: Always wrap async operations with try-catch
4. **Type safety**: Make full use of TypeScript type definitions

## 🤝 Feedback

If you have questions or suggestions, please submit an [Issue](https://github.com/enclave-hq/enclave/issues).

---

**Happy coding! 🎉**