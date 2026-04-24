@echo off
:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] 请右键使用“以管理员身份运行”！
    pause
    exit
)

set SERVICE_NAME=NexusTestService
set NSSM_EXE=%~dp0nssm.exe
set PY_EXE=python.exe
set SCRIPT_PATH=%~dp0my_code.py

echo [*] 正在安装服务: %SERVICE_NAME%...

:: 1. 使用 nssm 安装服务
:: 格式: nssm install <服务名> <程序路径> <参数>
"%NSSM_EXE%" install "%SERVICE_NAME%" "%PY_EXE%" "%SCRIPT_PATH%"

:: 2. 设置服务描述
"%NSSM_EXE%" set "%SERVICE_NAME%" Description "这是一个测试 Python 脚本作为系统服务的 Demo"

:: 3. 设置启动类型为自动
"%NSSM_EXE%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START

:: 4. 启动服务
"%NSSM_EXE%" start "%SERVICE_NAME%"

echo.
echo [+] 服务安装成功并已尝试启动！
echo [*] 你可以打开“任务管理器” -> “服务” 找到 %SERVICE_NAME%
echo [*] 观察同目录下的 service_log.txt 是否在持续更新。
echo.
pause