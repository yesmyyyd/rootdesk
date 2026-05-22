@echo off
chcp 65001 >nul
cls

:: 检查是否安装 Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 正在启动 client.py ...
    python client.py
    pause
    exit /b
)

:: 如果没找到 Python
echo ==============================================
echo          错误：未检测到 Python 环境
echo ==============================================
echo.
echo 请先安装 Python 并勾选 "Add Python to PATH"
echo 下载地址：https://www.python.org/downloads/
echo.
echo 安装完成后，请重新运行此脚本。
echo.
pause