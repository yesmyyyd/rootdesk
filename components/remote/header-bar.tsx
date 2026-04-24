"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff, Clock, Signal, BatteryMedium, ArrowLeft, LayoutGrid, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWebSocket } from "@/components/websocket-provider"
import type { DeviceInfo } from "./device-list"

interface HeaderBarProps {
  selectedDevice: DeviceInfo | null
  onBackToDevices: () => void
  isControlMode: boolean
  connectionType?: "ws" | "rtc"
}

export function HeaderBar({ selectedDevice, onBackToDevices, isControlMode, connectionType }: HeaderBarProps) {
  const { assistanceCode } = useWebSocket()
  
  return (
    <header className="h-10 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Spacer for mobile menu button */}
        <div className="w-8 lg:hidden" />

        {isControlMode && selectedDevice ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onBackToDevices}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <button onClick={onBackToDevices} className="hover:text-foreground transition-colors flex items-center gap-1">
                <LayoutGrid className="h-3 w-3" />
                <span>设备列表</span>
              </button>
              <span className="text-border">/</span>
              {selectedDevice.status === "online" ? (
                <Wifi className="h-3 w-3 text-success" />
              ) : selectedDevice.status === "idle" ? (
                <Wifi className="h-3 w-3 text-warning" />
              ) : (
                <WifiOff className="h-3 w-3 text-destructive" />
              )}
              <span className="text-foreground font-medium">{selectedDevice.name}</span>
              <span className="text-border">|</span>
              <span>{selectedDevice.ip}</span>
              {connectionType && (
                <span className={cn("text-[10px] px-1 rounded", connectionType === 'rtc' ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500")}>
                  {connectionType === 'rtc' ? 'P2P' : 'Relay'}
                </span>
              )}
            </div>
            {/* Mobile - shorter version */}
            <div className="flex sm:hidden items-center gap-1.5 text-xs">
              {selectedDevice.status === "online" ? (
                <Wifi className="h-3 w-3 text-success" />
              ) : (
                <WifiOff className="h-3 w-3 text-destructive" />
              )}
              <span className="text-foreground font-medium truncate max-w-[120px]">{selectedDevice.name}</span>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground font-medium">设备管理</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 shrink-0">
         <span className="text-[10px] font-bold text-primary uppercase tracking-wider">协助码</span>
          <span className="text-xs font-mono font-bold text-foreground tracking-widest">
            {assistanceCode ? (
              `${assistanceCode.slice(0, 3)} ${assistanceCode.slice(3, 6)} ${assistanceCode.slice(6)}`
            ) : '--- --- ---'}
          </span>
        </div>
        {isControlMode && selectedDevice && selectedDevice.status !== "offline" && (
          <div className="hidden sm:flex items-center gap-1.5">
            <Signal className="h-3 w-3" />
            <span>延迟 {selectedDevice.latency}ms</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <LiveClock />
        </div>
      </div>
    </header>
  )
}

function LiveClock() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return <span suppressHydrationWarning>{time}</span>
}
