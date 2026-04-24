"use client"

import { useState, useEffect, useRef } from "react"
import { Send, Image as ImageIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWebSocket } from "@/components/websocket-provider"
import { DeviceInfo } from "./device-list"

interface ChatMessage {
  id: string
  sender: "server" | "client"
  type: "text" | "image"
  content: string
  timestamp: number
}

interface ChatPanelProps {
  device: DeviceInfo
  onClose: () => void
  onUnreadChange: (count: number) => void
  isOpen: boolean
  rtcMessage?: any
}

export function ChatPanel({ device, onClose, onUnreadChange, isOpen, rtcMessage }: ChatPanelProps) {
  const { sendCommand, lastMessage } = useWebSocket()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [unreadCount, setUnreadCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastProcessedMessageRef = useRef<any>(null)
  const lastProcessedRtcMessageRef = useRef<any>(null)

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      onUnreadChange(0)
    }
  }, [isOpen, onUnreadChange])

  useEffect(() => {
    const processChatMessage = (msg: any) => {
      if (!msg || msg.deviceId !== device.id || msg.type !== "chat_message") return;
      
      const newMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        sender: "client",
        type: msg.data?.type || "text",
        content: msg.data?.content || "",
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, newMessage])
      
      if (!isOpen) {
        setUnreadCount((prev) => {
          const newCount = prev + 1
          onUnreadChange(newCount)
          return newCount
        })
      }
    }

    if (lastMessage && lastMessage !== lastProcessedMessageRef.current) {
      lastProcessedMessageRef.current = lastMessage
      processChatMessage(lastMessage)
    }

    if (rtcMessage && rtcMessage !== lastProcessedRtcMessageRef.current) {
      lastProcessedRtcMessageRef.current = rtcMessage
      processChatMessage(rtcMessage)
    }
  }, [lastMessage, rtcMessage, device.id, isOpen, onUnreadChange])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!inputValue.trim()) return

    const newMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      sender: "server",
      type: "text",
      content: inputValue,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInputValue("")

    sendCommand(device.id, device.password || '', 'chat', { action: "send", type: "text", content: inputValue },)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      
      const newMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        sender: "server",
        type: "image",
        content: base64,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, newMessage])

      sendCommand(device.id, device.password || '', 'chat', { action: "send", type: "image", content: base64 },)
    }
    reader.readAsDataURL(file)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  if (!isOpen) return null

  return (
    <div className="absolute bottom-16 right-4 w-80 h-96 bg-card border border-border rounded-lg shadow-xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <h3 className="font-medium text-sm">聊天 - {device.name}</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[80%] ${
                msg.sender === "server" ? "self-end items-end" : "self-start items-start"
              }`}
            >
              <div
                className={`px-3 py-2 rounded-lg text-sm ${
                  msg.sender === "server"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted text-foreground rounded-bl-none"
                }`}
              >
                {msg.type === "text" ? (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                ) : (
                  <img src={msg.content} alt="Chat image" className="max-w-full rounded cursor-pointer" onClick={() => window.open(msg.content)} />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs mt-10">
              暂无消息，开始聊天吧
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-border bg-card flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageUpload}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="输入消息..."
          className="flex-1 h-8 text-sm"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!inputValue.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
