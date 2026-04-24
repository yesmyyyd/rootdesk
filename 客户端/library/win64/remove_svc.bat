@echo off
net session >nul 2>&1
if %errorLevel% neq 0 ( echo 请用管理员运行 & pause & exit )

set SERVICE_NAME=NexusTestService
"%~dp0nssm.exe" stop "%SERVICE_NAME%"
"%~dp0nssm.exe" remove "%SERVICE_NAME%" confirm

echo [+] 服务已卸载
pause