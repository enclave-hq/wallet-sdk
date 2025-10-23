# Wallet SDK Example Application

Complete demonstration application showcasing all core features and best practices of the Wallet SDK.

## 🎯 Features

### 1. Wallet Connection 🔌
- ✅ **Auto-detection** - Detect installed wallets (MetaMask, TronLink)
- ✅ **Multi-chain Support** - EVM and Tron chains
- ✅ **Multi-wallet Management** - Connect multiple wallets simultaneously
- ✅ **Primary Wallet Switching** - Dynamically switch active wallet

### 2. Signing Features ✍️
- ✅ **Message Signing** (`signMessage`) - For authentication
- ✅ **Transaction Signing** (`signTransaction`) - Offline transaction signing
- ✅ **TypedData Signing** - EIP-712 structured data

### 3. Contract Interaction 📜
- ✅ **Read Contract** - Read on-chain data (free)
  - Query USDT balance
  - Read token decimals
- ✅ **Write Contract** - Write on-chain data (requires Gas)
  - USDT transfer
  - Auto balance refresh
  - Transaction hash display
  - Multi-chain explorer support

### 4. Chain Management 🔄
- ✅ **Chain Switching** - Switch EVM networks (Ethereum, BSC, Polygon)
- ✅ **Auto-add Chain** - Automatically add chains to wallet if not present

### 5. Event Listeners 📡
- ✅ **Account Change Listener** - Real-time account change detection
- ✅ **Chain Change Listener** - Real-time network change detection
- ✅ **Primary Wallet Switch Listener** - Multi-wallet switch events
- ✅ **Disconnect Listener** - Wallet disconnect events

---

## 🚀 Quick Start

### Install Dependencies

```bash
cd example
npm install
```

### Start Development Server

```bash
npm run dev
```

App will start at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Built files will be in the `dist/` directory

---

## 📁 Project Structure

```
example/
├── src/
│   ├── App.tsx              # Main application component
│   ├── App.css              # Application styles
│   ├── main.tsx            # React entry point
│   ├── index.css           # Global styles
│   └── abis/
│       └── erc20.ts        # ERC20 contract ABI and addresses
├── public/                  # Static assets
├── index.html              # HTML template
├── package.json            # Project configuration
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── README.md               # This document
```

---

## 🎮 Usage Guide

### Step 1: Detect Wallets

Click "Detect Wallets" button, the app will automatically detect:
- ✅ MetaMask (EVM)
- ✅ TronLink (Tron)
- ✅ Other Web3 wallets

### Step 2: Connect Wallet

Select an available wallet and click to connect:
- 🟢 Green checkmark ✅ - Wallet installed and available
- 🔴 Red cross ❌ - Wallet not installed

### Step 3: View Wallet Status

After successful connection, you can see:
- 📍 Current address
- 🔗 Chain ID
- 🌐 Chain type (EVM/TRON)
- 🔑 Universal Address

### Step 4: Test Signing Features

#### Message Signing
1. Enter message to sign
2. Click "Sign Message"
3. Confirm in wallet
4. View signature result

#### Transaction Signing
1. Click "Sign Transaction"
2. Confirm in wallet
3. View signature result

### Step 5: Test Contract Interaction

#### Read USDT Balance
1. Ensure connected to supported chain (Ethereum, BSC, Polygon, Tron)
2. Click "Read USDT Balance"
3. View balance (auto-formatted)

#### USDT Transfer
1. Enter recipient address
   - **EVM**: `0x...` format (42 characters)
   - **Tron**: `T...` format (34 characters)
2. Enter transfer amount
3. Click "Transfer USDT"
4. Confirm transaction in wallet
5. View transaction hash
6. Click link to view on block explorer

**Supported Block Explorers:**
- Ethereum: Etherscan
- BSC: BscScan
- Polygon: PolygonScan
- Arbitrum: Arbiscan
- Optimism: Optimism Explorer
- Base: BaseScan
- Avalanche: SnowTrace
- Fantom: FTMScan
- Tron: Tronscan

### Step 6: Switch Chain (EVM Only)

Click preset chain buttons:
- Ethereum Mainnet (1)
- BSC Mainnet (56)
- Polygon Mainnet (137)
- Sepolia Testnet (11155111)

### Step 7: Connect Additional Wallet

To use multiple wallets simultaneously:
1. Click "Connect Additional Wallet"
2. Select another wallet type
3. Use "Set as Primary" to switch primary wallet

### Step 8: View Event Log

All wallet events are displayed in real-time in the event log:
- 📗 Account switched
- 📘 Chain switched
- 📙 Primary wallet switched
- 📗 Contract read
- 📙 Contract transaction
- 📕 Disconnected

---

## 🔧 Supported Chains

### Ethereum
- **Mainnet**: Chain ID 1
- **Sepolia Testnet**: Chain ID 11155111
- **Goerli Testnet**: Chain ID 5

### BSC (Binance Smart Chain)
- **Mainnet**: Chain ID 56
- **Testnet**: Chain ID 97

### Polygon
- **Mainnet**: Chain ID 137
- **Mumbai Testnet**: Chain ID 80001

### Arbitrum
- **Arbitrum One**: Chain ID 42161
- **Sepolia Testnet**: Chain ID 421614

### Optimism
- **Mainnet**: Chain ID 10
- **Sepolia Testnet**: Chain ID 11155420

