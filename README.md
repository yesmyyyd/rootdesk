# 🚀 RootDesk: 可能是最优雅的开源 Web 远程控制方案

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15+-black.svg)
![Python](https://img.shields.io/badge/Python-3.8+-yellow.svg)

> **打破设备边界，让远程控制像刷网页一样简单！**

RootDesk 是一款专为开发者和极客打造的**全栈远程控制系统**。它由 **Next.js 强力驱动的 Web 控制端** 和 **轻量级 Python 客户端** 组成。无需安装臃肿的桌面软件，只要有浏览器，你就能随时随地掌控你的远程设备。

---

## ✨ 为什么选择 RootDesk？

传统的远控软件要么收费贵，要么体积大。RootDesk 走的是“极简+强大”的路线：

- 🌐 **纯 Web 控制**：打开浏览器即用，支持手机/平板/电脑跨端操作。
- 🏠 **支持私有化部署**：数据完全由你掌控，支持在内网或私有云中部署，安全无忧。
- ⚙️ **灵活配置**：客户端支持自定义服务器地址与端口，轻松连接你的私有控制端。
- ⚡ **毫秒级响应**：基于 WebSocket 的实时双向通信，指令下发瞬间到达。
- 🐍 **轻量级客户端**：基于 Python 核心编译，绿色免安装，代码透明，安全可控。
- 🎨 **颜值即正义**：采用 Shadcn UI + Tailwind CSS 设计，极简黑白灰风格，高级感拉满。
- 🛠️ **全能工具箱**：不仅仅是看屏幕，更有文件管理、进程监控、远程终端、**双向语音、音频监听、私有屏幕**等深度功能。
- 🔄 **高可用性**：支持开机自启、锁屏/解锁控制，确保远程设备随时随地、任何状态下都能被掌控。

---

## 🛠️ 核心功能一览

| 功能 | 描述 |
| :--- | :--- |
| **🖥️ 实时桌面** | 高清流畅的屏幕画面同步，支持远程点击。 |
| **📁 文件管理** | 像网盘一样浏览远程文件，支持上传、下载、删除。 |
| **💻 远程终端** | 直接在网页端执行 CMD/Shell 命令，运维神器。 |
| **📊 进程监控** | 实时查看系统资源占用，一键结束流氓进程。 |
| **🏠 私有化连接** | 客户端内置设置面板，支持填写私有服务器 IP/域名及端口。 |
| **🔄 开机自启** | 支持系统服务安装，重启后自动运行，确保设备永久在线。 |
| **🔒 锁屏解锁** | 深度集成系统权限，支持远程锁定与解锁屏幕。 |
| **🎧 音频监听** | 实时同步远程设备音频输出，听见远程的一切。 |
| **🎤 麦克风通话** | 支持双向语音对讲，远程喊话、技术指导更高效。 |
| **🕵️ 私有屏幕** | 远程操作时可开启“隐私模式”，黑掉对方显示器，保护操作隐私。 |
| **📱 安卓被控** | **(即将推出)** 支持安卓设备作为被控端，实现跨平台远控。 |
| **ℹ️ 系统详情** | CPU、内存、硬盘、网络信息一目了然。 |
| **📢 广告推送** | 内置灵活的广告/通告位，支持远程动态更新。 |

---

## 🚀 快速部署

> **注：项目支持 Docker 快速部署，确保你的服务器已安装 Docker 环境。**

### 1. 准备工作
确保你的服务器已安装 Docker。

### 2. Nginx 配置 (可选)
如果你希望通过 Nginx 实现同域访问（隐藏端口），请在 Nginx 配置文件中添加以下内容：

```nginx
location /np/ {
    proxy_pass http://127.0.0.1:3000/;  
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme; 
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

location /_next/ {
    proxy_pass http://127.0.0.1:3000/_next/;  
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme; 
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

location /ws {
    proxy_pass http://127.0.0.1:3001/ws; 
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
}

location /admin/ws {
    proxy_pass http://127.0.0.1:3001/admin/ws; 
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
}
```

### 3. 部署步骤

1. **准备部署包**：
   将项目部署包上传至服务器。

2. **执行部署命令**：
   在项目根目录下，依次执行以下命令：

   ```bash
   
   #  停止并删除旧容器
   docker stop rootdesk 2>/dev/null && docker rm rootdesk 2>/dev/null

   #  加载镜像
   docker load < rootdesk_deploy.tar

   #  启动新容器
   docker run -d \
     --name rootdesk \
     -p 3000:3000 -p 3001:3001 \
     -v $(pwd)/data:/app/server/data \
     --restart always \
     rootdesk:latest
   ```

### 4. 访问系统
容器启动后，根据日志中打印的地址访问：
- **控制端 Web**: `http://你的服务器IP:3000` (或 `http://域名/np/` 如果配置了 Nginx)
- **服务器 WS**: `ws://你的服务器IP:3001` (或 `ws://域名/ws` 如果配置了 Nginx)
- **管理统计**: `http://你的服务器IP:3000/admin/monitor`

> **管理员凭证**：首次启动后，系统会自动在 `data/credentials.json` 文件中生成管理员账号密码。请通过 `docker logs rootdesk` 查看生成的初始凭证。

## 🚀 客户端使用指南

### 1. 运行客户端 (Client)
客户端为绿色免安装的 `.exe` 可执行文件，支持连接到你的私有服务器。 
客户端下载：https://pan.baidu.com/s/1hlCG-AqXjaWuNtpLkdArFA?pwd=mem9


**系统支持：** Windows 7 / 8 / 10 / 11 (x64/x86)

1. 下载并运行 **RootDesk 客户端 (.exe)**。
2. **设置服务器**：在客户端界面的“设置”选项卡中，填写你部署的控制端 **服务器地址** 和 **端口**。
3. **连接成功**：返回首页查看设备 ID 和连接状态。
### 2. 部署协助
如果你在部署过程中遇到困难，或者不熟悉 Node.js 环境搭建，欢迎联系开发者。我们可以提供**远程技术支持**，协助你完成私有化环境的搭建与调试。

---

## 🏗️ 技术架构

虽然暂未开源，但我们采用了最前沿的技术栈，确保系统的稳定与高效：

- **控制端**: Next.js 15 (App Router), Node.js 高性能服务端
- **通信层**: Socket.io 实时双向加密通信
- **客户端**: 基于 Python 核心编译的 Win32 原生交互程序 (.exe)
- **安全**: 全程 TLS 加密传输, 动态令牌校验, 访问密码保护

---

## 📅 路线图 (Roadmap)

- [x] **Windows 客户端** (已发布)
- [x] **Web 控制端** (已发布)
- [ ] **Android 被控端** (开发中 🚀)
- [ ] **iOS 控制端** (规划中)
- [ ] **源代码开源** (规划中)

---

 


**如果这个项目对你有帮助，请点个 ⭐️ Star 关注我们的进度！**


