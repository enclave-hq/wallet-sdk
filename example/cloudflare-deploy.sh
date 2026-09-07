#!/bin/bash

# CloudFlare Pages 部署脚本
# 使用方法: ./cloudflare-deploy.sh [--production|--preview]

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}开始构建 wallet-sdk example 应用...${NC}"

# 进入 example 目录
cd "$(dirname "$0")"

# 安装依赖
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}安装依赖...${NC}"
  npm install
fi

# 构建应用
echo -e "${GREEN}构建应用...${NC}"
npm run build

# 检查构建结果
if [ ! -d "dist" ]; then
  echo -e "${YELLOW}错误: 构建失败，dist 目录不存在${NC}"
  exit 1
fi

# 复制 CloudFlare 配置文件到 dist 目录
if [ -f "_redirects" ]; then
  echo -e "${GREEN}复制 _redirects 文件到 dist...${NC}"
  cp _redirects dist/
fi

echo -e "${GREEN}构建完成！${NC}"
echo -e "${YELLOW}构建输出目录: $(pwd)/dist${NC}"

# 如果提供了参数，使用 wrangler 部署
if [ "$1" == "--production" ]; then
  echo -e "${GREEN}部署到 CloudFlare Pages (生产环境)...${NC}"
  if command -v wrangler &> /dev/null; then
    wrangler pages deploy dist --project-name=wallet-sdk-example
  else
    echo -e "${YELLOW}警告: wrangler 未安装，请手动部署${NC}"
    echo -e "${YELLOW}安装: npm install -g wrangler${NC}"
    echo -e "${YELLOW}或使用 CloudFlare Dashboard 手动上传 dist 目录${NC}"
  fi
elif [ "$1" == "--preview" ]; then
  echo -e "${GREEN}部署到 CloudFlare Pages (预览环境)...${NC}"
  if command -v wrangler &> /dev/null; then
    wrangler pages deploy dist --project-name=wallet-sdk-example --branch=preview
  else
    echo -e "${YELLOW}警告: wrangler 未安装，请手动部署${NC}"
  fi
else
  echo -e "${YELLOW}构建完成，未自动部署${NC}"
  echo -e "${YELLOW}使用方法:${NC}"
  echo -e "  ${GREEN}./cloudflare-deploy.sh --production${NC}  # 部署到生产环境"
  echo -e "  ${GREEN}./cloudflare-deploy.sh --preview${NC}     # 部署到预览环境"
  echo -e "${YELLOW}或使用 CloudFlare Dashboard 手动上传 dist 目录${NC}"
fi

