import sys
import os
import time
import requests
import threading
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QStackedWidget, QLineEdit, QScrollArea,
                             QGridLayout, QFrame, QTableWidget, QTableWidgetItem, QHeaderView,
                             QMessageBox, QDialog, QFormLayout, QTextEdit, QCheckBox, QComboBox,
                             QSizePolicy, QSpacerItem, QButtonGroup, QProgressBar)
from PyQt5.QtCore import Qt, pyqtSignal, pyqtProperty, QPropertyAnimation, QTimer, QSize, QUrl, QRect, QPoint, QEasingCurve, pyqtSlot
from PyQt5.QtGui import QFont, QIcon, QCursor, QColor, QDesktopServices, QPainter
import qtawesome as qta

# Colors from tailwind config
BG_COLOR = '#0a0a0f'
FG_COLOR = '#e4e4e7'
CARD_COLOR = '#131318'
CARD_HOVER = '#1a1a22'
BORDER_COLOR = '#27272a'
PRIMARY_COLOR = '#3b82f6'
PRIMARY_HOVER = '#1d4ed8'
MUTED_COLOR = '#71717a'
SUCCESS_COLOR = '#22c55e'
DANGER_COLOR = '#ef4444'
WARNING_COLOR = '#f59e0b'

GLOBAL_STYLE = f"""
QWidget {{
    background-color: {BG_COLOR};
    color: {FG_COLOR};
    font-family: "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
}}
QFrame#sidebar {{
    background-color: {CARD_COLOR};
    border-right: 1px solid {BORDER_COLOR};
}}
QFrame#card {{
    background-color: {CARD_COLOR};
    border: 1px solid {BORDER_COLOR};
    border-radius: 12px;
}}
QFrame#card:hover {{
    background-color: {CARD_HOVER};
}}
QPushButton {{
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
}}
QPushButton#sidebarBtn {{
    background-color: transparent;
    text-align: left;
    padding: 12px 15px;
    color: {MUTED_COLOR};
    border-radius: 8px;
    margin: 2px 12px;
    font-size: 14px;
}}
QPushButton#sidebarBtn:hover {{
    background-color: {CARD_HOVER};
}}
QPushButton#sidebarBtn:checked {{
    background-color: rgba(59, 130, 246, 0.15);
    color: {PRIMARY_COLOR};
    font-weight: bold;
}}
QPushButton#settingsNavBtn {{
    background-color: transparent;
    text-align: left;
    padding: 10px 15px;
    color: {MUTED_COLOR};
    border-radius: 8px;
    margin: 2px 8px;
    font-size: 13px;
}}
QPushButton#settingsNavBtn:hover {{
    background-color: {CARD_HOVER};
}}
QPushButton#settingsNavBtn:checked {{
    background-color: {PRIMARY_COLOR};
    color: white;
    font-weight: bold;
}}
QPushButton#primaryBtn {{
    background-color: {PRIMARY_COLOR};
    color: white;
    font-weight: bold;
    border-radius: 8px;
    padding: 12px;
    font-size: 14px;
}}
QPushButton#primaryBtn:hover {{
    background-color: {PRIMARY_HOVER};
}}
QPushButton#iconBtn {{
    background-color: transparent;
    border-radius: 6px;
    color: {MUTED_COLOR};
}}
QPushButton#iconBtn:hover {{
    background-color: {BORDER_COLOR};
}}
QLineEdit, QTextEdit, QComboBox {{
    background-color: {BG_COLOR};
    border: 1px solid {BORDER_COLOR};
    border-radius: 8px;
    padding: 12px;
    color: {FG_COLOR};
}}
QLineEdit:focus, QTextEdit:focus, QComboBox:focus {{
    border: 1px solid {PRIMARY_COLOR};
}}
QTableWidget {{
    background-color: transparent;
    border: none;
    gridline-color: {BORDER_COLOR};
}}
QHeaderView::section {{
    background-color: {CARD_COLOR};
    color: {MUTED_COLOR};
    border: none;
    border-bottom: 1px solid {BORDER_COLOR};
    padding: 8px;
    font-weight: bold;
}}
QTableWidget::item {{
    border-bottom: 1px solid {BORDER_COLOR};
    padding: 8px;
}}
QScrollBar:vertical {{
    background: {CARD_COLOR};
    width: 8px;
    margin: 0px;
}}
QScrollBar::handle:vertical {{
    background: {BORDER_COLOR};
    border-radius: 4px;
    min-height: 20px;
}}
QScrollBar::handle:vertical:hover {{
    background: #3f3f46;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0px;
}}
"""

