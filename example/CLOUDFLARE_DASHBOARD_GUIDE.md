# CloudFlare Dashboard 配置查看指南

本文档说明如何在 CloudFlare Dashboard 中查看和管理 wallet-sdk example 应用的配置。

## 📋 目录

- [访问 CloudFlare Dashboard](#访问-cloudflare-dashboard)
- [查看 CloudFlare Tunnel 配置](#查看-cloudflare-tunnel-配置)
- [查看 CloudFlare Pages 配置](#查看-cloudflare-pages-配置)
- [查看 DNS 配置](#查看-dns-配置)
- [查看 Tunnel 状态和日志](#查看-tunnel-状态和日志)
- [常见配置项说明](#常见配置项说明)

---

## 访问 CloudFlare Dashboard

1. **登录 CloudFlare**
   - 访问 https://dash.cloudflare.com/
   - 使用你的 CloudFlare 账户登录

2. **选择账户和域名**
   - 在顶部选择你的账户
   - 选择要管理的域名（例如：`enclave-hq.com`）

---

## 查看 CloudFlare Tunnel 配置

### 1. 进入 Zero Trust Dashboard

1. 访问 https://one.dash.cloudflare.com/
2. 或从主 Dashboard 点击左侧菜单的 **"Zero Trust"**

### 2. 查看 Tunnel 列表

1. 在左侧菜单选择 **"Networks"** → **"Tunnels"**
2. 你会看到所有已创建的 Tunnel 列表
3. 找到 `wallet-sdk-example` tunnel

### 3. 查看 Tunnel 详细信息

点击 tunnel 名称，可以看到：

#### **Overview（概览）**
- **Tunnel ID**: 唯一标识符
- **Status**: 运行状态（Active/Inactive）
- **Created**: 创建时间
- **Last Active**: 最后活跃时间

#### **Configuration（配置）**
- **Ingress Rules**: 路由规则
  - Hostname（域名）
  - Service（目标服务地址）
  - Origin Request 设置

#### **Connectors（连接器）**
- 显示所有连接到这个 tunnel 的客户端
- 每个连接器的状态和最后连接时间

### 4. 编辑 Tunnel 配置

1. 点击 **"Configure"** 按钮
2. 可以编辑：
   - **Public Hostname**: 添加或修改域名路由
   - **Private Network**: 配置私有网络访问
   - **Origin Request**: 配置请求头、超时等

### 5. 查看 Tunnel 日志

1. 在 Tunnel 详情页面
2. 点击 **"Logs"** 标签
3. 可以查看：
   - 连接日志
   - 错误日志
   - 流量统计

---

## 查看 CloudFlare Pages 配置

### 1. 进入 Pages 项目

1. 在主 Dashboard 左侧菜单选择 **"Workers & Pages"**
2. 点击 **"Pages"** 标签
3. 找到 `wallet-sdk-example` 项目

### 2. 查看项目概览

点击项目名称，可以看到：

#### **Overview（概览）**
- **Project name**: 项目名称
- **Production branch**: 生产环境分支
- **Custom domains**: 自定义域名列表
- **Deployments**: 部署历史

#### **Deployments（部署）**
- 所有部署记录
- 每个部署的状态（Success/Failed）
- 部署时间和构建日志
- 预览 URL

### 3. 查看项目设置

点击 **"Settings"** 标签：

#### **Builds & deployments（构建和部署）**
- **Build command**: 构建命令
- **Build output directory**: 输出目录
- **Root directory**: 根目录
- **Environment variables**: 环境变量

#### **Custom domains（自定义域名）**
- 已配置的自定义域名
- SSL/TLS 证书状态
- DNS 配置状态

#### **Functions（函数）**
- Edge Functions 配置
- 函数路由规则

### 4. 查看构建日志

1. 在 **"Deployments"** 页面
2. 点击任意部署记录
3. 查看：
   - **Build logs**: 构建日志
   - **Deploy logs**: 部署日志
   - **Preview URL**: 预览链接

### 5. 查看 Analytics（分析）

1. 在项目页面点击 **"Analytics"** 标签
2. 可以查看：
   - 请求统计
   - 带宽使用
   - 错误率
   - 响应时间

---

## 查看 DNS 配置

### 1. 进入 DNS 设置

1. 在主 Dashboard 选择你的域名
2. 点击左侧菜单的 **"DNS"** → **"Records"**

### 2. 查看 DNS 记录

你会看到所有 DNS 记录，包括：

#### **Tunnel 相关记录**
- **Type**: CNAME
- **Name**: `wallet-sdk-example` (或你的子域名)
- **Target**: `<tunnel-id>.cfargotunnel.com`
- **Proxy status**: 🟠 Proxied (橙色云朵)

#### **Pages 相关记录（如果有自定义域名）**
- **Type**: CNAME
- **Name**: `wallet-sdk-example` (或你的子域名)
- **Target**: `<project-name>.pages.dev`
- **Proxy status**: 🟠 Proxied

### 3. 编辑 DNS 记录

1. 点击记录右侧的 **"Edit"** 按钮
2. 可以修改：
   - 记录名称
   - 目标地址
   - 代理状态（Proxied/DNS only）

---

## 查看 Tunnel 状态和日志

### 1. 在 Zero Trust Dashboard 查看

1. 访问 https://one.dash.cloudflare.com/
2. **"Networks"** → **"Tunnels"** → 选择你的 tunnel
3. 查看 **"Status"** 和 **"Logs"**

### 2. 使用命令行查看

```bash
# 查看 tunnel 列表
cloudflared tunnel list

# 查看特定 tunnel 的路由
cloudflared tunnel route dns list

# 查看 tunnel 状态
cloudflared tunnel info wallet-sdk-example
```

### 3. 查看实时日志

```bash
# 运行 tunnel 时查看实时日志
cloudflared tunnel --config cloudflared-config.yaml run --loglevel debug
```

---

## 常见配置项说明

### Tunnel 配置项

| 配置项 | 说明 | 位置 |
|--------|------|------|
| `tunnel` | Tunnel 名称或 UUID | 配置文件 / Dashboard |
| `credentials-file` | 凭证文件路径 | 本地配置文件 |
| `hostname` | 自定义域名 | Dashboard / 配置文件 |
| `service` | 目标服务地址 | Dashboard / 配置文件 |
| `originRequest` | 源请求配置 | Dashboard / 配置文件 |

### Pages 配置项

| 配置项 | 说明 | 位置 |
|--------|------|------|
| `build command` | 构建命令 | Settings → Builds |
| `output directory` | 输出目录 | Settings → Builds |
| `environment variables` | 环境变量 | Settings → Environment variables |
| `custom domain` | 自定义域名 | Settings → Custom domains |
| `headers` | HTTP 头配置 | `_headers` 文件或 Dashboard |

### DNS 配置项

| 配置项 | 说明 | 位置 |
|--------|------|------|
| `Type` | 记录类型（CNAME/A/AAAA） | DNS → Records |
| `Name` | 子域名 | DNS → Records |
| `Target` | 目标地址 | DNS → Records |
| `Proxy` | 是否启用代理 | DNS → Records |

---

## 快速检查清单

### Tunnel 配置检查

- [ ] Tunnel 在 Dashboard 中显示为 "Active"
- [ ] DNS 记录已正确配置（CNAME 指向 tunnel）
- [ ] DNS 记录代理状态为 "Proxied"（橙色云朵）
- [ ] Ingress 规则中的 hostname 与 DNS 记录匹配
- [ ] Service 地址指向正确的本地服务（如 `http://localhost:5173`）

### Pages 配置检查

- [ ] 项目在 Pages 列表中可见
- [ ] 最新部署状态为 "Success"
- [ ] 自定义域名（如有）已正确配置
- [ ] SSL/TLS 证书状态为 "Active"
- [ ] 环境变量已正确设置

### 连接检查

- [ ] 本地服务正在运行（`npm run dev`）
- [ ] Tunnel 客户端已连接（Dashboard 显示 Active）
- [ ] 可以通过自定义域名访问应用
- [ ] 没有 CORS 或 SSL 错误

---

## 常见问题排查

### 1. Tunnel 显示为 Inactive

**检查步骤：**
1. 确认本地 `cloudflared` 进程正在运行
2. 检查 `credentials-file` 路径是否正确
3. 查看 Tunnel 日志：Dashboard → Tunnels → Logs
4. 验证配置文件格式是否正确

### 2. DNS 记录未生效

**检查步骤：**
1. 确认 DNS 记录类型为 CNAME
2. 确认 Target 指向正确的 tunnel ID（`.cfargotunnel.com`）
3. 确认代理状态为 "Proxied"
4. 等待 DNS 传播（通常几分钟）

### 3. Pages 部署失败

**检查步骤：**
1. 查看构建日志：Deployments → 选择失败的部署 → Build logs
2. 检查构建命令是否正确
3. 确认输出目录路径正确
4. 检查环境变量是否缺失

### 4. 无法访问自定义域名

**检查步骤：**
1. 确认 DNS 记录已正确配置
2. 检查 SSL/TLS 证书状态
3. 验证 Pages 项目中的自定义域名配置
4. 清除浏览器缓存后重试

---

## 相关链接

- [CloudFlare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
- [CloudFlare Pages Dashboard](https://dash.cloudflare.com/?to=/:account/pages)
- [CloudFlare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [CloudFlare Pages 文档](https://developers.cloudflare.com/pages/)

---

**最后更新**: 2025-01-23



















