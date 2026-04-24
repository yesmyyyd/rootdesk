#!/bin/sh

# 打印启动信息和版权
echo '========================================'
echo '           启动完毕 - todesk.cn         '
echo '========================================'
echo '免责声明: 本工具仅供学习和研究使用，请勿用于任何非法用途。'
echo '          因使用本工具产生的任何法律责任与开发者无关。'
echo '----------------------------------------'
echo '访问地址:'
echo '  控制端Web:      http://localhost:3000'
echo '  服务器WS:        ws://localhost:3001'
echo '  管理统计: http://localhost:3000/admin/monitor'
echo '----------------------------------------'
if [ -f "data/credentials.json" ]; then
  USER=$(grep -o '"user": "[^"]*"' data/credentials.json | cut -d'"' -f4)
  PASS=$(grep -o '"pass": "[^"]*"' data/credentials.json | cut -d'"' -f4)
  echo "管理员账号: $USER"
  echo "管理员密码: $PASS"
else
  echo "管理员账号: (启动后自动生成于 data/credentials.json)"
fi
echo '========================================'

# 启动主服务 (同时包含 Web 和 WebSocket)
PORT=3000 node server.js