class UpdateDialog(QDialog):
    def __init__(self, name, desc, url, force=False, parent=None):
        super().__init__(parent)
        self.setWindowTitle("发现新版本")
        self.setFixedSize(450, 380)
        self.setStyleSheet(GLOBAL_STYLE)
        self.url = url
        self.force = force
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 30, 30, 30)
        layout.setSpacing(20)
        
        # Header
        title_lbl = QLabel(f"发现新版本: {name}")
        title_lbl.setStyleSheet("font-size: 20px; font-weight: bold;")
        layout.addWidget(title_lbl)
        
        # Description
        desc_box = QTextEdit()
        desc_box.setReadOnly(True)
        desc_box.setText(desc)
        desc_box.setStyleSheet(f"""
            QTextEdit {{
                background-color: {CARD_COLOR};
                border: 1px solid {BORDER_COLOR};
                border-radius: 8px;
                padding: 15px;
                font-size: 13px;
                line-height: 1.5;
            }}
        """)
        layout.addWidget(desc_box)
        
        if force:
            warn_lbl = QLabel("此版本包含重大更新，必须更新后才能继续使用。")
            warn_lbl.setStyleSheet(f"color: {DANGER_COLOR}; font-size: 12px;")
            layout.addWidget(warn_lbl)
        
        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(12)
        
        btn_update = QPushButton("立即更新")
        btn_update.setObjectName("primaryBtn")
        btn_update.setMinimumHeight(45)
        btn_update.setStyleSheet(f"""
            QPushButton {{
                background-color: {PRIMARY_COLOR};
                color: white;
                font-weight: bold;
                border-radius: 8px;
            }}
            QPushButton:hover {{ background-color: {PRIMARY_HOVER}; }}
        """)
        
        btn_cancel = QPushButton("以后再说")
        btn_cancel.setMinimumHeight(45)
        btn_cancel.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                border: 1px solid {BORDER_COLOR};
                color: {FG_COLOR};
                border-radius: 8px;
            }}
            QPushButton:hover {{ background-color: {CARD_HOVER}; }}
        """)
        
        btn_layout.addStretch()
        if not force:
            btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_update)
        layout.addLayout(btn_layout)
        
        btn_update.clicked.connect(self.on_update)
        btn_cancel.clicked.connect(self.reject)
        
        if force:
            self.setWindowFlags(self.windowFlags() & ~Qt.WindowCloseButtonHint)
            
    def on_update(self):
        # 统一调用 MainWindow 的下载进度条更新方法
        main_win = self.parent()
        if hasattr(main_win, "start_download_update"):
            main_win.start_download_update(self.url)
            self.accept()
        else:
            QDesktopServices.openUrl(QUrl(self.url))
            self.accept()

class DownloadProgressDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("正在下载更新")
        self.setFixedSize(400, 150)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        self.setStyleSheet(GLOBAL_STYLE)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 20, 30, 20)
        layout.setSpacing(15)
        
        self.lbl_status = QLabel("准备下载...")
        self.lbl_status.setStyleSheet("font-weight: bold;")
        layout.addWidget(self.lbl_status)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setStyleSheet(f"""
            QProgressBar {{
                border: 1px solid {BORDER_COLOR};
                border-radius: 6px;
                background-color: {CARD_COLOR};
                text-align: center;
                height: 24px;
            }}
            QProgressBar::chunk {{
                background-color: {PRIMARY_COLOR};
                border-radius: 5px;
            }}
        """)
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)
        
        self.lbl_info = QLabel("请稍候，下载完成后将自动启动安装程序。")
        self.lbl_info.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 11px;")
        layout.addWidget(self.lbl_info)

    def set_progress(self, value, text=None):
        self.progress_bar.setValue(value)
        if text:
            self.lbl_status.setText(text)

class Toast(QLabel):
    def __init__(self, text, parent=None):
        super().__init__(text, parent)
        self.setWindowFlags(Qt.ToolTip | Qt.FramelessWindowHint)
        self.setAlignment(Qt.AlignCenter)
        self.setStyleSheet(f"""
            background-color: {CARD_COLOR};
            color: {SUCCESS_COLOR};
            border: 1px solid {BORDER_COLOR};
            border-radius: 20px;
            padding: 8px 20px;
            font-size: 13px;
            font-weight: bold;
        """)
        self.adjustSize()
        
        self.opacity_anim = QPropertyAnimation(self, b"windowOpacity")
        self.opacity_anim.setDuration(300)
        
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.hide_toast)
        
    def show_toast(self):
        if self.parent():
            # Get parent's geometry relative to screen
            p_geom = self.parent().geometry()
            # If parent is a window, use its frame geometry to include title bar
            if self.parent().isWindow():
                p_geom = self.parent().frameGeometry()
            
            # Position it at the center of the parent
            center = p_geom.center()
            self.move(center.x() - self.width() // 2, 
                      center.y() - self.height() // 2)
            
        self.show()
        self.opacity_anim.setStartValue(0.0)
        self.opacity_anim.setEndValue(1.0)
        self.opacity_anim.start()
        self.timer.start(2000)
        
    def hide_toast(self):
        self.opacity_anim.setStartValue(1.0)
        self.opacity_anim.setEndValue(0.0)
        self.opacity_anim.finished.connect(self.deleteLater)
        self.opacity_anim.start()

class ToggleSwitch(QWidget):
    clicked = pyqtSignal(bool)
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(44, 24)
        self.setCursor(Qt.PointingHandCursor)
        self._checked = False
        self._position = 2

    @pyqtProperty(int)
    def position(self):
        return self._position

    @position.setter
    def position(self, pos):
        self._position = pos
        self.update()

    def isChecked(self):
        return self._checked

    def setChecked(self, checked):
        self._checked = checked
        self._position = 22 if checked else 2
        self.update()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._checked = not self._checked
            self.anim = QPropertyAnimation(self, b"position")
            self.anim.setDuration(200)
            self.anim.setStartValue(22 if not self._checked else 2)
            self.anim.setEndValue(22 if self._checked else 2)
            self.anim.start()
            self.clicked.emit(self._checked)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        if self._checked:
            painter.setBrush(QColor('#3b82f6'))
        else:
            painter.setBrush(QColor('#27272a'))
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(0, 0, self.width(), self.height(), 12, 12)

        painter.setBrush(QColor('white'))
        painter.drawEllipse(self._position, 2, 20, 20)

class ClickableWidget(QWidget):
    clicked = pyqtSignal()
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setCursor(Qt.PointingHandCursor)
    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit()

class RemoteWidget(QWidget):
    def __init__(self, bridge, parent=None):
        super().__init__(parent)
        self.bridge = bridge
        self.initUI()
        
    def initUI(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setStyleSheet("background-color: transparent;")
        main_layout.addWidget(scroll)
        
        content = QWidget()
        scroll.setWidget(content)
        
        layout = QVBoxLayout(content)
        layout.setContentsMargins(32, 24, 32, 24)
        layout.setSpacing(24)
        
        # Header
        header = QLabel("轻量化原生远程控制软件，高效连接远端设备，实现桌面实时查看、键鼠操作与全程远程管理。")
        header.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; padding-bottom: 12px; border-bottom: 1px solid {BORDER_COLOR};")
        layout.addWidget(header)
        
        # Warning Banners (Service/Driver missing)
        self.warnings_layout = QVBoxLayout()
        self.warnings_layout.setSpacing(8)
        layout.addLayout(self.warnings_layout)

        # Update Info Banner (Initially Hidden)
        self.update_banner = QFrame()
        self.update_banner.setObjectName("updateBanner")
        self.update_banner.setStyleSheet(f"""
            QFrame#updateBanner {{
                background-color: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 12px;
            }}
        """)
        ub_main_layout = QVBoxLayout(self.update_banner)
        ub_main_layout.setContentsMargins(16, 16, 16, 16)
        ub_main_layout.setSpacing(10)
        
        ub_header = QHBoxLayout()
        u_warn_icon = QLabel()
        u_warn_icon.setPixmap(qta.icon('fa5s.arrow-alt-circle-up', color=SUCCESS_COLOR).pixmap(QSize(20, 20)))
        ub_header.addWidget(u_warn_icon)
        
        self.lbl_update_title = QLabel("发现新版本")
        self.lbl_update_title.setStyleSheet(f"color: {SUCCESS_COLOR}; font-size: 15px; font-weight: bold;")
        ub_header.addWidget(self.lbl_update_title)
        ub_header.addStretch()
        
        btn_go_update = QPushButton(" 立即更新")
        btn_go_update.setIcon(qta.icon('fa5s.download', color='white'))
        btn_go_update.setStyleSheet(f"""
            QPushButton {{
                background-color: {SUCCESS_COLOR};
                color: white;
                border-radius: 6px;
                padding: 8px 20px;
                font-size: 13px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #16a34a;
            }}
        """)
        btn_go_update.setCursor(Qt.PointingHandCursor)
        btn_go_update.clicked.connect(self.on_update_clicked)
        ub_header.addWidget(btn_go_update)
        ub_main_layout.addLayout(ub_header)
        
        self.lbl_update_info = QLabel("")
        self.lbl_update_info.setStyleSheet(f"color: {FG_COLOR}; font-size: 13px; line-height: 1.4; padding-left: 30px;")
        self.lbl_update_info.setWordWrap(True)
        self.lbl_update_info.setTextFormat(Qt.PlainText)
        ub_main_layout.addWidget(self.lbl_update_info)
        
        self.update_banner.hide()
        self.warnings_layout.addWidget(self.update_banner)

        # 1. Service Warning
        self.service_banner = QFrame()
        self.service_banner.setObjectName("serviceWarning")
        self.service_banner.setStyleSheet(f"""
            QFrame#serviceWarning {{
                background-color: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
            }}
        """)
        sb_layout = QHBoxLayout(self.service_banner)
        sb_layout.setContentsMargins(16, 12, 16, 12)
        
        s_warn_icon = QLabel()
        s_warn_icon.setPixmap(qta.icon('fa5s.exclamation-triangle', color='#ef4444').pixmap(QSize(16, 16)))
        sb_layout.addWidget(s_warn_icon)
        
        self.lbl_service_warn = QLabel("系统服务未安装，可能导致远程桌面无法在锁屏或高权限界面运行。")
        self.lbl_service_warn.setStyleSheet("color: #ef4444; font-size: 13px; font-weight: 500;")
        sb_layout.addWidget(self.lbl_service_warn)
        sb_layout.addStretch()
        
        btn_fix_s = QPushButton("立即修复")
        btn_fix_s.setStyleSheet(f"""
            QPushButton {{
                background-color: #ef4444;
                color: white;
                border-radius: 6px;
                padding: 6px 16px;
                font-size: 12px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #dc2626;
            }}
        """)
        btn_fix_s.setCursor(Qt.PointingHandCursor)
        btn_fix_s.clicked.connect(self.fix_service)
        sb_layout.addWidget(btn_fix_s)
        self.service_banner.hide()
        self.warnings_layout.addWidget(self.service_banner)

        # 2. Driver Warning
        self.driver_banner = QFrame()
        self.driver_banner.setObjectName("driverWarning")
        self.driver_banner.setStyleSheet(f"""
            QFrame#driverWarning {{
                background-color: rgba(245, 158, 11, 0.15);
                border: 1px solid rgba(245, 158, 11, 0.3);
                border-radius: 8px;
            }}
        """)
        db_layout = QHBoxLayout(self.driver_banner)
        db_layout.setContentsMargins(16, 12, 16, 12)
        
        d_warn_icon = QLabel()
        d_warn_icon.setPixmap(qta.icon('fa5s.info-circle', color='#f59e0b').pixmap(QSize(16, 16)))
        db_layout.addWidget(d_warn_icon)
        
        self.lbl_driver_warn = QLabel("虚拟鼠标驱动未安装，可能导致无法模拟鼠标移动或点击。")
        self.lbl_driver_warn.setStyleSheet("color: #f59e0b; font-size: 13px; font-weight: 500;")
        db_layout.addWidget(self.lbl_driver_warn)
        db_layout.addStretch()
        
        btn_fix_d = QPushButton("立即修复")
        btn_fix_d.setStyleSheet(f"""
            QPushButton {{
                background-color: #f59e0b;
                color: white;
                border-radius: 6px;
                padding: 6px 16px;
                font-size: 12px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #d97706;
            }}
        """)
        btn_fix_d.setCursor(Qt.PointingHandCursor)
        btn_fix_d.clicked.connect(self.fix_service)
        db_layout.addWidget(btn_fix_d)
        self.driver_banner.hide()
        self.warnings_layout.addWidget(self.driver_banner)
        
        # Grid
        self.grid_layout = QGridLayout()
        self.grid_layout.setSpacing(24)
        layout.addLayout(self.grid_layout)
        
        # Host Info Card
        self.host_card = QFrame()
        self.host_card.setObjectName("card")
        self.host_card.setMinimumHeight(320)
        host_layout = QVBoxLayout(self.host_card)
        host_layout.setContentsMargins(24, 24, 24, 24)
        
        host_title = QLabel("主机信息")
        host_title.setStyleSheet("font-size: 18px; font-weight: bold; margin-bottom: 10px;")
        host_layout.addWidget(host_title)
        
        # Device ID
        lbl_did = QLabel("设备ID")
        lbl_did.setStyleSheet(f"color: {MUTED_COLOR};")
        host_layout.addWidget(lbl_did)
        
        did_layout = QHBoxLayout()
        self.val_did = QLabel("------")
        self.val_did.setStyleSheet(f"color: {PRIMARY_COLOR}; font-size: 28px; font-weight: bold; font-family: monospace;")
        did_layout.addWidget(self.val_did)
        
        btn_copy_did = QPushButton()
        btn_copy_did.setIcon(qta.icon('fa5s.copy', color=MUTED_COLOR))
        btn_copy_did.setObjectName("iconBtn")
        btn_copy_did.setToolTip("复制设备ID")
        btn_copy_did.clicked.connect(lambda: self.copy_text(self.val_did.text()))
        did_layout.addWidget(btn_copy_did)
        did_layout.addStretch()
        host_layout.addLayout(did_layout)
        
        # Password
        lbl_pwd_layout = QHBoxLayout()
        lbl_pwd = QLabel("访问码")
        lbl_pwd.setStyleSheet(f"color: {MUTED_COLOR};")
        lbl_pwd_layout.addWidget(lbl_pwd)
        lbl_pwd_refresh = QLabel("自动刷新: 04-16 18:30")
        lbl_pwd_refresh.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 11px;")
        lbl_pwd_layout.addWidget(lbl_pwd_refresh)
        lbl_pwd_layout.addStretch()
        host_layout.addLayout(lbl_pwd_layout)
        
        pwd_layout = QHBoxLayout()
        self.val_pwd = QLabel("------")
        self.real_pwd = "------"
        self.pwd_visible = True
        self.val_pwd.setStyleSheet(f"color: {PRIMARY_COLOR}; font-size: 28px; font-weight: bold; font-family: monospace;")
        pwd_layout.addWidget(self.val_pwd)
        
        btn_refresh_pwd = QPushButton()
        btn_refresh_pwd.setIcon(qta.icon('fa5s.sync-alt', color=MUTED_COLOR))
        btn_refresh_pwd.setObjectName("iconBtn")
        btn_refresh_pwd.setToolTip("刷新访问码")
        btn_refresh_pwd.clicked.connect(self.refresh_password)
        pwd_layout.addWidget(btn_refresh_pwd)
        
        btn_copy_pwd = QPushButton()
        btn_copy_pwd.setIcon(qta.icon('fa5s.copy', color=MUTED_COLOR))
        btn_copy_pwd.setObjectName("iconBtn")
        btn_copy_pwd.setToolTip("复制访问码")
        btn_copy_pwd.clicked.connect(lambda: self.copy_text(self.real_pwd))
        pwd_layout.addWidget(btn_copy_pwd)
        
        btn_eye_pwd = QPushButton()
        self.eye_icon_on = qta.icon('fa5s.eye', color=MUTED_COLOR)
        self.eye_icon_off = qta.icon('fa5s.eye-slash', color=MUTED_COLOR)
        btn_eye_pwd.setIcon(self.eye_icon_on)
        btn_eye_pwd.setObjectName("iconBtn")
        btn_eye_pwd.setToolTip("显示/隐藏")
        btn_eye_pwd.clicked.connect(self.toggle_pwd)
        self.btn_eye_pwd = btn_eye_pwd
        pwd_layout.addWidget(btn_eye_pwd)
        pwd_layout.addStretch()
        host_layout.addLayout(pwd_layout)
        
        # Copy Info Link
        copy_info_btn = QPushButton(" 复制设备信息")
        copy_info_btn.setIcon(qta.icon('fa5s.link', color=PRIMARY_COLOR))
        copy_info_btn.setStyleSheet(f"color: {PRIMARY_COLOR}; background: transparent; text-align: left;")
        copy_info_btn.setCursor(Qt.PointingHandCursor)
        copy_info_btn.clicked.connect(self.copy_device_info)
        host_layout.addWidget(copy_info_btn)
        
        # Web console
        host_layout.addStretch()
        web_btn_layout = QVBoxLayout()
        web_btn_layout.setSpacing(8)
        btn_web = QPushButton(" 打开 Web 控制台")
        btn_web.setIcon(qta.icon('fa5s.globe', color='white'))
        btn_web.setIconSize(QSize(18, 18))
        btn_web.setObjectName("primaryBtn")
        btn_web.setStyleSheet(f"""
            QPushButton {{
                background-color: {PRIMARY_COLOR};
                color: white;
                font-weight: bold;
                border-radius: 8px;
                padding: 10px 20px;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {PRIMARY_HOVER};
            }}
        """)
        btn_web.clicked.connect(self.open_web_console)
        lbl_web_sub = QLabel("在浏览器中管理和连接您的设备")
        lbl_web_sub.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 11px;")
        lbl_web_sub.setAlignment(Qt.AlignCenter)
        web_btn_layout.addWidget(btn_web)
        web_btn_layout.addWidget(lbl_web_sub)
        host_layout.addLayout(web_btn_layout)
        
        self.grid_layout.addWidget(self.host_card, 0, 0)
        
        # Connect to Remote Card
        self.conn_card = QFrame()
        self.conn_card.setObjectName("card")
        self.conn_card.setMinimumHeight(320)
        conn_layout = QVBoxLayout(self.conn_card)
        conn_layout.setContentsMargins(24, 24, 24, 24)
        
        conn_title = QLabel("连接到远程")
        conn_title.setStyleSheet("font-size: 18px; font-weight: bold; margin-bottom: 10px;")
        conn_layout.addWidget(conn_title)
        
        conn_layout.addWidget(QLabel("远程设备ID"))
        self.inp_remote_id = QLineEdit()
        self.inp_remote_id.setPlaceholderText("请输入9位设备ID")
        self.inp_remote_id.setMinimumHeight(44)
        conn_layout.addWidget(self.inp_remote_id)
        
        conn_layout.addSpacing(8)
        
        conn_layout.addWidget(QLabel("访问密码"))
        self.inp_remote_pwd = QLineEdit()
        self.inp_remote_pwd.setEchoMode(QLineEdit.Password)
        self.inp_remote_pwd.setPlaceholderText("请输入访问密码")
        self.inp_remote_pwd.setMinimumHeight(44)
        conn_layout.addWidget(self.inp_remote_pwd)
        
        conn_layout.addStretch()
        btn_connect = QPushButton("连接")
        btn_connect.setObjectName("primaryBtn")
        btn_connect.setStyleSheet(f"""
            QPushButton {{
                background-color: {PRIMARY_COLOR};
                color: white;
                font-weight: bold;
                border-radius: 8px;
                padding: 10px 20px;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {PRIMARY_HOVER};
            }}
        """)
        btn_connect.clicked.connect(self.connect_remote)
        conn_layout.addWidget(btn_connect)
        
        self.grid_layout.addWidget(self.conn_card, 0, 1)
        
        # Connected Clients (Bottom Left)
        self.clients_card = QFrame()
        self.clients_card.setObjectName("card")
        self.clients_card.setMinimumHeight(280)
        clients_layout = QVBoxLayout(self.clients_card)
        clients_layout.setContentsMargins(24, 24, 24, 24)
        clients_title = QLabel("控制端列表")
        clients_title.setStyleSheet("font-size: 18px; font-weight: bold; margin-bottom: 10px;")
        clients_layout.addWidget(clients_title)
        
        self.lbl_clients = QLabel("暂无控制端连接")
        self.lbl_clients.setStyleSheet(f"color: {MUTED_COLOR};")
        self.lbl_clients.setAlignment(Qt.AlignCenter)
        clients_layout.addWidget(self.lbl_clients)
        clients_layout.addStretch()
        
        # Invite Assistance Area
        clients_layout.addWidget(QLabel("邀请对方协助"))
        inv_layout = QHBoxLayout()
        self.inp_invite = QLineEdit()
        self.inp_invite.setPlaceholderText("输入对方协助码")
        self.inp_invite.setMinimumHeight(45)
        btn_invite = QPushButton("邀请")
        btn_invite.setStyleSheet(f"background-color: rgba(59, 130, 246, 0.1); color: {PRIMARY_COLOR}; font-weight: bold; border-radius: 8px; padding: 0 20px;")
        btn_invite.setMinimumHeight(38)
        btn_invite.clicked.connect(self.invite_assistance)
        inv_layout.addWidget(self.inp_invite)
        inv_layout.addWidget(btn_invite)
        clients_layout.addLayout(inv_layout)
        
        lbl_inv_sub = QLabel("协助码由对方 Web 控制端顶部显示")
        lbl_inv_sub.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 11px;")
        clients_layout.addWidget(lbl_inv_sub)
        
        self.grid_layout.addWidget(self.clients_card, 1, 0)
        
        # History (Bottom Right)
        self.history_card = QFrame()
        self.history_card.setObjectName("card")
        self.history_card.setMinimumHeight(350)
        history_layout = QVBoxLayout(self.history_card)
        history_layout.setContentsMargins(24, 24, 24, 24)
        
        history_title = QLabel("被控记录")
        history_title.setStyleSheet("font-size: 18px; font-weight: bold; margin-bottom: 10px;")
        history_layout.addWidget(history_title)
        
        self.table_history = QTableWidget(0, 4)
        self.table_history.setHorizontalHeaderLabels(["开始时间", "结束时间", "时长", "IP地址"])
        self.table_history.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table_history.verticalHeader().setVisible(False)
        self.table_history.setEditTriggers(QTableWidget.NoEditTriggers)
        self.table_history.setSelectionMode(QTableWidget.NoSelection)
        history_layout.addWidget(self.table_history)
        
        self.grid_layout.addWidget(self.history_card, 1, 1)
        
        layout.addStretch()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        # Handle responsive layout
        # We check the width of the widget to decide layout
        if self.width() < 850:
            # Vertical layout
            if self.grid_layout.itemAtPosition(0, 1) is not None:
                # Move widgets to single column
                self.grid_layout.addWidget(self.host_card, 0, 0)
                self.grid_layout.addWidget(self.conn_card, 1, 0)
                self.grid_layout.addWidget(self.clients_card, 2, 0)
                self.grid_layout.addWidget(self.history_card, 3, 0)
        else:
            # 2x2 Grid layout
            if self.grid_layout.itemAtPosition(1, 0).widget() == self.conn_card:
                # Move widgets back to 2x2
                self.grid_layout.addWidget(self.host_card, 0, 0)
                self.grid_layout.addWidget(self.conn_card, 0, 1)
                self.grid_layout.addWidget(self.clients_card, 1, 0)
                self.grid_layout.addWidget(self.history_card, 1, 1)
        
    def fix_service(self):
        if hasattr(self.bridge, 'fix_service_driver'):
            self.show_message("正在尝试修复...")
            res = self.bridge.fix_service_driver()
            if res and res.get("success"):
                self.show_message("修复操作已完成")
                # Banners will be hidden on next update_data
            else:
                QMessageBox.warning(self, "修复失败", res.get("error", "未知错误"))

    def on_update_clicked(self):
        # 统一调用 MainWindow 的下载进度条更新方法
        main_win = self.window()
        if hasattr(main_win, "start_download_update") and hasattr(self, "update_url"):
            main_win.start_download_update(self.update_url)
        elif hasattr(self, "update_url"):
            QDesktopServices.openUrl(QUrl(self.update_url))

    def show_update_info(self, name, desc, url):
        self.update_url = url
        self.lbl_update_title.setText(f"发现新版本 v{name}    立即更新，畅享极致使用体验 ")
        self.lbl_update_info.setText(desc if desc else "暂无更新说明")
        self.update_banner.show()

    def show_message(self, text):
        toast = Toast(text, self)
        # Position it at the bottom center of the RemoteWidget
        toast.show_toast()

    def update_data(self, data):
        self.val_did.setText(data.get("deviceId", "------"))
        self.real_pwd = data.get("devicePassword", "------")
        if self.pwd_visible:
            self.val_pwd.setText(self.real_pwd)
            
        # Update service/driver warnings
        has_service = data.get("hasService", True)
        has_interception = data.get("hasInterception", True)
        
        self.service_banner.setVisible(not has_service)
        self.driver_banner.setVisible(not has_interception)

        # Update active controllers
        active_controllers = data.get("activeControllers", [])
        if active_controllers:
            text = "\n".join([f"IP: {c.get('ip', '未知')} (已连接 {c.get('start_time', '未知')})" for c in active_controllers])
            self.lbl_clients.setText(text)
            self.lbl_clients.setStyleSheet(f"color: {SUCCESS_COLOR};")
        else:
            self.lbl_clients.setText("暂无控制端连接")
            self.lbl_clients.setStyleSheet(f"color: {MUTED_COLOR};")
            
    def update_history(self, history):
        self.table_history.setRowCount(len(history))
        for i, row in enumerate(history):
            self.table_history.setItem(i, 0, QTableWidgetItem(row.get("start", "")))
            self.table_history.setItem(i, 1, QTableWidgetItem(row.get("end", "")))
            self.table_history.setItem(i, 2, QTableWidgetItem(row.get("duration", "")))
            self.table_history.setItem(i, 3, QTableWidgetItem(row.get("ip", "")))
            
    def copy_text(self, text):
        QApplication.clipboard().setText(text)
        self.show_message("已复制到剪贴板")
        
    def copy_device_info(self):
        info = f"设备ID: {self.val_did.text()}\n访问码: {self.real_pwd}"
        QApplication.clipboard().setText(info)
        self.show_message("设备信息已复制")
        
    def toggle_pwd(self):
        self.pwd_visible = not self.pwd_visible
        if self.pwd_visible:
            self.val_pwd.setText(self.real_pwd)
            self.btn_eye_pwd.setIcon(self.eye_icon_on)
        else:
            self.val_pwd.setText("******")
            self.btn_eye_pwd.setIcon(self.eye_icon_off)
            
    def refresh_password(self):
        if hasattr(self.bridge, 'refresh_password'):
            res = self.bridge.refresh_password()
            if res and res.get("success"):
                self.real_pwd = res.get("newPassword")
                if self.pwd_visible:
                    self.val_pwd.setText(self.real_pwd)
                self.show_message("访问码已刷新")
                
    def open_web_console(self):
        if hasattr(self.bridge, 'open_web_console'):
            self.bridge.open_web_console()
        else:
            # 尝试获取 APP_URL
            base_url = "https://rootdesk.cn"
            if hasattr(self.bridge, "get_app_url"):
                res = self.bridge.get_app_url()
                if res and res.get("url"):
                    base_url = res.get("url")
            QDesktopServices.openUrl(QUrl(base_url))
            
    def connect_remote(self):
        did = self.inp_remote_id.text().strip()
        pwd = self.inp_remote_pwd.text().strip()
        if not did or not pwd:
            self.show_message("请输入设备ID和访问密码")
            return
        
        self.show_message(f"正在连接到 {did}...")
        try:
            # 尝试获取 APP_URL
            base_url = "https://rootdesk.cn"
            if hasattr(self.bridge, "get_app_url"):
                res = self.bridge.get_app_url()
                if res and res.get("url"):
                    base_url = res.get("url")
            
            url = f"{base_url.rstrip('/')}/?deviceId={did.replace(' ', '')}&password={pwd}&autostart=true"
            QDesktopServices.openUrl(QUrl(url))
        except Exception as e:
            print("Connect remote error:", e)

    def invite_assistance(self):
        code = self.inp_invite.text().strip()
        if not code:
            return
        if hasattr(self.bridge, 'invite_assistance'):
            self.bridge.invite_assistance(code)

class DevicesWidget(QWidget):
    def __init__(self, bridge, parent=None):
        super().__init__(parent)
        self.bridge = bridge
        self.devices = []
        self.initUI()
        
    def initUI(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Header
        header = QLabel("管理您的远程设备，快速连接常用设备")
        header.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 14px; padding: 16px 32px; border-bottom: 1px solid {BORDER_COLOR}; background-color: rgba(19,19,24,0.5);")
        layout.addWidget(header)
        
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(32, 24, 32, 24)
        
        # Top Actions
        actions_layout = QHBoxLayout()
        self.lbl_title = QLabel("我的设备")
        self.lbl_title.setStyleSheet("font-size: 22px; font-weight: bold;")
        self.lbl_count = QLabel("共 0 台设备")
        self.lbl_count.setStyleSheet(f"color: {MUTED_COLOR}; margin-left: 10px; font-size: 14px;")
        
        actions_layout.addWidget(self.lbl_title)
        actions_layout.addWidget(self.lbl_count)
        actions_layout.addStretch()
        
        self.inp_search = QLineEdit()
        self.inp_search.setPlaceholderText(" 搜索设备...")
        self.inp_search.setFixedWidth(260)
        # Add search icon to QLineEdit using action or layout
        search_icon = qta.icon('fa5s.search', color=MUTED_COLOR)
        self.inp_search.addAction(search_icon, QLineEdit.LeadingPosition)
        self.inp_search.setStyleSheet(f"""
            QLineEdit {{
                background-color: transparent;
                border: 1px solid {BORDER_COLOR};
                border-radius: 8px;
                padding: 10px 16px;
                color: {FG_COLOR};
            }}
            QLineEdit:focus {{
                border: 1px solid {PRIMARY_COLOR};
            }}
        """)
        self.inp_search.textChanged.connect(self.render_devices)
        actions_layout.addWidget(self.inp_search)
        
        btn_add = QPushButton(" 添加设备")
        btn_add.setIcon(qta.icon('fa5s.plus', color='white'))
        btn_add.setObjectName("primaryBtn")
        btn_add.setStyleSheet(f"""
            QPushButton {{
                background-color: {PRIMARY_COLOR};
                color: white;
                font-weight: bold;
                border-radius: 8px;
                padding: 10px 20px;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {PRIMARY_HOVER};
            }}
        """)
        btn_add.clicked.connect(self.add_device_dialog)
        actions_layout.addWidget(btn_add)
        
        content_layout.addLayout(actions_layout)
        
        # Filter Tabs
        tabs_layout = QHBoxLayout()
        self.btn_all = QPushButton("全部")
        self.btn_online = QPushButton("在线")
        self.btn_offline = QPushButton("离线")
        
        self.filter_group = QButtonGroup(self)
        self.filter_group.setExclusive(True)
        
        tab_style = f"""
            QPushButton {{
                background-color: {CARD_COLOR};
                color: {MUTED_COLOR};
                border-radius: 6px;
                padding: 8px 16px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {CARD_HOVER};
            }}
            QPushButton:checked {{
                background-color: rgba(59, 130, 246, 0.15);
                color: {PRIMARY_COLOR};
            }}
        """
        
        for btn in [self.btn_all, self.btn_online, self.btn_offline]:
            btn.setCheckable(True)
            btn.setStyleSheet(tab_style)
            tabs_layout.addWidget(btn)
            self.filter_group.addButton(btn)
            btn.clicked.connect(self.render_devices)
            
        self.btn_all.setChecked(True)
        tabs_layout.addStretch()
        content_layout.addLayout(tabs_layout)
        
        # Grid
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setStyleSheet("background-color: transparent;")
        content_layout.addWidget(scroll)
        
        self.grid_content = QWidget()
        
        # Use a QVBoxLayout with a stretch at the bottom to hold the grid
        # so that grid rows don't expand vertically
        self.grid_container_layout = QVBoxLayout(self.grid_content)
        self.grid_container_layout.setContentsMargins(0, 0, 0, 0)
        
        self.grid_layout = QGridLayout()
        self.grid_layout.setSpacing(20)
        
        self.grid_container_layout.addLayout(self.grid_layout)
        self.grid_container_layout.addStretch()
        
        scroll.setWidget(self.grid_content)
        
        layout.addWidget(content)
        self.load_devices()
        
    def load_devices(self):
        if hasattr(self.bridge, "get_saved_devices"):
            res = self.bridge.get_saved_devices()
            if res and res.get("success"):
                self.devices = res.get("devices", [])
                self.lbl_count.setText(f"共 {len(self.devices)} 台设备")
                self.render_devices()

    def add_device_dialog(self):
        # A simple dialog to add device
        dialog = QDialog(self)
        dialog.setWindowTitle("添加设备")
        dialog.setFixedSize(400, 250)
        dialog.setStyleSheet(GLOBAL_STYLE)
        
        layout = QVBoxLayout(dialog)
        
        form = QFormLayout()
        inp_name = QLineEdit()
        inp_id = QLineEdit()
        inp_pwd = QLineEdit()
        inp_pwd.setEchoMode(QLineEdit.Password)
        
        form.addRow("设备名称:", inp_name)
        form.addRow("设备 ID:", inp_id)
        form.addRow("访问密码:", inp_pwd)
        
        layout.addLayout(form)
        
        btns = QHBoxLayout()
        btn_ok = QPushButton("确定")
        btn_ok.setObjectName("primaryBtn")
        btn_cancel = QPushButton("取消")
        btn_cancel.setObjectName("iconBtn")
        btn_cancel.setStyleSheet(f"border: 1px solid {BORDER_COLOR};")
        
        btns.addStretch()
        btns.addWidget(btn_cancel)
        btns.addWidget(btn_ok)
        layout.addLayout(btns)
        
        btn_cancel.clicked.connect(dialog.reject)
        
        def on_add():
            name = inp_name.text().strip()
            did = inp_id.text().strip()
            pwd = inp_pwd.text().strip()
            if name and did:
                self.devices.append({"name": name, "deviceId": did, "password": pwd, "online": False, "os": "Windows", "id": str(int(time.time()))})
                if hasattr(self.bridge, "save_devices"):
                    self.bridge.save_devices(self.devices)
                self.load_devices()
                dialog.accept()
                self.show_message("设备已添加")
        
        btn_ok.clicked.connect(on_add)
        dialog.exec_()

    def edit_device_dialog(self, dev_id):
        # Find the device
        device = next((d for d in self.devices if d.get("id") == dev_id), None)
        if not device:
            return
            
        dialog = QDialog(self)
        dialog.setWindowTitle("编辑设备")
        dialog.setFixedSize(400, 250)
        dialog.setStyleSheet(GLOBAL_STYLE)
        
        layout = QVBoxLayout(dialog)
        
        form = QFormLayout()
        inp_name = QLineEdit()
        inp_name.setText(device.get("name", ""))
        inp_id = QLineEdit()
        inp_id.setText(device.get("deviceId", ""))
        inp_pwd = QLineEdit()
        inp_pwd.setEchoMode(QLineEdit.Password)
        inp_pwd.setText(device.get("password", ""))
        
        form.addRow("设备名称:", inp_name)
        form.addRow("设备 ID:", inp_id)
        form.addRow("访问密码:", inp_pwd)
        
        layout.addLayout(form)
        
        btns = QHBoxLayout()
        btn_ok = QPushButton("保存")
        btn_ok.setObjectName("primaryBtn")
        btn_cancel = QPushButton("取消")
        btn_cancel.setObjectName("iconBtn")
        btn_cancel.setStyleSheet(f"border: 1px solid {BORDER_COLOR};")
        
        btns.addStretch()
        btns.addWidget(btn_cancel)
        btns.addWidget(btn_ok)
        layout.addLayout(btns)
        
        btn_cancel.clicked.connect(dialog.reject)
        
        def on_save():
            name = inp_name.text().strip()
            did = inp_id.text().strip()
            pwd = inp_pwd.text().strip()
            if name and did:
                device["name"] = name
                device["deviceId"] = did
                device["password"] = pwd
                if hasattr(self.bridge, "save_devices"):
                    self.bridge.save_devices(self.devices)
                self.load_devices()
                dialog.accept()
                self.show_message("设置已保存")
        
        btn_ok.clicked.connect(on_save)
        dialog.exec_()

    def connect_device(self, did, pwd):
        if not pwd:
            self.show_message("请先设置访问密码")
            return
            
        self.show_message(f"正在连接到 {did}...")
        
        # 尝试获取 APP_URL
        base_url = "https://rootdesk.cn"
        if hasattr(self.bridge, "get_app_url"):
            res = self.bridge.get_app_url()
            if res and res.get("url"):
                base_url = res.get("url")
        
        if hasattr(self.bridge, "connect_to_remote"):
            try:
                # Call bridge method with positional arguments as defined in client.py
                res = self.bridge.connect_to_remote(did, pwd)
            except Exception as e:
                # Fallback to URL opening if bridge fails
                try:
                    url = f"{base_url.rstrip('/')}/?deviceId={did.replace(' ', '')}&password={pwd}&autostart=true"
                    QDesktopServices.openUrl(QUrl(url))
                    res = {"success": True}
                except:
                    QMessageBox.warning(self, "连接失败", f"调用接口失败: {str(e)}")
                    return
            
            if res and not res.get("success"):
                QMessageBox.warning(self, "连接失败", res.get("error", "未知错误"))
        else:
            try:
                url = f"{base_url.rstrip('/')}/?deviceId={did.replace(' ', '')}&password={pwd}&autostart=true"
                QDesktopServices.openUrl(QUrl(url))
            except Exception as e:
                print("Connect remote error:", e)

    def delete_device(self, dev_id):
        reply = QMessageBox.question(self, "确认删除", "确定要删除这个设备吗？", QMessageBox.Yes | QMessageBox.No)
        if reply == QMessageBox.Yes:
            self.devices = [d for d in self.devices if d.get("id") != dev_id]
            if hasattr(self.bridge, "save_devices"):
                self.bridge.save_devices(self.devices)
            self.load_devices()
            self.show_message("设备已删除")

    def show_message(self, text):
        toast = Toast(text, self)
        toast.show_toast()

    def render_devices(self):
        # Clear layout
        for i in reversed(range(self.grid_layout.count())): 
            self.grid_layout.itemAt(i).widget().setParent(None)
            
        search_term = self.inp_search.text().strip().lower()
        
        # Initial filter by search term
        filtered = [d for d in self.devices if search_term in d.get("name", "").lower() or search_term in d.get("deviceId", "")]
        
        # Further filter by online/offline status
        if self.btn_online.isChecked():
            filtered = [d for d in filtered if d.get("online")]
        elif self.btn_offline.isChecked():
            filtered = [d for d in filtered if not d.get("online")]

        if not filtered:
            empty = QLabel("没有找到设备\n点击上方'添加设备'按钮添加新设备")
            empty.setAlignment(Qt.AlignCenter)
            empty.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 16px;")
            self.grid_layout.addWidget(empty, 0, 0)
            return

        for i, dev in enumerate(filtered):
            card = QFrame()
            card.setObjectName("card")
            # Set fixed height or size policy to prevent stretching
            card.setFixedHeight(180)
            
            c_layout = QVBoxLayout(card)
            c_layout.setContentsMargins(20, 20, 20, 20)
            c_layout.setSpacing(12)
            
            header = QHBoxLayout()
            
            # Left icon
            icon_container = QFrame()
            icon_container.setFixedSize(48, 48)
            icon_container.setStyleSheet(f"background-color: {'rgba(34, 197, 94, 0.1)' if dev.get('online') else 'rgba(255, 255, 255, 0.05)'}; border-radius: 8px;")
            icon_layout = QVBoxLayout(icon_container)
            icon_layout.setContentsMargins(0, 0, 0, 0)
            icon_lbl = QLabel()
            icon_lbl.setPixmap(qta.icon('fa5s.desktop', color=SUCCESS_COLOR if dev.get('online') else MUTED_COLOR).pixmap(QSize(24, 24)))
            icon_lbl.setStyleSheet("background: transparent;")
            icon_lbl.setAlignment(Qt.AlignCenter)
            icon_layout.addWidget(icon_lbl)
            header.addWidget(icon_container)
            
            # Title & ID
            title_layout = QVBoxLayout()
            title_layout.setSpacing(2)
            title = QLabel(dev.get("name", "未知设备"))
            title.setStyleSheet("font-weight: bold; font-size: 16px;")
            did = QLabel(dev.get("deviceId", ""))
            did.setStyleSheet(f"color: {MUTED_COLOR}; font-family: monospace; font-size: 13px;")
            title_layout.addWidget(title)
            title_layout.addWidget(did)
            
            header.addLayout(title_layout)
            header.addStretch()
            
            # Actions (Edit/Delete)
            actions = QHBoxLayout()
            actions.setSpacing(4)
            btn_edit = QPushButton()
            btn_edit.setIcon(qta.icon('fa5s.edit', color=MUTED_COLOR))
            btn_edit.setObjectName("iconBtn")
            btn_edit.setFixedSize(32, 32)
            btn_edit.setStyleSheet(f"background-color: transparent; color: {MUTED_COLOR}; font-size: 14px;")
            btn_edit.clicked.connect(lambda checked, dev_id=dev.get("id"): self.edit_device_dialog(dev_id))
            
            btn_del = QPushButton()
            btn_del.setIcon(qta.icon('fa5s.trash-alt', color=MUTED_COLOR))
            btn_del.setObjectName("iconBtn")
            btn_del.setFixedSize(32, 32)
            btn_del.setStyleSheet(f"background-color: transparent; color: {MUTED_COLOR}; font-size: 14px;")
            btn_del.clicked.connect(lambda checked, dev_id=dev.get("id"): self.delete_device(dev_id))
            
            actions.addWidget(btn_edit)
            actions.addWidget(btn_del)
            header.addLayout(actions)
            
            c_layout.addLayout(header)
            
            # Divider
            divider = QFrame()
            divider.setFrameShape(QFrame.HLine)
            divider.setStyleSheet(f"background-color: {BORDER_COLOR};")
            c_layout.addWidget(divider)
            
            # Status & OS
            status_layout = QHBoxLayout()
            status_dot = QLabel()
            status_dot.setPixmap(qta.icon('fa5s.circle', color=SUCCESS_COLOR if dev.get('online') else MUTED_COLOR).pixmap(QSize(8, 8)))
            status_dot.setStyleSheet("background: transparent;")
            status = QLabel("在线" if dev.get('online') else "未知")
            status.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
            status_layout.addWidget(status_dot)
            status_layout.addWidget(status)
            status_layout.addStretch()
            os_lbl = QLabel(dev.get("os", "未知"))
            os_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
            status_layout.addWidget(os_lbl)
            c_layout.addLayout(status_layout)
            
            # Connect Button
            btn_connect = QPushButton("快速连接")
            btn_connect.setStyleSheet(f"""
                QPushButton {{
                    background-color: rgba(59, 130, 246, 0.15); 
                    color: {PRIMARY_COLOR}; 
                    font-weight: bold; 
                    padding: 10px; 
                    border-radius: 8px; 
                    margin-top: 4px;
                }}
                QPushButton:hover {{
                    background-color: rgba(59, 130, 246, 0.25);
                }}
            """)
            btn_connect.setCursor(Qt.PointingHandCursor)
            btn_connect.clicked.connect(lambda _, d=dev.get("deviceId"), p=dev.get("password", ""): self.connect_device(d, p))
            c_layout.addWidget(btn_connect)
            
            row = i // 2  # 2 columns per row as seen in screenshot
            col = i % 2
            self.grid_layout.addWidget(card, row, col)

class SettingsWidget(QWidget):
    def __init__(self, bridge, parent=None):
        super().__init__(parent)
        self.bridge = bridge
        self.initUI()
        
    def initUI(self):
        main_layout = QHBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        # Sidebar
        sidebar = QFrame()
        sidebar.setFixedWidth(200)
        sidebar.setStyleSheet(f"background-color: rgba(19,19,24,0.5); border-right: 1px solid {BORDER_COLOR};")
        side_layout = QVBoxLayout(sidebar)
        side_layout.setContentsMargins(12, 24, 12, 24)
        
        title = QLabel("设置")
        title.setStyleSheet(f"color: {MUTED_COLOR}; font-weight: bold; padding: 0 10px; margin-bottom: 12px;")
        side_layout.addWidget(title)
        
        self.tabs = QStackedWidget()
        
        sections = ["通用设置", "安全设置", "显示设置", "网络设置", "通知设置", "存储设置"]
        self.nav_btns = []
        for i, section in enumerate(sections):
            btn = QPushButton(section)
            btn.setObjectName("settingsNavBtn")
            btn.setCheckable(True)
            btn.clicked.connect(lambda checked, idx=i: self.switch_section(idx))
            side_layout.addWidget(btn)
            self.nav_btns.append(btn)
            
            page = QScrollArea()
            page.setWidgetResizable(True)
            page.setFrameShape(QFrame.NoFrame)
            page.setStyleSheet("background-color: transparent;")
            
            page_content = QWidget()
            page_layout = QVBoxLayout(page_content)
            page_layout.setContentsMargins(32, 32, 32, 32)
            page_layout.setSpacing(24)
            
            lbl = QLabel(section)
            lbl.setStyleSheet("font-size: 24px; font-weight: bold; margin-bottom: 10px;")
            page_layout.addWidget(lbl)
            
            # Specific card generation for each section
            if i == 0: # 通用设置
                self.create_general_settings(page_layout)
            elif i == 1: # 安全设置
                self.create_security_settings(page_layout)
            elif i == 2: # 显示设置
                self.create_display_settings(page_layout)
            elif i == 3: # 网络设置
                self.create_network_settings(page_layout)
            elif i == 4: # 通知设置
                self.create_notification_settings(page_layout)
            elif i == 5: # 存储设置
                self.create_storage_settings(page_layout)
            else:
                card = QFrame()
                card.setObjectName("card")
                c_layout = QVBoxLayout(card)
                c_layout.setContentsMargins(24, 24, 24, 24)
                c_layout.addWidget(QLabel("配置项待完善..."))
                page_layout.addWidget(card)
            
            page_layout.addStretch()
            page.setWidget(page_content)
            
            self.tabs.addWidget(page)
            
        side_layout.addStretch()
        
        if self.nav_btns:
            self.nav_btns[0].setChecked(True)
        
        main_layout.addWidget(sidebar)
        main_layout.addWidget(self.tabs)
        
    def switch_section(self, index):
        for i, btn in enumerate(self.nav_btns):
            btn.setChecked(i == index)
        self.tabs.setCurrentIndex(index)

    def _create_card(self, title_text, items, page_layout):
        card = QFrame()
        card.setObjectName("card")
        c_layout = QVBoxLayout(card)
        c_layout.setContentsMargins(24, 24, 24, 24)
        
        c_title = QLabel(title_text)
        c_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        c_layout.addWidget(c_title)
        
        for stitle, sdesc in items:
            row_layout = QHBoxLayout()
            text_layout = QVBoxLayout()
            t_lbl = QLabel(stitle)
            t_lbl.setStyleSheet("font-size: 14px; font-weight: bold;")
            d_lbl = QLabel(sdesc)
            d_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
            text_layout.addWidget(t_lbl)
            text_layout.addWidget(d_lbl)
            
            toggle = ToggleSwitch()
            toggle.setChecked(True)
            
            row_layout.addLayout(text_layout)
            row_layout.addStretch()
            row_layout.addWidget(toggle)
            
            c_layout.addLayout(row_layout)
            c_layout.addSpacing(16)
            
        page_layout.addWidget(card)

    def create_general_settings(self, page_layout):
        card = QFrame()
        card.setObjectName("card")
        c_layout = QVBoxLayout(card)
        c_layout.setContentsMargins(24, 24, 24, 24)
        
        c_title = QLabel("基本设置")
        c_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        c_layout.addWidget(c_title)
        
        settings = {}
        if hasattr(self.bridge, "get_all_settings"):
            settings = self.bridge.get_all_settings()
            
        items = [
            ("autoStart", "开机自动启动", "系统启动时自动运行 RootDesk", settings.get("autoStart", False)),
            ("trayIcon", "最小化到系统托盘", "关闭窗口时最小化到托盘而不是退出", settings.get("trayIcon", True)),
            ("autoUpdate", "自动检查更新", "定期检查是否有新版本可用", settings.get("autoUpdate", True))
        ]
        
        for key, stitle, sdesc, is_checked in items:
            row_layout = QHBoxLayout()
            text_layout = QVBoxLayout()
            t_lbl = QLabel(stitle)
            t_lbl.setStyleSheet("font-size: 14px; font-weight: bold;")
            d_lbl = QLabel(sdesc)
            d_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
            text_layout.addWidget(t_lbl)
            text_layout.addWidget(d_lbl)
            
            toggle = ToggleSwitch()
            toggle.setChecked(is_checked)
            toggle.clicked.connect(lambda checked, k=key: self.update_setting(k, checked))
            
            row_layout.addLayout(text_layout)
            row_layout.addStretch()
            row_layout.addWidget(toggle)
            
            c_layout.addLayout(row_layout)
            c_layout.addSpacing(16)
            
        page_layout.addWidget(card)
        
        # Language card
        lang_card = QFrame()
        lang_card.setObjectName("card")
        l_layout = QVBoxLayout(lang_card)
        l_layout.setContentsMargins(24, 24, 24, 24)
        l_title = QLabel("语言和区域")
        l_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        l_layout.addWidget(l_title)
        
        combo_lbl = QLabel("界面语言")
        combo_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        l_layout.addWidget(combo_lbl)
        combo = QComboBox()
        combo.addItems(["简体中文", "English"])
        l_layout.addWidget(combo)
        page_layout.addWidget(lang_card)

    def update_setting(self, key, value):
        if hasattr(self.bridge, "update_setting"):
            res = self.bridge.update_setting(key, value)
            if res and not res.get("success"):
                QMessageBox.warning(self, "设置失败", res.get("error", "未知错误"))

    def create_security_settings(self, page_layout):
        self._create_card("访问控制", [
            ("需要确认才能被控制", "远程连接时需要本地确认"),
            ("自动锁定屏幕", "远程连接结束后自动锁定本机"),
            ("访问码自动刷新", "定期自动更换访问码增强安全性")
        ], page_layout)

        # Access Code Card
        code_card = QFrame()
        code_card.setObjectName("card")
        c_layout = QVBoxLayout(code_card)
        c_layout.setContentsMargins(24, 24, 24, 24)
        c_title = QLabel("访问码设置")
        c_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        c_layout.addWidget(c_title)
        
        combo_lbl = QLabel("访问码刷新周期")
        combo_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        c_layout.addWidget(combo_lbl)
        combo = QComboBox()
        combo.addItems(["每1小时", "每6小时", "每12小时", "每24小时"])
        combo.setCurrentIndex(2)
        c_layout.addWidget(combo)
        
        c_layout.addSpacing(16)
        
        pwd_lbl = QLabel("固定访问密码 (可选)")
        pwd_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        c_layout.addWidget(pwd_lbl)
        pwd_layout = QHBoxLayout()
        inp_pwd = QLineEdit()
        inp_pwd.setEchoMode(QLineEdit.Password)
        inp_pwd.setPlaceholderText("设置固定密码后访问码将不再刷新")
        btn_save = QPushButton("保存")
        btn_save.setObjectName("primaryBtn")
        pwd_layout.addWidget(inp_pwd)
        pwd_layout.addWidget(btn_save)
        c_layout.addLayout(pwd_layout)
        
        page_layout.addWidget(code_card)

        # IP Whitelist Card
        ip_card = QFrame()
        ip_card.setObjectName("card")
        ip_layout = QVBoxLayout(ip_card)
        ip_layout.setContentsMargins(24, 24, 24, 24)
        ip_title = QLabel("IP白名单")
        ip_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 4px;")
        ip_layout.addWidget(ip_title)
        ip_desc = QLabel("仅允许指定IP地址的设备连接")
        ip_desc.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px; margin-bottom: 16px;")
        ip_layout.addWidget(ip_desc)

        enable_layout = QHBoxLayout()
        enable_lbl = QLabel("启用IP白名单")
        enable_lbl.setStyleSheet("font-size: 14px; font-weight: bold;")
        toggle = ToggleSwitch()
        enable_layout.addWidget(enable_lbl)
        enable_layout.addStretch()
        enable_layout.addWidget(toggle)
        ip_layout.addLayout(enable_layout)
        ip_layout.addSpacing(16)

        inp_layout = QHBoxLayout()
        inp_ip = QLineEdit()
        inp_ip.setPlaceholderText("输入IP地址")
        btn_add = QPushButton("添加")
        btn_add.setObjectName("primaryBtn")
        inp_layout.addWidget(inp_ip)
        inp_layout.addWidget(btn_add)
        ip_layout.addLayout(inp_layout)

        page_layout.addWidget(ip_card)

    def create_display_settings(self, page_layout):
        card = QFrame()
        card.setObjectName("card")
        c_layout = QVBoxLayout(card)
        c_layout.setContentsMargins(24, 24, 24, 24)
        
        c_title = QLabel("远程画面")
        c_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        c_layout.addWidget(c_title)
        
        combo_lbl1 = QLabel("画质模式")
        combo_lbl1.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        c_layout.addWidget(combo_lbl1)
        combo1 = QComboBox()
        combo1.addItems(["自动 (根据网络调整)", "高画质", "平衡", "流畅优先"])
        combo1.setCurrentIndex(2)
        c_layout.addWidget(combo1)
        
        c_layout.addSpacing(16)
        
        combo_lbl2 = QLabel("帧率限制")
        combo_lbl2.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        c_layout.addWidget(combo_lbl2)
        combo2 = QComboBox()
        combo2.addItems(["30 FPS", "60 FPS", "120 FPS", "不限制"])
        combo2.setCurrentIndex(1)
        c_layout.addWidget(combo2)
        
        c_layout.addSpacing(16)
        
        for stitle, sdesc in [("显示远程光标", "在远程桌面上显示对方的鼠标光标"), ("全屏模式启动", "连接时自动进入全屏模式")]:
            row_layout = QHBoxLayout()
            text_layout = QVBoxLayout()
            t_lbl = QLabel(stitle)
            t_lbl.setStyleSheet("font-size: 14px; font-weight: bold;")
            d_lbl = QLabel(sdesc)
            d_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
            text_layout.addWidget(t_lbl)
            text_layout.addWidget(d_lbl)
            
            toggle = ToggleSwitch()
            if stitle == "显示远程光标":
                toggle.setChecked(True)
            
            row_layout.addLayout(text_layout)
            row_layout.addStretch()
            row_layout.addWidget(toggle)
            
            c_layout.addLayout(row_layout)
            c_layout.addSpacing(16)
            
        page_layout.addWidget(card)
        
        # Theme Settings
        theme_card = QFrame()
        theme_card.setObjectName("card")
        t_layout = QVBoxLayout(theme_card)
        t_layout.setContentsMargins(24, 24, 24, 24)
        t_title = QLabel("主题设置")
        t_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        t_layout.addWidget(t_title)
        
        t_lbl = QLabel("外观主题")
        t_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        t_layout.addWidget(t_lbl)
        
        theme_btn_layout = QHBoxLayout()
        for t_name in ["深色", "浅色", "跟随系统"]:
            btn = QPushButton(t_name)
            btn.setMinimumHeight(60)
            if t_name == "深色":
                btn.setStyleSheet(f"background-color: transparent; border: 2px solid {PRIMARY_COLOR}; border-radius: 8px; font-weight: bold;")
            else:
                btn.setStyleSheet(f"background-color: transparent; border: 1px solid {BORDER_COLOR}; border-radius: 8px;")
            theme_btn_layout.addWidget(btn)
        
        t_layout.addLayout(theme_btn_layout)
        page_layout.addWidget(theme_card)

    def create_network_settings(self, page_layout):
        card = QFrame()
        card.setObjectName("card")
        c_layout = QVBoxLayout(card)
        c_layout.setContentsMargins(24, 24, 24, 24)
        
        c_title = QLabel("连接服务器")
        c_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 4px;")
        c_layout.addWidget(c_title)
        c_desc = QLabel("配置远程控制服务器的连接信息")
        c_desc.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px; margin-bottom: 16px;")
        c_layout.addWidget(c_desc)
        
        net_cfg = {}
        if hasattr(self.bridge, "get_network_config"):
            net_cfg = self.bridge.get_network_config()
            
        grid = QGridLayout()
        grid.setSpacing(16)
        
        lbl1 = QLabel("协议")
        lbl1.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
        self.net_protocol = QComboBox()
        self.net_protocol.addItems(["WS (不加密)", "WSS (加密)"])
        self.net_protocol.setCurrentIndex(1 if net_cfg.get("protocol") == "wss" else 0)
        grid.addWidget(lbl1, 0, 0)
        grid.addWidget(self.net_protocol, 1, 0)
        
        lbl2 = QLabel("服务器地址")
        lbl2.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
        self.net_host = QLineEdit()
        self.net_host.setText(net_cfg.get("host", "rootdesk.cn"))
        grid.addWidget(lbl2, 0, 1)
        grid.addWidget(self.net_host, 1, 1)
        
        lbl3 = QLabel("端口")
        lbl3.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
        self.net_port = QLineEdit()
        self.net_port.setText(str(net_cfg.get("port", 443)))
        grid.addWidget(lbl3, 2, 0)
        grid.addWidget(self.net_port, 3, 0)
        
        lbl4 = QLabel("重连间隔 (秒)")
        lbl4.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
        self.net_recon = QLineEdit()
        self.net_recon.setText(str(net_cfg.get("reconnectInterval", 5)))
        grid.addWidget(lbl4, 2, 1)
        grid.addWidget(self.net_recon, 3, 1)
        
        c_layout.addLayout(grid)
        c_layout.addSpacing(16)
        
        lbl5 = QLabel("上线备注")
        lbl5.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
        self.net_remark = QLineEdit()
        self.net_remark.setText(net_cfg.get("remark", "RootDesk"))
        c_layout.addWidget(lbl5)
        c_layout.addWidget(self.net_remark)
        
        c_layout.addSpacing(16)
        btn_save = QPushButton("保存并重连")
        btn_save.setObjectName("primaryBtn")
        btn_save.setStyleSheet(f"""
            QPushButton#primaryBtn {{
                background-color: {SUCCESS_COLOR};
            }}
            QPushButton#primaryBtn:hover {{
                background-color: #16a34a;
            }}
        """)
        btn_save.clicked.connect(self.save_network_config)
        c_layout.addWidget(btn_save)
        
        page_layout.addWidget(card)
        
        self._create_card("连接设置", [
            ("优先使用P2P直连", "直接连接可获得更低延迟"),
            ("自动重连", "网络中断后自动尝试重新连接")
        ], page_layout)

        proxy_card = QFrame()
        proxy_card.setObjectName("card")
        p_layout = QVBoxLayout(proxy_card)
        p_layout.setContentsMargins(24, 24, 24, 24)
        p_title = QLabel("代理设置")
        p_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        p_layout.addWidget(p_title)
        
        lbl = QLabel("代理模式")
        lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        p_layout.addWidget(lbl)
        combo = QComboBox()
        combo.addItems(["不使用代理", "使用系统代理", "自定义代理"])
        p_layout.addWidget(combo)
        page_layout.addWidget(proxy_card)
        
        bw_card = QFrame()
        bw_card.setObjectName("card")
        b_layout = QVBoxLayout(bw_card)
        b_layout.setContentsMargins(24, 24, 24, 24)
        b_title = QLabel("带宽设置")
        b_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        b_layout.addWidget(b_title)
        
        lbl = QLabel("上传带宽限制")
        lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        b_layout.addWidget(lbl)
        combo = QComboBox()
        combo.addItems(["不限制", "1 Mbps", "5 Mbps", "10 Mbps", "20 Mbps"])
        b_layout.addWidget(combo)
        page_layout.addWidget(bw_card)

    def save_network_config(self):
        if hasattr(self.bridge, "update_network_config"):
            protocol = "wss" if self.net_protocol.currentIndex() == 1 else "ws"
            res = self.bridge.update_network_config(
                protocol, 
                self.net_host.text().strip(),
                self.net_port.text().strip(),
                self.net_remark.text().strip(),
                self.net_recon.text().strip()
            )
            if res and res.get("success"):
                QMessageBox.information(self, "成功", "网络配置已保存并尝试重新连接。\n\n提示：如果配置未生效，请尝试重启客户端。")
            else:
                QMessageBox.warning(self, "失败", res.get("error", "未知错误"))

    def create_notification_settings(self, page_layout):
        self._create_card("连接通知", [
            ("有人连接时通知", "当有远程设备连接到本机时显示通知"),
            ("连接断开时通知", "当远程连接断开时显示通知"),
            ("播放提示音", "连接/断开时播放声音提示")
        ], page_layout)
        
        self._create_card("系统通知", [
            ("版本更新通知", "有新版本时显示更新提示")
        ], page_layout)

    def create_storage_settings(self, page_layout):
        card = QFrame()
        card.setObjectName("card")
        c_layout = QVBoxLayout(card)
        c_layout.setContentsMargins(24, 24, 24, 24)
        c_title = QLabel("文件传输")
        c_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        c_layout.addWidget(c_title)
        
        lbl = QLabel("默认下载目录")
        lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 8px;")
        c_layout.addWidget(lbl)
        
        inp_layout = QHBoxLayout()
        inp = QLineEdit()
        inp.setText("~/Downloads/RootDesk")
        inp.setReadOnly(True)
        btn = QPushButton(" 浏览")
        btn.setIcon(qta.icon('fa5s.folder-open', color=FG_COLOR))
        btn.setStyleSheet(f"background-color: {CARD_COLOR}; border: 1px solid {BORDER_COLOR}; border-radius: 8px; padding: 12px;")
        inp_layout.addWidget(inp)
        inp_layout.addWidget(btn)
        c_layout.addLayout(inp_layout)
        
        c_layout.addSpacing(16)
        
        row_layout = QHBoxLayout()
        text_layout = QVBoxLayout()
        t_lbl = QLabel("同名文件自动重命名")
        t_lbl.setStyleSheet("font-size: 14px; font-weight: bold;")
        d_lbl = QLabel("下载时遇到同名文件自动添加序号")
        d_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
        text_layout.addWidget(t_lbl)
        text_layout.addWidget(d_lbl)
        
        toggle = ToggleSwitch()
        toggle.setChecked(True)
        
        row_layout.addLayout(text_layout)
        row_layout.addStretch()
        row_layout.addWidget(toggle)
        c_layout.addLayout(row_layout)
        page_layout.addWidget(card)
        
        cache_card = QFrame()
        cache_card.setObjectName("card")
        c_layout = QVBoxLayout(cache_card)
        c_layout.setContentsMargins(24, 24, 24, 24)
        c_title = QLabel("缓存管理")
        c_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        c_layout.addWidget(c_title)
        
        info_layout = QHBoxLayout()
        text_layout = QVBoxLayout()
        t_lbl = QLabel("缓存大小")
        t_lbl.setStyleSheet("font-size: 14px; font-weight: bold;")
        d_lbl = QLabel("包括截图、临时文件等")
        d_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
        text_layout.addWidget(t_lbl)
        text_layout.addWidget(d_lbl)
        info_layout.addLayout(text_layout)
        info_layout.addStretch()
        val_lbl = QLabel("256 MB")
        val_lbl.setStyleSheet(f"color: {PRIMARY_COLOR}; font-weight: bold; font-size: 14px;")
        info_layout.addWidget(val_lbl)
        c_layout.addLayout(info_layout)
        
        c_layout.addSpacing(16)
        btn_clear = QPushButton(" 清除缓存")
        btn_clear.setIcon(qta.icon('fa5s.trash-alt', color=DANGER_COLOR))
        btn_clear.setStyleSheet(f"background-color: transparent; border: 1px solid {BORDER_COLOR}; color: {DANGER_COLOR}; border-radius: 8px; padding: 12px;")
        c_layout.addWidget(btn_clear)
        page_layout.addWidget(cache_card)
        
        hist_card = QFrame()
        hist_card.setObjectName("card")
        h_layout = QVBoxLayout(hist_card)
        h_layout.setContentsMargins(24, 24, 24, 24)
        h_title = QLabel("连接历史")
        h_title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 16px;")
        h_layout.addWidget(h_title)
        
        row_layout = QHBoxLayout()
        text_layout = QVBoxLayout()
        t_lbl = QLabel("保存连接历史")
        t_lbl.setStyleSheet("font-size: 14px; font-weight: bold;")
        d_lbl = QLabel("记录最近连接的设备")
        d_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
        text_layout.addWidget(t_lbl)
        text_layout.addWidget(d_lbl)
        
        toggle = ToggleSwitch()
        toggle.setChecked(True)
        
        row_layout.addLayout(text_layout)
        row_layout.addStretch()
        row_layout.addWidget(toggle)
        h_layout.addLayout(row_layout)
        
        h_layout.addSpacing(16)
        btn_clear_hist = QPushButton(" 清除连接历史")
        btn_clear_hist.setIcon(qta.icon('fa5s.history', color=FG_COLOR))
        btn_clear_hist.setStyleSheet(f"background-color: transparent; border: 1px solid {BORDER_COLOR}; border-radius: 8px; padding: 12px;")
        h_layout.addWidget(btn_clear_hist)
        page_layout.addWidget(hist_card)


class AboutWidget(QWidget):
    def __init__(self, bridge, parent=None):
        super().__init__(parent)
        self.bridge = bridge
        self.initUI()
        
    def initUI(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setStyleSheet("background-color: transparent;")
        layout.addWidget(scroll)
        
        content = QWidget()
        scroll.setWidget(content)
        c_layout = QVBoxLayout(content)
        c_layout.setContentsMargins(40, 40, 40, 40)
        c_layout.setAlignment(Qt.AlignTop | Qt.AlignHCenter)
        
        # Hero
        icon_box = QLabel()
        icon_box.setPixmap(qta.icon('fa5s.desktop', color='white').pixmap(QSize(40, 40)))
        icon_box.setFixedSize(80, 80)
        icon_box.setStyleSheet(f"background-color: {PRIMARY_COLOR}; color: white; border-radius: 24px; font-size: 40px;")
        icon_box.setAlignment(Qt.AlignCenter)
        
        hero_icon_layout = QHBoxLayout()
        hero_icon_layout.addStretch()
        hero_icon_layout.addWidget(icon_box)
        hero_icon_layout.addStretch()
        c_layout.addLayout(hero_icon_layout)
        
        lbl_logo = QLabel("RootDesk")
        lbl_logo.setStyleSheet("font-size: 36px; font-weight: bold; margin-top: 20px;")
        lbl_logo.setAlignment(Qt.AlignCenter)
        c_layout.addWidget(lbl_logo)
        
        lbl_desc = QLabel("开源远程桌面控制解决方案")
        lbl_desc.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 16px; margin-bottom: 20px;")
        lbl_desc.setAlignment(Qt.AlignCenter)
        c_layout.addWidget(lbl_desc)
        
        version_str = "版本 v1.0.2"
        if hasattr(self.bridge, "get_init_data"):
            data = self.bridge.get_init_data()
            if data and "version" in data:
                version_str = f"版本 v{data['version']}"
                
        lbl_ver = QLabel(version_str)
        lbl_ver.setStyleSheet(f"background-color: {CARD_COLOR}; padding: 6px 16px; border-radius: 16px; border: 1px solid {BORDER_COLOR}; font-family: monospace;")
        lbl_ver.setAlignment(Qt.AlignCenter)
        
        hero_h = QHBoxLayout()
        hero_h.addStretch()
        hero_h.addWidget(lbl_ver)
        hero_h.addStretch()
        c_layout.addLayout(hero_h)
        
        btn_update = QPushButton(" 检查更新")
        btn_update.setIcon(qta.icon('fa5s.sync-alt', color=MUTED_COLOR))
        btn_update.setObjectName("iconBtn")
        btn_update.setStyleSheet(f"border: 1px solid {BORDER_COLOR}; padding: 8px 16px; border-radius: 8px; margin-top: 16px; margin-bottom: 40px;")
        btn_update.clicked.connect(self.check_update)
        
        btn_update_layout = QHBoxLayout()
        btn_update_layout.addStretch()
        btn_update_layout.addWidget(btn_update)
        btn_update_layout.addStretch()
        c_layout.addLayout(btn_update_layout)
        
        # Update Info Panel (Initially Hidden)
        self.update_panel = QFrame()
        self.update_panel.setObjectName("card")
        self.update_panel.setStyleSheet(f"QFrame#card {{ background-color: rgba(34, 197, 94, 0.1); border: 1px solid {SUCCESS_COLOR}; border-radius: 12px; }}")
        self.update_panel.setFixedWidth(600)
        self.update_panel.setVisible(False)
        
        u_layout = QVBoxLayout(self.update_panel)
        u_layout.setContentsMargins(20, 20, 20, 20)
        
        u_header = QHBoxLayout()
        u_icon = QLabel()
        u_icon.setPixmap(qta.icon('fa5s.arrow-alt-circle-up', color=SUCCESS_COLOR).pixmap(QSize(20, 20)))
        self.lbl_update_title = QLabel("发现新版本")
        self.lbl_update_title.setStyleSheet(f"color: {SUCCESS_COLOR}; font-size: 16px; font-weight: bold;")
        u_header.addWidget(u_icon)
        u_header.addWidget(self.lbl_update_title)
        u_header.addStretch()
        u_layout.addLayout(u_header)
        
        self.lbl_update_desc = QLabel("")
        self.lbl_update_desc.setStyleSheet(f"color: {FG_COLOR}; font-size: 13px; margin-top: 10px;")
        self.lbl_update_desc.setWordWrap(True)
        u_layout.addWidget(self.lbl_update_desc)
        
        u_btn_layout = QHBoxLayout()
        u_btn_layout.addStretch()
        btn_go_update = QPushButton(" 立即更新")
        btn_go_update.setIcon(qta.icon('fa5s.download', color='white'))
        btn_go_update.setStyleSheet(f"background-color: {SUCCESS_COLOR}; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold;")
        btn_go_update.clicked.connect(self.on_panel_update_clicked)
        u_btn_layout.addWidget(btn_go_update)
        u_layout.addLayout(u_btn_layout)
        
        u_panel_h = QHBoxLayout()
        u_panel_h.addStretch()
        u_panel_h.addWidget(self.update_panel)
        u_panel_h.addStretch()
        c_layout.addLayout(u_panel_h)
        c_layout.addSpacing(20)
        
        # Core Features
        features_title = QLabel("核心功能")
        features_title.setStyleSheet("font-size: 22px; font-weight: bold; margin-bottom: 24px;")
        features_title.setAlignment(Qt.AlignCenter)
        c_layout.addWidget(features_title)
        
        features_grid = QGridLayout()
        features_grid.setSpacing(16)
        features = [
            ('fa5s.laptop', "远程控制", "高清流畅的远程桌面控制，支持键鼠同步"),
            ('fa5s.folder-open', "文件传输", "快速安全的文件传输，支持拖拽上传"),
            ('fa5s.lock', "端到端加密", "采用 AES-256 加密，确保数据安全"),
            ('fa5s.bolt', "P2P直连", "支持穿透NAT直连，超低延迟体验"),
            ('fa5s.desktop', "跨平台", "控制端支持 Windows、macOS、Linux 系统"),
            ('fa5s.box', "自主私有化部署", "支持 Docker 一键私有化部署，数据完全由自己掌握。")
        ]
        
        for i, (icon_name, title, desc) in enumerate(features):
            card = QFrame()
            card.setObjectName("card")
            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(24, 24, 24, 24)

            icon_lbl = QLabel()
            icon_lbl.setPixmap(qta.icon(icon_name, color=PRIMARY_COLOR).pixmap(QSize(24, 24)))
            icon_lbl.setFixedSize(48, 48)
            icon_lbl.setStyleSheet(f"background-color: rgba(59, 130, 246, 0.15); color: {PRIMARY_COLOR}; border-radius: 12px; font-size: 24px;")
            icon_lbl.setAlignment(Qt.AlignCenter)

            title_lbl = QLabel(title)
            title_lbl.setStyleSheet("font-size: 16px; font-weight: bold; margin-top: 12px;")

            desc_lbl = QLabel(desc)
            desc_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px;")
            desc_lbl.setWordWrap(True)

            card_layout.addWidget(icon_lbl)
            card_layout.addWidget(title_lbl)
            card_layout.addWidget(desc_lbl)
            card_layout.addStretch()

            features_grid.addWidget(card, i // 3, i % 3)

        c_layout.addLayout(features_grid)
        
        # Links
        links_title = QLabel("相关链接")
        links_title.setStyleSheet("font-size: 20px; font-weight: bold; margin-top: 40px; margin-bottom: 24px;")
        links_title.setAlignment(Qt.AlignCenter)
        c_layout.addWidget(links_title)
        
        links_grid = QGridLayout()
        links_grid.setSpacing(16)
        
        # 动态推导官方链接基准
        base_domain = "rootdesk.cn"
        if hasattr(self.bridge, "get_app_url"):
            res = self.bridge.get_app_url()
            if res and res.get("url"):
                from urllib.parse import urlparse
                parsed = urlparse(res.get("url"))
                if parsed.netloc:
                    # 仅当不是 rootdesk.cn 时尝试使用当前域名
                    if "rootdesk.cn" not in parsed.netloc:
                        base_domain = parsed.netloc

        links = [
            ("Gitee 仓库", "查看源代码，提交 Issue", "fa5b.github", "https://gitee.com/yesmyyyd/rootdesk"),
            ("使用文档", "详细的使用教程和 API 文档", "fa5s.book", f"https://doc.{base_domain}"),
            ("社区交流", "加入 微信群 交流", "fa5s.comment-alt", f"https://contact.{base_domain}"),
            ("问题反馈", "反馈建议与错误报告", "fa5s.exclamation-circle", "https://gitee.com/yesmyyyd/rootdesk/issues")
        ]
        
        for i, (text, desc, icon_name, url) in enumerate(links):
            btn = ClickableWidget()
            btn.setObjectName("card")
            if i == 0:
                btn.setStyleSheet(f"QFrame#card {{ background-color: {CARD_COLOR}; border: 1px solid {PRIMARY_COLOR}; border-radius: 12px; }} QFrame#card:hover {{ background-color: {CARD_HOVER}; }}")
            
            btn_layout = QHBoxLayout(btn)
            btn_layout.setContentsMargins(20, 20, 20, 20)
            
            # Icon styling
            icon_colors = {
                "fa5b.github": ("white", "rgba(255, 255, 255, 0.1)"),
                "fa5s.book": (PRIMARY_COLOR, "rgba(59, 130, 246, 0.15)"),
                "fa5s.comment-alt": (SUCCESS_COLOR, "rgba(34, 197, 94, 0.15)"),
                "fa5s.exclamation-circle": (PRIMARY_COLOR, "rgba(59, 130, 246, 0.15)")
            }
            fg_col, bg_col = icon_colors.get(icon_name, ("white", "rgba(255,255,255,0.1)"))
            
            icon_lbl = QLabel()
            icon_lbl.setPixmap(qta.icon(icon_name, color=fg_col).pixmap(QSize(20, 20)))
            icon_lbl.setFixedSize(40, 40)
            icon_lbl.setStyleSheet(f"background-color: {bg_col}; color: {fg_col}; border-radius: 8px; font-size: 20px;")
            icon_lbl.setAlignment(Qt.AlignCenter)
            btn_layout.addWidget(icon_lbl)
            
            text_layout = QVBoxLayout()
            text_layout.setSpacing(4)
            title_lbl = QLabel(text)
            title_lbl.setStyleSheet("font-size: 15px; font-weight: bold;")
            desc_lbl = QLabel(desc)
            desc_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
            text_layout.addWidget(title_lbl)
            text_layout.addWidget(desc_lbl)
            btn_layout.addLayout(text_layout)
            
            btn_layout.addStretch()
            
            link_icon = QLabel()
            link_icon.setPixmap(qta.icon('fa5s.external-link-alt', color=MUTED_COLOR).pixmap(QSize(14, 14)))
            btn_layout.addWidget(link_icon)
            
            btn.clicked.connect(lambda u=url: QDesktopServices.openUrl(QUrl(u)))
            links_grid.addWidget(btn, i // 2, i % 2)
            
        c_layout.addLayout(links_grid)
        
        # Development Team
        team_title = QLabel("开发团队")
        team_title.setStyleSheet("font-size: 20px; font-weight: bold; margin-top: 40px; margin-bottom: 24px;")
        team_title.setAlignment(Qt.AlignCenter)
        c_layout.addWidget(team_title)
        
        team_card = QFrame()
        team_card.setObjectName("card")
        team_layout = QVBoxLayout(team_card)
        team_layout.setContentsMargins(40, 40, 40, 40)
        team_layout.setAlignment(Qt.AlignCenter)
        
        team_avatar = QLabel("R")
        team_avatar.setFixedSize(60, 60)
        team_avatar.setStyleSheet(f"background-color: {PRIMARY_COLOR}; color: white; border-radius: 30px; font-size: 24px; font-weight: bold;")
        team_avatar.setAlignment(Qt.AlignCenter)
        
        avatar_h = QHBoxLayout()
        avatar_h.addStretch()
        avatar_h.addWidget(team_avatar)
        avatar_h.addStretch()
        team_layout.addLayout(avatar_h)
        
        team_name = QLabel("牧民战天工作室")
        team_name.setStyleSheet("font-size: 16px; font-weight: bold; margin-top: 16px;")
        team_name.setAlignment(Qt.AlignCenter)
        team_layout.addWidget(team_name)
        
        team_role = QLabel("核心开发")
        team_role.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-bottom: 32px;")
        team_role.setAlignment(Qt.AlignCenter)
        team_layout.addWidget(team_role)
        
        divider = QFrame()
        divider.setFrameShape(QFrame.HLine)
        divider.setStyleSheet(f"background-color: {BORDER_COLOR};")
        team_layout.addWidget(divider)
        
        thanks_lbl = QLabel("感谢所有为 RootDesk 做出贡献的开发者们")
        thanks_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 13px; margin-top: 32px; margin-bottom: 16px;")
        thanks_lbl.setAlignment(Qt.AlignCenter)
        team_layout.addWidget(thanks_lbl)
        
        btn_contribute = QPushButton("成为贡献者")
        btn_contribute.setObjectName("primaryBtn")
        btn_contribute.setMinimumWidth(140)
        btn_contribute.setStyleSheet(f"""
            QPushButton {{
                background-color: {PRIMARY_COLOR};
                color: white;
                font-weight: bold;
                border-radius: 8px;
                padding: 12px;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {PRIMARY_HOVER};
            }}
        """)
        
        contrib_h = QHBoxLayout()
        contrib_h.addStretch()
        contrib_h.addWidget(btn_contribute)
        contrib_h.addStretch()
        team_layout.addLayout(contrib_h)
        
        c_layout.addWidget(team_card)
        
        # Tech Stack
        tech_title = QLabel("技术栈")
        tech_title.setStyleSheet("font-size: 20px; font-weight: bold; margin-top: 40px; margin-bottom: 24px;")
        tech_title.setAlignment(Qt.AlignCenter)
        c_layout.addWidget(tech_title)
        
        tech_card = QFrame()
        tech_card.setObjectName("card")
        tech_layout = QHBoxLayout(tech_card)
        tech_layout.setContentsMargins(40, 40, 40, 40)
        
        techs = [
            ("fa5b.rust", "Rust", "核心引擎"),
            ("fa5s.bolt", "WebRTC", "实时通信"),
            ("fa5s.paint-brush", "Tauri", "跨平台UI"),
            ("fa5s.shield-alt", "AES-256", "数据加密")
        ]
        
        for icon_name, name, desc in techs:
            item_layout = QVBoxLayout()
            item_layout.setAlignment(Qt.AlignCenter)
            
            icon_lbl = QLabel()
            icon_lbl.setPixmap(qta.icon(icon_name, color=FG_COLOR).pixmap(QSize(32, 32)))
            icon_lbl.setStyleSheet("font-size: 32px; margin-bottom: 8px;")
            icon_lbl.setAlignment(Qt.AlignCenter)
            item_layout.addWidget(icon_lbl)
            
            name_lbl = QLabel(name)
            name_lbl.setStyleSheet("font-size: 15px; font-weight: bold;")
            name_lbl.setAlignment(Qt.AlignCenter)
            item_layout.addWidget(name_lbl)
            
            desc_lbl = QLabel(desc)
            desc_lbl.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
            desc_lbl.setAlignment(Qt.AlignCenter)
            item_layout.addWidget(desc_lbl)
            
            tech_layout.addLayout(item_layout)
            
        c_layout.addWidget(tech_card)
        
        c_layout.addStretch()
        
        footer = QLabel("RootDesk - 开源远程桌面控制解决方案\nCopyright 2026 RootDesk Team. Licensed under MIT.")
        footer.setStyleSheet(f"color: {MUTED_COLOR}; margin-top: 40px;")
        footer.setAlignment(Qt.AlignCenter)
        c_layout.addWidget(footer)

    def on_panel_update_clicked(self):
        # 统一调用 MainWindow 的下载进度条更新方法
        main_win = self.window()
        if hasattr(main_win, "start_download_update") and hasattr(self, "update_url"):
            main_win.start_download_update(self.update_url)
        elif hasattr(self, "update_url"):
            QDesktopServices.openUrl(QUrl(self.update_url))

    def show_update_info(self, name, desc, url):
        self.update_url = url
        self.lbl_update_title.setText(f"发现新版本 v{name}")
        self.lbl_update_desc.setText(desc)
        self.update_panel.setVisible(True)

    def show_message(self, text):
        toast = Toast(text, self)
        toast.show_toast()

    def check_update(self):
        self.show_message("正在检查更新...")
        
        # 尝试获取 APP_URL 作为默认 URL
        base_url = "https://rootdesk.cn"
        if hasattr(self.bridge, "get_app_url"):
            res_url = self.bridge.get_app_url()
            if res_url and res_url.get("url"):
                base_url = res_url.get("url")

        def thread_worker():
            try:
                if hasattr(self.bridge, "check_for_updates"):
                    res = self.bridge.check_for_updates()
                    if res and res.get("success"):
                        if res.get("hasUpdate"):
                            v_name = res.get("versionName", "未知")
                            v_desc = res.get("versionDesc", "暂无说明")
                            v_url = res.get("versionUrl", base_url)
                            v_force = res.get("isForce", False)
                            
                            # 获取 MainWindow 并发出信号，确保所有 UI 同步
                            parent_window = self.window()
                            if hasattr(parent_window, "update_signal"):
                                parent_window.update_signal.emit(v_name, v_desc, v_url, v_force)
                            elif hasattr(parent_window, "show_update_dialog"):
                                # 直接调用主窗口的弹窗方法
                                QTimer.singleShot(0, lambda: parent_window.show_update_dialog(v_name, v_desc, v_url, v_force))
                        else:
                            QTimer.singleShot(0, lambda: self.show_message("当前已是最新版本"))
                            QTimer.singleShot(0, lambda: self.update_panel.setVisible(False))
                            # 隐藏远程控制页面的横幅
                            parent_window = self.window()
                            if hasattr(parent_window, "page_remote"):
                                QTimer.singleShot(0, lambda: parent_window.page_remote.update_banner.hide())
                    else:
                        QTimer.singleShot(0, lambda: self.show_message(f"检查更新失败: {res.get('error', '未知错误')}"))
                else:
                    QTimer.singleShot(0, lambda: self.show_message("检查更新接口未就绪"))
            except Exception as e:
                print(f"[*] Manual check update error: {e}")
                QTimer.singleShot(0, lambda: self.show_message("检查更新出错"))
                
        threading.Thread(target=thread_worker, daemon=True).start()

class MainWindow(QMainWindow):
    update_signal = pyqtSignal(str, str, str, bool)
    download_signal = pyqtSignal(int, str) # progress, status_text
    def __init__(self, bridge):
        super().__init__()
        self.bridge = bridge
        self.initUI()
        
        self.setWindowTitle("RootDesk")
        self.setWindowIcon(qta.icon('fa5s.desktop', color=PRIMARY_COLOR))
        self.resize(1100, 780)
        
        # 启动后立即检查更新
        self.update_signal.connect(self.handle_update_signal)
        self.download_signal.connect(self.handle_download_signal)
        QTimer.singleShot(2000, self.check_update_auto)
        self.setStyleSheet(GLOBAL_STYLE)
        
        # Timer for polling
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.poll_data)
        self.timer.start(1000)
        
    def handle_download_signal(self, progress, status):
        if not hasattr(self, "download_dialog"):
            self.download_dialog = DownloadProgressDialog(self)
            self.download_dialog.show()
            
        if progress >= 100:
            self.download_dialog.set_progress(100, "下载完成！")
            QTimer.singleShot(1000, self.download_dialog.accept)
            if hasattr(self, "download_dialog"):
                delattr(self, "download_dialog")
        elif progress < 0:
            self.download_dialog.set_progress(0, f"下载失败: {status}")
            QTimer.singleShot(3000, self.download_dialog.reject)
            if hasattr(self, "download_dialog"):
                delattr(self, "download_dialog")
        else:
            self.download_dialog.set_progress(progress, status)

    def start_download_update(self, url):
        """开始下载更新"""
        if not hasattr(self, "download_dialog"):
            self.download_dialog = DownloadProgressDialog(self)
            self.download_dialog.show()
            
        def download_thread():
            try:
                import requests
                import tempfile
                import subprocess
                
                print(f"[*] Starting download from {url}")
                response = requests.get(url, stream=True, timeout=60)
                total_size = int(response.headers.get('content-length', 0))
                
                auth_dir = os.path.join(os.environ.get('APPDATA', os.getcwd()), "RootDesk")
                if not os.path.exists(auth_dir):
                    os.makedirs(auth_dir, exist_ok=True)
                
                temp_exe = os.path.join(auth_dir, "RootDesk_Setup.exe")
                
                downloaded_size = 0
                with open(temp_exe, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded_size += len(chunk)
                            if total_size > 0:
                                progress = int(downloaded_size * 100 / total_size)
                                self.download_signal.emit(progress, f"正在下载... {progress}%")
                
                self.download_signal.emit(100, "下载完成，正在启动安装程序...")
                
                # 自动打开下载的安装包
                os.startfile(temp_exe)
                
            except Exception as e:
                print(f"[*] Download error: {e}")
                self.download_signal.emit(-1, str(e))
                
        threading.Thread(target=download_thread, daemon=True).start()
        
    def initUI(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Sidebar
        sidebar = QFrame()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(240)
        side_layout = QVBoxLayout(sidebar)
        side_layout.setContentsMargins(12, 24, 12, 24)
        
        # Logo
        logo_layout = QHBoxLayout()
        logo_layout.setContentsMargins(12, 0, 12, 20)
        logo_icon = QLabel()
        logo_icon.setPixmap(qta.icon('fa5s.desktop', color='white').pixmap(QSize(20, 20)))
        logo_icon.setStyleSheet(f"color: white; background-color: {PRIMARY_COLOR}; border-radius: 8px; padding: 6px;")
        lbl_logo = QLabel("RootDesk")
        lbl_logo.setStyleSheet("font-size: 22px; font-weight: bold;")
        logo_layout.addWidget(logo_icon)
        logo_layout.addWidget(lbl_logo)
        logo_layout.addStretch()
        side_layout.addLayout(logo_layout)
        
        # Login mock
        login_widget = ClickableWidget()
        login_widget.setStyleSheet(f"background-color: transparent; border-radius: 12px;")
        login_widget.setMinimumHeight(60)
        login_layout = QHBoxLayout(login_widget)
        login_layout.setContentsMargins(12, 8, 12, 8)
        
        avatar = QLabel()
        avatar.setPixmap(qta.icon('fa5s.user', color=MUTED_COLOR).pixmap(QSize(20, 20)))
        avatar.setFixedSize(40, 40)
        avatar.setStyleSheet(f"background-color: {BORDER_COLOR}; border-radius: 20px; font-size: 20px;")
        avatar.setAlignment(Qt.AlignCenter)
        
        login_text_layout = QVBoxLayout()
        login_text_layout.setSpacing(2)
        lbl_login_title = QLabel("登录")
        lbl_login_title.setStyleSheet("font-weight: bold; font-size: 15px;")
        lbl_login_desc = QLabel("点击登录")
        lbl_login_desc.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
        login_text_layout.addWidget(lbl_login_title)
        login_text_layout.addWidget(lbl_login_desc)
        
        login_layout.addWidget(avatar)
        login_layout.addLayout(login_text_layout)
        login_layout.addStretch()
        side_layout.addWidget(login_widget)
        
        side_layout.addSpacing(16)
        
        # Nav buttons
        self.btn_remote = QPushButton(" 远程控制")
        self.btn_remote.setIcon(qta.icon('fa5s.laptop', color=MUTED_COLOR))
        self.btn_remote.setObjectName("sidebarBtn")
        self.btn_remote.setCheckable(True)
        self.btn_remote.setChecked(True)
        
        self.btn_devices = QPushButton(" 设备列表")
        self.btn_devices.setIcon(qta.icon('fa5s.mobile-alt', color=MUTED_COLOR))
        self.btn_devices.setObjectName("sidebarBtn")
        self.btn_devices.setCheckable(True)
        
        self.btn_settings = QPushButton(" 设置")
        self.btn_settings.setIcon(qta.icon('fa5s.cog', color=MUTED_COLOR))
        self.btn_settings.setObjectName("sidebarBtn")
        self.btn_settings.setCheckable(True)
        
        self.btn_about = QPushButton(" 关于")
        self.btn_about.setIcon(qta.icon('fa5s.info-circle', color=MUTED_COLOR))
        self.btn_about.setObjectName("sidebarBtn")
        self.btn_about.setCheckable(True)
        
        for btn in [self.btn_remote, self.btn_devices, self.btn_settings, self.btn_about]:
            side_layout.addWidget(btn)
            btn.clicked.connect(self.switch_tab)
            
        side_layout.addStretch()
        
        # Bottom links
        btn_contact = QPushButton(" 交流群")
        btn_contact.setIcon(qta.icon('fa5s.comments', color=MUTED_COLOR))
        btn_contact.setObjectName("iconBtn")
        btn_contact.setStyleSheet("text-align: left; padding: 10px; margin: 0 12px;")
        
        def open_contact():
            base_domain = "rootdesk.cn"
            if hasattr(self.bridge, "get_app_url"):
                res = self.bridge.get_app_url()
                if res and res.get("url"):
                    from urllib.parse import urlparse
                    parsed = urlparse(res.get("url"))
                    if parsed.netloc and "rootdesk.cn" not in parsed.netloc:
                        base_domain = parsed.netloc
            QDesktopServices.openUrl(QUrl(f"https://contact.{base_domain}"))
            
        btn_contact.clicked.connect(open_contact)
        
        btn_gitee = QPushButton(" 开源地址")
        btn_gitee.setIcon(qta.icon('fa5s.globe', color=MUTED_COLOR))
        btn_gitee.setObjectName("iconBtn")
        btn_gitee.setStyleSheet("text-align: left; padding: 10px; margin: 0 12px;")
        btn_gitee.clicked.connect(lambda: QDesktopServices.openUrl(QUrl("https://gitee.com/yesmyyyd/rootdesk")))
        
        side_layout.addWidget(btn_contact)
        side_layout.addWidget(btn_gitee)
        
        # Status
        status_layout = QHBoxLayout()
        status_layout.setContentsMargins(20, 10, 20, 0)
        self.lbl_status_dot = QLabel()
        self.lbl_status_dot.setPixmap(qta.icon('fa5s.circle', color=DANGER_COLOR).pixmap(QSize(8, 8)))
        self.lbl_status = QLabel("主机: 未连接")
        self.lbl_status.setStyleSheet(f"color: {MUTED_COLOR}; font-size: 12px;")
        status_layout.addWidget(self.lbl_status_dot)
        status_layout.addWidget(self.lbl_status)
        status_layout.addStretch()
        side_layout.addLayout(status_layout)
        
        main_layout.addWidget(sidebar)
        
        # Content
        self.stack = QStackedWidget()
        
        self.page_remote = RemoteWidget(self.bridge)
        self.page_devices = DevicesWidget(self.bridge)
        self.page_settings = SettingsWidget(self.bridge)
        self.page_about = AboutWidget(self.bridge)
        
        self.stack.addWidget(self.page_remote)
        self.stack.addWidget(self.page_devices)
        self.stack.addWidget(self.page_settings)
        self.stack.addWidget(self.page_about)
        
        main_layout.addWidget(self.stack)
        
    def switch_tab(self):
        sender = self.sender()
        if not sender: return
        
        for btn in [self.btn_remote, self.btn_devices, self.btn_settings, self.btn_about]:
            btn.setChecked(btn == sender)
            
        if sender == self.btn_remote:
            self.stack.setCurrentWidget(self.page_remote)
        elif sender == self.btn_devices:
            self.stack.setCurrentWidget(self.page_devices)
        elif sender == self.btn_settings:
            self.stack.setCurrentWidget(self.page_settings)
        elif sender == self.btn_about:
            self.stack.setCurrentWidget(self.page_about)
            
    def poll_data(self):
        try:
            if hasattr(self.bridge, 'get_init_data'):
                data = self.bridge.get_init_data()
                self.page_remote.update_data(data)
                
                # Status
                if data.get("serverConnected"):
                    self.lbl_status.setText("主机: 已连接")
                    self.lbl_status_dot.setPixmap(qta.icon('fa5s.circle', color=SUCCESS_COLOR).pixmap(QSize(8, 8)))
                else:
                    self.lbl_status.setText("主机: 未连接")
                    self.lbl_status_dot.setPixmap(qta.icon('fa5s.circle', color=DANGER_COLOR).pixmap(QSize(8, 8)))
                    
            # History
            if hasattr(self.bridge, 'get_connection_history'):
                hist_res = self.bridge.get_connection_history(1, 10)
                if hist_res and hist_res.get("success"):
                    self.page_remote.update_history(hist_res.get("history", []))
                
        except Exception as e:
            pass

    def closeEvent(self, event):
        # 默认情况下隐藏到托盘，而不是退出
        # 注意：这里的逻辑需要 client.py 中的 TRAY_ICON 支持
        event.ignore()
        self.hide()
        
    def handle_update_signal(self, name, desc, url, force):
        print(f"[*] handle_update_signal triggered: {name}")
        # 同步更新关于页面的面板
        if hasattr(self, "page_about"):
            self.page_about.show_update_info(name, desc, url)
        
        # 同步更新远程页面的横幅
        if hasattr(self, "page_remote"):
            self.page_remote.show_update_info(name, desc, url)
        
        # 弹窗
        self.show_update_dialog(name, desc, url, force)

    def check_update_auto(self):
        """自动检查更新"""
        print("[*] Starting auto update check...")
        
        # 尝试获取 APP_URL 作为默认 URL
        base_url = "https://rootdesk.cn"
        if hasattr(self.bridge, "get_app_url"):
            res_url = self.bridge.get_app_url()
            if res_url and res_url.get("url"):
                base_url = res_url.get("url")

        def thread_worker():
            try:
                if hasattr(self.bridge, "check_for_updates"):
                    print("[*] Calling bridge.check_for_updates()...")
                    res = self.bridge.check_for_updates()
                    print(f"[*] Update check result: {res}")
                    if res and res.get("success") and res.get("hasUpdate"):
                        v_name = res.get("versionName", "未知")
                        v_desc = res.get("versionDesc", "暂无说明")
                        v_url = res.get("versionUrl", base_url)
                        v_force = res.get("isForce", False)
                        
                        print(f"[*] New version found: {v_name}, emitting update_signal...")
                        self.update_signal.emit(v_name, v_desc, v_url, v_force)
                    else:
                        print("[*] No update needed or check failed.")
                else:
                    print("[!] Bridge does not have check_for_updates method.")
            except Exception as e:
                print(f"[*] Auto check update error: {e}")
                import traceback
                traceback.print_exc()
                
        threading.Thread(target=thread_worker, daemon=True).start()
        
    def show_update_dialog(self, name, desc, url, force):
        print(f"[*] Opening UpdateDialog: {name}")
        dialog = UpdateDialog(name, desc, url, force, self)
        print("[*] Dialog created, calling exec_()...")
        res = dialog.exec_()
        print(f"[*] Dialog closed with result: {res}")

    @pyqtSlot()
    def show_window(self):
        self.show()
        self.raise_()
        self.activateWindow()

def start_ui(bridge):
    app = QApplication(sys.argv)
    
    # Set default modern font globally
    font = QFont("Microsoft YaHei", 10)
    font.setStyleStrategy(QFont.PreferAntialias)
    app.setFont(font)
    
    window = MainWindow(bridge)
    window.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    # For testing without backend
    class DummyBridge:
        def get_init_data(self):
            return {"deviceId": "123 456 789", "devicePassword": "TEST", "serverConnected": True}
        def get_connection_history(self, page, size):
            return {"success": True, "history": []}
        def refresh_password(self):
            return {"success": True, "newPassword": "NEW"}
        def open_web_console(self):
            print("Open Web Console")
    start_ui(DummyBridge())
