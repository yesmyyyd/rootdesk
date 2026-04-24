#!/bin/sh

# --- 0. 重新编译web和服务端代码 ---
npm run build
npm run build:server

# --- 1. 重新构建镜像 ---
docker build -f Dockerfile.deploy -t rootdesk:latest .

# --- 2. 重新保存 ---
docker save -o rootdesk_deploy.tar rootdesk:latest

# --- 3. 传到服务器后 ---
# 停止并删除旧容器
docker stop rootdesk 2>/dev/null && docker rm rootdesk 2>/dev/null

# 加载镜像
docker load < rootdesk_deploy.tar

# 启动新容器
docker run -d \
  --name rootdesk \
  -p 3000:3000 -p 3001:3001 \
  -v $(pwd)/data:/app/server/data \
  --restart always \
  rootdesk:latest

# 查看日志确认
docker logs  rootdesk