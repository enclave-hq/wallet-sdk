# 合约交互指南 (Contract Interaction Guide)

## 📚 概述

示例应用现在包含完整的智能合约交互演示，展示如何使用 Wallet SDK 与链上合约进行交互。

---

## 🎯 功能列表

### 1. **Read Contract (读取合约)** 📖
- **用途**: 从区块链读取数据（免费，无需 Gas）
- **示例**: 查询 USDT 余额
- **涉及方法**:
  - `balanceOf(address)` - 查询代币余额
  - `decimals()` - 查询代币精度

### 2. **Write Contract (写入合约)** ✍️
- **用途**: 向区块链发送交易（需要 Gas 费用）
- **示例**: USDT 转账
- **涉及方法**:
  - `transfer(address to, uint256 amount)` - 转账代币

---

## 🔧 支持的链和合约

### Ethereum Mainnet (Chain ID: 1)
```
USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7
USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

### Sepolia Testnet (Chain ID: 11155111)
```
USDT: 0x7169D38820dfd117C3FA1f22a697dBA58d90BA06
USDC: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
```

### BSC Mainnet (Chain ID: 56)
```
USDT: 0x55d398326f99059fF775485246999027B3197955
USDC: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
```

### BSC Testnet (Chain ID: 97)
```
USDT: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd
USDC: 0x64544969ed7EBf5f083679233325356EbE738930
```

### Polygon Mainnet (Chain ID: 137)
```
USDT: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F (6 decimals)
USDC: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 (6 decimals)
```

### Arbitrum One (Chain ID: 42161)
```
USDT: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
USDC: 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8
```

---

## 💻 代码示例

### 读取 USDT 余额

```typescript
import { ERC20_ABI, getUSDTAddress } from './abis/erc20'

// 获取 USDT 合约地址
const usdtAddress = getUSDTAddress(chainId)

// 读取余额
const balance = await walletManager.readContract(
  usdtAddress,
  ERC20_ABI,
  'balanceOf',
  [userAddress]
)

// 读取精度
const decimals = await walletManager.readContract(
  usdtAddress,
  ERC20_ABI,
  'decimals',
  []
)

// 格式化余额
const formattedBalance = (Number(balance) / Math.pow(10, Number(decimals))).toFixed(Number(decimals))
console.log(`Balance: ${formattedBalance} USDT`)
```

### USDT 转账

```typescript
import { ERC20_ABI, getUSDTAddress } from './abis/erc20'

// 获取 USDT 合约地址
const usdtAddress = getUSDTAddress(chainId)

// 读取精度
const decimals = await walletManager.readContract(
  usdtAddress,
  ERC20_ABI,
  'decimals',
  []
)

// 转换金额（考虑精度）
const amount = Math.floor(transferAmount * Math.pow(10, Number(decimals)))

// 执行转账
const txHash = await walletManager.writeContract(
  usdtAddress,
  ERC20_ABI,
  'transfer',
  [recipientAddress, amount.toString()]
)

console.log(`Transaction hash: ${txHash}`)
```

---

## 🎨 UI 功能

### 1. 读取余额界面
- **显示当前链信息**
- **显示 USDT 合约地址**
- **一键读取余额按钮**
- **余额显示（带格式化）**
- **加载状态提示**

### 2. 转账界面
- **收款地址输入框** (支持 0x... 格式)
- **转账数量输入框** (支持小数)
- **转账按钮** (自动验证输入)
- **交易哈希显示**
- **Etherscan 链接** (快速查看交易)
- **自动刷新余额** (转账成功后 2 秒)

### 3. 错误处理
- **链不支持提示** (当前链没有配置 USDT)
- **用户拒绝提示** (取消交易签名)
- **网络错误提示**
- **合约调用失败提示**

### 4. 事件日志
- 📗 **合约读取** - 余额查询成功
- 📙 **合约交易** - 转账交易成功
- 📕 **交易取消** - 用户取消转账

---

## ⚠️ 重要提示

### Gas 费用
- ✅ **readContract**: 免费，无需 Gas
- 💰 **writeContract**: 需要原生代币支付 Gas
  - Ethereum/Sepolia → 需要 ETH
  - BSC → 需要 BNB
  - Polygon → 需要 MATIC
  - Arbitrum → 需要 ETH

### 余额要求
确保钱包中有：
1. **足够的 USDT** (转账金额)
2. **足够的原生代币** (Gas 费用)

### 测试建议
1. **使用测试网** (Sepolia, BSC Testnet)
2. **小额测试** (先转少量代币)
3. **验证地址** (转账前仔细检查收款地址)
4. **查看交易** (点击 Etherscan 链接确认)

### 精度处理
- **USDT (Ethereum)**: 6 decimals
- **USDT (Polygon)**: 6 decimals
- **其他 ERC20**: 可能是 18 decimals
- **SDK 自动处理**: 调用 `decimals()` 自动获取

---

## 🚀 使用流程

### 完整流程示例

```
1. 连接钱包 (MetaMask)
   ↓
2. 选择正确的链 (如 BSC Mainnet)
   ↓
3. 点击 "Read USDT Balance"
   ↓
4. 查看当前余额
   ↓
5. 输入收款地址和转账金额
   ↓
6. 点击 "Transfer USDT"
   ↓
7. 在 MetaMask 中确认交易
   ↓
8. 等待交易确认
   ↓
9. 查看交易哈希和更新后的余额
```

---

## 🔍 故障排除

### 问题: "Chain does not have USDT configured"
**解决**: 切换到支持的链 (Ethereum, BSC, Polygon, Arbitrum)

### 问题: "User rejected transaction"
**解决**: 在钱包中点击"确认"而不是"拒绝"

### 问题: "Insufficient funds for gas"
**解决**: 钱包中添加更多原生代币 (ETH/BNB/MATIC)

### 问题: 余额读取失败
**可能原因**:
- RPC 节点问题 → 稍后重试
- 合约地址错误 → 检查链 ID
- 网络连接问题 → 检查网络

### 问题: 转账失败
**可能原因**:
- USDT 余额不足
- Gas 费用不足
- 收款地址无效
- 合约调用失败 (如已暂停)

---

## 📖 相关文档

- [Wallet SDK API 文档](../README.md)
- [签名方法说明](../SIGNING_METHODS.md)
- [MetaMask 限制说明](../METAMASK_LIMITATIONS.md)
- [快速开始指南](../QUICKSTART.md)

---

## 🛠️ 扩展建议

### 添加更多代币
在 `example/src/abis/erc20.ts` 中添加：
```typescript
export const TOKEN_ADDRESSES = {
  1: {
    USDT: '0x...',
    USDC: '0x...',
    DAI: '0x...',  // 添加新代币
    WETH: '0x...',
  }
}
```

### 添加更多功能
- `approve()` - 授权代币使用
- `allowance()` - 查询授权额度
- `transferFrom()` - 代理转账
- `totalSupply()` - 查询总供应量

### 添加其他合约
- **NFT 合约** (ERC721)
- **多重签名钱包**
- **DeFi 协议** (Uniswap, Aave)
- **DAO 治理合约**

---

**更新日期**: 2025-01-23  
**示例应用版本**: v1.0.0  
**Wallet SDK 版本**: v1.0.0

