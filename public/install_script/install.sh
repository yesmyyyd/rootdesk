#!/bin/bash

# =======================================
#   RootDesk + TURN/STUN 一体化安装脚本
# =======================================

# --- 基础配置 ---
NODE_VERSION="v24.14.1"
NODE_TAR="node-$NODE_VERSION-linux-x64.tar.xz"
NODE_URL="https://nodejs.org/dist/$NODE_VERSION/$NODE_TAR"
NODE_INSTALL_DIR="/usr/local/lib/nodejs"

# --- 项目配置 ---
PROJECT_GIT="https://gitee.com/yesmyyyd/rootdesk.git"
TARGET_DIR="/home/rootdesk"

# --- TURN 配置 ---
STATIC_SECRET="yesmyyyd"

# --- 自动获取IP ---
INNER_LISTEN_IP=$(hostname -I | awk '{print $1}')
PUBLIC_EXTERNAL_IP=$(curl -s ip.sb)

echo "======================================="
echo "   RootDesk 一体化环境安装与部署脚本"
echo "======================================="
echo "内网IP: $INNER_LISTEN_IP"
echo "公网IP: $PUBLIC_EXTERNAL_IP"
echo "======================================="

# --- 第一阶段：环境检查与基础工具安装 ---
echo -e "\n[阶段 1] 正在检查基础运行环境..."

# 1.1 安装基础工具 (unzip, wget, tar, git, coturn, jq)
echo "[!] 正在安装基础工具 (unzip, wget, tar, git, coturn, jq)..."
sudo yum install -y unzip zip wget tar xz git coturn jq || true

# 1.2 检查 Node.js
CURRENT_NODE_VER=$(node -v 2>/dev/null)
if [ "$CURRENT_NODE_VER" == "$NODE_VERSION" ]; then
    echo "[?] Node.js $NODE_VERSION 已安装。"
else
    echo "[!] 正在安装 Node.js $NODE_VERSION..."
    sudo rm -rf $NODE_INSTALL_DIR
    sudo rm -f /usr/bin/node /usr/bin/npm /usr/bin/npx
    
    wget -nc $NODE_URL
    sudo mkdir -p $NODE_INSTALL_DIR
    sudo tar -xJvf $NODE_TAR -C $NODE_INSTALL_DIR --strip-components=1
    
    sudo ln -sf $NODE_INSTALL_DIR/bin/node /usr/bin/node
    sudo ln -sf $NODE_INSTALL_DIR/bin/npm /usr/bin/npm
    sudo ln -sf $NODE_INSTALL_DIR/bin/npx /usr/bin/npx
    echo "[?] Node.js 安装成功。"
fi

# 1.3 检查 PM2
if ! command -v pm2 >/dev/null 2>&1; then
    echo "[!] 正在安装进程管理器 PM2..."
    sudo npm install -g pm2 --registry=https://registry.npmmirror.com
    sudo ln -sf $NODE_INSTALL_DIR/bin/pm2 /usr/bin/pm2
else
    echo "[?] PM2 已就绪。"
fi

# --- 第二阶段：部署 TURN/STUN 服务 ---
echo -e "\n[阶段 2] 正在自动部署 TURN/STUN 服务..."

# 关闭旧服务
sudo systemctl stop coturn 2>/dev/null
sudo systemctl disable coturn 2>/dev/null
sudo pkill turnserver 2>/dev/null

# 生成配置
sudo mkdir -p /home/turnserver
cat << EOF | sudo tee /home/turnserver/turnserver.conf > /dev/null
listening-port=3478
listening-ip=$INNER_LISTEN_IP
external-ip=$PUBLIC_EXTERNAL_IP/$INNER_LISTEN_IP

realm=yyds.control
use-auth-secret
static-auth-secret=$STATIC_SECRET

fingerprint
min-port=49152
max-port=65535

log-file=/var/log/turnserver.log
simple-log

EOF

# 创建系统服务
cat << EOF | sudo tee /etc/systemd/system/turnserver.service > /dev/null
[Unit]
Description=Coturn TURN Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/turnserver -c /home/turnserver/turnserver.conf
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 启动 TURN 服务
sudo systemctl daemon-reload
sudo systemctl stop turnserver
sudo systemctl start turnserver

# 防火墙放行 (如果使用 firewalld)
if command -v firewall-cmd >/dev/null 2>&1; then
    sudo firewall-cmd --permanent --add-port=3478/tcp
    sudo firewall-cmd --permanent --add-port=3478/udp
    sudo firewall-cmd --permanent --add-port=3000/tcp
    sudo firewall-cmd --permanent --add-port=3000/udp
    sudo firewall-cmd --reload
fi

echo "[?] TURN/STUN 服务部署完成。"

# --- 第三阶段：GIT 克隆项目 ---
echo -e "\n[阶段 3] 正在拉取 RootDesk 项目代码..."

