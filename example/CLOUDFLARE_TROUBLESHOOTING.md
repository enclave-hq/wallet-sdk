# CloudFlare 配置查找和创建指南

如果你在 CloudFlare Dashboard 中找不到配置，请按照以下步骤排查和创建。

## 🔍 第一步：确认配置是否存在

### 检查 Tunnel 是否已创建

**方法 1: 使用命令行检查**
```bash
cd example
cloudflared tunnel list
```

如果看到 `wallet-sdk-example` 或类似的 tunnel，说明已创建。

**方法 2: 在 Dashboard 中查找**
1. 访问 https://one.dash.cloudflare.com/
2. 左侧菜单：**Networks** → **Tunnels**
3. 查看是否有名为 `wallet-sdk-example` 的 tunnel

### 检查 Pages 项目是否已创建

1. 访问 https://dash.cloudflare.com/
2. 左侧菜单：**Workers & Pages** → **Pages**
3. 查看是否有名为 `wallet-sdk-example` 的项目

### 检查 DNS 记录

1. 访问 https://dash.cloudflare.com/
2. 选择你的域名
3. 左侧菜单：**DNS** → **Records**
4. 查找是否有 `wallet-sdk-example` 相关的 CNAME 记录

---

## 🆕 第二步：如果配置不存在，创建它们

### 创建 CloudFlare Tunnel

#### 1. 登录 CloudFlare

```bash
cloudflared tunnel login
```

这会打开浏览器，要求你登录并授权。

#### 2. 创建 Tunnel

```bash
cd example
cloudflared tunnel create wallet-sdk-example
```

**输出示例：**
```
Created tunnel wallet-sdk-example with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**重要**: 保存这个 Tunnel ID，稍后需要用到。

#### 3. 获取凭证文件路径

创建 tunnel 后，会生成一个凭证文件，通常在：
- macOS/Linux: `~/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json`

查看凭证文件位置：
```bash
cloudflared tunnel list
```

#### 4. 更新配置文件

编辑 `cloudflared-config.yaml`：

```yaml
tunnel: wallet-sdk-example
# 或者使用 Tunnel ID
# tunnel: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

credentials-file: /Users/qizhongzhu/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

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

**替换以下内容：**
- `your-domain.com` → 你的实际域名（如 `enclave-hq.com`）
- `credentials-file` → 实际的凭证文件路径

#### 5. 配置 DNS 记录

**方法 1: 使用命令行（推荐）**

```bash
# 获取你的域名（替换为实际域名）
cloudflared tunnel route dns add wallet-sdk-example wallet-sdk-example.your-domain.com
```

**方法 2: 在 Dashboard 中手动添加**

1. 访问 https://dash.cloudflare.com/
2. 选择你的域名
3. 左侧菜单：**DNS** → **Records**
4. 点击 **"Add record"**
5. 填写：
   - **Type**: CNAME
   - **Name**: `wallet-sdk-example`
   - **Target**: `<tunnel-id>.cfargotunnel.com`（从 `cloudflared tunnel list` 获取）
   - **Proxy status**: 🟠 Proxied（橙色云朵）
6. 点击 **"Save"**

#### 6. 验证 Tunnel 配置

在 Dashboard 中查看：
1. 访问 https://one.dash.cloudflare.com/
2. **Networks** → **Tunnels**
3. 应该能看到 `wallet-sdk-example` tunnel
4. 点击进入，查看配置是否正确

---

### 创建 CloudFlare Pages 项目

#### 方法 1: 使用 Dashboard（推荐）

1. **访问 Pages**
   - 访问 https://dash.cloudflare.com/
   - 左侧菜单：**Workers & Pages** → **Pages**
   - 点击 **"Create a project"**

2. **选择创建方式**
   - **Upload assets**（手动上传）- 适合首次部署
   - **Connect to Git**（连接 Git）- 适合自动部署

3. **配置项目（手动上传方式）**
   - **Project name**: `wallet-sdk-example`
   - 点击 **"Create project"**
   - 上传 `dist` 目录的内容（需要先构建）

4. **配置项目（Git 方式）**
   - 选择 Git 提供商（GitHub/GitLab）
   - 授权访问仓库
   - 选择仓库和分支
   - **Build command**: `cd example && npm install && npm run build`
   - **Build output directory**: `example/dist`
   - **Root directory**: `/`（项目根目录）

#### 方法 2: 使用 Wrangler CLI

```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 构建项目
cd example
npm run build

# 部署
wrangler pages deploy dist --project-name=wallet-sdk-example
```

#### 配置自定义域名（可选）

1. 在 Pages 项目页面
2. 点击 **"Settings"** → **"Custom domains"**
3. 点击 **"Set up a custom domain"**
4. 输入域名：`wallet-sdk-example.your-domain.com`
5. 按照提示配置 DNS 记录

---

## 🔎 第三步：在不同位置查找配置

### 查找 Tunnel 配置