### Base
- **Mainnet**: Chain ID 8453
- **Sepolia Testnet**: Chain ID 84532

### Avalanche
- **C-Chain**: Chain ID 43114
- **Fuji Testnet**: Chain ID 43113

### Fantom
- **Opera**: Chain ID 250
- **Testnet**: Chain ID 4002

### Tron
- **Mainnet**: Chain ID 195
- **Nile Testnet**: Chain ID 2494104990

---

## 💡 Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **@enclave-hq/wallet-sdk** - Wallet management
- **@enclave-hq/chain-utils** - Chain utilities and SLIP-44 support
- **Viem** - Ethereum interaction (underlying)
- **TronWeb** - Tron interaction (underlying)

---

## 📚 Related Documentation

- [Wallet SDK Main Documentation](../README.md)
- [Quick Start Guide](../QUICKSTART.md)
- [Signing Methods](../SIGNING_METHODS.md)
- [MetaMask Limitations](../METAMASK_LIMITATIONS.md)
- [Tron Address Validation Fix](../TRON_ADDRESS_VALIDATION_FIX.md)

---

## ⚠️ Important Notes

### MetaMask Account Switching
- MetaMask **does not** detect switches to unconnected accounts
- To use a new account, disconnect first, then reconnect
- See [METAMASK_LIMITATIONS.md](../METAMASK_LIMITATIONS.md) for details

### Gas Fees
- **readContract**: Free, no Gas required
- **writeContract**: Requires native tokens to pay Gas
  - Ensure wallet has sufficient ETH/BNB/MATIC/TRX before transfer

### Address Format Validation
- **EVM**: `0x` + 40 hex characters (e.g., `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0`)
- **Tron**: `T` + 33 Base58 characters (e.g., `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`)
- App automatically validates address format based on chain type

### Testing Recommendations
- Use **testnets** for testing (Sepolia, BSC Testnet, Nile)
- Get test tokens from **faucets**
- Start with **small amounts**

---

## 🐛 Troubleshooting

### Wallet Not Detected
**Solution**:
1. Ensure wallet extension is installed
2. Refresh the page
3. Click "Re-detect Wallets"
4. For TronLink, wait a few seconds (async injection)

### Connection Failed
**Solution**:
1. Check if wallet is unlocked
2. Check if connection was allowed in wallet
3. Check browser console for error messages

### Contract Call Failed
**Solution**:
1. Ensure connected to correct chain
2. Check if contract address is correct
3. Ensure wallet has sufficient Gas
4. Check event log for error messages
5. Verify address format matches chain type

### Tron Transfer Error
**Common Issue**: `Cannot read properties of undefined (reading 'toLowerCase')`

**Solution**:
1. Ensure you're entering a valid Tron address (starts with `T`)
2. Refresh browser with `Cmd/Ctrl + Shift + R`
3. Check console logs for detailed error information
4. See [TRON_ADDRESS_VALIDATION_FIX.md](../TRON_ADDRESS_VALIDATION_FIX.md) for details

---

## 🎨 Customization

### Add New Tokens

Edit `src/abis/erc20.ts`:

```typescript
export const TOKEN_ADDRESSES = {
  1: {
    USDT: '0x...',
    USDC: '0x...',
    YOUR_TOKEN: '0x...',  // Add new token
  }
}
```

### Add New Chains

Add chain switch button in `src/App.tsx`:

```tsx
<button onClick={() => handleSwitchChain(YOUR_CHAIN_ID)}>
  Your Chain Name (CHAIN_ID)
</button>
```

### Add Block Explorers

Update `getBlockExplorerUrl()` function in `src/App.tsx`:

```typescript
case YOUR_CHAIN_ID:
  return { url: `https://explorer.com/tx/${txHash}`, name: 'Explorer Name' }
```

---

## 🔍 Code Examples

### Basic Connection

```typescript
import { useConnect, useAccount } from '@enclave-hq/wallet-sdk/react'

function App() {
  const { connect } = useConnect()
  const { account, isConnected } = useAccount()
  
  const handleConnect = async () => {
    await connect(WalletType.METAMASK)
  }
  
  return (
    <div>
      {isConnected ? (
        <p>Connected: {account.nativeAddress}</p>
      ) : (
        <button onClick={handleConnect}>Connect</button>
      )}
    </div>
  )
}
```

### Sign Message

```typescript
import { useSignMessage } from '@enclave-hq/wallet-sdk/react'

function SignDemo() {
  const { signMessage } = useSignMessage()
  
  const handleSign = async () => {
    const signature = await signMessage('Hello Enclave!')
    console.log('Signature:', signature)
  }
  
  return <button onClick={handleSign}>Sign Message</button>
}
```

### Contract Interaction

```typescript
import { useWallet } from '@enclave-hq/wallet-sdk/react'

function ContractDemo() {
  const { walletManager } = useWallet()
  
  // Read contract
  const readBalance = async () => {
    const balance = await walletManager.readContract(
      contractAddress,
      ABI,
      'balanceOf',
      [userAddress]
    )
    return balance
  }
  
  // Write contract
  const transfer = async () => {
    const txHash = await walletManager.writeContract(
      contractAddress,
      ABI,
      'transfer',
      [recipientAddress, amount]
    )
    return txHash
  }
}
```

---

## 📝 License

MIT License - See [LICENSE](../LICENSE)

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

**Build Date**: 2025-01-23  
**SDK Version**: @enclave-hq/wallet-sdk v1.0.0

