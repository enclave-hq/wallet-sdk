# TRON 钱包签名测试指南

## 快速测试步骤

### 1. 配置 WalletConnect Project ID

创建 `.env` 文件（在 `example/` 目录下）：

```bash
VITE_WALLETCONNECT_PROJECT_ID=your-project-id-here
```

**获取 Project ID：**
1. 访问 https://cloud.walletconnect.com/
2. 注册/登录账号
3. 创建新项目或选择现有项目
4. 复制 Project ID

### 2. 安装依赖并启动

```bash
cd example
npm install
npm run dev
```

### 3. 测试 WalletConnect Tron

1. 打开浏览器访问 `http://localhost:3000`
2. 点击 "Detect Wallets" 按钮
3. 找到 "WalletConnect (Tron)" 选项
4. 点击连接
5. **会自动显示二维码**
6. 使用支持 WalletConnect 的 TRON 钱包（如 TokenPocket）扫描二维码
7. 在钱包中确认连接
8. 连接成功后，测试签名功能

### 4. 测试签名消息

1. 在 "Message to Sign" 输入框中输入要签名的消息
2. 点击 "Sign Message" 按钮
3. 在钱包中确认签名
4. 查看签名结果

### 5. 测试签名交易（可选）

1. 输入接收地址（TRON 地址格式：T...）
2. 输入转账金额
3. 点击 "Sign Transaction" 按钮
4. 在钱包中确认交易签名

## 测试检查清单

- [ ] WalletConnect Project ID 已配置
- [ ] 示例应用已启动
- [ ] 可以检测到 WalletConnect (Tron)
- [ ] 连接时显示二维码
- [ ] 可以使用钱包扫描二维码
- [ ] 连接成功
- [ ] 可以签名消息
- [ ] 签名结果正确返回

## 常见问题

### Q: 没有显示 WalletConnect (Tron) 选项？

**A:** 检查：
1. `.env` 文件中是否配置了 `VITE_WALLETCONNECT_PROJECT_ID`
2. 重启开发服务器（`npm run dev`）
3. 查看浏览器控制台是否有错误信息

### Q: 扫描二维码后没有反应？

**A:** 可能原因：
1. 设备上没有安装支持 WalletConnect 的 TRON 钱包（如 TokenPocket）
2. 钱包应用未打开
3. 网络连接问题

**解决方案：**
- 安装 TokenPocket 或其他支持 WalletConnect 的 TRON 钱包
- 确保钱包应用已打开
- 检查网络连接

### Q: 签名失败？

**A:** 检查：
1. 钱包是否已连接
2. 是否在钱包中确认了签名
3. 查看浏览器控制台和钱包应用的错误信息

## 测试环境

- **浏览器**: Chrome/Edge/Safari（最新版本）
- **钱包**: TokenPocket 或其他支持 WalletConnect 的 TRON 钱包
- **网络**: TRON 主网（Chain ID: 195）

## 预期结果

✅ 连接成功：显示 TRON 地址（格式：T...）  
✅ 签名成功：返回签名字符串（hex 格式）  
✅ 二维码显示：自动生成并显示二维码  
✅ 状态更新：实时显示连接和签名状态  



















