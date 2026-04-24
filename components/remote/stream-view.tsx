"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  HelpCircle
} from "lucide-react"
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
import { OpusDecoder } from "opus-decoder"
import { ChatPanel } from "./chat-panel"
import pako from 'pako'

interface StreamViewProps {
  device: DeviceInfo
  mode: "screen" | "window"
  targetId?: number // For window mode
  onBack?: () => void
  title?: string
  subTitle?: string
}

export function StreamView({ device, mode, targetId, onBack, title, subTitle }: StreamViewProps) {
  const { socket, sendCommand, lastMessage, getTurnConfig } = useWebSocket()
  console.log("[StreamView] Component rendered, device:", device.id);
  const { notify } = useNotification()
  const [fullscreen, setFullscreen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [mouseMode, setMouseMode] = useState(true)
  const [useInterception, setUseInterception] = useState(true)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [hasInterception, setHasInterception] = useState<boolean | null>(null)
  const [unlockPassword, setUnlockPassword] = useState("")

  useEffect(() => {
    if (hasInterception === false) {
      setUseInterception(false);
    }
  }, [hasInterception]);
  const [keyboardMode, setKeyboardMode] = useState(true)
  const [quality, setQuality] = useState([50])
  const [streamScale, setStreamScale] = useState([0.8])
  const [compress, setCompress] = useState(true)
  const [useWebP, setUseWebP] = useState(true)
  const [fps, setFps] = useState(0)
  const [latency, setLatency] = useState<number | null>(null)
  const lastPingTimeRef = useRef<number | null>(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [cursorStyle, setCursorStyle] = useState<string>("default")
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [interactionMode, setInteractionMode] = useState<"touch" | "mouse">("touch")
  const [showVirtualMouse, setShowVirtualMouse] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 })
  const [originalSize, setOriginalSize] = useState<{ width: number, height: number } | null>(null)
  
  const [showTextInput, setShowTextInput] = useState(false)
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const [realtimeSyncValue, setRealtimeSyncValue] = useState(" ")
  const [isReceivingAudio, setIsReceivingAudio] = useState(false)
  
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const [privacyScreen, setPrivacyScreen] = useState(false)
  const [privacyMessage, setPrivacyMessage] = useState("系统维护中，请稍候...")
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false)
  
  const [showChat, setShowChat] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null)
  
  // WebRTC state
  const [webrtcState, setWebrtcState] = useState<"connecting" | "connected" | "failed" | "none">("none")
  const [connectionType, setConnectionType] = useState<'internal' | 'external' | null>(null)
  const [reconnectTrigger, setReconnectTrigger] = useState(0)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState("正在连接P2P...")
  const rtcPcRef = useRef<RTCPeerConnection | null>(null)
  const rtcDcRef = useRef<RTCDataChannel | null>(null)
  const [rtcMessage, setRtcMessage] = useState<any>(null)
  
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
  const cancelledUploads = useRef<Set<string>>(new Set())
  
  // WebRTC Setup
  useEffect(() => {
    if (webrtcState === "connected") {
      setLoadingStatus("P2P连接成功");
      const timer = setTimeout(() => setShowLoadingOverlay(false), 800);
      return () => clearTimeout(timer);
    } else if (webrtcState === "failed") {
      setLoadingStatus("P2P连接失败，正在使用WebSocket连接...");
      const timer = setTimeout(() => setShowLoadingOverlay(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [webrtcState]);

  // Timeout for P2P connection
  useEffect(() => {
    if (webrtcState === "connecting") {
      const timer = setTimeout(() => {
        if (webrtcState === "connecting") {
          setLoadingStatus("P2P连接超时，正在使用WebSocket连接...");
          setTimeout(() => setShowLoadingOverlay(false), 1500);
        }
      }, 10000); // 10 seconds timeout
      return () => clearTimeout(timer);
    }
  }, [webrtcState]);

  // WebRTC Setup
  useEffect(() => {
    let pc: RTCPeerConnection | null = null;
    let dc: RTCDataChannel | null = null;

    const initWebRTC = async () => {
      console.log("[StreamView] WebRTC init started");
      try {
        setWebrtcState("connecting");

        // Fetch dynamic TURN config
        let iceServers = [];
        try {
          iceServers = await getTurnConfig(device.id, device.password || "");
          console.log("[WebRTC] Dynamic TURN config received and decrypted");
        } catch (e) {
          console.warn("[WebRTC] Failed to fetch dynamic TURN config, using fallback", e);
          iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
          ];
        }

        pc = new RTCPeerConnection({ iceServers });
        rtcPcRef.current = pc;

        // Create DataChannel
        dc = pc.createDataChannel("stream", {
          ordered: true
        });
        rtcDcRef.current = dc;

        dc.onopen = () => {
          console.log("[WebRTC] DataChannel opened");
          setWebrtcState("connected");
        };

        dc.onclose = () => {
          console.log("[WebRTC] DataChannel closed");
          setWebrtcState("failed");
        };

        dc.onerror = (e) => {
          console.error("[WebRTC] DataChannel error:", e);
          setWebrtcState("failed");
        };

        // Handle incoming messages from DataChannel
        dc.onmessage = async (event) => {
          console.log("[WebRTC] DataChannel onmessage received, data type:", typeof event.data, "size:", event.data.size || event.data.byteLength);
          try {
            if (typeof event.data === 'string') {
                console.log("[WebRTC] Received string message:", event.data.substring(0, 50));
                try {
                    const parsed = JSON.parse(event.data);
                    // Add deviceId if missing, as it's coming from this specific device
                    if (!parsed.deviceId) parsed.deviceId = device.id;
                    setRtcMessage(parsed);
                } catch (e) {
                    console.error("[WebRTC] Failed to parse string message:", e);
                }
            } else {
                // Binary data from Python client
                // The Python client sends: [msg_type] + [metadata_len] + [metadata_bytes] + [frame_data]
                // Note: It does NOT inject id_len and device_id like the server does.
                const arrayBuffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
                const uint8Array = new Uint8Array(arrayBuffer);
                console.log("[WebRTC] Received binary message, length:", uint8Array.length, "first byte:", uint8Array[0]);
                
                if (uint8Array.length > 0) {
                    const msg_type = uint8Array[0];
                    
                    if (msg_type >= 4 && msg_type <= 7) {
                        let dataToParse = uint8Array.slice(1);
                        
                        if (msg_type === 5 || msg_type === 7) {
                            let decompressed: Uint8Array | null = null;
                            try { decompressed = pako.inflate(dataToParse); } catch (e) {}
                            if (!decompressed) { try { decompressed = pako.inflateRaw(dataToParse); } catch (e) {} }
                            if (!decompressed) { try { decompressed = pako.ungzip(dataToParse); } catch (e) {} }
                            if (!decompressed) {
                                try {
                                    const possibleLen = new DataView(dataToParse.buffer, dataToParse.byteOffset, 4).getUint32(0, false);
                                    if (possibleLen > 0 && possibleLen < 100000 && dataToParse[4] === 123) {
                                        const compressedFrame = dataToParse.slice(4 + possibleLen);
                                        let frameDecompressed: Uint8Array | null = null;
                                        try { frameDecompressed = pako.inflate(compressedFrame); } catch(e) {}
                                        if (!frameDecompressed) { try { frameDecompressed = pako.inflateRaw(compressedFrame); } catch(e) {} }
                                        if (!frameDecompressed) { try { frameDecompressed = pako.ungzip(compressedFrame); } catch(e) {} }
                                        if (frameDecompressed) {
                                            decompressed = new Uint8Array(4 + possibleLen + frameDecompressed.length);
                                            decompressed.set(dataToParse.slice(0, 4 + possibleLen), 0);
                                            decompressed.set(frameDecompressed, 4 + possibleLen);
                                        }
                                    }
                                } catch (e) {}
                            }
                            if (decompressed) {
                                dataToParse = decompressed;
                            }
                        }
                        
                        let metadataLen = 0;
                        let metadataBytes = new Uint8Array(0);
                        let frameData = dataToParse;
                        let metadata: any = {};
                        
                        try {
                            if (dataToParse.length > 4) {
                                const possibleLen = new DataView(dataToParse.buffer, dataToParse.byteOffset, 4).getUint32(0, false);
                                if (possibleLen > 0 && possibleLen < 100000 && dataToParse.length >= 4 + possibleLen && dataToParse[4] === 123) {
                                    metadataLen = possibleLen;
                                    metadataBytes = dataToParse.slice(4, 4 + metadataLen);
                                    frameData = dataToParse.slice(4 + metadataLen);
                                    metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
                                }
                            }
                        } catch (e) {
                            console.warn('[WebRTC] Failed to parse metadata', e);
                        }
                        
                        setRtcMessage({
                            type: (msg_type === 6 || msg_type === 7) ? 'window_frame' : 'screen_frame',
                            deviceId: device.id,
                            metadata: metadata,
                            data: frameData,
                            isBinary: true,
                            compressed: msg_type === 5 || msg_type === 7
                        });
                    } else {
                        const data = uint8Array.slice(1);
                        let type = 'unknown';
                        if (msg_type === 1) type = 'screen_frame';
                        else if (msg_type === 2) type = 'audio_data';
                        else if (msg_type === 3) type = 'audio_opus';
                        else if (msg_type === 8) type = 'window_frame';
                        
                        setRtcMessage({
                            type: type,
                            deviceId: device.id,
                            data: data,
                            isBinary: true
                        });
                    }
                }
            }
          } catch (e) {
            console.error("[WebRTC] Error processing message:", e);
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[WebRTC] !!! ICE State changed to:", pc?.iceConnectionState);
          if (pc?.iceConnectionState === "failed" || pc?.iceConnectionState === "disconnected" || pc?.iceConnectionState === "closed") {
            setWebrtcState("failed");
          }
        };

        pc.onicecandidate = (event) => {
          console.log("[WebRTC] ICE Candidate generated:", event.candidate ? "Yes" : event.candidate);
          if (event.candidate) {
            sendCommand(device.id, device.password || "", "webrtc_ice_candidate", {
              candidate: event.candidate.toJSON()
            });
          }
        };

        const offer = await pc.createOffer();
        console.log("[WebRTC] Offer created");
        await pc.setLocalDescription(offer);
        console.log("[WebRTC] Local description set");

        sendCommand(device.id, device.password || "", "webrtc_offer", {
          sdp: pc.localDescription?.sdp
        });
        console.log("[WebRTC] Offer sent to server");

      } catch (e) {
        console.error("[WebRTC] Setup error:", e);
        setWebrtcState("failed");
      }
    };

    initWebRTC();

    return () => {
      if (dc) dc.close();
      if (pc) pc.close();
      rtcPcRef.current = null;
      rtcDcRef.current = null;
      setWebrtcState("none");
    };
  }, [device.id, sendCommand, device.password, reconnectTrigger]);

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
  const audioContextRef = useRef<AudioContext | null>(null)
  const opusDecoderRef = useRef<OpusDecoder | null>(null)
  const [opusReady, setOpusReady] = useState(false)
  const nextPlayTimeRef = useRef<number>(0)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null)

  // Touch handling state
  const [touchStartDist, setTouchStartDist] = useState<number>(0)
  const [touchStartZoom, setTouchStartZoom] = useState<number>(1)
  const [isPanning, setIsPanning] = useState(false)
  const lastTouchTime = useRef<number>(0)
  const lastTouchPos = useRef<{ x: number, y: number } | null>(null)
  const lastClickTime = useRef<number>(0)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressActive = useRef<boolean>(false)

  const [virtualMousePos, setVirtualMousePos] = useState({ x: 100, y: 200 })
  const virtualMousePosRef = useRef(virtualMousePos)
  useEffect(() => {
    virtualMousePosRef.current = virtualMousePos
  }, [virtualMousePos])
  
  const [isDraggingVMouse, setIsDraggingVMouse] = useState(false)
  const vMouseDragOffset = useRef({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [showClockScroll, setShowClockScroll] = useState(false)
  const [clockScrollCenter, setClockScrollCenter] = useState({ x: 0, y: 0 })
  const [scrollAngle, setScrollAngle] = useState<number | null>(null)
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 })
  const edgePanRaf = useRef<number | null>(null)
  const edgePanVelocity = useRef({ x: 0, y: 0 })
  const initialModeSet = useRef(false)
  const lastSentCursorPos = useRef({ x: -1, y: -1 })

  // Performance monitoring state
  const [showPerformance, setShowPerformance] = useState(false)
  const [performance, setPerformance] = useState<any>(null)
  const prevPerformanceRef = useRef<any>(null)
  const prevTimeRef = useRef<number>(0)
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
      
      const containerRect = containerRef.current.getBoundingClientRect();
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
      } else if (x + vMouseWidth > containerRect.width - edgeThreshold) {
        const dist = (x + vMouseWidth) - (containerRect.width - edgeThreshold);
        vx = -(Math.min(dist, edgeThreshold) / edgeThreshold) * maxSpeed;
      }
      
      if (y < edgeThreshold) {
        vy = ((edgeThreshold - y) / edgeThreshold) * maxSpeed;
      } else if (y + vMouseHeight > containerRect.height - edgeThreshold) {
        const dist = (y + vMouseHeight) - (containerRect.height - edgeThreshold);
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
      
      if (mobile && !initialModeSet.current) {
        setInteractionMode("touch");
        initialModeSet.current = true;
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [])

  const getRealPos = useCallback((vMouseX: number, vMouseY: number) => {
    if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
    const containerRect = containerRef.current.getBoundingClientRect();
    const cursorClientX = containerRect.left + vMouseX;
    const cursorClientY = containerRect.top + vMouseY;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const targetWidth = originalSize?.width || canvasRef.current.width;
    const targetHeight = originalSize?.height || canvasRef.current.height;
    
    const canvasX = cursorClientX - rect.left;
    const canvasY = cursorClientY - rect.top;
    
    let realX = Math.round((canvasX / rect.width) * targetWidth);
    let realY = Math.round((canvasY / rect.height) * targetHeight);
    
    realX = Math.max(0, Math.min(targetWidth, realX));
    realY = Math.max(0, Math.min(targetHeight, realY));
    
    return { x: realX, y: realY };
  }, [originalSize]);

  const getVirtualMouseHotspot = useCallback(() => {
    // The visual tip of the MousePointer2 icon is slightly offset from the top-left
    // due to the SVG viewBox, w-8 h-8 sizing, and scale-75 transform.
    // We add an offset so the actual click matches the visual tip.
    return {
      x: virtualMousePos.x + 3,
      y: virtualMousePos.y + 4
    };
  }, [virtualMousePos]);

  useEffect(() => {
    if (showVirtualMouse && canvasRef.current && containerRef.current) {
      const hotspot = getVirtualMouseHotspot();
      const { x: realX, y: realY } = getRealPos(hotspot.x, hotspot.y);
      
      setCursorPos({ x: realX, y: realY });
      
      const now = Date.now();
      if (now - lastMouseMoveTimeRef.current >= 30) {
        if (realX !== lastSentCursorPos.current.x || realY !== lastSentCursorPos.current.y) {
          if (mode === 'screen') {
            sendCommand(device.id, device.password || "", 'input', { action: 'mousemove', useInterception, x: realX, y: realY });
          } else {
            sendCommand(device.id, device.password || "", 'window_input', { action: 'mousemove', id: targetId, useInterception, x: realX, y: realY });
          }
          lastSentCursorPos.current = { x: realX, y: realY };
          lastMouseMoveTimeRef.current = now;
        }
      }
    }
  }, [virtualMousePos, scrollOffset, zoom, originalSize, showVirtualMouse, device.id, sendCommand, mode, targetId, useInterception, getRealPos, getVirtualMouseHotspot]);

  const cancelUpload = useCallback((transferId: string) => {
    sendCommand(device.id, device.password || "", 'files', {
      action: 'file_cancel',
      transferId: transferId
    });
    cancelledUploads.current.add(transferId);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate relative coordinates on the canvas
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale to remote screen coordinates
    const targetWidth = originalSize?.width || canvasRef.current!.width;
    const targetHeight = originalSize?.height || canvasRef.current!.height;

    const realX = Math.round((x / rect.width) * targetWidth);
    const realY = Math.round((y / rect.height) * targetHeight);

    const CHUNK_SIZE = 128 * 1024; // 128KB chunks

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const transferId = `${file.name}-${Date.now()}-${i}`;
      
      setActiveUploads(prev => [...prev, { id: transferId, filename: file.name }]);
      setUploadProgress(prev => ({ ...prev, [transferId]: 0 }));

      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const totalSize = arrayBuffer.byteLength;
        
        // Start file transfer
        sendCommand(device.id, device.password || "", 'files', {
          action: 'drop_start',
          transferId: transferId,
          filename: file.name,
          totalSize: totalSize,
          x: realX,
          y: realY
        });

        // Wait a bit for remote side to prepare (create file, window etc)
        await new Promise(r => setTimeout(r, 150));

        // Send chunks
        let offset = 0;
        cancelledUploads.current.delete(transferId);
        
        // Helper to convert chunk to base64 efficiently
        const toBase64 = (buffer: ArrayBuffer) => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const chunkLimit = 8192;
          for (let i = 0; i < bytes.byteLength; i += chunkLimit) {
            const chunk = bytes.subarray(i, i + chunkLimit);
            // @ts-expect-error - apply works fine with Uint8Array
            binary += String.fromCharCode.apply(null, chunk);
          }
          return btoa(binary);
        };

        while (offset < totalSize) {
          if (cancelledUploads.current.has(transferId)) {
            console.log(`Upload ${transferId} cancelled`);
            cancelledUploads.current.delete(transferId);
            return;
          }

          const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
          const base64Chunk = toBase64(chunk);

          sendCommand(device.id, device.password || "", 'files', {
            action: 'drop_chunk',
            transferId: transferId,
            filename: file.name,
            data: base64Chunk,
            offset: offset
          });

          offset += CHUNK_SIZE;
          
          // Small delay to prevent overwhelming the socket and allow server processing
          await new Promise(r => setTimeout(r, 20));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastFrameTimeRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)
  const lastFpsTimeRef = useRef<number>(Date.now())
  const lastMouseMoveTimeRef = useRef<number>(0)

  // Initialize offscreen canvas
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas')
    }
  }, [])

  const metadataRef = useRef<any>(null)
  const lastHandledMessageRef = useRef<any>(null)
  const lastHandledRtcMessageRef = useRef<any>(null)
  
  // Handle WebRTC signaling from server directly via socket to avoid React state batching drops
  useEffect(() => {
    if (!socket) return;

    const handleSignalingMessage = async (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          if (data.deviceId !== device.id) return;

          if (data.type === 'webrtc_answer' && rtcPcRef.current) {
            console.log("[WebRTC] Received answer from server via socket listener");
            const sdp = data.sdp || data.data?.sdp;
            if (sdp) {
              await rtcPcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
              console.log("[WebRTC] Remote description set successfully");
            }
          } else if (data.type === 'webrtc_ice_candidate' && rtcPcRef.current) {
            const candidate = data.candidate || data.data?.candidate;
            if (candidate) {
              await rtcPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
          }
        } catch (e) {
          console.error("[WebRTC] Signaling error:", e);
        }
      }
    };

    socket.addEventListener('message', handleSignalingMessage);
    return () => socket.removeEventListener('message', handleSignalingMessage);
  }, [socket, device.id]);

  // Handle incoming frames
  useEffect(() => {
    const processMessage = (msg: any, ref: React.MutableRefObject<any>) => {
        if (!msg) return;
        console.log(`[StreamView] processMessage called, type: ${msg.type}, deviceId: ${msg.deviceId}, binary: ${msg.isBinary}`);
        
        if (msg === ref.current) return;
        ref.current = msg;

        if (msg.deviceId === device.id) {
            if (msg.type === 'screen_metadata' || msg.type === 'window_metadata') {
                metadataRef.current = msg;
                if (msg.cursor_style) {
                    setCursorStyle(msg.cursor_style);
                }
                if (msg.is_locked !== undefined) {
                    setIsLocked(!!msg.is_locked);
                }
                if (msg.has_interception !== undefined) {
                    setHasInterception(!!msg.has_interception);
                }
                return;
            }

            const isScreenFrame = mode === 'screen' && (msg.type === 'screen_frame');
            const isWindowFrame = mode === 'window' && (msg.type === 'window_frame' || msg.type === 'screen_frame');

            if (isScreenFrame || isWindowFrame) {
                const metadata = msg.metadata || {};
                
                if (metadata.cursor_style) {
                    setCursorStyle(metadata.cursor_style);
                }
                if (metadata.is_locked !== undefined) {
                    setIsLocked(!!metadata.is_locked);
                }
                if (metadata.has_interception !== undefined) {
                    setHasInterception(!!metadata.has_interception);
                }

                const mimeType = metadata.format === 'webp' ? 'image/webp' : 'image/jpeg';
                
                let url: string;
                if (msg.isBinary) {
                    const blob = new Blob([msg.data], { type: mimeType });
                    url = URL.createObjectURL(blob);
                } else {
                    url = `data:${mimeType};base64,${msg.data}`;
                }
                
                const img = new Image()
                img.onload = () => {
                    // Check if the frame is all black (privacy screen)
                    const offscreen = offscreenCanvasRef.current
                    const canvas = canvasRef.current
                    if (!offscreen || !canvas) {
                        if (msg.isBinary) URL.revokeObjectURL(url);
                        return
                    }

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = 100;
                    tempCanvas.height = 100;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                        tempCtx.drawImage(img, 0, 0, 100, 100);
                        const imageData = tempCtx.getImageData(0, 0, 100, 100);
                        let brightness = 0;
                        for (let i = 0; i < imageData.data.length; i += 4) {
                            brightness += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
                        }
                        brightness /= (imageData.data.length / 4);
                        
                        if (brightness < 10) {
                            console.log('[StreamView] Privacy screen detected, skipping frame');
                            if (msg.isBinary) URL.revokeObjectURL(url);
                            return;
                        }
                    }

                    setImageSrc(url); // Update imageSrc to hide loading
                    
                    const ctx = canvas.getContext('2d')
                    const offCtx = offscreen.getContext('2d')
                    if (!ctx || !offCtx) {
                        if (msg.isBinary) URL.revokeObjectURL(url);
                        return
                    }

                    // Handle full frame or incremental update
                    const isFull = metadata.full !== false // Default to true if undefined
                    const x = metadata.x || 0
                    const y = metadata.y || 0
                    const totalWidth = metadata.total_width || metadata.width || img.width
                    const totalHeight = metadata.total_height || metadata.height || img.height

                    if (isFull) {
                        // Resize offscreen canvas if needed
                        if (offscreen.width !== totalWidth || offscreen.height !== totalHeight) {
                            offscreen.width = totalWidth
                            offscreen.height = totalHeight
                            setOriginalSize({ 
                                width: metadata.original_width || totalWidth, 
                                height: metadata.original_height || totalHeight 
                            })
                        }
                        // Draw full frame to offscreen
                        offCtx.drawImage(img, 0, 0)
                    } else {
                        // Draw chunk to offscreen
                        offCtx.drawImage(img, x, y)
                    }

                    // Update visible canvas
                    if (canvas.width !== offscreen.width || canvas.height !== offscreen.height) {
                        canvas.width = offscreen.width
                        canvas.height = offscreen.height
                    }
                    ctx.drawImage(offscreen, 0, 0)
                    
                    if (msg.isBinary) URL.revokeObjectURL(url);
                }
                img.onerror = (e) => {
                    console.error('[StreamView] Image load error:', e);
                    if (msg.isBinary) URL.revokeObjectURL(url);
                    // Auto-refresh on stream error
                    const command = mode === 'screen' ? 'screen' : 'window_stream'
                    sendCommand(device.id, device.password || "", command, { action: 'refresh', id: targetId });
                }
                img.src = url;
                
                // Calculate FPS
                frameCountRef.current++
                const now = Date.now()
                if (now - lastFpsTimeRef.current >= 1000) {
                    setFps(frameCountRef.current)
                    frameCountRef.current = 0
                    lastFpsTimeRef.current = now
                }
            } else if (msg.type === 'error') {
                if (msg.deviceId === device.id && msg.message === 'Invalid device password') {
                    if (onBack) onBack();
                }
            } else if (msg.type === 'session_invalidated') {
                if (msg.deviceId === device.id) {
                    // Handled globally in WebSocketProvider
                    if (onBack) onBack()
                }
            } else if (msg.type === 'viewer_count') {
                if (msg.deviceId === device.id && msg.count === 0) {
                    // No more viewers, maybe close?
                    // The user said "客户端也提示还有一个控制"
                }
            } else if (msg.type === 'screenshot') {
                const url = `data:image/jpeg;base64,${msg.data}`;
                const link = document.createElement('a');
                link.href = url;
                link.download = `screenshot-${device.id}-${Date.now()}.jpg`;
                link.click();
                notify({
                    title: "截图成功",
                    message: "截图已保存到您的下载文件夹",
                    type: "success"
                });
            } else if (msg.type === 'clipboard') {
                const text = msg.data;
                navigator.clipboard.writeText(text).then(() => {
                    notify({
                        title: "剪贴板同步成功",
                        message: "已从远程设备获取剪贴板内容",
                        type: "success"
                    });
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    notify({
                        title: "剪贴板同步失败",
                        message: "无法写入本地剪贴板",
                        type: "error"
                    });
                });
            } else if (msg.type === 'audio_opus' && listenAudio) {
                // Handle incoming Opus audio
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    nextPlayTimeRef.current = audioContextRef.current.currentTime;
                }
                
                if (!opusDecoderRef.current) {
                    opusDecoderRef.current = new OpusDecoder();
                    opusDecoderRef.current.ready.then(() => {
                        console.log("Opus Decoder ready");
                        setOpusReady(true);
                    });
                }

                if (!opusReady) return;

                const ctx = audioContextRef.current;
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
                
                setIsReceivingAudio(true);
                if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
                audioTimeoutRef.current = setTimeout(() => setIsReceivingAudio(false), 500);
                
                try {
                    const opusData = msg.data; // Uint8Array
                    
                    // Decode Opus packet
                    const { channelData, samplesDecoded, sampleRate } = opusDecoderRef.current.decodeFrame(opusData);
                    
                    if (samplesDecoded > 0) {
                        const float32Data = channelData[0]; // Mono
                        
                        const audioBuffer = ctx.createBuffer(1, float32Data.length, sampleRate);
                        audioBuffer.getChannelData(0).set(float32Data);
                        
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(ctx.destination);
                        
                        const currentTime = ctx.currentTime;
                        if (nextPlayTimeRef.current < currentTime) {
                            nextPlayTimeRef.current = currentTime;
                        }
                        source.start(nextPlayTimeRef.current);
                        nextPlayTimeRef.current += audioBuffer.duration;
                    }
                } catch (e) {
                    console.error("Opus audio playback error:", e);
                }
            } else if (msg.type === 'audio_data' && listenAudio) {
                // ... (existing audio handling)
                // Handle incoming audio
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                    nextPlayTimeRef.current = audioContextRef.current.currentTime;
                }
                
                const ctx = audioContextRef.current;
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
                
                setIsReceivingAudio(true);
                if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
                audioTimeoutRef.current = setTimeout(() => setIsReceivingAudio(false), 500);
                
                try {
                    const bytes = msg.data; // Uint8Array
                    // Ensure the buffer is aligned for Int16Array (offset must be multiple of 2)
                    let int16Data: Int16Array;
                    if (bytes.byteOffset % 2 === 0) {
                        int16Data = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
                    } else {
                        // Copy to a new aligned buffer if necessary
                        const alignedBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                        int16Data = new Int16Array(alignedBuffer);
                    }
                    
                    const float32Data = new Float32Array(int16Data.length);
                    for (let i = 0; i < int16Data.length; i++) {
                        float32Data[i] = int16Data[i] / 32768.0;
                    }
                    
                    const audioBuffer = ctx.createBuffer(1, float32Data.length, 16000);
                    audioBuffer.getChannelData(0).set(float32Data);
                    
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    
                    const currentTime = ctx.currentTime;
                    if (nextPlayTimeRef.current < currentTime) {
                        nextPlayTimeRef.current = currentTime;
                    }
                    source.start(nextPlayTimeRef.current);
                    nextPlayTimeRef.current += audioBuffer.duration;
                } catch (e) {
                    console.error("Audio playback error:", e);
                }
            } else if (msg.type === 'performance_metrics' && showPerformance) {
                const now = Date.now()
                if (prevPerformanceRef.current && prevTimeRef.current) {
                  const timeDiff = (now - prevTimeRef.current) / 1000 // in seconds
                  if (timeDiff > 0) {
                    setPerformanceSpeed({
                      net_sent_speed: Math.max(0, (msg.data.net_sent - prevPerformanceRef.current.net_sent) / timeDiff),
                      net_recv_speed: Math.max(0, (msg.data.net_recv - prevPerformanceRef.current.net_recv) / timeDiff),
                    })
                  }
                }
                prevPerformanceRef.current = msg.data
                prevTimeRef.current = now
                setPerformance(msg.data)
            } else if (msg.type === 'pong') {
                if (webrtcState !== 'connected' && lastPingTimeRef.current) {
                  const rtt = Date.now() - lastPingTimeRef.current;
                  setLatency(rtt);
                  lastPingTimeRef.current = null;
                } 
            } else if (msg.type === 'notification') {
                notify({
                    title: msg.data.title || "通知",
                    message: msg.data.message || "",
                    type: "info"
                });
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
                notify({
                    title: "传输完成",
                    message: `文件 ${filename || '传输'} 已成功送达`,
                    type: "success"
                });
            } else if (msg.type === 'file_cancel') {
                const { transferId, filename } = msg.data;
                cancelledUploads.current.add(transferId);
                setActiveUploads(prev => prev.filter(f => f.id !== transferId));
                setUploadProgress(prev => {
                    const next = { ...prev };
                    delete next[transferId];
                    return next;
                });
                notify({
                    title: "传输已取消",
                    message: filename ? `文件 ${filename} 的传输已被取消` : "远程设备取消了文件传输",
                    type: "error"
                });
            }
        }
    };

    processMessage(lastMessage, lastHandledMessageRef);
    processMessage(rtcMessage, lastHandledRtcMessageRef);
  }, [lastMessage, rtcMessage, device.id, mode, listenAudio, showPerformance, notify, onBack, sendCommand, targetId])

