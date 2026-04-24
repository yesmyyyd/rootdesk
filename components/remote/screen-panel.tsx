"use client"

import { DeviceInfo } from "./device-list"
import { StreamView } from "./stream-view"

interface ScreenPanelProps {
  device: DeviceInfo
  onBack?: () => void
}

export function ScreenPanel({ device, onBack }: ScreenPanelProps) {
  return <StreamView device={device} mode="screen" onBack={onBack} />
}
