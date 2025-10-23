# Wallet SDK Example Application

完整的 Wallet SDK 演示应用，展示所有核心功能和最佳实践。

## 🎯 功能展示

### 1. 钱包连接 🔌
- ✅ **自动检测** - 检测已安装的钱包（MetaMask, TronLink）
- ✅ **多链支持** - EVM 和 Tron 链
- ✅ **多钱包管理** - 同时连接多个钱包
- ✅ **主钱包切换** - 动态切换活跃钱包

### 2. 签名功能 ✍️
- ✅ **消息签名** (`signMessage`) - 用于身份验证
- ✅ **交易签名** (`signTransaction`) - 离线交易签名
- ✅ **TypedData 签名** - EIP-712 结构化数据

### 3. 合约交互 📜
- ✅ **Read Contract** - 读取链上数据（免费）
  - 查询 USDT 余额
  - 读取代币精度
- ✅ **Write Contract** - 写入链上数据（需要 Gas）
  - USDT 转账
  - 自动余额刷新
  - 交易哈希显示

### 4. 链管理 🔄
- ✅ **链切换** - 切换 EVM 网络（Ethereum, BSC, Polygon）
- ✅ **自动添加链** - 不存在的链自动添加到钱包

### 5. 事件监听 📡
- ✅ **账户切换监听** - 实时检测账户变化
- ✅ **链切换监听** - 实时检测网络变化
- ✅ **主钱包切换监听** - 多钱包切换事件
- ✅ **断开连接监听** - 钱包断开事件

---

## 🚀 快速开始

### 安装依赖

```bash
cd example
npm install
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动

### 构建生产版本

```bash
npm run build
```

构建后的文件在 `dist/` 目录

---

## 📁 项目结构

```
example/
├── src/
│   ├── App.tsx              # 主应用组件
│   ├── App.css              # 应用样式
│   ├── main.tsx            # React 入口
│   ├── index.css           # 全局样式
│   └── abis/
│       └── erc20.ts        # ERC20 合约 ABI 和地址
├── public/                  # 静态资源
├── index.html              # HTML 模板
├── package.json            # 项目配置
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── README.md               # 本文档
└── CONTRACT_INTERACTION_GUIDE.md  # 合约交互详细指南
```

---

## 🎮 使用指南

### Step 1: 检测钱包

点击 "Detect Wallets" 按钮，应用会自动检测：
- ✅ MetaMask (EVM)
- ✅ TronLink (Tron)
- ✅ 其他 Web3 钱包

### Step 2: 连接钱包

选择一个可用的钱包并点击连接：
- 🟢 绿色勾号 ✅ - 钱包已安装且可用
- 🔴 红色叉号 ❌ - 钱包未安装

### Step 3: 查看钱包状态

连接成功后，可以看到：
- 📍 当前地址
- 🔗 链 ID
- 🌐 链类型 (EVM/TRON)
- 🔑 Universal Address

### Step 4: 测试签名功能

#### 消息签名
1. 输入要签名的消息
2. 点击 "Sign Message"
3. 在钱包中确认
4. 查看签名结果

#### 交易签名
1. 点击 "Sign Transaction"
2. 在钱包中确认
3. 查看签名结果

### Step 5: 测试合约交互 (EVM Only)

#### 读取 USDT 余额
1. 确保连接到支持的链（Ethereum, BSC, Polygon）
2. 点击 "Read USDT Balance"
3. 查看余额（自动格式化）

#### USDT 转账
1. 输入收款地址 (0x...)
2. 输入转账数量
3. 点击 "Transfer USDT"
4. 在钱包中确认交易
5. 查看交易哈希
6. 点击链接在 Etherscan 查看

### Step 6: 切换链 (EVM Only)

点击预设的链按钮：
- Ethereum Mainnet (1)
- BSC Mainnet (56)
- Polygon Mainnet (137)
- Sepolia Testnet (11155111)

### Step 7: 连接额外钱包

如果想同时使用多个钱包：
1. 点击 "Connect Additional Wallet"
2. 选择另一个钱包类型
3. 使用 "Set as Primary" 切换主钱包

### Step 8: 查看事件日志

所有钱包事件会实时显示在事件日志中：
- 📗 账户切换
- 📘 链切换
- 📙 主钱包切换
- 📗 合约读取
- 📙 合约交易
- 📕 断开连接

---

## 🔧 支持的链

### Ethereum
- **Mainnet**: Chain ID 1
- **Sepolia Testnet**: Chain ID 11155111

### BSC (Binance Smart Chain)
- **Mainnet**: Chain ID 56
- **Testnet**: Chain ID 97

### Polygon
- **Mainnet**: Chain ID 137

### Arbitrum
- **Arbitrum One**: Chain ID 42161

---

## 💡 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **@enclave-hq/wallet-sdk** - 钱包管理
- **Viem** - Ethereum 交互（底层）
- **TronWeb** - Tron 交互（底层）

---

## 📚 相关文档

- [Wallet SDK 主文档](../README.md)
- [快速开始指南](../QUICKSTART.md)
- [签名方法说明](../SIGNING_METHODS.md)
- [合约交互指南](./CONTRACT_INTERACTION_GUIDE.md)
- [MetaMask 限制说明](../METAMASK_LIMITATIONS.md)

---

## ⚠️ 重要提示

### MetaMask 账户切换
- MetaMask **不会**检测切换到未连接的账户
- 如需使用新账户，请先断开连接，然后重新连接
- 详见 [METAMASK_LIMITATIONS.md](../METAMASK_LIMITATIONS.md)

### Gas 费用
- **readContract**: 免费，无需 Gas
- **writeContract**: 需要原生代币支付 Gas
  - 转账前确保钱包有足够的 ETH/BNB/MATIC

### 测试建议
- 使用**测试网**进行测试 (Sepolia, BSC Testnet)
- 从**水龙头**获取测试代币
- 先进行**小额测试**

---

## 🐛 故障排除

### 钱包未检测到
**解决方案**:
1. 确保已安装钱包扩展
2. 刷新页面
3. 点击 "Re-detect Wallets"

### 连接失败
**解决方案**:
1. 检查钱包是否已解锁
2. 检查是否在钱包中允许了连接
3. 查看浏览器控制台的错误信息

### 合约调用失败
**解决方案**:
1. 确保连接到正确的链
2. 检查合约地址是否正确
3. 确保钱包有足够的 Gas
4. 查看事件日志的错误信息

---

## 🎨 自定义

### 添加新的代币

编辑 `src/abis/erc20.ts`:

```typescript
export const TOKEN_ADDRESSES = {
  1: {
    USDT: '0x...',
    USDC: '0x...',
    YOUR_TOKEN: '0x...',  // 添加新代币
  }
}
```

### 添加新的链

在 `src/App.tsx` 的链切换按钮中添加:

```tsx
<button onClick={() => handleSwitchChain(YOUR_CHAIN_ID)}>
  Your Chain Name (CHAIN_ID)
</button>
```

---

## 📝 许可证

MIT License - 详见 [LICENSE](../LICENSE)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**构建时间**: 2025-01-23  
**SDK 版本**: @enclave-hq/wallet-sdk v1.0.0

