"use client"

import { useState } from "react"
import {
  Monitor,
  AppWindow,
  FolderOpen,
  Terminal,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Shield,
  Cpu,
  HardDrive,
  MemoryStick,
  Menu,
  X,
  LayoutGrid,
  ArrowLeft,
  Hammer,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { DeviceInfo } from "./device-list"
import { AdBanner } from "./ad-banner"

export type TabKey = "devices" | "builder" | "screen" | "windows" | "files" | "terminal" | "monitor"

interface SidebarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  selectedDevice: DeviceInfo | null
  onBackToDevices: () => void
  showBuilder?: boolean
}

const controlNavItems: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "screen", label: "屏幕控制", icon: Monitor },
  { key: "windows", label: "窗口管理", icon: AppWindow },
  { key: "files", label: "文件管理", icon: FolderOpen },
  { key: "terminal", label: "CMD 终端", icon: Terminal },
  { key: "monitor", label: "性能监控", icon: Activity },
]

export function Sidebar({ activeTab, onTabChange, selectedDevice, onBackToDevices, showBuilder = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isControlMode = selectedDevice !== null && activeTab !== "devices" && activeTab !== "builder"

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-2.5 left-3 z-50 lg:hidden text-foreground bg-card/80 backdrop-blur-sm border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-dvh flex flex-col border-r border-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-12 border-b border-border px-4 shrink-0", collapsed && "justify-center px-2")}>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-md bg-primary/15">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <span className="text-sm font-semibold text-foreground tracking-wide">RootDesk</span>
            )}
          </div>
        </div>

        {/* Global Nav Items */}
        <div className={cn("px-2 pt-2 pb-1 shrink-0 flex flex-col gap-1")}>
          {/* Device List */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { onBackToDevices(); setMobileOpen(false) }}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-colors",
                    activeTab === "devices"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-card text-card-foreground border-border">
                设备列表
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => { onBackToDevices(); setMobileOpen(false) }}
              className={cn(
                "flex items-center gap-3 w-full rounded-md px-3 h-9 text-sm transition-colors",
                activeTab === "devices"
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              <span>设备列表</span>
            </button>
          )}

          {/* Builder */}
          {showBuilder && (
            collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { onTabChange("builder"); setMobileOpen(false) }}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-colors",
                      activeTab === "builder"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Hammer className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-card text-card-foreground border-border">
                  客户端生成
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => { onTabChange("builder"); setMobileOpen(false) }}
                className={cn(
                  "flex items-center gap-3 w-full rounded-md px-3 h-9 text-sm transition-colors",
                  activeTab === "builder"
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Hammer className="h-4 w-4 shrink-0" />
                <span>客户端生成</span>
              </button>
            )
          )}
        </div>

        {/* Current device info + control nav (only when a device is selected) */}
        {selectedDevice && (
          <>
            {/* Divider & selected device */}
            <div className={cn("px-4 py-2 border-t border-border mt-1", collapsed && "px-2")}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        selectedDevice.status === "online" ? "bg-success animate-pulse-glow text-success" :
                        selectedDevice.status === "idle" ? "bg-warning" : "bg-muted-foreground/40"
                      )} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-card text-card-foreground border-border">
                    <p className="font-medium">{selectedDevice.name}</p>
                    <p className="text-muted-foreground text-[10px]">{selectedDevice.ip}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-2.5">
                  {selectedDevice.status === "online" ? (
                    <Wifi className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : selectedDevice.status === "idle" ? (
                    <Wifi className="h-3.5 w-3.5 text-warning shrink-0" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{selectedDevice.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedDevice.os} - {selectedDevice.ip}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Control nav items */}
            <nav className="flex-1 py-1 px-2 flex flex-col gap-0.5 overflow-y-auto">
              {!collapsed && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mb-1">控制面板</p>
              )}
              {controlNavItems.map((item) => {
                const isActive = activeTab === item.key
                const button = (
                  <button
                    key={item.key}
                    onClick={() => {
                      onTabChange(item.key)
                      setMobileOpen(false)
                    }}
                    className={cn(
                      "flex items-center w-full rounded-md text-sm transition-colors",
                      collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 h-9",
                      isActive
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={item.key}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" className="bg-card text-card-foreground border-border">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return button
              })}
            </nav>

            {/* Device info (expanded only) */}
            {!collapsed && isControlMode && (
              <div className="px-4 py-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">设备信息</p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Cpu className="h-3 w-3 shrink-0" />
                    <span className="truncate">{selectedDevice.cpu}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MemoryStick className="h-3 w-3 shrink-0" />
                    <span className="truncate">{selectedDevice.ram}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <HardDrive className="h-3 w-3 shrink-0" />
                    <span className="truncate">{selectedDevice.disk} ({selectedDevice.diskUsage}%)</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Spacer when no device selected */}
        {!selectedDevice && <div className="flex-1" />}

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex items-center justify-center border-t border-border h-10 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Ad Banner (replaces settings) */}
        {!collapsed && (
          <div className="mt-auto border-t border-border pt-4">
            <AdBanner />
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}
