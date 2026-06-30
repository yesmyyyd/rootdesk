"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  Maximize2,
  Minimize2,
  MousePointer2,
  Keyboard,
  RotateCcw,
  Camera,
  ZoomIn,
  ZoomOut,
  Power,
  Clipboard,
  Lock,
  MonitorOff,
  Move,
  Touchpad,
  Command,
  ArrowLeft,
  X,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Activity,
  Gamepad2,
  Unlock,
  ArrowUpDown,
  ArrowLeftRight,
  Hand,
  Crosshair,
  MessageSquare,
  HelpCircle,
  Smartphone,
  Menu,
  Settings,
  ChevronDown,
  Monitor,
  Sparkles,
  Zap,
  Plus
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { DeviceInfo } from "./device-list"
import { useWebSocket } from "@/components/websocket-provider"
import { useNotification } from "@/components/ui/custom-notification"
import { ChatPanel } from "./chat-panel"
import { StreamScreen, StreamScreenRef } from "./stream-screen"
import { KeymapEditor, KeymapCanvas, EditorProvider, KeymapToolbar, KeymapProperties, KeymapKeyboardOverlay } from "@/components/keymap"
import { VirtualKeyboard } from "@/components/keymap/virtual-keyboard"
import { useKeymapStore } from "@/components/keymap/use-keymap-store"

interface ToolbarAction {
  id?: string;
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
  dropdown?: { label: string; onClick: () => void; destructive?: boolean; keepOpen?: boolean; active?: boolean }[];
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
  badge?: number | string;
  hideOnMobile?: boolean;
  hideOnPC?: boolean;
}

interface MobileFloatingMenuProps {
  actions: ToolbarAction[];
  isLandscape: boolean;
}

