# CloudFlare 反向映射配置

本文档说明 wallet-sdk 项目的 CloudFlare 配置。

## 📦 项目结构

- **wallet-sdk**: npm 包，主要用于构建和发布到 npm registry
- **wallet-sdk/example**: Vite + React 示例应用，需要部署到 CloudFlare Pages

## 🚀 部署说明

### wallet-sdk (主包)

`wallet-sdk` 是一个 npm 包，通常不需要部署到 CloudFlare。它通过 npm registry 分发：

```bash
npm install @enclave-hq/wallet-sdk
```

如果将来需要部署文档站点，可以参考 `example` 目录的配置。

### wallet-sdk/example (示例应用)

示例应用需要部署到 CloudFlare Pages。详细配置请参考：

📖 **[example/CLOUDFLARE_SETUP.md](./example/CLOUDFLARE_SETUP.md)**

## 🔧 快速开始

### 部署示例应用

```bash
# 进入 example 目录
cd example

# 使用自动部署脚本
./cloudflare-deploy.sh --production
```

### 使用 CloudFlare Tunnel（本地开发）

```bash
# 启动本地开发服务器
cd example
npm run dev

# 在另一个终端启动 tunnel
cloudflared tunnel --config cloudflared-config.yaml run
```

## 📚 相关文档

- [示例应用 CloudFlare 配置](./example/CLOUDFLARE_SETUP.md)
- [CloudFlare Dashboard 查看指南](./example/CLOUDFLARE_DASHBOARD_GUIDE.md) - 如何在 Dashboard 中查看和管理配置
- [示例应用 README](./example/README.md)
- [Wallet SDK 主文档](./README.md)

---

**最后更新**: 2025-01-23

