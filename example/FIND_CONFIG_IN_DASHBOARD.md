# 在 CloudFlare Dashboard 中查找配置 - 快速指南

## 🎯 你的当前配置

根据检查，你已经有一个 CloudFlare Tunnel：

- **Tunnel 名称**: `enclave`
- **Tunnel ID**: `c223fcaf-566d-4a28-a45a-0f503aeb6dfc`
- **凭证文件**: `~/.cloudflared/c223fcaf-566d-4a28-a45a-0f503aeb6dfc.json`

---

## 📍 在哪里查找配置

### 1. 查找 Tunnel 配置（最重要）

**直接访问链接：**
- https://one.dash.cloudflare.com/networks/tunnels

**或者手动导航：**
1. 访问 https://one.dash.cloudflare.com/
2. 左侧菜单点击 **"Networks"**
3. 点击 **"Tunnels"**
4. 查找名为 **"enclave"** 的 tunnel
5. 点击进入查看详细配置

**你应该能看到：**
- Tunnel 名称和 ID
- 状态（Active/Inactive）
- Ingress 规则（路由配置）
- 连接器状态

---

### 2. 查找 DNS 记录

**直接访问链接（需要先选择域名）：**
- https://dash.cloudflare.com/ → 选择域名 → DNS → Records

**或者手动导航：**
1. 访问 https://dash.cloudflare.com/
2. 在顶部选择你的域名（例如：`enclave-hq.com`）
3. 左侧菜单点击 **"DNS"**
4. 点击 **"Records"**
5. 查找 CNAME 记录，Target 包含：
   - `c223fcaf-566d-4a28-a45a-0f503aeb6dfc.cfargotunnel.com`
   - 或者包含 `cfargotunnel.com`

**如果找不到 DNS 记录：**
- 说明还没有为 wallet-sdk-example 配置 DNS
- 需要添加新的 CNAME 记录（见下方）

---

### 3. 查找 Pages 项目

**直接访问链接：**
- https://dash.cloudflare.com/?to=/:account/pages

**或者手动导航：**
1. 访问 https://dash.cloudflare.com/
2. 左侧菜单点击 **"Workers & Pages"**
3. 点击 **"Pages"** 标签
4. 查找名为 **"wallet-sdk-example"** 的项目

**如果列表为空或找不到：**
- 说明还没有创建 Pages 项目
- 需要创建新项目（见下方）

---

## 🔧 如果找不到配置，如何创建

### 选项 A: 在现有 Tunnel 中添加路由

如果你想使用现有的 `enclave` tunnel：

1. **在 Dashboard 中添加路由**
   - 访问：https://one.dash.cloudflare.com/networks/tunnels
   - 点击 **"enclave"** tunnel
   - 点击 **"Configure"** 按钮
   - 在 **"Public Hostname"** 部分，点击 **"Add a public hostname"**
   - 填写：
     - **Subdomain**: `wallet-sdk-example`
     - **Domain**: 选择你的域名
     - **Service**: `http://localhost:5173`
   - 点击 **"Save hostname"**

2. **配置 DNS（如果 Dashboard 没有自动创建）**
   - 访问：https://dash.cloudflare.com/ → 选择域名 → DNS → Records
   - 点击 **"Add record"**
   - 填写：
     - **Type**: CNAME
     - **Name**: `wallet-sdk-example`
     - **Target**: `c223fcaf-566d-4a28-a45a-0f503aeb6dfc.cfargotunnel.com`
     - **Proxy status**: 🟠 Proxied（橙色云朵）
   - 点击 **"Save"**

### 选项 B: 创建新的 Tunnel

如果你想创建独立的 `wallet-sdk-example` tunnel：

```bash
cd example
cloudflared tunnel create wallet-sdk-example
```

然后按照 [完整配置指南](./CLOUDFLARE_SETUP.md) 继续。

---

## 📦 创建 Pages 项目

### 快速创建步骤

1. **访问 Pages**
   - https://dash.cloudflare.com/?to=/:account/pages
   - 点击 **"Create a project"**

2. **选择创建方式**
   - **Upload assets** - 手动上传（首次推荐）
   - **Connect to Git** - 自动部署（推荐用于持续部署）

3. **配置项目**

   **如果选择 "Upload assets"：**
   - **Project name**: `wallet-sdk-example`
   - 点击 **"Create project"**
   - 先构建：`cd example && npm run build`
   - 上传 `dist` 目录的内容

   **如果选择 "Connect to Git"：**
   - 选择 Git 提供商并授权
   - 选择仓库和分支
   - **Build command**: `cd example && npm install && npm run build`
   - **Build output directory**: `example/dist`
   - **Root directory**: `/`

---

## ✅ 验证配置是否找到

### 检查清单

- [ ] 在 Zero Trust Dashboard 中能看到 "enclave" tunnel
  - 链接：https://one.dash.cloudflare.com/networks/tunnels
- [ ] 在 DNS 记录中能找到相关的 CNAME 记录
  - 链接：https://dash.cloudflare.com/ → 选择域名 → DNS → Records
- [ ] 在 Pages 中能看到 "wallet-sdk-example" 项目（如果已创建）
  - 链接：https://dash.cloudflare.com/?to=/:account/pages

---

## 🆘 仍然找不到？

### 可能的原因

1. **在错误的账户下查看**
   - 确认登录的是正确的 CloudFlare 账户
   - 检查账户邮箱是否正确

2. **在错误的域名下查看**
   - DNS 记录是域名级别的，需要选择正确的域名

3. **配置还没有创建**
   - Tunnel 可能还没有配置路由
   - Pages 项目可能还没有创建
   - DNS 记录可能还没有添加

### 下一步

1. **使用命令行验证**
   ```bash
   # 查看所有 tunnel
   cloudflared tunnel list
   
   # 查看 tunnel 详细信息
   cloudflared tunnel info enclave
   ```

2. **查看详细排查指南**
   - 📖 [排查指南](./CLOUDFLARE_TROUBLESHOOTING.md)
   - 📖 [快速开始](./QUICK_START_CLOUDFLARE.md)

3. **查看完整文档**
   - 📖 [配置指南](./CLOUDFLARE_SETUP.md)
   - 📖 [Dashboard 查看指南](./CLOUDFLARE_DASHBOARD_GUIDE.md)

---

## 🔗 快速访问链接

- **Zero Trust Dashboard**: https://one.dash.cloudflare.com/
- **Tunnels 列表**: https://one.dash.cloudflare.com/networks/tunnels
- **主 Dashboard**: https://dash.cloudflare.com/
- **Pages 列表**: https://dash.cloudflare.com/?to=/:account/pages

---

**最后更新**: 2025-01-23


