// 
useEffect(() => {
  let interval: NodeJS.Timeout;

  if (webrtcState === "connected" && rtcPcRef.current) {
    interval = setInterval(async () => {
      try {
        const stats = await rtcPcRef.current!.getStats();
        stats.forEach((report) => {
          // 查找活跃的候选对统计信息
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            // RTT
            const rtt = report.currentRoundTripTime;
            if (rtt !== undefined) {
              setLatency(Math.round(rtt * 1000));
            }

            // Determine connection type
            const localCandidate = stats.get(report.localCandidateId);
            const remoteCandidate = stats.get(report.remoteCandidateId);
            if (localCandidate && remoteCandidate) {
                const isInternal = localCandidate.candidateType === 'host' && remoteCandidate.candidateType === 'host';
                setConnectionType(isInternal ? 'internal' : 'external');
            }
          }
        });
      } catch (e) {
        console.error("[WebRTC] Failed to get stats:", e);
      }
    }, 1000); // 每秒更新一次
  }

  return () => clearInterval(interval);
}, [webrtcState]);

  // Audio capture (Microphone)
  useEffect(() => {
    if (speakAudio) {
      // Check if same machine (simple check by IP)
      const isSameMachine = device.ip === '127.0.0.1' || device.ip === '::1' || device.ip === 'localhost';
      if (isSameMachine) {
          notify({
              title: "提示",
              message: "客户端和控制端在同一台电脑，已自动禁用麦克风以防止回音。",
              type: "info"
          });
          setSpeakAudio(false);
          return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        notify({
          title: "错误",
          message: "浏览器不支持麦克风访问或未在安全上下文(HTTPS)中运行。",
          type: "error"
        });
        setSpeakAudio(false);
        return;
      }

      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        mediaStreamRef.current = stream;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(1024, 1, 1);
        
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          const bytes = new Uint8Array(int16Data.buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
          }
          const base64 = window.btoa(binary);
          
          sendCommand(device.id, device.password || "", 'audio_input', { data: base64 });
        };
        
        source.connect(processor);
        processor.connect(ctx.destination);
        audioProcessorRef.current = processor;
      }).catch(err => {
        console.error("Error accessing microphone", err);
                notify({
                  title: "错误",
                  message: "无法访问麦克风",
                  type: "error"
                });
        setSpeakAudio(false);
      });
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }
    }
    
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
      }
    }
  }, [speakAudio, device.id, sendCommand, device.ip, notify]);

  // Stream control loop
  useEffect(() => {
    const command = mode === 'screen' ? 'screen' : 'window_stream'
    const args: any = { 
        action: 'start', 
        quality: quality[0], 
        scale: streamScale[0],
        compress: compress,
        webp: useWebP
    }
    if (mode === 'window' && targetId) {
        args.id = targetId
    }

    const startStream = () => {
        sendCommand(device.id, device.password || "", command, args);
        // Request initial full screen
        sendCommand(device.id, device.password || "", command, { ...args, action: 'refresh' });
    }

    const stopStream = () => {
        sendCommand(device.id, device.password || "", command, { action: 'stop', id: targetId });
    }

    startStream()

    // Keep awake loop
    const awakeInterval = setInterval(() => {
        sendCommand(device.id, device.password || "", 'keep_awake', {});
    }, 30000)

    // Latency measurement loop
    const latencyInterval = setInterval(() => {
        lastPingTimeRef.current = Date.now();
        sendCommand(device.id, device.password || "", 'ping', {});
    }, 3000)

    const handleVisibilityChange = () => {
        if (document.hidden) {
            stopStream()
        } else {
            startStream()
            // Force WebRTC reconnect when coming back to the tab
            // This fixes the "frozen screen" issue caused by browser throttling WebRTC in background
            setReconnectTrigger(prev => prev + 1)
        }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
        clearInterval(awakeInterval)
        clearInterval(latencyInterval)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        stopStream()
        if (opusDecoderRef.current) {
            opusDecoderRef.current.free();
            opusDecoderRef.current = null;
        }
    }
  }, [device.id, device.password, quality, streamScale, compress, useWebP, sendCommand, mode, targetId])

  const sendRTCCommand = useCallback((command: string, args: any) => {
      if (rtcDcRef.current?.readyState === 'open') {
          rtcDcRef.current.send(JSON.stringify({ 
              command, 
              args,
              deviceId: device.id,
              password: device.password || ""
          }));
      } else {
          sendCommand(device.id, device.password || "", command, args);
      }
  }, [device.id, device.password, sendCommand]);

  const sendInput = (action: string, data: any) => {
      if (mode === 'screen') {
          sendRTCCommand('input', { action, useInterception, ...data })
      } else {
          sendRTCCommand('window_input', { action, id: targetId, useInterception, ...data })
      }
  }

  const sendHotkey = (keys: string[]) => {
      sendInput('hotkey', { keys })
  }

  const getPyautoguiKey = (key: string) => {
    const map: Record<string, string> = {
      "ArrowUp": "up",
      "ArrowDown": "down",
      "ArrowLeft": "left",
      "ArrowRight": "right",
      "Enter": "enter",
      "Escape": "esc",
      "Backspace": "backspace",
      "Delete": "delete",
      "Tab": "tab",
      "Space": "space",
      " ": "space",
      "Control": "ctrl",
      "Alt": "alt",
      "Shift": "shift",
      "Meta": "win",
      "Win": "win",
      "Cmd": "win"
    }
    return map[key] || key.toLowerCase()
  }

  interface ToolbarAction {
    id?: string;
    icon: any;
    label: string;
    active?: boolean;
    onClick?: () => void;
    dropdown?: { label: string; onClick: () => void; destructive?: boolean }[];
    destructive?: boolean;
    disabled?: boolean;
    className?: string;
    badge?: number | string;
  }

  const toolbarActions: ToolbarAction[] = [
    { icon: MousePointer2, label: "远程点击", active: mouseMode, onClick: () => setMouseMode(!mouseMode) },
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
    { 
      icon: MessageSquare, 
      label: "聊天", 
      active: showChat, 
      onClick: () => setShowChat(!showChat),
      badge: unreadChatCount > 0 ? unreadChatCount : undefined
    },
    { icon: Keyboard, label: "键盘输入", active: keyboardMode, onClick: () => setKeyboardMode(!keyboardMode), className: "hidden sm:flex" },
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
    { icon: Clipboard, label: "剪贴板同步", onClick: async () => {
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
    { icon: RotateCcw, label: "刷新", onClick: () => {
        const command = mode === 'screen' ? 'screen' : 'window_stream'
        sendCommand(device.id, device.password || "", command, { action: 'refresh', id: targetId });
    } },
    { 
      id: "performance",
      icon: Activity, 
      label: "性能监控", 
      active: showPerformance, 
      onClick: () => setShowPerformance(!showPerformance),
      className: cn("w-auto px-2 gap-1.5", latency !== null && "text-xs font-medium")
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
    <div ref={rootRef} className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
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
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setFullscreen(!fullscreen)}>
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card text-card-foreground border-border">
                {fullscreen ? "退出全屏" : "全屏"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-card/50 overflow-x-auto shrink-0">
        <TooltipProvider delayDuration={0}>
          {toolbarActions.map((action, i) => (
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
      
      {/* Remote screen area */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-background flex items-center justify-center outline-none cursor-none touch-none" 
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
          if (e.button === 1 || (e.button === 0 && e.altKey)) { 
            setIsDragging(true)
            setDragStart({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseMove={(e) => {
          if (isDragging) {
            const dx = e.clientX - dragStart.x
            const dy = e.clientY - dragStart.y
            setScrollOffset(prev => getBoundedScrollOffset(prev.x + dx, prev.y + dy, zoom))
            setDragStart({ x: e.clientX, y: e.clientY })
          }
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
             setIsPanning(true)   
             setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
             lastTouchTime.current = Date.now()
             isLongPressActive.current = false;
             if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
             longPressTimerRef.current = setTimeout(() => {
                isLongPressActive.current = true;
                setShowTextInput(true);
             }, 600);
          } else if (e.touches.length === 2) {
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
          if (e.touches.length === 1) {
            if (isPanning) {
                const dx = e.touches[0].clientX - dragStart.x
                const dy = e.touches[0].clientY - dragStart.y
                if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    setIsDragging(true)
                }
                if (isDragging) {
                    setScrollOffset(prev => getBoundedScrollOffset(prev.x + dx, prev.y + dy, zoom))
                    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
                }
            }
          } else if (e.touches.length === 2) {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
              const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
              )
              const newZoom = touchStartZoom * (dist / touchStartDist)
              setZoom(Math.min(3, Math.max(0.5, newZoom)))
          }
        }}
        onTouchEnd={(e) => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }

            if (!isDragging && isPanning && e.changedTouches.length === 1 && e.touches.length === 0) {
                const now = Date.now()
                if (!isLongPressActive.current && now - lastTouchTime.current < 500) { // Click threshold
                    if (showTextInput) setShowTextInput(false);

                    if (canvasRef.current) {
                        const rect = canvasRef.current.getBoundingClientRect()
                        const touch = e.changedTouches[0]
                        const x = touch.clientX - rect.left
                        const y = touch.clientY - rect.top
                        
                        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                            const targetWidth = originalSize?.width || canvasRef.current.width
                            const targetHeight = originalSize?.height || canvasRef.current.height
                            
                            let realX = Math.round((x / rect.width) * targetWidth)
                            let realY = Math.round((y / rect.height) * targetHeight)

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
            setIsPanning(false)
            setIsDragging(false)
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault()
            const delta = e.deltaY > 0 ? -0.1 : 0.1
            setZoom(prev => Math.min(3, Math.max(0.5, prev + delta)))
          }
        }}
      >
          <div 
            className={cn(
                "relative transition-transform duration-75 ease-out",
                !imageSrc && "hidden"
            )}
            style={{ 
              transform: `translate(${scrollOffset.x}px, ${scrollOffset.y}px) scale(${zoom})`,
              cursor: showVirtualMouse ? 'none' : cursorStyle
            }}
          >
            <canvas 
              ref={canvasRef}
              className={cn(
                "max-w-none select-none transition-opacity",
                !mouseMode && "opacity-90"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleDrop}
              // Remove event handlers from here as they are on the container now or handled via ref
              onWheel={(e) => {
                if (!mouseMode) return;
                sendInput('scroll', { dx: e.deltaX, dy: e.deltaY });
              }}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                
                const targetWidth = originalSize?.width || e.currentTarget.width
                const targetHeight = originalSize?.height || e.currentTarget.height
                
                const realX = Math.round((x / rect.width) * targetWidth)
                const realY = Math.round((y / rect.height) * targetHeight)

                setCursorPos({ x: realX, y: realY })
                
                if (mouseMode && (interactionMode === 'mouse' || e.pointerType === 'mouse')) {
                  const now = Date.now()
                  if (now - lastMouseMoveTimeRef.current >= 30) {
                    if (realX !== lastSentCursorPos.current.x || realY !== lastSentCursorPos.current.y) {
                      sendInput('mousemove', { x: realX, y: realY })
                      lastSentCursorPos.current = { x: realX, y: realY };
                      lastMouseMoveTimeRef.current = now
                    }
                  }
                }
              }}
              onPointerDown={(e) => {
                if (!mouseMode) return
                if (interactionMode === 'touch' && e.pointerType === 'touch') return;
                if (e.button === 1 || (e.button === 0 && e.altKey)) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                
                const targetWidth = originalSize?.width || e.currentTarget.width
                const targetHeight = originalSize?.height || e.currentTarget.height
                
                const realX = Math.round((x / rect.width) * targetWidth)
                const realY = Math.round((y / rect.height) * targetHeight)

                const button = e.button === 2 ? 'right' : 'left';
                lastSentCursorPos.current = { x: realX, y: realY };
                sendInput('mousedown', { x: realX, y: realY, button })
              }}
              onPointerUp={(e) => {
                if (!mouseMode) return
                if (interactionMode === 'touch' && e.pointerType === 'touch') return;
                if (e.button === 1 || (e.button === 0 && e.altKey)) return;
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(e) {}
                
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                
                const targetWidth = originalSize?.width || e.currentTarget.width
                const targetHeight = originalSize?.height || e.currentTarget.height
                
                const realX = Math.round((x / rect.width) * targetWidth)
                const realY = Math.round((y / rect.height) * targetHeight)

                const button = e.button === 2 ? 'right' : 'left';
                lastSentCursorPos.current = { x: realX, y: realY };
                sendInput('mouseup', { x: realX, y: realY, button })
              }}
              onContextMenu={(e) => {
                e.preventDefault()
              }}
            />
            
            {/* Old Virtual Cursor removed */}
          </div>
          
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
              <MousePointer2 className="h-8 w-8 text-white" />
            </Button>
          )}

          {/* Virtual Mouse (Integrated) */}
          {showVirtualMouse && (
            <div 
              className="absolute z-50 flex flex-col items-start touch-none scale-[0.75] origin-top-left"
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
                className="absolute left-0 top-0 pointer-events-none z-50 -translate-x-[2px] -translate-y-[2px]"
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
              <div className="mt-6 ml-6 w-40 h-52 bg-[#9E9E9E]/60 backdrop-blur-md rounded-[2rem] border-2 border-white/30 shadow-2xl flex flex-col overflow-hidden relative opacity-90">
                
                {/* Top Half: L/R Buttons & Scroll */}
                <div className="flex h-[50%] border-b-2 border-white/30 relative">
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
                        lastSentCursorPos.current = { x: pos.x, y: pos.y };
                        sendInput('mousedown', { x: pos.x, y: pos.y, button: 'left' });
                      }
                      
                      setIsDraggingVMouse(true);
                      const containerRect = containerRef.current?.getBoundingClientRect();
                      if (containerRect) {
                        vMouseDragOffset.current = {
                          x: e.clientX - containerRect.left - virtualMousePos.x,
                          y: e.clientY - containerRect.top - virtualMousePos.y
                        };
                      }
                    }}
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (isDraggingVMouse) {
                        const containerRect = containerRef.current?.getBoundingClientRect();
                        if (!containerRect) return;
                        
                        const newX = e.clientX - containerRect.left - vMouseDragOffset.current.x;
                        const newY = e.clientY - containerRect.top - vMouseDragOffset.current.y;
                        setVirtualMousePos({ x: newX, y: newY });
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
                    className="flex-1 border-l-2 border-white/30 active:bg-black/10 transition-colors"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      
                      if (mouseMode) {
                        const hotspot = getVirtualMouseHotspot();
                        const pos = getRealPos(hotspot.x, hotspot.y);
                        sendInput('mousemove', { x: pos.x, y: pos.y });
                        lastSentCursorPos.current = { x: pos.x, y: pos.y };
                        sendInput('mousedown', { x: pos.x, y: pos.y, button: 'right' });
                      }
                      
                      setIsDraggingVMouse(true);
                      const containerRect = containerRef.current?.getBoundingClientRect();
                      if (containerRect) {
                        vMouseDragOffset.current = {
                          x: e.clientX - containerRect.left - virtualMousePos.x,
                          y: e.clientY - containerRect.top - virtualMousePos.y
                        };
                      }
                    }}
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (isDraggingVMouse) {
                        const containerRect = containerRef.current?.getBoundingClientRect();
                        if (!containerRect) return;
                        
                        const newX = e.clientX - containerRect.left - vMouseDragOffset.current.x;
                        const newY = e.clientY - containerRect.top - vMouseDragOffset.current.y;
                        setVirtualMousePos({ x: newX, y: newY });
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
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#B0B0B0] rounded-full border-2 border-white/30 flex items-center justify-center touch-none shadow-inner z-10"
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
                        const dx = e.clientX - clockScrollCenter.x;
                        const dy = e.clientY - clockScrollCenter.y;
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

                {/* Bottom Half: Drag Area */}
                <div 
                  className="flex-1 flex items-end justify-center pb-4 touch-none active:bg-black/5 transition-colors cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setIsDraggingVMouse(true);
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    if (containerRect) {
                      vMouseDragOffset.current = {
                        x: e.clientX - containerRect.left - virtualMousePos.x,
                        y: e.clientY - containerRect.top - virtualMousePos.y
                      };
                    }
                  }}
                  onPointerMove={(e) => {
                    e.stopPropagation();
                    if (isDraggingVMouse) {
                      const containerRect = containerRef.current?.getBoundingClientRect();
                      if (!containerRect) return;
                      
                      const newX = e.clientX - containerRect.left - vMouseDragOffset.current.x;
                      const newY = e.clientY - containerRect.top - vMouseDragOffset.current.y;
                      setVirtualMousePos({ x: newX, y: newY });
                    }
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    setIsDraggingVMouse(false);
                    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(e) {}
                  }}
                >
                  {/* Drag Handle Dots */}
                  <div className="grid grid-cols-4 gap-2 opacity-40">
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
              className="fixed z-[100] w-48 h-48 rounded-full border-4 border-gray-400 bg-gray-300/60 backdrop-blur-md pointer-events-none flex items-center justify-center animate-in fade-in zoom-in duration-200 opacity-80"
              style={{ left: clockScrollCenter.x - 96, top: clockScrollCenter.y - 96 }}
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
                <div className="bg-background/40 backdrop-blur-[1px] px-4 py-2 rounded-full border border-border/50 flex items-center gap-2 text-muted-foreground animate-in fade-in zoom-in duration-300">
                  <Lock className="h-4 w-4" />
                  <span className="text-xs font-medium">控制已锁定</span>
                </div>
              </div>
            )}

          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center z-40">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
              <div className="relative bg-background/90 backdrop-blur-md p-6 rounded-2xl border shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center animate-in fade-in zoom-in duration-300">
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
          className="absolute top-2 left-2 flex flex-col gap-2 z-50"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            variant={showPerformance ? "default" : "secondary"}
            size="sm"
            className="h-8 rounded-full shadow-lg opacity-80 hover:opacity-100 flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              setShowPerformance(!showPerformance);
            }}
          >
            <Activity className="h-4 w-4" />
            {latency !== null && (
              <span className="text-[10px] font-bold tabular-nums">
                {latency}ms
              </span>
            )}
          </Button>
          
          {showPerformance && performance && (
            <div className="bg-background/90 backdrop-blur-md p-3 rounded-xl border shadow-lg text-xs space-y-2 w-48 animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">CPU</span>
                <span className="font-mono">{performance.cpu_percent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">内存</span>
                <span className="font-mono">{performance.mem_percent}%</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">上传</span>
                <span className="font-mono text-[10px]">{formatSpeed(performanceSpeed.net_sent_speed)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">下载</span>
                <span className="font-mono text-[10px]">{formatSpeed(performanceSpeed.net_recv_speed)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Cursor position overlay */}
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-card/80 backdrop-blur-sm text-[10px] font-mono text-muted-foreground border border-border flex items-center gap-2">
          <Move className="h-3 w-3" />
          <span>{cursorPos.x}, {cursorPos.y}</span>
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
            <div className="flex flex-col gap-2 bg-background/90 backdrop-blur-md p-2 rounded-xl border shadow-lg w-[320px] z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-muted-foreground font-medium">文本输入 (实时同步)</span>
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
        </div>
      </div>

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
      />

      {/* Connection Loading Overlay */}
      {showLoadingOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-card border shadow-2xl max-w-xs w-full text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary animate-spin rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-foreground">正在建立连接</h3>
              <p className="text-sm text-muted-foreground animate-pulse">
                {loadingStatus}
              </p>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500 bg-primary",
                  webrtcState === 'connected' ? "w-full" : "w-2/3 animate-shimmer"
                )} 
              />
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
