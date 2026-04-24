#!/bin/bash

# --- 基础配置 ---
NODE_VERSION="v24.14.1"
NODE_TAR="node-$NODE_VERSION-linux-x64.tar.xz"
NODE_URL="https://nodejs.org/dist/$NODE_VERSION/$NODE_TAR"
NODE_INSTALL_DIR="/usr/local/lib/nodejs"

# --- 项目配置 ---
PROJECT_URL="http://www.xxx.com/yyds-control.zip"
TARGET_DIR="/home/yyds-control"
ZIP_NAME="yyds-control.zip"

echo "======================================="
echo "   RootDesk 一体化环境安装与部署脚本"
echo "======================================="

# --- 第一阶段：环境检查与安装 ---
echo "[阶段 1] 正在检查基础运行环境..."

# 1.1 安装基础工具 (unzip, wget, tar)
if ! command -v unzip >/dev/null 2>&1 || ! command -v wget >/dev/null 2>&1; then
    echo "[!] 正在安装基础工具 (unzip, wget, tar)..."
    sudo yum install -y unzip zip wget tar xz
else
    echo "[?] 基础工具已就绪。"
fi

# 1.2 检查 Node.js
CURRENT_NODE_VER=$(node -v 2>/dev/null)
if [ "$CURRENT_NODE_VER" == "$NODE_VERSION" ]; then
    echo "[?] Node.js $NODE_VERSION 已安装。"
else
    echo "[!] 正在安装 Node.js $NODE_VERSION..."
    rm -rf $NODE_INSTALL_DIR
    rm -f /usr/bin/node /usr/bin/npm /usr/bin/npx
    
    wget -nc $NODE_URL
    mkdir -p $NODE_INSTALL_DIR
    tar -xJvf $NODE_TAR -C $NODE_INSTALL_DIR --strip-components=1
    
    ln -sf $NODE_INSTALL_DIR/bin/node /usr/bin/node
    ln -sf $NODE_INSTALL_DIR/bin/npm /usr/bin/npm
    ln -sf $NODE_INSTALL_DIR/bin/npx /usr/bin/npx
    echo "[?] Node.js 安装成功。"
fi

# 1.3 检查 PM2
if ! command -v pm2 >/dev/null 2>&1; then
    echo "[!] 正在安装进程管理器 PM2..."
    npm install -g pm2 --registry=https://registry.npmmirror.com
    ln -sf $NODE_INSTALL_DIR/bin/pm2 /usr/bin/pm2
else
    echo "[?] PM2 已就绪。"
fi

# --- 第二阶段：项目部署 ---
echo -e "\n[阶段 2] 正在准备项目部署..."

# 2.1 覆盖安装确认
IS_OVERWRITE=true
if [ -d "$TARGET_DIR" ]; then
    echo "[警告] 目标目录 $TARGET_DIR 已存在。"
    read -p "是否执行覆盖安装？(y/n): " confirm
    if [[ "$confirm" != [yY] && "$confirm" != [yY][eE][sS] ]]; then
        IS_OVERWRITE=false
        echo "[i] 跳过源码覆盖，直接进入后续逻辑。"
    fi
fi

# 2.2 执行清理与下载 (仅在确定覆盖时)
if [ "$IS_OVERWRITE" = true ]; then
    echo "[2.1] 正在清理旧程序并重新下载..."
    
    # 停止旧进程
    pm2 delete rootdesk >/dev/null 2>&1
    
    # 彻底删除旧目录
    rm -rf "$TARGET_DIR"
    mkdir -p "$TARGET_DIR"
    
    # 下载并解压
    cd /home
    wget -O "$ZIP_NAME" "$PROJECT_URL"
    unzip -o "$ZIP_NAME" -d "$TARGET_DIR"
    rm -f "$ZIP_NAME"
    echo "[?] 源码更新完成。"
fi

# 2.3 编译与启动
echo "[2.2] 正在进入项目目录进行构建..."
cd "$TARGET_DIR"

# 再次检查是否有源码
if [ ! -f "package.json" ]; then
    echo "? 错误: 未在 $TARGET_DIR 找到 package.json，请检查下载地址或解压路径。"
    exit 1
fi

# 安装依赖并构建
echo "[+] 正在安装依赖 (Registry: npmmirror)..."
npm install --registry=https://registry.npmmirror.com

echo "[+] 正在执行 npm run build..."
npm run build

# PM2 启动
echo "[2.3] 正在通过 PM2 启动 rootdesk 服务..."
pm2 delete rootdesk >/dev/null 2>&1 # 确保清理残留
pm2 start npm --name "rootdesk" -- start
pm2 save

echo "======================================="
echo "?? 部署任务全部完成！"
echo "服务名称: rootdesk"
echo "Node 版本: $(node -v)"
echo "状态查看: pm2 status"
echo "日志查看: pm2 logs rootdesk"
echo "======================================="