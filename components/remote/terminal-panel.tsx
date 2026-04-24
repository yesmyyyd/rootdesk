"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Terminal,
  Plus,
  X,
  Copy,
  Trash2,
  Download,
  Pause,
  Play,
  ChevronDown,
  Settings,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useNotification } from "@/components/ui/custom-notification"
import { DeviceInfo } from "./device-list"
import { useWebSocket } from "@/components/websocket-provider"

interface TerminalLine {
  id: number
  type: "input" | "output" | "error" | "system"
  content: string
  timestamp: string
}

interface TerminalTab {
  id: number
  name: string
  lines: TerminalLine[]
  cwd: string
}

interface PresetCommand {
  id: string
  name: string
  command: string
}

interface TerminalPanelProps {
  device: DeviceInfo
  onBack?: () => void
}

export function TerminalPanel({ device, onBack }: TerminalPanelProps) {
  const { sendCommand, lastMessage } = useWebSocket()
  const { notify } = useNotification()
  const lastHandledMessageRef = useRef<any>(null)
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { 
      id: 1, 
      name: "CMD #1", 
      lines: [
        { id: 1, type: "system", content: `Connected to ${device.name}`, timestamp: new Date().toLocaleTimeString() }
      ], 
      cwd: "C:\\Users\\Admin" 
    },
  ])
  const [activeTabId, setActiveTabId] = useState(1)
  const [inputValue, setInputValue] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [paused, setPaused] = useState(false)
  
  // Preset commands state
  const [presets, setPresets] = useState<PresetCommand[]>([])
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [newPresetName, setNewPresetName] = useState("")
  const [newPresetCmd, setNewPresetCmd] = useState("")

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextLineId = useRef(21)

  const activeTab = tabs.find(t => t.id === activeTabId)!

  // Load presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("terminal_presets")
    if (saved) {
      try {
        setPresets(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to load presets", e)
      }
    }
  }, [])

  const savePresets = (newPresets: PresetCommand[]) => {
    setPresets(newPresets)
    localStorage.setItem("terminal_presets", JSON.stringify(newPresets))
  }

  const addPreset = () => {
    if (!newPresetName.trim() || !newPresetCmd.trim()) return
    const newPreset: PresetCommand = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      command: newPresetCmd.trim()
    }
    savePresets([...presets, newPreset])
    setNewPresetName("")
    setNewPresetCmd("")
  }

  const deletePreset = (id: string) => {
    savePresets(presets.filter(p => p.id !== id))
  }

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [activeTab.lines, scrollToBottom])

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage || lastMessage === lastHandledMessageRef.current) return
    lastHandledMessageRef.current = lastMessage

    if (lastMessage.deviceId === device.id) {
      const now = new Date()
      const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      
      if (lastMessage.type === 'terminal_output' || lastMessage.type === 'terminal_error') {
        const content = lastMessage.data
        
        // Check for directory change
        // The server sends "Changed directory to X"
        if (lastMessage.type === 'terminal_output') {
            const cdMatch = content.match(/^Changed directory to (.+)$/);
            if (cdMatch) {
                const newCwd = cdMatch[1].trim();
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, cwd: newCwd } : t));
            }
        }

        const newLines: TerminalLine[] = [{
          id: nextLineId.current++,
          type: lastMessage.type === 'terminal_error' ? 'error' : 'output',
          content: content,
          timestamp
        }]
        
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, lines: [...t.lines, ...newLines] } : t))
      } else if (lastMessage.type === 'error') {
        if (lastMessage.message === 'Invalid device password') {
          if (onBack) onBack();
        }
      }
    }
  }, [lastMessage, device.id, activeTabId, onBack, notify])

  const executeCommand = (cmd: string) => {
    const now = new Date()
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

    const newLines: TerminalLine[] = [
      { id: nextLineId.current++, type: "input", content: cmd, timestamp },
    ]

    if (cmd.toLowerCase() === "cls" || cmd.toLowerCase() === "clear") {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, lines: [] } : t))
      return
    }

    // Send command to server
    sendCommand(device.id, device.password || "", "exec", cmd)

    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, lines: [...t.lines, ...newLines] } : t))
    setCommandHistory(prev => [cmd, ...prev])
    setHistoryIndex(-1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    executeCommand(inputValue.trim())
    setInputValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInputValue(commandHistory[newIndex])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInputValue(commandHistory[newIndex])
      } else {
        setHistoryIndex(-1)
        setInputValue("")
      }
    }
  }

  const addTab = () => {
    const newId = Math.max(...tabs.map(t => t.id)) + 1
    setTabs(prev => [...prev, {
      id: newId,
      name: `CMD #${newId}`,
      lines: [
        { id: nextLineId.current++, type: "system" as const, content: "RootDesk Remote Terminal v2.4.0", timestamp: new Date().toLocaleTimeString() },
        { id: nextLineId.current++, type: "system" as const, content: `新终端会话已创建`, timestamp: new Date().toLocaleTimeString() },
      ],
      cwd: "C:\\Users\\Admin",
    }])
    setActiveTabId(newId)
  }

  const closeTab = (id: number) => {
    if (tabs.length === 1) return
    const newTabs = tabs.filter(t => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id)
    }
  }

  const getLineColor = (type: string) => {
    switch (type) {
      case "input": return "text-primary"
      case "error": return "text-destructive"
      case "system": return "text-info"
      default: return "text-foreground/80"
    }
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
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
  }

  const handleCopy = () => {
    const text = activeTab.lines.map(l => l.content).join("\n")
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy text: ', err)
        fallbackCopyTextToClipboard(text)
      })
    } else {
      fallbackCopyTextToClipboard(text)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-foreground">CMD 终端</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", paused ? "text-warning" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, lines: [] } : t))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center flex-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors shrink-0",
                activeTabId === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <Terminal className="h-3 w-3" />
              {tab.name}
              {tabs.length > 1 && (
                <X
                  className="h-3 w-3 ml-1 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                />
              )}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 mr-1"
          onClick={addTab}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Terminal output */}
      <div
        className="flex-1 bg-background overflow-hidden cursor-text"
        onClick={() => inputRef.current?.focus()}
        ref={scrollRef}
      >
        <ScrollArea className="h-full">
          <div className="p-3 font-mono text-xs leading-relaxed">
            {activeTab.lines.map(line => (
              <div key={line.id} className="flex gap-2">
                <span className="text-muted-foreground/40 select-none shrink-0 w-16 text-right text-[10px]">
                  {line.timestamp}
                </span>
                {line.type === "input" ? (
                  <div className={getLineColor(line.type)}>
                    <span className="text-muted-foreground">{activeTab.cwd}{'>'}</span>{" "}
                    <span>{line.content}</span>
                  </div>
                ) : (
                  <div className={cn(getLineColor(line.type), "whitespace-pre-wrap break-all")}>
                    {line.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Preset Commands Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border bg-muted/20 shrink-0 overflow-x-auto no-scrollbar">
        <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs px-2 shrink-0 gap-1">
                    <Settings className="h-3 w-3" />
                    命令管理
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>预设命令管理</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex gap-2 items-end">
                        <div className="grid gap-2 flex-1">
                            <Input 
                                placeholder="名称 (如: 查看IP)" 
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                            />
                            <Input 
                                placeholder="命令 (如: ipconfig)" 
                                value={newPresetCmd}
                                onChange={(e) => setNewPresetCmd(e.target.value)}
                            />
                        </div>
                        <Button onClick={addPreset} size="icon" className="shrink-0 mb-0.5">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="border rounded-md max-h-[200px] overflow-y-auto p-2 space-y-2">
                        {presets.length === 0 && (
                            <div className="text-center text-muted-foreground text-sm py-4">暂无预设命令</div>
                        )}
                        {presets.map(preset => (
                            <div key={preset.id} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                                <div className="grid gap-0.5">
                                    <span className="font-medium">{preset.name}</span>
                                    <span className="text-xs text-muted-foreground font-mono">{preset.command}</span>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => deletePreset(preset.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        
        <div className="w-px h-4 bg-border shrink-0 mx-1" />
        
        <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar">
            {presets.map(preset => (
                <Button 
                    key={preset.id} 
                    variant="secondary" 
                    size="sm" 
                    className="h-6 text-xs px-2 shrink-0 whitespace-nowrap font-normal"
                    onClick={() => {
                        setInputValue(preset.command);
                        inputRef.current?.focus();
                    }}
                    title={preset.command}
                >
                    {preset.name}
                </Button>
            ))}
        </div>
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex items-center border-t border-border bg-card shrink-0">
        <div className="flex items-center gap-1 px-3 py-2 flex-1">
          <span className="text-xs font-mono text-primary shrink-0 hidden sm:inline">
            <ChevronDown className="h-3 w-3 inline -rotate-90" />
          </span>
          <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:inline">
            {activeTab.cwd}{'>'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground/50 ml-1"
            placeholder="输入命令..."
            autoFocus
            spellCheck={false}
          />
        </div>
        <Button type="submit" variant="ghost" size="sm" className="mr-2 h-7 text-xs text-primary hover:text-primary hover:bg-primary/10">
          执行
        </Button>
      </form>
    </div>
  )
}
