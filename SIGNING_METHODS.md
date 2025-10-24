# 签名方法说明 (Signing Methods)

## 📝 概述

Wallet SDK 现在提供两种签名方法，分别用于不同的场景：

1. **消息签名 (Message Signing)** - `signMessage()`
2. **交易签名 (Transaction Signing)** - `signTransaction()`

---

## ✍️ 1. 消息签名 (Message Signing)

### 用途
用于签名**纯文本消息**，通常用于：
- 身份验证 (Authentication)
- 登录验证 (Login verification)
- 授权证明 (Authorization proof)
- 数据完整性验证 (Data integrity)

### API

```typescript
// 使用 WalletManager
const signature = await walletManager.signMessage('Hello World')

// 使用 React Hook
const { signMessage } = useSignMessage()
const signature = await signMessage('Hello World')
```

### 钱包实现

#### EVM (MetaMask)
- **方法**: `personal_sign`
- **格式**: EIP-191 标准
- **输入**: 纯文本字符串
- **输出**: 65 字节签名 (hex)

```typescript
// MetaMask 实现
const signature = await provider.request({
  method: 'personal_sign',
  params: [message, address],
})
```

#### Tron (TronLink)
- **方法**: `trx.signMessageV2()`
- **格式**: TIP-191 标准
- **输入**: 纯文本字符串
- **输出**: hex 签名

```typescript
// TronLink 实现
const signature = await tronWeb.trx.signMessageV2(message)
```

---

## 🔏 2. 交易签名 (Transaction Signing)

### 用途
用于签名**交易对象**，但不立即发送，通常用于：
- 离线交易构建 (Offline transaction building)
- 多签钱包 (Multi-signature wallets)
- 批量交易 (Batch transactions)
- 交易中继 (Transaction relaying)

### API

```typescript
// 使用 WalletManager
const signature = await walletManager.signTransaction(transaction)

// 使用 React Hook
const { signTransaction } = useSignTransaction()
const signature = await signTransaction(transaction)
```

### 钱包实现

#### EVM (MetaMask)
- **方法**: `eth_signTransaction`
- **输入**: 交易对象
- **输出**: 签名后的交易 (hex)

```typescript
// EVM 交易对象
interface EVMTransaction {
  to: string
  value?: string | bigint
  data?: string
  gas?: string | bigint
  gasPrice?: string | bigint
  maxFeePerGas?: string | bigint
  maxPriorityFeePerGas?: string | bigint
  nonce?: number
  chainId?: number
}

// 示例
const tx = {
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  value: '0x0',
  data: '0x',
}
const signature = await signTransaction(tx)
```

#### Tron (TronLink)
- **方法**: `trx.sign()`
- **输入**: 交易对象
- **输出**: 签名后的交易

```typescript
// Tron 交易对象
interface TronTransaction {
  txID?: string
  raw_data?: any
  raw_data_hex?: string
  visible?: boolean
}

// 注意：Tron 交易需要先通过 TronWeb 创建完整的交易对象
const unsignedTx = await tronWeb.transactionBuilder.sendTrx(...)
const signature = await signTransaction(unsignedTx)
```

---

## 🔍 关键区别

| 特性 | signMessage() | signTransaction() |
|------|--------------|-------------------|
| **输入** | 纯文本字符串 | 交易对象 |
| **用途** | 身份验证、授权 | 交易签名 |
| **MetaMask** | `personal_sign` | `eth_signTransaction` |
| **TronLink** | `trx.signMessageV2()` | `trx.sign()` |
| **输出** | 签名字符串 | 签名的交易 |
| **是否发送** | ❌ 不发送 | ❌ 不发送（需手动广播） |

---

## ⚠️ 重要提示

### TronLink 特殊说明

TronLink 有两个签名方法，**不可混用**：

1. **`trx.signMessageV2(message: string)`** 
   - ✅ 用于**消息签名**
   - ❌ 不能用于交易签名
   - 如果传入交易对象会报错: `Invalid transaction provided`

2. **`trx.sign(transaction: object)`**
   - ✅ 用于**交易签名**
   - ❌ 不能用于消息签名
   - 如果传入字符串会报错: `Invalid transaction provided`

### 错误示例 ❌

```typescript
// 错误：用 trx.sign() 签名消息
const signature = await tronWeb.trx.sign('Hello World') // ❌ 会失败

// 错误：用 trx.signMessageV2() 签名交易
const signature = await tronWeb.trx.signMessageV2({ to: '...', value: '...' }) // ❌ 会失败
```

### 正确示例 ✅

```typescript
// 正确：用 signMessage() 签名消息
const signature = await walletManager.signMessage('Hello World') // ✅

// 正确：用 signTransaction() 签名交易
const tx = { to: '0x...', value: '0x0' }
const signature = await walletManager.signTransaction(tx) // ✅
```

---

## 📚 使用示例

### React 组件示例

```tsx
import { useSignMessage, useSignTransaction } from '@enclave-hq/wallet-sdk/react'

function MyComponent() {
  const { signMessage } = useSignMessage()
  const { signTransaction } = useSignTransaction()

  // 消息签名 - 用于身份验证
  const handleLogin = async () => {
    const message = `Sign this message to login: ${Date.now()}`
    const signature = await signMessage(message)
    // 发送到后端验证
  }

  // 交易签名 - 用于离线交易
  const handleSignTx = async () => {
    const tx = {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      value: '1000000000000000000', // 1 ETH
      data: '0x',
    }
    const signedTx = await signTransaction(tx)
    // 稍后广播或发送给中继服务
  }

  return (
    <>
      <button onClick={handleLogin}>Sign Message (Login)</button>
      <button onClick={handleSignTx}>Sign Transaction</button>
    </>
  )
}
```

---

## 🎯 最佳实践

1. **明确用途**
   - 需要身份验证/授权 → 使用 `signMessage()`
   - 需要签名交易 → 使用 `signTransaction()`

2. **错误处理**
   - 用户可能拒绝签名 → 捕获 `SignatureRejectedError`
   - 检查钱包类型 → 确保交易格式正确

3. **用户体验**
   - 清楚说明签名的目的
   - 显示签名的内容
   - 提供取消选项

4. **安全性**
   - 验证签名结果
   - 不要在客户端存储私钥
   - 使用 HTTPS 传输签名

---

## 🔗 相关文档

- [EIP-191: Signed Data Standard](https://eips.ethereum.org/EIPS/eip-191)
- [TIP-191: Tron Signed Data Standard](https://github.com/tronprotocol/tips/blob/master/tip-191.md)
- [MetaMask Signing Methods](https://docs.metamask.io/wallet/how-to/sign-data/)
- [TronLink Documentation](https://developers.tron.network/docs/tronlink)

---

**更新日期**: 2025-01-23  
**版本**: Wallet SDK v1.0.0


