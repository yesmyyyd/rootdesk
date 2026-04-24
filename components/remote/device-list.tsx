"use client"

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import {
  RotateCcw,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  Monitor,
  Laptop,
  Server,
  Smartphone,
  ChevronRight,
  Globe,
  Clock,
  Wifi,
  Cpu,
  MemoryStick,
  HardDrive,
  MoreHorizontal,
  Shield,
  Power,
  Plus,
  Key,
  Trash2,
  Lock,
  Download
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useWebSocket } from "@/components/websocket-provider"
import { useNotification } from "@/components/ui/custom-notification"
import { ClientOnly } from "@/components/ui/client-only"

export interface DeviceInfo {
  id: string
  name: string
  password?: string
  os: string
  arch?: string
  resolution?: string
  osIcon: "windows" | "linux" | "mac" | "android"
  type: "desktop" | "laptop" | "server" | "mobile"
  cpu: string
  cpuUsage: number
  ram: string
  ramUsage: number
  disk: string
  diskUsage: number
  ip: string
  publicIp?: string
  location?: string
  isp?: string
  status: "online" | "offline" | "idle"
  lastSeen: string
  latency: number
  tags: string[]
  platform: string
  viewerCount?: number
  remark?: string
  customTag?: string
}

function getDeviceIcon(type: DeviceInfo["type"]) {
  switch (type) {
    case "desktop": return Monitor
    case "laptop": return Laptop
    case "server": return Server
    case "mobile": return Smartphone
    default: return Monitor
  }
}

function getStatusConfig(status: DeviceInfo["status"]) {
  switch (status) {
    case "online": return { label: "在线", dotClass: "bg-success", badgeClass: "bg-success/15 text-success border-success/20" }
    case "idle": return { label: "空闲", dotClass: "bg-warning", badgeClass: "bg-warning/15 text-warning border-warning/20" }
    case "offline": return { label: "离线", dotClass: "bg-muted-foreground/40", badgeClass: "bg-muted text-muted-foreground border-border" }
    default: return { label: "未知", dotClass: "bg-muted", badgeClass: "bg-muted" }
  }
}

function UsageBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1 rounded-full bg-secondary w-full", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          value > 85 ? "bg-destructive" : value > 60 ? "bg-warning" : "bg-success"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

interface DeviceListProps {
  onSelectDevice: (device: DeviceInfo) => void
  onTabChange?: (tab: any) => void
}

export function DeviceList({ onSelectDevice, onTabChange }: DeviceListProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary animate-spin rounded-full" /></div>}>
      <DeviceListContent onSelectDevice={onSelectDevice} onTabChange={onTabChange} />
    </Suspense>
  )
}

