@echo off
chcp 65001 >nul
python -m PyInstaller -D -w -n rootdesk -y ^
 --add-data "library;library" ^
 --collect-all av ^
 --collect-all aiortc ^
 --collect-all pystray ^
 --exclude-module PyQt5.QtWebEngine ^
 --exclude-module PyQt5.QtWebEngineCore ^
 --exclude-module PyQt5.QtWebEngineWidgets ^
 --exclude-module PyQt5.QtWebKit ^
 --exclude-module PyQt5.QtWebKitWidgets ^
 --uac-admin ^
 -i icon.ico client.py
