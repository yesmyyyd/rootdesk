; RootDesk Client NSIS Installer Script
; Author: Trae AI Assistant
; Date: 2026-06-01

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

; --- General Settings ---
Unicode true
Name "RootDesk Client"
OutFile "RootDesk_Setup.exe"
InstallDir "$PROGRAMFILES64\RootDesk"
InstallDirRegKey HKLM "Software\RootDesk" "InstallDir"
RequestExecutionLevel admin

; --- Definitions ---
!define SERVICE_NAME "RootDeskService"
!define EXE_NAME "rootdesk.exe"

; --- UI Settings ---
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

; --- Pages ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; --- Languages ---
!insertmacro MUI_LANGUAGE "SimpChinese"

; --- Installation Section ---
Section "Main" SEC01
    SetOutPath "$INSTDIR"
    
    ; 1. 预处理：静默授权 PsExec 协议
    WriteRegDWORD HKCU "Software\Sysinternals\PsExec" "EulaAccepted" 1
    WriteRegDWORD HKLM "Software\Sysinternals\PsExec" "EulaAccepted" 1
    
    ; 2. 停止现有服务和进程 (自适应重启)
    DetailPrint "正在停止现有服务..."
    nsExec::Exec 'net stop "${SERVICE_NAME}"'
    nsExec::Exec 'taskkill /F /T /IM "${EXE_NAME}"'
    Sleep 1000

    ; 3. 复制文件
    ; 从 dist\rootdesk 目录提取完整环境
    File /r "dist\rootdesk\*.*"
    File "icon.ico"
    
    ; 显式打包 library 文件夹
    SetOutPath "$INSTDIR\library"
    File /r "library\*.*"
    SetOutPath "$INSTDIR"

    ; 4. 安装为系统服务 (使用 NSSM)
    DetailPrint "正在使用 NSSM 注册系统服务..."
    Var /GLOBAL NSSM
    StrCpy $NSSM "$INSTDIR\library\win64\nssm.exe"

    IfFileExists $NSSM 0 skip_service
        ; 先删除旧服务
        DetailPrint "正在删除旧服务..."
        nsExec::Exec '"$NSSM" remove "${SERVICE_NAME}" confirm'
        ; 安装并配置服务 (使用 --service-monitor 参数以服务监控模式启动)
        DetailPrint "安装服务..."
        ; nsExec::Exec '"$NSSM" install "${SERVICE_NAME}" "$INSTDIR\${EXE_NAME}" "--service-monitor"'
        ; DetailPrint "设置服务描叙..."
        ; nsExec::Exec '"$NSSM" set "${SERVICE_NAME}" AppDirectory "$INSTDIR"'
        ; nsExec::Exec '"$NSSM" set "${SERVICE_NAME}" Description "RootDesk Remote Control Client"'
        ; nsExec::Exec '"$NSSM" set "${SERVICE_NAME}" Start SERVICE_AUTO_START'
        ; nsExec::Exec '"$NSSM" set "${SERVICE_NAME}" ObjectName LocalSystem'

        ; DetailPrint "正在以 System 权限启动后台服务..."
        ; nsExec::Exec '"$NSSM" start "${SERVICE_NAME}"  '
    skip_service:

    ; 5. 写入卸载程序
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; 6. 注册表
    DetailPrint "信息写入注册表..."
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RootDesk" "DisplayName" "RootDesk Client"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RootDesk" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RootDesk" "DisplayIcon" "$INSTDIR\icon.ico"
    WriteRegStr HKLM "Software\RootDesk" "InstallDir" "$INSTDIR"

    ; 7. 创建桌面快捷方式 
    DetailPrint "创建桌面快捷方式..."
    CreateShortcut "$DESKTOP\RootDesk.lnk" "$INSTDIR\${EXE_NAME}" "" "$INSTDIR\icon.ico"

    ; 8. 启动客户端 (使用 PsExec 以 System 权限立即启动，确保安装完即提权)
    DetailPrint "正在以 System 权限启动客户端界面..."
    nsExec::Exec '"$INSTDIR\library\PsExec.exe" /accepteula -i 1 -d -s "$INSTDIR\${EXE_NAME}"'

    ; 9. UI 配置
    ; StrCpy $1 "C:\ProgramData\SystemAuth"
    ; CreateDirectory $1
    ; FileOpen $0 "$1\settings.json" w
    ; FileWrite $0 '{"autoStart": true, "trayIcon": true, "autoUpdate": true}'
    ; FileClose $0

SectionEnd

; --- Uninstaller Section ---
Section "Uninstall"
    Delete "$DESKTOP\RootDesk.lnk"
    
    DetailPrint "正在停止并删除服务..."
    nsExec::Exec 'net stop "${SERVICE_NAME}"'
    
    Var /GLOBAL UN_NSSM
    StrCpy $UN_NSSM "$INSTDIR\library\win64\nssm.exe"
    IfFileExists $UN_NSSM 0 +2
        nsExec::Exec '"$UN_NSSM" remove "${SERVICE_NAME}" confirm'

    DetailPrint "正在强制关闭残留进程..."
    nsExec::Exec 'taskkill /F /T /IM "${EXE_NAME}"'

    Delete "$INSTDIR\${EXE_NAME}"
    Delete "$INSTDIR\icon.ico"
    Delete "$INSTDIR\uninstall.exe"
    RMDir /r "$INSTDIR\library"
    RMDir /r "$INSTDIR\_internal"
    
    Delete "$INSTDIR\*.dll"
    Delete "$INSTDIR\*.pyd"
    Delete "$INSTDIR\*.exe.manifest"
    
    RMDir /r "$INSTDIR"

    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RootDesk"
    DeleteRegKey HKLM "Software\RootDesk"

SectionEnd
