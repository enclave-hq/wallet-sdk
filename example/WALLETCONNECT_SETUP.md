# WalletConnect 配置指南

## 快速开始

### 1. 获取 Project ID

1. 访问 [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. 注册/登录账户
3. 创建新项目（或使用现有项目）
4. 复制 Project ID（一串长字符）

### 2. 配置项目

在 `example` 目录下创建 `.env` 文件：

```bash
# 复制示例文件
cp .env.example .env
```

编辑 `.env` 文件，填入你的 Project ID：

```bash
VITE_WALLETCONNECT_PROJECT_ID=你的-project-id-这里
```

### 3. 重启开发服务器

```bash
npm run dev
```

## 验证配置

配置成功后：
- ✅ WalletConnect 会出现在 "EVM Wallets" 列表中
- ✅ 显示绿色勾选标记
- ✅ 点击后可以正常连接

如果未配置：
- ❌ WalletConnect 不会出现在钱包列表中
- ❌ 或者显示为不可用状态

## 常见问题

### Q: 没有 Project ID 可以使用吗？
A: 不可以。WalletConnect 需要 Project ID 才能工作。这是 WalletConnect 的强制要求。

### Q: Project ID 是免费的吗？
A: 是的，WalletConnect Cloud 提供免费套餐，足够开发和测试使用。

### Q: 可以在多个项目中使用同一个 Project ID 吗？
A: 可以，但建议为不同环境（开发/生产）创建不同的项目。

### Q: Project ID 会泄露吗？
A: `.env` 文件已加入 `.gitignore`，不会被提交到 git。但注意不要在代码中硬编码 Project ID。
