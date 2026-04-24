#!/bin/bash

# --- 1. Docker 检测与安装 (保持原逻辑) ---
if ! command -v docker &> /dev/null; then
    echo "📦 未检测到 Docker，正在安装..."
    yum install -y yum-utils device-mapper-persistent-data lvm2
    yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
    sed -i 's/\$releasever/7/g' /etc/yum.repos.d/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io
    systemctl enable --now docker
else
    echo "✅ Docker 已安装"
fi

# --- 2. Nginx 智能探测 ---
NGINX_BIN=$(which nginx 2>/dev/null)

if [ -z "$NGINX_BIN" ]; then
    echo "🌐 未检测到 Nginx，准备从源码安装 1.28.3..."
    # ... (此处保留你之前的源码安装逻辑)
    yum install -y gcc gcc-c++ pcre pcre-devel zlib zlib-devel openssl openssl-devel wget make
    wget https://nginx.org/download/nginx-1.28.3.tar.gz
    tar -zxvf nginx-1.28.3.tar.gz
    cd nginx-1.28.3
    ./configure --prefix=/usr/local/nginx --with-http_ssl_module
    make && make install
    ln -s /usr/local/nginx/sbin/nginx /usr/local/bin/nginx
    NGINX_BIN="/usr/local/nginx/sbin/nginx"
    cd ..
else
    echo "✅ 检测到已运行的 Nginx: $NGINX_BIN"
fi

# --- 3. 自动定位配置文件路径 ---
# 通过 nginx -V 提取 --conf-path 的值
CONF_PATH=$($NGINX_BIN -V 2>&1 | grep -oP '(?<=--conf-path=)[^ ]+')
if [ -z "$CONF_PATH" ]; then
    # 如果没搜到，尝试默认路径
    CONF_PATH="/usr/local/nginx/conf/nginx.conf"
fi
CONF_DIR=$(dirname "$CONF_PATH")
INCLUDE_DIR="$CONF_DIR/conf.d"

echo "📂 配置文件路径: $CONF_PATH"
echo "📂 配置包含目录: $INCLUDE_DIR"

# --- 4. 注入 Include 语句 (不破坏主配置) ---
mkdir -p "$INCLUDE_DIR"
if ! grep -q "include .*conf.d/.*\.conf;" "$CONF_PATH"; then
    echo "🔗 正在向主配置注入 include 语句..."
    # 在 http { 这一行之后插入 include
    sed -i '/http {/a \    include conf.d/*.conf;' "$CONF_PATH"
fi

# --- 5. 写入 RootDesk 独立配置 ---
cat > "$INCLUDE_DIR/rootdesk.conf" <<EOF
server {
    listen 80;
    server_name localhost;

    location /rootdesk {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /rootdesk/_next/ {
        proxy_pass http://127.0.0.1:3000/_next/;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /rootdesk/ws {
        proxy_pass http://127.0.0.1:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location /rootdesk/admin/ws {
        proxy_pass http://127.0.0.1:3001/admin/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

# --- 6. 重载 Nginx ---
$NGINX_BIN -t && $NGINX_BIN -s reload
echo "✅ Nginx 转发已就绪"

# --- 7. 运行 RootDesk 容器 ---
docker load < rootdesk_deploy.tar 2>/dev/null
docker rm -f rootdesk 2>/dev/null
docker run -d --name rootdesk -p 3000:3000 -p 3001:3001 -v \$(pwd)/data:/app/server/data --restart always rootdesk:latest

echo "✨ 部署完成！访问 http://你的IP/rootdesk"