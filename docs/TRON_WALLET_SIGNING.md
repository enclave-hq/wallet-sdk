# TRON 钱包签名支持

## ✅ 完全支持！

`@enclave-hq/wallet-sdk` **完全支持 TRON 钱包签名**，包括二维码签名功能。

## 支持的 TRON 钱包类型

| 钱包类型 | 连接方式 | 二维码支持 | 签名支持 |
|---------|---------|-----------|---------|
| **WalletConnect (Tron)** | ✅ 支持 | ✅ 自动显示二维码 | ✅ 支持 |
| **TronLink** | ✅ 浏览器扩展 | ❌ 不需要 | ✅ 支持 |
| **Deep Link** | ✅ 深度链接 | ❌ 不需要 | ✅ 支持 |

## 使用方法

### 方案 1：WalletConnect Tron（推荐，支持二维码）✅

**这是最推荐的方案，自动显示二维码，无需后端！**

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager({
  walletConnectProjectId: 'your-project-id' // 从 https://cloud.walletconnect.com 获取
})

// 连接 WalletConnect Tron（会自动显示二维码）
const account = await walletManager.connect(WalletType.WALLETCONNECT_TRON, 195) // 195 = TRON 主网

console.log('Connected:', account.universalAddress)
// 输出: "195:TJmm..." (TRON 主网地址)

// 签名消息（直接返回签名，无需轮询）
const signature = await walletManager.signMessage('Hello TRON')
console.log('Signature:', signature)
```

**特点：**
- ✅ 自动生成并显示二维码
- ✅ 支持 170+ 支持 WalletConnect 的钱包（如 TokenPocket）
- ✅ 签名结果直接返回，无需后端
- ✅ 支持 TRON 主网和测试网

### 方案 2：TronLink 浏览器扩展

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager()

// 连接 TronLink（需要浏览器扩展）
const account = await walletManager.connect(WalletType.TRONLINK, 195)

// 签名消息
const signature = await walletManager.signMessage('Hello TRON')
```

### 方案 3：React Hook 使用

```tsx
import React from 'react'
import { WalletProvider, useWallet, useAccount, useConnect } from '@enclave-hq/wallet-sdk/react'
import { WalletType } from '@enclave-hq/wallet-sdk'

function App() {
  return (
    <WalletProvider>
      <TronWalletComponent />
    </WalletProvider>
  )
}

function TronWalletComponent() {
  const { account, isConnected } = useAccount()
  const { connect, isConnecting } = useConnect()
  const { signMessage } = useWallet()

  const handleConnect = async () => {
    try {
      // 连接 WalletConnect Tron（会自动显示二维码）
      await connect(WalletType.WALLETCONNECT_TRON, 195)
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const handleSign = async () => {
    try {
      const signature = await signMessage('Hello TRON')
      console.log('Signature:', signature)
    } catch (error) {
      console.error('Sign failed:', error)
    }
  }

  if (!isConnected) {
    return (
      <button onClick={handleConnect} disabled={isConnecting}>
        {isConnecting ? '连接中...' : '连接 TRON 钱包'}
      </button>
    )
  }

  return (
    <div>
      <p>已连接: {account?.nativeAddress}</p>
      <button onClick={handleSign}>签名消息</button>
    </div>
  )
}
```

## TRON 链 ID

```typescript
// TRON 主网
const TRON_MAINNET = 195

// TRON 测试网 (Shasta)
const TRON_TESTNET_SHASTA = 201910292

// TRON 测试网 (Nile)
const TRON_TESTNET_NILE = 2494104990
```

## 签名示例

### 签名消息

```typescript
// 使用 WalletConnect Tron
const walletManager = new WalletManager({
  walletConnectProjectId: 'your-project-id'
})

await walletManager.connect(WalletType.WALLETCONNECT_TRON, 195)

// 签名消息（使用 TIP-191 标准）
const signature = await walletManager.signMessage('Hello TRON')
console.log('Signature:', signature)
```

### 签名交易

```typescript
// 创建 TRON 交易（需要使用 TronWeb 或类似库）
import TronWeb from 'tronweb'

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io'
})

// 创建交易
const transaction = await tronWeb.transactionBuilder.sendTrx(
  'TRecipientAddress...',
  1000000, // 1 TRX = 1,000,000 SUN
  'TSenderAddress...'
)

// 使用 WalletConnect Tron 签名
await walletManager.connect(WalletType.WALLETCONNECT_TRON, 195)
const signedTx = await walletManager.signTransaction(transaction)

// 广播交易
const result = await tronWeb.trx.broadcast(signedTx)
console.log('Transaction hash:', result.txid)
```

## WalletConnect Tron 二维码说明

当使用 `WalletType.WALLETCONNECT_TRON` 连接时：

1. **自动显示二维码**：WalletConnect SDK 会自动生成并显示二维码
2. **支持的钱包**：支持所有 WalletConnect 兼容的 TRON 钱包，如：
   - TokenPocket
   - Trust Wallet
   - 其他支持 WalletConnect 的 TRON 钱包
3. **无需后端**：签名结果通过 WalletConnect 协议直接返回，不需要后端服务

## 常见问题

### Q: WalletConnect Tron 显示"没有找到支持的钱包"？

**A:** 可能的原因：
1. 设备上没有安装支持 WalletConnect 的 TRON 钱包（如 TokenPocket）
2. 钱包应用未打开或未响应
3. 网络连接问题

**解决方案：**
- 安装 TokenPocket 或其他支持 WalletConnect 的 TRON 钱包
- 确保钱包应用已打开
- 检查网络连接

### Q: 如何获取 WalletConnect Project ID？

**A:** 
1. 访问 [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. 注册/登录账号
3. 创建新项目或选择现有项目
4. 复制 Project ID

### Q: 支持哪些 TRON 网络？

**A:** 支持：
- ✅ TRON 主网 (Chain ID: 195)
- ✅ TRON 测试网 Shasta (Chain ID: 201910292)
- ✅ TRON 测试网 Nile (Chain ID: 2494104990)

### Q: 签名使用什么标准？

**A:** 
- **消息签名**：使用 TIP-191 标准（TRON 的消息签名标准）
- **交易签名**：使用 TRON 原生交易签名格式

## 完整示例

查看 `example/` 目录中的完整示例代码，包括：
- WalletConnect Tron 连接
- 消息签名
- 交易签名
- React Hook 使用

## 总结

✅ **TRON 钱包签名完全支持**  
✅ **WalletConnect Tron 支持二维码，无需后端**  
✅ **支持消息签名和交易签名**  
✅ **支持主网和测试网**  

推荐使用 **WalletConnect Tron** 方案，因为它：
- 自动显示二维码
- 支持更多钱包
- 无需后端服务
- 使用简单



















