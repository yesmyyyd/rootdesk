"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { DeviceInfo } from "./device-list"
import { useWebSocket } from "@/components/websocket-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, Cpu, HardDrive, MemoryStick, Network, Battery, Monitor as MonitorIcon } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useNotification } from "@/components/ui/custom-notification"

interface MonitorPanelProps {
  device: DeviceInfo
  onBack?: () => void
}

export function MonitorPanel({ device, onBack }: MonitorPanelProps) {
  const { sendCommand, lastMessage } = useWebSocket()
  const { notify } = useNotification()
  const [hardwareInfo, setHardwareInfo] = useState<any>(null)
  const [performance, setPerformance] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const lastHandledMessageRef = useRef<any>(null)
  
  const prevPerformanceRef = useRef<any>(null)
  const prevTimeRef = useRef<number>(0)
  const [performanceSpeed, setPerformanceSpeed] = useState<any>({
    disk_read_speed: 0,
    disk_write_speed: 0,
    net_sent_speed: 0,
    net_recv_speed: 0,
  })

  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock active (Monitor)');
        
        wakeLock.addEventListener('release', () => {
          console.log('Wake Lock was released (Monitor)');
          wakeLock = null;
        });
      } catch (err: any) {
        console.error(`Wake Lock error (Monitor): ${err.name}, ${err.message}`);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (wakeLock === null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().then(() => {
          wakeLock = null;
          console.log('Wake Lock released (Monitor)');
        });
      }
    };
  }, []);

  useEffect(() => {
    // Request hardware info initially
    fetchHardwareInfo()
    
    // Start performance monitoring
    setIsMonitoring(true)
    
    return () => {
      setIsMonitoring(false)
    }
  }, [device.id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isMonitoring) {
      interval = setInterval(() => {
        sendCommand(device.id, device.password || "", "monitor", { action: "performance" })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isMonitoring, device.id, device.password, sendCommand])

  useEffect(() => {
    if (!lastMessage || lastMessage === lastHandledMessageRef.current) return
    lastHandledMessageRef.current = lastMessage

    try {
      const data = typeof lastMessage === 'string' ? JSON.parse(lastMessage) : lastMessage
      
      if (data.type === "hardware_info") {
        setHardwareInfo(data.data)
        setIsLoading(false)
      } else if (data.type === "performance_metrics") {
        const now = Date.now()
        if (prevPerformanceRef.current && prevTimeRef.current) {
          const timeDiff = (now - prevTimeRef.current) / 1000 // in seconds
          if (timeDiff > 0) {
            setPerformanceSpeed({
              disk_read_speed: Math.max(0, (data.data.disk_read - prevPerformanceRef.current.disk_read) / timeDiff),
              disk_write_speed: Math.max(0, (data.data.disk_write - prevPerformanceRef.current.disk_write) / timeDiff),
              net_sent_speed: Math.max(0, (data.data.net_sent - prevPerformanceRef.current.net_sent) / timeDiff),
              net_recv_speed: Math.max(0, (data.data.net_recv - prevPerformanceRef.current.net_recv) / timeDiff),
            })
          }
        }
        prevPerformanceRef.current = data.data
        prevTimeRef.current = now
        setPerformance(data.data)
      } else if (data.type === "error") {
        setIsMonitoring(false)
        if (data.message === 'Invalid device password') {
          if (onBack) onBack();
        } else {
          notify({
            title: "监控错误",
            message: data.data || data.message,
            type: "error",
            isModal: true
          })
        }
        setIsLoading(false)
      }
    } catch (e) {
      console.error("Failed to parse message", e)
    }
  }, [lastMessage, notify])

  const fetchHardwareInfo = () => {
    setIsLoading(true)
    sendCommand(device.id, device.password || "", "monitor", { action: "hardware_info" })
  }

  const exportHardwareInfo = () => {
    if (!hardwareInfo) return
    
    let content = "电脑硬件信息\n==============================\n"
    
    if (hardwareInfo.system) {
      content += `操作系统: ${hardwareInfo.system.os}\n`
      content += `系统版本: ${hardwareInfo.system.version}\n`
      content += `系统架构: ${hardwareInfo.system.architecture}\n`
    }
    
    if (hardwareInfo.cpu) {
      content += `处理器: ${hardwareInfo.cpu.processor}\n`
      content += `核心数: ${hardwareInfo.cpu.cores} 核心 ${hardwareInfo.cpu.logical} 线程\n`
      content += `处理器频率: ${hardwareInfo.cpu.freq}MHz\n`
    }
    
    if (hardwareInfo.motherboard) {
      hardwareInfo.motherboard.forEach((mb: any, i: number) => {
        content += `主板型号: ${mb.model}\n`
        content += `主板制造商: ${mb.manufacturer}\n`
      })
    }
    
    if (hardwareInfo.memory) {
      content += `内存总容量: ${hardwareInfo.memory.total} GB\n`
      content += `可用内存: ${hardwareInfo.memory.available} GB\n`
    }
    
    if (hardwareInfo.gpu) {
      hardwareInfo.gpu.forEach((gpu: any, i: number) => {
        content += `显卡${i+1}: ${gpu.name}\n`
        content += `显存${i+1}: ${gpu.vram}\n`
      })
    }
    
    if (hardwareInfo.disk) {
      hardwareInfo.disk.forEach((disk: any, i: number) => {
        content += `硬盘${i+1}型号: ${disk.model}\n`
        content += `硬盘${i+1}容量: ${disk.size}\n`
        content += `硬盘${i+1}接口: ${disk.interface}\n`
      })
    }
    
    if (hardwareInfo.network) {
      hardwareInfo.network.forEach((nic: any, i: number) => {
        content += `网卡${i+1}: ${nic.desc}\n`
        content += `MAC地址${i+1}: ${nic.mac}\n`
        if (nic.ip) content += `IP地址${i+1}: ${nic.ip}\n`
      })
    }
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `硬件信息_${new Date().getTime()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    notify({
      title: "导出成功",
      message: "硬件信息已导出",
      type: "success"
    })
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec === 0) return '0 KB/s'
    return (bytesPerSec / 1024).toFixed(1) + ' KB/s'
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-foreground">系统监控</h2>
          <p className="text-sm text-muted-foreground">查看设备硬件信息与实时性能</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchHardwareInfo} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={exportHardwareInfo} disabled={!hardwareInfo}>
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <Tabs defaultValue="hardware" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
            <TabsTrigger value="hardware">硬件信息</TabsTrigger>
            <TabsTrigger value="performance">性能监控</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hardware" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full pr-4">
              {isLoading && !hardwareInfo ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                  <p>正在加载硬件信息...</p>
                </div>
              ) : hardwareInfo ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {/* System */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MonitorIcon className="h-4 w-4 text-primary" />
                        系统信息
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-muted-foreground">操作系统:</span> <span>{hardwareInfo.system?.os}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">系统版本:</span> <span>{hardwareInfo.system?.version}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">系统架构:</span> <span>{hardwareInfo.system?.architecture}</span></div>
                    </CardContent>
                  </Card>

                  {/* CPU */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        处理器 (CPU)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-muted-foreground">型号:</span> <span className="text-right max-w-[200px] truncate" title={hardwareInfo.cpu?.processor}>{hardwareInfo.cpu?.processor}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">核心数:</span> <span>{hardwareInfo.cpu?.cores} 核心 {hardwareInfo.cpu?.logical} 线程</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">频率:</span> <span>{hardwareInfo.cpu?.freq} MHz</span></div>
                    </CardContent>
                  </Card>

                  {/* Memory */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MemoryStick className="h-4 w-4 text-primary" />
                        内存 (RAM)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-muted-foreground">总容量:</span> <span>{hardwareInfo.memory?.total} GB</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">可用:</span> <span>{hardwareInfo.memory?.available} GB</span></div>
                    </CardContent>
                  </Card>

                  {/* GPU */}
                  {hardwareInfo.gpu && hardwareInfo.gpu.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <MonitorIcon className="h-4 w-4 text-primary" />
                          显卡 (GPU)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-4">
                        {hardwareInfo.gpu.map((gpu: any, i: number) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between"><span className="text-muted-foreground">型号:</span> <span className="text-right max-w-[200px] truncate" title={gpu.name}>{gpu.name}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">显存:</span> <span>{gpu.vram}</span></div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Disk */}
                  {hardwareInfo.disk && hardwareInfo.disk.length > 0 && (
                    <Card className="md:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-primary" />
                          硬盘驱动器
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {hardwareInfo.disk.map((disk: any, i: number) => (
                            <div key={i} className="p-3 border rounded-md bg-muted/20">
                              <div className="font-medium truncate" title={disk.model}>{disk.model}</div>
                              <div className="text-muted-foreground mt-1 flex justify-between">
                                <span>{disk.size}</span>
                                <span>{disk.interface}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Battery */}
                  {hardwareInfo.battery && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Battery className="h-4 w-4 text-primary" />
                          电池
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">电量:</span> <span>{hardwareInfo.battery.percent}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">状态:</span> <span>{hardwareInfo.battery.plugged ? "充电中/已充满" : "放电中"}</span></div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Network */}
                  {hardwareInfo.network && hardwareInfo.network.length > 0 && (
                    <Card className="md:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Network className="h-4 w-4 text-primary" />
                          网络适配器
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-3">
                        {hardwareInfo.network.map((nic: any, i: number) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 border-b last:border-0">
                            <span className="font-medium truncate max-w-[300px]" title={nic.desc}>{nic.desc}</span>
                            <div className="flex gap-4 text-muted-foreground mt-1 sm:mt-0">
                              <span>MAC: {nic.mac}</span>
                              {nic.ip && <span>IP: {nic.ip}</span>}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <p>暂无硬件信息</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="performance" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full pr-4">
              <div className="grid gap-6 md:grid-cols-2">
                {/* CPU & Memory Real-time */}
                <Card className="md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">核心资源使用率</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-2"><Cpu className="h-4 w-4 text-primary"/> CPU 使用率</span>
                        <span>{performance?.cpu_percent || 0}%</span>
                      </div>
                      <Progress value={performance?.cpu_percent || 0} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium flex items-center gap-2"><MemoryStick className="h-4 w-4 text-primary"/> 内存 使用率</span>
                        <span>{performance?.mem_percent || 0}%</span>
                      </div>
                      <Progress value={performance?.mem_percent || 0} className="h-2" indicatorClassName={performance?.mem_percent > 80 ? "bg-destructive" : "bg-success"} />
                    </div>
                  </CardContent>
                </Card>

                {/* Disk I/O */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                      磁盘读写
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">读取速度</span>
                      <span className="font-mono">{formatSpeed(performanceSpeed.disk_read_speed)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">写入速度</span>
                      <span className="font-mono">{formatSpeed(performanceSpeed.disk_write_speed)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Network I/O */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Network className="h-4 w-4 text-primary" />
                      网络传输
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">上传速度</span>
                      <span className="font-mono">{formatSpeed(performanceSpeed.net_sent_speed)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">下载速度</span>
                      <span className="font-mono">{formatSpeed(performanceSpeed.net_recv_speed)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Partitions */}
                {performance?.partitions && performance.partitions.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">硬盘容量监控</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {performance.partitions.map((part: any, i: number) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{part.mountpoint}</span>
                            <span className="text-muted-foreground">{part.used}GB / {part.total}GB ({part.percent}%)</span>
                          </div>
                          <Progress 
                            value={part.percent} 
                            className="h-2" 
                            indicatorClassName={part.percent > 90 ? "bg-destructive" : "bg-primary"} 
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
