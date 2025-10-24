# 🚀 Wallet SDK 快速开始指南

## 📦 构建 SDK

```bash
# 1. 进入 wallet-sdk 目录
cd wallet-sdk

# 2. 安装依赖
npm install

# 3. 构建 SDK
npm run build
```

构建完成后，您会看到 `dist/` 目录，包含：
- `index.js` - CommonJS 格式
- `index.mjs` - ES Module 格式
- `index.d.ts` - TypeScript 类型定义
- `react/` - React 集成层

## 🧪 运行示例应用

```bash
# 1. 进入示例目录
cd example

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 🎯 示例应用功能

示例应用演示了所有 Wallet SDK 的核心功能：

### 1. **钱包连接**
- 检测浏览器中可用的钱包（MetaMask, TronLink）
- 一键连接钱包
- 支持连接多个钱包

### 2. **账户管理**
- 显示当前连接的账户信息
- 显示所有已连接的钱包
- 切换主钱包

### 3. **签名功能**
- 签名任意消息
- 实时显示签名结果

### 4. **链切换**
- 切换到不同的 EVM 链（Ethereum, BSC, Polygon, Sepolia）
- 自动处理链添加（如果钱包中没有该链）

### 5. **事件监听**
- 自动检测账户变化
- 自动检测链变化
- 实时更新 UI

## 🔧 开发建议

### 使用 Watch 模式

在开发时，可以同时运行 SDK 的 watch 模式和示例应用：

```bash
# 终端 1: SDK watch 模式
cd wallet-sdk
npm run dev

# 终端 2: 示例应用
cd wallet-sdk/example
npm run dev
```

这样，当您修改 SDK 代码时，示例应用会自动重新加载。

### 测试不同的钱包

1. **MetaMask (EVM)**
   - 确保浏览器安装了 MetaMask 扩展
   - 切换到您想测试的网络

2. **TronLink (Tron)**
   - 确保浏览器安装了 TronLink 扩展
   - 默认连接到 Tron 主网（Chain ID: 195）

3. **私钥钱包（开发用）**
   - 仅用于开发和测试
   - 不要在生产环境中使用

## 📝 代码示例

### 基础连接

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager()

// 连接 MetaMask
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

### 签名消息

```typescript
// 基础签名
const signature = await walletManager.signMessage('Hello World')

// 使用特定链类型的钱包签名
const signature = await walletManager.signMessageWithChainType(
  'Hello Tron',
  ChainType.TRON
)
```

### 合约调用

```typescript
// 读取合约
const balance = await walletManager.readContract(
  '0x...tokenAddress',
  erc20Abi,
  'balanceOf',
  ['0x...userAddress']
)

// 写入合约
const txHash = await walletManager.writeContract(
  '0x...tokenAddress',
  erc20Abi,
  'transfer',
  ['0x...recipientAddress', '1000000000000000000']
)

// 等待交易确认
const receipt = await walletManager.waitForTransaction(txHash)
```

## 🐛 常见问题

### 1. "Wallet not available" 错误

**原因**：钱包扩展未安装或未加载

**解决**：
- 确保安装了对应的钱包扩展（MetaMask/TronLink）
- 刷新页面重试
- 检查浏览器控制台是否有错误

### 2. "Connection rejected" 错误

**原因**：用户在钱包中拒绝了连接请求

**解决**：
- 在钱包弹窗中点击"连接"
- 检查钱包是否已解锁

### 3. "Chain not supported" 错误

**原因**：钱包不支持或未添加该链

**解决**：
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

### 4. 构建错误

如果遇到构建错误，尝试：

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install

# 清理构建产物并重新构建
rm -rf dist
npm run build
```

## 📚 下一步

- 查看完整的 [API 文档](../docs/wallet-sdk/API接口.md)
- 了解[架构设计](../docs/wallet-sdk/ARCHITECTURE.md)
- 学习[集成指南](../docs/wallet-sdk/INTEGRATION.md)

## 💡 提示

1. **开发时使用私钥钱包**：快速测试，无需浏览器扩展
2. **使用事件监听**：实时响应账户和链的变化
3. **错误处理**：始终使用 try-catch 包裹异步操作
4. **类型安全**：充分利用 TypeScript 类型定义

## 🤝 反馈

如有问题或建议，请提交 [Issue](https://github.com/enclave-hq/enclave/issues)。

---

**祝您开发愉快！🎉**