function DeviceListContent({ onSelectDevice, onTabChange }: DeviceListProps) {
  const { devices, sendCommand, sendMessage, lastMessage, authenticateDevice, isConnected, lastAssistedDeviceId, setLastAssistedDeviceId } = useWebSocket()
  const { notify } = useNotification()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "idle" | "offline">("all")
  const [sortBy, setSortBy] = useState<"name" | "status" | "cpu" | "latency">("status")
  
  const [downloadUrl, setDownloadUrl] = useState("https://pan.baidu.com/s/1hlCG-AqXjaWuNtpLkdArFA?pwd=mem9")

  // Fetch downloadUrl from ad.json
  useEffect(() => {
    const fetchAdConfig = async () => {
      try {
        const response = await fetch("/ad.json")
        if (response.ok) {
          const data = await response.json()
          if (data.downloadUrl) {
            setDownloadUrl(data.downloadUrl)
          }
        }
      } catch (error) {
        console.error("Failed to fetch ad config:", error)
      }
    }
    fetchAdConfig()
    // Refresh every 3 minutes
    const interval = setInterval(fetchAdConfig, 180000)
    return () => clearInterval(interval)
  }, [])
  
  // ToDesk-like state
  const [savedDevices, setSavedDevices] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("rootdesk_devices_cache") || localStorage.getItem("rootdesk_saved_devices")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error("Failed to parse saved devices from localStorage", e)
        }
      }
    }
    return []
  })
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editPasswordDialogOpen, setEditPasswordDialogOpen] = useState(false)
  const [editDeviceId, setEditDeviceId] = useState("")
  const [newDeviceId, setNewDeviceId] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showDownloadGuide, setShowDownloadGuide] = useState(false)

  // Custom tags state
  const [customTags, setCustomTags] = useState<Record<string, { text: string; color: string }>>({})
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagTargetDeviceId, setTagTargetDeviceId] = useState("")
  const [editingTag, setEditingTag] = useState({ text: "", color: "blue" })

  // Preset tag colors
  const TAG_COLORS = [
    { name: "蓝色", value: "blue", bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
    { name: "绿色", value: "green", bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
    { name: "紫色", value: "purple", bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/20" },
    { name: "黄色", value: "yellow", bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20" },
    { name: "红色", value: "red", bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/20" },
    { name: "青色", value: "cyan", bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/20" },
  ]

  // Format device ID to XXX XXX XXX format
  const formatDeviceId = (id: string) => {
    const clean = id.replace(/[\s-]/g, '').toUpperCase();
    if (clean.length === 9) {
      return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    return id;
  };

  // Load saved devices and tags
  useEffect(() => {
    const loadSaved = () => {
      const saved = localStorage.getItem("rootdesk_devices_cache") || localStorage.getItem("rootdesk_saved_devices")
      if (saved) {
        try {
          setSavedDevices(JSON.parse(saved))
        } catch (e) {
          console.error("Failed to parse saved devices", e)
        }
      }
    };
    
    loadSaved();
    
    const savedTags = localStorage.getItem("rootdesk_custom_tags")
    if (savedTags) {
      try {
        setCustomTags(JSON.parse(savedTags))
      } catch (e) {
        console.error("Failed to parse saved tags", e)
      }
    }
    // 数据加载完成（即使是空的）
    setIsLoading(false)

    // Listen for custom device added event
    const handleDeviceAdded = (e: any) => {
      const newDevice = e.detail;
      console.log("Device added event received:", newDevice.id);
      setSavedDevices(prev => {
        if (prev.some(d => d.id === newDevice.id)) return prev;
        return [...prev, newDevice];
      });
    };
    
    window.addEventListener('rootdesk_device_added', handleDeviceAdded);
    window.addEventListener('storage', loadSaved);
    
    return () => {
      window.removeEventListener('rootdesk_device_added', handleDeviceAdded);
      window.removeEventListener('storage', loadSaved);
    };
  }, [])

  // Periodic status refresh
  useEffect(() => {
    const refreshStatus = () => {
      savedDevices.forEach(device => {
        sendMessage({
          type: 'refresh_device_status',
          deviceId: device.id,
          password: device.password,
          isSilent: true // 自动刷新，静默处理错误
        });
      });
    };

    // Initial refresh after savedDevices loaded
    if (savedDevices.length > 0) {
      refreshStatus();
    }

    // Set interval for every 10 seconds
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, [savedDevices, sendMessage]);

  // Save devices
  useEffect(() => {
    if (!isLoading) {
      const data = JSON.stringify(savedDevices)
      localStorage.setItem("rootdesk_devices_cache", data)
      localStorage.setItem("rootdesk_saved_devices", data)
      
      // Show download guide if no devices after initial load
      if (savedDevices.length === 0) {
        const timer = setTimeout(() => {
          setShowDownloadGuide(true)
        }, 800)
        return () => clearTimeout(timer)
      }
    }
  }, [savedDevices, isLoading])

  // Helper to merge device info safely without overwriting with "Unknown" or missing data
  const mergeDeviceInfo = (oldDevice: any, newData: any) => {
    const merged = { ...oldDevice };
    
    // List of metadata fields to sync safely
    const fields = ['os', 'arch', 'resolution', 'ip', 'publicIp', 'location', 'isp', 'platform', 'remark', 'hostname', 'cpu', 'ram', 'disk'];
    
    fields.forEach(field => {
      const newVal = newData[field];
      // Only update if the new value is meaningful and not "Unknown"
      if (newVal && newVal !== "Unknown" && newVal !== "N/A" && newVal !== "") {
        merged[field] = newVal;
      }
    });

    // Handle nested lastInfo if it exists (legacy support)
    if (newData.lastInfo) {
      fields.forEach(field => {
        const newVal = newData.lastInfo[field];
        if (newVal && newVal !== "Unknown" && newVal !== "N/A" && newVal !== "") {
          merged[field] = newVal;
        }
      });
    }
    
    return merged;
  };

  // Sync WebSocket devices to savedDevices cache
  useEffect(() => {
    if (devices.length === 0) return;
    
    setSavedDevices(prev => {
      let changed = false;
      const updated = prev.map(saved => {
        const online = devices.find(d => d.id === saved.id);
        if (online && online.status !== 'offline') {
          const merged = mergeDeviceInfo(saved, online);
          if (JSON.stringify(saved) !== JSON.stringify(merged)) {
            changed = true;
            return merged;
          }
        }
        return saved;
      });
      return changed ? updated : prev;
    });
  }, [devices]);

  const [verifyingDeviceId, setVerifyingDeviceId] = useState<string | null>(null)
  const autoStartDeviceIdRef = useRef<string | null>(null)
  const lastHandledMessageRef = useRef<any>(null)

  const showAutoStartPrompt = useCallback((device: DeviceInfo) => {
    notify({
      type: 'success',
      title: '设备就绪',
      message: `设备(${device.id}) 已准备就绪\n是否立即进入监控界面？`,
      isModal: true,
      confirmText: '立即进入',
      cancelText: '稍后再说',
      onConfirm: () => {
        onSelectDevice(device);
      }
    });
  }, [notify, onSelectDevice]);

  const mappedDevices: DeviceInfo[] = useMemo(() => {
    return savedDevices.map(saved => {
      const online = devices.find(d => d.id === saved.id);
      
      // Use cached data as base
      const d = { ...saved };
      
      // Real-time status and usage data
      const status = online?.status || "offline";
      const os = d.os || "Unknown";
      const platform = d.platform || "pc";

      return {
        id: d.id,
        name: d.name || formatDeviceId(d.id),
        password: d.password,
        os: os,
        arch: d.arch,
        resolution: d.resolution,
        osIcon: os.toLowerCase().includes('win') ? 'windows' : 
                os.toLowerCase().includes('mac') ? 'mac' : 
                os.toLowerCase().includes('android') ? 'android' : 'linux',
        type: platform === 'mobile' ? 'mobile' : 'desktop',
        cpu: d.cpu || "Unknown",
        cpuUsage: online?.cpuUsage || 0,
        ram: d.ram || "Unknown",
        ramUsage: online?.ramUsage || 0,
        disk: d.disk || "Unknown",
        diskUsage: online?.diskUsage || 0,
        ip: d.ip || "Unknown",
        publicIp: d.publicIp,
        location: d.location || "Unknown",
        isp: d.isp,
        status: status as any,
        lastSeen: online?.lastSeen ? new Date(online.lastSeen).toLocaleTimeString() : "Unknown",
        latency: 0,
        tags: (() => {
          const t = [platform];
          if (d.publicIp && d.publicIp !== "N/A" && d.publicIp !== "Unknown") t.push(d.publicIp);
          if (d.isp && d.isp !== "N/A" && d.isp !== "Unknown") t.push(d.isp);
          return t;
        })(),
        platform: platform,
        viewerCount: online?.viewerCount,
        remark: d.remark,
        customTag: customTags[d.id]?.text
      };
    });
  }, [savedDevices, devices, formatDeviceId, customTags])

  // Handle auto-redirect for assisted devices
  useEffect(() => {
    if (lastAssistedDeviceId) {
      const device = mappedDevices.find(d => d.id === lastAssistedDeviceId);
      if (device && device.status === 'online') {
        console.log("Auto-redirecting to assisted device:", lastAssistedDeviceId);
        onSelectDevice(device);
        setLastAssistedDeviceId(null);
      }
    }
  }, [lastAssistedDeviceId, mappedDevices, onSelectDevice, setLastAssistedDeviceId]);

  // Handle auto-start for URL parameters
  useEffect(() => {
    if (autoStartDeviceIdRef.current) {
      const device = mappedDevices.find(d => d.id === autoStartDeviceIdRef.current);
      if (device && device.status === 'online') {
        console.log("Auto-starting device from URL parameter:", autoStartDeviceIdRef.current);
        showAutoStartPrompt(device);
        autoStartDeviceIdRef.current = null;
      }
    }
  }, [mappedDevices, showAutoStartPrompt]);

  // Handle URL parameters for quick device adding
  useEffect(() => {
    if (isLoading || !isConnected) return;

    const deviceId = searchParams.get('deviceId');
    const password = searchParams.get('password');
    const autostart = searchParams.get('autostart') === 'true';

    if (deviceId && password) {
      const cleanId = deviceId.replace(/\s/g, '');
      const exists = savedDevices.some(d => d.id === cleanId);

      if (autostart) {
        autoStartDeviceIdRef.current = cleanId;
      }

      if (!exists) {
        console.log("Quick adding device from URL:", cleanId);
        setIsVerifying(true);
        setNewDeviceId(deviceId); // For state tracking in auth handlers
        setNewPassword(password);
        authenticateDevice(cleanId, password);
      } else {
        // If it exists and autostart is true, trigger prompt if online
        if (autostart) {
            const device = mappedDevices.find(d => d.id === cleanId);
            if (device && device.status !== 'offline') {
                showAutoStartPrompt(device);
                autoStartDeviceIdRef.current = null;
            }
        }
      }
      
      // Clean up URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('deviceId');
      url.searchParams.delete('password');
      url.searchParams.delete('autostart');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, isLoading, isConnected, savedDevices, authenticateDevice, mappedDevices, showAutoStartPrompt]);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage || lastMessage === lastHandledMessageRef.current) return
    lastHandledMessageRef.current = lastMessage
    
    console.log("lastMessage received in DeviceList:", lastMessage);
    
    if (lastMessage.type === 'session_invalidated') {
        // Handled globally in WebSocketProvider
    }

    if (lastMessage.type === 'error') {
      console.log("Error message received (state update only):", lastMessage);
      const cleanId = lastMessage.deviceId;
      if (cleanId === newDeviceId.replace(/\s/g, '')) setIsVerifying(false)
      if (cleanId === verifyingDeviceId) setVerifyingDeviceId(null)
      if (cleanId === autoStartDeviceIdRef.current) autoStartDeviceIdRef.current = null
    }

    if (lastMessage.type === 'device_auth_success') {
      console.log("device_auth_success received:", lastMessage);
      const deviceId = lastMessage.device.id;
      const deviceInfo = lastMessage.device;
      
      // 更新或添加设备到已保存列表
      setSavedDevices(prev => {
        const existingIndex = prev.findIndex(d => d.id === deviceId);
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          // Use merge logic to protect existing good data
          const merged = mergeDeviceInfo(updated[existingIndex], deviceInfo);
          
          // Only update password if we were explicitly verifying/adding
          if (isVerifying && deviceId === newDeviceId.replace(/\s/g, '')) {
            merged.password = newPassword;
          }
          updated[existingIndex] = merged;
          return updated;
        } else if (isVerifying && deviceId === newDeviceId.replace(/\s/g, '')) {
          // Add new device if explicitly adding
          return [...prev, {
            id: deviceId,
            password: newPassword,
            name: "", // Default to empty so it uses ID as fallback
            ...deviceInfo
          }];
        }
        return prev;
      });

      if (isVerifying && deviceId === newDeviceId.replace(/\s/g, '')) {
        setIsVerifying(false);
        setNewDeviceId("");
        setNewPassword("");
        setAddDialogOpen(false);
        notify({ title: "操作成功", message: "设备已添加", type: "success" });
      }

      // Handle auto-start prompt
      if (autoStartDeviceIdRef.current === deviceId) {
        const device = mappedDevices.find(d => d.id === deviceId);
        if (device && device.status !== 'offline') {
          showAutoStartPrompt(device);
          autoStartDeviceIdRef.current = null;
        }
      }
      
      if (deviceId === verifyingDeviceId) {
        setVerifyingDeviceId(null);
        const device = mappedDevices.find(d => d.id === deviceId);
        if (device) onSelectDevice(device);
      }
    } else if (lastMessage.type === 'device_auth_error') {
      console.log("device_auth_error received:", lastMessage);
      // 只有在手动操作（isVerifying 或 verifyingDeviceId）时才弹出错误
      if (isVerifying || verifyingDeviceId || autoStartDeviceIdRef.current === lastMessage.deviceId) {
        notify({
          type: 'error',
          title: '认证失败',
          message: lastMessage.message || "设备代码或密码错误",
          isModal: true
        });
      }
      
      if (isVerifying) setIsVerifying(false);
      if (autoStartDeviceIdRef.current === lastMessage.deviceId) autoStartDeviceIdRef.current = null;
      
      if (verifyingDeviceId) {
        setVerifyingDeviceId(null);
        // 如果是连接时失败，提示重新输入密码
        setNewDeviceId(verifyingDeviceId);
        setNewPassword("");
        setAddDialogOpen(true);
      }
    }
  }, [lastMessage, savedDevices, newDeviceId, newPassword, isVerifying, verifyingDeviceId, notify, setSavedDevices, setAddDialogOpen, setNewDeviceId, setNewPassword, setVerifyingDeviceId, setIsVerifying, mappedDevices, onSelectDevice])

  const handleEditPassword = (device: DeviceInfo) => {
    setEditDeviceId(device.id)
    setNewPassword("")
    setEditPasswordDialogOpen(true)
  }

  const confirmEditPassword = () => {
    if (!newPassword.trim()) {
      notify({
        title: "错误",
        message: "密码不能为空",
        type: "error"
      })
      return
    }

    const updatedDevices = savedDevices.map(d => 
      d.id === editDeviceId ? { ...d, password: newPassword } : d
    )
    setSavedDevices(updatedDevices)
    localStorage.setItem("rootdesk_devices_cache", JSON.stringify(updatedDevices))
    
    // 发送刷新状态请求以验证新密码并更新在线状态
    sendMessage({
      type: 'refresh_device_status',
      deviceId: editDeviceId,
      password: newPassword
    })
    
    setEditPasswordDialogOpen(false)
    setNewPassword("")
    notify({
      title: "成功",
      message: "设备密码已更新，正在验证状态...",
      type: "success"
    })
  }

  const handleAddDevice = () => {
    const cleanDeviceId = newDeviceId.replace(/\s/g, '')
    if (!cleanDeviceId || !newPassword) {
      notify({
        title: "输入错误",
        message: "请输入设备代码和密码",
        type: "error"
      })
      return
    }

    setIsVerifying(true)
    authenticateDevice(cleanDeviceId, newPassword)
  }

  const handleConnect = (device: DeviceInfo) => {
    setVerifyingDeviceId(device.id)
    authenticateDevice(device.id, device.password || '')
  }

  const removeDevice = (id: string) => {
    setSavedDevices(prev => prev.filter(d => d.id !== id))
    notify({
      title: "操作成功",
      message: "设备已移除",
      type: "success"
    })
  }

  const filteredDevices = mappedDevices
    .filter(d => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        (d.name || "").toLowerCase().includes(q) ||
        (d.os || "").toLowerCase().includes(q) ||
        (d.ip || "").includes(q) ||
        (d.location || "").toLowerCase().includes(q) ||
        (d.tags || []).some(t => (t || "").toLowerCase().includes(q))
      )
    })
    .sort((a, b) => {
      if (sortBy === "status") {
        const order = { online: 0, idle: 1, offline: 2 }
        return (order[a.status] || 0) - (order[b.status] || 0)
      }
      if (sortBy === "cpu") return b.cpuUsage - a.cpuUsage
      if (sortBy === "latency") return a.latency - b.latency
      return a.name.localeCompare(b.name)
    })

  const onlineCount = mappedDevices.filter(d => d.status === "online").length
  const idleCount = mappedDevices.filter(d => d.status === "idle").length
  const offlineCount = mappedDevices.filter(d => d.status === "offline").length

  const handleManualRefresh = () => {
    savedDevices.forEach(device => {
      sendMessage({
        type: 'refresh_device_status',
        deviceId: device.id,
        password: device.password
      });
    });
    notify({
      title: "正在刷新",
      message: "正在请求更新所有设备状态",
      type: "success"
    });
  };

  const handleSetCustomTag = (deviceId: string) => {
    setTagTargetDeviceId(deviceId)
    const existing = customTags[deviceId]
    setEditingTag(existing || { text: "", color: "blue" })
    setTagDialogOpen(true)
  }

  const saveCustomTag = () => {
    const updatedTags = { ...customTags }
    if (editingTag.text.trim()) {
      updatedTags[tagTargetDeviceId] = {
        text: editingTag.text.trim(),
        color: editingTag.color
      }
    } else {
      delete updatedTags[tagTargetDeviceId]
    }
    
    setCustomTags(updatedTags)
    localStorage.setItem("rootdesk_custom_tags", JSON.stringify(updatedTags))
    setTagDialogOpen(false)
    notify({
      title: "设置成功",
      message: "设备标签已更新",
      type: "success"
    })
  }

  const handleDeviceClick = (device: DeviceInfo) => {
    if (device.status === "offline") {
      notify({
        title: "无法连接",
        message: "设备当前处于离线状态，无法进行远程控制",
        type: "error"
      })
      return
    }
    onSelectDevice(device)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-foreground">设备列表</h2>
          <div className="hidden sm:flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] h-5 bg-success/10 text-success border-success/20">{onlineCount} 在线</Badge>
            <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground border-border">{offlineCount} 离线</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] gap-1 px-2 border-primary bg-primary/5 text-primary hover:bg-primary/10 shadow-sm animate-pulse-subtle"
            onClick={() => window.open(downloadUrl, "_blank")} // 使用从 ad.json 获取的下载链接
          >
            <Download className="h-3 w-3" />
            下载客户端
          </Button>
          <ClientOnly>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10">
                  <Plus className="h-3 w-3" />
                  添加设备
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
                <DialogHeader>
                  <DialogTitle>添加远程设备</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    输入远程设备的 9 位数字代码和临时密码进行连接。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="deviceId" className="text-right text-xs">设备代码</label>
                    <Input
                      id="deviceId"
                      placeholder="XXX XXX XXX"
                      className="col-span-3 h-9 bg-input border-border"
                      value={newDeviceId}
                      onChange={(e) => setNewDeviceId(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="password" className="text-right text-xs">临时密码</label>
                    <Input
                      id="password"
                      
                      placeholder="输入密码"
                      className="col-span-3 h-9 bg-input border-border"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="h-9 border-border">取消</Button>
                  <Button onClick={handleAddDevice} disabled={isVerifying} className="h-9 bg-primary text-primary-foreground">
                    {isVerifying ? "验证中..." : "添加并连接"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </ClientOnly>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleManualRefresh}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索设备名、IP、标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {/* Status filter chips */}
          <div className="flex items-center gap-1">
            {(["all", "online", "idle", "offline"] as const).map(s => (
              <button
                key={s}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                  statusFilter === s
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "全部" : s === "online" ? "在线" : s === "idle" ? "空闲" : "离线"}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1 px-2"
            onClick={() => setSortBy(sortBy === "status" ? "name" : sortBy === "name" ? "cpu" : sortBy === "cpu" ? "latency" : "status")}
          >
            <ArrowUpDown className="h-3 w-3" />
            <span className="hidden sm:inline">{sortBy === "status" ? "状态" : sortBy === "name" ? "名称" : sortBy === "cpu" ? "CPU" : "延迟"}</span>
          </Button>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <div className="hidden sm:flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", viewMode === "card" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setViewMode("card")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", viewMode === "list" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Device list / grid */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">正在加载设备列表...</p>
          </div>
        ) : filteredDevices.length > 0 ? (
          viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 p-4">
              {filteredDevices.map(device => {
                const DeviceIcon = getDeviceIcon(device.type)
                const statusCfg = getStatusConfig(device.status)
                return (
                  <div
                    key={device.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "group relative flex flex-col rounded-lg border bg-card p-4 text-left transition-all cursor-pointer",
                      device.status === "offline"
                        ? "border-border opacity-60 hover:opacity-80"
                        : "border-border hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-lg hover:shadow-primary/5"
                    )}
                    onClick={() => handleDeviceClick(device)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDeviceClick(device) } }}
                  >
                    {/* Top row: icon + name + status */}
                    <div className="flex items-start gap-3 pr-8">
                      <div className={cn(
                        "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                        device.status === "online" ? "bg-primary/10 text-primary"
                          : device.status === "idle" ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <DeviceIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-foreground truncate">{device.name}</p>
                          {device.name !== formatDeviceId(device.id) && (
                            <span className="text-[9px] font-mono text-muted-foreground opacity-60">({formatDeviceId(device.id)})</span>
                          )}
                          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="flex flex-col mt-0.5">
                          <p className="text-[10px] text-muted-foreground">
                            {device.os} {device.arch && <span className="text-[9px] opacity-70">({device.arch})</span>}
                          </p>
                          {device.resolution && (
                            <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">{device.resolution}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px] h-5 shrink-0", statusCfg.badgeClass)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full mr-1", statusCfg.dotClass)} />
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Absolute positioned menu */}
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-card border-border text-foreground">
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleConnect(device) }}>
                            <Shield className="h-3 w-3 mr-2" /> 控制
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            sendCommand(device.id, device.password || '', 'exec', 'shutdown /r /t 0');
                            notify({
                              title: "指令已发送",
                              message: "已发送重启指令",
                              type: "success"
                            });
                          }}>
                            <Power className="h-3 w-3 mr-2" /> 重启
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            sendCommand(device.id, device.password || '', 'exec', 'rundll32.exe user32.dll,LockWorkStation');
                            notify({
                              title: "指令已发送",
                              message: "已发送锁定指令",
                              type: "success"
                            });
                          }}>
                            <Lock className="h-3 w-3 mr-2" /> 锁定
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            handleSetCustomTag(device.id);
                          }}>
                            <Plus className="h-3 w-3 mr-2" /> 设置标签
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            handleEditPassword(device);
                          }}>
                            <Key className="h-3 w-3 mr-2" /> 更新密码
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem 
                            className="text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); removeDevice(device.id) }}
                          >
                            <Trash2 className="h-3 w-3 mr-2" /> 移除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                      {customTags[device.id] && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 shadow-sm",
                          TAG_COLORS.find(c => c.value === customTags[device.id].color)?.bg || "bg-blue-500/10",
                          TAG_COLORS.find(c => c.value === customTags[device.id].color)?.text || "text-blue-500",
                          TAG_COLORS.find(c => c.value === customTags[device.id].color)?.border || "border-blue-500/20"
                        )}>
                          {customTags[device.id].text}
                        </span>
                      )}
                      {device.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-secondary text-secondary-foreground font-medium border border-border/50">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Info row */}
                    <div className="flex flex-col gap-1.5 mt-3 text-[10px] text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-2.5 w-2.5" />
                          <span className="font-mono">{device.ip}</span>
                          {device.publicIp && device.publicIp !== "N/A" && (
                            <span className="opacity-50 text-[9px]">({device.publicIp})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{device.lastSeen}</span>
                        </div>
                      </div>
                      
                      {device.location && device.location !== "Unknown" && device.location !== "N/A" && (
                        <div className="flex items-center gap-1.5 opacity-80">
                          <Shield className="h-2.5 w-2.5" />
                          <span className="truncate">{device.location}</span>
                        </div>
                      )}
                      
                      {device.status !== "offline" && (
                        <div className="flex items-center gap-1.5">
                          <Wifi className="h-2.5 w-2.5" />
                          <span>延迟: {device.latency}ms</span>
                        </div>
                      )}
                    </div>

                    {/* Usage bars */}
                    {device.status !== "offline" && (
                      <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] text-muted-foreground w-7 shrink-0">CPU</span>
                          <UsageBar value={device.cpuUsage} className="flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">{device.cpuUsage}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MemoryStick className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] text-muted-foreground w-7 shrink-0">内存</span>
                          <UsageBar value={device.ramUsage} className="flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">{device.ramUsage}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] text-muted-foreground w-7 shrink-0">磁盘</span>
                          <UsageBar value={device.diskUsage} className="flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">{device.diskUsage}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* List view */
            <div className="p-2 flex flex-col gap-1">
              {/* List header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_80px_80px_60px_40px] items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border mx-1">
                <span>设备</span>
                <span>IP</span>
                <span>CPU / RAM</span>
                <span>延迟</span>
                <span>位置</span>
                <span>状态</span>
                <span />
              </div>
              {filteredDevices.map(device => {
                const DeviceIcon = getDeviceIcon(device.type)
                const statusCfg = getStatusConfig(device.status)
                return (
                  <div
                    key={device.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "group grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_80px_80px_60px_40px] items-center gap-2 md:gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-all cursor-pointer",
                      device.status === "offline"
                        ? "border-border opacity-60 hover:opacity-80"
                        : "border-border hover:border-primary/30 hover:bg-primary/[0.02]"
                    )}
                    onClick={() => handleDeviceClick(device)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDeviceClick(device) } }}
                  >
                    {/* Device name */}
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "shrink-0 w-8 h-8 rounded flex items-center justify-center",
                        device.status === "online" ? "bg-primary/10 text-primary"
                          : device.status === "idle" ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <DeviceIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-foreground truncate">{device.name}</p>
                          {device.name !== formatDeviceId(device.id) && (
                            <span className="text-[9px] font-mono text-muted-foreground opacity-60">({formatDeviceId(device.id)})</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          {customTags[device.id] && (
                            <span className={cn(
                              "px-1 py-0 rounded-[2px] text-[8px] font-bold border shrink-0",
                              TAG_COLORS.find(c => c.value === customTags[device.id].color)?.bg || "bg-blue-500/10",
                              TAG_COLORS.find(c => c.value === customTags[device.id].color)?.text || "text-blue-500",
                              TAG_COLORS.find(c => c.value === customTags[device.id].color)?.border || "border-blue-500/20"
                            )}>
                              {customTags[device.id].text}
                            </span>
                          )}
                          <span>{device.os}</span>
                          {device.arch && <span className="opacity-70">({device.arch})</span>}
                          {device.resolution && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30 shrink-0" />
                              <span className="text-[9px] font-mono opacity-60">{device.resolution}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {/* IP */}
                    <div className="hidden md:flex flex-col gap-0.5">
                      <span className="text-[11px] font-mono text-muted-foreground">{device.ip}</span>
                      {device.publicIp && device.publicIp !== "N/A" && (
                        <span className="text-[9px] text-muted-foreground/60">{device.publicIp}</span>
                      )}
                    </div>
                    {/* CPU / RAM */}
                    <div className="hidden md:flex flex-col gap-1">
                      {device.status !== "offline" ? (
                        <>
                          <UsageBar value={device.cpuUsage} />
                          <UsageBar value={device.ramUsage} />
                        </>
                      ) : (
                        <div className="h-4 flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground/30">--</span>
                        </div>
                      )}
                    </div>
                    {/* Latency */}
                    <span className="text-[11px] font-mono text-muted-foreground hidden md:block">
                      {device.status !== "offline" ? `${device.latency}ms` : "--"}
                    </span>
                    {/* Location */}
                    <span className="text-[11px] text-muted-foreground hidden md:block">{device.location}</span>
                    {/* Status */}
                    <Badge variant="outline" className={cn("text-[10px] h-5 justify-center hidden md:inline-flex", statusCfg.badgeClass)}>
                      {statusCfg.label}
                    </Badge>
                    {/* Arrow & Menu */}
                    <div className="hidden md:flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-card border-border text-foreground">
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleConnect(device) }}>
                            <Shield className="h-3 w-3 mr-2" /> 控制
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            sendCommand(device.id, device.password || '', 'exec', 'shutdown /r /t 0');
                            notify({
                              title: "指令已发送",
                              message: "已发送重启指令",
                              type: "success"
                            });
                          }}>
                            <Power className="h-3 w-3 mr-2" /> 重启
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            sendCommand(device.id, device.password || '', 'exec', 'rundll32.exe user32.dll,LockWorkStation');
                            notify({
                              title: "指令已发送",
                              message: "已发送锁定指令",
                              type: "success"
                            });
                          }}>
                            <Lock className="h-3 w-3 mr-2" /> 锁定
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            handleEditPassword(device);
                          }}>
                            <Key className="h-3 w-3 mr-2" /> 更新密码
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem 
                            className="text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); removeDevice(device.id) }}
                          >
                            <Trash2 className="h-3 w-3 mr-2" /> 移除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Mobile info row */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground md:hidden pr-8">
                      <span className="font-mono">{device.ip}</span>
                      <Badge variant="outline" className={cn("text-[10px] h-4", statusCfg.badgeClass)}>
                        {statusCfg.label}
                      </Badge>
                      {device.status !== "offline" && <span>{device.latency}ms</span>}
                    </div>

                    {/* Absolute positioned menu for list view */}
                    <div className="absolute top-1/2 -translate-y-1/2 right-3 md:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-full"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-card border-border text-foreground">
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleConnect(device) }}>
                            <Shield className="h-3 w-3 mr-2" /> 控制
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            sendCommand(device.id, device.password || '', 'exec', 'shutdown /r /t 0');
                            notify({
                              title: "指令已发送",
                              message: "已发送重启指令",
                              type: "success"
                            });
                          }}>
                            <Power className="h-3 w-3 mr-2" /> 重启
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            sendCommand(device.id, device.password || '', 'exec', 'rundll32.exe user32.dll,LockWorkStation');
                            notify({
                              title: "指令已发送",
                              message: "已发送锁定指令",
                              type: "success"
                            });
                          }}>
                            <Lock className="h-3 w-3 mr-2" /> 锁定
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => {
                            e.stopPropagation();
                            handleEditPassword(device);
                          }}>
                            <Key className="h-3 w-3 mr-2" /> 更新密码
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem 
                            className="text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); removeDevice(device.id) }}
                          >
                            <Trash2 className="h-3 w-3 mr-2" /> 移除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-xl bg-card/30 m-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Monitor className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">没有找到设备</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              您的设备列表为空，或者没有匹配当前搜索条件的设备。请添加一台新设备开始远程控制。
            </p>
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              添加设备
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Bottom stats */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card text-[10px] text-muted-foreground shrink-0">
        <span>共 {mappedDevices.length} 台设备 | 显示 {filteredDevices.length} 台</span>
        <span>上次刷新: 刚刚</span>
      </div>

      {/* Edit Password Dialog */}
      <ClientOnly>
        <Dialog open={editPasswordDialogOpen} onOpenChange={setEditPasswordDialogOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                更新设备密码
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">新密码</label>
                <Input
                  type="password"
                  placeholder="输入设备的新密码"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmEditPassword()
                    }
                  }}
                  className="bg-background border-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditPasswordDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={confirmEditPassword}>
                确认更新
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </ClientOnly>

      {/* Custom Tag Dialog */}
      <ClientOnly>
        <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                设置自定义标签
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                为该设备设置一个醒目的彩色标签，方便快速识别。
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-6 py-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">标签文字</label>
                <Input
                  placeholder="例如: 开发机, 数据库, 财务部"
                  value={editingTag.text}
                  onChange={(e) => setEditingTag({ ...editingTag, text: e.target.value })}
                  maxLength={10}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveCustomTag()
                    }
                  }}
                  className="bg-background border-input"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">选择颜色</label>
                <div className="grid grid-cols-6 gap-2">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setEditingTag({ ...editingTag, color: color.value })}
                      className={cn(
                        "h-8 w-full rounded-md border transition-all flex items-center justify-center",
                        color.bg,
                        color.border,
                        editingTag.color === color.value ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" : "hover:scale-105"
                      )}
                      title={color.name}
                    >
                      <div className={cn("h-3 w-3 rounded-full", color.text.replace("text-", "bg-"))} />
                    </button>
                  ))}
                </div>
              </div>
              {editingTag.text && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">预览</label>
                  <div className="flex">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold border shadow-sm",
                      TAG_COLORS.find(c => c.value === editingTag.color)?.bg,
                      TAG_COLORS.find(c => c.value === editingTag.color)?.text,
                      TAG_COLORS.find(c => c.value === editingTag.color)?.border
                    )}>
                      {editingTag.text}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between gap-2">
              <Button 
                variant="ghost" 
                className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                onClick={() => {
                  setEditingTag({ text: "", color: "blue" });
                  saveCustomTag();
                }}
              >
                清除标签
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={saveCustomTag}>
                  保存设置
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </ClientOnly>

      {/* Download Guide Dialog */}
      <ClientOnly>
        <Dialog open={showDownloadGuide} onOpenChange={setShowDownloadGuide}>
          <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground p-0 overflow-hidden">
            <div className="relative h-32 bg-primary/10 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-24 h-24 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary rounded-full translate-x-1/3 translate-y-1/3" />
              </div>
              <Download className="h-16 w-16 text-primary animate-bounce-slow" />
            </div>
            <div className="p-6 text-center">
              <DialogTitle className="text-2xl font-bold mb-2">欢迎使用 RootDesk</DialogTitle>
              <DialogDescription className="text-base text-muted-foreground mb-6">
                检测到您的设备列表为空。请先在需要被控制的电脑上下载并运行客户端。
              </DialogDescription>
              
              <div className="grid grid-cols-1 gap-4 mb-8">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-left border border-border">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-semibold">下载客户端</p>
                    <p className="text-xs text-muted-foreground">点击下方按钮下载绿色免安装版客户端</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-left border border-border">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <div>
                    <p className="text-sm font-semibold">运行并获取代码</p>
                    <p className="text-xs text-muted-foreground">在被控端运行程序，获取 9 位设备代码和密码</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-left border border-border">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <div>
                    <p className="text-sm font-semibold">添加设备</p>
                    <p className="text-xs text-muted-foreground">在控制端点击“添加设备”按钮，输入代码即可连接</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button 
                  size="lg" 
                  className="w-full text-base font-bold h-12 shadow-lg shadow-primary/20"
                  onClick={() => {
                    window.open(downloadUrl, "_blank")
                    setShowDownloadGuide(false)
                  }}
                >
                  <Download className="mr-2 h-5 w-5" />
                  立即下载客户端
                </Button>
                <Button 
                  variant="ghost" 
                  className="text-muted-foreground"
                  onClick={() => setShowDownloadGuide(false)}
                >
                  暂不下载，手动添加
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </ClientOnly>
    </div>
  )
}
