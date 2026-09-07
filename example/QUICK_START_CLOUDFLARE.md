# CloudFlare 配置快速开始指南

## 🔍 当前状态检查

根据检查，你已经有一个 CloudFlare Tunnel：

```
Tunnel 名称: enclave
Tunnel ID: c223fcaf-566d-4a28-a45a-0f503aeb6dfc
```

## 📍 在 CloudFlare Dashboard 中查找配置

### 1. 查找 Tunnel 配置

**步骤：**
1. 访问 https://one.dash.cloudflare.com/
2. 左侧菜单点击 **"Networks"** → **"Tunnels"**
3. 查找名为 **"enclave"** 的 tunnel
4. 点击进入查看详细配置

**如果找不到：**
- 确认登录的是正确的 CloudFlare 账户
- 尝试访问：https://dash.cloudflare.com/ → **Zero Trust** → **Networks** → **Tunnels**

### 2. 查找 DNS 记录

**步骤：**
1. 访问 https://dash.cloudflare.com/
2. 选择你的域名（例如：`enclave-hq.com`）
3. 左侧菜单点击 **"DNS"** → **"Records"**
4. 查找 CNAME 记录，Target 包含 `c223fcaf-566d-4a28-a45a-0f503aeb6dfc.cfargotunnel.com`

### 3. 查找 Pages 项目

**步骤：**
1. 访问 https://dash.cloudflare.com/
2. 左侧菜单点击 **"Workers & Pages"** → **"Pages"**
3. 查找名为 **"wallet-sdk-example"** 的项目

**如果列表为空：**
- 说明还没有创建 Pages 项目，需要创建（见下方）

---

## 🆕 选项 1: 使用现有的 "enclave" Tunnel

如果你想使用现有的 `enclave` tunnel 来暴露 wallet-sdk-example：

### 步骤 1: 更新配置文件

编辑 `cloudflared-config.yaml`：

```yaml
tunnel: enclave
# 或者使用 Tunnel ID
# tunnel: c223fcaf-566d-4a28-a45a-0f503aeb6dfc

credentials-file: ~/.cloudflared/c223fcaf-566d-4a28-a45a-0f503aeb6dfc.json

ingress:
  - hostname: wallet-sdk-example.your-domain.com
    service: http://localhost:5173
    originRequest:
      noHappyEyeballs: true
      keepAliveConnections: 10
      keepAliveTimeout: 90s
      httpHostHeader: wallet-sdk-example.your-domain.com
      originServerName: wallet-sdk-example.your-domain.com

  # 默认规则 - 必须放在最后
  - service: http_status:404
```

### 步骤 2: 在 Dashboard 中添加路由

1. 访问 https://one.dash.cloudflare.com/
2. **Networks** → **Tunnels** → 点击 **"enclave"**
3. 点击 **"Configure"** 按钮
4. 在 **"Public Hostname"** 部分，点击 **"Add a public hostname"**
5. 填写：
   - **Subdomain**: `wallet-sdk-example`
   - **Domain**: 选择你的域名
   - **Service**: `http://localhost:5173`
6. 点击 **"Save hostname"**

### 步骤 3: 配置 DNS（如果需要）

如果 Dashboard 没有自动创建 DNS 记录：

1. 访问 https://dash.cloudflare.com/
2. 选择你的域名
3. **DNS** → **Records** → **"Add record"**
4. 填写：
   - **Type**: CNAME
   - **Name**: `wallet-sdk-example`
   - **Target**: `c223fcaf-566d-4a28-a45a-0f503aeb6dfc.cfargotunnel.com`
   - **Proxy status**: 🟠 Proxied
5. 点击 **"Save"**

---

## 🆕 选项 2: 创建新的 "wallet-sdk-example" Tunnel

如果你想为 wallet-sdk-example 创建独立的 tunnel：

### 步骤 1: 创建新 Tunnel

```bash
cd example
cloudflared tunnel create wallet-sdk-example
```

**输出示例：**
```
Created tunnel wallet-sdk-example with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 步骤 2: 获取凭证文件路径

```bash
cloudflared tunnel list
```

找到 `wallet-sdk-example` 的凭证文件路径（通常是 `~/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json`）

### 步骤 3: 更新配置文件

编辑 `cloudflared-config.yaml`，使用新的 Tunnel ID 和凭证文件路径。

### 步骤 4: 配置 DNS

```bash
# 替换 your-domain.com 为你的实际域名
cloudflared tunnel route dns add wallet-sdk-example wallet-sdk-example.your-domain.com
```

---

## 📦 创建 CloudFlare Pages 项目

### 方法 1: 使用 Dashboard（推荐）

1. **访问 Pages**
   - https://dash.cloudflare.com/
   - **Workers & Pages** → **Pages** → **"Create a project"**

2. **选择创建方式**
   - **Upload assets** - 手动上传构建后的文件
   - **Connect to Git** - 连接 Git 仓库自动部署

3. **配置项目（手动上传）**
   - **Project name**: `wallet-sdk-example`
   - 点击 **"Create project"**
   - 先构建项目：`npm run build`
   - 上传 `dist` 目录的内容

4. **配置项目（Git 方式）**
   - 选择 Git 提供商并授权
   - 选择仓库和分支
   - **Build command**: `cd example && npm install && npm run build`
   - **Build output directory**: `example/dist`
   - **Root directory**: `/`

### 方法 2: 使用命令行

```bash
# 安装 wrangler（如果还没有）
npm install -g wrangler

# 登录
wrangler login

# 构建项目
cd example
npm run build

# 部署
wrangler pages deploy dist --project-name=wallet-sdk-example
```

---

## ✅ 验证配置

### 验证 Tunnel

1. **在 Dashboard 中查看**
   - https://one.dash.cloudflare.com/
   - **Networks** → **Tunnels**
   - 应该能看到 tunnel 并显示 "Active" 状态

2. **测试连接**
   ```bash
   cd example
   npm run dev  # 在一个终端
   ./start-tunnel.sh  # 在另一个终端（或使用正确的配置文件）
   ```

3. **访问测试**
   - 访问配置的域名
   - 应该能看到本地开发服务器内容

### 验证 Pages

1. **在 Dashboard 中查看**
   - https://dash.cloudflare.com/
   - **Workers & Pages** → **Pages** → **wallet-sdk-example**
   - 应该能看到部署记录

2. **访问预览 URL**
   - 点击部署记录
   - 使用预览 URL 访问

---

## 🆘 仍然找不到配置？

### 检查清单

- [ ] 确认登录的是正确的 CloudFlare 账户
- [ ] 确认选择了正确的域名（如果有多个域名）
- [ ] 检查账户权限（如果是团队账户）
- [ ] 尝试使用命令行查看：`cloudflared tunnel list`

### 获取帮助

- 📖 [详细排查指南](./CLOUDFLARE_TROUBLESHOOTING.md)
- 📖 [Dashboard 查看指南](./CLOUDFLARE_DASHBOARD_GUIDE.md)
- 📖 [完整配置指南](./CLOUDFLARE_SETUP.md)

---

**最后更新**: 2025-01-23


















