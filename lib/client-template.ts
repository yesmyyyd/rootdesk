
export interface ClientConfig {
  host: string
  port: string
  remark: string
  autoStart: string
  reconnectInterval: number
  hideConsole: boolean
  appUrl: string
  encryptionKey: string
  singleInstance: boolean
  installAsService: boolean
  protocol: "ws" | "wss"
  modules: {
    screen: boolean
    terminal: boolean
    files: boolean
    windows: boolean
    monitor: boolean
    audio: boolean
  }
  platform: "pc" | "mobile"
}

export function generatePythonScript(config: ClientConfig) {
  const modulesList = []
  if (config.modules.screen) modulesList.push("'screen'")
  if (config.modules.terminal) modulesList.push("'terminal'")
  if (config.modules.files) modulesList.push("'files'")
  if (config.modules.windows) modulesList.push("'windows'")
  if (config.modules.monitor) modulesList.push("'monitor'")
  if (config.modules.audio) modulesList.push("'audio'")

  return `# -------------------------------------------------------------
# RootDesk 客户端脚本
# 
# 运行前需确保安装以下依赖库：
# pip install aiortc websocket-client psutil pyautogui mss Pillow dxcam numpy pyaudio pystray pywebview certifi
# -------------------------------------------------------------

import sys
import os
import time
import socket
import threading
import struct
import json
import platform
import subprocess
import base64
import shutil
import tempfile
import zlib
import hashlib
import random
import string
import ssl
import asyncio
# 系统授权与配置文件目录
SYSTEM_AUTH_DIR = r"C:\\ProgramData\\SystemAuth" if platform.system() == "Windows" else os.path.join(tempfile.gettempdir(), "SystemAuth")
print(f"[*] SYSTEM_AUTH_DIR: {SYSTEM_AUTH_DIR}")
print(f"[*] Python Executable: {sys.executable}")
print(f"[*] Python Version: {sys.version}")
print(f"[*] Architecture: {platform.architecture()[0]}")
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, RTCDataChannel, RTCIceCandidate, RTCConfiguration, RTCIceServer
    from aiortc.contrib.media import MediaStreamTrack
    HAS_AIORTC = True
except ImportError as e:
    print(f"[*] aiortc import error: {e}")
    HAS_AIORTC = False
try:
    import certifi
    HAS_CERTIFI = True
except ImportError:
    HAS_CERTIFI = False
try:
    import webview
    # Windows 7 or XP should use native Tkinter UI instead of WebView
    is_old_win = False
    if platform.system() == "Windows":
        try:
            # Win XP is 5.x, Vista is 6.0, Win 7 is 6.1
            major, minor = sys.getwindowsversion()[:2]
            if major < 6 or (major == 6 and minor <= 1):
                is_old_win = True
        except:
            if platform.release() in ["7", "XP", "Vista"]:
                is_old_win = True
    
    if is_old_win:
        print("[*] Old Windows detected (Win7/XP), using native UI.")
        HAS_WEBVIEW = False
    else:
        HAS_WEBVIEW = True
except ImportError:
    HAS_WEBVIEW = False
WEBVIEW_WINDOW = None


def show_notification(title, message, msg_type="info"):
    """显示通知，优先使用 WebView，次之使用 Tkinter"""
    global WEBVIEW_WINDOW
    if WEBVIEW_WINDOW:
        try:
            # 逸出单引号
            safe_msg = message.replace("'", "\\'").replace("\\n", " ")
            WEBVIEW_WINDOW.evaluate_js(f"alert('{title}: {safe_msg}');")
            return
        except:
            pass
            
    if HAS_TKINTER:
        try:
            root = tk.Tk()
            root.withdraw()
            from tkinter import messagebox
            if msg_type == "error":
                messagebox.showerror(title, message)
            else:
                messagebox.showinfo(title, message)
            root.destroy()
        except:
            pass
    print(f"[{title}] {message}")
print(f"[*] aiortc available: {HAS_AIORTC}")
print(f"[*] webview available: {HAS_WEBVIEW}")
try:
    import tkinter as tk
    from tkinter import ttk
    HAS_TKINTER = True
except ImportError:
    HAS_TKINTER = False
from io import BytesIO



# Global module flags
HAS_WEBSOCKET = False
HAS_MSS = False
HAS_NUMPY = False
HAS_PSUTIL = False
HAS_PYAUDIO = False
HAS_PIL = False
HAS_PYAUTOGUI = False
HAS_INTERCEPTION = False
HAS_SERVICE = False
HAS_PYSTRAY = False

try:
    import websocket
    HAS_WEBSOCKET = True
except ImportError: pass

try:
    import pystray
    from pystray import MenuItem as item
    from PIL import Image, ImageDraw
    HAS_PYSTRAY = True
except ImportError: pass

try:
    import mss
    HAS_MSS = True
except ImportError: pass

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError: pass

try:
    import psutil
    HAS_PSUTIL = True
except ImportError: pass

try:
    from PIL import Image, ImageChops, ImageGrab
    HAS_PIL = True
except ImportError: pass

try:
    import pyautogui
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0
    pyautogui.MINIMUM_DURATION = 0
    HAS_PYAUTOGUI = True
except ImportError: pass

try:
    import dxcam
except (ImportError, OSError, Exception) as e:
    print(f"[*] DXCAM import failed: {e}. Falling back to mss/Pillow.")
    dxcam = None

try:
    import pyaudio
    HAS_PYAUDIO = True
except ImportError:
    HAS_PYAUDIO = False

# Client Version
CLIENT_VERSION = 2
CLIENT_VERSION_NAME = "1.0.2"

class FallbackCamera:
    def __init__(self):
        self.method = "mss"
        self.sct = None
        if HAS_MSS and HAS_NUMPY:
            try:
                import mss
                self.sct = mss.mss()
                print("[*] Fallback camera using mss")
            except Exception as e:
                print(f"[*] Fallback to mss failed: {e}. Using Pillow.")
                self.method = "pillow"
        else:
            print("[*] mss or numpy not available. Using Pillow.")
            self.method = "pillow"
    
    def grab(self):
        try:
            if self.method == "mss" and self.sct and HAS_NUMPY:
                # mss is much faster than Pillow
                monitor = self.sct.monitors[1] # Primary monitor
                sct_img = self.sct.grab(monitor)
                # Convert to numpy array (BGRA to RGB)
                return np.array(sct_img)[:, :, :3][:, :, ::-1]
            elif HAS_PIL:
                # Pillow ImageGrab fallback
                img = ImageGrab.grab()
                if HAS_NUMPY:
                    return np.array(img)
                return img # Return PIL image if numpy is missing
            return None
        except Exception as e:
            print(f"[-] Fallback grab error: {e}")
            return None
            
    def start(self):
        pass
        
    def stop(self):
        if self.sct:
            try:
                self.sct.close()
            except: pass
            self.sct = None

# Configuration
HOST = "${config.host}"
PORT = ${config.port}
PROTOCOL = "${config.protocol || 'ws'}"
REMARK = "${config.remark}"
RECONNECT_INTERVAL = ${config.reconnectInterval}
AUTO_START = "${config.autoStart}"
ENABLED_MODULES = [${modulesList.join(", ")}]
PLATFORM_MODE = "${config.platform}"
APP_URL = "${config.appUrl}"
ENCRYPTION_KEY = "${config.encryptionKey}"
SINGLE_INSTANCE = "True"
INSTALL_AS_SERVICE = ${config.installAsService ? "True" : "False"}
CURRENT_DIR = os.getcwd()
TRAY_ICON = None

def get_session_id():
    if platform.system() != "Windows": return 1
    try:
        import ctypes
        return ctypes.windll.kernel32.WTSGetActiveConsoleSessionId()
    except:
        return 1

def is_session_locked(session_id):
    """检查指定会话是否处于锁屏状态"""
    if platform.system() != "Windows": return False
    try:
        import ctypes
        from ctypes import wintypes
        
        WTS_CURRENT_SERVER_HANDLE = 0
        WTSSessionInfoEx = 25
        
        class WTSINFOEX_LEVEL1_W(ctypes.Structure):
            _fields_ = [
                ("SessionId", ctypes.c_ulong),
                ("SessionState", ctypes.c_ulong),
                ("SessionFlags", ctypes.c_ulong),
            ]

        class WTSINFOEXW(ctypes.Structure):
            _fields_ = [
                ("Level", ctypes.c_ulong),
                ("Data", WTSINFOEX_LEVEL1_W)
            ]
        
        ppBuffer = ctypes.c_void_p()
        pBytesReturned = ctypes.c_ulong()
        
        if ctypes.windll.wtsapi32.WTSQuerySessionInformationW(
            WTS_CURRENT_SERVER_HANDLE, int(session_id), 
            WTSSessionInfoEx, ctypes.byref(ppBuffer), ctypes.byref(pBytesReturned)
        ):
            pInfo = ctypes.cast(ppBuffer, ctypes.POINTER(WTSINFOEXW))
            # SessionFlags: 0 == connected, 1 == locked
            is_locked = pInfo.contents.Data.SessionFlags == 1
            ctypes.windll.wtsapi32.WTSFreeMemory(ppBuffer)
            return is_locked
    except Exception as e:
        # print(f"[-] is_session_locked error: {e}")
        pass
    return False

def set_window_icon(root):
    """Set the window icon from internal resources or the EXE itself."""
    try:
        if getattr(sys, 'frozen', False):
            # 1. Try internal bundled resource (_MEIPASS)
            meipass_dir = getattr(sys, '_MEIPASS', None)
            if meipass_dir:
                ico_path = os.path.join(meipass_dir, "icon.ico")
                if os.path.exists(ico_path):
                    root.iconbitmap(ico_path)
                    return True
            
            # 2. Fallback: Use the EXE's own embedded icon (the one set with --icon during build)
            try:
                root.iconbitmap(sys.executable)
                return True
            except:
                pass
        else:
            # Script mode: Try local icon.ico
            base_dir = os.path.dirname(os.path.abspath(__file__))
            ico_path = os.path.join(base_dir, "icon.ico")
            if os.path.exists(ico_path):
                root.iconbitmap(ico_path)
                return True
    except Exception as e:
        print(f"[-] Failed to set window icon: {e}")
    return False

# Unique Device ID and Password
def get_unique_id():
    global SYSTEM_AUTH_DIR
    # 0. Try to load from cache first (FAST)
    cache_dir = SYSTEM_AUTH_DIR
    id_file = os.path.join(cache_dir, "device.id")
    try:
        if os.path.exists(id_file):
            with open(id_file, "r") as f:
                cached_id = f.read().strip()
                if cached_id: return cached_id
    except: pass

    # Try to get a stable hardware ID from the system
    hardware_id = ""
    
    if platform.system() == "Windows":
        try:
            # 1. Try Disk Serial Number (Very stable across installs)
            cmd = "wmic diskdrive get serialnumber"
            output = subprocess.check_output(cmd, shell=True).decode().splitlines()
            serials = [line.strip() for line in output if line.strip() and "SerialNumber" not in line]
            if serials:
                hardware_id = serials[0]
        except:
            try:
                # 2. Try Motherboard UUID
                cmd = "wmic csproduct get uuid"
                output = subprocess.check_output(cmd, shell=True).decode().splitlines()
                if len(output) > 1:
                    hardware_id = output[1].strip()
            except:
                pass

    # Fallback to uuid.getnode()
    if not hardware_id or hardware_id.upper() in ["TO BE FILLED BY O.E.M.", "00000000-0000-0000-0000-000000000000"]:
        import uuid
        hardware_id = str(uuid.getnode())

    # Create a 9-digit numeric ID from the hardware ID
    hash_val = int(hashlib.md5(hardware_id.encode()).hexdigest(), 16)
    device_id = str(hash_val % 1000000000).zfill(9)
    # Format as 000 000 000 for display
    device_id_formatted = f"{device_id[:3]} {device_id[3:6]} {device_id[6:]}"
    
    # Save to cache
    try:
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir, exist_ok=True)
        with open(id_file, "w") as f:
            f.write(device_id_formatted)
    except: pass
    
    return device_id_formatted

DEVICE_ID = get_unique_id()
DEVICE_PASSWORD = "UNKNOWN" # Will be set by manage_password()

def xor_crypt(data, key):
    return bytes([b ^ key[i % len(key)] for i, b in enumerate(data)])

def manage_password():
    global DEVICE_PASSWORD
    
    # 1. Encryption Setup
    # Use ENCRYPTION_KEY to generate a 32-byte key stream via SHA256
    key_stream = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
    
    # 2. Storage Path
    auth_dir = SYSTEM_AUTH_DIR
    auth_file = os.path.join(auth_dir, "auth.dat")
    
    # 3. Try to load existing password first (Persistence)
    try:
        if os.path.exists(auth_file):
            with open(auth_file, "rb") as f:
                saved_encrypted = f.read()
                decrypted = xor_crypt(saved_encrypted, key_stream).decode()
                if len(decrypted) == 8:
                    DEVICE_PASSWORD = decrypted
                    print(f"[*] Using existing encrypted password from {auth_file}")
                    return
    except Exception as e:
        print(f"[*] Could not read existing password: {e}")

    # 4. Generate new 8-char uppercase alphanumeric password if none exists
    new_pwd = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    try:
        if not os.path.exists(auth_dir):
            os.makedirs(auth_dir, exist_ok=True)
            
        # Encrypt and write
        encrypted = xor_crypt(new_pwd.encode(), key_stream)
        with open(auth_file, "wb") as f:
            f.write(encrypted)
            
        # 5. Double check (Read back and verify)
        with open(auth_file, "rb") as f:
            saved_encrypted = f.read()
            decrypted = xor_crypt(saved_encrypted, key_stream).decode()
            
        if decrypted == new_pwd:
            DEVICE_PASSWORD = new_pwd
            print(f"[*] New password generated and encrypted at {auth_file}: {DEVICE_PASSWORD}")
        else:
            raise Exception("Verification failed")
            
    except Exception as e:
        print(f"[!] Warning: Failed to store password securely: {e}")
        DEVICE_PASSWORD = new_pwd # Fallback to memory-only

def manage_settings(action="load", key=None, value=None):
    global CLIENT_SETTINGS, SYSTEM_AUTH_DIR
    config_dir = SYSTEM_AUTH_DIR
    settings_file = os.path.join(config_dir, "settings.json")
    
    if action == "load":
        try:
            if os.path.exists(settings_file):
                with open(settings_file, "r") as f:
                    CLIENT_SETTINGS.update(json.load(f))
        except: pass
    elif action == "save":
        try:
            os.makedirs(config_dir, exist_ok=True)
            if key: CLIENT_SETTINGS[key] = value
            with open(settings_file, "w") as f:
                json.dump(CLIENT_SETTINGS, f)
        except: pass
    return CLIENT_SETTINGS

CLIENT_SETTINGS = {
    "autoStart": False,
    "trayIcon": True,
    "autoUpdate": True
}
manage_settings("load")


def manage_server_config():
    global HOST, PORT, PROTOCOL, SYSTEM_AUTH_DIR
    
    # Storage Path
    config_dir = SYSTEM_AUTH_DIR
    config_file = os.path.join(config_dir, "server.json")
    
    # 1. Try to load existing config
    try:
        if os.path.exists(config_file):
            with open(config_file, "r") as f:
                import json
                config = json.load(f)
                if "host" in config:
                    HOST = config["host"]
                if "port" in config:
                    PORT = config["port"]
                if "protocol" in config:
                    PROTOCOL = config["protocol"]
                print(f"[*] Loaded server config from {config_file}: {PROTOCOL}://{HOST}:{PORT}")
                return
    except Exception as e:
        print(f"[*] Could not read server config: {e}")

    # 2. Save current config if it doesn't exist (using defaults from template)
    try:
        if not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
        with open(config_file, "w") as f:
            import json
            json.dump({"host": HOST, "port": PORT, "protocol": PROTOCOL}, f)
    except Exception as e:
        print(f"[*] Could not save default server config: {e}")

print(f"[*] Device ID: {DEVICE_ID}")

# Global state for streaming
SERVER_CONNECTED = False
CLIENT_ROLE = "service"
STREAM_RUNNING = False
REINIT_CAMERA = False
IP_INFO_CACHE = {"publicIp": "N/A", "location": "N/A", "isp": "N/A"}

def update_ip_info_worker():
    global IP_INFO_CACHE
    while True:
        success = False
        
        # Source 1: Custom API (Prioritized)
        try:
            print("[*] Trying Source 1: rootdesk.cn...")
            import requests
            response = requests.get("https://rootdesk.cn/api/ip", timeout=5)
            data = response.json()
            if "ip" in data:
                ip_val = data["ip"]
                # Try to get more info using this IP from ip-api.com (optional but helpful)
                try:
                    detail_res = requests.get(f"http://ip-api.com/json/{ip_val}?lang=zh-CN", timeout=5)
                    detail_data = detail_res.json()
                    if detail_data.get("status") == "success":
                        isp = detail_data.get("isp", "Unknown")
                        isp_map = {"Chinanet": "中国电信", "China Telecom": "中国电信", "Unicom": "中国联通", "China Unicom": "中国联通", "Mobile": "中国移动", "China Mobile": "中国移动", "Tietong": "中国铁通"}
                        for k, v in isp_map.items():
                            if k.lower() in isp.lower():
                                isp = v
                                break
                        IP_INFO_CACHE = {
                            "publicIp": ip_val,
                            "location": f"{detail_data.get('country')} {detail_data.get('regionName')} {detail_data.get('city')}",
                            "isp": isp
                        }
                    else:
                        IP_INFO_CACHE = {"publicIp": ip_val, "location": "N/A", "isp": "N/A"}
                except:
                    IP_INFO_CACHE = {"publicIp": ip_val, "location": "N/A", "isp": "N/A"}
                success = True
        except: pass

        # Source 2: ip-api.com (Fallback)
        if not success:
            try:
                print("[*] Trying Source 2: ip-api.com...")
                import requests
                response = requests.get("http://ip-api.com/json/?lang=zh-CN", timeout=5)
                data = response.json()
                if data.get("status") == "success":
                    isp = data.get("isp", "Unknown")
                    isp_map = {"Chinanet": "中国电信", "China Telecom": "中国电信", "Unicom": "中国联通", "China Unicom": "中国联通", "Mobile": "中国移动", "China Mobile": "中国移动", "Tietong": "中国铁通"}
                    for k, v in isp_map.items():
                        if k.lower() in isp.lower():
                            isp = v
                            break
                    IP_INFO_CACHE = {
                        "publicIp": data.get("query"),
                        "location": f"{data.get('country')} {data.get('regionName')} {data.get('city')}",
                        "isp": isp
                    }
                    success = True
            except: pass

        if success:
            print(f"[+] IP Info Updated: {IP_INFO_CACHE['publicIp']} ({IP_INFO_CACHE['isp']})")
            time.sleep(3600) # Success, wait 1 hour
        else:
            print("[-] All IP info sources failed. Retrying in 5 minutes...")
            time.sleep(300) # Fail, retry sooner

# Start IP info worker
threading.Thread(target=update_ip_info_worker, daemon=True).start()

STREAM_CONFIG = {
    "mode": "screen", # screen, window
    "target_id": None,
    "quality": 50, 
    "scale": 0.5
}
STREAM_LOCK = threading.Lock()
WS_CLIENT = None
WS_LOCK = threading.Lock()
VIEWER_COUNT = 0
ROOT_WINDOW = None

def get_exe_icon():
    """从 EXE 获取图标"""
    # 1. 尝试从打包资源读取
    try:
        if getattr(sys, 'frozen', False):
            meipass_dir = getattr(sys, '_MEIPASS', None)
            if meipass_dir:
                ico_path = os.path.join(meipass_dir, "icon.ico")
                if os.path.exists(ico_path):
                    from PIL import Image
                    return Image.open(ico_path)
    except: pass

    # 2. 尝试从 EXE 提取
    if platform.system() != "Windows" or not getattr(sys, 'frozen', False):
        return None
        
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        shell32 = ctypes.windll.shell32
        gdi32 = ctypes.windll.gdi32
        
        h_icon = shell32.ExtractIconW(0, sys.executable, 0)
        if h_icon <= 1: return None
        
        hdc_screen = user32.GetDC(0)
        hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
        size = 32
        h_bmp = gdi32.CreateCompatibleBitmap(hdc_screen, size, size)
        h_old_bmp = gdi32.SelectObject(hdc_mem, h_bmp)
        user32.DrawIconEx(hdc_mem, 0, 0, h_icon, size, size, 0, 0, 3)
        
        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG), ("biHeight", wintypes.LONG),
                        ("biPlanes", wintypes.WORD), ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
                        ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG), ("biYPelsPerMeter", wintypes.LONG),
                        ("biClrUsed", wintypes.DWORD), ("biClrImportant", wintypes.DWORD)]
        class BITMAPINFO(ctypes.Structure):
            _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", wintypes.DWORD * 3)]

        bmi = BITMAPINFO()
        bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.bmiHeader.biWidth = size
        bmi.bmiHeader.biHeight = -size
        bmi.bmiHeader.biPlanes = 1
        bmi.bmiHeader.biBitCount = 32
        bmi.bmiHeader.biCompression = 0
        
        buffer = ctypes.create_string_buffer(size * size * 4)
        gdi32.GetDIBits(hdc_mem, h_bmp, 0, size, buffer, ctypes.byref(bmi), 0)
        from PIL import Image
        img = Image.frombuffer('RGBA', (size, size), buffer, 'raw', 'BGRA', 0, 1)
        img = img.convert('RGB')
        
        gdi32.SelectObject(hdc_mem, h_old_bmp)
        gdi32.DeleteObject(h_bmp)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(0, hdc_screen)
        user32.DestroyIcon(h_icon)
        return img
    except:
        return None

def create_tray_icon():
    global TRAY_ICON, ROOT_WINDOW, WEBVIEW_WINDOW
    try:
        if not HAS_PYSTRAY or TRAY_ICON:
            return
            
        print("[*] 正在创建系统托盘图标...")
        image = get_exe_icon()
        if not image:
            # Fallback to simple icon
            from PIL import Image, ImageDraw
            width = 64
            height = 64
            image = Image.new('RGB', (width, height), "blue")
            dc = ImageDraw.Draw(image)
            dc.rectangle((width // 4, height // 4, width * 3 // 4, height * 3 // 4), fill="white")

        def show_window(icon, item):
            if ROOT_WINDOW:
                try: ROOT_WINDOW.after(0, ROOT_WINDOW.deiconify); ROOT_WINDOW.after(0, ROOT_WINDOW.lift); ROOT_WINDOW.after(0, ROOT_WINDOW.focus_force)
                except: pass
            if WEBVIEW_WINDOW:
                try: WEBVIEW_WINDOW.show()
                except: pass
                
        def quit_window(icon, item):
            try:
                stop_service()
                icon.stop()
                if ROOT_WINDOW:
                    try: ROOT_WINDOW.after(0, ROOT_WINDOW.destroy)
                    except: pass
                if WEBVIEW_WINDOW:
                    try: WEBVIEW_WINDOW.destroy()
                    except: pass
            except: pass
            os._exit(0)

        menu = pystray.Menu(
            pystray.MenuItem('显示主界面', show_window, default=True),
            pystray.MenuItem('退出程序', quit_window)
        )
        TRAY_ICON = pystray.Icon("RootDesk", image, "RootDesk", menu)
        TRAY_ICON.run()
    except Exception as e:
        print(f"[-] 创建托盘图标失败: {e}")
        TRAY_ICON = None

def on_webview_closing():
    global WEBVIEW_WINDOW, TRAY_ICON
    should_tray = CLIENT_SETTINGS.get("trayIcon", True)
    if should_tray and HAS_PYSTRAY:
        try:
            WEBVIEW_WINDOW.hide()
            if not TRAY_ICON:
                threading.Thread(target=create_tray_icon, daemon=True).start()
            return False # Cancel close, just hide
        except:
            return True
    
    stop_service()
    return True

# WebRTC Globals
RTC_PC = None
RTC_DC = None
RTC_LOOP = None
RTC_CONFIG_FUTURE = None
RTC_CANDIDATE_QUEUE = []

async def get_turn_config():
    global RTC_CONFIG_FUTURE
    loop = asyncio.get_event_loop()
    RTC_CONFIG_FUTURE = loop.create_future()
    print("[*] 正在从服务器请求 TURN 配置...")
    safe_send(WS_CLIENT, json.dumps({
        "type": "get_turn_config",
        "deviceId": DEVICE_ID.replace(" ", ""),
        "password": DEVICE_PASSWORD
    }))
    try:
        encrypted_data = await asyncio.wait_for(RTC_CONFIG_FUTURE, timeout=5.0)
        if not encrypted_data:
            print("[*] 服务器返回的 TURN 配置为空")
            return None
        
        print("[*] 正在解密 TURN 配置...")
        # Decrypt using device password
        encrypted_bytes = base64.b64decode(encrypted_data)
        key = hashlib.sha256(DEVICE_PASSWORD.encode()).digest()
        
        decrypted_bytes = bytearray()
        for i in range(len(encrypted_bytes)):
            decrypted_bytes.append(encrypted_bytes[i] ^ key[i % len(key)])
            
        return json.loads(decrypted_bytes.decode('utf-8'))
    except asyncio.TimeoutError:
        print("[-] 获取 TURN 配置超时")
        return None
    except Exception as e:
        print(f"[-] 获取/解密 TURN 配置出错: {e}")
        return None
    finally:
        RTC_CONFIG_FUTURE = None

def start_rtc_loop():
    global RTC_LOOP
    RTC_LOOP = asyncio.new_event_loop()
    asyncio.set_event_loop(RTC_LOOP)
    RTC_LOOP.run_forever()

if HAS_AIORTC:
    threading.Thread(target=start_rtc_loop, daemon=True).start()

def safe_send(ws, data, opcode=None):
    # Try WebRTC DataChannel first for large binary data or screen frames
    if RTC_DC and RTC_DC.readyState == "open":
        try:
            if RTC_LOOP:
                RTC_LOOP.call_soon_threadsafe(RTC_DC.send, data)
                return True
        except Exception as e:
            print(f"[-] WebRTC send error: {e}")
            # Fallback to WS
            
    if not ws or not ws.sock or not ws.sock.connected:
        return False
    try:
        with WS_LOCK:
            if opcode:
                ws.send(data, opcode=opcode)
            else:
                ws.send(data)
        return True
    except Exception as e:
        print(f"[-] Safe send error: {e}")
        return False

async def setup_webrtc(offer_sdp):
    global RTC_PC, RTC_DC, RTC_CANDIDATE_QUEUE
    print(f"[*] WebRTC 初始化开始 (SDP 长度: {len(offer_sdp)})")
    if RTC_PC:
        print("[*] 正在关闭现有的 PeerConnection...")
        await RTC_PC.close()
    
    # Clear old candidate queue for new connection
    RTC_CANDIDATE_QUEUE = []
    
    # Fetch dynamic TURN config
    print("[*] 正在获取动态 TURN 配置...")
    dynamic_ice_servers = await get_turn_config()
    
    # Create ICE servers
    ice_servers = []
    
    if dynamic_ice_servers:
        print("[*] 使用动态 TURN 服务器配置")
        for server in dynamic_ice_servers:
            try:
                s = RTCIceServer(
                    urls=server.get("urls"),
                    username=server.get("username"),
                    credential=server.get("credential")
                )
                if isinstance(s, dict):
                    class ServerWrapper:
                        def __init__(self, d):
                            self.urls = d.get('urls')
                            self.username = d.get('username')
                            self.credential = d.get('credential')
                    ice_servers.append(ServerWrapper(s))
                else:
                    ice_servers.append(s)
            except Exception as e:
                print(f"[*] 从动态配置创建 RTCIceServer 失败: {e}")
    
    # Add default STUN as fallback
    ice_servers.append(RTCIceServer(urls=["stun:stun.l.google.com:19302"]))
    
    # Create the configuration object
    try:
        rtc_config = RTCConfiguration(iceServers=ice_servers)
    except Exception as e:
        print(f"[*] RTCConfiguration 实例化失败: {e}. 切换到手动包装。")
        class ManualConfig:
            def __init__(self, iceServers):
                self.iceServers = iceServers
        rtc_config = ManualConfig(iceServers=ice_servers)

    if isinstance(rtc_config, dict):
        class ConfigWrapper:
            def __init__(self, d):
                for k, v in d.items():
                    setattr(self, k, v)
                if not hasattr(self, 'iceServers'):
                    self.iceServers = d.get('iceServers', [])
        rtc_config = ConfigWrapper(rtc_config)
    
    print(f"[*] 正在初始化 RTCPeerConnection (配置了 {len(ice_servers)} 个服务器)")
    try:
        RTC_PC = RTCPeerConnection(rtc_config)
    except Exception as e:
        print(f"[-] RTCPeerConnection 初始化失败: {e}")
        return

    # Process any candidates that arrived while we were fetching TURN config
    if RTC_CANDIDATE_QUEUE:
        print(f"[*] 正在处理队列中等待的 {len(RTC_CANDIDATE_QUEUE)} 个 ICE Candidate")
        for cand in RTC_CANDIDATE_QUEUE:
            await add_ice_candidate(cand)
        RTC_CANDIDATE_QUEUE = []

    @RTC_PC.on("icegatheringstatechange")
    def on_icegatheringstatechange():
        print(f"[*] WebRTC ICE 收集状态: {RTC_PC.iceGatheringState}")

    @RTC_PC.on("datachannel")
    def on_datachannel(channel):
        global RTC_DC
        RTC_DC = channel
        print("[*] WebRTC 数据通道 (DataChannel) 已建立")
        
        @channel.on("message")
        def on_message(message):
            try:
                if isinstance(message, str):
                    if WS_CLIENT and hasattr(WS_CLIENT, 'on_message') and WS_CLIENT.on_message:
                        WS_CLIENT.on_message(WS_CLIENT, message)
            except Exception as e:
                print(f"[-] 数据通道消息处理出错: {e}")

    @RTC_PC.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        print(f"[*] WebRTC ICE 连接状态: {RTC_PC.iceConnectionState}")
        if RTC_PC.iceConnectionState in ["failed", "closed"]:
            global RTC_DC
            RTC_DC = None

    @RTC_PC.on("icecandidate")
    def on_icecandidate(candidate):
        if candidate:
            print(f"[*] 客户端生成了 ICE Candidate: {candidate.candidate[:30]}...")
            safe_send(WS_CLIENT, json.dumps({
                "type": "webrtc_ice_candidate",
                "deviceId": DEVICE_ID.replace(" ", ""),
                "candidate": {
                    "candidate": candidate.candidate,
                    "sdpMid": candidate.sdpMid,
                    "sdpMLineIndex": candidate.sdpMLineIndex
                }
            }))
        else:
            print("[*] 客户端 ICE Candidate 收集完成") 

    try:
        offer = RTCSessionDescription(sdp=offer_sdp, type="offer")
        print("[*] 正在设置远程描述 (Offer)...")
        await RTC_PC.setRemoteDescription(offer)
        
        print("[*] 正在创建应答 (Answer)...")
        answer = await RTC_PC.createAnswer()
        
        print(f"[*] 正在设置本地描述 (Answer)...")
        await RTC_PC.setLocalDescription(answer)
        print("[+] WebRTC Answer 已准备就绪并发送。")
        
        # Send answer to server via WS
        safe_send(WS_CLIENT, json.dumps({
            "type": "webrtc_answer",
            "deviceId": DEVICE_ID.replace(" ", ""),
            "sdp": RTC_PC.localDescription.sdp
        }))
    except Exception as e:
        print(f"[-] WebRTC 设置过程出错: {e}")
        import traceback
        traceback.print_exc()

async def add_ice_candidate(candidate_dict):
    global RTC_PC, RTC_CANDIDATE_QUEUE
    if not RTC_PC:
        if RTC_CANDIDATE_QUEUE is not None:
             print("[*] 正在将 ICE Candidate 加入待处理队列...")
             RTC_CANDIDATE_QUEUE.append(candidate_dict)
        return
        
    try:
        from aiortc.sdp import candidate_from_sdp
        candidate_str = candidate_dict.get("candidate")
        if candidate_str:
            print(f"[*] 正在添加 ICE Candidate: {candidate_str[:30]}...")
            if candidate_str.startswith("candidate:"):
                candidate_str = candidate_str[10:]
            
            c = candidate_from_sdp(candidate_str)
            
            candidate = RTCIceCandidate(
                component=c.component,
                foundation=c.foundation,
                ip=c.ip,
                port=c.port,
                priority=c.priority,
                protocol=c.protocol,
                type=c.type,
                sdpMid=candidate_dict.get("sdpMid"),
                sdpMLineIndex=candidate_dict.get("sdpMLineIndex")
            )
            
            await RTC_PC.addIceCandidate(candidate)
            print("[+] ICE Candidate 添加成功")
    except Exception as e:
        print(f"[-] 添加 ICE Candidate 出错: {e}")
        import traceback
        traceback.print_exc()

def sync_auth_info(ws):
    if not ws or not SERVER_CONNECTED: return
    print("[*] Syncing auth info with server...")
    safe_send(ws, json.dumps({
        "type": "update_password",
        "deviceId": DEVICE_ID,
        "data": {
            "password": DEVICE_PASSWORD
        }
    }))

# File transfer state
ACTIVE_TRANSFERS = {} # transferId -> {file, total_size, current_size, window, progress_bar}

# Windows Input Structures
if platform.system() == "Windows":
    import ctypes
    from ctypes import wintypes
    
    # Enable High DPI awareness to prevent UI squeezing/blurring on scaled displays
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1) # PROCESS_SYSTEM_DPI_AWARE
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD),
                    ("wScan", wintypes.WORD),
                    ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD),
                    ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [("dx", ctypes.c_long),
                    ("dy", ctypes.c_long),
                    ("mouseData", wintypes.DWORD),
                    ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD),
                    ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

    class HARDWAREINPUT(ctypes.Structure):
        _fields_ = [("uMsg", wintypes.DWORD),
                    ("wParamL", wintypes.WORD),
                    ("wParamH", wintypes.WORD)]

    class INPUT_UNION(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT),
                    ("mi", MOUSEINPUT),
                    ("hi", HARDWAREINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD),
                    ("u", INPUT_UNION)]

    INPUT_MOUSE = 0
    INPUT_KEYBOARD = 1
    INPUT_HARDWARE = 2
    
    KEYEVENTF_UNICODE = 0x0004
    KEYEVENTF_KEYUP = 0x0002
    KEYEVENTF_SCANCODE = 0x0008

    VK_MAP = {
        "backspace": 0x08, "tab": 0x09, "enter": 0x0D, "shift": 0x10, "ctrl": 0x11,
        "alt": 0x12, "pause": 0x13, "capslock": 0x14, "esc": 0x1B, "space": 0x20,
        "pageup": 0x21, "pagedown": 0x22, "end": 0x23, "home": 0x24,
        "left": 0x25, "up": 0x26, "right": 0x27, "down": 0x28,
        "insert": 0x2D, "delete": 0x2E, "win": 0x5B,
        "f1": 0x70, "f2": 0x71, "f3": 0x72, "f4": 0x73, "f5": 0x74, "f6": 0x75,
        "f7": 0x76, "f8": 0x77, "f9": 0x78, "f10": 0x79, "f11": 0x7A, "f12": 0x7B,
    }

    def get_vk(key):
        if key in VK_MAP: return VK_MAP[key]
        if len(key) == 1:
            res = ctypes.windll.user32.VkKeyScanW(ord(key))
            if res != -1: return res & 0xFF
        return None

    def get_session_and_desktop():
        try:
            # 1. Get active session ID
            active_session_id = ctypes.windll.kernel32.WTSGetActiveConsoleSessionId()
            
            # 2. Get current input desktop name
            h_desk = ctypes.windll.user32.OpenInputDesktop(0, False, 0)
            desktop_name = "unknown"
            
            if h_desk:
                name_buffer = ctypes.create_unicode_buffer(256)
                ctypes.windll.user32.GetUserObjectInformationW(h_desk, 2, name_buffer, ctypes.sizeof(name_buffer), None)
                desktop_name = name_buffer.value.lower()
                
                # Set thread desktop to allow capturing lock screen
                ctypes.windll.user32.SetThreadDesktop(h_desk)
                
                ctypes.windll.user32.CloseDesktop(h_desk)
            else:
                desktop_name = "access_denied"

            return active_session_id, desktop_name
        except:
            return 0, "error"

    def send_key_input(vk, is_up=False):
        user32 = ctypes.windll.user32
        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp.u.ki.wVk = vk
        inp.u.ki.wScan = user32.MapVirtualKeyW(vk, 0)
        inp.u.ki.dwFlags = KEYEVENTF_KEYUP if is_up else 0
        if inp.u.ki.wScan:
            inp.u.ki.dwFlags |= KEYEVENTF_SCANCODE
        inp.u.ki.time = 0
        inp.u.ki.dwExtraInfo = None
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(inp))
    
    def send_key_press(vk):
        send_key_input(vk, False)
        send_key_input(vk, True)

    MOUSEEVENTF_MOVE = 0x0001
    MOUSEEVENTF_LEFTDOWN = 0x0002
    MOUSEEVENTF_LEFTUP = 0x0004
    MOUSEEVENTF_RIGHTDOWN = 0x0008
    MOUSEEVENTF_RIGHTUP = 0x0010
    MOUSEEVENTF_MIDDLEDOWN = 0x0020
    MOUSEEVENTF_MIDDLEUP = 0x0040
    MOUSEEVENTF_ABSOLUTE = 0x8000
    MOUSEEVENTF_WHEEL = 0x0800

    # Interception Driver Setup
    ic = None
    ic_context = None

 
    def is_admin():
        try:
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except:
            return False

    def is_system():
        try:
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
            res = subprocess.run(
                ["whoami"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                startupinfo=startupinfo,
                encoding="gbk",
                errors="ignore"
            )
            return "nt authority\\system" in res.stdout.lower()
        except:
            return False

    def elevate_process():
        """尝试以管理员权限重启当前程序"""
        if is_admin(): return True
        try:
            import ctypes
            import sys
            # 使用 ShellExecuteEx 以 runas 动词启动
            # 这样会触发 UAC 弹窗
            script = os.path.abspath(sys.argv[0])
            params = " ".join(sys.argv[1:])
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, f'"{script}" {params}', None, 1)
            if ret > 32:
                sys.exit(0) # 成功启动新进程，退出当前进程
            return False
        except Exception as e:
            print(f"[-] Elevation failed: {e}")
            return False

    def check_process_running(process_name):
        """Check if there is any running process that contains the given name."""
        try:
            for proc in psutil.process_iter(['name']):
                if process_name.lower() in proc.info['name'].lower():
                    return True
        except:
            pass
        return False

    def kill_process_by_name(process_name):
        """Kill all processes with the given name."""
        try:
            for proc in psutil.process_iter(['name']):
                if process_name.lower() in proc.info['name'].lower():
                    proc.kill()
        except:
            pass

    def check_service_installed():
        if platform.system() != "Windows": return True
        
        service_name = "RootDeskService"
        
        # 方案 1: 通过注册表检测是否存在该服务/任务 (最准)
        import winreg
        paths = [
            # 检查系统服务路径
            fr"SYSTEM\\CurrentControlSet\\Services\\{service_name}",
            # 检查计划任务路径
            fr"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\TaskCache\\Tree\\{service_name}"
        ]
        
        for path in paths:
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path, 0, winreg.KEY_READ)
                winreg.CloseKey(key)
                return True # 只要找到任何一个路径，说明已安装
            except WindowsError:
                continue

        # 方案 2: 兜底方案 - 检查自启动注册表项
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, winreg.KEY_READ)
            winreg.QueryValueEx(key, "RootDeskClient")
            winreg.CloseKey(key)
            return True
        except WindowsError:
            pass

        return False

    def release_resources():
        """Extract bundled library files to the local directory if they don't exist."""
        if not getattr(sys, 'frozen', False):
            return
            
        meipass_dir = getattr(sys, '_MEIPASS', None)
        if not meipass_dir:
            return
            
        base_dir = os.path.dirname(sys.executable)
        
        # List of critical library files to ensure are present locally
        resources = [
            "library/PsExec.exe",
            "library/install-interception.exe",
            "library/x64/interception.dll",
            "library/x86/interception.dll",
            "library/win64/nssm.exe",
            "library/win32/nssm.exe"
        ]
        
        for rel_path in resources:
            source = os.path.join(meipass_dir, rel_path)
            target = os.path.join(base_dir, rel_path)
            
            # If target doesn't exist but source does, copy it
            if os.path.exists(source) and not os.path.exists(target):
                try:
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    shutil.copy2(source, target)
                    print(f"[*] Extracted {rel_path} to local directory")
                except Exception as e:
                    print(f"[-] Failed to extract {rel_path}: {e}")

    HAS_SERVICE = check_service_installed()

    # Determine if we should show the service warning
    def should_show_service_warning():
        if platform.system() != "Windows": return False
        # If not admin, we show "Need Admin" warning instead of "Missing Service"
        if not is_admin(): return False
        # If admin and service is missing, show warning
        return not HAS_SERVICE

    SHOW_SERVICE_WARNING = should_show_service_warning()

    try:
        # Detect architecture and find correct DLL path
        is_64bit = sys.maxsize > 2**32
        
        # Correctly get the base directory even if frozen with PyInstaller
        if getattr(sys, 'frozen', False):
            base_exe = sys.executable
            # PyInstaller creates a temporary folder and stores path in _MEIPASS
            meipass_dir = getattr(sys, '_MEIPASS', os.path.dirname(base_exe))
            base_dir = os.path.dirname(base_exe)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            meipass_dir = base_dir
        
        # Priority paths: Look in actual EXE directory first, then bundled resources
        if is_64bit:
            possible_paths = [
                os.path.join(base_dir, "library", "x64", "interception.dll"),
                os.path.join(base_dir, "interception.dll"),
                os.path.join(meipass_dir, "library", "x64", "interception.dll")
            ]
        else:
            possible_paths = [
                os.path.join(base_dir, "library", "x86", "interception.dll"),
                os.path.join(base_dir, "interception_x86.dll"),
                os.path.join(base_dir, "interception.dll"),
                os.path.join(meipass_dir, "library", "x86", "interception.dll")
            ]
            
        dll_path = None
        for path in possible_paths:
            if os.path.exists(path):
                dll_path = path
                break
                
        if dll_path:
            try:
                ic = ctypes.WinDLL(dll_path)
                print(f"[+] Loading Interception driver from: {dll_path}")
            except OSError as e:
                print(f"[-] Error loading Interception DLL: {e}")
                if "193" in str(e):
                    print(f"[*] Architecture mismatch: Python is {'64' if is_64bit else '32'}-bit, but DLL is different.")
                raise e
            
            if ic:
                class MouseStroke(ctypes.Structure):
                    _fields_ = [
                        ("state", ctypes.c_ushort),
                        ("flags", ctypes.c_ushort),
                        ("rolling", ctypes.c_short),
                        ("x", ctypes.c_int),
                        ("y", ctypes.c_int),
                        ("information", ctypes.c_uint)
                    ]
                    
                class KeyStroke(ctypes.Structure):
                    _fields_ = [
                        ("code", ctypes.c_ushort),
                        ("state", ctypes.c_ushort),
                        ("information", ctypes.c_uint)
                    ]
                    
                INTERCEPTION_MOUSE_LEFT_BUTTON_DOWN = 0x001
                INTERCEPTION_MOUSE_LEFT_BUTTON_UP   = 0x002
                INTERCEPTION_MOUSE_RIGHT_BUTTON_DOWN = 0x004
                INTERCEPTION_MOUSE_RIGHT_BUTTON_UP   = 0x008
                INTERCEPTION_MOUSE_MIDDLE_BUTTON_DOWN = 0x010
                INTERCEPTION_MOUSE_MIDDLE_BUTTON_UP   = 0x020
                INTERCEPTION_MOUSE_WHEEL            = 0x400
                
                INTERCEPTION_MOUSE_MOVE_RELATIVE    = 0x000
                INTERCEPTION_MOUSE_MOVE_ABSOLUTE    = 0x001
                
                INTERCEPTION_KEY_DOWN = 0x00
                INTERCEPTION_KEY_UP = 0x01
                
                ic.interception_create_context.restype = ctypes.c_void_p
                ic.interception_destroy_context.argtypes = [ctypes.c_void_p]
                ic.interception_set_filter.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ushort]
                ic.interception_wait.argtypes = [ctypes.c_void_p]
                ic.interception_wait.restype = ctypes.c_int
                ic.interception_receive.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint]
                ic.interception_send.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint]
                ic.interception_is_keyboard.argtypes = [ctypes.c_int]
                ic.interception_is_keyboard.restype = ctypes.c_int
                ic.interception_is_mouse.argtypes = [ctypes.c_int]
                ic.interception_is_mouse.restype = ctypes.c_int
                
                ic_context = ic.interception_create_context()
                if ic_context:
                    HAS_INTERCEPTION = True
                    print(f"[+] Interception driver loaded successfully (Context: {ic_context})")
                else:
                    print("[-] Failed to create Interception context. Driver might not be installed or requires reboot.")
        else:
            print("[-] Interception DLL not found. Control will be disabled.")
    except Exception as e:
        print(f"[-] Interception initialization error: {e}")

    def check_single_instance(is_ui=False, check_only=False):
        """使用命名互斥体确保单实例运行 (Windows 专用)"""
        if not SINGLE_INSTANCE: return True
        if platform.system() != "Windows": return True
        
        try:
            import ctypes
            from ctypes import wintypes
            
            # 使用 Device ID 生成唯一的互斥体名称 (Global\ 前缀确保跨会话唯一)
            # 注意：Python 中 "Global\\" 产生的字符串是 "Global\"，这是 Windows 要求的标准格式 必须要使用rf 否则报错 不要删掉
            prefix = "RootDeskUI_" if is_ui else "RootDeskRemote_"
            scope = "Local\\" if is_ui else \\"Global"
            mutex_name = f"{scope}{prefix}" + DEVICE_ID.replace(' ', '')
            
            kernel32 = ctypes.windll.kernel32
            mutex = kernel32.CreateMutexW(None, False, mutex_name)
            last_error = kernel32.GetLastError()
            
            if last_error == 183: # ERROR_ALREADY_EXISTS
                if not check_only:
                    print(f"[!] Another {'UI ' if is_ui else ''}instance is already running. Exiting.")
                return False
                
            if check_only:
                # If we are only checking, we should close the handle we just created
                kernel32.CloseHandle(mutex)
                return True

            # 保持互斥体引用，防止被垃圾回收
            if is_ui:
                global _ui_instance_mutex
                _ui_instance_mutex = mutex
            else:
                global _instance_mutex
                _instance_mutex = mutex
            return True
        except Exception as e:
            print(f"[-] Single instance check error: {e}")
            return True

    def release_single_instance(is_ui=False):
        """释放单实例互斥体"""
        if not SINGLE_INSTANCE: return
        if platform.system() != "Windows": return
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            if is_ui:
                global _ui_instance_mutex
                if '_ui_instance_mutex' in globals() and _ui_instance_mutex:
                    kernel32.CloseHandle(_ui_instance_mutex)
                    _ui_instance_mutex = None
            else:
                global _instance_mutex
                if '_instance_mutex' in globals() and _instance_mutex:
                    kernel32.CloseHandle(_instance_mutex)
                    _instance_mutex = None
        except Exception as e:
            print(f"[-] Release single instance error: {e}")

    def become_interactive():
        """尝试将当前进程附加到活动交互式桌面 (支持登录界面和用户桌面切换)"""
        if platform.system() != "Windows": return
        try:
            import ctypes
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            
            # 获取当前活动控制台会话 ID
            WTSGetActiveConsoleSessionId = kernel32.WTSGetActiveConsoleSessionId
            WTSGetActiveConsoleSessionId.restype = ctypes.c_ulong
            active_session_id = WTSGetActiveConsoleSessionId()
            
            # 1. 附加到交互式窗口站 WinSta0
            h_winsta = user32.OpenWindowStationW("WinSta0", False, 0x37FFFF)
            if h_winsta:
                user32.SetProcessWindowStation(h_winsta)
                
            # 2. 尝试附加到当前的输入桌面 (这是最准确的活动桌面)
            h_desk = user32.OpenInputDesktop(0, False, 0x1FF)
            if h_desk:
                user32.SetThreadDesktop(h_desk)
                user32.CloseDesktop(h_desk)
            else:
                # 如果 OpenInputDesktop 失败，尝试遍历已知桌面
                # 在 Session 0 中运行的服务通常需要手动指定桌面
                for desk_name in ["Default", "Winlogon", "ScreenSaver"]:
                    h_desk = user32.OpenDesktopW(desk_name, 0, False, 0x1FF)
                    if h_desk:
                        user32.SetThreadDesktop(h_desk)
                        user32.CloseDesktop(h_desk)
                        break
        except:
            pass

    def is_process_running(process_name):
        """检查进程是否正在运行 (排除当前进程和监控进程)"""
        try:
            import psutil
            current_pid = os.getpid()
            for proc in psutil.process_iter(['name', 'cmdline']):
                try:
                    if process_name.lower() in proc.info['name'].lower():
                        if proc.pid != current_pid:
                            # 如果是监控进程，则跳过
                            cmdline = proc.info.get('cmdline') or []
                            if "--monitor" in " ".join(cmdline):
                                continue
                            return True
                except:
                    continue
        except:
            pass
        return False

    def fix_psexec_env():
        """
        通过管理员权限修改注册表并启动服务，确保 PsExec 所需的 ADMIN$ 共享可用。
        """
        print("[*] Checking and fixing PsExec environment...")
        
        commands = [
            # 1. 允许本地账户通过网络访问 (解决“拒绝访问”和“网络名错误”)
            ['reg', 'add', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System', '/v', 'LocalAccountTokenFilterPolicy', '/t', 'REG_DWORD', '/d', '1', '/f'],
            
            # 2. 开启工作站默认管理共享 (确保 ADMIN$ 会被自动创建)
            ['reg', 'add', 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters', '/v', 'AutoShareWks', '/t', 'REG_DWORD', '/d', '1', '/f'],
            
            # 3. 设置 Server 服务为自动启动并立即启动它
            ['sc', 'config', 'lanmanserver', 'start=', 'auto'],
            ['net', 'start', 'lanmanserver']
        ]

        for cmd in commands:
            try:
                # 使用 shell=True 或者直接传列表，这里推荐直接传列表更安全
                # capture_output=True 保证用户看不到黑窗口闪过
                subprocess.run(cmd, capture_output=True, text=True)
            except Exception as e:
                print(f"[!] Warning during env fix: {cmd[0]} failed: {e}")

        # 4. 最后尝试强制开启 ADMIN$ 共享 (如果上步启动服务后还没自动生成)
        try:
            subprocess.run(['net', 'share', 'ADMIN$'], capture_output=True)
        except:
            pass

        print("[+] Environment check completed.")

    def service_monitor_loop():
        #后台服务监控逻辑: 只在启动时运行一次 UI，然后保持进程存活 
        print("[*] Guardian Service started. Launching UI via PsExec...")

        # 1. 确定路径
        base_dir = os.path.dirname(os.path.abspath(__file__))
        psexec_path = os.path.join(base_dir, "library", "PsExec.exe")
        final_exe_path = sys.executable

        # --- 执行环境修复 ---
        fix_psexec_env()
        # ------------------

        # 2. 执行启动 UI 的逻辑 (确保只在这里运行一次)
        try:
            # PsExec 参数: /accepteula -i 1 (Session 1) -s (System) -d (不等待)
            # 加上 --monitor 参数防止 UI 进程再次尝试安装服务
            cmd = [psexec_path, "/accepteula", "-i", "1", "-s", "-d", final_exe_path, "--monitor"]
            subprocess.run(cmd, capture_output=True)
            print("[+] UI launch command sent via PsExec.")
        except Exception as e:
            print(f"[-] Failed to launch UI: {e}")

        # 3. 关键改动：进入无限循环，防止进程退出导致 NSSM 重启
        print("[*] Guardian Service is now idle (maintaining process).")
        while True:
            time.sleep(3600)  # 每小时唤醒一次，基本不占 CPU


    def install_windows_service():
        global HAS_SERVICE
        try:
            import shutil
            # 确定程序路径
            if getattr(sys, 'frozen', False):
                src_exe = sys.executable
                base_dir = os.path.dirname(sys.executable)
                current_exe_name = os.path.basename(sys.executable)
            else:
                src_exe = sys.executable
                base_dir = os.path.dirname(os.path.abspath(__file__))
                current_exe_name = "python.exe"
            
            # 使用当前运行目录作为安装路径
            install_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))
            
            target_exe = os.path.join(install_dir, current_exe_name)
            
            # 1. 复制程序和库到永久目录 (已移除: 直接在当前目录运行)
            if getattr(sys, 'frozen', False):
                print(f"[*] Running from: {install_dir}")
                
                src_lib = os.path.join(base_dir, "library")
                dst_lib = os.path.join(install_dir, "library")
                # 确保库文件存在
                if not os.path.exists(dst_lib) and os.path.exists(src_lib):
                    print(f"[*] Copying library to: {dst_lib}")
                    try: shutil.copytree(src_lib, dst_lib)
                    except Exception as e: print(f"[-] Copy library error: {e}")
            
            # 使用当前目录中的路径进行后续操作
            final_exe_path = target_exe if getattr(sys, 'frozen', False) else f'"{sys.executable}" "{os.path.abspath(__file__)}"'
            final_base_dir = install_dir if getattr(sys, 'frozen', False) else base_dir

            task_name = "RootDeskGuardian"
            service_name = "RootDeskService"
            
            # 3. 安装后台服务
            is_64bit = sys.maxsize > 2**32
            nssm_path = os.path.join(final_base_dir, "library", "win64" if is_64bit else "win32", "nssm.exe")
            
            if os.path.exists(nssm_path):
                print(f"[*] Installing service via NSSM: {nssm_path}")
                # 彻底清理现有服务
                subprocess.run(['sc', 'stop', service_name], capture_output=True)
                subprocess.run(['sc', 'delete', service_name], capture_output=True)
                subprocess.run([nssm_path, 'stop', service_name], capture_output=True)
                subprocess.run([nssm_path, 'remove', service_name, 'confirm'], capture_output=True)
                
                # 安装服务，参数为 --service-monitor
                install_cmd = [nssm_path, 'install', service_name, final_exe_path, '--service-monitor']
                res = subprocess.run(install_cmd, capture_output=True)
                if res.returncode == 0:
                    subprocess.run([nssm_path, 'set', service_name, 'Description', 'RootDesk Remote Guardian Service'], capture_output=True)
                    subprocess.run([nssm_path, 'set', service_name, 'AppDirectory', os.path.dirname(final_exe_path)], capture_output=True)
                    start_res = subprocess.run([nssm_path, 'start', service_name], capture_output=True)
                    if start_res.returncode != 0:
                        err_out = start_res.stderr.decode('gbk', 'ignore')
                        return False, f"服务启动失败 (可能被安全软件拦截): {err_out}"
                    
                    print(f"[+] Guardian Service installed and started.")
                    HAS_SERVICE = True
                    return True, "安装成功"
                else:
                    err_out = res.stderr.decode('gbk', 'ignore')
                    return False, f"NSSM 安装失败 (可能被 360 等拦截): {err_out}"
            else:
                return False, f"找不到 NSSM 工具: {nssm_path}"
        except Exception as e:
            print(f"[-] Installation error: {e}")
            return False, str(e)

            
    def uninstall_windows_service():
        global HAS_SERVICE
        try:
            task_name = "RootDeskGuardian"
            service_name = "RootDeskService"
            
            # 1. Delete scheduled task
            subprocess.run(['schtasks', '/delete', '/tn', task_name, '/f'], capture_output=True)
            
            # 2. Remove NSSM service
            base_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))
            is_64bit = sys.maxsize > 2**32
            nssm_path = os.path.join(base_dir, "library", "win64" if is_64bit else "win32", "nssm.exe")
            
            if os.path.exists(nssm_path):
                print(f"[*] Uninstalling service via NSSM: {nssm_path}")
                subprocess.run([nssm_path, 'stop', service_name], capture_output=True)
                subprocess.run([nssm_path, 'remove', service_name, 'confirm'], capture_output=True)
            
            # 始终尝试使用 sc.exe 进行兜底清理
            subprocess.run(['sc', 'stop', service_name], capture_output=True)
            subprocess.run(['sc', 'delete', service_name], capture_output=True)
            print("[+] Service removed successfully.")
                
            HAS_SERVICE = False
            return True
        except Exception as e:
            print(f"[-] Uninstallation error: {e}")
            return False

    def stop_service():
        """停止后台服务"""
        if platform.system() != "Windows": return
        try:
            service_name = "RootDeskService"
            # 优先使用 sc stop
            subprocess.run(['sc', 'stop', service_name], capture_output=True)
            
            # 尝试通过 nssm 停止 (如果存在)
            base_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))
            is_64bit = sys.maxsize > 2**32
            nssm_path = os.path.join(base_dir, "library", "win64" if is_64bit else "win32", "nssm.exe")
            if os.path.exists(nssm_path):
                subprocess.run([nssm_path, 'stop', service_name], capture_output=True)
            print("[*] 后台服务已停止")
        except:
            pass

    # Auto-install Interception driver if missing
    def install_interception_driver(silent=False):
        global HAS_SERVICE, HAS_INTERCEPTION
        try:
            if not is_admin():
                if not silent:
                    show_notification("权限不足", "安装驱动及服务需要管理员权限。请右键点击程序并选择'以管理员身份运行'。", "error")
                return False, "需要管理员权限"

            base_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))
            installer_path = os.path.join(base_dir, "library/install-interception.exe")

            # 1. Install Service
            print("[*] Installing/Re-registering Service...")
            service_success, service_msg = install_windows_service()

            # 2. Install Driver
            driver_success = True
            driver_msg = "安装成功"
            if os.path.exists(installer_path):
                print(f"[*] Running installer: {installer_path} /install")
                proc = subprocess.run([installer_path, "/install"], shell=True, capture_output=True)
                driver_success = (proc.returncode == 0)
                if not driver_success:
                    driver_msg = proc.stderr.decode('gbk', 'ignore') if proc.stderr else "未知错误"
            else:
                if not HAS_INTERCEPTION:
                    driver_success = False
                    driver_msg = "找不到安装程序"

            # Refresh global status for UI
            HAS_SERVICE = check_service_installed()
            
            if not silent:
                from tkinter import messagebox
                if not service_success and not driver_success:
                    messagebox.showerror("安装失败", f"驱动安装失败 ({driver_msg}) 和服务注册失败 ({service_msg})，请检查杀毒软件拦截。")
                else:
                    msg = "驱动与服务安装完成" if not HAS_INTERCEPTION and not HAS_SERVICE else ("驱动安装完成" if not HAS_INTERCEPTION else "服务注册完成")
                    if messagebox.askyesno("完成", f"{msg}，系统需要重启才能生效。现在重启吗？"):
                        os.system("shutdown /r /t 0")
            
            return (service_success or driver_success), f"服务: {service_msg}, 驱动: {driver_msg}"
        except Exception as e:
            if not silent:
                from tkinter import messagebox
                messagebox.showerror("安装失败", f"安装出错: {e}")
            return False, str(e)

    def check_and_install_interception():
        # Keep for backward compatibility or direct calls
        pass

    KEYBOARD_DEVICE = -1
    MOUSE_DEVICE = -1

    def ic_mouse_move(x, y):
        global MOUSE_DEVICE
        if not HAS_INTERCEPTION: return
        user32 = ctypes.windll.user32
        width = user32.GetSystemMetrics(0)
        height = user32.GetSystemMetrics(1)
        mapped_x = int((x / width) * 0xFFFF) if width > 0 else 0
        mapped_y = int((y / height) * 0xFFFF) if height > 0 else 0
        
        stroke = MouseStroke()
        stroke.x = mapped_x
        stroke.y = mapped_y
        stroke.flags = INTERCEPTION_MOUSE_MOVE_ABSOLUTE
        
        # Try to find mouse device if not found
        if MOUSE_DEVICE == -1:
            for i in range(11, 21):
                if ic.interception_is_mouse(i):
                    MOUSE_DEVICE = i
                    break
        
        if MOUSE_DEVICE != -1:
            ic.interception_send(ic_context, MOUSE_DEVICE, ctypes.byref(stroke), 1)

    def ic_mouse_click(button, action="click"):
        global MOUSE_DEVICE
        if not HAS_INTERCEPTION: return
        stroke = MouseStroke()
        if button == "left":
            down = INTERCEPTION_MOUSE_LEFT_BUTTON_DOWN
            up = INTERCEPTION_MOUSE_LEFT_BUTTON_UP
        elif button == "right":
            down = INTERCEPTION_MOUSE_RIGHT_BUTTON_DOWN
            up = INTERCEPTION_MOUSE_RIGHT_BUTTON_UP
        else:
            down = INTERCEPTION_MOUSE_MIDDLE_BUTTON_DOWN
            up = INTERCEPTION_MOUSE_MIDDLE_BUTTON_UP

        if MOUSE_DEVICE == -1:
            for i in range(11, 21):
                if ic.interception_is_mouse(i):
                    MOUSE_DEVICE = i
                    break
        
        if MOUSE_DEVICE != -1:
            if action in ["click", "mousedown"]:
                stroke.state = down
                ic.interception_send(ic_context, MOUSE_DEVICE, ctypes.byref(stroke), 1)
            if action == "click":
                time.sleep(0.01)
            if action in ["click", "mouseup"]:
                stroke.state = up
                ic.interception_send(ic_context, MOUSE_DEVICE, ctypes.byref(stroke), 1)

    def ic_mouse_scroll(dy):
        global MOUSE_DEVICE
        if not HAS_INTERCEPTION: return
        stroke = MouseStroke()
        stroke.state = INTERCEPTION_MOUSE_WHEEL
        stroke.rolling = dy
        if MOUSE_DEVICE == -1:
            for i in range(11, 21):
                if ic.interception_is_mouse(i):
                    MOUSE_DEVICE = i
                    break
        if MOUSE_DEVICE != -1:
            ic.interception_send(ic_context, MOUSE_DEVICE, ctypes.byref(stroke), 1)

    def ic_key_down(scan_code):
        global KEYBOARD_DEVICE
        if not HAS_INTERCEPTION: return
        d = KeyStroke(scan_code, INTERCEPTION_KEY_DOWN, 0)
        if KEYBOARD_DEVICE == -1:
            for i in range(1, 11):
                if ic.interception_is_keyboard(i):
                    KEYBOARD_DEVICE = i
                    break
        if KEYBOARD_DEVICE != -1:
            ic.interception_send(ic_context, KEYBOARD_DEVICE, ctypes.byref(d), 1)

    def ic_key_up(scan_code):
        global KEYBOARD_DEVICE
        if not HAS_INTERCEPTION: return
        u = KeyStroke(scan_code, INTERCEPTION_KEY_UP, 0)
        if KEYBOARD_DEVICE == -1:
            for i in range(1, 11):
                if ic.interception_is_keyboard(i):
                    KEYBOARD_DEVICE = i
                    break
        if KEYBOARD_DEVICE != -1:
            ic.interception_send(ic_context, KEYBOARD_DEVICE, ctypes.byref(u), 1)

    def ic_key_tap(scan_code):
        global KEYBOARD_DEVICE
        if not HAS_INTERCEPTION: return
        d = KeyStroke(scan_code, INTERCEPTION_KEY_DOWN, 0)
        u = KeyStroke(scan_code, INTERCEPTION_KEY_UP, 0)
        if KEYBOARD_DEVICE == -1:
            for i in range(1, 11):
                if ic.interception_is_keyboard(i):
                    KEYBOARD_DEVICE = i
                    break
        if KEYBOARD_DEVICE != -1:
            ic.interception_send(ic_context, KEYBOARD_DEVICE, ctypes.byref(d), 1)
            time.sleep(0.005)
            ic.interception_send(ic_context, KEYBOARD_DEVICE, ctypes.byref(u), 1)
            time.sleep(0.005)

    def ic_type_string(text):
        global KEYBOARD_DEVICE
        if not HAS_INTERCEPTION: return
        user32 = ctypes.windll.user32
        
        target = KEYBOARD_DEVICE
        if target == -1:
            for i in range(1, 11):
                if ic.interception_is_keyboard(i):
                    KEYBOARD_DEVICE = i
                    target = i
                    break
                    
        for char in text:
            vk_res = user32.VkKeyScanW(ord(char))
            vk = vk_res & 0xFF
            shift = (vk_res >> 8) & 1
            scan = user32.MapVirtualKeyW(vk, 0)
            
            if shift and target != -1:
                # Shift Down (Left Shift: 42)
                d_shift = KeyStroke(42, INTERCEPTION_KEY_DOWN, 0)
                ic.interception_send(ic_context, target, ctypes.byref(d_shift), 1)
                time.sleep(0.01)
                
            ic_key_tap(scan)
            
            if shift and target != -1:
                # Shift Up
                u_shift = KeyStroke(42, INTERCEPTION_KEY_UP, 0)
                ic.interception_send(ic_context, target, ctypes.byref(u_shift), 1)
                time.sleep(0.01)



    def send_mouse_input(flags, x=0, y=0, data=0):
        user32 = ctypes.windll.user32
        inp = INPUT()
        inp.type = INPUT_MOUSE
        inp.u.mi.dx = x
        inp.u.mi.dy = y
        inp.u.mi.mouseData = data
        inp.u.mi.dwFlags = flags
        inp.u.mi.time = 0
        inp.u.mi.dwExtraInfo = None
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(inp))

    def send_unicode(text):
        user32 = ctypes.windll.user32
        inputs = []
        for char in text:
            # Key Down
            inp_down = INPUT()
            inp_down.type = INPUT_KEYBOARD
            inp_down.u.ki.wVk = 0
            inp_down.u.ki.wScan = ord(char)
            inp_down.u.ki.dwFlags = KEYEVENTF_UNICODE
            inputs.append(inp_down)
            
            # Key Up
            inp_up = INPUT()
            inp_up.type = INPUT_KEYBOARD
            inp_up.u.ki.wVk = 0
            inp_up.u.ki.wScan = ord(char)
            inp_up.u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
            inputs.append(inp_up)

        # Send all inputs at once for better performance and atomicity
        n_inputs = len(inputs)
        if n_inputs > 0:
            input_array = (INPUT * n_inputs)(*inputs)
            user32.SendInput(n_inputs, input_array, ctypes.sizeof(INPUT))

# Audio State
AUDIO_STREAM_RUNNING = False
AUDIO_PLAYER = None
AUDIO_PLAYER_STREAM = None
AUDIO_CHUNK = 960 # Opus frame size for 60ms at 16000Hz (16000 * 0.06 = 960)

# Input State
LAST_INPUT_TIME = 0
LAST_TYPE_STR = ""
AUDIO_FORMAT = pyaudio.paInt16 if HAS_PYAUDIO else None
AUDIO_CHANNELS = 1
AUDIO_RATE = 16000 # Standard for Opus voice

def get_system_info():
    system_os = platform.system()
    if os.path.exists("/system/build.prop"):
        system_os = "Android"
        
    cpu_usage = 0
    ram_usage = 0
    disk_usage = 0
    cpu_name = "Unknown"
    
    global CPU_NAME_CACHE, RAM_TOTAL_CACHE, DISK_TOTAL_CACHE
    if 'CPU_NAME_CACHE' not in globals(): CPU_NAME_CACHE = None
    if 'RAM_TOTAL_CACHE' not in globals(): RAM_TOTAL_CACHE = None
    if 'DISK_TOTAL_CACHE' not in globals(): DISK_TOTAL_CACHE = None

    ram_total = "Unknown"
    disk_total = "Unknown"
    
    try:
        if "psutil" in sys.modules:
            # interval=None means non-blocking, it uses the time elapsed since last call
            cpu_usage = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            ram_usage = mem.percent
            
            if RAM_TOTAL_CACHE:
                ram_total = RAM_TOTAL_CACHE
            else:
                RAM_TOTAL_CACHE = f"{round(mem.total / (1024**3), 2)} GB"
                ram_total = RAM_TOTAL_CACHE
                
            if DISK_TOTAL_CACHE:
                disk_total = DISK_TOTAL_CACHE
                # For disk usage, we still need current percentage but skip total calculation
                disk_usage = psutil.disk_usage('/').percent
            else:
                disk = psutil.disk_usage('/')
                DISK_TOTAL_CACHE = f"{round(disk.total / (1024**3), 2)} GB"
                disk_total = DISK_TOTAL_CACHE
                disk_usage = disk.percent
            
            if CPU_NAME_CACHE:
                cpu_name = CPU_NAME_CACHE
            else:
                try:
                    if platform.system() == "Windows":
                        # Use registry instead of WMI to avoid blocking during session switches
                        import winreg
                        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0")
                        cpu_name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
                        winreg.CloseKey(key)
                        CPU_NAME_CACHE = cpu_name
                    else:
                        cpu_name = platform.processor()
                        CPU_NAME_CACHE = cpu_name
                except:
                    cpu_name = platform.processor()
    except:
        pass
    
    arch = platform.architecture()[0]
    resolution = "Unknown"
    try:
        if platform.system() == "Windows":
            import ctypes
            user32 = ctypes.windll.user32
            width = user32.GetSystemMetrics(0)
            height = user32.GetSystemMetrics(1)
            resolution = f"{width}x{height}"
    except:
        pass
    
    return {
        "id": DEVICE_ID.replace(" ", ""), # Send unformatted ID to server
        "password": DEVICE_PASSWORD,
        "os": f"{system_os} {platform.release()}",
        "arch": arch,
        "resolution": resolution,
        "publicIp": IP_INFO_CACHE.get("publicIp", "N/A"),
        "location": IP_INFO_CACHE.get("location", "N/A"),
        "isp": IP_INFO_CACHE.get("isp", "N/A"),
        "hostname": socket.gethostname(),
        "ip": get_ip(),
        "remark": REMARK,
        "platform": PLATFORM_MODE,
        "cpuUsage": cpu_usage,
        "ramUsage": ram_usage,
        "diskUsage": disk_usage,
        "cpu": cpu_name,
        "ram": ram_total,
        "disk": disk_total
    }

def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def install_startup():
    return
    if AUTO_START == "none":
        return
    
    system_os = platform.system()
    if os.path.exists("/system/build.prop"):
        system_os = "Android"

    try:
        if system_os == "Windows":
            # Determine the correct command to run
            if getattr(sys, 'frozen', False):
                run_cmd = f'"{sys.executable}"'
            else:
                run_cmd = f'"{sys.executable}" "{os.path.abspath(__file__)}"'

            if AUTO_START == "registry":
                import winreg
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, winreg.KEY_SET_VALUE)
                winreg.SetValueEx(key, "RootDeskClient", 0, winreg.REG_SZ, run_cmd)
                winreg.CloseKey(key)
                print("[+] Registry startup installed")
                
            elif AUTO_START == "startup_folder":
                startup_path = os.path.join(os.getenv("APPDATA"), r"Microsoft\\Windows\\Start Menu\\Programs\\Startup")
                batch_file = os.path.join(startup_path, "rootdesk_client.bat")
                with open(batch_file, "w") as f:
                    f.write(f'@echo off\\nstart "" {run_cmd}')
                print("[+] Startup folder shortcut installed")

        elif system_os == "Android":
            # Termux-boot support
            boot_dir = os.path.expanduser("~/.termux/boot")
            if not os.path.exists(boot_dir):
                os.makedirs(boot_dir)
            
            script_path = os.path.join(boot_dir, "start_rootdesk.sh")
            with open(script_path, "w") as f:
                f.write(f"#!/data/data/com.termux/files/usr/bin/sh\\ntermux-wake-lock\\npython {os.path.abspath(__file__)} &")
            
            os.chmod(script_path, 0o700)
            print("[+] Termux boot script installed (Requires Termux:Boot app)")

    except Exception as e:
        print(f"[-] Failed to install startup: {e}")

def capture_window(hwnd, quality, scale):
    try:
        if platform.system() == "Windows":
            import ctypes
            import ctypes.wintypes
            user32 = ctypes.windll.user32
            gdi32 = ctypes.windll.gdi32
            
            rect = ctypes.wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            width = rect.right - rect.left
            height = rect.bottom - rect.top
            
            if width <= 0 or height <= 0: return None, 0, 0
            
            hwndDC = user32.GetDC(None)
            mfcDC  = gdi32.CreateCompatibleDC(hwndDC)
            saveBitMap = gdi32.CreateCompatibleBitmap(hwndDC, width, height)
            gdi32.SelectObject(mfcDC, saveBitMap)
            
            # PrintWindow is more reliable for background windows
            # Windows 7 (6.1) 不支持 PW_RENDERFULLCONTENT (2)，使用 0 作为兼容标志
            win_ver = sys.getwindowsversion()
            flag = 2 if win_ver.major > 6 or (win_ver.major == 6 and win_ver.minor >= 2) else 0
            result = user32.PrintWindow(hwnd, mfcDC, flag)
            
            print(f"[*] PrintWindow result: {result}, hwnd: {hwnd}, flag: {flag}")
            
            img = None
            if result:
                class BITMAPINFOHEADER(ctypes.Structure):
                    _fields_ = [
                        ("biSize", ctypes.wintypes.DWORD),
                        ("biWidth", ctypes.wintypes.LONG),
                        ("biHeight", ctypes.wintypes.LONG),
                        ("biPlanes", ctypes.wintypes.WORD),
                        ("biBitCount", ctypes.wintypes.WORD),
                        ("biCompression", ctypes.wintypes.DWORD),
                        ("biSizeImage", ctypes.wintypes.DWORD),
                        ("biXPelsPerMeter", ctypes.wintypes.LONG),
                        ("biYPelsPerMeter", ctypes.wintypes.LONG),
                        ("biClrUsed", ctypes.wintypes.DWORD),
                        ("biClrImportant", ctypes.wintypes.DWORD)
                    ]

                class BITMAPINFO(ctypes.Structure):
                    _fields_ = [
                        ("bmiHeader", BITMAPINFOHEADER),
                        ("bmiColors", ctypes.wintypes.DWORD * 3)
                    ]

                bmpinfo = BITMAPINFO()
                bmpinfo.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
                bmpinfo.bmiHeader.biWidth = width
                bmpinfo.bmiHeader.biHeight = -height
                bmpinfo.bmiHeader.biPlanes = 1
                bmpinfo.bmiHeader.biBitCount = 32
                bmpinfo.bmiHeader.biCompression = 0
                
                buffer = ctypes.create_string_buffer(width * height * 4)
                gdi32.GetDIBits(mfcDC, saveBitMap, 0, height, buffer, ctypes.byref(bmpinfo), 0)
                
                from PIL import Image
                img = Image.frombuffer('RGBA', (width, height), buffer, 'raw', 'BGRA', 0, 1)
                img = img.convert('RGB')
                
                if scale != 1.0:
                    new_size = (int(img.width * scale), int(img.height * scale))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
            gdi32.DeleteObject(saveBitMap)
            gdi32.DeleteDC(mfcDC)
            user32.ReleaseDC(None, hwndDC)
            
            return img, width, height
    except Exception as e:
        print(f"[-] Window capture error: {e}")
    return None, 0, 0

def stream_worker():
    global STREAM_RUNNING, WS_CLIENT, REINIT_CAMERA
    print("[*] Stream worker started")
    
    if platform.system() == "Windows":
        try:
            import comtypes
            comtypes.CoInitialize()
        except ImportError:
            pass
    
    last_frame = None
    frame_count = 0
    
    camera = None
    
    def get_cursor_style():
        if platform.system() != "Windows":
            return "default", None
        try:
            class CURSORINFO(ctypes.Structure):
                _fields_ = [
                    ("cbSize", ctypes.wintypes.DWORD),
                    ("flags", ctypes.wintypes.DWORD),
                    ("hCursor", ctypes.wintypes.HANDLE),
                    ("ptScreenPos", ctypes.wintypes.POINT)
                ]
            
            ci = CURSORINFO()
            ci.cbSize = ctypes.sizeof(CURSORINFO)
            if ctypes.windll.user32.GetCursorInfo(ctypes.byref(ci)):
                h = ci.hCursor
                pos = (ci.ptScreenPos.x, ci.ptScreenPos.y)
                # Common cursor handles (these can vary, but these are standard)
                # We can use GetCursor() but it only works for the current thread.
                # A better way is to compare with standard cursors
                IDC_ARROW = 32512
                IDC_IBEAM = 32513
                IDC_WAIT = 32514
                IDC_CROSS = 32515
                IDC_UPARROW = 32516
                IDC_SIZE = 32640
                IDC_ICON = 32641
                IDC_SIZENWSE = 32642
                IDC_SIZENESW = 32643
                IDC_SIZEWE = 32644
                IDC_SIZENS = 32645
                IDC_SIZEALL = 32646
                IDC_NO = 32648
                IDC_HAND = 32649
                IDC_APPSTARTING = 32650
                IDC_HELP = 32651
                
                def is_cursor(idc_id):
                    return h == ctypes.windll.user32.LoadCursorW(None, ctypes.wintypes.LPCWSTR(idc_id))

                if is_cursor(IDC_ARROW): return "default", pos
                if is_cursor(IDC_IBEAM): return "text", pos
                if is_cursor(IDC_WAIT): return "wait", pos
                if is_cursor(IDC_CROSS): return "crosshair", pos
                if is_cursor(IDC_HAND): return "pointer", pos
                if is_cursor(IDC_SIZENWSE): return "nwse-resize", pos
                if is_cursor(IDC_SIZENESW): return "nesw-resize", pos
                if is_cursor(IDC_SIZEWE): return "ew-resize", pos
                if is_cursor(IDC_SIZENS): return "ns-resize", pos
                if is_cursor(IDC_SIZEALL): return "move", pos
                if is_cursor(IDC_NO): return "not-allowed", pos
                if is_cursor(IDC_HELP): return "help", pos
                if is_cursor(IDC_APPSTARTING): return "progress", pos
                return "default", pos
        except:
            pass
        return "default", None

    LAST_DESKTOP = None
    LAST_SUCCESSFUL_GRAB = time.time()
    IS_LOCAL_CONN = "${config.host}" in ["localhost", "127.0.0.1", "192.168.1.1", "0.0.0.0"]
    DXCAM_FAIL_COUNT = 0
    MAX_DXCAM_FAILS = 3
    last_cursor_style = "default"
    
    while True:
        if not STREAM_RUNNING or not WS_CLIENT or not WS_CLIENT.sock or not WS_CLIENT.sock.connected:
            time.sleep(0.1)
            last_frame = None
            continue
            
        try:
            # Check for desktop change
            if platform.system() == "Windows":
                _, current_desktop = get_session_and_desktop()
                if LAST_DESKTOP is not None and current_desktop != LAST_DESKTOP:
                    print(f"[!] Desktop changed from {LAST_DESKTOP} to {current_desktop}, re-initializing camera...")
                    REINIT_CAMERA = True
                LAST_DESKTOP = current_desktop

            if REINIT_CAMERA:
                if camera:
                    print("[*] Re-initializing camera: cleaning up old instance...")
                    try:
                        camera.stop()
                    except RuntimeError as re:
                        if "cannot join current thread" in str(re):
                            print("[*] DXCAM stop: thread already stopping or in invalid state (ignored)")
                        else:
                            print(f"[-] DXCAM stop error: {re}")
                    except Exception as e:
                        print(f"[-] Camera stop error: {e}")
                    
                    try:
                        # Explicitly delete and collect garbage to clear dxcam's singleton
                        del camera
                        import gc
                        gc.collect()
                        time.sleep(1.0) # Give some time for DXGI to release
                    except: pass
                    camera = None
                REINIT_CAMERA = False
            
            if camera is None and "screen" in ENABLED_MODULES and platform.system() == "Windows":
                try:
                    # Detect architecture
                    is_32bit = sys.maxsize <= 2**32
                    if is_32bit:
                        print("[*] 32-bit Python detected. Using MSS for stability.")
                        camera = FallbackCamera()
                        camera.start()
                        print("[+] Screen Capture: MSS (32-bit Stable Mode)")
                    elif DXCAM_FAIL_COUNT >= MAX_DXCAM_FAILS:
                        print(f"[*] DXCAM failed consistently ({DXCAM_FAIL_COUNT} times). Using MSS as permanent fallback for this session.")
                        camera = FallbackCamera()
                        camera.start()
                        print("[+] Screen Capture: MSS (Stable Permanent Fallback)")
                    else:
                        import dxcam
                        if dxcam is not None:
                            # Try to clear dxcam's internal instance cache
                            try:
                                from dxcam.core.singleton import Singleton
                                Singleton.instances.clear()
                            except:
                                try:
                                    if hasattr(dxcam, 'singleton') and hasattr(dxcam.singleton, 'Singleton'):
                                        dxcam.singleton.Singleton.instances.clear()
                                except: pass
                            
                            camera = dxcam.create(output_idx=0, output_color="RGB", max_buffer_len=1)
                            # camera.start() is NOT called to avoid unstable background thread
                            print("[+] Screen Capture: DXCAM (High Performance Manual Mode)")
                        else:
                            raise ImportError("dxcam not available")
                except Exception as e:
                    DXCAM_FAIL_COUNT += 1
                    print(f"[-] DXCAM init failed ({DXCAM_FAIL_COUNT}/{MAX_DXCAM_FAILS}): {e}. Switching to fallback...")
                    camera = FallbackCamera()
                    camera.start()
                    # Determine fallback method name
                    method_name = "MSS" if hasattr(camera, 'method') and camera.method == "mss" else "Pillow"
                    print(f"[+] Screen Capture: {method_name} (Stable Fallback)")

            with STREAM_LOCK:
                mode = STREAM_CONFIG.get("mode", "screen")
                target_id = STREAM_CONFIG.get("target_id")
                quality = STREAM_CONFIG.get("quality", 50)
                scale = STREAM_CONFIG.get("scale", 0.5)
                compress = STREAM_CONFIG.get("compress", False)
                use_webp = STREAM_CONFIG.get("webp", True)

            is_locked = False
            if platform.system() == "Windows":
                # 1. 检查桌面名称 (Winlogon 桌面通常意味着锁屏或 UAC)
                if LAST_DESKTOP and LAST_DESKTOP == "winlogon" and not is_system():
                    is_locked = True
                
                # 2. 检查 LogonUI.exe 进程 (最可靠的锁屏界面标志)
                if not is_locked and HAS_PSUTIL and not is_system():
                    try:
                        for proc in psutil.process_iter(['name']):
                            if proc.info['name'].lower() == 'logonui.exe':
                                is_locked = True
                                break
                    except:
                        pass
                
                # 3. 检查当前会话状态 (WTSQuerySessionInformation)
                if not is_locked:
                    if is_session_locked(-1) and not is_system(): # SYSTEM 权限不需要标记为锁定，因为可以捕获 Winlogon 界面
                        is_locked = True
            
            if is_locked:
                # Send metadata to notify the controller
                metadata = {
                    "type": "screen_metadata",
                    "is_locked": True,
                    "has_interception": HAS_INTERCEPTION,
                    "cursor_style": "default"
                }
                safe_send(WS_CLIENT, json.dumps(metadata))
                
                # Force fallback camera on lock screen because dxcam fails
                if camera and not isinstance(camera, FallbackCamera):
                    try:
                        camera.stop()
                    except: pass
                    camera = FallbackCamera()
                    camera.start()
                
                # Switch desktop to Winlogon
                if platform.system() == "Windows":
                    try:
                        h_desk = ctypes.windll.user32.OpenDesktopW("Winlogon", 0, False, 0x0002) # DESKTOP_SWITCHDESKTOP
                        if h_desk:
                            ctypes.windll.user32.SwitchDesktop(h_desk)
                            ctypes.windll.user32.SetThreadDesktop(h_desk)
                            ctypes.windll.user32.CloseDesktop(h_desk)
                            print("[+] Desktop switched to Winlogon for lock screen capture")
                    except Exception as e:
                        print(f"[-] Failed to switch desktop: {e}")

            cursor_style = get_cursor_style()
            
            if mode == "screen":
                img = None
                original_width, original_height = 0, 0
                
                if camera:
                    try:
                        frame = camera.grab()
                    except Exception as ce:
                        error_str = str(ce)
                        print(f"[-] Camera grab error: {error_str}")
                        # If we get a DXGI error, memory error or a NoneType error, re-init
                        # -2147024882 is E_OUTOFMEMORY
                        if any(x in error_str for x in ["-2147024882", "-2005270527", "COMError", "DXGI", "NoneType", "attribute", "invalid", "AcquireNextFrame"]):
                            print("[!] Critical DXCAM error detected (possibly out of memory), forcing full re-init...")
                            REINIT_CAMERA = True
                            # If it's a memory error, maybe we should sleep a bit or try to clear cache
                            if "-2147024882" in error_str:
                                time.sleep(1.0)
                        
                        # Check if we've been failing for more than 3 seconds
                        if time.time() - LAST_SUCCESSFUL_GRAB > 3.0:
                            print("[!] Persistent grab error (>3s), assuming screen is locked or resources exhausted...")
                            metadata = {
                                "type": "screen_metadata",
                                "is_locked": True,
                                "has_interception": HAS_INTERCEPTION,
                                "cursor_style": "default"
                            }
                            safe_send(WS_CLIENT, json.dumps(metadata))
                        continue

                    if frame is not None:
                        DXCAM_FAIL_COUNT = 0 # Reset failure count on success
                        if HAS_NUMPY and HAS_PIL:
                            if isinstance(frame, Image.Image):
                                img = frame
                            else:
                                img = Image.fromarray(frame)
                            original_width, original_height = img.width, img.height
                            LAST_SUCCESSFUL_GRAB = time.time() # Reset on success
                        elif HAS_PIL and isinstance(frame, Image.Image):
                            img = frame
                            original_width, original_height = img.width, img.height
                            LAST_SUCCESSFUL_GRAB = time.time()
                
                if img is None:
                    # If camera is active but returns None, it might be changing state
                    if camera:
                        # Check if we've been failing for more than 3 seconds
                        if time.time() - LAST_SUCCESSFUL_GRAB > 3.0:
                            print("[!] No frames captured for >3s, assuming screen is locked...")
                            metadata = {
                                "type": "screen_metadata",
                                "is_locked": True,
                                "has_interception": HAS_INTERCEPTION,
                                "cursor_style": "default"
                            }
                            safe_send(WS_CLIENT, json.dumps(metadata))
                        time.sleep(0.1)
                    else:
                        time.sleep(0.1)
                    continue
                
                # 针对 Win7 闪烁优化：如果图像全黑，则跳过不传输
                if sys.getwindowsversion().major <= 6 and not img.getbbox():
                    time.sleep(0.01)
                    continue
                    
                if scale != 1.0:
                    new_size = (int(img.width * scale), int(img.height * scale))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
                cursor_style, cursor_pos = get_cursor_style()
                
                # Force update if cursor style changed
                cursor_style_changed = False
                if last_cursor_style != cursor_style:
                    cursor_style_changed = True
                    last_cursor_style = cursor_style

                # Incremental update logic: Optimized Grid Sampling & Local Path
                is_full_frame = True
                x, y = 0, 0
                send_img = img
                
                if last_frame and frame_count % 60 != 0 and last_frame.size == img.size:
                    w, h = img.size
                    
                    # 使用 ImageChops 进行精确的差异检测，确保即使是单像素的变化也能被捕捉到
                    # 这解决了用户反馈的“轻微变化没有传输”的问题
                    diff = ImageChops.difference(img, last_frame)
                    bbox = diff.getbbox()
                    
                    has_change = False
                    if bbox:
                        has_change = True
                        min_x, min_y, max_x, max_y = bbox
                    
                    # 光标感知：如果在输入，强制更新光标周围区域，提高响应感
                    is_typing = (cursor_style == "text" or time.time() - LAST_INPUT_TIME < 3.0)
                    if not has_change and is_typing and cursor_pos:
                        cx, cy = cursor_pos
                        if scale != 1.0:
                            cx, cy = int(cx * scale), int(cy * scale)
                        min_x, min_y, max_x, max_y = cx-150, cy-75, cx+150, cy+75
                        has_change = True
                        bbox = (max(0, min_x), max(0, min_y), min(w, max_x), min(h, max_y))

                    if not has_change and not cursor_style_changed:
                        # 未检测到变化且光标样式未变，稍微休眠并跳过
                        time.sleep(0.01)
                        frame_count += 1
                        continue
                    
                    if not has_change and cursor_style_changed:
                        # 仅光标样式变化，发送一个极小的全帧或当前帧的一部分以携带元数据
                        # 这里我们选择发送一个 1x1 的透明像素或者只是当前的 full frame
                        # 为了简单起见，我们发送全帧，但标记为 full=True
                        has_change = True
                        is_full_frame = True
                        send_img = img
                        x, y = 0, 0
                    
                    # 本地连接优化：跳过裁剪以节省 CPU
                    # 远程连接优化：裁剪以节省带宽
                    if IS_LOCAL_CONN:
                        is_full_frame = True
                        send_img = img
                        x, y = 0, 0
                    else:
                        # 规范化并裁剪变化区域，稍微向外扩展以包含抗锯齿像素
                        padding = 8
                        bbox = (max(0, min_x-padding), max(0, min_y-padding), 
                                min(w, max_x+padding), min(h, max_y+padding))
                        send_img = img.crop(bbox)
                        x, y = bbox[0], bbox[1]
                        is_full_frame = False
                
                last_frame = img
                frame_count += 1
                
                buffer = BytesIO()
                img_format = "WEBP" if use_webp else "JPEG"
                try:
                    send_img.save(buffer, format=img_format, quality=quality)
                except:
                    # Fallback to JPEG if WEBP fails
                    buffer = BytesIO()
                    send_img.save(buffer, format="JPEG", quality=quality)
                
                # Send merged binary data with header 0x04 (standard) or 0x05 (compressed)
                metadata = {
                    "type": "screen_metadata",
                    "cursor_style": cursor_style,
                    "is_locked": is_locked,
                    "has_interception": HAS_INTERCEPTION,
                    "width": img.width if is_full_frame else send_img.width,
                    "height": img.height if is_full_frame else send_img.height,
                    "full": is_full_frame,
                    "x": x,
                    "y": y,
                    "total_width": img.width,
                    "total_height": img.height,
                    "original_width": original_width,
                    "original_height": original_height,
                    "format": img_format.lower()
                }
                metadata_bytes = json.dumps(metadata).encode('utf-8')
                metadata_len = struct.pack('>I', len(metadata_bytes))
                
                payload = metadata_len + metadata_bytes + buffer.getvalue()
                
                if compress:
                    compressed_payload = zlib.compress(payload, level=6)
                    safe_send(WS_CLIENT, b'\x05' + compressed_payload, opcode=websocket.ABNF.OPCODE_BINARY)
                else:
                    safe_send(WS_CLIENT, b'\x04' + payload, opcode=websocket.ABNF.OPCODE_BINARY)
                
                frame_count += 1
            
            elif mode == "window" and target_id:
                img, orig_w, orig_h = capture_window(target_id, quality, scale)
                
                if img:
                    # 针对 Win7 闪烁优化：如果图像全黑，则跳过不传输
                    if sys.getwindowsversion().major <= 6 and not img.getbbox():
                        time.sleep(0.01)
                        continue

                    # Incremental update logic
                    is_full_frame = True
                    x, y = 0, 0
                    send_img = img
                    
                    if last_frame and frame_count % 60 != 0 and last_frame.size == img.size:
                        w, h = img.size
                        step = 16 if IS_LOCAL_CONN else 32
                        p1 = img.load()
                        p2 = last_frame.load()
                        
                        min_x, min_y, max_x, max_y = w, h, 0, 0
                        has_change = False
                        
                        for gy in range(0, h, step):
                            for gx in range(0, w, step):
                                if p1[gx, gy] != p2[gx, gy]:
                                    has_change = True
                                    if gx < min_x: min_x = gx
                                    if gy < min_y: min_y = gy
                                    if gx > max_x: max_x = gx
                                    if gy > max_y: max_y = gy
                        
                        if not has_change:
                            time.sleep(0.01)
                            frame_count += 1
                            continue
                        
                        if IS_LOCAL_CONN:
                            is_full_frame = True
                            send_img = img
                            x, y = 0, 0
                        else:
                            bbox = (max(0, min_x-step), max(0, min_y-step), min(w, max_x+step), min(h, max_y+step))
                            send_img = img.crop(bbox)
                            x, y = bbox[0], bbox[1]
                            is_full_frame = False
                    
                    last_frame = img
                    frame_count += 1
                    
                    buffer = BytesIO()
                    send_img.save(buffer, format="JPEG", quality=quality)
                    # Send merged binary data with header 0x05
                    metadata = {
                        "type": "window_metadata",
                        "cursor_style": cursor_style,
                        "is_locked": is_locked,
                        "has_interception": HAS_INTERCEPTION,
                        "width": img.width if is_full_frame else send_img.width,
                        "height": img.height if is_full_frame else send_img.height,
                        "full": is_full_frame,
                        "x": x,
                        "y": y,
                        "total_width": img.width,
                        "total_height": img.height,
                        "original_width": orig_w,
                        "original_height": orig_h
                    }
                    metadata_bytes = json.dumps(metadata).encode('utf-8')
                    metadata_len = struct.pack('>I', len(metadata_bytes))
                    safe_send(WS_CLIENT, b'\x05' + metadata_len + metadata_bytes + buffer.getvalue(), opcode=websocket.ABNF.OPCODE_BINARY)
                    
                    frame_count += 1
                else:
                    # Window might be closed or invalid
                    time.sleep(1)

            # Limit FPS
            if mode == "window":
                time.sleep(0.1)
            else:
                time.sleep(0.03) # Slightly faster loop to catch changes
            
        except Exception as e:
            print(f"[-] Stream error: {e}")
            # If it's a DXGI error, force re-init
            if "DXGI" in str(e) or "HRESULT" in str(e) or "-2005270527" in str(e) or "COMError" in str(type(e)):
                print("[!] DXGI error detected, triggering camera re-initialization...")
                REINIT_CAMERA = True
            time.sleep(1)
            last_frame = None
            
    # This won't be reached in the infinite loop, but good practice
    if platform.system() == "Windows":
        try:
            import comtypes
            comtypes.CoUninitialize()
        except ImportError:
            pass

def handle_input(ws, args):
    global LAST_INPUT_TIME
    LAST_INPUT_TIME = time.time()
    if "screen" not in ENABLED_MODULES: return
    try:
        action = args.get("action")
        use_interception = args.get("useInterception", True)
        
        if action == "mousemove":
            x, y = int(args.get("x", 0)), int(args.get("y", 0))
            if platform.system() == "Windows":
                if use_interception and HAS_INTERCEPTION:
                    ic_mouse_move(x, y)
                else:
                    ctypes.windll.user32.SetCursorPos(x, y)
            else:
                pyautogui.moveTo(x, y)
        elif action == "click":
            x, y = int(args.get("x", 0)), int(args.get("y", 0))
            button = args.get("button", "left")
            if platform.system() == "Windows":
                if use_interception and HAS_INTERCEPTION:
                    ic_mouse_move(x, y)
                    ic_mouse_click(button, "click")
                else:
                    ctypes.windll.user32.SetCursorPos(x, y)
                    flags_down = 0x0002 if button == "left" else (0x0008 if button == "right" else 0x0020)
                    flags_up = 0x0004 if button == "left" else (0x0010 if button == "right" else 0x0040)
                    # Use a small sleep to ensure registration
                    ctypes.windll.user32.mouse_event(flags_down, 0, 0, 0, 0)
                    time.sleep(0.05) 
                    ctypes.windll.user32.mouse_event(flags_up, 0, 0, 0, 0)
            else:
                pyautogui.click(x, y, button=button)
        elif action == "doubleclick":
            x, y = int(args.get("x", 0)), int(args.get("y", 0))
            button = args.get("button", "left")
            if platform.system() == "Windows":
                if use_interception and HAS_INTERCEPTION:
                    ic_mouse_move(x, y)
                    ic_mouse_click(button, "click")
                    time.sleep(0.05)
                    ic_mouse_click(button, "click")
                else:
                    ctypes.windll.user32.SetCursorPos(x, y)
                    flags_down = 0x0002 if button == "left" else (0x0008 if button == "right" else 0x0020)
                    flags_up = 0x0004 if button == "left" else (0x0010 if button == "right" else 0x0040)
                    # Click 1
                    ctypes.windll.user32.mouse_event(flags_down, 0, 0, 0, 0)
                    time.sleep(0.02)
                    ctypes.windll.user32.mouse_event(flags_up, 0, 0, 0, 0)
                    time.sleep(0.05)
                    # Click 2
                    ctypes.windll.user32.mouse_event(flags_down, 0, 0, 0, 0)
                    time.sleep(0.02)
                    ctypes.windll.user32.mouse_event(flags_up, 0, 0, 0, 0)
            else:
                pyautogui.doubleClick(x, y, button=button)
        elif action == "mousedown":
            x, y = int(args.get("x", 0)), int(args.get("y", 0))
            button = args.get("button", "left")
            if platform.system() == "Windows":
                if use_interception and HAS_INTERCEPTION:
                    ic_mouse_move(x, y)
                    ic_mouse_click(button, "mousedown")
                else:
                    ctypes.windll.user32.SetCursorPos(x, y)
                    flags_down = 0x0002 if button == "left" else (0x0008 if button == "right" else 0x0020)
                    ctypes.windll.user32.mouse_event(flags_down, 0, 0, 0, 0)
                    time.sleep(0.02)
            else:
                pyautogui.mouseDown(x, y, button=button)
        elif action == "mouseup":
            x, y = int(args.get("x", 0)), int(args.get("y", 0))
            button = args.get("button", "left")
            if platform.system() == "Windows":
                if use_interception and HAS_INTERCEPTION:
                    ic_mouse_move(x, y)
                    ic_mouse_click(button, "mouseup")
                else:
                    ctypes.windll.user32.SetCursorPos(x, y)
                    flags_up = 0x0004 if button == "left" else (0x0010 if button == "right" else 0x0040)
                    ctypes.windll.user32.mouse_event(flags_up, 0, 0, 0, 0)
            else:
                pyautogui.mouseUp(x, y, button=button)
        elif action == "scroll":
            dx, dy = int(args.get("dx", 0)), int(args.get("dy", 0))
            if platform.system() == "Windows":
                if use_interception and HAS_INTERCEPTION:
                    ic_mouse_scroll(-dy)
                else:
                    ctypes.windll.user32.mouse_event(0x0800, 0, 0, -dy, 0)
            else:
                pyautogui.scroll(-dy)
        elif action == "keypress":
            key = args.get("key")
            if platform.system() == "Windows":
                vk = get_vk(key)
                if vk:
                    if use_interception and HAS_INTERCEPTION:
                        ic_key_tap(ctypes.windll.user32.MapVirtualKeyW(vk, 0))
                    else:
                        send_key_press(vk)
                else:
                    pyautogui.press(key)
            else:
                pyautogui.press(key)
        elif action == "keydown":
            key = args.get("key")
            if platform.system() == "Windows":
                vk = get_vk(key)
                if vk:
                    if use_interception and HAS_INTERCEPTION:
                        ic_key_down(ctypes.windll.user32.MapVirtualKeyW(vk, 0))
                    else:
                        send_key_input(vk, False)
                else:
                    pyautogui.keyDown(key)
            else:
                pyautogui.keyDown(key)
        elif action == "keyup":
            key = args.get("key")
            if platform.system() == "Windows":
                vk = get_vk(key)
                if vk:
                    if use_interception and HAS_INTERCEPTION:
                        ic_key_up(ctypes.windll.user32.MapVirtualKeyW(vk, 0))
                    else:
                        send_key_input(vk, True)
                else:
                    pyautogui.keyUp(key)
            else:
                pyautogui.keyUp(key)
        elif action == "hotkey":
            keys = args.get("keys", [])
            if keys:
                pyautogui.hotkey(*keys)
        elif action == "type_realtime":
            global LAST_TYPE_STR
            text = args.get("text", "")
            if text == "__RESET__":
                LAST_TYPE_STR = ""
                return
            
            if text == LAST_TYPE_STR:
                pass
            elif text.startswith(LAST_TYPE_STR):
                delta = text[len(LAST_TYPE_STR):]
                if platform.system() == "Windows":
                    # 只有在文本较短且不含空格/换行时，才使用模拟键盘输入。
                    # 对于长文本、包含换行或非 ASCII 字符的情况，直接使用剪贴板粘贴。
                    is_complex = any(ord(c) >= 128 for c in delta) or chr(10) in delta or len(delta) > 10
                    if is_complex:
                        import pyperclip
                        try:
                            pyperclip.copy(delta)
                            time.sleep(0.05)
                            if use_interception and HAS_INTERCEPTION:
                                ic_key_down(29) # Ctrl
                                ic_key_tap(47)  # V
                                ic_key_up(29)
                            else:
                                pyautogui.hotkey('ctrl', 'v')
                        except Exception as e:
                            print(f"Paste error: {e}")
                            send_unicode(delta)
                    elif use_interception and HAS_INTERCEPTION:
                        try:
                            ic_type_string(delta)
                        except Exception as e:
                            print(f"IC Type error: {e}")
                            send_unicode(delta)
                    else:
                        send_unicode(delta)
                else:
                    pyautogui.write(delta)
            elif LAST_TYPE_STR.startswith(text):
                backspaces = len(LAST_TYPE_STR) - len(text)
                for _ in range(backspaces):
                    if platform.system() == "Windows" and use_interception and HAS_INTERCEPTION:
                        ic_key_tap(14) # Backspace
                    else:
                        pyautogui.press('backspace')
            else:
                # Replacement - This usually happens when the client-side state gets out of sync
                # or the user selects all and replaces it.
                if text == "__RESET__":
                    LAST_TYPE_STR = ""
                    return

                # Send backspaces to clear the old content
                for _ in range(len(LAST_TYPE_STR)):
                    if platform.system() == "Windows" and use_interception and HAS_INTERCEPTION:
                        ic_key_tap(14)
                    else:
                        pyautogui.press('backspace')
                if text:
                    if platform.system() == "Windows":
                        is_complex = any(ord(c) >= 128 for c in text) or chr(10) in text or len(text) > 10
                        if is_complex:
                            import pyperclip
                            try:
                                pyperclip.copy(text)
                                time.sleep(0.05)
                                if use_interception and HAS_INTERCEPTION:
                                    ic_key_down(29) # Ctrl
                                    ic_key_tap(47)  # V
                                    ic_key_up(29)
                                else:
                                    pyautogui.hotkey('ctrl', 'v')
                            except Exception as e:
                                print(f"Paste error: {e}")
                                send_unicode(text)
                        elif use_interception and HAS_INTERCEPTION:
                            ic_type_string(text)
                        else:
                            send_unicode(text)
                    else:
                        pyautogui.write(text)
            LAST_TYPE_STR = text
        elif action == "type":
            text = args.get("text")
            if text:
                import pyperclip
                try:
                    old_clipboard = pyperclip.paste()
                except Exception:
                    old_clipboard = ""
                
                try:
                    pyperclip.copy(text)
                    time.sleep(0.05)
                    
                    if platform.system() == "Darwin":
                        pyautogui.hotkey('command', 'v')
                    else:
                        if use_interception and HAS_INTERCEPTION:
                            ic_key_down(29) # Ctrl
                            ic_key_tap(47)  # V
                            ic_key_up(29)
                        else:
                            pyautogui.hotkey('ctrl', 'v')
                    
                    time.sleep(0.05)
                    pyperclip.copy(old_clipboard)
                except Exception as e:
                    print(f"Clipboard type error: {e}")
                    # Fallback
                    if platform.system() == "Windows":
                        if use_interception and HAS_INTERCEPTION and all(ord(c) < 128 for c in text):
                            ic_type_string(text)
                        else:
                            send_unicode(text)
                    else:
                        pyautogui.write(text)
        elif action == "unlock":
            password = args.get("password", "")
            if platform.system() == "Windows":
                def unlock_worker(pwd):
                    try:
                        
                        time.sleep(1)
                        
                        # 1. ESC 和 空格
                        
                        if HAS_INTERCEPTION:
                            ic_key_tap(1)
                        else:
                            pyautogui.press('esc')

                        if HAS_INTERCEPTION:
                            ic_key_tap(57)
                        else:
                            pyautogui.press('space')
                        
                        time.sleep(1.0) # 等待界面切换
                        
                        # 判断是否在解锁界面 (检查 LogonUI.exe 是否运行)
                        is_lock_screen = False
                        if HAS_PSUTIL:
                            import psutil
                            for proc in psutil.process_iter(['name']):
                                try:
                                    if proc.info['name'].lower() == 'logonui.exe':
                                        is_lock_screen = True
                                        break
                                except:
                                    pass
                        else:
                            # Fallback if psutil missing: assume we are on lock screen if we received unlock command
                            is_lock_screen = True
                        
                        if not is_lock_screen:
                            return
                        
                        
                        
                        if HAS_INTERCEPTION:
                            # 2. Ctrl + A (全选)
                            ic_key_down(29) # L-Ctrl
                            ic_key_tap(30) # A
                            ic_key_up(29) # L-Ctrl
                            time.sleep(0.3)
                            # 3. Backspace (删除)
                            ic_key_tap(14)
                            time.sleep(0.3)
                            # 4. Type Password (输入密码)
                            if pwd:
                                ic_type_string(pwd)
                            time.sleep(0.5)
                            # 5. Enter (确认)
                            ic_key_tap(28)
                        else:
                            # PyAutoGUI fallback
                            pyautogui.hotkey('ctrl', 'a')
                            time.sleep(0.3)
                            pyautogui.press('backspace')
                            time.sleep(0.3)
                            if pwd:
                                pyautogui.write(pwd)
                            time.sleep(0.5)
                            pyautogui.press('enter')

                    except Exception as thread_err:
                        print(f"[-] Unlock thread error: {thread_err}")
                t = threading.Thread(target=unlock_worker, args=(password,))
                t.daemon = True
                t.start()
    except Exception as e:
        pass # Ignore input errors to avoid spamming logs

def handle_screen(ws, args):
    global STREAM_RUNNING, STREAM_CONFIG, REINIT_CAMERA
    if "screen" not in ENABLED_MODULES: return
    
    action = args.get("action", "start")
    if action == "stop":
        STREAM_RUNNING = False
    elif action == "refresh":
        REINIT_CAMERA = True
        STREAM_RUNNING = True
    elif action == "screenshot":
        try:
            import pyautogui
            from io import BytesIO
            import base64
            
            img = pyautogui.screenshot()
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=90)
            img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            safe_send(ws, json.dumps({
                "type": "screenshot",
                "data": img_b64
            }))
        except Exception as e:
            print(f"[-] Screenshot error: {e}")
            safe_send(ws, json.dumps({"type": "error", "data": f"Screenshot failed: {str(e)}"}))
    else:
        with STREAM_LOCK:
            STREAM_CONFIG["mode"] = "screen"
            STREAM_CONFIG["quality"] = args.get("quality", 50)
            STREAM_CONFIG["scale"] = args.get("scale", 0.5)
            STREAM_CONFIG["compress"] = args.get("compress", False)
            STREAM_CONFIG["webp"] = args.get("webp", True)
            
        # Wake up screen by slightly moving the mouse
        try:
            if platform.system() == "Windows":
                import ctypes
                class POINT(ctypes.Structure):
                    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]
                pt = POINT()
                ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
                
                # Move slightly and back
                if HAS_INTERCEPTION:
                    ic_mouse_move(pt.x + 1, pt.y + 1)
                    time.sleep(0.01)
                    ic_mouse_move(pt.x, pt.y)
                else:
                    ctypes.windll.user32.SetCursorPos(pt.x + 1, pt.y + 1)
                    time.sleep(0.01)
                    ctypes.windll.user32.SetCursorPos(pt.x, pt.y)
        except:
            pass
            
        STREAM_RUNNING = True

def handle_clipboard(ws, args):
    if "screen" not in ENABLED_MODULES: return
    action = args.get("action")
    
    try:
        import pyperclip
        if action == "get":
            text = pyperclip.paste()
            safe_send(ws, json.dumps({
                "type": "clipboard",
                "data": text
            }))
        elif action == "set":
            text = args.get("data", "")
            pyperclip.copy(text)
            safe_send(ws, json.dumps({
                "type": "output",
                "data": "Clipboard updated on client"
            }))
    except Exception as e:
        print(f"[-] Clipboard error: {e}")
        safe_send(ws, json.dumps({"type": "error", "data": f"Clipboard action failed: {str(e)}"}))

def get_path_at_point(x, y):
    if platform.system() != "Windows":
        return os.path.expanduser("~/Desktop")
        
    try:
        import win32gui
        import win32com.client
        import pythoncom
        
        pythoncom.CoInitialize()
        
        try:
            # Find window at point
            hwnd = win32gui.WindowFromPoint((x, y))
            if not hwnd:
                return os.path.expanduser("~/Desktop")
            
            # Find top level window
            while win32gui.GetParent(hwnd):
                hwnd = win32gui.GetParent(hwnd)
                
            # Check if it's an Explorer window
            shell = win32com.client.Dispatch("Shell.Application")
            windows = shell.Windows()
            for i in range(windows.Count):
                try:
                    window = windows.Item(i)
                    if int(window.hwnd) == hwnd:
                        path = window.Document.Folder.Self.Path
                        if path.startswith("file:///"):
                            path = path[8:].replace("/", "\\\\")
                        elif path.startswith("::"): # Virtual folders
                            continue
                        return path
                except:
                    continue
                    
            # Check if it's the desktop
            class_name = win32gui.GetClassName(hwnd)
            if class_name in ["Progman", "WorkerW"]:
                return os.path.join(os.environ["USERPROFILE"], "Desktop")
        finally:
            pythoncom.CoUninitialize()
            
        return os.path.expanduser("~/Desktop")
    except Exception as e:
        print(f"Error getting path at point: {e}")
        return os.path.expanduser("~/Desktop")

def create_progress_window(transfer_id, filename, total_size, ws):
    try:
        root = tk.Tk()
        root.withdraw() # Hide immediately
        set_window_icon(root)
        root.title("文件传输")
        root.attributes("-topmost", True)
        
        # Position
        window_width = 400
        window_height = 150
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        
        root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        root.minsize(window_width, window_height)
        root.resizable(True, True)
        root.deiconify() # Show

        label = tk.Label(root, text=f"正在接收: {filename}", wraplength=250)
        label.pack(pady=5)

        progress = ttk.Progressbar(root, orient="horizontal", length=250, mode="determinate")
        progress.pack(pady=5)
        progress["maximum"] = 100
        progress["value"] = 0

        def on_close():
            if transfer_id in ACTIVE_TRANSFERS:
                transfer = ACTIVE_TRANSFERS[transfer_id]
                transfer["file"].close()
                if os.path.exists(transfer["path"]):
                    try: os.remove(transfer["path"])
                    except: pass
                del ACTIVE_TRANSFERS[transfer_id]
                safe_send(ws, json.dumps({
                    "type": "file_cancel",
                    "data": {"transferId": transfer_id, "filename": filename}
                }))
            root.destroy()

        # Add close button (X)
        close_btn = tk.Button(root, text="X", command=on_close, bd=0, fg="red", font=("Arial", 10, "bold"))
        close_btn.place(x=275, y=5)

        return root, progress
    except Exception as e:
        print(f"Error creating progress window: {e}")
        return None, None

def handle_files(ws, args):
    if "files" not in ENABLED_MODULES: return
    action = args.get("action", "list")
    path = args.get("path", ".")
    
    try:
        if action == "drop_start":
            transfer_id = args.get("transferId")
            filename = args.get("filename")
            total_size = args.get("totalSize", 0)
            x = args.get("x", 0)
            y = args.get("y", 0)
            
            if transfer_id and filename:
                target_dir = get_path_at_point(x, y)
                if not os.path.exists(target_dir):
                    target_dir = os.path.expanduser("~/Desktop")
                
                target_path = os.path.join(target_dir, filename)
                
                # Handle duplicate filename
                base, ext = os.path.splitext(target_path)
                counter = 1
                while os.path.exists(target_path):
                    target_path = f"{base} ({counter}){ext}"
                    counter += 1
                
                f = open(target_path, "wb")
                
                def run_gui():
                    if not HAS_TKINTER:
                        print(f"[*] Receiving {filename} ({total_size} bytes)... (GUI not available)")
                        return
                    root, pb = create_progress_window(transfer_id, filename, total_size, ws)
                    if root and pb:
                        ACTIVE_TRANSFERS[transfer_id]["window"] = root
                        ACTIVE_TRANSFERS[transfer_id]["progress_bar"] = pb
                        root.mainloop()

                ACTIVE_TRANSFERS[transfer_id] = {
                    "file": f,
                    "path": target_path,
                    "total_size": total_size,
                    "current_size": 0,
                    "window": None,
                    "progress_bar": None
                }
                
                threading.Thread(target=run_gui, daemon=True).start()
            return

        if action == "file_cancel":
            transfer_id = args.get("transferId")
            if transfer_id in ACTIVE_TRANSFERS:
                transfer = ACTIVE_TRANSFERS[transfer_id]
                transfer["file"].close()
                if os.path.exists(transfer["path"]):
                    try: os.remove(transfer["path"])
                    except: pass
                if transfer["window"]:
                    try: transfer["window"].after(0, transfer["window"].destroy)
                    except: pass
                del ACTIVE_TRANSFERS[transfer_id]
                print(f"[*] Transfer {transfer_id} cancelled by controller")
            return

        if action == "drop_chunk":
            transfer_id = args.get("transferId")
            filename = args.get("filename")
            data = args.get("data")
            offset = args.get("offset", 0)
            
            if transfer_id in ACTIVE_TRANSFERS:
                transfer = ACTIVE_TRANSFERS[transfer_id]
                try:
                    decoded_data = base64.b64decode(data)
                    data_len = len(decoded_data)
                    
                    # Use offset for data integrity
                    transfer["file"].seek(offset)
                    transfer["file"].write(decoded_data)
                    
                    # Update current size based on highest offset + length
                    new_size = offset + data_len
                    if new_size > transfer["current_size"]:
                        transfer["current_size"] = new_size
                    
                    # Calculate progress safely
                    total_size = transfer.get("total_size", 0)
                    if total_size > 0:
                        progress = int((transfer["current_size"] / total_size) * 100)
                    else:
                        progress = 100
                    
                    if progress > 100: progress = 100
                    
                    # Update GUI
                    if transfer["progress_bar"]:
                        try: 
                            transfer["progress_bar"]["value"] = progress
                            if transfer["window"]:
                                transfer["window"].update()
                        except: pass
                    
                    # Ensure we send 100% if we are done, otherwise send if progress changed
                    is_done = transfer["current_size"] >= total_size
                    if is_done:
                        progress = 100

                    if "last_progress" not in transfer or transfer["last_progress"] != progress or is_done:
                        transfer["last_progress"] = progress
                        safe_send(ws, json.dumps({
                            "type": "file_progress",
                            "data": {"transferId": transfer_id, "filename": filename, "progress": progress}
                        }))
                    
                    if is_done:
                        transfer["file"].close()
                        if transfer["window"]:
                            try: 
                                transfer["window"].after(100, transfer["window"].destroy)
                            except: pass
                        
                        target_path = transfer["path"]
                        del ACTIVE_TRANSFERS[transfer_id]
                        
                        # Send completion notification
                        safe_send(ws, json.dumps({
                            "type": "file_complete",
                            "data": {"transferId": transfer_id, "filename": filename}
                        }))
                        
                        safe_send(ws, json.dumps({
                            "type": "notification",
                            "data": {"title": "文件传输完成", "message": f"文件已保存到: {target_path}"}
                        }))
                        print(f"[+] File transfer complete -> {target_path}")
                except Exception as e:
                    print(f"[-] Error processing file chunk: {e}")
                    safe_send(ws, json.dumps({
                        "type": "error",
                        "data": f"文件块处理错误: {str(e)}"
                    }))
            else:
                print(f"[!] Warning: Received chunk for unknown transfer: {transfer_id}")
                safe_send(ws, json.dumps({
                    "type": "error",
                    "data": f"未知的文件传输ID: {transfer_id}，请重试"
                }))
            return

        if action == "drop":
            filename = args.get("filename")
            data = args.get("data")
            x = args.get("x", 0)
            y = args.get("y", 0)
            
            if filename and data:
                target_dir = get_path_at_point(x, y)
                if not os.path.exists(target_dir):
                    target_dir = os.path.expanduser("~/Desktop")
                
                target_path = os.path.join(target_dir, filename)
                
                # Handle duplicate filename
                base, ext = os.path.splitext(target_path)
                counter = 1
                while os.path.exists(target_path):
                    target_path = f"{base} ({counter}){ext}"
                    counter += 1
                
                with open(target_path, "wb") as f:
                    f.write(base64.b64decode(data))
                
                print(f"[+] File dropped at {x}, {y} -> Saved to {target_path}")
                
                # Optional: notify server of success
                safe_send(ws, json.dumps({
                    "type": "notification",
                    "data": {"title": "文件传输完成", "message": f"文件已保存到: {target_path}"}
                }))
            return

        if action == "drives":
            if platform.system() == "Windows":
                import string
                from ctypes import windll
                drives = []
                bitmask = windll.kernel32.GetLogicalDrives()
                for letter in string.ascii_uppercase:
                    if bitmask & 1:
                        drives.append({"name": letter + ":", "is_dir": True, "size": 0, "mtime": 0})
                    bitmask >>= 1
                safe_send(ws, json.dumps({
                    "type": "drive_list",
                    "data": drives
                }))
            return

        if action == "list":
            if os.path.isfile(path):
                # Read file
                file_size = os.path.getsize(path)
                if file_size > 10 * 1024 * 1024:
                    safe_send(ws, json.dumps({"type": "error", "data": "File too large (>10MB)"}))
                    return
                with open(path, "rb") as f:
                    content = base64.b64encode(f.read()).decode()
                safe_send(ws, json.dumps({
                    "type": "file_content",
                    "path": path,
                    "data": content
                }))
            else:
                # List directory
                files = []
                try:
                    for entry in os.scandir(path):
                        files.append({
                            "name": entry.name,
                            "is_dir": entry.is_dir(),
                            "size": entry.stat().st_size,
                            "mtime": entry.stat().st_mtime
                        })
                    safe_send(ws, json.dumps({
                        "type": "file_list",
                        "path": os.path.abspath(path),
                        "data": files
                    }))
                except Exception as e:
                    safe_send(ws, json.dumps({"type": "error", "data": f"List error: {str(e)}"}))
                
        elif action == "delete" or action == "rm":
            if os.path.exists(path):
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
                # Refresh list
                handle_files(ws, {"action": "list", "path": os.path.dirname(path)})

        elif action == "mv":
            src = args.get("src")
            dst = args.get("dst")
            if src and dst and os.path.exists(src):
                shutil.move(src, dst)
                # Refresh list
                handle_files(ws, {"action": "list", "path": os.path.dirname(dst)})

        elif action == "cp":
            src = args.get("src")
            dst = args.get("dst")
            if src and dst and os.path.exists(src):
                if os.path.isdir(src):
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)
                # Refresh list
                handle_files(ws, {"action": "list", "path": os.path.dirname(dst)})
                
        elif action == "upload":
            data = args.get("data")
            if data:
                with open(path, "wb") as f:
                    f.write(base64.b64decode(data))
                # Refresh list
                handle_files(ws, {"action": "list", "path": os.path.dirname(path)})

        elif action == "download":
            if os.path.isfile(path):
                file_size = os.path.getsize(path)
                if file_size > 100 * 1024 * 1024:
                    safe_send(ws, json.dumps({"type": "error", "data": "File too large (>100MB)"}))
                    return
                with open(path, "rb") as f:
                    content = base64.b64encode(f.read()).decode()
                safe_send(ws, json.dumps({
                    "type": "file_content",
                    "path": path,
                    "data": content
                }))
            else:
                safe_send(ws, json.dumps({"type": "error", "data": "Not a file"}))

        elif action == "open":
            if os.path.exists(path):
                try:
                    if platform.system() == "Windows":
                        os.startfile(path)
                    elif platform.system() == "Darwin":
                        subprocess.call(["open", path])
                    else:
                        subprocess.call(["xdg-open", path])
                except Exception as e:
                    safe_send(ws, json.dumps({"type": "error", "data": f"Open error: {str(e)}"}))
                
    except Exception as e:
        safe_send(ws, json.dumps({"type": "error", "data": f"File error: {str(e)}"}))

def handle_windows(ws, args):
    if "windows" not in ENABLED_MODULES: return
    windows = []
    try:
        if platform.system() == "Windows":
            import ctypes
            EnumWindows = ctypes.windll.user32.EnumWindows
            GetWindowText = ctypes.windll.user32.GetWindowTextW
            GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
            IsWindowVisible = ctypes.windll.user32.IsWindowVisible
            GetWindowThreadProcessId = ctypes.windll.user32.GetWindowThreadProcessId
            
            def foreach_window(hwnd, lParam):
                if IsWindowVisible(hwnd):
                    length = GetWindowTextLength(hwnd)
                    if length > 0:
                        buff = ctypes.create_unicode_buffer(length + 1)
                        GetWindowText(hwnd, buff, length + 1)
                        title = buff.value
                        if title:
                            pid = ctypes.c_ulong()
                            GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                            try:
                                p = psutil.Process(pid.value)
                                process_name = p.name()
                                mem = p.memory_info().rss / (1024 * 1024)
                            except:
                                process_name = "Unknown"
                                mem = 0
                            
                            windows.append({
                                "id": hwnd,
                                "title": title,
                                "process": process_name,
                                "pid": pid.value,
                                "status": "active",
                                "memory": f"{mem:.1f} MB",
                                "pinned": False
                            })
                return True
            
            EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)(foreach_window), 0)
            
        safe_send(ws, json.dumps({
            "type": "window_list",
            "data": windows
        }))
    except Exception as e:
        safe_send(ws, json.dumps({"type": "error", "data": f"Windows error: {str(e)}"}))

def handle_window_stream(ws, args):
    global STREAM_RUNNING, STREAM_CONFIG
    if "windows" not in ENABLED_MODULES: return
    
    action = args.get("action", "start")
    hwnd = args.get("id")
    
    if action == "stop":
        STREAM_RUNNING = False
    else:
        if not hwnd: return
        with STREAM_LOCK:
            STREAM_CONFIG["mode"] = "window"
            STREAM_CONFIG["target_id"] = hwnd
            STREAM_CONFIG["quality"] = args.get("quality", 50)
            STREAM_CONFIG["scale"] = args.get("scale", 0.5)
            STREAM_CONFIG["compress"] = args.get("compress", False)
            STREAM_CONFIG["webp"] = args.get("webp", True)
        
        if platform.system() == "Windows":
             try:
                 user32 = ctypes.windll.user32
                 user32.ShowWindow(hwnd, 9) # SW_RESTORE
                 user32.SetForegroundWindow(hwnd)
             except: pass
        
        STREAM_RUNNING = True

def handle_window_control(ws, args):
    if "windows" not in ENABLED_MODULES: return
    action = args.get("action")
    hwnd = args.get("id")
    if not hwnd: return
    
    if platform.system() == "Windows":
        import ctypes
        user32 = ctypes.windll.user32
        
        if action == "close":
            user32.PostMessageW(hwnd, 0x0010, 0, 0)
        elif action == "minimize":
            user32.ShowWindow(hwnd, 6)
        elif action == "hide":
            user32.ShowWindow(hwnd, 0)
        elif action == "front":
            user32.ShowWindow(hwnd, 9)
            user32.SetForegroundWindow(hwnd)

def handle_window_input(ws, args):
    if "windows" not in ENABLED_MODULES: return
    action = args.get("action")
    hwnd = args.get("id")
    use_interception = args.get("useInterception", True)
    if not hwnd: return
    
    if platform.system() == "Windows":
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        
        def get_absolute_coordinates(hwnd, x, y):
            try:
                # Get Window Rect (Screen coordinates of window top-left)
                rect = wintypes.RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                # Calculate absolute screen coordinates
                return rect.left + x, rect.top + y
            except:
                return x, y

        # Bring window to foreground for reliable input
        if action in ["click", "mousedown", "mouseup", "mousemove", "keypress", "type", "scroll"]:
            try:
                user32.ShowWindow(hwnd, 9) # SW_RESTORE
                user32.SetForegroundWindow(hwnd)
            except Exception:
                pass

        if action == "click":
            x, y = args.get("x"), args.get("y")
            button = args.get("button", "left")
            x = int(x) if x is not None else 0
            y = int(y) if y is not None else 0
            
            abs_x, abs_y = get_absolute_coordinates(hwnd, x, y)
            if use_interception and HAS_INTERCEPTION:
                ic_mouse_move(abs_x, abs_y)
                ic_mouse_click(button, "click")
            else:
                user32.SetCursorPos(abs_x, abs_y)
                flags_down = 0x0002 if button == "left" else (0x0008 if button == "right" else 0x0020)
                flags_up = 0x0004 if button == "left" else (0x0010 if button == "right" else 0x0040)
                user32.mouse_event(flags_down, 0, 0, 0, 0)
                time.sleep(0.05)
                user32.mouse_event(flags_up, 0, 0, 0, 0)
                
        elif action == "doubleclick":
            x, y = args.get("x"), args.get("y")
            button = args.get("button", "left")
            x = int(x) if x is not None else 0
            y = int(y) if y is not None else 0
            
            abs_x, abs_y = get_absolute_coordinates(hwnd, x, y)
            if use_interception and HAS_INTERCEPTION:
                ic_mouse_move(abs_x, abs_y)
                ic_mouse_click(button, "click")
                time.sleep(0.05)
                ic_mouse_click(button, "click")
            else:
                user32.SetCursorPos(abs_x, abs_y)
                flags_down = 0x0002 if button == "left" else (0x0008 if button == "right" else 0x0020)
                flags_up = 0x0004 if button == "left" else (0x0010 if button == "right" else 0x0040)
                # 1
                user32.mouse_event(flags_down, 0, 0, 0, 0)
                time.sleep(0.02)
                user32.mouse_event(flags_up, 0, 0, 0, 0)
                time.sleep(0.05)
                # 2
                user32.mouse_event(flags_down, 0, 0, 0, 0)
                time.sleep(0.02)
                user32.mouse_event(flags_up, 0, 0, 0, 0)
                
        elif action == "mousedown":
            x, y = args.get("x"), args.get("y")
            button = args.get("button", "left")
            x = int(x) if x is not None else 0
            y = int(y) if y is not None else 0
            
            abs_x, abs_y = get_absolute_coordinates(hwnd, x, y)
            if use_interception and HAS_INTERCEPTION:
                ic_mouse_move(abs_x, abs_y)
                ic_mouse_click(button, "mousedown")
            else:
                user32.SetCursorPos(abs_x, abs_y)
                flags_down = 0x0002 if button == "left" else (0x0008 if button == "right" else 0x0020)
                user32.mouse_event(flags_down, 0, 0, 0, 0)
                time.sleep(0.02)
                
        elif action == "mouseup":
            x, y = args.get("x"), args.get("y")
            button = args.get("button", "left")
            x = int(x) if x is not None else 0
            y = int(y) if y is not None else 0
            
            abs_x, abs_y = get_absolute_coordinates(hwnd, x, y)
            if use_interception and HAS_INTERCEPTION:
                ic_mouse_move(abs_x, abs_y)
                ic_mouse_click(button, "mouseup")
            else:
                user32.SetCursorPos(abs_x, abs_y)
                flags_up = 0x0004 if button == "left" else (0x0010 if button == "right" else 0x0040)
                user32.mouse_event(flags_up, 0, 0, 0, 0)
                
        elif action == "mousemove":
            x, y = args.get("x"), args.get("y")
            x = int(x) if x is not None else 0
            y = int(y) if y is not None else 0
            abs_x, abs_y = get_absolute_coordinates(hwnd, x, y)
            if use_interception and HAS_INTERCEPTION:
                ic_mouse_move(abs_x, abs_y)
            else:
                user32.SetCursorPos(abs_x, abs_y)
            
        elif action == "scroll":
            dx, dy = int(args.get("dx", 0)), int(args.get("dy", 0))
            if use_interception and HAS_INTERCEPTION:
                ic_mouse_scroll(-dy)
            else:
                user32.mouse_event(0x0800, 0, 0, -dy, 0)

        elif action == "keypress":
            key = args.get("key")
            if platform.system() == "Windows":
                vk = get_vk(key)
                if vk:
                    if use_interception and HAS_INTERCEPTION:
                        ic_key_tap(ctypes.windll.user32.MapVirtualKeyW(vk, 0))
                    else:
                        send_key_press(vk)
                else:
                    pyautogui.press(key)
            else:
                pyautogui.press(key)
        elif action == "keydown":
            key = args.get("key")
            if platform.system() == "Windows":
                vk = get_vk(key)
                if vk:
                    if use_interception and HAS_INTERCEPTION:
                        ic_key_down(ctypes.windll.user32.MapVirtualKeyW(vk, 0))
                    else:
                        send_key_input(vk, False)
                else:
                    pyautogui.keyDown(key)
            else:
                pyautogui.keyDown(key)
        elif action == "keyup":
            key = args.get("key")
            if platform.system() == "Windows":
                vk = get_vk(key)
                if vk:
                    if use_interception and HAS_INTERCEPTION:
                        ic_key_up(ctypes.windll.user32.MapVirtualKeyW(vk, 0))
                    else:
                        send_key_input(vk, True)
                else:
                    pyautogui.keyUp(key)
            else:
                pyautogui.keyUp(key)
                
        elif action == "type_realtime":
            global LAST_TYPE_STR
            text = args.get("text", "")
            if text == LAST_TYPE_STR:
                pass
            elif text == "__RESET__":
                LAST_TYPE_STR = ""
            elif text.startswith(LAST_TYPE_STR):
                delta = text[len(LAST_TYPE_STR):]
                if platform.system() == "Windows":
                    if any(ord(c) >= 128 for c in delta):
                        import pyperclip
                        try:
                            pyperclip.copy(delta)
                            time.sleep(0.05)
                            if use_interception and HAS_INTERCEPTION:
                                ic_key_down(29) # Ctrl
                                ic_key_tap(47)  # V
                                ic_key_up(29)
                            else:
                                pyautogui.hotkey('ctrl', 'v')
                        except Exception as e:
                            print(f"Paste error: {e}")
                            send_unicode(delta)
                    elif use_interception and HAS_INTERCEPTION and all(ord(c) < 128 for c in delta):
                        try:
                            ic_type_string(delta)
                        except Exception as e:
                            print(f"IC Type error: {e}")
                            send_unicode(delta)
                    else:
                        send_unicode(delta)
                else:
                    pyautogui.write(delta)
            elif LAST_TYPE_STR.startswith(text):
                backspaces = len(LAST_TYPE_STR) - len(text)
                for _ in range(backspaces):
                    if platform.system() == "Windows" and use_interception and HAS_INTERCEPTION:
                        ic_key_tap(14) # Backspace
                    else:
                        pyautogui.press('backspace')
            else:
                # Replacement
                for _ in range(len(LAST_TYPE_STR)):
                    if platform.system() == "Windows" and use_interception and HAS_INTERCEPTION:
                        ic_key_tap(14)
                    else:
                        pyautogui.press('backspace')
                if text:
                    if platform.system() == "Windows":
                        if any(ord(c) >= 128 for c in text):
                            import pyperclip
                            try:
                                pyperclip.copy(text)
                                time.sleep(0.05)
                                if use_interception and HAS_INTERCEPTION:
                                    ic_key_down(29) # Ctrl
                                    ic_key_tap(47)  # V
                                    ic_key_up(29)
                                else:
                                    pyautogui.hotkey('ctrl', 'v')
                            except Exception as e:
                                print(f"Paste error: {e}")
                                send_unicode(text)
                        elif use_interception and HAS_INTERCEPTION and all(ord(c) < 128 for c in text):
                            ic_type_string(text)
                        else:
                            send_unicode(text)
                    else:
                        pyautogui.write(text)
            LAST_TYPE_STR = text
        elif action == "type":
            text = args.get("text")
            if text:
                import pyperclip
                try:
                    old_clipboard = pyperclip.paste()
                except Exception:
                    old_clipboard = ""
                
                try:
                    pyperclip.copy(text)
                    time.sleep(0.05)
                    
                    if platform.system() == "Darwin":
                        pyautogui.hotkey('command', 'v')
                    else:
                        if use_interception and HAS_INTERCEPTION:
                            ic_key_down(29) # Ctrl
                            ic_key_tap(47)  # V
                            ic_key_up(29)
                        else:
                            pyautogui.hotkey('ctrl', 'v')
                    
                    time.sleep(0.05)
                    pyperclip.copy(old_clipboard)
                except Exception as e:
                    print(f"Clipboard type error: {e}")
                    # Fallback
                    if platform.system() == "Windows":
                        if use_interception and HAS_INTERCEPTION and all(ord(c) < 128 for c in text):
                            ic_type_string(text)
                        else:
                            send_unicode(text)
                    else:
                        pyautogui.write(text)
                    
        elif action == "hotkey":
            keys = args.get("keys", [])
            if keys:
                try:
                    pyautogui.hotkey(*keys)
                except Exception as e:
                    print(f"Hotkey error: {e}")

def audio_worker():
    global AUDIO_STREAM_RUNNING
    print("[*] Audio worker thread started", flush=True)
    
    if platform.system() == "Windows":
        try:
            import comtypes
            comtypes.CoInitialize()
        except ImportError:
            pass
            
    if not HAS_PYAUDIO:
        print("[-] PyAudio not installed, cannot stream audio", flush=True)
        if platform.system() == "Windows":
            try:
                import comtypes
                comtypes.CoUninitialize()
            except ImportError:
                pass
        return
    
    print(f"[*] Audio capture initialized. HAS_PYAUDIO: {HAS_PYAUDIO}", flush=True)
    p = pyaudio.PyAudio()
    try:
        # Try to find the best device for PC audio capture
        device_index = None
        
        # 1. Try to find WASAPI Loopback (Best for capturing even when muted)
        try:
            wasapi_idx = -1
            for i in range(p.get_host_api_count()):
                if "WASAPI" in p.get_host_api_info_by_index(i).get('name', ''):
                    wasapi_idx = i
                    break
            
            if wasapi_idx != -1:
                for i in range(p.get_device_count()):
                    dev = p.get_device_info_by_index(i)
                    if dev.get('hostApi') == wasapi_idx and dev.get('maxInputChannels') > 0:
                        # Look for loopback of the default output device
                        if 'loopback' in dev.get('name', '').lower():
                            device_index = i
                            print(f"[*] Using WASAPI Loopback: {dev.get('name')}")
                            break
        except Exception as e:
            print(f"[!] WASAPI detection failed: {e}")

        # 2. Fallback to Stereo Mix if WASAPI Loopback not found
        if device_index is None:
            for i in range(p.get_device_count()):
                dev = p.get_device_info_by_index(i)
                name = dev.get('name', '').lower()
                # Support multiple languages for "Stereo Mix"
                if dev.get('maxInputChannels') > 0 and ('stereo mix' in name or '立体声混音' in name or 'wave out mix' in name or 'what u hear' in name):
                    device_index = i
                    print(f"[*] Using Stereo Mix: {dev.get('name')}")
                    break
                
        # 3. Final fallback to default input device
        if device_index is None:
            print("[!] Loopback/Stereo Mix not found. Using default input device. PC audio might not be captured if muted.")
            try:
                device_info = p.get_default_input_device_info()
                device_index = device_info.get('index')
            except:
                pass
        
        # Determine sample rate candidates
        rates_to_try = [AUDIO_RATE, 48000, 44100, 8000]
        if device_index is not None:
            try:
                dev_info = p.get_device_info_by_index(device_index)
                dev_rate = int(dev_info.get('defaultSampleRate', AUDIO_RATE))
                if dev_rate not in rates_to_try:
                    rates_to_try.insert(0, dev_rate)
            except:
                pass

        stream = None
        final_rate = AUDIO_RATE
        for rate in rates_to_try:
            try:
                print(f"[*] Attempting to open audio stream: device={device_index}, rate={rate}Hz...")
                stream = p.open(format=AUDIO_FORMAT,
                                channels=AUDIO_CHANNELS,
                                rate=rate,
                                input=True,
                                input_device_index=device_index,
                                frames_per_buffer=AUDIO_CHUNK)
                final_rate = rate
                print(f"[+] Successfully opened audio stream at {rate}Hz")
                break
            except Exception as e:
                print(f"[!] Failed to open audio stream at {rate}Hz: {e}")
                continue
        
        if not stream:
            print("[-] Could not open any audio input stream.")
            return

        # Initialize encoder after stream is opened to use the correct rate
        try:
            import opuslib
            # Opus supports: 8000, 12000, 16000, 24000, 48000
            supported_rates = [8000, 12000, 16000, 24000, 48000]
            opus_rate = final_rate
            if opus_rate not in supported_rates:
                # Find closest supported rate (though this might still cause issues if not resampled)
                opus_rate = min(supported_rates, key=lambda x: abs(x - final_rate))
                print(f"[!] Device rate {final_rate}Hz not directly supported by Opus. Using {opus_rate}Hz. Audio might be distorted.")
            
            encoder = opuslib.Encoder(opus_rate, AUDIO_CHANNELS, 'voip')
            print(f"[+] Opus encoder initialized at {opus_rate}Hz", flush=True)
            use_opus = True
        except Exception as e:
            print(f"[-] Failed to initialize Opus encoder: {e}. Falling back to raw PCM.", flush=True)
            use_opus = False

        print(f"[*] Audio stream started at {final_rate}Hz (Mode: {'Opus' if use_opus else 'Raw PCM'})", flush=True)
        while AUDIO_STREAM_RUNNING:
            try:
                data = stream.read(AUDIO_CHUNK, exception_on_overflow=False)
                if use_opus:
                    # Encode with Opus
                    encoded_data = encoder.encode(data, AUDIO_CHUNK)
                    # Send binary audio data with header 0x03 (Opus)
                    safe_send(WS_CLIENT, b'\x03' + encoded_data, opcode=websocket.ABNF.OPCODE_BINARY)
                else:
                    # Send binary audio data with header 0x02 (Raw PCM)
                    safe_send(WS_CLIENT, b'\x02' + data, opcode=websocket.ABNF.OPCODE_BINARY)
            except Exception as e:
                print(f"[-] Audio read/encode error: {e}")
                break
                
        stream.stop_stream()
        stream.close()
    except Exception as e:
        print(f"[-] Audio capture error: {e}")
    finally:
        p.terminate()
        print("[*] Audio stream stopped")
        if platform.system() == "Windows":
            try:
                import comtypes
                comtypes.CoUninitialize()
            except ImportError:
                pass

def handle_audio(ws, args):
    global AUDIO_STREAM_RUNNING
    action = args.get("action")
    print(f"[*] Audio command received: {action}")
    
    if "audio" not in ENABLED_MODULES: 
        print("[-] Audio module not enabled in this client")
        return
    
    if action == "start_listen":
        if not AUDIO_STREAM_RUNNING:
            AUDIO_STREAM_RUNNING = True
            threading.Thread(target=audio_worker, daemon=True).start()
    elif action == "stop_listen":
        AUDIO_STREAM_RUNNING = False

def handle_audio_input(ws, args):
    global AUDIO_PLAYER, AUDIO_PLAYER_STREAM
    if "audio" not in ENABLED_MODULES or not HAS_PYAUDIO: return
    
    data_b64 = args.get("data")
    if not data_b64: return
    
    try:
        data = base64.b64decode(data_b64)
        if AUDIO_PLAYER is None:
            AUDIO_PLAYER = pyaudio.PyAudio()
            AUDIO_PLAYER_STREAM = AUDIO_PLAYER.open(format=AUDIO_FORMAT,
                                                    channels=AUDIO_CHANNELS,
                                                    rate=AUDIO_RATE,
                                                    output=True)
        AUDIO_PLAYER_STREAM.write(data)
    except Exception as e:
        print(f"[-] Audio play error: {e}")

PRIVACY_WINDOW = None
PRIVACY_LABEL = None

def handle_privacy_screen(ws, args):
    global PRIVACY_WINDOW, PRIVACY_LABEL
    action = args.get("action")
    message = args.get("message", "系统维护中，请稍候...")
    
    if action == "start":
        if PRIVACY_WINDOW:
            try:
                if PRIVACY_WINDOW.winfo_exists():
                    PRIVACY_LABEL.config(text=message)
                    PRIVACY_WINDOW.deiconify()
                    # Ensure our control panel stays on top
                    if ROOT_WINDOW:
                        try:
                            ROOT_WINDOW.attributes("-topmost", True)
                            ROOT_WINDOW.lift()
                        except:
                            pass
                    return
            except:
                pass
            
        def create_window():
            global PRIVACY_WINDOW, PRIVACY_LABEL, ROOT_WINDOW
            try:
                import tkinter as tk
                root = tk.Tk()
                set_window_icon(root)
                PRIVACY_WINDOW = root
                root.attributes('-fullscreen', True)
                root.attributes('-topmost', True)
                root.configure(background='black')
                root.overrideredirect(True)
                
                # Ensure our control panel stays on top
                if ROOT_WINDOW:
                    try:
                        ROOT_WINDOW.attributes("-topmost", True)
                        ROOT_WINDOW.lift()
                    except:
                        pass
                
                label = tk.Label(root, text=message, fg='white', bg='black', font=('Arial', 32))
                label.pack(expand=True)
                PRIVACY_LABEL = label
                
                # Hide from capture and make click-through on Windows
                if platform.system() == "Windows":
                    if not platform.version().startswith("6.1"):
                        try:
                            import ctypes
                            # Ensure window is mapped and ready
                            root.update_idletasks()
                            root.update()
                            
                            # Set a very slight alpha transparency (0.99) first
                            # On some Windows versions/drivers, layered windows with affinity are handled more reliably
                            # Doing this before SetWindowLong ensures Tkinter doesn't overwrite our custom styles
                            root.attributes("-alpha", 0.99)
                            root.update()
                            
                            # Get the real top-level HWND
                            hwnd = root.winfo_id()
                            # GA_ROOT = 2
                            root_hwnd = ctypes.windll.user32.GetAncestor(hwnd, 2)
                            if not root_hwnd: root_hwnd = hwnd
                            
                            import sys
                            try:
                                GetWindowLong = ctypes.windll.user32.GetWindowLongPtrW
                                SetWindowLong = ctypes.windll.user32.SetWindowLongPtrW
                            except AttributeError:
                                GetWindowLong = ctypes.windll.user32.GetWindowLongW
                                SetWindowLong = ctypes.windll.user32.SetWindowLongW
                                
                            GetWindowLong.argtypes = [ctypes.c_void_p, ctypes.c_int]
                            GetWindowLong.restype = ctypes.c_void_p
                            SetWindowLong.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
                            SetWindowLong.restype = ctypes.c_void_p
                            
                            SetWindowDisplayAffinity = ctypes.windll.user32.SetWindowDisplayAffinity
                            SetWindowDisplayAffinity.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
                            SetWindowDisplayAffinity.restype = ctypes.c_bool
                            
                            # Set click-through (WS_EX_TRANSPARENT | WS_EX_LAYERED)
                            # GWL_EXSTYLE = -20, WS_EX_LAYERED = 0x80000, WS_EX_TRANSPARENT = 0x20
                            ex_style = GetWindowLong(root_hwnd, -20)
                            if ex_style is not None:
                                SetWindowLong(root_hwnd, -20, ex_style | 0x80000 | 0x20)
                                # Force window to update its style: SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER = 0x0027
                                ctypes.windll.user32.SetWindowPos(root_hwnd, 0, 0, 0, 0, 0, 0x0027)
                            
                            # WDA_EXCLUDEFROMCAPTURE = 0x11 (17)
                            # This flag tells Windows to exclude this window from any screen capture
                            # (BitBlt, PrintWindow, Desktop Duplication API, etc.)
                            # We apply it to both the widget HWND and the root HWND for maximum compatibility
                            SetWindowDisplayAffinity(hwnd, 17)
                            res = SetWindowDisplayAffinity(root_hwnd, 17)
                            if not res:
                                # Fallback to WDA_MONITOR (1) for older Windows versions
                                # This will show a black rectangle instead of the content behind it
                                res = SetWindowDisplayAffinity(root_hwnd, 1)
                            
                            print(f"[+] Privacy screen active on HWND: {root_hwnd}, affinity_res: {res}")
                        except Exception as e:
                            print(f"Failed to set window styles: {e}")
                    else:
                        # Windows 7 专用逻辑：尝试使用 WS_EX_TOOLWINDOW 和 WS_EX_LAYERED 风格，确保不透明
                        try:
                            root.update_idletasks()
                            
                            # 获取 HWND
                            hwnd = root.winfo_id()
                            root_hwnd = ctypes.windll.user32.GetAncestor(hwnd, 2)
                            if not root_hwnd: root_hwnd = hwnd
                            
                            # 获取当前扩展样式
                            try:
                                GetWindowLong = ctypes.windll.user32.GetWindowLongPtrW
                                SetWindowLong = ctypes.windll.user32.SetWindowLongPtrW
                            except AttributeError:
                                GetWindowLong = ctypes.windll.user32.GetWindowLongW
                                SetWindowLong = ctypes.windll.user32.SetWindowLongW
                            
                            ex_style = GetWindowLong(root_hwnd, -20)
                            
                            # 添加 WS_EX_TOOLWINDOW (0x80) 和 WS_EX_LAYERED (0x80000)
                            SetWindowLong(root_hwnd, -20, ex_style | 0x80 | 0x80000)
                            
                            # 显式设置不透明度为 255 (完全不透明)
                            ctypes.windll.user32.SetLayeredWindowAttributes(root_hwnd, 0, 255, 2)
                            
                            # 取消强制置顶
                            root.attributes("-topmost", False)
                            
                            print(f"[+] Privacy screen active on Win7 HWND: {root_hwnd}")
                        except Exception as e:
                            print(f"[-] Privacy screen error on Win7: {e}")
                
                root.mainloop()
            except Exception as e:
                print(f"Privacy screen error: {e}")
                
        threading.Thread(target=create_window, daemon=True).start()
        
    elif action == "stop":
        if PRIVACY_WINDOW:
            try:
                PRIVACY_WINDOW.after(0, PRIVACY_WINDOW.withdraw)
            except:
                pass

def handle_monitor(ws, args):
    if "monitor" not in ENABLED_MODULES: return
    action = args.get("action")
    
    try:
        if action == "hardware_info":
            info = {}
            info["system"] = {
                "os": platform.platform(),
                "version": platform.version(),
                "architecture": platform.architecture()[0]
            }
            
            try:
                if HAS_PSUTIL:
                    info["cpu"] = {
                        "processor": platform.processor(),
                        "cores": psutil.cpu_count(logical=False),
                        "logical": psutil.cpu_count(logical=True),
                        "freq": psutil.cpu_freq().current if psutil.cpu_freq() else "N/A"
                    }
            except:
                pass
                
            if platform.system() == "Windows":
                try:
                    wmi_obj = wmi.WMI()
                    boards = []
                    for board in wmi_obj.Win32_BaseBoard():
                        boards.append({"model": board.Product, "manufacturer": board.Manufacturer})
                    info["motherboard"] = boards
                    
                    gpus = []
                    for gpu in wmi_obj.Win32_VideoController():
                        vram = int(gpu.AdapterRAM)/(1024**3) if hasattr(gpu, 'AdapterRAM') and gpu.AdapterRAM else 0
                        gpus.append({"name": gpu.Name, "vram": f"{vram:.1f}GB"})
                    info["gpu"] = gpus
                    
                    disks = []
                    for disk in wmi_obj.Win32_DiskDrive():
                        size = round(int(disk.Size)/(1024**3), 2) if hasattr(disk, 'Size') and disk.Size else 0
                        disks.append({"model": disk.Model, "size": f"{size}GB", "interface": disk.InterfaceType})
                    info["disk"] = disks
                    
                    nics = []
                    for nic in wmi_obj.Win32_NetworkAdapterConfiguration():
                        if nic.IPEnabled:
                            nics.append({"desc": nic.Description, "mac": nic.MACAddress, "ip": nic.IPAddress[0] if nic.IPAddress else ""})
                    info["network"] = nics
                except:
                    pass
            
            try:
                if HAS_PSUTIL:
                    mem = psutil.virtual_memory()
                    info["memory"] = {
                        "total": round(mem.total / (1024**3), 2),
                        "available": round(mem.available / (1024**3), 2),
                        "percent": mem.percent
                    }
            except:
                pass
                
            try:
                partitions = []
                if HAS_PSUTIL:
                    for part in psutil.disk_partitions():
                        if 'cdrom' not in part.opts and part.fstype != '':
                            try:
                                usage = psutil.disk_usage(part.mountpoint)
                                partitions.append({
                                    "mountpoint": part.mountpoint,
                                    "total": round(usage.total/(1024**3), 2),
                                    "used": round(usage.used/(1024**3), 2),
                                    "percent": usage.percent
                                })
                            except:
                                pass
                info["partitions"] = partitions
            except:
                pass
                
            try:
                if HAS_PSUTIL:
                    battery = psutil.sensors_battery()
                    if battery:
                        info["battery"] = {
                            "percent": battery.percent,
                            "plugged": battery.power_plugged
                        }
            except:
                pass
                
            safe_send(ws, json.dumps({
                "type": "hardware_info",
                "data": info
            }))
            
        elif action == "performance":
            metrics = {}
            if HAS_PSUTIL:
                metrics["cpu_percent"] = psutil.cpu_percent(interval=0)
                metrics["mem_percent"] = psutil.virtual_memory().percent
                
                disk_io = psutil.disk_io_counters()
                net_io = psutil.net_io_counters()
                
                metrics["disk_read"] = disk_io.read_bytes if disk_io else 0
                metrics["disk_write"] = disk_io.write_bytes if disk_io else 0
                metrics["net_sent"] = net_io.bytes_sent if net_io else 0
                metrics["net_recv"] = net_io.bytes_recv if net_io else 0
            else:
                metrics["cpu_percent"] = 0
                metrics["mem_percent"] = 0
                metrics["disk_read"] = 0
                metrics["disk_write"] = 0
                metrics["net_sent"] = 0
                metrics["net_recv"] = 0
            
            # Include partitions for real-time disk usage
            try:
                partitions = []
                if HAS_PSUTIL:
                    for part in psutil.disk_partitions():
                        if 'cdrom' not in part.opts and part.fstype != '':
                            try:
                                usage = psutil.disk_usage(part.mountpoint)
                                partitions.append({
                                    "mountpoint": part.mountpoint,
                                    "total": round(usage.total/(1024**3), 2),
                                    "used": round(usage.used/(1024**3), 2),
                                    "percent": usage.percent
                                })
                            except:
                                pass
                metrics["partitions"] = partitions
            except:
                pass
            
            safe_send(ws, json.dumps({
                "type": "performance_metrics",
                "data": metrics
            }))
            
    except Exception as e:
        safe_send(ws, json.dumps({"type": "error", "data": f"Monitor error: {str(e)}"}))

def handle_verify_result(ws, args):
    success = args.get("success", False)
    message = args.get("message", "未知错误")
    if not success:
        global ROOT_WINDOW
        if ROOT_WINDOW:
            def show_error():
                from tkinter import messagebox
                messagebox.showerror("连接失败", message)
            ROOT_WINDOW.after(0, show_error)
        else:
            print(f"[-] Connection failed: {message}")

def on_message(ws, message):
    def process_message(msg):
        global CURRENT_DIR, DEVICE_PASSWORD
        try:
            data = json.loads(msg)
            cmd = data.get("command") or data.get("type")
            if cmd == "verify_result":
                args = data
            else:
                args = data.get("args", {})
            print(f"[*] Received message: {cmd}")
            
            # Authentication check for all commands except verify_result, ping, and update_password_result
            if cmd not in ["verify_result", "ping", "update_password_result", "turn_config"]:
                req_device_id = data.get("deviceId")
                req_password = data.get("password")
                
                # Normalize device ID for comparison (remove spaces)
                local_id = DEVICE_ID.replace(" ", "")
                remote_id = str(req_device_id).replace(" ", "") if req_device_id else ""
                
                if remote_id != local_id or req_password != DEVICE_PASSWORD:
                    print(f"[-] Unauthorized command attempt: {cmd}")
                    safe_send(ws, json.dumps({"type": "error", "data": "Unauthorized: Invalid device ID or password"}))
                    return
            
            if cmd == "verify_result":
                handle_verify_result(ws, args)
            elif cmd == "ping":
                print("[*] Responding to ping...")
                info = get_system_info()
                safe_send(ws, json.dumps({
                    "type": "pong", 
                    "deviceId": DEVICE_ID.replace(" ", ""), 
                    "password": DEVICE_PASSWORD, 
                    "role": CLIENT_ROLE,
                    "data": info
                }))
                
            elif cmd == "assistance_response":
                success = data.get("success", False)
                message = data.get("message", "未知错误")
                if success:
                    messagebox.showinfo("协助请求", "对方已接受您的协助请求！")
                else:
                    messagebox.showerror("协助请求", f"请求失败: {message}")
                
            elif cmd == "turn_config":
                global RTC_CONFIG_FUTURE
                if RTC_LOOP and RTC_CONFIG_FUTURE and not RTC_CONFIG_FUTURE.done():
                    enc_data = data.get("encryptedData")
                    RTC_LOOP.call_soon_threadsafe(lambda: RTC_CONFIG_FUTURE.set_result(enc_data) if not RTC_CONFIG_FUTURE.done() else None)

            elif cmd == "webrtc_offer":
                if not HAS_AIORTC:
                    print("[-] 错误: aiortc 库未安装，无法建立 WebRTC 连接！")
                    print("    请在您的终端/命令行执行以下命令安装所有必需依赖：")
                    print("    pip install aiortc websocket-client psutil pyautogui mss Pillow dxcam numpy pyaudio pystray pywebview certifi")
                elif not RTC_LOOP:
                    print("[-] 错误: RTC_LOOP 未初始化！")
                else:
                    sdp = args.get("sdp")
                    if sdp:
                        try:
                            asyncio.run_coroutine_threadsafe(setup_webrtc(sdp), RTC_LOOP)
                        except Exception as e:
                            print(f"[-] 提交 setup_webrtc 任务失败: {e}")
            elif cmd == "webrtc_ice_candidate":
                if HAS_AIORTC and RTC_LOOP:
                    candidate = args.get("candidate")
                    if candidate:
                        try:
                            asyncio.run_coroutine_threadsafe(add_ice_candidate(candidate), RTC_LOOP)
                        except Exception as e:
                            print(f"[-] 提交 add_ice_candidate 任务失败: {e}")
            elif cmd == "exec" and "terminal" in ENABLED_MODULES:
                try:
                    cmd_str = str(args).strip()
                    
                    # Handle drive switching (e.g. "D:", "d:")
                    if len(cmd_str) == 2 and cmd_str[1] == ':' and cmd_str[0].isalpha():
                        drive_root = cmd_str.upper() + os.sep
                        if os.path.isdir(drive_root):
                            CURRENT_DIR = drive_root
                            safe_send(ws, json.dumps({"type": "output", "data": f"Changed directory to {CURRENT_DIR}"}))
                        else:
                            safe_send(ws, json.dumps({"type": "error", "data": f"Drive not found: {cmd_str}"}))
                        return

                    # Handle cd command
                    if cmd_str.lower().startswith("cd"):
                        # Extract path
                        path_part = cmd_str[2:].strip()
                        
                        # Handle /d flag
                        if path_part.lower().startswith("/d"):
                             path_part = path_part[2:].strip()
                        
                        # If empty, show current dir
                        if not path_part:
                             safe_send(ws, json.dumps({"type": "output", "data": CURRENT_DIR}))
                             return
                        
                        # Handle quoted paths
                        if path_part.startswith('"') and path_part.endswith('"'):
                            path_part = path_part[1:-1]
                        
                        # Normalize slashes
                        path_part = path_part.replace('/', os.sep)
                        
                        # Resolve target
                        target_dir = None
                        if os.path.isdir(path_part):
                            target_dir = os.path.abspath(path_part)
                        elif os.path.isdir(os.path.join(CURRENT_DIR, path_part)):
                            target_dir = os.path.abspath(os.path.join(CURRENT_DIR, path_part))
                            
                        if target_dir:
                            CURRENT_DIR = target_dir
                            safe_send(ws, json.dumps({"type": "output", "data": f"Changed directory to {CURRENT_DIR}"}))
                        else:
                            safe_send(ws, json.dumps({"type": "error", "data": f"The system cannot find the path specified: {path_part}"}))
                        return

                    # Normal command execution
                    output = subprocess.check_output(args, shell=True, stderr=subprocess.STDOUT, cwd=CURRENT_DIR)
                    try:
                        decoded = output.decode('utf-8')
                    except:
                        try:
                            decoded = output.decode('gbk')
                        except:
                            decoded = output.decode('utf-8', errors='ignore')
                    safe_send(ws, json.dumps({"type": "output", "data": decoded}))
                except subprocess.CalledProcessError as e:
                    try:
                        decoded = e.output.decode('utf-8')
                    except:
                        try:
                            decoded = e.output.decode('gbk')
                        except:
                            decoded = e.output.decode('utf-8', errors='ignore')
                    safe_send(ws, json.dumps({"type": "output", "data": decoded}))
                except Exception as e:
                    safe_send(ws, json.dumps({"type": "error", "data": str(e)}))

            elif cmd == "screen":
                handle_screen(ws, args)
                
            elif cmd == "input":
                handle_input(ws, args)
                
            elif cmd == "files":
                handle_files(ws, args)
                
            elif cmd == "windows":
                handle_windows(ws, args)
                
            elif cmd == "window_stream":
                handle_window_stream(ws, args)
                
            elif cmd == "window_control":
                handle_window_control(ws, args)
                
            elif cmd == "window_input":
                handle_window_input(ws, args)
                
            elif cmd == "audio":
                handle_audio(ws, args)
                
            elif cmd == "audio_input":
                handle_audio_input(ws, args)
                
            elif cmd == "monitor":
                handle_monitor(ws, args)
                
            elif cmd == "privacy_screen":
                handle_privacy_screen(ws, args)
                
            elif cmd == "clipboard":
                handle_clipboard(ws, args)
                
            elif cmd == "chat":
                handle_chat(ws, args)
                
            elif cmd == "viewer_count":
                try:
                    count = args.get("count", 0)
                    if 'update_viewer_count' in globals():
                        globals()['update_viewer_count'](count)
                except Exception as e:
                    print(f"[-] Error updating viewer count: {e}")

        except Exception as e:
            print(f"[-] Error processing message: {e}")

    # Use a separate thread to process each message to avoid blocking the websocket thread
    # and to prevent one hanging command from blocking others.
    t = threading.Thread(target=process_message, args=(message,))
    t.daemon = True
    t.start()

def on_error(ws, error):
    print(f"[-] WebSocket error: {error}")

CHAT_WINDOW = None
CHAT_MESSAGES = []
CHAT_THREAD = None
import queue
CHAT_QUEUE = queue.Queue()

def chat_thread_func(ws):
    global CHAT_WINDOW
    try:
        import tkinter as tk
        from tkinter import scrolledtext
        from tkinter import filedialog
        import base64
        import io
        import pythoncom
        from PIL import Image, ImageTk
        import json
        
        pythoncom.CoInitialize()
        
        root = tk.Tk()
        root.withdraw() # Hide immediately
        set_window_icon(root)
        CHAT_WINDOW = root
        images = [] # Keep reference to images
        root.title("聊天窗口")
        root.attributes('-topmost', True)
        
        # Position bottom right
        window_width = 400
        window_height = 500
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x_cordinate = int((screen_width) - (window_width) - 20)
        y_cordinate = int((screen_height) - (window_height) - 40)
        
        root.geometry("{}x{}+{}+{}".format(window_width, window_height, x_cordinate, y_cordinate))
        root.minsize(window_width, window_height)
        root.resizable(True, True)
        root.deiconify() # Show
        
        chat_area = scrolledtext.ScrolledText(root, wrap=tk.WORD, state='disabled')
        chat_area.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
        
        input_frame = tk.Frame(root)
        input_frame.pack(fill=tk.X, padx=10, pady=(0, 10))
        
        msg_entry = tk.Entry(input_frame)
        msg_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        def send_msg(event=None):
            msg = msg_entry.get()
            if msg:
                chat_area.config(state='normal')
                chat_area.insert(tk.END, "我: " + msg + "\\n")
                chat_area.config(state='disabled')
                chat_area.yview(tk.END)
                msg_entry.delete(0, tk.END)
                # Send to server
                if WS_CLIENT:
                    safe_send(WS_CLIENT, json.dumps({
                        "type": "chat_message",
                        "data": {"type": "text", "content": msg}
                    }))
                
        msg_entry.bind("<Return>", send_msg)
        send_btn = tk.Button(input_frame, text="发送", command=send_msg)
        send_btn.pack(side=tk.RIGHT, padx=(5, 0))
        
        def send_image():
            try:
                file_path = filedialog.askopenfilename(
                    parent=root,
                    filetypes=[("Image files", "*.jpg *.jpeg *.png *.gif *.bmp")]
                )
                if file_path:
                    try:
                        with open(file_path, "rb") as f:
                            img_data = f.read()
                        b64_img = base64.b64encode(img_data).decode('utf-8')
                        
                        # Display locally
                        chat_area.config(state='normal')
                        chat_area.insert(tk.END, "我: [图片]\\n")
                        image = Image.open(io.BytesIO(img_data))
                        image.thumbnail((200, 200))
                        photo = ImageTk.PhotoImage(image, master=root)
                        images.append(photo)
                        chat_area.image_create(tk.END, image=photo)
                        chat_area.insert(tk.END, "\\n")
                        chat_area.config(state='disabled')
                        chat_area.yview(tk.END)
                        
                        # Send to server
                        if WS_CLIENT:
                            safe_send(WS_CLIENT, json.dumps({
                                "type": "chat_message",
                                "data": {"type": "image", "content": f"data:image/png;base64,{b64_img}"}
                            }))
                    except Exception as e:
                        print(f"Failed to send image: {e}")
            except Exception as e:
                print(f"Error in filedialog: {e}")

        img_btn = tk.Button(input_frame, text="图片", command=send_image)
        img_btn.pack(side=tk.RIGHT, padx=(5, 0))
        
        def on_closing():
            root.withdraw()
            
        root.protocol("WM_DELETE_WINDOW", on_closing)
        
        def check_queue():
            try:
                while True:
                    msg = CHAT_QUEUE.get_nowait()
                    chat_area.config(state='normal')
                    if msg["type"] == "text":
                        chat_area.insert(tk.END, "控制端: " + msg["content"] + "\\n")
                    elif msg["type"] == "image":
                        chat_area.insert(tk.END, "控制端: [图片]\\n")
                        try:
                            # Decode base64 image
                            content = msg["content"]
                            if ',' in content:
                                content = content.split(',')[1]
                            img_data = base64.b64decode(content)
                            image = Image.open(io.BytesIO(img_data))
                            image.thumbnail((200, 200))
                            photo = ImageTk.PhotoImage(image, master=root)
                            images.append(photo)
                            chat_area.image_create(tk.END, image=photo)
                            chat_area.insert(tk.END, "\\n")
                        except Exception as e:
                            chat_area.insert(tk.END, f"[图片加载失败: {e}]\\n")
                    chat_area.config(state='disabled')
                    chat_area.yview(tk.END)
                    
                    # Bring to front
                    root.deiconify()
                    root.lift()
                    root.attributes('-topmost', True)
            except queue.Empty:
                pass
            if CHAT_WINDOW:
                root.after(100, check_queue)
                
        root.after(100, check_queue)
        
        # Load history
        for msg in CHAT_MESSAGES:
            CHAT_QUEUE.put(msg)
        CHAT_MESSAGES.clear()
            
        root.mainloop()
    except Exception as e:
        print(f"Chat window error: {e}")

def handle_chat(ws, args):
    global CHAT_WINDOW, CHAT_THREAD
    action = args.get("action")
    
    if action == "send":
        msg_type = args.get("type", "text")
        content = args.get("content", "")
        
        msg = {"sender": "server", "type": msg_type, "content": content}
        
        if not CHAT_WINDOW:
            CHAT_MESSAGES.append(msg)
            CHAT_THREAD = threading.Thread(target=chat_thread_func, args=(ws,), daemon=True)
            CHAT_THREAD.start()
        else:
            CHAT_QUEUE.put(msg)

def on_close(ws, close_status_code, close_msg):
    global SERVER_CONNECTED
    SERVER_CONNECTED = False
    print("[-] Connection closed")

def on_open(ws):
    global SERVER_CONNECTED, CLIENT_ROLE
    SERVER_CONNECTED = True
    print(f"[+] Connected to server as {CLIENT_ROLE}")
    
    # Sync auth info immediately after handshake
    sync_auth_info(ws)
    
    # Send handshake
    print("[*] Sending registration...")
    info = get_system_info()
    safe_send(ws, json.dumps({
        "type": "register",
        "deviceId": DEVICE_ID,
        "password": DEVICE_PASSWORD,
        "role": CLIENT_ROLE,
        "data": info,
        "modules": ENABLED_MODULES
    }))

def launch_ui_agent(session_id):
    if platform.system() != "Windows": return
    try:
        import ctypes
        from ctypes import wintypes
        
        kernel32 = ctypes.windll.kernel32
        wtsapi32 = ctypes.windll.wtsapi32
        advapi32 = ctypes.windll.advapi32
        
        # 1. Get user token for the session
        hToken = wintypes.HANDLE()
        if not wtsapi32.WTSQueryUserToken(session_id, ctypes.byref(hToken)):
            print(f"[-] WTSQueryUserToken failed for session {session_id}")
            return False
            
        # 2. Duplicate token
        hTokenDup = wintypes.HANDLE()
        SecurityImpersonation = 2
        TokenPrimary = 1
        if not advapi32.DuplicateTokenEx(hToken, 0x02000000, None, SecurityImpersonation, TokenPrimary, ctypes.byref(hTokenDup)):
            print("[-] DuplicateTokenEx failed")
            kernel32.CloseHandle(hToken)
            return False
            
        # 3. Create process as user
        class STARTUPINFO(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("lpReserved", wintypes.LPWSTR), ("lpDesktop", wintypes.LPWSTR),
                        ("lpTitle", wintypes.LPWSTR), ("dwX", wintypes.DWORD), ("dwY", wintypes.DWORD),
                        ("dwXSize", wintypes.DWORD), ("dwYSize", wintypes.DWORD), ("dwXCountChars", wintypes.DWORD),
                        ("dwYCountChars", wintypes.DWORD), ("dwFillAttribute", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                        ("wShowWindow", wintypes.WORD), ("cbReserved2", wintypes.WORD), ("lpReserved2", ctypes.POINTER(ctypes.c_byte)),
                        ("hStdInput", wintypes.HANDLE), ("hStdOutput", wintypes.HANDLE), ("hStdError", wintypes.HANDLE)]
                        
        class PROCESS_INFORMATION(ctypes.Structure):
            _fields_ = [("hProcess", wintypes.HANDLE), ("hThread", wintypes.HANDLE),
                        ("dwProcessId", wintypes.DWORD), ("dwThreadId", wintypes.DWORD)]
                        
        si = STARTUPINFO()
        si.cb = ctypes.sizeof(STARTUPINFO)
        si.lpDesktop = ctypes.c_wchar_p("winsta0\\default")
        pi = PROCESS_INFORMATION()
        
        # Determine executable path
        import sys
        if getattr(sys, 'frozen', False):
            exe_path = sys.executable
            cmd_line = f'"{exe_path}" --monitor'
        else:
            exe_path = sys.executable
            cmd_line = f'"{exe_path}" "{os.path.abspath(__file__)}" --monitor'
            
        creation_flags = 0x00000010 # CREATE_NEW_CONSOLE
        
        # Set session ID in token
        class TOKEN_PRIVILEGES(ctypes.Structure):
            pass # Simplified, not strictly needed for basic CreateProcessAsUser if token is already duplicated
            
        res = advapi32.CreateProcessAsUserW(
            hTokenDup, None, cmd_line, None, None, False,
            creation_flags, None, None, ctypes.byref(si), ctypes.byref(pi)
        )
        
        if res:
            print(f"[+] Successfully launched UI agent in session {session_id}")
            kernel32.CloseHandle(pi.hProcess)
            kernel32.CloseHandle(pi.hThread)
            kernel32.CloseHandle(hToken)
            kernel32.CloseHandle(hTokenDup)
            return True
        else:
            print(f"[-] CreateProcessAsUserW failed: {kernel32.GetLastError()}")
            
        kernel32.CloseHandle(hToken)
        kernel32.CloseHandle(hTokenDup)
        return False
    except Exception as e:
        print(f"[-] launch_ui_agent error: {e}")
        return False

def start_ui_monitor_thread():
    if platform.system() != "Windows": return
    
    def monitor_loop():
        import time
        last_session = -1
        while True:
            try:
                current_session = get_session_id()
                # If there's an active user session (>0) and it changed
                if current_session > 0 and current_session != last_session:
                    # 检查是否锁屏
                    if is_session_locked(current_session):
                        # print(f"[*] Session {current_session} is locked. Waiting for unlock...")
                        pass
                    else:
                        print(f"[*] Detected active unlocked user session: {current_session}. Launching UI agent...")
                        if launch_ui_agent(current_session):
                            last_session = current_session
                        else:
                            print("[-] Failed to launch UI agent. Will retry.")
            except Exception as e:
                pass
            time.sleep(5)
            
    import threading
    threading.Thread(target=monitor_loop, daemon=True).start()

def check_local_commands_loop():
    import json, os, platform, tempfile, time, hashlib
    global SYSTEM_AUTH_DIR
    cmd_dir = SYSTEM_AUTH_DIR
    cmd_file = os.path.join(cmd_dir, "cmd_queue.dat")
    auth_file = os.path.join(cmd_dir, "auth.dat")
    
    while True:
        try:
            if os.path.exists(cmd_file):
                with open(cmd_file, "r") as f:
                    cmd = json.load(f)
                os.remove(cmd_file) # Delete after reading
                
                if cmd.get("action") == "update_password":
                    new_pwd = cmd.get("password")
                    if new_pwd:
                        # 1. Update local auth.dat
                        key_stream = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
                        def xor_crypt(data, key):
                            return bytes([b ^ key[i % len(key)] for i, b in enumerate(data)])
                        encrypted = xor_crypt(new_pwd.encode(), key_stream)
                        with open(auth_file, "wb") as f:
                            f.write(encrypted)
                        
                        # 2. Update global variable
                        global DEVICE_PASSWORD
                        DEVICE_PASSWORD = new_pwd
                        print(f"[*] Password updated via IPC to: {DEVICE_PASSWORD}")
                        
                        # Notify WebView if active
                        if WEBVIEW_WINDOW:
                            try:
                                WEBVIEW_WINDOW.evaluate_js(f"if(window.onPasswordChanged) window.onPasswordChanged('{DEVICE_PASSWORD}')")
                            except: pass
                        
                        # 3. Send to server
                        if 'WS_CLIENT' in globals() and WS_CLIENT and SERVER_CONNECTED:
                            safe_send(WS_CLIENT, json.dumps({
                                "type": "update_password",
                                "deviceId": DEVICE_ID.replace(" ", ""),
                                "role": CLIENT_ROLE,
                                "data": {"password": DEVICE_PASSWORD}
                            }))
        except Exception as e:
            print(f"[-] Error processing local command: {e}")
            try: os.remove(cmd_file)
            except: pass
        time.sleep(2)

def show_update_dialog(name, desc, url, force):
    """显示更新对话框 - 全局可用"""
    try:
        global ROOT_WINDOW
        root = ROOT_WINDOW
        if not root:
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()
            ROOT_WINDOW = root

        update_win = tk.Toplevel(root)
        update_win.title("发现新版本")
        update_win.geometry("400x320")
        update_win.resizable(False, False)
        update_win.attributes("-topmost", True)
        
        # Center window
        update_win.update_idletasks()
        width = update_win.winfo_width()
        height = update_win.winfo_height()
        x = (update_win.winfo_screenwidth() // 2) - (width // 2)
        y = (update_win.winfo_screenheight() // 2) - (height // 2)
        update_win.geometry(f'{width}x{height}+{x}+{y}')

        if force:
            update_win.protocol("WM_DELETE_WINDOW", lambda: sys.exit(0))
        
        tk.Label(update_win, text=f"发现新版本: {name}", font=("Arial", 12, "bold")).pack(pady=10)
        
        import tkinter.ttk as ttk
        desc_frame = ttk.Frame(update_win)
        desc_frame.pack(padx=20, pady=5, fill=tk.BOTH, expand=True)
        
        desc_text = tk.Text(desc_frame, height=8, width=45, font=("Arial", 10))
        desc_text.insert(tk.END, desc)
        desc_text.config(state=tk.DISABLED)
        desc_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(desc_frame, command=desc_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        desc_text['yscrollcommand'] = scrollbar.set
        
        btn_frame = ttk.Frame(update_win)
        btn_frame.pack(pady=10)
        
        def start_update():
            update_win.destroy()
            import threading
            threading.Thread(target=perform_update, args=(url,), daemon=True).start()
        
        ttk.Button(btn_frame, text="立即更新", command=start_update).pack(side=tk.LEFT, padx=10)
        
        if not force:
            ttk.Button(btn_frame, text="以后再说", command=update_win.destroy).pack(side=tk.LEFT, padx=10)
        else:
            tk.Label(update_win, text="此版本为强制更新，请更新后使用", fg="red", font=("Arial", 9)).pack()
    except Exception as e:
        print(f"Failed to show update dialog: {e}")
        
        ttk.Button(btn_frame, text="立即更新", command=start_update).pack(side=tk.LEFT, padx=10)
        
        if not force:
            ttk.Button(btn_frame, text="以后再说", command=update_win.destroy).pack(side=tk.LEFT, padx=10)
        else:
            tk.Label(update_win, text="此版本为强制更新，请更新后使用", fg="red", font=("Arial", 9)).pack()
    except Exception as e:
        print(f"Failed to show update dialog: {e}")

def perform_update(url):
    """执行更新过程 - 全局可用"""
    try:
        import requests
        import tempfile
        import tkinter as tk
        import tkinter.ttk as ttk
        from tkinter import messagebox
        global ROOT_WINDOW
        root = ROOT_WINDOW
        
        if not root:
            root = tk.Tk()
            root.withdraw()
            ROOT_WINDOW = root

        # Create a progress window
        progress_win = tk.Toplevel(root)
        progress_win.title("正在更新...")
        progress_win.geometry("300x120")
        progress_win.attributes("-topmost", True)
        
        # Center window
        progress_win.update_idletasks()
        x = (progress_win.winfo_screenwidth() // 2) - (150)
        y = (progress_win.winfo_screenheight() // 2) - (60)
        progress_win.geometry(f'300x120+{x}+{y}')
        
        tk.Label(progress_win, text="正在下载新版本，请稍候...", font=("Arial", 10)).pack(pady=20)
        progress = ttk.Progressbar(progress_win, length=200, mode='determinate')
        progress.pack(pady=5)
        
        response = requests.get(url, stream=True, timeout=60)
        if response.status_code == 200:
            total_size = int(response.headers.get('content-length', 0))
            auth_dir = SYSTEM_AUTH_DIR
            if not os.path.exists(auth_dir):
                try: os.makedirs(auth_dir)
                except: pass
            temp_exe = os.path.join(auth_dir, "RootDesk_update.exe")
            
            downloaded = 0
            with open(temp_exe, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress['value'] = (downloaded / total_size) * 100
                            progress_win.update()
            
            # Replacement VBScript
            def get_long_path(p):
                try:
                    import ctypes
                    buf = ctypes.create_unicode_buffer(1024)
                    if ctypes.windll.kernel32.GetLongPathNameW(str(p), buf, 1024):
                        return buf.value
                except: pass
                return str(p)
                
            vbs_current_exe = get_long_path(sys.executable).replace('"', '""')
            vbs_temp_exe = get_long_path(temp_exe).replace('"', '""')
            vbs_script = get_long_path(os.path.join(tempfile.gettempdir(), "rd_update.vbs"))
            exe_name = os.path.basename(vbs_current_exe)
            
            vbs_content = f'''Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
WScript.Sleep 2000
' Try to stop service if it exists
On Error Resume Next
shell.Run "sc stop RootDeskService", 0, True
' Force kill process
shell.Run "taskkill /f /im ""{exe_name}""", 0, True
On Error GoTo 0
WScript.Sleep 1000
' Loop until delete succeeds (to handle locks)
Do While fso.FileExists("{vbs_current_exe}")
    On Error Resume Next
    fso.DeleteFile "{vbs_current_exe}", True
    If Err.Number = 0 Then Exit Do
    On Error GoTo 0
    WScript.Sleep 1000
Loop
' Move new exe
If fso.FileExists("{vbs_temp_exe}") Then
    ' Ensure destination directory exists
    destDir = fso.GetParentFolderName("{vbs_current_exe}")
    If Not fso.FolderExists(destDir) Then
        MsgBox "更新失败：目标目录不存在 " & destDir, 16, "错误"
        WScript.Quit
    End If
    fso.MoveFile "{vbs_temp_exe}", "{vbs_current_exe}"
Else
    MsgBox "更新失败：找不到下载的更新文件 " & "{vbs_temp_exe}", 16, "错误"
    WScript.Quit
End If
' Restart service or app
On Error Resume Next
shell.Run "sc start RootDeskService", 0, False
shell.Run chr(34) & "{vbs_current_exe}" & chr(34), 1, False
' Self delete
Set f = fso.GetFile(WScript.ScriptFullName)
f.Delete
'''
            with open(vbs_script, "w", encoding="gbk") as f:
                f.write(vbs_content)
            
            subprocess.Popen(["wscript.exe", vbs_script], shell=True)
            os._exit(0)
        else:
            messagebox.showerror("错误", f"下载失败，状态码: {response.status_code}")
            progress_win.destroy()
    except Exception as e:
        print(f"Perform update failed: {e}")
        try: messagebox.showerror("更新失败", str(e))
        except: pass

def start_local_ui():
    global HAS_TKINTER, DEVICE_ID, DEVICE_PASSWORD, PLATFORM_MODE, SERVER_CONNECTED, STREAM_RUNNING, PORT, HOST, VIEWER_COUNT, ROOT_WINDOW
    if not HAS_TKINTER or ROOT_WINDOW:
        return
    
    try:
        import tkinter as tk
        from tkinter import messagebox, ttk
        import webbrowser
        
        # Define update_viewer_count globally so on_message can call it
        def update_viewer_count(count):
            global VIEWER_COUNT
            VIEWER_COUNT = count
        globals()['update_viewer_count'] = update_viewer_count
        
        root = tk.Tk()
        root.withdraw() # Hide immediately to prevent flickering
        
        # Ensure DPI settings are applied and layout is ready
        root.update_idletasks()
        
        set_window_icon(root)
        ROOT_WINDOW = root
        root.title(f"RootDesk v{CLIENT_VERSION_NAME}")
        
        # Calculate center position first
        window_width = 500
        window_height = 400
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width // 2) - (window_width // 2)
        y = (screen_height // 2) - (window_height // 2)
        
        # Set geometry and strictly lock size
        root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        root.minsize(window_width, window_height)
        root.resizable(True, True)
        
        root.deiconify() # Show now that everything is ready
        
        notebook = ttk.Notebook(root)
        notebook.pack(fill='both', expand=True, padx=10, pady=10)
        
        # --- Home Tab ---
        frame_home = ttk.Frame(notebook)
        notebook.add(frame_home, text='首页')
        
        # --- Assistance Tab ---
        frame_assist = ttk.Frame(notebook)
        notebook.add(frame_assist, text='协助')
        
        tk.Label(frame_assist, text="发起协助请求", font=("Arial", 12, "bold")).pack(pady=(20, 10))
        tk.Label(frame_assist, text="输入对方的9位协助码以请求其控制此设备", font=("Arial", 9), fg="gray").pack(pady=(0, 20))
        
        assist_entry_frame = ttk.Frame(frame_assist)
        assist_entry_frame.pack(pady=10)
        
        tk.Label(assist_entry_frame, text="协助码:", font=("Arial", 10, "bold")).grid(row=0, column=0, padx=5)
        assist_code_entry = ttk.Entry(assist_entry_frame, font=("Arial", 12), width=15, justify='center')
        assist_code_entry.grid(row=0, column=1, padx=5)
        
        def send_assist_request():
            code = assist_code_entry.get().strip().replace(" ", "")
            if not code or len(code) != 9 or not code.isdigit():
                messagebox.showerror("错误", "请输入有效的9位数字协助码")
                return
            
            if not SERVER_CONNECTED or not WS_CLIENT:
                messagebox.showerror("错误", "未连接到服务器，请稍后再试")
                return
            
            # Send assistance request
            safe_send(WS_CLIENT, json.dumps({
                "type": "assistance_request",
                "code": code,
                "deviceId": DEVICE_ID.replace(" ", ""),
                "password": DEVICE_PASSWORD,
                "info": get_system_info()
            }))
            messagebox.showinfo("请求已发送", f"已向协助码 {code} 发起请求\\n请等待对方接受")
            
        ttk.Button(frame_assist, text="发起请求", command=send_assist_request).pack(pady=20)

        # --- Home Tab Content ---
        tk.Label(frame_home, text="RootDesk 远程控制", font=("Arial", 14, "bold")).pack(pady=(10, 5))
        
        info_frame = ttk.Frame(frame_home)
        info_frame.pack(pady=5)
        
        tk.Label(info_frame, text="设备代码:", font=("Arial", 10, "bold")).grid(row=0, column=0, sticky="e", padx=5, pady=2)
        tk.Label(info_frame, text=DEVICE_ID, font=("Arial", 10)).grid(row=0, column=1, sticky="w", padx=5, pady=2)
        
        tk.Label(info_frame, text="设备密码:", font=("Arial", 10, "bold")).grid(row=1, column=0, sticky="e", padx=5, pady=2)
        pwd_label = tk.Label(info_frame, text=DEVICE_PASSWORD, font=("Arial", 10))
        pwd_label.grid(row=1, column=1, sticky="w", padx=5, pady=2)
        
        def change_password():
            import random
            import string
            import json
            import os
            import tempfile
            import platform
            global DEVICE_PASSWORD, SERVER_CONNECTED, WS_CLIENT
            # Generate 8-character alphanumeric password (Uppercase only)
            new_pwd = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            DEVICE_PASSWORD = new_pwd
            
            # 1. 写入命令队列，让服务进程同步 (Service 模式)
            try:
                cmd_dir = SYSTEM_AUTH_DIR
                os.makedirs(cmd_dir, exist_ok=True)
                cmd_file = os.path.join(cmd_dir, "cmd_queue.dat")
                
                with open(cmd_file, "w") as f:
                    json.dump({"action": "update_password", "password": new_pwd}, f)
            except Exception as e:
                print(f"[-] 写入状态文件失败: {e}")
                
            # 2. 如果当前进程已连接服务器 (Portable 模式)，直接同步
            if 'WS_CLIENT' in globals() and WS_CLIENT and SERVER_CONNECTED:
                try:
                    safe_send(WS_CLIENT, json.dumps({
                        "type": "update_password",
                        "deviceId": DEVICE_ID.replace(" ", ""),
                        "role": CLIENT_ROLE,
                        "data": {"password": new_pwd}
                    }))
                except Exception as e:
                    print(f"[-] 发送新密码至服务器失败: {e}")
            
            # 3. 更新 UI
            pwd_label.config(text=DEVICE_PASSWORD)
            messagebox.showinfo("密码已更改", f"新密码: {DEVICE_PASSWORD}")
            
        def copy_control_link():
            from tkinter import messagebox
            clean_id = DEVICE_ID.replace(" ", "")
            # Ensure APP_URL is correctly formatted
            base_url = APP_URL
            if not base_url.endswith("/"):
                base_url += "/"
            link = f"{base_url}?deviceId={clean_id}&password={DEVICE_PASSWORD}"
            try:
                root.clipboard_clear()
                root.clipboard_append(link)
                root.update()
                messagebox.showinfo("成功", f"控制链接已复制到剪贴板\\n他人访问即可快捷添加此设备")
            except Exception as e:
                messagebox.showerror("错误", f"复制失败: {e}")

        ttk.Button(info_frame, text="更改密码", command=change_password).grid(row=1, column=2, padx=5)
        ttk.Button(info_frame, text="复制链接", command=copy_control_link).grid(row=1, column=3, padx=5)
        
        status_frame = ttk.Frame(frame_home)
        status_frame.pack(pady=5)
        
        conn_label = tk.Label(status_frame, text="服务器状态: 连接中...", fg="orange", font=("Arial", 10))
        conn_label.grid(row=0, column=0, padx=10)
        
        ctrl_label = tk.Label(status_frame, text="控制状态: 空闲", fg="green", font=("Arial", 10))
        ctrl_label.grid(row=0, column=1, padx=10)
        
        # --- Driver & Service Missing Warning (ToDesk style) ---
        if (not HAS_INTERCEPTION or SHOW_SERVICE_WARNING) and platform.system() == "Windows":
            driver_frame = tk.Frame(frame_home, bg="#FFF9C4", bd=1, relief="solid") # Light yellow background
            driver_frame.pack(fill=tk.X, padx=20, pady=10)
            
            # Dynamic message based on missing items
            if not is_admin():
                warning_text = "需要管理员权限以安装驱动及服务"
                button_text = "立即提升"
            elif not HAS_INTERCEPTION and SHOW_SERVICE_WARNING:
                warning_text = "检测到未安装控制驱动及系统服务，无法正常控制"
                button_text = "立即安装"
            elif not HAS_INTERCEPTION:
                warning_text = "检测到未安装控制驱动，无法进行鼠标键盘控制"
                button_text = "立即安装"
            else:
                warning_text = "检测到未安装系统服务，程序可能运行不稳定"
                button_text = "立即安装"

            warning_label = tk.Label(driver_frame, text=warning_text, bg="#FFF9C4", fg="#856404", font=("Arial", 9))
            warning_label.pack(side=tk.LEFT, padx=10, pady=5)
            
            def on_driver_install_click():
                if not is_admin():
                    if messagebox.askyesno("权限不足", "安装驱动及服务需要管理员权限。是否尝试立即提升权限？"):
                        elevate_process()
                    return
                
                install_msg = "安装驱动及服务" if not HAS_INTERCEPTION and SHOW_SERVICE_WARNING else ("安装驱动" if not HAS_INTERCEPTION else "注册服务")
                if messagebox.askyesno(install_msg, f"{install_msg}需要管理员权限，并会在完成后重启电脑。是否继续？"):
                    install_interception_driver()

            install_btn = tk.Button(driver_frame, text=button_text, command=on_driver_install_click, bg="#0078D4", fg="white", font=("Arial", 9, "bold"), relief="flat", padx=10)
            install_btn.pack(side=tk.RIGHT, padx=10, pady=5)
            install_btn.bind("<Enter>", lambda e: install_btn.config(cursor="hand2"))
        
        # --- Ad Banner & Update Check ---
        if HAS_PIL:
            ad_frame = tk.Frame(frame_home, height=120, bg="white")
            ad_frame.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=(0, 10))
            ad_frame.pack_propagate(False)
            
            ad_label = tk.Label(ad_frame, bg="white", cursor="hand2", borderwidth=0, highlightthickness=0)
            ad_label.pack(fill=tk.BOTH, expand=True)
            
            ads_list = []
            current_ad_idx = [0]
            is_cycling = [False]
            last_image_url = [None]
            
            def fetch_ads_thread():
                while ROOT_WINDOW:
                    try:
                        import requests
                        # Use APP_URL if available, otherwise fallback to HOST:PORT
                        base_url = APP_URL if APP_URL else f"http://{HOST}:{PORT}"
                        if not base_url.startswith("http"):
                            base_url = "http://" + base_url
                        
                        base_url = base_url.rstrip('/')
                        
                        response = requests.get(f"{base_url}/ad.json", timeout=5)
                        if response.status_code == 200:
                            data = response.json()
                            
                            # --- Update Check ---
                            server_version = data.get("version", 0)
                            if server_version > CLIENT_VERSION:
                                v_name = data.get("version_name", "Unknown")
                                v_desc = data.get("version_desc", "")
                                v_url = data.get("version_url", "")
                                v_q = data.get("version_q", 0)
                                root.after(0, lambda: show_update_dialog(v_name, v_desc, v_url, v_q))
                            
                            # Update Ads
                            client_ads = data.get("client", [])
                            if isinstance(client_ads, list) and len(client_ads) > 0:
                                ads_list.clear()
                                ads_list.extend(client_ads)
                                # Only start cycling if not already cycling
                                if not is_cycling[0]:
                                    root.after(0, show_next_ad)
                            else:
                                root.after(0, lambda: ad_frame.pack_forget())
                        else:
                            # If first fetch fails, hide ad frame
                            if not ads_list:
                                root.after(0, lambda: ad_frame.pack_forget())
                    except Exception as e:
                        print(f"Failed to fetch ads/updates: {e}")
                        if not ads_list:
                            root.after(0, lambda: ad_frame.pack_forget())
                    
                    # 循环每 3 分钟刷新一次
                    import time
                    time.sleep(180)

            def show_next_ad():
                if not ads_list or not ROOT_WINDOW: 
                    is_cycling[0] = False
                    return
                
                is_cycling[0] = True
                idx = current_ad_idx[0]
                ad = ads_list[idx]
                image_url = ad.get("imageUrl")
                click_url = ad.get("clickUrl")
                
                # If image_url is the same as last one and only one ad, don't reload
                if image_url == last_image_url[0] and len(ads_list) == 1:
                    is_cycling[0] = False # Stop cycling for now, fetch_ads_thread will trigger again
                    return

                def load_and_display():
                    try:
                        import requests
                        from PIL import Image, ImageTk
                        import io
                        
                        # Only download if different from last one
                        if image_url != last_image_url[0]:
                            img_res = requests.get(image_url, timeout=5)
                            if img_res.status_code == 200:
                                img_data = img_res.content
                                image = Image.open(io.BytesIO(img_data))
                                
                                # Proportional scaling (Contain)
                                max_w, max_h = 370, 110 
                                img_w, img_h = image.size
                                
                                resample = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
                                image.thumbnail((max_w, max_h), resample)
                                
                                new_w, new_h = image.size
                                
                                final_image = Image.new("RGB", (380, 120), "white")
                                offset = ((380 - new_w) // 2, (120 - new_h) // 2)
                                
                                if image.mode in ('RGBA', 'LA'):
                                    final_image.paste(image, offset, image)
                                else:
                                    final_image.paste(image, offset)
                                
                                image = final_image
                                photo = ImageTk.PhotoImage(image)
                                last_image_url[0] = image_url
                            else:
                                # Skip this one
                                current_ad_idx[0] = (current_ad_idx[0] + 1) % len(ads_list)
                                root.after(1000, show_next_ad)
                                return
                        else:
                            # Use existing photo if available (though we don't store it easily here)
                            # For simplicity, if it's the same URL but we have multiple ads, 
                            # we still need to show it. But if we don't have the 'photo' object,
                            # we might need to reload.
                            # However, if it's the same URL, it's likely the same ad.
                            pass

                        # If we skipped download because it's the same URL, we still need to update UI
                        # but we need the 'photo' object. Let's just reload if it's part of a rotation.
                        # The main fix is for the single-ad case.
                        
                        if image_url == last_image_url[0] and 'photo' not in locals():
                            # Re-download if we don't have the photo object
                            img_res = requests.get(image_url, timeout=5)
                            if img_res.status_code == 200:
                                img_data = img_res.content
                                image = Image.open(io.BytesIO(img_data))
                                max_w, max_h = 370, 110 
                                resample = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
                                image.thumbnail((max_w, max_h), resample)
                                new_w, new_h = image.size
                                final_image = Image.new("RGB", (380, 120), "white")
                                offset = ((380 - new_w) // 2, (120 - new_h) // 2)
                                if image.mode in ('RGBA', 'LA'):
                                    final_image.paste(image, offset, image)
                                else:
                                    final_image.paste(image, offset)
                                image = final_image
                                photo = ImageTk.PhotoImage(image)
                                last_image_url[0] = image_url

                        def update_ui():
                            if not ROOT_WINDOW: return
                            ad_label.config(image=photo)
                            ad_label.image = photo
                            ad_label.bind("<Button-1>", lambda e, url=click_url: open_url(url))
                            
                            # Schedule next ONLY if more than 1 ad
                            if len(ads_list) > 1:
                                current_ad_idx[0] = (current_ad_idx[0] + 1) % len(ads_list)
                                root.after(5000, show_next_ad)
                            else:
                                is_cycling[0] = False
                                
                        root.after(0, update_ui)
                    except Exception as e:
                        print(f"Error loading ad image: {e}")
                        is_cycling[0] = False
                        if len(ads_list) > 1:
                            current_ad_idx[0] = (current_ad_idx[0] + 1) % len(ads_list)
                            root.after(1000, show_next_ad)

                threading.Thread(target=load_and_display, daemon=True).start()

            def open_url(url):
                if url and url != "#":
                    import webbrowser
                    webbrowser.open(url)

            threading.Thread(target=fetch_ads_thread, daemon=True).start()
        
        # --- Control Tab ---
        frame_control = ttk.Frame(notebook)
        notebook.add(frame_control, text='控制')
        
        tk.Label(frame_control, text="控制端网页", font=("Arial", 12, "bold")).pack(pady=(20, 10))
        tk.Label(frame_control, text="点击下方按钮在浏览器中打开控制端网页即可控制其他设备", justify="center").pack(pady=10)
        
        def open_web():
            port_str = str(PORT)
            protocol = "https" if port_str == "443" else "http"
            if port_str in ["80", "443", ""]:
                url = f"{protocol}://{HOST}"
            else:
                url = f"{protocol}://{HOST}:{PORT}"
            webbrowser.open(url)
            
        ttk.Button(frame_control, text="打开控制端网页", command=open_web).pack(pady=10)
        
        # --- Settings Tab ---
        frame_settings = ttk.Frame(notebook)
        notebook.add(frame_settings, text='设置')
        
        # Server Config Section
        tk.Label(frame_settings, text="服务器配置", font=("Arial", 12, "bold")).pack(pady=(10, 5))
        
        server_frame = ttk.Frame(frame_settings)
        server_frame.pack(pady=5)
        
        tk.Label(server_frame, text="服务器地址:").grid(row=0, column=0, sticky="e", padx=5, pady=2)
        host_entry = ttk.Entry(server_frame, width=25)
        host_entry.insert(0, HOST)
        host_entry.grid(row=0, column=1, sticky="w", padx=5, pady=2)
        
        tk.Label(server_frame, text="端口:").grid(row=1, column=0, sticky="e", padx=5, pady=2)
        port_entry = ttk.Entry(server_frame, width=10)
        port_entry.insert(0, str(PORT))
        port_entry.grid(row=1, column=1, sticky="w", padx=5, pady=2)
        
        tk.Label(server_frame, text="协议:").grid(row=2, column=0, sticky="e", padx=5, pady=2)
        protocol_var = tk.StringVar(value=PROTOCOL)
        protocol_combo = ttk.Combobox(server_frame, textvariable=protocol_var, values=["ws", "wss"], width=8, state="readonly")
        protocol_combo.grid(row=2, column=1, sticky="w", padx=5, pady=2)
        
        def save_server_settings():
            global HOST, PORT, PROTOCOL
            new_host = host_entry.get().strip()
            new_port = port_entry.get().strip()
            new_protocol = protocol_var.get()
            
            if not new_host:
                messagebox.showerror("错误", "服务器地址不能为空")
                return
            
            try:
                # Update global variables
                HOST = new_host
                PORT = new_port
                PROTOCOL = new_protocol
                
                # Save to file
                config_dir = SYSTEM_AUTH_DIR
                config_file = os.path.join(config_dir, "server.json")
                os.makedirs(config_dir, exist_ok=True)
                with open(config_file, "w") as f:
                    import json
                    json.dump({"host": HOST, "port": PORT, "protocol": PROTOCOL}, f)
                
                messagebox.showinfo("成功", "服务器配置已保存，将在下次重连时生效。")
            except Exception as e:
                messagebox.showerror("错误", f"保存失败: {e}")
                
        ttk.Button(frame_settings, text="保存配置", command=save_server_settings).pack(pady=5)
        
        ttk.Separator(frame_settings, orient='horizontal').pack(fill='x', padx=20, pady=10)
        
        tk.Label(frame_settings, text="系统服务管理", font=("Arial", 12, "bold")).pack(pady=(5, 5))
        
        def on_install_service():
            if not is_admin():
                if messagebox.askyesno("权限不足", "安装系统服务需要管理员权限。是否尝试立即提升权限？"):
                    elevate_process()
                return
            
            # 与首页功能保持一致：安装驱动及服务并提示重启
            install_msg = "安装驱动及服务" if not HAS_INTERCEPTION and SHOW_SERVICE_WARNING else ("安装驱动" if not HAS_INTERCEPTION else "注册服务")
            if messagebox.askyesno(install_msg, f"{install_msg}需要管理员权限，并会在完成后重启电脑。是否继续？"):
                install_interception_driver()
                    
        def on_uninstall_service():
            if not is_admin():
                if messagebox.askyesno("权限不足", "卸载系统服务需要管理员权限。是否尝试立即提升权限？"):
                    elevate_process()
                return
            if messagebox.askyesno("卸载服务", "确定要卸载系统服务吗？\\n卸载完成后当前程序将退出，请重新手动运行。"):
                if uninstall_windows_service():
                    messagebox.showinfo("成功", "系统服务卸载成功！程序即将退出。")
                    root.destroy()
                    os._exit(0)
                else:
                    messagebox.showerror("失败", "系统服务卸载失败，请检查日志。")
                    
        btn_frame = ttk.Frame(frame_settings)
        btn_frame.pack(pady=10)
        
        ttk.Button(btn_frame, text="安装为系统服务", command=on_install_service).grid(row=0, column=0, padx=10)
        ttk.Button(btn_frame, text="卸载系统服务", command=on_uninstall_service).grid(row=0, column=1, padx=10)
        
        def update_ui():
            # Keep password label in sync
            try:
                if pwd_label.cget("text") != DEVICE_PASSWORD:
                    pwd_label.config(text=DEVICE_PASSWORD)
            except: pass

            if SERVER_CONNECTED:
                conn_label.config(text="服务器状态: 已连接", fg="green")
            else:
                conn_label.config(text="服务器状态: 未连接", fg="red")
                
            if STREAM_RUNNING or VIEWER_COUNT > 0:
                ctrl_label.config(text=f"控制状态: 正在被控制 ({VIEWER_COUNT}个控制端)", fg="red")
            else:
                ctrl_label.config(text="", fg="green")
                
            root.after(1000, update_ui)
            
        root.after(1000, update_ui)
        
        def on_close():
            global TRAY_ICON
            should_tray = CLIENT_SETTINGS.get("trayIcon", True)
            if should_tray and HAS_PYSTRAY:
                root.withdraw() # Hide window to tray
                if not TRAY_ICON:
                    threading.Thread(target=create_tray_icon, daemon=True).start()
            else:
                if messagebox.askokcancel("退出", "确定要退出客户端吗？"):
                    root.destroy()
                    os._exit(0)
        
        root.protocol("WM_DELETE_WINDOW", on_close)
        root.mainloop()
    except Exception as e:
        print(f"[-] Local UI Error: {e}")

def connect(role="service"):
    global WS_CLIENT, CLIENT_ROLE
    CLIENT_ROLE = role
    
    # Start local UI if on PC and role is desktop or portable
    # Only start native Tkinter UI if webview is not available or disabled
    use_webview = HAS_WEBVIEW and "--no-ui" not in sys.argv
    if PLATFORM_MODE == "pc" and HAS_TKINTER and role in ["desktop", "portable"] and not use_webview:
        threading.Thread(target=start_local_ui, daemon=True).start()

    # Start stream worker thread if screen module is enabled and role is desktop or portable
    if "screen" in ENABLED_MODULES and role in ["desktop", "portable"]:
        t = threading.Thread(target=stream_worker, daemon=True)
        t.start()
    
    # Start heartbeat worker to proactively identify to server (helps after server restart)
    def heartbeat_worker():
        while True:
            if SERVER_CONNECTED and WS_CLIENT:
                try:
                    info = get_system_info()
                    # Use register message for heartbeat to ensure server always has full info
                    # even if it just restarted and lost our state
                    safe_send(WS_CLIENT, json.dumps({
                        "type": "register",
                        "deviceId": DEVICE_ID.replace(" ", ""),
                        "password": DEVICE_PASSWORD,
                        "role": CLIENT_ROLE,
                        "data": info,
                        "modules": ENABLED_MODULES
                    }))
                except: pass
            time.sleep(10)
    
    t_hb = threading.Thread(target=heartbeat_worker, daemon=True)
    t_hb.start()
        
    while True:
        try:
            # Determine protocol
            port_str = str(PORT)
            ws_protocol = PROTOCOL
            if port_str in ["80", "443", ""]:
                ws_url = f"{ws_protocol}://{HOST}/ws"
            else:
                ws_url = f"{ws_protocol}://{HOST}:{PORT}/ws"
            print(f"[*] Connecting to {ws_url}...")
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            WS_CLIENT = ws
            
            sslopt = {}
            if ws_protocol == "wss":
                if HAS_CERTIFI:
                    try:
                        ssl_context = ssl.create_default_context(cafile=certifi.where())
                        sslopt["context"] = ssl_context
                        print("[*] Using certifi for SSL certificates")
                    except Exception as ssl_err:
                        print(f"[*] Failed to create SSL context with certifi: {ssl_err}")
                        sslopt["cert_reqs"] = ssl.CERT_NONE
                else:
                    # Fallback: disable verification if certifi is missing and it's wss on an old system
                    print("[!] certifi not found, disabling SSL verification for wss")
                    sslopt["cert_reqs"] = ssl.CERT_NONE
            
            ws.run_forever(sslopt=sslopt)
        except Exception as e:
            print(f"[-] Connection failed: {e}")
        
        print(f"[*] Reconnecting in {RECONNECT_INTERVAL} seconds...")
        time.sleep(RECONNECT_INTERVAL)

class RootDeskBridge:
    """前端 JS 桥接类 - 复用 client.py 中的全局变量"""

    def get_app_url(self):
        return {
            "url": APP_URL 
        }


    def get_init_data(self):
        return {
            "deviceId": DEVICE_ID,
            "devicePassword": DEVICE_PASSWORD,
            "serverConnected": SERVER_CONNECTED,
            "viewerCount": VIEWER_COUNT,
            "role": CLIENT_ROLE,
            "version": CLIENT_VERSION_NAME,
            "versionCode": CLIENT_VERSION,
            "hasInterception": HAS_INTERCEPTION,
            "hasService": HAS_SERVICE,
            "isAdmin": is_admin() if platform.system() == "Windows" else True
        }

    def decrypt_password(self, encrypted_pwd):
        """解密密码给前端使用"""
        try:
            # 检查是否已经是明文（比如长度为8位字母数字组合）
            if len(encrypted_pwd) == 8 and encrypted_pwd.isalnum() and encrypted_pwd.isupper():
                return {"success": True, "password": encrypted_pwd}
                
            key_stream = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
            encrypted_data = base64.b64decode(encrypted_pwd)
            decrypted_bytes = xor_crypt(encrypted_data, key_stream)
            return {"success": True, "password": decrypted_bytes.decode('utf-8')}
        except Exception as e:
            # 如果解密失败（可能本身就是明文或者格式不对），直接返回原字符串
            return {"success": True, "password": encrypted_pwd}

    def get_all_settings(self):
        return manage_settings("load")

    def get_saved_devices(self):
        """读取已保存的设备列表 (devices.json) 并解密密码"""
        try:
            device_file = os.path.join(SYSTEM_AUTH_DIR, "devices.json")
            if os.path.exists(device_file):
                with open(device_file, "r", encoding="utf-8") as f:
                    devices = json.load(f)
                
                # 解密每个设备的密码
                key_stream = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
                for d in devices:
                    if "password" in d and d["password"]:
                        pwd = d["password"]
                        # 如果密码看起来像是已经解密的（8位数字字母），则跳过
                        if len(pwd) == 8 and pwd.isalnum() and pwd.isupper():
                            continue
                            
                        try:
                            # 尝试 Base64 解码并解密
                            encrypted_data = base64.b64decode(pwd)
                            decrypted_bytes = xor_crypt(encrypted_data, key_stream)
                            decrypted = decrypted_bytes.decode('utf-8')
                            
                            d["password"] = decrypted
                        except Exception as e:
                            # 如果解密失败，保持原样（可能是旧版本的明文密码）
                            print(f"[Bridge] Decrypt password failed for device {d.get('id')}: {e}")
                
                return {"success": True, "devices": devices}
            return {"success": True, "devices": []}
        except Exception as e:
            return {"success": False, "error": str(e), "devices": []}

    def save_devices(self, devices_list):
        """保存设备列表到 devices.json 并加密密码"""
        try:
            cmd_dir = SYSTEM_AUTH_DIR
            os.makedirs(cmd_dir, exist_ok=True)
            device_file = os.path.join(cmd_dir, "devices.json")
            
            # 复制一份列表用于保存，避免修改原始对象
            save_list = json.loads(json.dumps(devices_list))
            
            # 加密每个设备的密码
            key_stream = hashlib.sha256(ENCRYPTION_KEY.encode()).digest()
            for d in save_list:
                if "password" in d and d["password"]:
                    # 加密并进行 Base64 编码存储
                    encrypted = xor_crypt(d["password"].encode(), key_stream)
                    d["password"] = base64.b64encode(encrypted).decode('utf-8')
            
            with open(device_file, "w", encoding="utf-8") as f:
                json.dump(save_list, f, ensure_ascii=False, indent=2)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def fix_service_driver(self):
        """修复服务或驱动未安装的问题"""
        global HAS_SERVICE, HAS_INTERCEPTION
        if platform.system() != "Windows":
            return {"success": False, "error": "仅支持 Windows 系统"}
            
        if not is_admin():
            return {"success": False, "error": "需要管理员权限，请以管理员身份运行客户端。"}
            
        try:
            results = []
            # 1. 检查驱动
            if not HAS_INTERCEPTION:
                print("[Bridge] 尝试安装驱动...")
                success, msg = install_interception_driver(silent=True)
                results.append(f"驱动安装: {'成功' if success else '失败 (' + msg + ')'}")
                
            # 2. 检查服务
            if not HAS_SERVICE:
                print("[Bridge] 尝试注册服务...")
                success, msg = install_windows_service()
                results.append(f"服务注册: {'成功' if success else '失败 (' + msg + ')'}")
                
            # 重新检查状态
            HAS_SERVICE = check_service_installed()
            # 驱动加载需要重启或重新初始化 Context，这里只是尝试安装，具体生效可能需要重启
            
            return {"success": True, "message": "\\n".join(results)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_browser(self, url):
        import webbrowser
        webbrowser.open(url)
        return {"success": True}

    def update_setting(self, key, value):
        try:
            # 特殊处理：开机自启动需要管理员权限
            if key == "autoStart" and not is_admin():
                return {"success": False, "error": "安装或卸载服务需要管理员权限，请右键选择“以管理员身份运行”后重试。"}

            # 特殊处理：开机自启动
            if key == "autoStart":
                if value:
                    print("[Bridge] 开启自启动: 尝试安装服务")
                    success, msg = install_windows_service()
                    if not success:
                        return {"success": False, "error": f"注册自启动服务失败 (可能被360或其它安全软件拦截): {msg}"}
                else:
                    print("[Bridge] 关闭自启动: 尝试卸载服务")
                    uninstall_windows_service()

            manage_settings("save", key, value)
            return {"success": True}
        except Exception as e:
            print(f"[Bridge] 更新设置失败 ({key}): {e}")
            return {"success": False, "error": str(e)}

    def connect_to_remote(self, remoteId, remotePassword):
        try:
            connect(remoteId, remotePassword)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def refresh_device_id(self):
        try:
            global DEVICE_ID
            DEVICE_ID = get_unique_id()
            return {"success": True, "deviceId": DEVICE_ID}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def check_for_updates(self):
        """手动检查更新"""
        try:
            import requests
            base_url = APP_URL if APP_URL else f"http://{HOST}:{PORT}"
            if not base_url.startswith("http"):
                base_url = "http://" + base_url
            
            base_url = base_url.rstrip('/')
            print(f"[Bridge] 检查更新: {base_url}/ad.json")
            
            response = requests.get(f"{base_url}/ad.json", timeout=10)
            if response.status_code == 200:
                data = response.json()
                try:
                    server_version = int(data.get("version", 0))
                except:
                    server_version = 0
                    
                if server_version > CLIENT_VERSION:
                    return {
                        "success": True, 
                        "hasUpdate": True,
                        "versionName": data.get("version_name", "Unknown"),
                        "versionDesc": data.get("version_desc", ""),
                        "versionUrl": data.get("version_url", ""),
                        "isForce": data.get("version_q", 0) == 1
                    }
                else:
                    return {"success": True, "hasUpdate": False}
            else:
                return {"success": False, "error": f"服务器返回错误: {response.status_code}"}
        except Exception as e:
            print(f"[Bridge] 检查更新失败: {e}")
            return {"success": False, "error": str(e)}

    def start_update_process(self, url):
        """启动更新下载和执行过程 - 使用原有的 Tkinter 更新逻辑"""
        try:
            import threading
            # 直接调用全局的 perform_update，它会弹出一个 Tkinter 进度窗口
            threading.Thread(target=lambda: perform_update(url), daemon=True).start()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def refresh_password(self):
        try:
            global DEVICE_PASSWORD
            import random
            import string
            
            # 直接生成新密码，确保它是唯一的且不受旧文件锁定影响
            new_pwd = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            DEVICE_PASSWORD = new_pwd
            
            # 1. 写入命令队列，让服务进程 (Session 0) 同步更新 auth.dat 和通知服务器
            cmd_dir = SYSTEM_AUTH_DIR
            os.makedirs(cmd_dir, exist_ok=True)
            cmd_file = os.path.join(cmd_dir, "cmd_queue.dat")
            
            with open(cmd_file, "w") as f:
                json.dump({"action": "update_password", "password": DEVICE_PASSWORD}, f)
            
            # 2. 如果当前进程也连着服务器（便携模式），直接发送通知
            if 'WS_CLIENT' in globals() and WS_CLIENT and SERVER_CONNECTED:
                try:
                    safe_send(WS_CLIENT, json.dumps({
                        "type": "update_password",
                        "password": DEVICE_PASSWORD
                    }))
                except: pass

            print(f"[Bridge] 访问码已刷新: {DEVICE_PASSWORD}")
            return {"success": True, "newPassword": DEVICE_PASSWORD}
        except Exception as e:
            print(f"[Bridge] 刷新访问码失败: {e}")
            return {"success": False, "error": str(e)}

    def get_network_config(self):
        return {
            "protocol": PROTOCOL,
            "host": HOST,
            "port": PORT,
            "remark": REMARK,
            "reconnectInterval": RECONNECT_INTERVAL
        }

    def update_network_config(self, protocol, host, port, remark, reconnectInterval):
        try:
            global PROTOCOL, HOST, PORT, REMARK, RECONNECT_INTERVAL
            
            # 更新内存中的配置
            PROTOCOL = str(protocol)
            HOST = str(host)
            PORT = int(port)
            REMARK = str(remark)
            RECONNECT_INTERVAL = int(reconnectInterval)
            
            # 通过 hook os.path.exists 强制保存新配置
            orig_exists = os.path.exists
            def hooked_exists(path):
                if "server.json" in path: return False
                return orig_exists(path)
            
            os.path.exists = hooked_exists
            try:
                manage_server_config()
                print("[Bridge] 网络配置已保存")
            finally:
                os.path.exists = orig_exists
            
            return {"success": True}
        except Exception as e:
            print(f"[Bridge] 更新网络配置出错: {e}")
            return {"success": False, "error": str(e)}

    def set_password(self, password):
        """手动设置并保存密码"""
        try:
            global DEVICE_PASSWORD
            DEVICE_PASSWORD = str(password)
            
            # 使用 hook 拦截 random.choices 和 os.path.exists
            import os, random
            orig_exists = os.path.exists
            orig_choices = random.choices
            
            def hooked_exists(path):
                if "auth.dat" in path: return False
                return orig_exists(path)
            
            def hooked_choices(population, k=8):
                return list(str(password))
                
            os.path.exists = hooked_exists
            random.choices = hooked_choices
            try:
                manage_password()
                print(f"[Bridge] 密码已手动更新并保存: {DEVICE_PASSWORD}")
            finally:
                os.path.exists = orig_exists
                random.choices = orig_choices
                
            return {"success": True}
        except Exception as e:
            print(f"[Bridge] 设置密码失败: {e}")
            return {"success": False, "error": str(e)}

def start_webview_ui():
    """启动 WebView UI 界面"""
    global WEBVIEW_WINDOW
    if not HAS_WEBVIEW or WEBVIEW_WINDOW:
        return

    # 增加锁屏检测：如果当前处于锁屏界面，WebView2 初始化会失败 (0x80080005)
    # 我们在这里等待直到解锁
    if platform.system() == "Windows":
        try:
            lock_wait_count = 0
            while is_session_locked(-1): # -1 表示当前会话
                if lock_wait_count % 5 == 0:
                    print("[*] 正在等待屏幕解锁以启动 UI...")
                lock_wait_count += 1
                time.sleep(1)
        except:
            pass

    # In bundled mode, resources are in 'library' folder next to executable or in sys._MEIPASS
    if getattr(sys, 'frozen', False):
        base_path = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
        
    ui_path = os.path.join(base_path, 'library', 'client-ui', 'index.html')
    # Fallback for development if index.html is in lib/client-ui
    if not os.path.exists(ui_path):
        ui_path = os.path.join(base_path, 'lib', 'client-ui', 'index.html')

    bridge = RootDeskBridge()
    print(f"[*] 启动 WebView UI: {ui_path}")
    WEBVIEW_WINDOW = webview.create_window(f'RootDesk v{CLIENT_VERSION_NAME}', url=ui_path, js_api=bridge, width=1124, height=768)
    WEBVIEW_WINDOW.events.closing += on_webview_closing
    webview.start()

if __name__ == "__main__":
    # 0. Initialize password and server config management
    manage_password()
    manage_server_config()
    
    # 1. Release resources (library files) in background to speed up UI loading
    if platform.system() == "Windows":
        threading.Thread(target=release_resources, daemon=True).start()
    
    # 1. Handle command line arguments for service installation (BEFORE single instance check)
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        if cmd == "install":
            if is_admin():
                if install_windows_service():
                    print("[+] Service installed successfully.")
                else:
                    print("[-] Service installation failed.")
            else:
                print("[-] Admin privileges required for installation.")
            sys.exit(0)
        elif cmd == "uninstall":
            if is_admin():
                # Uninstall logic
                task_name = "RootDeskGuardian"
                service_name = "RootDeskService"
                
                # Try NSSM first
                if getattr(sys, 'frozen', False):
                    base_dir = os.path.dirname(sys.executable)
                else:
                    base_dir = os.path.dirname(os.path.abspath(__file__))
                
                is_64bit = sys.maxsize > 2**32
                nssm_path = os.path.join(base_dir, "library", "win64" if is_64bit else "win32", "nssm.exe")
                
                if os.path.exists(nssm_path):
                    subprocess.run([nssm_path, 'stop', service_name], capture_output=True)
                    subprocess.run([nssm_path, 'remove', service_name, 'confirm'], capture_output=True)
                
                # Always try schtasks as well
                subprocess.run(['schtasks', '/delete', '/tn', task_name, '/f'], capture_output=True)
                print("[+] Service uninstalled.")
            else:
                print("[-] Admin privileges required for uninstallation.")
            sys.exit(0)
        elif cmd == "--service-monitor":
            # 运行服务监控逻辑
            service_monitor_loop()
            sys.exit(0)

    # Determine running mode
    session_id = get_session_id()
    is_service_mode = (session_id == 0) or ("--service" in sys.argv)
    
    if is_service_mode:
        # --- SESSION 0 (SERVICE MODE) ---
        if not check_single_instance(is_ui=False):
            sys.exit(0)
            
        print(f"[*] RootDesk Client - {REMARK} (Service Mode)")
        print(f"[*] Platform Mode: {PLATFORM_MODE}")
        
        # Print Python architecture
        is_64bit = sys.maxsize > 2**32
        arch_str = "64-bit" if is_64bit else "32-bit"
        print(f"[*] Python Arch: {arch_str}")
        if not is_64bit and platform.machine().endswith('64'):
            print("[!] Note: Running 32-bit Python on 64-bit OS. DXCAM performance may be limited.")
            
        print(f"[*] Client Version: 1.8.2 (Service & Single Instance)")
        
        if platform.system() == "Windows":
            if not is_admin():
                print("[!] Warning: Script is not running as Administrator.")
                print("[!] Input control might not work on some windows (Task Manager, etc).")
                print("[!] Please run this script as Administrator for full control.")
            else:
                print("[+] Running as Administrator")
                
        # Check if we should install startup
        install_startup()

        # Check if we should install as service (Windows only)
        if INSTALL_AS_SERVICE and platform.system() == "Windows":
            if is_admin():
                if install_windows_service():
                    print("[+] Service installed successfully. Exiting portable mode.")
                    sys.exit(0)
            else:
                print("[!] Warning: Service installation requested but not running as Administrator.")
                # 尝试立即提升权限以安装服务
                if HAS_TKINTER:
                    from tkinter import messagebox
                    if messagebox.askyesno("权限请求", "您在配置中开启了'安装为系统服务'，这需要管理员权限。 是否立即提升权限以完成安装？"):
                        elevate_process()
                else:
                    # 命令行模式下尝试直接提升
                    elevate_process()
        
        # Start command queue listener
        threading.Thread(target=check_local_commands_loop, daemon=True).start()
        
        # Start UI monitor thread to launch UI in active user sessions
        start_ui_monitor_thread()
        
        # Main Loop
        try:
            while True:
                try:
                    # 每次连接前尝试附加到当前活动桌面 (处理登录/注销切换)
                    become_interactive()
                    connect()
                except Exception as e:
                    print(f"[-] Connection error: {e}")
                
                # Reconnect interval
                time.sleep(RECONNECT_INTERVAL)
        except KeyboardInterrupt:
            print("[*] Exiting...")
            sys.exit(0)
        except Exception as e:
            print(f"[-] Fatal error: {e}")
            sys.exit(1)
            
    else:
        # --- SESSION 1+ (UI MODE) ---
        # Check if Service is already running
        service_running = not check_single_instance(is_ui=False, check_only=True)
        
        if service_running and "--monitor" not in sys.argv:
            print("[!] 当前已用服务模式运行，服务模式支持只能用 --monitor 参数来运行 UI 模式")
            sys.exit(0)

        # Service is handling the connection. We just run the UI and connect as desktop.
        if service_running:
            if not check_single_instance(is_ui=True):
                sys.exit(0)
            print(f"[*] RootDesk Client - {REMARK} (UI Mode - Service is running)")
            
            # 如果支持 WebView 且未指定禁用，则启动
            if HAS_WEBVIEW and "--no-ui" not in sys.argv:
                # 启动后台连接线程
                def bg_connect():
                    while True:
                        try:
                            connect(role="desktop")
                        except: pass
                        time.sleep(RECONNECT_INTERVAL)
                threading.Thread(target=bg_connect, daemon=True).start()
                start_webview_ui()
            else:
                # Main Loop (Desktop logic - Console version)
                try:
                    while True:
                        try:
                            connect(role="desktop")
                        except Exception as e:
                            print(f"[-] Connection error: {e}")
                        time.sleep(RECONNECT_INTERVAL)
                except KeyboardInterrupt:
                    print("[*] Exiting...")
                    sys.exit(0)
                except Exception as e:
                    print(f"[-] Fatal error: {e}")
                    sys.exit(1)
        else:
            # Portable mode: Run both Service and UI in this session
            if not check_single_instance(is_ui=False): sys.exit(0)
            if not check_single_instance(is_ui=True): sys.exit(0)
            
            print(f"[*] RootDesk Client - {REMARK} (Portable Mode)")
            
            # Start command queue listener for portable mode too
            threading.Thread(target=check_local_commands_loop, daemon=True).start()
            
            # 如果支持 WebView 且未指定禁用，则启动
            if HAS_WEBVIEW and "--no-ui" not in sys.argv:
                # 启动后台连接线程
                def bg_connect_portable():
                    while True:
                        try:
                            become_interactive()
                            connect(role="portable")
                        except: pass
                        time.sleep(RECONNECT_INTERVAL)
                threading.Thread(target=bg_connect_portable, daemon=True).start()
                start_webview_ui()
            else:
                # Main Loop (Portable logic - Console version)
                try:
                    while True:
                        try:
                            become_interactive()
                            connect(role="portable")
                        except Exception as e:
                            print(f"[-] Connection error: {e}")
                        time.sleep(RECONNECT_INTERVAL)
                except KeyboardInterrupt:
                    print("[*] Exiting...")
                    sys.exit(0)
                except Exception as e:
                    print(f"[-] Fatal error: {e}")
                    sys.exit(1)
`
}
