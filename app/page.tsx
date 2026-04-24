"use client"

import { useState, useCallback, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Sidebar, type TabKey } from "@/components/remote/sidebar"
import { HeaderBar } from "@/components/remote/header-bar"
import { DeviceList, type DeviceInfo } from "@/components/remote/device-list"
import { ScreenPanel } from "@/components/remote/screen-panel"
import { WindowsPanel } from "@/components/remote/windows-panel"
import { FilesPanel } from "@/components/remote/files-panel"
import { TerminalPanel } from "@/components/remote/terminal-panel"
import { BuilderPanel } from "@/components/remote/builder-panel"
import { MonitorPanel } from "@/components/remote/monitor-panel"

function RemoteControlContent() {
  const searchParams = useSearchParams()
  const showBuilder = searchParams.get("client") === "true"
  
  const [activeTab, setActiveTab] = useState<TabKey>("devices")
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null)
  
  // Update browser tab title based on selected device
  useEffect(() => {
    if (selectedDevice) {
      const title = selectedDevice.customTag 
        ? `${selectedDevice.customTag} - 远程控制中心` 
        : `${selectedDevice.id} - 远程控制中心`;
      document.title = title;
    } else {
      document.title = "RootDesk - 远程控制中心";
    }
  }, [selectedDevice]);

  const handleSelectDevice = useCallback((device: DeviceInfo) => {
    setSelectedDevice(device)
    setActiveTab("screen") // default to screen control when selecting a device
  }, [])

  const handleBackToDevices = useCallback(() => {
    setSelectedDevice(null)
    setActiveTab("devices")
  }, [])

  const isControlMode = selectedDevice !== null && activeTab !== "devices" && activeTab !== "builder"

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedDevice={selectedDevice}
        onBackToDevices={handleBackToDevices}
        showBuilder={showBuilder}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60 transition-all duration-300">
        <HeaderBar
          selectedDevice={selectedDevice}
          onBackToDevices={handleBackToDevices}
          isControlMode={isControlMode}
        />

        <main className="flex-1 overflow-hidden">
          {/* Device list */}
          {activeTab === "devices" && (
            <div className="h-full w-full flex flex-col">
              <div className="flex-1 overflow-hidden">
                <DeviceList 
                  onSelectDevice={handleSelectDevice} 
                  onTabChange={setActiveTab}
                />
              </div>
            </div>
          )}

          {/* Builder Panel */}
          {activeTab === "builder" && showBuilder && (
            <div className="h-full w-full">
              <BuilderPanel />
            </div>
          )}

          {/* Control panels - only render when device selected */}
          {selectedDevice && (
            <>
              {activeTab === "screen" && (
                <div className="h-full w-full">
                  <ScreenPanel device={selectedDevice} onBack={handleBackToDevices} />
                </div>
              )}
              {activeTab === "windows" && (
                <div className="h-full w-full">
                  <WindowsPanel device={selectedDevice} onBack={handleBackToDevices} />
                </div>
              )}
              {activeTab === "files" && (
                <div className="h-full w-full">
                  <FilesPanel device={selectedDevice} onBack={handleBackToDevices} />
                </div>
              )}
              {activeTab === "terminal" && (
                <div className="h-full w-full">
                  <TerminalPanel device={selectedDevice} onBack={handleBackToDevices} />
                </div>
              )}
              {activeTab === "monitor" && (
                <div className="h-full w-full">
                  <MonitorPanel device={selectedDevice} onBack={handleBackToDevices} />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default function RemoteControlPage() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary animate-spin rounded-full" />
    </div>}>
      <RemoteControlContent />
    </Suspense>
  )
}
