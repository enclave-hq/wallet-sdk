#!/bin/bash

# CloudFlare Tunnel 快速启动脚本
# 使用方法: ./start-tunnel.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}启动 CloudFlare Tunnel...${NC}"

# 检查 cloudflared 是否安装
if ! command -v cloudflared &> /dev/null; then
  echo -e "${RED}错误: cloudflared 未安装${NC}"
  echo -e "${YELLOW}安装方法:${NC}"
  echo -e "  macOS: ${GREEN}brew install cloudflare/cloudflare/cloudflared${NC}"
  echo -e "  Linux: 访问 https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/cloudflared-config.yaml"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${RED}错误: 配置文件不存在: $CONFIG_FILE${NC}"
  exit 1
fi

# 检查 credentials 文件路径
CRED_PATH=$(grep "credentials-file:" "$CONFIG_FILE" | awk '{print $2}' | tr -d '"')
if [ -z "$CRED_PATH" ] || [ "$CRED_PATH" == "/path/to/credentials.json" ]; then
  echo -e "${YELLOW}警告: 配置文件中的 credentials-file 路径未设置${NC}"
  echo -e "${YELLOW}请编辑 $CONFIG_FILE 并设置正确的 credentials.json 路径${NC}"
  exit 1
fi

if [ ! -f "$CRED_PATH" ]; then
  echo -e "${RED}错误: credentials 文件不存在: $CRED_PATH${NC}"
  echo -e "${YELLOW}请先创建 tunnel:${NC}"
  echo -e "  ${GREEN}cloudflared tunnel create wallet-sdk-example${NC}"
  exit 1
fi

# 检查本地服务器是否运行
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${YELLOW}警告: 本地服务器 (http://localhost:5173) 似乎未运行${NC}"
  echo -e "${YELLOW}请先启动开发服务器:${NC}"
  echo -e "  ${GREEN}npm run dev${NC}"
  read -p "是否继续启动 tunnel? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 启动 tunnel
echo -e "${GREEN}使用配置文件: $CONFIG_FILE${NC}"
echo -e "${GREEN}启动命令: cloudflared tunnel --config $CONFIG_FILE run${NC}"
echo -e "${YELLOW}按 Ctrl+C 停止 tunnel${NC}"
echo ""

cloudflared tunnel --config "$CONFIG_FILE" run



