#### 位置 1: Zero Trust Dashboard
- URL: https://one.dash.cloudflare.com/
- 路径: **Networks** → **Tunnels**

#### 位置 2: 主 Dashboard（旧版本）
- URL: https://dash.cloudflare.com/
- 路径: **Zero Trust** → **Networks** → **Tunnels**

### 查找 Pages 配置

#### 位置 1: Workers & Pages
- URL: https://dash.cloudflare.com/
- 路径: **Workers & Pages** → **Pages**

#### 位置 2: 直接访问
- URL: https://dash.cloudflare.com/?to=/:account/pages

### 查找 DNS 配置

- URL: https://dash.cloudflare.com/
- 路径: 选择域名 → **DNS** → **Records**

---

## 🐛 常见问题

### 问题 1: 找不到 Zero Trust 菜单

**原因**: 可能需要启用 Zero Trust 服务

**解决**:
1. 访问 https://one.dash.cloudflare.com/
2. 如果提示需要订阅，选择免费计划
3. 完成初始设置

### 问题 2: Tunnel 列表为空

**可能原因**:
- Tunnel 还没有创建
- 在错误的账户下查看
- Tunnel 已被删除

**解决**:
1. 使用命令行检查：`cloudflared tunnel list`
2. 如果命令行也看不到，需要重新创建
3. 确认在正确的 CloudFlare 账户下

### 问题 3: Pages 项目列表为空

**可能原因**:
- 项目还没有创建
- 在错误的账户下查看

**解决**:
1. 确认在正确的 CloudFlare 账户下
2. 检查账户是否有 Pages 访问权限
3. 如果没有项目，按照上面的步骤创建

### 问题 4: 找不到 DNS 记录

**可能原因**:
- DNS 记录还没有创建
- 在错误的域名下查看
- 记录被删除

**解决**:
1. 确认选择了正确的域名
2. 检查所有 DNS 记录类型（包括 CNAME）
3. 如果没有记录，按照上面的步骤创建

### 问题 5: 凭证文件找不到

**查找凭证文件**:
```bash
# 列出所有 tunnel 及其凭证文件位置
cloudflared tunnel list

# 或者查找所有凭证文件
find ~/.cloudflared -name "*.json" -type f
```

**如果凭证文件丢失**:
1. 需要重新创建 tunnel
2. 或者从备份恢复凭证文件

---

## ✅ 验证配置是否正常工作

### 验证 Tunnel

1. **检查 Tunnel 状态**
   ```bash
   cloudflared tunnel info wallet-sdk-example
   ```

2. **启动 Tunnel**
   ```bash
   cd example
   npm run dev  # 在一个终端
   ./start-tunnel.sh  # 在另一个终端
   ```

3. **在 Dashboard 中查看**
   - Zero Trust → Tunnels → wallet-sdk-example
   - 应该显示 "Active" 状态
   - Connectors 应该显示连接的客户端

4. **测试访问**
   - 访问配置的域名：`https://wallet-sdk-example.your-domain.com`
   - 应该能看到本地开发服务器内容

### 验证 Pages

1. **检查部署状态**
   - Pages → wallet-sdk-example → Deployments
   - 最新部署应该显示 "Success"

2. **访问预览 URL**
   - 点击部署记录
   - 使用预览 URL 访问

3. **测试自定义域名**（如果配置了）
   - 访问自定义域名
   - 检查 SSL 证书状态

---

## 📋 快速检查清单

使用以下清单确认所有配置：

- [ ] Tunnel 已创建（`cloudflared tunnel list` 能看到）
- [ ] Tunnel 在 Dashboard 中可见（Zero Trust → Tunnels）
- [ ] 凭证文件路径正确（在 `cloudflared-config.yaml` 中）
- [ ] DNS 记录已创建（DNS → Records 中能看到 CNAME）
- [ ] DNS 记录代理状态为 Proxied（橙色云朵）
- [ ] Pages 项目已创建（Pages 列表中能看到）
- [ ] Pages 项目有成功的部署（Deployments 中有记录）
- [ ] 本地配置文件格式正确（`cloudflared-config.yaml`）

---

## 🆘 如果仍然找不到

1. **确认账户和域名**
   - 确认登录的是正确的 CloudFlare 账户
   - 确认选择了正确的域名

2. **检查权限**
   - 确认账户有足够的权限
   - 如果是团队账户，确认有访问权限

3. **联系支持**
   - CloudFlare 支持：https://support.cloudflare.com/
   - 社区论坛：https://community.cloudflare.com/

4. **重新开始**
   - 如果配置完全丢失，可以按照本文档重新创建所有配置

---

## 📚 相关文档

- [CloudFlare 配置指南](./CLOUDFLARE_SETUP.md)
- [Dashboard 查看指南](./CLOUDFLARE_DASHBOARD_GUIDE.md)
- [CloudFlare Tunnel 官方文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [CloudFlare Pages 官方文档](https://developers.cloudflare.com/pages/)

---

**最后更新**: 2025-01-23


















