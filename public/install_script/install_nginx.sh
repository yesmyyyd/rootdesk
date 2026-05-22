#!/bin/bash
set -e

echo "⚠️  安全警告：本脚本将配置 rootdesk 专用 Nginx 服务。"
echo "请确保该服务器没有其他 Nginx 业务，否则会被覆盖！"

# --- 参数校验 ---
if [ $# -ne 1 ];then
    echo "用法: $0 主域名"
    echo "示例: $0 rootdesk.cn"
    exit 1
fi

MAIN_DOMAIN="$1"
WWW_DOMAIN="www.${MAIN_DOMAIN}"
DOC_DOMAIN="doc.${MAIN_DOMAIN}"
CONTACT_DOMAIN="contact.${MAIN_DOMAIN}"

NGINX_PATH="/usr/local/nginx"
NGINX_SBIN="${NGINX_PATH}/sbin/nginx"

echo "====================================="
echo "  Nginx 1.28.3 自动化搭建 rootdesk"
echo "  当前主域名: ${MAIN_DOMAIN}"
echo "====================================="

# --- 1. 路径存在性检测 (安全第一) ---
if [ -d "$NGINX_PATH" ]; then
    echo "❌ 错误: 检测到目录 $NGINX_PATH 已存在。"
    echo "为了防止覆盖已有业务，脚本已停止执行。"
    echo "提示: 如果确认要重新安装，请先执行: rm -rf $NGINX_PATH (操作前请务必备份)"
    exit 1
fi

# --- 2. 开始安装流程 ---
echo "🚀 开始执行全新的 Nginx 1.28.3 编译安装..."

# 安装系统依赖
if [ -f /etc/redhat-release ]; then
    yum install -y gcc pcre-devel zlib-devel openssl-devel wget
else
    apt update && apt install -y gcc libpcre3-dev zlib1g-dev libssl-dev wget
fi

# 源码编译
mkdir -p /usr/local/src
cd /usr/local/src
# 修复：移除 URL 中的反引号
wget -c "https://nginx.org/download/nginx-1.28.3.tar.gz"
tar -zxf nginx-1.28.3.tar.gz
cd nginx-1.28.3

./configure --prefix=$NGINX_PATH \
--with-http_ssl_module \
--with-http_v2_module
make && make install
echo "✨ 编译安装成功。"

# --- 3. 目录与进程准备 ---
echo "清理旧进程并准备配置目录..."
# 使用精确匹配杀死进程，防止脚本自杀
pkill -x -9 nginx 2>/dev/null || true
mkdir -p ${NGINX_PATH}/conf/crt
mkdir -p ${NGINX_PATH}/conf/conf.d

# --- 4. 初始化主配置文件 ---
cat > ${NGINX_PATH}/conf/nginx.conf << EOF
worker_processes  auto;
events {
    worker_connections  1024;
}
http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    # 关键：加载子目录配置
    include conf.d/*.conf;
}
EOF

# --- 5. 写入业务逻辑配置 (80/443 共存) ---
cat > ${NGINX_PATH}/conf/conf.d/rootdesk.conf << EOF
# HTTP 80 端口配置
server {
    listen 80;
    listen [::]:80;
    server_name ${MAIN_DOMAIN} ${WWW_DOMAIN} ${DOC_DOMAIN} ${CONTACT_DOMAIN};

    location /robots.txt {
        default_type text/plain;
        return 200 "User-agent: *\nAllow: /\n\nSitemap: https://${MAIN_DOMAIN}/sitemap.xml\n";
    }

    location /sitemap.xml {
        default_type application/xml;
        return 200 '<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://${MAIN_DOMAIN}/</loc>
        <lastmod>2026-04-09</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://${MAIN_DOMAIN}/download</loc>
        <lastmod>2026-04-01</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>';
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# HTTPS 443 端口配置
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${MAIN_DOMAIN} ${WWW_DOMAIN};

    ssl_certificate      ${NGINX_PATH}/conf/crt/fullchain.crt;
    ssl_certificate_key  ${NGINX_PATH}/conf/crt/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location /robots.txt {
        default_type text/plain;
        return 200 "User-agent: *\nAllow: /\n\nSitemap: https://${MAIN_DOMAIN}/sitemap.xml\n";
    }

    location /sitemap.xml {
        default_type application/xml;
        return 200 '<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://${MAIN_DOMAIN}/</loc>
        <lastmod>2026-04-09</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://${MAIN_DOMAIN}/download</loc>
        <lastmod>2026-04-01</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>';
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# 文档与联系人重定向
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOC_DOMAIN};
    ssl_certificate      ${NGINX_PATH}/conf/crt/${DOC_DOMAIN}.pem;
    ssl_certificate_key  ${NGINX_PATH}/conf/crt/${DOC_DOMAIN}.key;
    return 302 https://gitee.com/yesmyyyd/rootdesk;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${CONTACT_DOMAIN};
    ssl_certificate      ${NGINX_PATH}/conf/crt/${CONTACT_DOMAIN}.pem;
    ssl_certificate_key  ${NGINX_PATH}/conf/crt/${CONTACT_DOMAIN}.key;
    return 302 https://gitee.com/yesmyyyd/rootdesk;
}
EOF

# --- 6. 校验与启动 ---
echo "正在校验 Nginx 配置..."
if $NGINX_SBIN -t; then
    $NGINX_SBIN
    echo -e "\n====================================="
    echo "✅ 部署完成！"
    echo "重载命令：$NGINX_SBIN -s reload"
    echo "====================================="
else
    echo -e "\n====================================="
    echo "❌ 校验失败！请检查 /usr/local/nginx/conf/crt/ 下是否缺少证书。"
    echo "====================================="
    exit 1
fi