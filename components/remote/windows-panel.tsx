"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  AppWindow,
  Maximize2,
  Minimize2,
  X,
  RotateCcw,
  Search,
  Eye,
  EyeOff,
  ArrowUpDown,
  Layers,
  Pin,
  PinOff,
  Monitor,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DeviceInfo } from "./device-list"
import { useWebSocket } from "@/components/websocket-provider"
import { useNotification } from "@/components/ui/custom-notification"
import { StreamView } from "./stream-view"

interface WindowInfo {
  id: number
  title: string
  process: string
  pid: number
  status: "active" | "minimized" | "hidden"
  memory: string
  pinned: boolean
}

interface WindowsPanelProps {
  device: DeviceInfo
  onBack?: () => void
}

export function WindowsPanel({ device, onBack }: WindowsPanelProps) {
  const { sendCommand, lastMessage } = useWebSocket()
  const { notify } = useNotification()
  const lastHandledMessageRef = useRef<any>(null)
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null)
  const [viewingWindow, setViewingWindow] = useState<WindowInfo | null>(null)
  const [sortBy, setSortBy] = useState<"title" | "memory" | "pid">("title")

  // Request windows on mount
  useEffect(() => {
    sendCommand(device.id, device.password || "", 'windows')
  }, [device.id, sendCommand])

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage || lastMessage === lastHandledMessageRef.current) return
    lastHandledMessageRef.current = lastMessage

    if (lastMessage.deviceId === device.id) {
      if (lastMessage.type === 'window_list' && Array.isArray(lastMessage.data)) {
        setWindows(lastMessage.data)
      } else if (lastMessage.type === 'error') {
        if (lastMessage.message === 'Invalid device password') {
          if (onBack) onBack();
        }
      }
    }
  }, [lastMessage, device.id, onBack, notify])

  const filteredWindows = windows
    .filter(w => w.title.toLowerCase().includes(searchQuery.toLowerCase()) || w.process.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title)
      if (sortBy === "pid") return a.pid - b.pid
      return parseInt(b.memory) - parseInt(a.memory)
    })

  const refreshWindows = () => {
    sendCommand(device.id, device.password || "", "windows")
  }

  const handleWindowAction = (id: number, action: string) => {
    sendCommand(device.id, device.password || "", "window_control", { id, action })
    // Optimistic update or wait for refresh
    if (action === 'close') setWindows(ws => ws.filter(w => w.id !== id))
  }

  if (viewingWindow) {
    return (
      <StreamView 
        device={device} 
        mode="window" 
        targetId={viewingWindow.id} 
        onBack={() => setViewingWindow(null)}
        title={viewingWindow.title}
        subTitle={`${viewingWindow.process} (PID: ${viewingWindow.pid})`}
      />
    )
  }

  const statusColors: Record<string, string> = {
    active: "bg-success/15 text-success border-success/20",
    minimized: "bg-warning/15 text-warning border-warning/20",
    hidden: "bg-muted text-muted-foreground border-border",
  }

  const statusLabels: Record<string, string> = {
    active: "活动",
    minimized: "最小化",
    hidden: "隐藏",
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-foreground">窗口管理</h2>
          <Badge variant="secondary" className="text-[10px] h-5 bg-secondary text-secondary-foreground">
            {windows.length} 个窗口
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={refreshWindows}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索窗口或进程..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
          onClick={() => setSortBy(sortBy === "title" ? "memory" : sortBy === "memory" ? "pid" : "title")}
        >
          <ArrowUpDown className="h-3 w-3" />
          <span className="hidden sm:inline">
            {sortBy === "title" ? "名称" : sortBy === "memory" ? "内存" : "PID"}
          </span>
        </Button>
      </div>

      {/* Window list */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-2 flex flex-col gap-1">
            {filteredWindows.map((win) => (
              <div
                key={win.id}
                className={cn(
                  "group flex flex-col rounded-md border bg-card p-3 transition-colors cursor-pointer",
                  selectedWindow === win.id ? "border-primary/40 bg-primary/5" : "border-border hover:border-border hover:bg-secondary/50"
                )}
                onClick={() => setSelectedWindow(win.id === selectedWindow ? null : win.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "shrink-0 w-8 h-8 rounded flex items-center justify-center mt-0.5",
                    win.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <AppWindow className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground truncate">{win.title}</p>
                      {win.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">{win.process}</span>
                      <span className="text-border">|</span>
                      <span className="text-[10px] font-mono text-muted-foreground">PID: {win.pid}</span>
                      <span className="text-border">|</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{win.memory}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] h-5 shrink-0", statusColors[win.status])}>
                    {statusLabels[win.status]}
                  </Badge>
                </div>

                {/* Action buttons on selection / hover */}
                <div className={cn(
                  "flex items-center gap-1 mt-2 pt-2 border-t border-border",
                  selectedWindow === win.id ? "flex" : "hidden group-hover:flex"
                )}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2"
                    onClick={(e) => { e.stopPropagation(); setViewingWindow(win) }}
                  >
                    <Monitor className="h-3 w-3" />
                    查看
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1 px-2"
                    onClick={(e) => { e.stopPropagation(); handleWindowAction(win.id, 'minimize') }}
                  >
                    {win.status === "minimized" ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
                    {win.status === "minimized" ? "恢复" : "最小化"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1 px-2"
                    onClick={(e) => { e.stopPropagation(); handleWindowAction(win.id, 'hide') }}
                  >
                    {win.status === "hidden" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {win.status === "hidden" ? "显示" : "隐藏"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1 px-2"
                    onClick={(e) => { e.stopPropagation(); handleWindowAction(win.id, 'pin') }}
                  >
                    {win.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    {win.pinned ? "取消置顶" : "置顶"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1 px-2"
                    onClick={(e) => { e.stopPropagation(); handleWindowAction(win.id, 'foreground') }}
                  >
                    <Layers className="h-3 w-3" />
                    前置
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
                    onClick={(e) => { e.stopPropagation(); handleWindowAction(win.id, 'close') }}
                  >
                    <X className="h-3 w-3" />
                    关闭
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card text-[10px] text-muted-foreground shrink-0">
        <span>活动: {windows.filter(w => w.status === "active").length} | 最小化: {windows.filter(w => w.status === "minimized").length} | 隐藏: {windows.filter(w => w.status === "hidden").length}</span>
        <span>总内存: {windows.reduce((sum, w) => sum + parseInt(w.memory || "0"), 0)} MB</span>
      </div>
    </div>
  )
}