const MobileFloatingMenu = ({ actions, isLandscape }: MobileFloatingMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  const stopPropagation = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-[100]"
      onPointerDown={stopPropagation}
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 pointer-events-auto backdrop-blur-[2px]"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            onPointerDown={stopPropagation}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "absolute right-4 pointer-events-auto bg-card/95 backdrop-blur-md border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col min-w-[200px] max-w-[260px]",
              isLandscape ? "bottom-20" : "bottom-24"
            )}
            style={{ 
              maxHeight: isLandscape ? 'calc(100% - 100px)' : 'calc(100% - 140px)'
            }}
            onPointerDown={stopPropagation}
          >
            <div className="p-2 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between px-4 py-2 mb-1 border-b border-border/50">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">菜单</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }} 
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {actions.filter(action => !action.hideOnMobile).map((action, i) => (
                <div key={i} className="flex flex-col">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (action.dropdown) {
                        setActiveDropdown(activeDropdown === i ? null : i);
                      } else {
                        action.onClick?.();
                        setIsOpen(false);
                      }
                    }}
                    onPointerDown={stopPropagation}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all active:scale-95",
                      action.active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                      action.destructive && "text-destructive",
                      action.disabled && "opacity-50 grayscale cursor-not-allowed"
                    )}
                    disabled={action.disabled}
                  >
                    <div className="relative flex items-center justify-center w-6 h-6">
                      <action.icon className={cn("h-5 w-5", action.className?.includes('rotate-90') && "rotate-90")} />
                      {action.badge && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white border-2 border-card">
                          {action.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium flex-1 text-left">{action.label}</span>
                    {action.dropdown && (
                      <ChevronDown className={cn("h-4 w-4 transition-transform opacity-50", activeDropdown === i && "rotate-180")} />
                    )}
                  </button>
                  
                  {action.dropdown && activeDropdown === i && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex flex-col pl-10 pr-2 pb-2 gap-1 overflow-hidden bg-muted/30 rounded-xl mt-1"
                    >
                      {action.dropdown.map((item: any, j: number) => (
                        <button
                          key={j}
                          onClick={(e) => {
                            e.stopPropagation();
                            item.onClick();
                            if (!item.keepOpen) {
                              setIsOpen(false);
                            }
                          }}
                          onPointerDown={stopPropagation}
                          className={cn(
                            "text-left py-2.5 px-3 text-xs rounded-lg transition-colors active:scale-95 flex items-center justify-between",
                            item.active ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:bg-muted",
                            item.destructive && "text-destructive"
                          )}
                        >
                          <span>{item.label}</span>
                          {item.active && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute bottom-6 right-6 pointer-events-auto w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex items-center justify-center z-[110] border-2 border-white/20 backdrop-blur-sm cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onPointerDown={stopPropagation}
        whileTap={{ scale: 0.9 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isOpen ? "close" : "menu"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

interface StreamViewProps {
  device: DeviceInfo
  mode: "screen" | "window"
  targetId?: number // For window mode
  onBack?: () => void
  title?: string
  subTitle?: string
}

export function StreamView({ device, mode, targetId, onBack, title, subTitle }: StreamViewProps) {
  const { socket, isConnected, sendCommand, lastMessage, getTurnConfig } = useWebSocket()
  console.log("[StreamView] Component rendered, device:", device.id);
  const { notify } = useNotification()
  
  // All refs at the top
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const screenRef = useRef<StreamScreenRef>(null)
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeTouchIdRef = useRef<number | null>(null)
  const lastTouchTime = useRef<number>(0)
  const lastTouchPos = useRef<{ x: number, y: number } | null>(null)
  const lastClickTime = useRef<number>(0)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressActive = useRef<boolean>(false)
  const virtualMousePosRef = useRef({ x: 100, y: 200 })
  const vMouseDragOffset = useRef({ x: 0, y: 0 })
  const edgePanRaf = useRef<number | null>(null)
  const edgePanVelocity = useRef({ x: 0, y: 0 })
  const prevPerformanceRef = useRef<any>(null)
  const prevTimeRef = useRef<number>(0)
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cancelledUploads = useRef<Set<string>>(new Set())

  const [fullscreen, setFullscreen] = useState(false)
  const [mouseMode, setMouseMode] = useState(true)
  // Window mode defaults to API click (no interception), Screen mode defaults to interception
  const [useInterception, setUseInterception] = useState(mode !== 'window')
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState("")

  const [keyboardMode, setKeyboardMode] = useState(true)
  const [targetFps, setTargetFps] = useState([30])
  const [quality, setQuality] = useState([80])
  const [streamScale, setStreamScale] = useState([0.7])
  const [compress, setCompress] = useState(true)
  const [useWebP, setUseWebP] = useState(true)
  const lastPingTimeRef = useRef<number | null>(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [interactionMode, setInteractionMode] = useState<"touch" | "mouse">("touch")
  const [showVirtualMouse, setShowVirtualMouse] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 })
  
  const [isLandscape, setIsLandscape] = useState(false)
  
  // 横屏和全屏模式互斥逻辑：横屏不支持全屏，全屏不支持横屏
  useEffect(() => {
    if (isLandscape && fullscreen) {
      setFullscreen(false)
    }
  }, [isLandscape, fullscreen])

  useEffect(() => {
    if (fullscreen && isLandscape) {
      setIsLandscape(false)
    }
  }, [fullscreen, isLandscape])

  const [showTextInput, setShowTextInput] = useState(false)
  const [realtimeSyncValue, setRealtimeSyncValue] = useState(" ")
  const [customHotkeys, setCustomHotkeys] = useState<{label: string, keys: string[]}[]>([])
  const [isAddingHotkey, setIsAddingHotkey] = useState(false)
  const [newHotkeyKeys, setNewHotkeyKeys] = useState<string[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('yyds_custom_hotkeys')
    if (saved) {
      try {
        setCustomHotkeys(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (customHotkeys.length > 0) {
      localStorage.setItem('yyds_custom_hotkeys', JSON.stringify(customHotkeys))
    }
  }, [customHotkeys])

  const handleKeySelectForHotkey = (key: string) => {
    // Convert to pyautogui compatible keys
    let finalKey = key.toLowerCase();
    if (finalKey === 'back') finalKey = 'backspace';
    if (finalKey === 'up') finalKey = 'up';
    if (finalKey === 'down') finalKey = 'down';
    if (finalKey === 'left') finalKey = 'left';
    if (finalKey === 'right') finalKey = 'right';
    if (finalKey === 'enter') finalKey = 'enter';
    if (finalKey === 'esc') finalKey = 'esc';
    if (finalKey === 'space') finalKey = 'space';
    
    setNewHotkeyKeys(prev => {
      if (prev.includes(finalKey)) {
        return prev.filter(k => k !== finalKey);
      }
      return [...prev, finalKey];
    });
  }

  const handleSaveHotkey = () => {
    if (newHotkeyKeys.length === 0) return;
    const label = newHotkeyKeys.map(k => k.toUpperCase()).join('+');
    setCustomHotkeys(prev => [...prev, { label, keys: newHotkeyKeys }]);
    setIsAddingHotkey(false);
    setNewHotkeyKeys([]);
  }

  const [privacyScreen, setPrivacyScreen] = useState(false)
  const [privacyMessage, setPrivacyMessage] = useState("系统维护中，请稍候...")
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false)
  
  const [showChat, setShowChat] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null)
  
  const handleRefresh = useCallback(() => {
    screenRef.current?.handleRefresh();
  }, []);

  const sendInput = useCallback((action: string, data: any) => {
    screenRef.current?.sendInput(action, data);
  }, []);

  const sendHotkey = useCallback((keys: string[]) => {
    screenRef.current?.sendHotkey(keys);
  }, []);

  const getRealPos = useCallback((vMouseX: number, vMouseY: number) => {
    return screenRef.current?.getRealPos(vMouseX, vMouseY) || { x: 0, y: 0 };
  }, []);

  // Stream state (synchronized from StreamScreen)
  const [webrtcState, setWebrtcState] = useState<"connecting" | "connected" | "failed" | "none">("none")
  const [connectionType, setConnectionType] = useState<'internal' | 'external' | null>(null)
  const [fps, setFps] = useState(0)
  const [latency, setLatency] = useState<number | null>(null)
  const [originalSize, setOriginalSize] = useState<{ width: number, height: number } | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [hasInterception, setHasInterception] = useState<boolean | null>(null)
  const [cursorStyle, setCursorStyle] = useState<string>("default")
  const [isReceivingAudio, setIsReceivingAudio] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [rtcMessage, setRtcMessage] = useState<any>(null)
  
  useEffect(() => {
    if (hasInterception === false) {
      setUseInterception(false);
    }
  }, [hasInterception]);

  // Power control confirmation state
  const [powerConfirm, setPowerConfirm] = useState<{
    show: boolean;
    type: 'shutdown' | 'restart' | 'sleep' | null;
    label: string;
    command: string;
  }>({
    show: false,
    type: null,
    label: '',
    command: ''
  });
  
  // File upload state
  const [uploadProgress, setUploadProgress] = useState<{ [transferId: string]: number }>({})
  const [activeUploads, setActiveUploads] = useState<{ id: string, filename: string }[]>([])

  // Keymap state
  const [isEditingKeymap, setIsEditingKeymap] = useState(false)
  const [keymapConfig, setKeymapConfig] = useState<any>(null)
  const { configs: savedKeymaps, saveConfig: saveKeymapToStore, deleteConfig: deleteKeymapFromStore, exportConfig, importConfig } = useKeymapStore()
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showKeymapProperties, setShowKeymapProperties] = useState(false)
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null)

  const crosshairNode = useMemo(() => {
    return keymapConfig?.nodes?.find((n: any) => n.type === 'crosshair');
  }, [keymapConfig]);
  
  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (fullscreen) {
      if (!document.fullscreenElement) {
        rootRef.current?.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          setFullscreen(false);
        });
      }
    } else {
      if (document.fullscreenElement && document.fullscreenElement === rootRef.current) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [fullscreen]);

  useEffect(() => {
    if (showTextInput && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [showTextInput]);

  // Audio state
  const [listenAudio, setListenAudio] = useState(false)
  const [speakAudio, setSpeakAudio] = useState(false)

  // Touch handling state
  const [touchStartDist, setTouchStartDist] = useState<number>(0)
  const [touchStartZoom, setTouchStartZoom] = useState<number>(1)
  const [isPanning, setIsPanning] = useState(false)

  const [virtualMousePos, setVirtualMousePos] = useState({ x: 100, y: 200 })
  useEffect(() => {
    virtualMousePosRef.current = virtualMousePos
  }, [virtualMousePos])
  
  const [isDraggingVMouse, setIsDraggingVMouse] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isActualMobile, setIsActualMobile] = useState(false)
  const [showClockScroll, setShowClockScroll] = useState(false)
  const [clockScrollCenter, setClockScrollCenter] = useState({ x: 0, y: 0 })
  const [scrollAngle, setScrollAngle] = useState<number | null>(null)
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 })
  const initialModeSet = useRef(false)

  // Performance monitoring state
  const [showPerformance, setShowPerformance] = useState(false)
  const [performance, setPerformance] = useState<any>(null)
  const [performanceSpeed, setPerformanceSpeed] = useState<any>({
    net_sent_speed: 0,
    net_recv_speed: 0,
  })

  // Performance monitoring interval
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (showPerformance) {
      interval = setInterval(() => {
        sendCommand(device.id, device.password || "", "monitor", { action: "performance" })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [showPerformance, device.id, sendCommand])

  // Screen Wake Lock
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock active');
        
        // Handle system-initiated release
        wakeLock.addEventListener('release', () => {
          console.log('Wake Lock was released');
          wakeLock = null;
        });
      } catch (err: any) {
        console.error(`Wake Lock error: ${err.name}, ${err.message}`);
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
          console.log('Wake Lock released');
        });
      }
    };
  }, []);

  const getBoundedScrollOffset = (newX: number, newY: number, currentZoom: number) => {
    if (!containerRef.current) return { x: newX, y: newY };
    const contentWidth = (originalSize?.width || 0) * currentZoom;
    const contentHeight = (originalSize?.height || 0) * currentZoom;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // Allow edges to reach the center of the container with extra padding
    const maxPanX = Math.max(0, (contentWidth - containerWidth) / 2) + (containerWidth * 0.1);
    const maxPanY = Math.max(0, (contentHeight - containerHeight) / 2) + (containerHeight * 0.6);
    
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY))
    };
  };

  useEffect(() => {
    setScrollOffset(prev => getBoundedScrollOffset(prev.x, prev.y, zoom));
  }, [zoom, originalSize]);

  // Edge panning for virtual mouse
  useEffect(() => {
    if (!isDraggingVMouse) {
      if (edgePanRaf.current) {
        cancelAnimationFrame(edgePanRaf.current);
        edgePanRaf.current = null;
      }
      return;
    }

    const panLoop = () => {
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const edgeThreshold = 60; // 60px from edge
      const maxSpeed = 6; // slow pan
      
      let vx = 0;
      let vy = 0;
      
      const x = virtualMousePosRef.current.x;
      const y = virtualMousePosRef.current.y;
      const vMouseWidth = 120; // approximate scaled width
      const vMouseHeight = 180; // approximate scaled height
      
      if (x < edgeThreshold) {
        vx = ((edgeThreshold - x) / edgeThreshold) * maxSpeed;
      } else if (x + vMouseWidth > containerWidth - edgeThreshold) {
        const dist = (x + vMouseWidth) - (containerWidth - edgeThreshold);
        vx = -(Math.min(dist, edgeThreshold) / edgeThreshold) * maxSpeed;
      }
      
      if (y < edgeThreshold) {
        vy = ((edgeThreshold - y) / edgeThreshold) * maxSpeed;
      } else if (y + vMouseHeight > containerHeight - edgeThreshold) {
        const dist = (y + vMouseHeight) - (containerHeight - edgeThreshold);
        vy = -(Math.min(dist, edgeThreshold) / edgeThreshold) * maxSpeed;
      }
      
      if (vx !== 0 || vy !== 0) {
        setScrollOffset(prev => getBoundedScrollOffset(prev.x + vx, prev.y + vy, zoom));
      }
      
      edgePanRaf.current = requestAnimationFrame(panLoop);
    };
    
    edgePanRaf.current = requestAnimationFrame(panLoop);
    
    return () => {
      if (edgePanRaf.current) {
        cancelAnimationFrame(edgePanRaf.current);
        edgePanRaf.current = null;
      }
    };
  }, [isDraggingVMouse, zoom, originalSize]);

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec === 0) return '0 KB/s'
    return (bytesPerSec / 1024).toFixed(1) + ' KB/s'
  }

  useEffect(() => {
    const checkMobile = () => {
      const isTouch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024;
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const mobile = isTouch || isSmallScreen || isMobileUserAgent;
      setIsMobile(mobile);
      setIsActualMobile(isMobileUserAgent);
      
      if (mobile && !initialModeSet.current) {
        setInteractionMode("touch");
        initialModeSet.current = true;
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [])

  const getVirtualMouseHotspot = useCallback(() => {
    if (isLandscape) {
      return {
        x: virtualMousePos.x ,
        y: virtualMousePos.y + 3
      };
    }
    return {
      x: virtualMousePos.x + 3,
      y: virtualMousePos.y + 4
    };
  }, [virtualMousePos, isLandscape]);

  useEffect(() => {
    if (showVirtualMouse && canvasRef.current && containerRef.current) {
      const hotspot = getVirtualMouseHotspot();
      const { x: realX, y: realY } = getRealPos(hotspot.x, hotspot.y);
      setCursorPos({ x: realX, y: realY });
      sendInput('mousemove', { x: realX, y: realY });
    }
  }, [virtualMousePos, scrollOffset, zoom, originalSize, showVirtualMouse, getRealPos, getVirtualMouseHotspot, sendInput]);

  const cancelUpload = useCallback((transferId: string) => {
    sendCommand(device.id, device.password || "", 'files', {
      action: 'file_cancel',
      transferId: transferId
    });
    setActiveUploads(prev => prev.filter(f => f.id !== transferId));
    setUploadProgress(prev => {
      const next = { ...prev };
      delete next[transferId];
      return next;
    });
    notify({
      title: "传输已取消",
      message: "您已取消文件传输",
      type: "info"
    });
  }, [device.id, device.password, sendCommand, notify]);

  const handleDrop = async (files: FileList, clientX: number, clientY: number) => {
    if (files.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    let x = clientX - rect.left;
    let y = clientY - rect.top;
    let rectW = rect.width;
    let rectH = rect.height;

    if (isLandscape) {
      x = clientY - rect.top;
      y = rect.right - clientX;
      rectW = rect.height;
      rectH = rect.width;
    }

    const targetWidth = originalSize?.width || canvasRef.current!.width;
    const targetHeight = originalSize?.height || canvasRef.current!.height;
    const realX = Math.round((x / rectW) * targetWidth);
    const realY = Math.round((y / rectH) * targetHeight);
    const CHUNK_SIZE = 128 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const transferId = `${file.name}-${Date.now()}-${i}`;
      setActiveUploads(prev => [...prev, { id: transferId, filename: file.name }]);
      setUploadProgress(prev => ({ ...prev, [transferId]: 0 }));
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const totalSize = arrayBuffer.byteLength;
        sendCommand(device.id, device.password || "", 'files', {
          action: 'drop_start', transferId, filename: file.name, totalSize, x: realX, y: realY
        });
        await new Promise(r => setTimeout(r, 150));
        let offset = 0;
        const toBase64 = (buffer: ArrayBuffer) => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i += 8192) {
            const chunk = bytes.subarray(i, i + 8192);
            binary += String.fromCharCode.apply(null, chunk as any);
          }
          return btoa(binary);
        };
        while (offset < totalSize) {
          const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
          sendCommand(device.id, device.password || "", 'files', {
            action: 'drop_chunk', transferId, filename: file.name, data: toBase64(chunk), offset
          });
          offset += CHUNK_SIZE;
          await new Promise(r => setTimeout(r, 20));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleIncomingMessage = useCallback((msg: any) => {
    if (!msg || msg.deviceId !== device.id) return;

    if (msg.type === 'notification') {
        notify({ title: msg.data.title || "通知", message: msg.data.message || "", type: "info" });
    } else if (msg.type === 'file_progress') {
        const { transferId, progress } = msg.data;
        setUploadProgress(prev => ({ ...prev, [transferId]: progress }));
    } else if (msg.type === 'file_complete') {
        const { transferId, filename } = msg.data;
        setActiveUploads(prev => prev.filter(f => f.id !== transferId));
        setUploadProgress(prev => {
            const next = { ...prev };
            delete next[transferId];
            return next;
        });
        notify({ title: "传输完成", message: `文件 ${filename || '传输'} 已成功送达`, type: "success" });
    } else if (msg.type === 'file_cancel') {
        const { transferId, filename } = msg.data;
        cancelledUploads.current.add(transferId);
        setActiveUploads(prev => prev.filter(f => f.id !== transferId));
        setUploadProgress(prev => {
            const next = { ...prev };
            delete next[transferId];
            return next;
        });
        notify({ title: "传输已取消", message: filename ? `文件 ${filename} 的传输已被取消` : "远程设备取消了文件传输", type: "error" });
    } else if (msg.type === 'error') {
        if (msg.deviceId === device.id && msg.message === 'Invalid device password') {
            if (onBack) onBack();
        }
    } else if (msg.type === 'session_invalidated') {
        if (msg.deviceId === device.id && onBack) onBack();
    } else if (msg.type === 'screenshot') {
        const url = `data:image/jpeg;base64,${msg.data}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = `screenshot-${device.id}-${Date.now()}.jpg`;
        link.click();
        notify({ title: "截图成功", message: "截图已保存到您的下载文件夹", type: "success" });
    } else if (msg.type === 'clipboard') {
        const text = msg.data;
        const isAuto = msg.auto === true;
        navigator.clipboard.writeText(text).then(() => {
            if (!isAuto) notify({ title: "剪贴板同步成功", message: "已从远程设备获取剪贴板内容", type: "success" });
        }).catch(err => {
            if (!isAuto) notify({ title: "剪贴板同步失败", message: "无法写入本地剪贴板，请检查浏览器权限", type: "error" });
        });
    } else if (msg.type === 'clipboard_image') {
        const base64Data = msg.data;
        const isAuto = msg.auto === true;
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            if (navigator.clipboard && (window as any).ClipboardItem) {
                const item = new (window as any).ClipboardItem({ [blob.type]: blob });
                navigator.clipboard.write([item]).then(() => {
                    if (!isAuto) notify({ title: "剪贴板同步成功", message: "已从远程设备获取图片内容", type: "success" });
                }).catch(err => {
                    if (!isAuto) notify({ title: "剪贴板同步失败", message: "无法写入图片到剪贴板", type: "error" });
                });
            }
        } catch (e) {}
    }
  }, [device.id, notify, onBack]);

  useEffect(() => { handleIncomingMessage(lastMessage); }, [lastMessage, handleIncomingMessage]);
  useEffect(() => { handleIncomingMessage(rtcMessage); }, [rtcMessage, handleIncomingMessage]);

  const handleImportKeymap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importConfig(file)
        .then((config) => {
          notify({ title: "导入成功", message: `已成功导入方案: ${config.name}`, type: "success" });
          setKeymapConfig(config);
        })
        .catch((err) => {
          notify({ title: "导入失败", message: "文件格式不正确或解析失败", type: "error" });
        });
    }
    // Reset file input
    if (e.target) e.target.value = '';
  };

  const handleKeymapAction = useCallback(async (node: any, action: 'down' | 'up' | 'move', extra?: any) => {
    const targetX = node.targetX ?? node.x;
    const targetY = node.targetY ?? node.y;

    // Convert percentage to remote coordinates
    const remoteX = Math.round((targetX / 100) * (originalSize?.width || 1920));
    const remoteY = Math.round((targetY / 100) * (originalSize?.height || 1080));

    const getMouseButton = (key: string) => {
      if (key === 'LButton') return 'left';
      if (key === 'RButton') return 'right';
      if (key === 'MButton') return 'middle';
      if (key?.startsWith('Mouse')) {
        const btn = key.replace('Mouse', '').toLowerCase();
        return btn === 'left' || btn === 'right' || btn === 'middle' ? btn : 'left';
      }
      return null;
    };

    // Helper to sleep
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    if (node.type === 'click' && action === 'down') {
      const actions = node.actions || [{ type: 'click', key: node.key }];
      
      // Determine if this is a macro sequence or a simple single button
      const isMacro = actions.length > 1 || (actions.length === 1 && actions[0].type === 'delay');
      
      if (isMacro) {
        setExecutingNodeId(node.id);
        
        try {
          for (const act of actions) {
            if (act.type === 'delay' && act.delay) {
              await sleep(act.delay);
            } else if (act.type === 'click') {
              const mouseBtn = getMouseButton(act.key || node.key);
              // Use explicit coordinates if set, otherwise use the node's percentage-based position
              const x = (act.x !== undefined && act.x !== null) ? act.x : remoteX;
              const y = (act.y !== undefined && act.y !== null) ? act.y : remoteY;
              
              if (mouseBtn) {
                sendInput('mousedown', { x, y, button: mouseBtn });
                await sleep(20);
                // Release at current position without moving to coordinates again
                sendInput('mouseup', { button: mouseBtn });
              } else if (act.key || node.key) {
                sendInput('keypress', { key: (act.key || node.key).toLowerCase() });
              }
              await sleep(20);
            }
          }
        } finally {
          setExecutingNodeId(null);
        }
        return;
      }
    }

    // For non-macro nodes or fallback
    switch (node.type) {
      case 'click':
      case 'fire':
      case 'skill':
      case 'swipe':
      case 'crosshair':
        const firstAction = (node.type === 'click' && node.actions?.length === 1) ? node.actions[0] : null;
        const currentKey = extra?.key || firstAction?.key || node.key;
        const mouseBtn = getMouseButton(currentKey);
        
        // Use action coordinates if it's a simple click node, otherwise use remoteX/Y
        const x = (firstAction && firstAction.x !== undefined && firstAction.x !== null) ? firstAction.x : remoteX;
        const y = (firstAction && firstAction.y !== undefined && firstAction.y !== null) ? firstAction.y : remoteY;

        if (action === 'down') {
          if (mouseBtn) {
            sendInput('mousedown', { x, y, button: mouseBtn });
          } else if (currentKey) {
            sendInput('keydown', { key: currentKey.toLowerCase() });
          } else {
            sendInput('mousedown', { x, y, button: 'left' });
          }
        } else if (action === 'up') {
          if (mouseBtn) {
            // Release directly at current position
            sendInput('mouseup', { button: mouseBtn });
          } else if (currentKey) {
            sendInput('keyup', { key: currentKey.toLowerCase() });
          } else {
            sendInput('mouseup', { button: 'left' });
          }
        }
        break;
      case 'joystick':
        if (action === 'down' || action === 'move') {
          if (extra?.key) {
             const jMouseBtn = getMouseButton(extra.key);
             if (jMouseBtn) {
               // If it's a mouse button on joystick, we should probably mousedown at the target location
               sendInput('mousedown', { x: remoteX, y: remoteY, button: jMouseBtn });
             } else {
               sendInput('keydown', { key: extra.key.toLowerCase() });
             }
          }
        } else if (action === 'up') {
          if (extra?.key) {
             const jMouseBtn = getMouseButton(extra.key);
             if (jMouseBtn) {
               // Release directly
               sendInput('mouseup', { button: jMouseBtn });
             } else {
               sendInput('keyup', { key: extra.key.toLowerCase() });
             }
          }
        }
        break;
    }
  }, [originalSize, sendInput]);

  const toolbarActions: ToolbarAction[] = [
    ...(onBack ? [{
      icon: ArrowLeft,
      label: "返回",
      onClick: onBack 
    }] : []),
    { 
      icon: Smartphone, 
      label: isLandscape ? "切换竖屏" : "切换横屏", 
      active: isLandscape, 
      onClick: () => {
        const next = !isLandscape;
        setIsLandscape(next);
        if (next) setFullscreen(false);
      },
      className: cn("transition-transform duration-300", isLandscape ? "rotate-90" : "rotate-0") 
    },
    { 
      icon: fullscreen ? Minimize2 : Maximize2, 
      label: fullscreen ? "退出全屏" : "全屏", 
      active: fullscreen, 
      onClick: () => {
        const next = !fullscreen;
        setFullscreen(next);
        if (next) setIsLandscape(false);
      } 
    },
    {
      icon: RotateCcw,
      label: "刷新连接",
      onClick: handleRefresh,
      hideOnMobile: true
    },
    { icon: MousePointer2, label: "远程点击", active: mouseMode, onClick: () => setMouseMode(!mouseMode), hideOnMobile: true },
    { 
      icon: Gamepad2, 
      label: hasInterception === false ? "驱动级输入 (客户端未安装驱动)" : "驱动级输入", 
      active: useInterception && hasInterception !== false, 
      onClick: () => {
        if (hasInterception === false) {
          notify({
            title: "驱动不可用",
            message: "客户端未安装 Interception 驱动，无法开启驱动级输入",
            type: "error"
          });
          return;
        }
        setUseInterception(!useInterception)
      },
      disabled: hasInterception === false,
      className: hasInterception === false ? "opacity-50 cursor-not-allowed grayscale" : ""
    },
    { icon: Unlock, label: "解锁计算机", active: false, onClick: () => setShowUnlockDialog(true) },
    { icon: MessageSquare, label: "聊天", active: showChat, onClick: () => setShowChat(!showChat), badge: unreadChatCount > 0 ? unreadChatCount : undefined },
    { 
      icon: Keyboard, 
      label: "键盘输入", 
      active: showTextInput, 
      onClick: () => {
        const next = !showTextInput;
        setShowTextInput(next);
        setRealtimeSyncValue(" ");
        if (next) sendInput('type_realtime', { text: "__RESET__" });
      },
      hideOnPC: true
    },
    { icon: Keyboard, label: "键盘事件", active: keyboardMode, onClick: () => setKeyboardMode(!keyboardMode), hideOnMobile: true },
    {
        icon: Gamepad2,
        label: "按键方案",
        dropdown: [
          { 
            label: isEditingKeymap ? "退出编辑" : (keymapConfig ? "编辑当前方案" : "新建方案"), 
            onClick: () => {
              if (isEditingKeymap) {
                setIsEditingKeymap(false);
              } else {
                if (!keymapConfig) {
                  setKeymapConfig({
                      id: `keymap-${Date.now()}`,
                      name: '新建方案',
                      nodes: [],
                      gameResolution: { width: 1920, height: 1080 }
                  });
                }
                setIsEditingKeymap(true);
              }
            },
            active: isEditingKeymap
          },
          ...savedKeymaps.map(km => ({
            label: `加载: ${km.name}`,
            onClick: () => {
              if (keymapConfig?.id === km.id) {
                setKeymapConfig(null);
                notify({ title: "方案已卸载", message: `已取消应用方案: ${km.name}`, type: "info" });
              } else {
                setKeymapConfig(km);
                notify({ title: "方案已加载", message: `已应用方案: ${km.name}`, type: "success" });
              }
            },
            active: keymapConfig?.id === km.id
          })),
          { label: "导出当前方案", onClick: () => keymapConfig && exportConfig(keymapConfig), disabled: !keymapConfig },
          { label: "导入方案", onClick: () => fileInputRef.current?.click() },
          { 
            label: "删除当前方案", 
            onClick: () => {
              if (keymapConfig) {
                deleteKeymapFromStore(keymapConfig.id);
                setKeymapConfig(null);
                notify({ title: "方案已删除", message: "方案已从存储中移除", type: "success" });
              }
            }, 
            disabled: !keymapConfig, 
            destructive: true 
          },
        ]
      },
    { 
        icon: Command, 
        label: "快捷键", 
        dropdown: [
            { label: "Ctrl + C", onClick: () => sendHotkey(['ctrl', 'c']) },
            { label: "Ctrl + V", onClick: () => sendHotkey(['ctrl', 'v']) },
            { label: "Ctrl + Alt + Del", onClick: () => sendHotkey(['ctrl', 'alt', 'del']) },
            { label: "Win + D", onClick: () => sendHotkey(['win', 'd']) },
            { label: "Alt + Tab", onClick: () => sendHotkey(['alt', 'tab']) },
            { label: "Alt + F4", onClick: () => sendHotkey(['alt', 'f4']) },
        ]
    },
    { icon: listenAudio ? Volume2 : VolumeX, label: listenAudio ? "关闭电脑音频" : "监听电脑音频", active: listenAudio, onClick: () => {
        const newState = !listenAudio;
        setListenAudio(newState);
        sendCommand(device.id, device.password || "", 'audio', { action: newState ? 'start_listen' : 'stop_listen' });
    } },
    { icon: speakAudio ? Mic : MicOff, label: speakAudio ? "结束通话" : "麦克风通话", active: speakAudio, onClick: () => setSpeakAudio(!speakAudio) },
    { icon: Camera, label: "截图", onClick: () => {
        sendCommand(device.id, device.password || "", 'screen', { action: 'screenshot' });
    } },
    { icon: ZoomIn, label: "放大", onClick: () => setZoom(prev => Math.min(3, prev + 0.2)), hideOnMobile: true },
    { icon: ZoomOut, label: "缩小", onClick: () => setZoom(prev => Math.max(0.5, prev - 0.2)), hideOnMobile: true },
    { icon: RotateCcw, label: "重置缩放", onClick: () => { setZoom(1); setScrollOffset({ x: 0, y: 0 }); }, hideOnMobile: true },
    { icon: Clipboard, label: "粘贴内容发送至设备", onClick: async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
            sendCommand(device.id, device.password || "", 'clipboard', { action: 'set', data: text });
                notify({
                    title: "剪贴板同步",
                    message: "已将本地剪贴板同步到远程设备",
                    type: "success"
                });
            } else {
                sendCommand(device.id, device.password || "", 'clipboard', { action: 'get' });
            }
        } catch (err) {
            sendCommand(device.id, device.password || "", 'clipboard', { action: 'get' });
        }
    } },
    { icon: Lock, label: "锁定屏幕", onClick: () => {
        sendCommand(device.id, device.password || "", 'exec', 'rundll32.exe user32.dll,LockWorkStation');
        notify({
            title: "指令已发送",
            message: "正在尝试锁定远程屏幕",
            type: "success"
        });
    } },
    { icon: MonitorOff, label: "隐私屏", active: privacyScreen, onClick: () => {
        if (!privacyScreen) {
            setShowPrivacyDialog(true);
        } else {
            setPrivacyScreen(false);
            sendCommand(device.id, device.password || "", 'privacy_screen', { action: 'stop' });
        }
    } },
    { 
      id: "performance",
      icon: Activity, 
      label: "性能监控", 
      active: showPerformance, 
      onClick: () => setShowPerformance(!showPerformance),
      className: cn("w-auto px-2 gap-1.5", latency !== null && "text-xs font-medium")
    },
    {
      icon: Settings,
      label: "画面设置",
      hideOnPC: true,
      dropdown: [
        { label: "分辨率: 90%", onClick: () => setStreamScale([0.9]), keepOpen: true, active: streamScale[0] === 0.9 },
        { label: "分辨率: 80%", onClick: () => setStreamScale([0.8]), keepOpen: true, active: streamScale[0] === 0.8 },
        { label: "分辨率: 70%", onClick: () => setStreamScale([0.7]), keepOpen: true, active: streamScale[0] === 0.7 },
        { label: "分辨率: 60%", onClick: () => setStreamScale([0.6]), keepOpen: true, active: streamScale[0] === 0.6 },
        { label: "分辨率: 50%", onClick: () => setStreamScale([0.5]), keepOpen: true, active: streamScale[0] === 0.5 },
        { label: "帧率: 150 FPS", onClick: () => setTargetFps([150]), keepOpen: true, active: targetFps[0] === 150 },
        { label: "帧率: 60 FPS", onClick: () => setTargetFps([60]), keepOpen: true, active: targetFps[0] === 60 },
        { label: "帧率: 30 FPS", onClick: () => setTargetFps([30]), keepOpen: true, active: targetFps[0] === 30 },
        { label: "帧率: 15 FPS", onClick: () => setTargetFps([15]), keepOpen: true, active: targetFps[0] === 15 },
        { label: "画质: 90%", onClick: () => setQuality([90]), keepOpen: true, active: quality[0] === 90 },
        { label: "画质: 80%", onClick: () => setQuality([80]), keepOpen: true, active: quality[0] === 80 },
        { label: "画质: 50%", onClick: () => setQuality([50]), keepOpen: true, active: quality[0] === 50 },
        { label: "画质: 30%", onClick: () => setQuality([30]), keepOpen: true, active: quality[0] === 30 },
        { label: compress ? "Zlib 压缩: 开启" : "Zlib 压缩: 关闭", onClick: () => setCompress(!compress), keepOpen: true, active: compress },
        { label: useWebP ? "WebP 编码: 开启" : "WebP 编码: 关闭", onClick: () => setUseWebP(!useWebP), keepOpen: true, active: useWebP }
      ]
    },
    { icon: Power, label: "电源", destructive: true, dropdown: [
        { label: "关机", destructive: true, onClick: () => {
            setPowerConfirm({
                show: true,
                type: 'shutdown',
                label: '关机',
                command: 'shutdown /s /t 0'
            });
        }},
        { label: "重启", destructive: true, onClick: () => {
            setPowerConfirm({
                show: true,
                type: 'restart',
                label: '重启',
                command: 'shutdown /r /t 0'
            });
        }},
        { label: "睡眠", onClick: () => {
            setPowerConfirm({
                show: true,
                type: 'sleep',
                label: '睡眠',
                command: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'
            });
        }}
    ]},
  ].filter(Boolean) as any[]

  return (
    <EditorProvider 
      value={keymapConfig} 
      onChange={setKeymapConfig}
      isEditing={isEditingKeymap}
      isDraggingNode={isDraggingNode}
      setIsDraggingNode={setIsDraggingNode}
      selectedNodeId={selectedNodeId}
      onSelectNode={setSelectedNodeId}
      showProperties={showKeymapProperties}
      onShowPropertiesChange={setShowKeymapProperties}
      executingNodeId={executingNodeId}
      setExecutingNodeId={setExecutingNodeId}
      onNodeAction={handleKeymapAction}
    >
    <div 
      ref={rootRef} 
      className={cn(
        "flex flex-col bg-background",
        isLandscape 
          ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 origin-center rotate-90 z-50" 
          : "h-full w-full relative"
      )}
      style={isLandscape ? {
        width: '100vh',
        height: '100vw'
      } : {}}
    >
      {/* Header bar */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0",
        isLandscape && "hidden"
      )}>
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            
            <div className=" flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-success/10 text-success text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow text-success" />
              实时连接
            </div>
            <div className={cn(
              " flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium",
              webrtcState === 'connected' ? "bg-purple-500/10 text-purple-500" : "bg-muted text-muted-foreground"
            )}>
              {webrtcState === 'connected' 
                ? `WebRTC (${connectionType === 'internal' ? '内网' : '外网'})` 
                : "WebSocket"}
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-muted-foreground hover:text-foreground" 
                    onClick={handleRefresh}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card text-card-foreground border-border">
                  刷新连接
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {listenAudio && (
              <div className={cn(
                " flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors",
                isReceivingAudio ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
              )}>
                <Volume2 className={cn("h-3 w-3", isReceivingAudio && "animate-pulse")} />
                {isReceivingAudio ? "正在接收音频" : "等待音频数据..."}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden md:flex items-center gap-2 mr-3 text-xs text-muted-foreground">
              <span>分辨率: {originalSize ? `${originalSize.width}x${originalSize.height}` : '等待数据...'}</span>
              <span className="text-border">|</span>
              <span>缩放: {Math.round(zoom * 100)}%</span>
              <span className="text-border">|</span>
              <span>{fps} FPS</span>
              <span className="text-border">|</span>
              <span>画质 {quality}%</span>
              <span className="text-border">|</span>
              <span>延迟 {latency !== null ? `${latency}ms` : '--ms'}</span>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                    onClick={() => {
                      const next = !isLandscape;
                      setIsLandscape(next);
                      if (next) setFullscreen(false);
                    }}
                  >
                    <Smartphone className={cn("h-3.5 w-3.5 transition-transform duration-300", isLandscape ? "rotate-90" : "rotate-0")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card text-card-foreground border-border">
                  {isLandscape ? "切换竖屏" : "切换横屏 (不支持全屏)"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                    onClick={() => {
                      const next = !fullscreen;
                      setFullscreen(next);
                      if (next) setIsLandscape(false);
                    }}
                  >
                    {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card text-card-foreground border-border">
                  {fullscreen ? "退出全屏" : "全屏 (不支持横屏)"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

      {/* Toolbar */}
      {!isActualMobile && (
        <div 
          className={cn(
            "flex items-center gap-1 px-4 py-1.5 border-b border-border bg-card/50 overflow-x-auto shrink-0",
            isLandscape && "fixed top-0 left-0 right-0 z-[60] bg-background/80 backdrop-blur-md"
          )}
        >
          <TooltipProvider delayDuration={0}>
            {toolbarActions.filter(action => !action.hideOnPC).map((action, i) => (
              action.dropdown ? (
                <DropdownMenu 
                  key={i}
                  open={openDropdownIdx === i} 
                  onOpenChange={(open) => setOpenDropdownIdx(open ? i : null)}
                >
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title={action.label}
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onPointerDown={(e) => {
                        if (e.pointerType === 'touch') {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownIdx(prev => prev === i ? null : i);
                      }}
                    >
                      <action.icon className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {action.dropdown.map((item, j) => (
                      <DropdownMenuItem 
                        key={j} 
                        onClick={(e) => {
                          e.stopPropagation();
                          item.onClick();
                          setOpenDropdownIdx(null);
                        }}
                        className={cn(item.destructive && "text-destructive focus:text-destructive")}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size={action.id === "performance" ? "default" : "icon"}
                    className={cn(
                      "relative h-7 shrink-0 transition-all",
                      action.id !== "performance" ? "w-7" : "min-w-[45px]",
                      action.active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
                      action.destructive && "hover:text-destructive",
                      (action as any).className
                    )}
                    onClick={action.onClick}
                    disabled={(action as any).disabled}
                  >
                    <action.icon className="h-3.5 w-3.5" />
                    {action.id === "performance" && latency !== null && (
                      <span className="text-[10px] font-medium opacity-80 tabular-nums ml-0.5">
                        {latency}ms
                      </span>
                    )}
                    {(action as any).badge !== undefined && (typeof (action as any).badge === 'number' ? (action as any).badge > 0 : (action as any).badge !== '') && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                        {typeof (action as any).badge === 'number' ? ((action as any).badge > 99 ? '99+' : (action as any).badge) : (action as any).badge}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-card text-card-foreground border-border">
                  {action.label}
                </TooltipContent>
              </Tooltip>
              )
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-4 px-2">
              <div className="flex items-center gap-3 border-r border-border/50 pr-4 mr-1">
                <div className="flex flex-col gap-1 min-w-[100px]">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>帧率: <span className="text-primary font-medium">{targetFps[0]} FPS</span></span>
                  </div>
                  <Slider value={targetFps} onValueChange={setTargetFps} min={5} max={150} step={5} className="h-1" />
                </div>
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>传输画质: <span className="text-primary font-medium">{quality}%</span></span>
                  </div>
                  <Slider value={quality} onValueChange={setQuality} min={1} max={100} step={1} className="h-1" />
                </div>
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>传输分辨率: <span className="text-primary font-medium">{Math.round(streamScale[0] * 100)}%</span></span>
                  </div>
                  <Slider value={streamScale} onValueChange={setStreamScale} min={0.1} max={1.0} step={0.1} className="h-1" />
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3 border-r border-border/50 pr-4">
                <div className="flex items-center gap-1.5">
                  <Switch 
                    checked={compress} 
                    onCheckedChange={setCompress}
                    id="compress-mode"
                    className="scale-75"
                  />
                  <Label htmlFor="compress-mode" className="text-[10px] cursor-pointer text-muted-foreground">Zlib</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch 
                    checked={useWebP} 
                    onCheckedChange={setUseWebP}
                    id="webp-mode"
                    className="scale-75"
                  />
                  <Label htmlFor="webp-mode" className="text-[10px] cursor-pointer text-muted-foreground">WebP</Label>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <div className="text-[10px] font-mono text-muted-foreground min-w-[32px] text-center">
                  {Math.round(zoom * 100)}%
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => setZoom(Math.min(3, zoom + 0.2))}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </TooltipProvider>
        </div>
      )}
      
      {/* Remote screen area */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-background flex items-center justify-center outline-none cursor-none touch-none select-none" 
        tabIndex={0}
        onClick={(e) => {
            if (keyboardMode) {
                e.currentTarget.focus();
            }
        }}
        onKeyDown={(e) => {
          if (!keyboardMode) return
          e.preventDefault()
          if (e.repeat) {
            sendInput('keypress', { key: getPyautoguiKey(e.key) })
          } else {
            sendInput('keydown', { key: getPyautoguiKey(e.key) })
          }
        }}
        onKeyUp={(e) => {
          if (!keyboardMode) return
          e.preventDefault()
          sendInput('keyup', { key: getPyautoguiKey(e.key) })
        }}
        onMouseDown={(e) => {
          if (isDraggingNode) return;
          if (e.button === 1 || (e.button === 0 && e.altKey)) { 
            setIsDragging(true)
            setDragStart({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseMove={(e) => {
          if (isDraggingNode) return;
          if (isDragging) {
            let dx = e.clientX - dragStart.x
            let dy = e.clientY - dragStart.y
            if (isLandscape) {
              const temp = dx;
              dx = dy;
              dy = -temp;
            }
            setScrollOffset(prev => getBoundedScrollOffset(prev.x + dx, prev.y + dy, zoom))
            setDragStart({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseUp={() => {
          setIsDragging(false);
        }}
        onMouseLeave={() => {
          setIsDragging(false);
        }}
        onTouchStart={(e) => {
          if (isDraggingNode) return;

          // Identify which touch to use for panning/aiming
          // If we don't have an active touch, use the one that just started
          if (activeTouchIdRef.current === null) {
             const touch = e.changedTouches[0];
             activeTouchIdRef.current = touch.identifier;
             
             setIsPanning(true)   
             setDragStart({ x: touch.clientX, y: touch.clientY })
             lastTouchTime.current = Date.now()
             isLongPressActive.current = false;
             if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
             
             // Handle Crosshair click mode
             if (crosshairNode && crosshairNode.mode === 'click') {
                const targetX = crosshairNode.targetX ?? crosshairNode.x;
                const targetY = crosshairNode.targetY ?? crosshairNode.y;
                const remoteX = Math.round((targetX / 100) * (originalSize?.width || 1920));
                const remoteY = Math.round((targetY / 100) * (originalSize?.height || 1080));
                
                sendInput('mousedown', { 
                  x: remoteX, 
                  y: remoteY, 
                  button: crosshairNode.button || 'left' 
                });
             }

             // Only set long press timer if NOT in crosshair mode
             if (!crosshairNode) {
               longPressTimerRef.current = setTimeout(() => {
                  isLongPressActive.current = true;
                  setShowTextInput(true);
               }, 600);
             }
          } else if (e.touches.length === 2 && !(!isEditingKeymap && !!crosshairNode)) { // Disable multi-touch if crosshair active
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            setIsDragging(true)
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            )
            setTouchStartDist(dist)
            setTouchStartZoom(zoom)
            setIsPanning(true)
          }
        }}
        onTouchMove={(e) => {
          if (isDraggingNode) return;
          
          // 1. Handle Zoom (Priority: 2 fingers on canvas, no active crosshair)
          // Only disable zoom if we are NOT editing AND there is a crosshair configured
          const isCrosshairActive = !isEditingKeymap && !!crosshairNode;
          if (e.touches.length === 2 && !isCrosshairActive) {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
              const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
              )
              const newZoom = touchStartZoom * (dist / touchStartDist)
              setZoom(Math.min(3, Math.max(0.5, newZoom)))
              // If we are zooming, we don't handle panning/aiming in the same frame
              return;
          }
          
          // 2. Handle Panning/Aiming (Active touch tracking)
          const touch = Array.from(e.touches).find(t => t.identifier === activeTouchIdRef.current);
          
          if (touch && isPanning) {
                let dx = touch.clientX - dragStart.x
                let dy = touch.clientY - dragStart.y

                // Crosshair mode: relative mouse move instead of panning
                if (crosshairNode) {
                    if (isLandscape) {
                      const temp = dx;
                      dx = dy;
                      dy = -temp;
                    }
                    
                    const sensitivity = (crosshairNode.sensitivity || 100) / 100;
                    sendInput('mousestep', { 
                        dx: Math.round(dx * sensitivity), 
                        dy: Math.round(dy * sensitivity) 
                    });
                    
                    setDragStart({ x: touch.clientX, y: touch.clientY });
                    return;
                }

                if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    setIsDragging(true)
                }
                if (isDragging) {
                    if (isLandscape) {
                      const temp = dx;
                      dx = dy;
                      dy = -temp;
                    }
                    setScrollOffset(prev => getBoundedScrollOffset(prev.x + dx, prev.y + dy, zoom))
                    setDragStart({ x: touch.clientX, y: touch.clientY })
                }
          }
        }}
        onTouchEnd={(e) => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }

            // Check if our active touch ended
            const endedTouch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchIdRef.current);

            if (endedTouch) {
                activeTouchIdRef.current = null;
                setIsPanning(false)
                setIsDragging(false)

                // Handle Crosshair release
                if (crosshairNode) {
                    // 1. If click mode, release the button at CURRENT position (don't send coordinates)
                    if (crosshairNode.mode === 'click') {
                        sendInput('mouseup', { 
                            button: crosshairNode.button || 'left' 
                        });
                    }
                    
                    // 2. Then move back to origin (Commented out based on user request to stay at aim position)
                    /*
                    const targetX = crosshairNode.targetX ?? crosshairNode.x;
                    const targetY = crosshairNode.targetY ?? crosshairNode.y;
                    const remoteX = Math.round((targetX / 100) * (originalSize?.width || 1920));
                    const remoteY = Math.round((targetY / 100) * (originalSize?.height || 1080));
                    sendInput('mousemove', { x: remoteX, y: remoteY });
                    */
                }
            }

            if (!crosshairNode && !isDragging && endedTouch && e.touches.length === 0) {
                const now = Date.now()
                if (!isLongPressActive.current && now - lastTouchTime.current < 500) { // Click threshold
                    if (showTextInput) setShowTextInput(false);

                    if (canvasRef.current) {
                        const rect = canvasRef.current.getBoundingClientRect()
                        const touch = endedTouch;
                        
                        let x = touch.clientX - rect.left
                        let y = touch.clientY - rect.top
                        let rectW = rect.width
                        let rectH = rect.height
                        
                        if (isLandscape) {
                            x = touch.clientY - rect.top
                            y = rect.right - touch.clientX
                            rectW = rect.height
                            rectH = rect.width
                        }
                        
                        if (x >= 0 && x <= rectW && y >= 0 && y <= rectH) {
                            const targetWidth = originalSize?.width || canvasRef.current.width
                            const targetHeight = originalSize?.height || canvasRef.current.height
                            
                            let realX = Math.round((x / rectW) * targetWidth)
                            let realY = Math.round((y / rectH) * targetHeight)

                            if (mouseMode) {
                                sendInput('mousemove', { x: realX, y: realY })
                                
                                // Coordinate correction for double-click precision
                                const clickGap = now - lastClickTime.current;
                                if (clickGap < 500 && lastTouchPos.current) {
                                    const dist = Math.hypot(realX - lastTouchPos.current.x, realY - lastTouchPos.current.y);
                                    if (dist < 10) {
                                        // It's a double click! Send the optimized doubleclick command
                                        sendInput('doubleclick', { x: lastTouchPos.current.x, y: lastTouchPos.current.y, button: 'left' })
                                        lastClickTime.current = 0; // Reset to avoid triple-click being double-click
                                        return;
                                    }
                                }
                                
                                // Regular tap -> send optimized atomic click command
                                lastClickTime.current = now;
                                lastTouchPos.current = { x: realX, y: realY };
                                sendInput('click', { x: realX, y: realY, button: 'left' })
                            }
                        }
                    }
                }
            }
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault()
            const delta = e.deltaY > 0 ? -0.1 : 0.1
            setZoom(prev => Math.min(3, Math.max(0.5, prev + delta)))
          }
        }}
      >
        <StreamScreen
          ref={screenRef}
          canvasRef={canvasRef}
          containerRef={containerRef}
          device={device}
          mode={mode}
          targetId={targetId}
          quality={quality[0]}
          streamScale={streamScale[0]}
          compress={compress}
          useWebP={useWebP}
          targetFps={targetFps[0]}
          listenAudio={listenAudio}
          speakAudio={speakAudio}
          setSpeakAudio={setSpeakAudio}
          mouseMode={mouseMode}
          interactionMode={interactionMode}
          keyboardMode={keyboardMode}
          useInterception={useInterception}
          isLandscape={isLandscape}
          zoom={zoom}
          setZoom={setZoom}
          scrollOffset={scrollOffset}
          setScrollOffset={setScrollOffset}
          onFpsChange={setFps}
          onLatencyChange={setLatency}
          onOriginalSizeChange={setOriginalSize}
          onWebrtcStateChange={setWebrtcState}
          onConnectionTypeChange={setConnectionType}
          onIsLockedChange={setIsLocked}
          onHasInterceptionChange={setHasInterception}
          onCursorStyleChange={setCursorStyle}
          onReceivingAudioChange={setIsReceivingAudio}
          onRtcMessage={setRtcMessage}
          onBack={onBack}
          onFileDrop={handleDrop}
          isEditingKeymap={isEditingKeymap}
          showVirtualMouse={showVirtualMouse}
          virtualMousePos={virtualMousePos}
          getVirtualMouseHotspot={getVirtualMouseHotspot}
          cursorStyle={cursorStyle}
          imageSrc={imageSrc}
          setImageSrc={setImageSrc}
          showPerformance={showPerformance}
          onPerformanceData={(data) => {
            const now = Date.now()
            if (prevPerformanceRef.current) {
              const timeDiff = (now - prevTimeRef.current) / 1000
              if (timeDiff > 0) {
                setPerformanceSpeed({
                  net_sent_speed: Math.max(0, (data.net_sent - prevPerformanceRef.current.net_sent) / timeDiff),
                  net_recv_speed: Math.max(0, (data.net_recv - prevPerformanceRef.current.net_recv) / timeDiff),
                })
              }
            }
            prevPerformanceRef.current = data
            prevTimeRef.current = now
            setPerformance(data)
          }}
        />

        {/* Keymap Layers - Fixed relative to control window container */}
          { (isEditingKeymap || (!isEditingKeymap && keymapConfig)) && (
             <div className={cn(
               "absolute inset-0 z-[40]",
               isEditingKeymap ? "pointer-events-auto" : "pointer-events-none"
             )}>
               <KeymapCanvas />
             </div>
          )}
          
          {/* Floating Virtual Mouse Button (Mobile) */}
          {isMobile && !showVirtualMouse && (
            <Button
              className="absolute top-4 right-4 w-[60px] h-[60px] rounded-full shadow-lg z-50 bg-primary/90 backdrop-blur pointer-events-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowVirtualMouse(true);
                setMouseMode(true); 
              }}
            >
              <MousePointer2 className={cn("h-8 w-8 text-white", isLandscape && "rotate90")} />
            </Button>
          )}

          {/* Virtual Mouse (Integrated) */}
          {showVirtualMouse && (
            <div 
              className={cn(
                "absolute z-50 flex flex-col items-start touch-none scale-[0.75] origin-top-left",
                isLandscape && "rotate90"
              )}
              style={{ 
                left: virtualMousePos.x, 
                top: virtualMousePos.y,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerCancel={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onTouchCancel={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              {/* Cursor Arrow */}
              <div 
                className={cn(
                  "absolute left-0 top-0 pointer-events-none z-50 -translate-x-[2px] -translate-y-[2px]",
                  isLandscape && "-rotate90"
                )}
              >
                {cursorStyle === 'text' ? (
                    <div className="w-1 h-6 bg-black border border-white shadow-sm" />
                ) : cursorStyle === 'wait' || cursorStyle === 'progress' ? (
                    <RotateCcw className="h-6 w-6 text-white animate-spin drop-shadow-md" />
                ) : cursorStyle === 'pointer' ? (
                    <Hand className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] fill-blue-500" />
                ) : cursorStyle === 'crosshair' ? (
                    <Crosshair className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                ) : cursorStyle === 'help' ? (
                    <HelpCircle className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] fill-blue-500" />
                ) : cursorStyle === 'move' ? (
                    <Move className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                ) : cursorStyle === 'ns-resize' || cursorStyle === 'row-resize' || cursorStyle === 'n-resize' || cursorStyle === 's-resize' ? (
                    <ArrowUpDown className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                ) : cursorStyle === 'ew-resize' || cursorStyle === 'col-resize' || cursorStyle === 'e-resize' || cursorStyle === 'w-resize' ? (
                    <ArrowLeftRight className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                ) : cursorStyle === 'nwse-resize' || cursorStyle === 'nw-resize' || cursorStyle === 'se-resize' ? (
                    <ArrowUpDown className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] -rotate-45" />
                ) : cursorStyle === 'nesw-resize' || cursorStyle === 'ne-resize' || cursorStyle === 'sw-resize' ? (
                    <ArrowUpDown className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] rotate-45" />
                ) : (
                    <MousePointer2 className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] fill-black" />
                )}
              </div>

              {/* Close Button */}
              <button 
                className="absolute -top-3 -right-3 bg-[#2A2A2A] rounded-full p-1.5 text-white hover:bg-[#404040] z-50 shadow-lg border border-white/10"
                onClick={() => setShowVirtualMouse(false)}
              >
                <X className="h-4 w-4" />
              </button>

              {/* Mouse Body */}
              <div 
                className={cn(
                  "bg-[#9E9E9E]/60 backdrop-blur-md rounded-[2rem] border-2 border-white/30 shadow-2xl overflow-hidden relative opacity-90 transition-all duration-300",
                  "w-40 h-52 flex flex-col mt-6 ml-6"
                )}
              >
                
                {/* Top Half: L/R Buttons & Scroll */}
                <div 
                  className={cn(
                    "relative border-white/30",
                    "h-[50%] border-b-2 flex flex-row"
                  )}
                >
                  {/* Left Button */}
                  <div 
                    className="flex-1 active:bg-black/10 transition-colors"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      
                      if (mouseMode) {
                        const now = Date.now();
                        const hotspot = getVirtualMouseHotspot();
                        let pos = getRealPos(hotspot.x, hotspot.y);

                        // Coordinate correction for double-click precision
                        const clickGap = now - lastClickTime.current;
                        if (clickGap < 500 && lastTouchPos.current) {
                            const dist = Math.hypot(pos.x - lastTouchPos.current.x, pos.y - lastTouchPos.current.y);
                            if (dist < 10) {
                                pos = lastTouchPos.current;
                            }
                        }
                        // Note: we don't update lastClickTime here because it's only down, 
                        // and we don't want to break the gap for the up event.
                        // But we use the corrected pos.

                        sendInput('mousemove', { x: pos.x, y: pos.y });
                        sendInput('mousedown', { x: pos.x, y: pos.y, button: 'left' });
                      }
                      
                      setIsDraggingVMouse(true);
                      vMouseDragOffset.current = {
                        x: e.clientX,
                        y: e.clientY
                      };
                    }}
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (isDraggingVMouse) {
                        let dx = e.clientX - vMouseDragOffset.current.x;
                        let dy = e.clientY - vMouseDragOffset.current.y;
                        if (isLandscape) {
                          const temp = dx;
                          dx = dy;
                          dy = -temp;
                        }
                        
                        setVirtualMousePos(prev => ({
                          x: prev.x + dx,
                          y: prev.y + dy
                        }));
                        
                        vMouseDragOffset.current = {
                          x: e.clientX,
                          y: e.clientY
                        };
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      setIsDraggingVMouse(false);
                      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(e) {}
                      
                      if (mouseMode) {
                        const now = Date.now();
                        const hotspot = getVirtualMouseHotspot();
                        let pos = getRealPos(hotspot.x, hotspot.y);

                        // Coordinate correction for double-click precision
                        const clickGap = now - lastClickTime.current;
                        if (clickGap < 500 && lastTouchPos.current) {
                            const dist = Math.hypot(pos.x - lastTouchPos.current.x, pos.y - lastTouchPos.current.y);
                            if (dist < 10) {
                                pos = lastTouchPos.current;
                            }
                        }
                        lastClickTime.current = now;
                        lastTouchPos.current = pos;

                        sendInput('mouseup', { x: pos.x, y: pos.y, button: 'left' });
                      }
                    }}
                  />
                  
                  {/* Right Button */}
                  <div 
                    className={cn(
                      "flex-1 active:bg-black/10 transition-colors border-white/30",
                      isLandscape ? "border-t-2" : "border-l-2"
                    )}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      
                      if (mouseMode) {
                        const hotspot = getVirtualMouseHotspot();
                        const pos = getRealPos(hotspot.x, hotspot.y);
                        sendInput('mousemove', { x: pos.x, y: pos.y });
                        sendInput('mousedown', { x: pos.x, y: pos.y, button: 'right' });
                      }
                      
                      setIsDraggingVMouse(true);
                      vMouseDragOffset.current = {
                        x: e.clientX,
                        y: e.clientY
                      };
                    }}
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (isDraggingVMouse) {
                        let dx = e.clientX - vMouseDragOffset.current.x;
                        let dy = e.clientY - vMouseDragOffset.current.y;
                        if (isLandscape) {
                          const temp = dx;
                          dx = dy;
                          dy = -temp;
                        }
                        
                        setVirtualMousePos(prev => ({
                          x: prev.x + dx,
                          y: prev.y + dy
                        }));
                        
                        vMouseDragOffset.current = {
                          x: e.clientX,
                          y: e.clientY
                        };
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      setIsDraggingVMouse(false);
                      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(e) {}
                      
                      if (mouseMode) {
                        const hotspot = getVirtualMouseHotspot();
                        const pos = getRealPos(hotspot.x, hotspot.y);
                        sendInput('mouseup', { x: pos.x, y: pos.y, button: 'right' });
                      }
                    }}
                  />

                  {/* Scroll Wheel (Clock Style) */}
                  <div 
                    className="absolute bg-[#B0B0B0] rounded-full border-2 border-white/30 flex items-center justify-center touch-none shadow-inner z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12"
                    onPointerDown={(e) => {
                      if (!mouseMode) return;
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setShowClockScroll(true);
                      setClockScrollCenter({ x: e.clientX, y: e.clientY });
                      setScrollAngle(null); // Reset angle
                      setPointerPos({ x: 0, y: 0 });
                    }}
                    onPointerMove={(e) => {
                      if (!mouseMode) return;
                      e.stopPropagation();
                      if (showClockScroll && e.buttons > 0) {
                        let dx = e.clientX - clockScrollCenter.x;
                        let dy = e.clientY - clockScrollCenter.y;
                        
                        if (isLandscape) {
                          const temp = dx;
                          dx = dy;
                          dy = -temp;
                        }
                        
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const radius = 96;
                        const activationRadius = 40; // Only activate scroll when moved outside this
                        
                        let newAngle = Math.atan2(dy, dx);
                        let newPointerPos = { x: dx, y: dy };
                        
                        // If within activation radius, keep in center
                        if (dist < activationRadius) {
                          newPointerPos = { x: 0, y: 0 };
                          setPointerPos(newPointerPos);
                          setScrollAngle(null); // Not active
                          return;
                        }
                        
                        // If outside, snap to edge
                        newPointerPos = { 
                          x: Math.cos(newAngle) * radius, 
                          y: Math.sin(newAngle) * radius 
                        };
                        
                        setPointerPos(newPointerPos);
                        
                        if (scrollAngle !== null) {
                          let diff = newAngle - scrollAngle;
                          if (diff > Math.PI) diff -= 2 * Math.PI;
                          if (diff < -Math.PI) diff += 2 * Math.PI;

                          // Reduced sensitivity: scroll based on angle change with larger threshold
                          if (Math.abs(diff) > 0.5) { 
                            const dy = Math.sign(diff) * 5; 
                            sendInput('scroll', { dx: 0, dy });
                            setScrollAngle(newAngle);
                          }
                        } else {
                          setScrollAngle(newAngle);
                        }
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      setShowClockScroll(false);
                      setScrollAngle(null);
                      setPointerPos({ x: 0, y: 0 });
                      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(e) {}
                    }}
                  >
                    <div className="w-3 h-3 rounded-full bg-white/50 shadow-[0_0_8px_1px_rgba(255,255,255,0.5)]" />
                  </div>
                </div>

                {/* Bottom Half / Right Half: Drag Area */}
                <div 
                  className={cn(
                    "flex-1 flex items-center justify-center touch-none active:bg-black/5 transition-colors cursor-move",
                    isLandscape ? "pl-2 pr-6" : "pb-4 pt-2"
                  )}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setIsDraggingVMouse(true);
                    vMouseDragOffset.current = {
                      x: e.clientX,
                      y: e.clientY
                    };
                  }}
                  onPointerMove={(e) => {
                      e.stopPropagation();
                      if (isDraggingVMouse) {
                        let dx = e.clientX - vMouseDragOffset.current.x;
                        let dy = e.clientY - vMouseDragOffset.current.y;
                        if (isLandscape) {
                          const temp = dx;
                          dx = dy;
                          dy = -temp;
                        }
                        
                        setVirtualMousePos(prev => ({
                          x: prev.x + dx,
                          y: prev.y + dy
                        }));
                        
                        vMouseDragOffset.current = {
                          x: e.clientX,
                          y: e.clientY
                        };
                      }
                    }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    setIsDraggingVMouse(false);
                    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(e) {}
                  }}
                >
                  {/* Drag Handle Dots */}
                  <div className={cn(
                    "grid gap-2 opacity-40",
                    isLandscape ? "grid-rows-4 grid-flow-col" : "grid-cols-4"
                  )}>
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="w-2 h-2 bg-black rounded-full" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clock Scroll Overlay */}
          {showClockScroll && (
            <div
              className={cn(
                "fixed z-[100] w-48 h-48 rounded-full border-4 border-gray-400 bg-gray-300/60 backdrop-blur-md pointer-events-none flex items-center justify-center animate-in fade-in zoom-in duration-200 opacity-80",
                isLandscape && "-rotate-90"
              )}
              style={isLandscape ? {
                left: clockScrollCenter.y - 96,
                top: window.innerWidth - clockScrollCenter.x - 96
              } : { 
                left: clockScrollCenter.x - 96, 
                top: clockScrollCenter.y - 96 
              }}
            >
              {/* Tick marks */}
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-1 h-3 bg-gray-500" 
                  style={{ transform: `rotate(${i * 30}deg) translateY(-80px)` }} 
                />
              ))}
              
              {/* Pointer Circle */}
              {scrollAngle !== null && (
                <div 
                  className="absolute w-full h-full pointer-events-none flex items-center justify-center"
                  style={{ transform: `translate(${pointerPos.x}px, ${pointerPos.y}px)` }}
                >
                  <div className="w-8 h-8 rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.8)] border-2 border-gray-400" />
                </div>
              )}
              
              {/* Center Dot */}
              <div className="w-4 h-4 rounded-full bg-gray-600 z-20" />
            </div>
          )}

          {!mouseMode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={cn(
                  "bg-background/40 backdrop-blur-[1px] px-4 py-2 rounded-full border border-border/50 flex items-center gap-2 text-muted-foreground animate-in fade-in zoom-in duration-300",
                  isLandscape && "-rotate-90"
                )}>
                  <Lock className="h-4 w-4" />
                  <span className="text-xs font-medium">控制已锁定</span>
                </div>
              </div>
          )}

          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center z-40">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
              <div className={cn(
                "relative bg-background/90 backdrop-blur-md p-6 rounded-2xl border shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center animate-in fade-in zoom-in duration-300",
                isLandscape && "-rotate-90"
              )}>
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">当前屏幕或已锁定</h3>
                  <p className="text-xs text-muted-foreground">请尝试解锁以继续操作</p>
                </div>
                <Button 
                  onClick={() => setShowUnlockDialog(true)}
                  className="w-full rounded-xl"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  尝试解锁
                </Button>
              </div>
            </div>
          )}

        {!imageSrc && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                <RotateCcw className="h-8 w-8 animate-spin opacity-20" />
                <span>正在连接{mode === 'screen' ? '屏幕' : '窗口'}流...</span>
            </div>
          </div>
        )}
        
        {/* Performance Overlay */}
        <div 
          className="absolute top-2 left-2 flex flex-col gap-2 z-50 select-none"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            variant={showPerformance ? "default" : "secondary"}
            size="sm"
            className="h-8 rounded-full shadow-lg opacity-80 hover:opacity-100 flex items-center gap-2 select-none"
            onClick={(e) => {
              e.stopPropagation();
              setShowPerformance(!showPerformance);
            }}
          >
            <Activity className="h-4 w-4" />
            {latency !== null && (
              <span className="text-[10px] font-bold tabular-nums select-none">
                {latency}ms
              </span>
            )}
          </Button>
          
          {showPerformance && performance && (
            <div className="bg-background/90 backdrop-blur-md p-3 rounded-xl border shadow-lg text-xs space-y-2 w-48 animate-in slide-in-from-top-2 fade-in duration-200 select-none">
              <div className="flex justify-between items-center select-none">
                <span className="text-muted-foreground select-none">CPU</span>
                <span className="font-mono select-none">{performance.cpu_percent}%</span>
              </div>
              <div className="flex justify-between items-center select-none">
                <span className="text-muted-foreground select-none">内存</span>
                <span className="font-mono select-none">{performance.mem_percent}%</span>
              </div>
              <div className="h-px bg-border my-1 select-none" />
              <div className="flex justify-between items-center select-none">
                <span className="text-muted-foreground select-none">上传</span>
                <span className="font-mono text-[10px] select-none">{formatSpeed(performanceSpeed.net_sent_speed)}</span>
              </div>
              <div className="flex justify-between items-center select-none">
                <span className="text-muted-foreground select-none">下载</span>
                <span className="font-mono text-[10px] select-none">{formatSpeed(performanceSpeed.net_recv_speed)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Cursor position overlay */}
        <div className={cn(
          "absolute left-2 px-2 py-1 rounded bg-card/80 backdrop-blur-sm text-[10px] font-mono text-muted-foreground border border-border flex items-center gap-2 z-50 transition-all duration-300 select-none",
          isActualMobile ? (
            isLandscape 
              ? "top-1/2 left-2 -translate-y-1/2 -rotate-90" 
              : "bottom-2"
          ) : "bottom-2"
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        >
          <Move className="h-3 w-3" />
          <span className="select-none">{cursorPos.x}, {cursorPos.y}</span>
          
          {isActualMobile && (
            <>
              <div className="w-[1px] h-3 bg-border mx-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !showTextInput;
                  setShowTextInput(next);
                  setRealtimeSyncValue(" ");
                  if (next) {
                    sendInput('type_realtime', { text: "__RESET__" });
                  }
                }}
                className={cn(
                  "flex items-center gap-1 transition-colors",
                  showTextInput ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Keyboard className="h-3 w-3" />
                <span className="text-[9px] font-bold">键盘</span>
              </button>
            </>
          )}
        </div>

        {/* Zoom Controls Overlay */}
        <div 
          className="absolute bottom-2 right-2 flex flex-col items-end gap-2"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Keyboard Text Input Box */}
          {showTextInput && (
            <div className={cn(
              "flex flex-col gap-2 bg-background/90 backdrop-blur-md p-2 rounded-xl border shadow-lg z-50 animate-in slide-in-from-bottom-2 fade-in duration-200",
              isActualMobile ? (
                isLandscape 
                  ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 w-[300px]" 
                  : "fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%]"
              ) : "w-[320px]"
            )}>
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-muted-foreground font-medium">文本输入 (实时同步)</span>
              </div>
              
              {/* Hotkey Shortcuts Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-7 px-2 text-[10px] shrink-0 bg-secondary/50 hover:bg-secondary"
                  onClick={(e) => { e.stopPropagation(); sendHotkey(['enter']); }}
                >
                  Enter
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-7 px-2 text-[10px] shrink-0 bg-secondary/50 hover:bg-secondary"
                  onClick={(e) => { e.stopPropagation(); sendHotkey(['ctrl', 'c']); }}
                >
                  Ctrl+C
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-7 px-2 text-[10px] shrink-0 bg-secondary/50 hover:bg-secondary"
                  onClick={(e) => { e.stopPropagation(); sendHotkey(['ctrl', 'v']); }}
                >
                  Ctrl+V
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-7 px-2 text-[10px] shrink-0 bg-secondary/50 hover:bg-secondary"
                  onClick={(e) => { e.stopPropagation(); sendHotkey(['ctrl', 'a']); }}
                >
                  Ctrl+A
                </Button>
                
                {customHotkeys.map((hk, i) => (
                  <Button 
                    key={i}
                    variant="secondary" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={(e) => { e.stopPropagation(); sendHotkey(hk.keys); }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCustomHotkeys(prev => prev.filter((_, idx) => idx !== i));
                    }}
                  >
                    {hk.label}
                  </Button>
                ))}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 w-7 p-0 shrink-0 border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewHotkeyKeys([]);
                    setIsAddingHotkey(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  ref={hiddenInputRef}
                  type="text"
                  autoFocus
                  value={realtimeSyncValue}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    const oldVal = realtimeSyncValue;
                    
                    // 1. 如果用户清空了所有内容（包括强制空格）
                    if (rawVal === "") {
                      setRealtimeSyncValue(" ");
                      const oldContent = oldVal.startsWith(" ") ? oldVal.substring(1) : oldVal;
                      if (oldContent.length > 0) {
                        sendInput('type_realtime', { text: "" });
                      }
                      return;
                    }

                    // 2. 提取用户实际输入的内容
                    let content = rawVal;
                    if (rawVal.startsWith(" ")) {
                      content = rawVal.substring(1);
                    } else if (rawVal.endsWith(" ") && rawVal.length > 1) {
                      // 处理用户删除前置空格但保留了内容的情况
                      content = rawVal.trim();
                    }

                    // 3. 强制保持输入框有一个前置空格，用于捕捉 Backspace
                    setRealtimeSyncValue(" " + content);

                    // 4. 同步给远程端
                    const oldContent = oldVal.startsWith(" ") ? oldVal.substring(1) : oldVal;
                    if (content !== oldContent) {
                      sendInput('type_realtime', { text: content });
                    }
                  }}
                  placeholder="直接输入，实时同步(支持输入法)..."
                  className="flex-1 bg-background/50 border border-border rounded-md outline-none text-xs px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
                  onPaste={(e) => {
                    e.stopPropagation();
                    const text = e.clipboardData.getData('text');
                    // 只要检测到粘贴事件，就直接通过远程剪贴板进行“复制粘贴”同步，完全避免按键模拟
                    if (text) {
                        e.preventDefault();
                        sendInput('type', { text });
                        // 重置本地实时同步输入框，防止 onChange 再次触发模拟按键逻辑
                        setRealtimeSyncValue(" ");
                        sendInput('type_realtime', { text: "__RESET__" });
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();

                    // Handle Backspace when only the mandatory space is left
                    // This ensures the space is never actually deleted from the DOM,
                    // allowing subsequent backspaces to be caught reliably.
                    if (e.key === 'Backspace' && realtimeSyncValue === " ") {
                      e.preventDefault();
                      sendInput('keypress', { key: 'backspace' });
                      return;
                    }

                    // Prevent deleting the mandatory space if cursor is at the start
                    if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                      e.preventDefault();
                      return;
                    }

                    // Only prevent default for non-text keys that aren't handled by the input field
                    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape' || e.key.startsWith('Arrow')) {
                      e.preventDefault();
                      if (e.repeat) {
                        sendInput('keypress', { key: getPyautoguiKey(e.key) });
                      } else {
                        sendInput('keydown', { key: getPyautoguiKey(e.key) });
                      }
                    }
                  }}
                  onKeyUp={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape' || e.key.startsWith('Arrow')) {
                      e.preventDefault();
                      sendInput('keyup', { key: getPyautoguiKey(e.key) });
                    }
                  }}
                  onKeyPress={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {!isActualMobile && (
            <div className="flex items-center gap-1">
               <Button 
                variant={showTextInput ? "default" : "secondary"}
                size="icon" 
                className="h-8 w-8 rounded-full shadow-lg mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !showTextInput;
                  setShowTextInput(next);
                  // Always reset to a single space when toggling
                  setRealtimeSyncValue(" ");
                  // Send reset command to client to clear LAST_TYPE_STR
                  if (next) {
                    sendInput('type_realtime', { text: "__RESET__" });
                  }
                }}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
               <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 rounded-full shadow-lg"
                onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(0.5, prev - 0.2)); }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="bg-card/80 backdrop-blur-sm px-2 py-1 rounded border border-border text-[10px] font-bold min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </div>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 rounded-full shadow-lg"
                onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(3, prev + 0.2)); }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 rounded-full shadow-lg ml-1"
                onClick={(e) => { e.stopPropagation(); setZoom(1); setScrollOffset({ x: 0, y: 0 }); }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Keymap Editor Overlay - Now restricted to the screen container */}
        {isEditingKeymap && (
          <div 
            className="absolute inset-0 z-[100] pointer-events-none"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Floating Toolbar (Left) */}
          <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-[100] pointer-events-auto">
            <KeymapToolbar />
          </div>

            {/* Floating Properties (Right) - Only show when explicitly triggered */}
            {showKeymapProperties && keymapConfig?.nodes.some((n: any) => n.id === selectedNodeId) && (
              <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-[100] pointer-events-auto max-h-[70vh] sm:max-h-[80vh] overflow-y-auto w-[240px] sm:w-[280px] shadow-2xl">
                <KeymapProperties />
              </div>
            )}

            {/* Top Status Bar */}
            <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto flex flex-col items-center gap-2 sm:gap-3 w-[95%] sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 px-3 sm:px-5 py-2 rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full sm:w-auto">
                <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-none">
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-wider truncate">当前方案</span>
                <input 
                  value={keymapConfig?.name || ""} 
                  onChange={(e) => {
                    const newName = e.target.value;
                    setKeymapConfig((prev: any) => ({ ...prev, name: newName }));
                  }}
                  // 拦截所有可能导致穿透和全局键盘响应的事件
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  // 点击时强制对焦以唤起键盘
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.focus();
                  }}
                  className="bg-slate-800/50 border border-slate-600/50 text-white text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 rounded px-2 py-0.5 -ml-1 w-full transition-all touch-auto select-text"
                  placeholder="输入方案名称..."
                />        
              </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="h-6 sm:h-8 w-px bg-slate-700 mx-0.5 sm:mx-1" />
                  <Button 
                    size="sm" 
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-8 sm:h-9 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm"
                    onClick={() => {
                      saveKeymapToStore(keymapConfig);
                      setIsEditingKeymap(false);
                      notify({ title: "按键方案已保存", message: "配置已应用并保存至本地", type: "success" });
                    }}
                  >
                    保存并退出
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Hotkey Addition Overlay */}
      {isAddingHotkey && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center pointer-events-auto">
          <VirtualKeyboard 
            onKeySelect={handleKeySelectForHotkey}
            onClose={() => {
              setIsAddingHotkey(false);
              setNewHotkeyKeys([]);
            }}
          />
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2001] flex flex-col items-center gap-2 pointer-events-auto">
             <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 px-5 py-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center gap-4 min-w-[300px] animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="flex flex-col items-center w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <Command className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em]">组合键预览</span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2 p-3 bg-slate-950/50 rounded-2xl border border-slate-800 w-full min-h-[48px]">
                    {newHotkeyKeys.length === 0 ? (
                      <span className="text-slate-600 text-xs italic flex items-center gap-2">
                        <Zap className="w-3 h-3 animate-pulse" />
                        请在下方键盘选择按键
                      </span>
                    ) : (
                      newHotkeyKeys.map((k, i) => (
                        <div key={i} className="flex items-center gap-1.5 animate-in zoom-in-95 duration-200">
                          {i > 0 && <span className="text-slate-500 font-bold text-xs">+</span>}
                          <div className="bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] px-3 py-1 rounded-xl text-xs font-black tracking-tight border border-blue-400/30">
                            {k.toUpperCase()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full pt-1">
                  <Button 
                    variant="ghost" 
                    className="flex-1 h-11 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-all"
                    onClick={() => {
                      setIsAddingHotkey(false);
                      setNewHotkeyKeys([]);
                    }}
                  >
                    取消
                  </Button>
                  <Button 
                    className="flex-[2] h-11 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50"
                    disabled={newHotkeyKeys.length === 0}
                    onClick={handleSaveHotkey}
                  >
                    保存组合键
                  </Button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Privacy Screen Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle>开启隐私屏</DialogTitle>
            <DialogDescription>
              开启后，远程设备屏幕将被遮挡，并显示以下文字。您仍可以正常操作。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="privacy-msg">显示文字</Label>
              <Input
                id="privacy-msg"
                value={privacyMessage}
                onChange={(e) => setPrivacyMessage(e.target.value)}
                placeholder="例如：系统维护中..."
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrivacyDialog(false)}>取消</Button>
            <Button onClick={() => {
                setPrivacyScreen(true);
                setShowPrivacyDialog(false);
                sendCommand(device.id, device.password || "", 'privacy_screen', { action: 'start', message: privacyMessage });
                notify({
                    title: "隐私屏已开启",
                    message: "远程物理屏幕已被遮挡",
                    type: "success"
                });
            }}>确认开启</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Power Confirmation Dialog */}
      <Dialog open={powerConfirm.show} onOpenChange={(open) => setPowerConfirm(prev => ({ ...prev, show: open }))}>
        <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className={cn("h-5 w-5", powerConfirm.type === 'sleep' ? "text-blue-500" : "text-destructive")} />
              确认执行 {powerConfirm.label}？
            </DialogTitle>
            <DialogDescription>
              您正在尝试对远程设备执行 {powerConfirm.label} 操作。这可能会导致当前的控制连接立即断开，请确保您已保存所有重要工作。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPowerConfirm(prev => ({ ...prev, show: false }))}>取消</Button>
            <Button 
              variant={powerConfirm.type === 'sleep' ? "default" : "destructive"}
              onClick={() => {
                sendCommand(device.id, device.password || "", 'exec', powerConfirm.command);
                setPowerConfirm(prev => ({ ...prev, show: false }));
                notify({
                    title: "指令已发送",
                    message: `正在尝试执行远程${powerConfirm.label}操作`,
                    type: "info"
                });
            }}>确认执行</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>解锁计算机</DialogTitle>
            <DialogDescription>
              请输入计算机的登录密码，系统将自动尝试解锁屏幕。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                className="col-span-4"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendInput('unlock', { password: unlockPassword });
                    setShowUnlockDialog(false);
                    setUnlockPassword("");
                    notify({
                      title: "正在解锁",
                      message: "已发送解锁指令，请等待序列执行完成",
                      type: "info"
                    });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlockDialog(false)}>取消</Button>
            <Button type="submit" onClick={() => {
              sendInput('unlock', { password: unlockPassword });
              setShowUnlockDialog(false);
              setUnlockPassword("");
              notify({
                title: "正在解锁",
                message: "已发送解锁指令，请等待序列执行完成",
                type: "info"
              });
            }}>确认解锁</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChatPanel 
        device={device} 
        isOpen={showChat} 
        onClose={() => setShowChat(false)} 
        onUnreadChange={setUnreadChatCount} 
        rtcMessage={rtcMessage}
        isLandscape={isLandscape}
      />

      {/* File Upload Progress Overlays */}
      {activeUploads.length > 0 && (
        <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 w-72">
          {activeUploads.map(upload => (
            <div key={upload.id} className="bg-card border border-border rounded-lg p-3 shadow-lg animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium truncate max-w-[180px]">{upload.filename}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{uploadProgress[upload.id] || 0}%</span>
                  <button onClick={() => cancelUpload(upload.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <Progress value={uploadProgress[upload.id] || 0} className="h-1.5" />
            </div>
          ))}
        </div>
      )}
      {isActualMobile && <MobileFloatingMenu actions={toolbarActions} isLandscape={isLandscape} />}

      {/* Hidden File Input for Keymap Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".json" 
        onChange={handleImportKeymap} 
      />
      
      {/* Global Overlays */}
      <KeymapKeyboardOverlay />
    </div>
    </EditorProvider>
  )
}