# 3.1 覆盖安装确认
if [ -d "$TARGET_DIR" ]; then
    echo "[警告] 目标目录 $TARGET_DIR 已存在。"
    read -p "是否执行覆盖安装？(y/n): " confirm
    if [[ "$confirm" != [yY] && "$confirm" != [yY][eE][sS] ]]; then
        echo "[i] 跳过源码覆盖，直接进入后续逻辑。"
    else
        echo "[!] 正在停止并删除旧的 PM2 服务..."
        sudo pm2 delete rootdesk >/dev/null 2>&1
        echo "[!] 正在删除旧项目并重新克隆..."
        sudo rm -rf "$TARGET_DIR"
        sudo git clone $PROJECT_GIT $TARGET_DIR
    fi
else
    sudo git clone $PROJECT_GIT $TARGET_DIR
fi

# 3.1.5 修改项目配置
echo "[+] 正在自动配置 server/config.json..."
CONFIG_FILE="$TARGET_DIR/server/config.json"
if [ -f "$CONFIG_FILE" ]; then
    sudo jq --arg turn "turn:$PUBLIC_EXTERNAL_IP:3478" \
            --arg secret "$STATIC_SECRET" \
            --arg stun "stun:$PUBLIC_EXTERNAL_IP:3478" \
            '.TURN_URL = $turn | .TURN_SECRET = $secret | .STUN_URL = $stun' \
            "$CONFIG_FILE" | sudo tee "$CONFIG_FILE.tmp" > /dev/null
    sudo mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
else
    # 如果文件不存在，则创建一个
    cat << EOF | sudo tee "$CONFIG_FILE" > /dev/null
{
  "TURN_URL": "turn:$PUBLIC_EXTERNAL_IP:3478",
  "TURN_SECRET": "$STATIC_SECRET",
  "STUN_URL": "stun:$PUBLIC_EXTERNAL_IP:3478"
}
EOF
fi

# 3.2 编译与启动
echo "[3.2] 正在进入项目目录进行构建..."
cd "$TARGET_DIR" || exit

# 检查 package.json
if [ ! -f "package.json" ]; then
    echo "错误: 未在 $TARGET_DIR 找到 package.json，项目拉取失败！"
    exit 1
fi

# 安装依赖并构建
echo "[+] 正在安装依赖..."
sudo npm install --registry=https://registry.npmmirror.com

echo "[+] 正在执行 npm run build..."
sudo npm run build

# PM2 启动
echo "[3.3] 正在通过 PM2 启动 rootdesk 服务..."
echo "[+] 正在停止并清理旧的服务实例..."
sudo pm2 delete rootdesk >/dev/null 2>&1
echo "[+] 正在启动新的 PM2 服务实例..."
sudo pm2 start npm --name "rootdesk" -- start
echo "[+] 正在保存 PM2 状态..."
sudo pm2 save

# 等待凭据文件生成
echo "[+] 正在等待系统初始化并生成管理凭据 (最多等待 15 秒)..."
CRED_FILE="$TARGET_DIR/server/data/credentials.json"
for i in {1..15}; do
    if [ -f "$CRED_FILE" ]; then
        echo "[?] 凭据文件已生成。"
        break
    fi
    sleep 1
done

# --- 最终汇总信息 ---
echo -e "\n\033[32m==================================================\033[0m"
echo -e "\033[32m✅ 部署任务全部完成！\033[0m"
echo -e "\033[32m==================================================\033[0m"

echo -e "\n[RootDesk 服务信息]"
echo "服务名称: rootdesk"
echo "项目目录: $TARGET_DIR"
echo "状态查看: pm2 status"
echo "日志查看: pm2 logs rootdesk"
echo "启动命令: pm2 start npm --name \"rootdesk\" -- start"
echo "停止命令: pm2 delete rootdesk"
echo "访问地址: http://$PUBLIC_EXTERNAL_IP:3000"

echo -e "\n[客户端配置]"
echo "协议: ws"
echo "服务器地址: $PUBLIC_EXTERNAL_IP"
echo "端口: 3000"

# 读取管理凭据
if [ -f "$CRED_FILE" ]; then
    ADMIN_USER=$(sudo jq -r '.user' "$CRED_FILE")
    ADMIN_PASS=$(sudo jq -r '.pass' "$CRED_FILE")
    echo -e "\n[管理后台信息]"
    echo "管理地址: http://$PUBLIC_EXTERNAL_IP:3000/admin/monitor"
    echo "管理账号: $ADMIN_USER"
    echo "管理密码: $ADMIN_PASS"
else
    echo -e "\n[管理后台信息]"
    echo "管理地址: http://$PUBLIC_EXTERNAL_IP:3000/admin/monitor"
    echo "[!] 未能在预期时间内读取到 credentials.json，请稍后手动确认。"
fi

echo -e "\n[TURN/STUN 服务信息]"
echo "STUN: stun:$PUBLIC_EXTERNAL_IP:3478"
echo "TURN (UDP): turn:$PUBLIC_EXTERNAL_IP:3478?transport=udp"
echo "TURN (TCP): turn:$PUBLIC_EXTERNAL_IP:3478?transport=tcp"
echo "密钥: $STATIC_SECRET"

echo -e "\n\033[31m⚠️  请确保在云控制台安全组开放以下端口：\033[0m"
echo "   3000 TCP (RootDesk)"
echo "   3478 TCP/UDP (TURN)"
echo -e "\033[31m==================================================\033[0m"