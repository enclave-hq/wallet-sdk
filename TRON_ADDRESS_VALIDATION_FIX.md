# Tron Address Validation Fix

## 问题描述

在使用 TronLink 进行合约交互时，出现以下错误：

```
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
at Dh._send (injected.js:1:2199491)
at Object.send (injected.js:1:2197783)
at _TronLinkAdapter.writeContract (tronlink.ts:201:87)
```

## 根本原因

TronWeb 在处理 `writeContract` 调用时，对传入的地址参数进行了 `toLowerCase()` 操作，但收到了 `undefined` 或空值，导致错误。

这个问题出现的原因：

1. **地址格式不匹配**：示例应用中 `transferTo` 的默认值是 EVM 格式地址（`0x...`），而 Tron 需要 Base58 格式（`T...`）
2. **缺少地址验证**：在调用 TronWeb API 之前，没有验证地址格式是否正确
3. **跨链地址混用**：用户在不同链之间切换时，可能会误用错误格式的地址

## 修复方案

### 1. 使用 TronWeb 底层 API

最关键的修复是从 `contract().method().send()` 切换到更底层、更可靠的 `transactionBuilder.triggerSmartContract()` API：

**之前（有 bug）：**
```typescript
const contract = await tronWeb.contract(abi, address);
const tx = await contract[functionName](...args).send(options);
```

**之后（可靠）：**
```typescript
// 1. 构建交易
const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
  contractAddress,
  'transfer(address,uint256)',
  { feeLimit: 100_000_000, callValue: 0 },
  parameters,
  fromAddress
);

// 2. 签名交易
const signedTx = await tronWeb.trx.sign(transaction.transaction);

// 3. 广播交易
const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
```

这种方式完全绕过了 TronLink 的 `send()` 方法的内部 bug。

### 2. 多链区块浏览器支持

添加了 `getBlockExplorerUrl()` 辅助函数，根据链 ID 和链类型自动选择正确的区块浏览器：

**支持的区块浏览器：**
- ✅ Ethereum: Etherscan (主网 + Sepolia/Goerli 测试网)
- ✅ BSC: BscScan (主网 + 测试网)
- ✅ Polygon: PolygonScan (主网 + Mumbai 测试网)
- ✅ Arbitrum: Arbiscan (主网 + Sepolia 测试网)
- ✅ Optimism: Optimism Explorer (主网 + Sepolia 测试网)
- ✅ Base: BaseScan (主网 + Sepolia 测试网)
- ✅ Avalanche: SnowTrace (主网 + 测试网)
- ✅ Fantom: FTMScan (主网 + 测试网)
- ✅ Tron: Tronscan (主网 + Nile 测试网)

```typescript
const explorer = getBlockExplorerUrl(txHash, chainId, chainType)
// 返回: { url: "https://...", name: "BscScan" }
```

### 3. 移除默认地址

```typescript
// Before
const [transferTo, setTransferTo] = useState('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')

// After
const [transferTo, setTransferTo] = useState('')
```

### 4. 添加地址格式验证

在 `handleUSDTTransfer` 函数中添加地址验证逻辑：

```typescript
// 验证地址格式
const trimmedAddress = transferTo.trim()
if (account.chainType === ChainType.EVM) {
  // EVM 地址验证: 0x + 40 hex 字符
  if (!trimmedAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    setContractError('Invalid EVM address format. Expected: 0x followed by 40 hex characters')
    setIsTransferring(false)
    return
  }
} else if (account.chainType === ChainType.TRON) {
  // Tron 地址验证: T + 33 Base58 字符
  if (!trimmedAddress.match(/^T[a-zA-Z0-9]{33}$/)) {
    setContractError('Invalid Tron address format. Expected: T followed by 33 characters')
    setIsTransferring(false)
    return
  }
}
```

### 5. 动态 Placeholder

根据当前连接的链类型显示合适的地址格式示例：

```typescript
<input
  type="text"
  value={transferTo}
  onChange={(e) => setTransferTo(e.target.value)}
  placeholder={
    account?.chainType === ChainType.TRON 
      ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'  // Tron USDT 合约地址
      : '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0' // 示例 EVM 地址
  }
  className="input"
/>
```

### 6. 用户提示

添加地址格式说明：

```typescript
<span className="input-hint">
  {account?.chainType === ChainType.TRON 
    ? '⚠️ Tron 地址格式: T + 33字符 (Base58)' 
    : '⚠️ EVM 地址格式: 0x + 40 hex 字符'}
</span>
```

## 地址格式对比

| 链类型 | 格式 | 示例 | 长度 |
|--------|------|------|------|
| **EVM** | `0x` + 40 hex 字符 | `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0` | 42 字符 |
| **Tron** | `T` + 33 Base58 字符 | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | 34 字符 |

## 测试步骤

### EVM 链测试（MetaMask）

1. 连接 MetaMask 到 BSC Testnet
2. 输入有效的 EVM 地址（0x...）
3. 点击 "Read USDT Balance"
4. 点击 "Transfer USDT"
5. 确认交易

### Tron 链测试（TronLink）

1. 连接 TronLink 到 Tron Mainnet 或 Nile Testnet
2. 输入有效的 Tron 地址（T...）
3. 点击 "Read USDT Balance"
4. 点击 "Transfer USDT"
5. 确认交易

### 负面测试

1. **错误格式地址**：
   - EVM 链输入 Tron 地址 → 应该显示错误提示
   - Tron 链输入 EVM 地址 → 应该显示错误提示

2. **空地址**：
   - 不输入地址直接点击转账 → 按钮应该被禁用

3. **无效字符**：
   - 输入包含特殊字符的地址 → 应该显示错误提示

## 相关文件

- `wallet-sdk/example/src/App.tsx` - 添加地址验证逻辑
- `wallet-sdk/src/adapters/tron/tronlink.ts` - TronLink 适配器实现
- `wallet-sdk/example/src/abis/erc20.ts` - ERC20/TRC20 ABI 和合约地址

## 注意事项

1. **地址验证是客户端验证**：这只是前端验证，主要目的是提供更好的用户体验。实际的地址有效性由链本身验证。

2. **Base58 编码**：Tron 地址使用 Base58 编码，包含字母和数字但不包含易混淆的字符（0, O, I, l）。

3. **Checksum 验证**：当前验证只检查格式，未进行 checksum 验证。对于 EVM 地址，可以考虑添加 EIP-55 checksum 验证。

4. **重新加载页面**：修复后需要完全刷新浏览器（Ctrl+Shift+R 或 Cmd+Shift+R）以清除缓存。

## 后续改进

1. **添加地址簿功能**：允许用户保存常用地址
2. **ENS/TNS 支持**：支持域名解析为地址
3. **地址校验和验证**：实现 EIP-55 checksum 验证
4. **智能地址检测**：根据输入格式自动切换链
5. **扫码功能**：支持扫描二维码获取地址

## 提交信息

```bash
git add wallet-sdk/example/src/App.tsx
git commit -m "Fix Tron address validation in contract interaction

- Remove hardcoded EVM address default value
- Add address format validation for EVM and Tron
- Add dynamic placeholder based on chain type
- Add user-friendly error messages for invalid addresses
- Add address format hints in UI

Fixes: TypeError: Cannot read properties of undefined (reading 'toLowerCase')
Related: TronLink writeContract error"
```

## 更新日期

2025-01-23

