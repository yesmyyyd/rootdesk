"use client"

import { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react"
import {
  RotateCcw,
  Hand,
  Crosshair,
  HelpCircle,
  Move,
  ArrowUpDown,
  ArrowLeftRight,
  MousePointer2,
  Volume2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DeviceInfo } from "./device-list"
import { useWebSocket } from "@/components/websocket-provider"
import { useNotification } from "@/components/ui/custom-notification"
import { OpusDecoder } from "opus-decoder"
import pako from 'pako'

export interface StreamScreenRef {
  handleRefresh: () => void;
  sendInput: (action: string, data: any) => void;
  sendHotkey: (keys: string[]) => void;
  getRealPos: (vMouseX: number, vMouseY: number) => { x: number, y: number };
  canvas: HTMLCanvasElement | null;
  container: HTMLDivElement | null;
}

interface StreamScreenProps {
  device: DeviceInfo;
  mode: "screen" | "window";
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  targetId?: number;
  quality: number;
  streamScale: number;
  compress: boolean;
  useWebP: boolean;
  targetFps: number;
  listenAudio: boolean;
  speakAudio: boolean;
  setSpeakAudio: (val: boolean) => void;
  mouseMode: boolean;
  interactionMode: "touch" | "mouse";
  keyboardMode: boolean;
  useInterception: boolean;
  isLandscape: boolean;
  zoom: number;
  setZoom: (val: number | ((prev: number) => number)) => void;
  scrollOffset: { x: number, y: number };
  setScrollOffset: (val: { x: number, y: number } | ((prev: { x: number, y: number }) => { x: number, y: number })) => void;
  onFpsChange: (fps: number) => void;
  onLatencyChange: (latency: number | null) => void;
  onOriginalSizeChange: (size: { width: number, height: number } | null) => void;
  onWebrtcStateChange: (state: "connecting" | "connected" | "failed" | "none") => void;
  onConnectionTypeChange: (type: 'internal' | 'external' | null) => void;
  onIsLockedChange: (locked: boolean) => void;
  onHasInterceptionChange: (has: boolean | null) => void;
  onCursorStyleChange: (style: string) => void;
  onReceivingAudioChange: (receiving: boolean) => void;
  onRtcMessage?: (msg: any) => void;
  onBack?: () => void;
  // File drop/upload related
  onFileDrop: (files: FileList, x: number, y: number) => void;
  // External interaction control
  isEditingKeymap?: boolean;
  showVirtualMouse?: boolean;
  virtualMousePos?: { x: number, y: number };
  getVirtualMouseHotspot?: () => { x: number, y: number };
  // Visuals
  cursorStyle: string;
  imageSrc: string | null;
  setImageSrc: (src: string | null) => void;
  // Performance
  showPerformance: boolean;
  onPerformanceData: (data: any) => void;
}

export const StreamScreen = forwardRef<StreamScreenRef, StreamScreenProps>(({
  device,
  mode,
  canvasRef,
  containerRef,
  targetId,
  quality,
  streamScale,
  compress,
  useWebP,
  targetFps,
  listenAudio,
  speakAudio,
  setSpeakAudio,
  mouseMode,
  interactionMode,
  keyboardMode,
  useInterception,
  isLandscape,
  zoom,
  setZoom,
  scrollOffset,
  setScrollOffset,
  onFpsChange,
  onLatencyChange,
  onOriginalSizeChange,
  onWebrtcStateChange,
  onConnectionTypeChange,
  onIsLockedChange,
  onHasInterceptionChange,
  onCursorStyleChange,
  onReceivingAudioChange,
  onRtcMessage,
  onBack,
  onFileDrop,
  isEditingKeymap,
  showVirtualMouse,
  virtualMousePos,
  getVirtualMouseHotspot,
  cursorStyle,
  imageSrc,
  setImageSrc,
  showPerformance,
  onPerformanceData
}, ref) => {
  const { socket, isConnected, sendCommand, lastMessage, getTurnConfig } = useWebSocket()
  const { notify } = useNotification()
  
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const brightnessCanvasRef = useRef<HTMLCanvasElement | null>(null)
  
  const rtcPcRef = useRef<RTCPeerConnection | null>(null)
  const rtcDcRef = useRef<RTCDataChannel | null>(null)
  const [rtcMessage, setRtcMessage] = useState<any>(null)
  const [webrtcState, setWebrtcStateInternal] = useState<"connecting" | "connected" | "failed" | "none">("none")
  const [reconnectTrigger, setReconnectTrigger] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)
  
  const lastPingTimeRef = useRef<number | null>(null)
  const lastFrameTsRef = useRef<number>(0)
  const lastProcessedTsRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)
  const lastFpsTimeRef = useRef<number>(Date.now())
  const lastMouseMoveTimeRef = useRef<number>(0)
  const lastSentCursorPos = useRef({ x: -1, y: -1 })
  const [originalSize, setOriginalSizeInternal] = useState<{ width: number, height: number } | null>(null)

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const opusDecoderRef = useRef<OpusDecoder | null>(null)
  const [opusReady, setOpusReady] = useState(false)
  const nextPlayTimeRef = useRef<number>(0)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize canvases
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas')
    }
    if (!brightnessCanvasRef.current) {
        brightnessCanvasRef.current = document.createElement('canvas')
        brightnessCanvasRef.current.width = 100
        brightnessCanvasRef.current.height = 100
    }
  }, [])

  // Update parent when internal state changes
  useEffect(() => {
    onWebrtcStateChange(webrtcState)
  }, [webrtcState, onWebrtcStateChange])

  useEffect(() => {
    onOriginalSizeChange(originalSize)
  }, [originalSize, onOriginalSizeChange])

  // WebRTC Setup
  useEffect(() => {
    let pc: RTCPeerConnection | null = null;
    let dc: RTCDataChannel | null = null;
    let isMounted = true;

    const initWebRTC = async () => {
      if (!isConnected) return;
      
      try {
        setWebrtcStateInternal("connecting");

        let iceServers = [];
        try {
          iceServers = await getTurnConfig(device.id, device.password || "");
          if (!isMounted) return;
        } catch (e) {
          if (!isMounted) return;
          iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
          ];
        }

        pc = new RTCPeerConnection({ iceServers });
        rtcPcRef.current = pc;

        dc = pc.createDataChannel("stream", { ordered: true });
        rtcDcRef.current = dc;

        dc.onopen = () => {
          dc!.binaryType = 'arraybuffer';
          setWebrtcStateInternal("connected");
          setReconnectCount(0);
        };

        dc.onclose = () => setWebrtcStateInternal("failed");
        dc.onerror = () => setWebrtcStateInternal("failed");

        dc.onmessage = async (event) => {
          try {
            if (typeof event.data === 'string') {
                try {
                    const parsed = JSON.parse(event.data);
                    if (!parsed.deviceId) parsed.deviceId = device.id;
                    setRtcMessage(parsed);
                    if (onRtcMessage) onRtcMessage(parsed);
                } catch (e) {}
            } else {
                const uint8Array = new Uint8Array(event.data);
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
                            if (decompressed) dataToParse = decompressed;
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
                        } catch (e) {}
                        
                        const rtcMsg = {
                            type: (msg_type === 6 || msg_type === 7) ? 'window_frame' : 'screen_frame',
                            deviceId: device.id,
                            metadata: metadata,
                            data: frameData,
                            isBinary: true,
                            compressed: msg_type === 5 || msg_type === 7
                        };
                        setRtcMessage(rtcMsg);
                        if (onRtcMessage) onRtcMessage(rtcMsg);
                    } else {
                        const data = uint8Array.slice(1);
                        let type = 'unknown';
                        if (msg_type === 1) type = 'screen_frame';
                        else if (msg_type === 2) type = 'audio_data';
                        else if (msg_type === 3) type = 'audio_opus';
                        else if (msg_type === 8) type = 'window_frame';
                        
                        const rtcMsg = {
                            type: type,
                            deviceId: device.id,
                            data: data,
                            isBinary: true
                        };
                        setRtcMessage(rtcMsg);
                        if (onRtcMessage) onRtcMessage(rtcMsg);
                    }
                }
            }
          } catch (e) {}
        };

        pc.oniceconnectionstatechange = () => {
          if (!isMounted) return;
          console.log(`[WebRTC] ICE Connection State: ${pc?.iceConnectionState}`);
          
          if (pc?.iceConnectionState === "failed") {
            console.error("[WebRTC] ICE Connection failed. Check firewall/NAT settings.");
            setWebrtcStateInternal("failed");
            if (reconnectCount < 3) {
              setTimeout(() => {
                if (isMounted) {
                  console.log("[WebRTC] Attempting to reconnect...");
                  setReconnectCount(prev => prev + 1);
                  setReconnectTrigger(prev => prev + 1);
                }
              }, 3000);
            }
          } else if (pc?.iceConnectionState === "disconnected") {
            console.warn("[WebRTC] ICE Connection disconnected.");
          } else if (pc?.iceConnectionState === "connected") {
            console.log("[WebRTC] ICE Connection established!");
          }
        };

        pc.onicegatheringstatechange = () => {
          console.log(`[WebRTC] ICE Gathering State: ${pc?.iceGatheringState}`);
        };

        pc.onsignalingstatechange = () => {
          console.log(`[WebRTC] Signaling State: ${pc?.signalingState}`);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const c = event.candidate;
            console.log(`[WebRTC] New Local ICE Candidate: Type=${c.type}, Protocol=${c.protocol}, Address=${c.address}:${c.port}, Candidate=${c.candidate.substring(0, 50)}...`);
            sendCommand(device.id, device.password || "", "webrtc_ice_candidate", {
              candidate: event.candidate.toJSON()
            });
          } else {
            console.log("[WebRTC] Local ICE Candidate gathering complete.");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendCommand(device.id, device.password || "", "webrtc_offer", {
          sdp: pc.localDescription?.sdp
        });

      } catch (e) {
        setWebrtcStateInternal("failed");
      }
    };

    initWebRTC();

    return () => {
      isMounted = false;
      if (dc) dc.close();
      if (pc) pc.close();
      rtcPcRef.current = null;
      rtcDcRef.current = null;
      setWebrtcStateInternal("none");
    };
  }, [device.id, sendCommand, device.password, reconnectTrigger, isConnected, getTurnConfig]);

  // Handle WebRTC signaling from server
  useEffect(() => {
    if (!socket) return;

    const handleSignalingMessage = async (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          if (data.deviceId !== device.id) return;

          if (data.type === 'webrtc_answer' && rtcPcRef.current) {
            const sdp = data.sdp || data.data?.sdp;
            if (sdp) {
              await rtcPcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
            }
          } else if (data.type === 'webrtc_ice_candidate' && rtcPcRef.current) {
            const candidate = data.candidate || data.data?.candidate;
            if (candidate) {
              await rtcPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
          }
        } catch (e) {}
      }
    };

    socket.addEventListener('message', handleSignalingMessage);
    return () => socket.removeEventListener('message', handleSignalingMessage);
  }, [socket, device.id]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback((msg: any) => {
    if (!msg || msg.deviceId !== device.id) return;

    const isScreenFrame = mode === 'screen' && (msg.type === 'screen_frame');
    const isWindowFrame = mode === 'window' && (msg.type === 'window_frame' || msg.type === 'screen_frame');

    if (isScreenFrame || isWindowFrame) {
        const metadata = msg.metadata || {};
        
        if (metadata.ts) {
            if (metadata.ts < lastFrameTsRef.current) {
                if (lastFrameTsRef.current - metadata.ts < 5) return;
            }
            lastFrameTsRef.current = metadata.ts;
        }

        if (metadata.cursor_style) onCursorStyleChange(metadata.cursor_style);
        if (metadata.is_locked !== undefined) onIsLockedChange(!!metadata.is_locked);
        if (metadata.has_interception !== undefined) onHasInterceptionChange(!!metadata.has_interception);

        const mimeType = metadata.format === 'webp' ? 'image/webp' : 'image/jpeg';
        let url: string;
        if (msg.isBinary) {
            const blob = new Blob([msg.data], { type: mimeType });
            url = URL.createObjectURL(blob);
        } else {
            url = `data:${mimeType};base64,${msg.data}`;
        }
        
        const img = new Image()
        const frameTs = metadata.ts || 0;
        img.onload = () => {
            if (frameTs && frameTs < lastProcessedTsRef.current) {
                if (msg.isBinary) URL.revokeObjectURL(url);
                return;
            }
            if (frameTs) lastProcessedTsRef.current = frameTs;

            const offscreen = offscreenCanvasRef.current
            const canvas = canvasRef.current
            if (!offscreen || !canvas) {
                if (msg.isBinary) URL.revokeObjectURL(url);
                return
            }

            const bCanvas = brightnessCanvasRef.current;
            if (bCanvas) {
                const bCtx = bCanvas.getContext('2d');
                if (bCtx) {
                    bCtx.drawImage(img, 0, 0, 100, 100);
                    const imageData = bCtx.getImageData(0, 0, 100, 100);
                    let brightness = 0;
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        brightness += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
                    }
                    brightness /= (imageData.data.length / 4);
                    if (brightness < 10) {
                        if (msg.isBinary) URL.revokeObjectURL(url);
                        return;
                    }
                }
            }

            if (!imageSrc) setImageSrc(url); 
            const ctx = canvas.getContext('2d')
            const offCtx = offscreen.getContext('2d')
            if (ctx && offCtx) {
                const isFull = metadata.full !== false
                const x = metadata.x || 0
                const y = metadata.y || 0
                const totalWidth = metadata.total_width || metadata.width || img.width
                const totalHeight = metadata.total_height || metadata.height || img.height

                if (isFull) {
                    if (offscreen.width !== totalWidth || offscreen.height !== totalHeight) {
                        offscreen.width = totalWidth
                        offscreen.height = totalHeight
                        setOriginalSizeInternal({ 
                            width: metadata.original_width || totalWidth, 
                            height: metadata.original_height || totalHeight 
                        })
                    }
                    offCtx.drawImage(img, 0, 0)
                } else {
                    offCtx.drawImage(img, x, y)
                }

                if (canvas.width !== offscreen.width || canvas.height !== offscreen.height) {
                    canvas.width = offscreen.width
                    canvas.height = offscreen.height
                }
                ctx.drawImage(offscreen, 0, 0)
            }
            if (msg.isBinary) URL.revokeObjectURL(url);
        }
        img.onerror = () => {
            if (msg.isBinary) URL.revokeObjectURL(url);
            const command = mode === 'screen' ? 'screen' : 'window_stream'
            sendCommand(device.id, device.password || "", command, { action: 'refresh', id: targetId });
        }
        img.src = url;
        
        frameCountRef.current++
        const now = Date.now()
        if (now - lastFpsTimeRef.current >= 1000) {
            onFpsChange(frameCountRef.current)
            frameCountRef.current = 0
            lastFpsTimeRef.current = now
        }
        return;
    }

    if (msg.type === 'screen_metadata' || msg.type === 'window_metadata') {
        if (msg.cursor_style) onCursorStyleChange(msg.cursor_style);
        if (msg.is_locked !== undefined) onIsLockedChange(!!msg.is_locked);
        if (msg.has_interception !== undefined) onHasInterceptionChange(!!msg.has_interception);
        return;
    }

    if (msg.type === 'performance' || msg.type === 'performance_metrics') {
        if (showPerformance) onPerformanceData(msg.data);
    } else if (msg.type === 'pong') {
        if (webrtcState !== 'connected' && lastPingTimeRef.current) {
          onLatencyChange(Date.now() - lastPingTimeRef.current);
          lastPingTimeRef.current = null;
        } 
    } else if (msg.type === 'audio_opus' && listenAudio) {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            nextPlayTimeRef.current = audioContextRef.current.currentTime;
        }
        if (!opusDecoderRef.current) {
            opusDecoderRef.current = new OpusDecoder();
            opusDecoderRef.current.ready.then(() => setOpusReady(true));
        }
        if (!opusReady) return;

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        
        onReceivingAudioChange(true);
        if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
        audioTimeoutRef.current = setTimeout(() => onReceivingAudioChange(false), 500);
        
        try {
            const { channelData, samplesDecoded, sampleRate } = opusDecoderRef.current.decodeFrame(msg.data);
            if (samplesDecoded > 0) {
                const float32Data = channelData[0];
                const audioBuffer = ctx.createBuffer(1, float32Data.length, sampleRate);
                audioBuffer.getChannelData(0).set(float32Data);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                const currentTime = ctx.currentTime;
                const audioBufferDelay = 0.15;
                if (nextPlayTimeRef.current < currentTime + audioBufferDelay) {
                    nextPlayTimeRef.current = currentTime + audioBufferDelay;
                }
                source.start(nextPlayTimeRef.current);
                nextPlayTimeRef.current += audioBuffer.duration;
            }
        } catch (e) {}
    } else if (msg.type === 'audio_data' && listenAudio) {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            nextPlayTimeRef.current = audioContextRef.current.currentTime;
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        onReceivingAudioChange(true);
        if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
        audioTimeoutRef.current = setTimeout(() => onReceivingAudioChange(false), 500);
        try {
            const bytes = msg.data;
            let int16Data: Int16Array;
            if (bytes.byteOffset % 2 === 0) {
                int16Data = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
            } else {
                int16Data = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            }
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) float32Data[i] = int16Data[i] / 32768.0;
            const audioBuffer = ctx.createBuffer(1, float32Data.length, 16000);
            audioBuffer.getChannelData(0).set(float32Data);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            const currentTime = ctx.currentTime;
            const audioBufferDelay = 0.15;
            if (nextPlayTimeRef.current < currentTime + audioBufferDelay) {
                nextPlayTimeRef.current = currentTime + audioBufferDelay;
            }
            source.start(nextPlayTimeRef.current);
            nextPlayTimeRef.current += audioBuffer.duration;
        } catch (e) {}
    }
  }, [device.id, mode, listenAudio, showPerformance, sendCommand, targetId, webrtcState, opusReady, onCursorStyleChange, onIsLockedChange, onHasInterceptionChange, onFpsChange, onLatencyChange, onReceivingAudioChange, setImageSrc, imageSrc]);

  useEffect(() => { handleIncomingMessage(lastMessage); }, [lastMessage, handleIncomingMessage]);
  useEffect(() => { handleIncomingMessage(rtcMessage); }, [rtcMessage, handleIncomingMessage]);

  // WebRTC Stats
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (webrtcState === "connected" && rtcPcRef.current) {
      interval = setInterval(async () => {
        try {
          const stats = await rtcPcRef.current!.getStats();
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              const rtt = report.currentRoundTripTime;
              if (rtt !== undefined) onLatencyChange(Math.round(rtt * 1000));
              const localCandidate = stats.get(report.localCandidateId);
              const remoteCandidate = stats.get(report.remoteCandidateId);
              if (localCandidate && remoteCandidate) {
                  const isInternal = localCandidate.candidateType === 'host' && remoteCandidate.candidateType === 'host';
                  onConnectionTypeChange(isInternal ? 'internal' : 'external');
              }
            }
          });
        } catch (e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [webrtcState, onLatencyChange, onConnectionTypeChange]);

  // Microphone
  useEffect(() => {
    if (speakAudio) {
      const isSameMachine = device.ip === '127.0.0.1' || device.ip === '::1' || device.ip === 'localhost';
      if (isSameMachine) {
          notify({ title: "提示", message: "客户端和控制端在同一台电脑，已自动禁用麦克风以防止回音。", type: "info" });
          setSpeakAudio(false);
          return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        notify({ title: "错误", message: "浏览器不支持麦克风访问或未在安全上下文(HTTPS)中运行。", type: "error" });
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
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          sendCommand(device.id, device.password || "", 'audio_input', { data: window.btoa(binary) });
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        audioProcessorRef.current = processor;
      }).catch(err => {
        setSpeakAudio(false);
        notify({ title: "错误", message: "无法访问麦克风", type: "error" });
      });
    } else {
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(track => track.stop()); mediaStreamRef.current = null; }
      if (audioProcessorRef.current) { audioProcessorRef.current.disconnect(); audioProcessorRef.current = null; }
    }
    return () => {
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
      if (audioProcessorRef.current) audioProcessorRef.current.disconnect();
    }
  }, [speakAudio, device.id, sendCommand, device.ip, notify, setSpeakAudio]);

  const sendRTCCommand = useCallback((command: string, args: any) => {
      if (rtcDcRef.current?.readyState === 'open') {
          rtcDcRef.current.send(JSON.stringify({ 
              command, args, deviceId: device.id, password: device.password || ""
          }));
      } else {
          sendCommand(device.id, device.password || "", command, args);
      }
  }, [device.id, device.password, sendCommand]);

  const sendInput = useCallback((action: string, data: any) => {
      if (mode === 'screen') {
          sendRTCCommand('input', { action, useInterception, ...data })
      } else {
          sendRTCCommand('window_input', { action, id: targetId, useInterception, ...data })
      }
  }, [mode, sendRTCCommand, targetId, useInterception]);

  const sendHotkey = useCallback((keys: string[]) => {
      sendInput('hotkey', { keys })
  }, [sendInput]);

  // Stream control loop
  useEffect(() => {
    const command = mode === 'screen' ? 'screen' : 'window_stream'
    const args: any = { 
        action: 'start', quality, scale: streamScale, compress, webp: useWebP, fps: targetFps
    }
    if (mode === 'window' && targetId) args.id = targetId
    const startStream = () => {
        sendRTCCommand(command, args);
        sendRTCCommand(command, { ...args, action: 'refresh' });
    }
    const stopStream = () => sendRTCCommand(command, { action: 'stop', id: targetId });
    startStream()
    const awakeInterval = setInterval(() => sendCommand(device.id, device.password || "", 'keep_awake', {}), 30000)
    const latencyInterval = setInterval(() => {
        lastPingTimeRef.current = Date.now();
        sendCommand(device.id, device.password || "", 'ping', {});
    }, 3000)
    const handleVisibilityChange = () => {
        if (document.hidden) stopStream()
        else { startStream(); setReconnectTrigger(prev => prev + 1); }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
        clearInterval(awakeInterval); clearInterval(latencyInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        stopStream()
        if (opusDecoderRef.current) { opusDecoderRef.current.free(); opusDecoderRef.current = null; }
    }
  }, [device.id, device.password, quality, streamScale, compress, useWebP, targetFps, sendCommand, mode, targetId, sendRTCCommand])

  const getRealPos = useCallback((vMouseX: number, vMouseY: number) => {
    if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const canvasWidth = canvasRef.current.offsetWidth;
    const canvasHeight = canvasRef.current.offsetHeight;
    const canvasLeft = containerWidth / 2 + scrollOffset.x - (canvasWidth * zoom) / 2;
    const canvasTop = containerHeight / 2 + scrollOffset.y - (canvasHeight * zoom) / 2;
    const localX = vMouseX - canvasLeft;
    const localY = vMouseY - canvasTop;
    const canvasX = localX / zoom;
    const canvasY = localY / zoom;
    const targetWidth = originalSize?.width || canvasRef.current.width;
    const targetHeight = originalSize?.height || canvasRef.current.height;
    let realX = Math.round((canvasX / canvasWidth) * targetWidth);
    let realY = Math.round((canvasY / canvasHeight) * targetHeight);
    realX = Math.max(0, Math.min(targetWidth, realX));
    realY = Math.max(0, Math.min(targetHeight, realY));
    return { x: realX, y: realY };
  }, [originalSize, scrollOffset, zoom]);

  useImperativeHandle(ref, () => ({
    handleRefresh: () => {
        const command = mode === 'screen' ? 'screen' : 'window_stream'
        sendCommand(device.id, device.password || "", command, { action: 'refresh', id: targetId });
        setReconnectCount(0);
        setReconnectTrigger(prev => prev + 1);
    },
    sendInput,
    sendHotkey,
    getRealPos,
    canvas: canvasRef.current,
    container: containerRef.current
  }));

  const getPyautoguiKey = (key: string) => {
    const map: Record<string, string> = {
      "ArrowUp": "up", "ArrowDown": "down", "ArrowLeft": "left", "ArrowRight": "right",
      "Enter": "enter", "Escape": "esc", "Backspace": "backspace", "Delete": "delete",
      "Tab": "tab", "Space": "space", " ": "space", "Control": "ctrl", "Alt": "alt",
      "Shift": "shift", "Meta": "win", "Win": "win", "Cmd": "win"
    }
    return map[key] || key.toLowerCase()
  }

  return (
    <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-background flex items-center justify-center outline-none cursor-none touch-none select-none" 
        tabIndex={0}
        onKeyDown={(e) => {
          if (!keyboardMode) return
          e.preventDefault()
          if (e.repeat) sendInput('keypress', { key: getPyautoguiKey(e.key) })
          else sendInput('keydown', { key: getPyautoguiKey(e.key) })
        }}
        onKeyUp={(e) => {
          if (!keyboardMode) return
          e.preventDefault()
          sendInput('keyup', { key: getPyautoguiKey(e.key) })
        }}
    >
          <div 
            className={cn("relative transition-transform duration-75 ease-out", !imageSrc && "hidden")}
            style={{ 
              transform: `translate(${scrollOffset.x}px, ${scrollOffset.y}px) scale(${zoom})`,
              cursor: (showVirtualMouse || isEditingKeymap) ? 'none' : cursorStyle
            }}
          >
            <canvas 
              ref={canvasRef}
              className={cn("max-w-none select-none transition-opacity", (!mode || isEditingKeymap) && "opacity-90")}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => onFileDrop(e.dataTransfer.files, e.clientX, e.clientY)}
              onWheel={(e) => {
                if (isEditingKeymap) return;
                sendInput('scroll', { dx: e.deltaX, dy: e.deltaY });
              }}
              onPointerMove={(e) => {
                if (isEditingKeymap) return;
                const x = e.nativeEvent.offsetX
                const y = e.nativeEvent.offsetY
                const targetWidth = originalSize?.width || e.currentTarget.width
                const targetHeight = originalSize?.height || e.currentTarget.height
                const realX = Math.round((x / e.currentTarget.offsetWidth) * targetWidth)
                const realY = Math.round((y / e.currentTarget.offsetHeight) * targetHeight)
                
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
                if (isEditingKeymap || !mouseMode) return
                if (interactionMode === 'touch' && e.pointerType === 'touch') return;
                if (e.button === 1 || (e.button === 0 && e.altKey)) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                const x = e.nativeEvent.offsetX
                const y = e.nativeEvent.offsetY
                const targetWidth = originalSize?.width || e.currentTarget.width
                const targetHeight = originalSize?.height || e.currentTarget.height
                const realX = Math.round((x / e.currentTarget.offsetWidth) * targetWidth)
                const realY = Math.round((y / e.currentTarget.offsetHeight) * targetHeight)
                const button = e.button === 2 ? 'right' : 'left';
                lastSentCursorPos.current = { x: realX, y: realY };
                sendInput('mousedown', { x: realX, y: realY, button })
              }}
              onPointerUp={(e) => {
                if (isEditingKeymap || !mouseMode) return
                if (interactionMode === 'touch' && e.pointerType === 'touch') return;
                if (e.button === 1 || (e.button === 0 && e.altKey)) return;
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(e) {}
                const x = e.nativeEvent.offsetX
                const y = e.nativeEvent.offsetY
                const targetWidth = originalSize?.width || e.currentTarget.width
                const targetHeight = originalSize?.height || e.currentTarget.height
                const realX = Math.round((x / e.currentTarget.offsetWidth) * targetWidth)
                const realY = Math.round((y / e.currentTarget.offsetHeight) * targetHeight)
                const button = e.button === 2 ? 'right' : 'left';
                lastSentCursorPos.current = { x: realX, y: realY };
                sendInput('mouseup', { x: realX, y: realY, button })
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
    </div>
  )
});

StreamScreen.displayName = "StreamScreen";
