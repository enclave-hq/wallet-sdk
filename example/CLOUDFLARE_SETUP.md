# CloudFlare 反向映射配置指南

本文档说明如何为 wallet-sdk example 应用配置 CloudFlare 反向映射。

## 📋 目录

- [CloudFlare Pages 部署](#cloudflare-pages-部署)
- [CloudFlare Tunnel 配置](#cloudflare-tunnel-配置)
- [自动部署脚本](#自动部署脚本)
- [在 Dashboard 中查看配置](#在-dashboard-中查看配置)

---

## CloudFlare Pages 部署

CloudFlare Pages 用于部署静态网站（构建后的 Vite 应用）。

### 方法 1: 使用 CloudFlare Dashboard（推荐）

1. **登录 CloudFlare Dashboard**
   - 访问 https://dash.cloudflare.com/
   - 选择你的账户

2. **创建 Pages 项目**
   - 进入 "Workers & Pages" → "Pages"
   - 点击 "Create a project"
   - 选择 "Upload assets"（手动上传）

3. **配置项目**
   - **Project name**: `wallet-sdk-example`
   - **Production branch**: `main` (或你的主分支)
   - 上传 `dist` 目录（构建后的文件）

4. **配置自定义域名**（可选）
   - 在项目设置中添加自定义域名
   - 例如: `wallet-sdk-example.enclave-hq.com`

### 方法 2: 使用 Wrangler CLI

1. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录 CloudFlare**
   ```bash
   wrangler login
   ```

3. **部署应用**
   ```bash
   # 构建应用
   npm run build
   
   # 部署到生产环境
   wrangler pages deploy dist --project-name=wallet-sdk-example
   ```

### 方法 3: 使用 Git 集成（自动部署）

1. **连接 Git 仓库**
   - 在 CloudFlare Pages 项目设置中
   - 选择 "Connect to Git"
   - 授权访问你的 GitHub/GitLab 仓库

2. **配置构建设置**
   - **Build command**: `cd example && npm install && npm run build`
   - **Build output directory**: `example/dist`
   - **Root directory**: `/` (项目根目录)

3. **环境变量**（如果需要）
   - 在项目设置中添加环境变量
   - 例如: `VITE_WALLETCONNECT_PROJECT_ID`

---

## CloudFlare Tunnel 配置

CloudFlare Tunnel (cloudflared) 用于将本地开发服务暴露到公网，方便测试和演示。

### 1. 安装 cloudflared

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
# 下载并安装: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### 2. 创建 Tunnel

```bash
# 登录 CloudFlare
cloudflared tunnel login

# 创建新的 tunnel
cloudflared tunnel create wallet-sdk-example

# 这会生成一个 credentials.json 文件
# 保存文件路径，稍后需要用到
```

### 3. 配置 DNS 记录

在 CloudFlare Dashboard 中：
1. 进入你的域名 DNS 设置
2. 添加 CNAME 记录：
   - **Name**: `wallet-sdk-example` (或你想要的子域名)
   - **Target**: `<tunnel-id>.cfargotunnel.com`
   - **Proxy**: ✅ (橙色云朵)

### 4. 配置并启动 Tunnel

1. **编辑配置文件**
   ```bash
   # 编辑 cloudflared-config.yaml
   # 更新以下内容:
   # - credentials-file: 指向你的 credentials.json 路径
   # - hostname: 你的域名
   ```

2. **启动 Tunnel**

   **方法 1: 使用快速启动脚本（推荐）**
   ```bash
   # 在 example 目录下
   cd example
   
   # 启动本地开发服务器（在一个终端）
   npm run dev
   
   # 在另一个终端启动 tunnel
   ./start-tunnel.sh
   ```

   **方法 2: 手动启动**
   ```bash
   # 在 example 目录下
   cd example
   
   # 启动本地开发服务器
   npm run dev
   
   # 在另一个终端启动 tunnel
   # 注意：--config 必须在 tunnel 和 run 之间
   cloudflared tunnel --config cloudflared-config.yaml run
   ```

   **方法 3: 使用默认配置文件位置**
   ```bash
   # 将配置文件复制到默认位置
   mkdir -p ~/.cloudflared
   cp cloudflared-config.yaml ~/.cloudflared/config.yml
   
   # 然后直接运行（无需指定 --config）
   cloudflared tunnel run
   ```

3. **访问应用**
   - 通过配置的域名访问: `https://wallet-sdk-example.your-domain.com`
   - Tunnel 会自动将流量转发到本地 `http://localhost:5173`

### 5. 作为服务运行（可选）

```bash
# 安装为系统服务（Linux/macOS）
cloudflared service install

# 启动服务
cloudflared tunnel --config cloudflared-config.yaml run
```

---

## 自动部署脚本

项目包含一个自动部署脚本 `cloudflare-deploy.sh`。

### 使用方法

```bash
# 构建应用（不部署）
./cloudflare-deploy.sh

# 构建并部署到生产环境
./cloudflare-deploy.sh --production

# 构建并部署到预览环境
./cloudflare-deploy.sh --preview
```

### 脚本功能

- ✅ 自动安装依赖
- ✅ 构建应用
- ✅ 验证构建结果
- ✅ 可选自动部署到 CloudFlare Pages

---

## 配置文件说明

### `cloudflare-pages.json`
- CloudFlare Pages 构建和路由配置
- 包含安全头设置
- SPA 路由重定向规则

### `_redirects`
- Netlify/CloudFlare Pages 兼容的重定向文件
- 用于 SPA 客户端路由

### `cloudflared-config.yaml`
- CloudFlare Tunnel 配置文件
- 定义域名到本地服务的映射

### `cloudflare-deploy.sh`
- 自动化部署脚本
- 支持生产环境和预览环境部署

### `start-tunnel.sh`
- CloudFlare Tunnel 快速启动脚本
- 自动检查依赖和配置
- 验证本地服务器状态
- 使用正确的命令格式启动 tunnel

---

## 常见问题

### 1. 构建后路由 404

**问题**: 直接访问 `/some-route` 返回 404

**解决**: 
- 确保 `_redirects` 文件在 `dist` 目录中
- 检查 `cloudflare-pages.json` 中的 redirects 配置

### 2. Tunnel 命令格式错误

**问题**: `Incorrect Usage: flag provided but not defined: -config`

**原因**: `--config` 参数的位置不正确

**解决**:
- ✅ **正确格式**: `cloudflared tunnel --config cloudflared-config.yaml run`
- ❌ **错误格式**: `cloudflared tunnel run --config cloudflared-config.yaml`
- `--config` 必须在 `tunnel` 和 `run` 之间
- 或者将配置文件复制到默认位置 `~/.cloudflared/config.yml`，然后直接运行 `cloudflared tunnel run`

### 3. Tunnel 连接失败

**问题**: `cloudflared tunnel` 无法连接

**解决**:
- 检查 `credentials-file` 路径是否正确
- 确认 DNS 记录已正确配置
- 检查防火墙是否阻止连接
- 确认 tunnel 名称与配置文件中的 `tunnel:` 字段匹配

### 4. 环境变量未生效

**问题**: 构建时环境变量未正确注入

**解决**:
- Vite 环境变量必须以 `VITE_` 开头
- 在 CloudFlare Pages 项目设置中添加环境变量
- 重新构建和部署

### 5. CORS 错误

**问题**: 跨域请求被阻止

**解决**:
- 检查 API 服务器的 CORS 配置
- 在 CloudFlare 中添加 CORS 头（如果需要）
- 使用 CloudFlare Workers 作为代理

### 6. WalletConnect 报错 `code 3000 (Unauthorized: origin not allowed)`

**问题**: 浏览器控制台看到 WalletConnect/WebSocket 报错：
`WebSocket connection closed abnormally with code: 3000 (Unauthorized: origin not allowed)`

**原因**: 你的 `VITE_WALLETCONNECT_PROJECT_ID` 是有效的，但 WalletConnect Cloud 项目没有允许当前访问站点的 **origin**。
当你通过 Cloudflare Tunnel/custom domain 访问（例如 `https://wallet-test.enclave-hq.com`）时，origin 会变成该域名，必须被加入 allowlist。

**解决**:
- 去 WalletConnect Cloud（`https://cloud.walletconnect.com/`）打开对应 Project
- 在 **Allowed origins / App domains**（名称可能略有差异）里添加：
  - `https://wallet-test.enclave-hq.com`
  - `http://localhost:5173`
  - `http://192.168.0.221:5173`（如果你用 Network URL 访问）

---

## 在 Dashboard 中查看配置

详细说明如何在 CloudFlare Dashboard 中查看和管理配置，请参考：

📖 **[CloudFlare Dashboard 查看指南](./CLOUDFLARE_DASHBOARD_GUIDE.md)**

该指南包括：
- 如何查看 Tunnel 配置和状态
- 如何查看 Pages 项目配置
- 如何查看 DNS 记录
- 如何查看日志和监控数据
- 常见问题排查步骤

---

## 相关链接

- [CloudFlare Pages 文档](https://developers.cloudflare.com/pages/)
- [CloudFlare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [CloudFlare Dashboard 查看指南](./CLOUDFLARE_DASHBOARD_GUIDE.md)

---

**最后更新**: 2025-01-23

