"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { useNotification } from '@/components/ui/custom-notification'
import pako from 'pako'

interface Device {
  id: string
  hostname: string
  ip: string
  publicIp?: string
  location?: string
  isp?: string
  os: string
  arch?: string
  resolution?: string
  remark: string
  platform: string
  status: 'online' | 'offline'
  lastSeen: number
  viewerCount?: number
  cpuUsage?: number
  ramUsage?: number
  cpu?: string
  ram?: string
  disk?: string
  diskUsage?: number
  password?: string
}

interface WebSocketContextType {
  socket: WebSocket | null
  isConnected: boolean
  assistanceCode: string | null
  lastAssistedDeviceId: string | null
  setLastAssistedDeviceId: (id: string | null) => void
  devices: Device[]
  sendMessage: (message: any) => void
  sendCommand: (deviceId: string, password: string, command: string, args?: any) => void
  authenticateDevice: (deviceId: string, password: string) => void
  getTurnConfig: () => Promise<any>
  lastMessage: any
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [assistanceCode, setAssistanceCode] = useState<string | null>(null)
  const [lastAssistedDeviceId, setLastAssistedDeviceId] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])

  const [lastMessage, setLastMessage] = useState<any>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasNotifiedErrorRef = useRef(false)
  const { notify } = useNotification()

  const connect = useCallback(() => {
    // Use the current host for WebSocket connection
   
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const wsUrl = `${protocol}//${host}${basePath}/ws`
    const apiUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `/api`


    console.log('Connecting to WebSocket:', wsUrl)
    console.log('Connecting to api:', apiUrl)
    const ws = new WebSocket(wsUrl)

    ws.onopen = async () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setSocket(ws)
      socketRef.current = ws
      hasNotifiedErrorRef.current = false
      
      let publicIp = 'unknown';
      try {
        const res = await fetch(apiUrl+'/ip');
        const data = await res.json();
        publicIp = data.ip;
      } catch (e) {
        console.warn('Failed to fetch public IP from local API', e);
      }
      
      // Identify as a client
      ws.send(JSON.stringify({ type: 'client_connect', publicIp }))
      
      // Request device list // 移除自动获取
      // ws.send(JSON.stringify({ type: 'list_devices' }))
    }

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
        // Handle binary data (e.g., encrypted screen frames)
        const arrayBuffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Assuming the first byte is msg_type, second is id_len
        if (uint8Array.length > 2) {
            const msg_type = uint8Array[0];
            const id_len = uint8Array[1];
            const device_id = new TextDecoder().decode(uint8Array.slice(2, 2 + id_len));
            
            if (msg_type >= 4 && msg_type <= 7) {
                // Merged binary packet: [msg_type, id_len, ...device_id, metadata_len, ...metadata_bytes, ...frame_data]
                // 4: screen uncompressed, 5: screen compressed, 6: window uncompressed, 7: window compressed
                let dataToParse = uint8Array.slice(2 + id_len);
                
                if (msg_type === 5 || msg_type === 7) {
                    let decompressed: Uint8Array | null = null;
                    
                    // 1. Try standard zlib
                    try { decompressed = pako.inflate(dataToParse); } catch (e) {}
                    
                    // 2. Try raw deflate
                    if (!decompressed) {
                        try { decompressed = pako.inflateRaw(dataToParse); } catch (e) {}
                    }
                    
                    // 3. Try gzip
                    if (!decompressed) {
                        try { decompressed = pako.ungzip(dataToParse); } catch (e) {}
                    }
                    
                    // 4. Try uncompressed metadata + compressed frame
                    if (!decompressed) {
                        try {
                            const possibleLen = new DataView(dataToParse.buffer, dataToParse.byteOffset, 4).getUint32(0, false);
                            if (possibleLen > 0 && possibleLen < 100000 && dataToParse[4] === 123) { // 123 is '{'
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
                    
                    if (!decompressed) {
                        console.warn('Decompression error for msg_type ' + msg_type + ': unknown compression format. Falling back to uncompressed.');
                        decompressed = dataToParse as any;
                    }
                    
                    dataToParse = decompressed as any;
                }

                let metadataLen = 0;
                let metadataBytes = new Uint8Array(0);
                let frameData = dataToParse;
                let metadata: any = {};
                
                try {
                    if (dataToParse.length > 4) {
                        const possibleLen = new DataView(dataToParse.buffer, dataToParse.byteOffset, 4).getUint32(0, false);
                        // Check if it looks like a valid JSON metadata length and starts with '{' (123)
                        if (possibleLen > 0 && possibleLen < 100000 && dataToParse.length >= 4 + possibleLen && dataToParse[4] === 123) {
                            metadataLen = possibleLen;
                            metadataBytes = dataToParse.slice(4, 4 + metadataLen);
                            frameData = dataToParse.slice(4 + metadataLen);
                            metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse metadata, treating as raw frame data', e);
                }
                
                setLastMessage({
                    type: (msg_type === 6 || msg_type === 7) ? 'window_frame' : 'screen_frame',
                    deviceId: device_id,
                    metadata: metadata,
                    data: frameData,
                    isBinary: true,
                    compressed: msg_type === 5 || msg_type === 7
                });
            } else {
                const data = uint8Array.slice(2 + id_len);
                let type = 'unknown';
                if (msg_type === 1) type = 'screen_frame';
                else if (msg_type === 2) type = 'audio_data';
                else if (msg_type === 3) type = 'audio_opus';
                else if (msg_type === 8) type = 'window_frame'; // fallback for raw window frame
                
                if (type === 'unknown') {
                    console.warn('Unknown binary msg_type received:', msg_type);
                }
                
                setLastMessage({
                    type: type,
                    deviceId: device_id,
                    data: data,
                    isBinary: true
                });
            }
        }
        return;
      }

      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)

        if (data.command === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
        }

        if (data.type === 'device_auth_success') {
          setDevices(prev => {
            const exists = prev.find(d => d.id === data.device.id);
            const deviceData = data.device;
            const fullDevice = {
              ...exists,
              ...deviceData,
              password: exists?.password || deviceData.password,
              hostname: deviceData.hostname || exists?.hostname || "Unknown",
              ip: deviceData.ip || exists?.ip || "Unknown",
              os: deviceData.os || exists?.os || "Unknown",
              remark: deviceData.remark || exists?.remark || "",
              platform: deviceData.platform || exists?.platform || "pc",
            } as Device;
            
            if (exists) return prev.map(d => d.id === data.device.id ? fullDevice : d);
            return [...prev, fullDevice];
          });
          notify({ type: 'success', title: '连接成功', message: '设备已添加' });
        } else if (data.type === 'assistance_code') {
          setAssistanceCode(data.code);
        } else if (data.type === 'assistance_request') {
          notify({
            type: 'info',
            title: '协助请求',
            message: `设备 ${data.deviceId} (${data.info?.hostname || '未知'}) 请求协助。是否接受并将其添加到设备列表？`,
            isModal: true,
            confirmText: '接受',
            cancelText: '拒绝',
            onConfirm: () => {
              // 1. Add to savedDevices
              const saved = localStorage.getItem("rootdesk_devices_cache") || localStorage.getItem("rootdesk_saved_devices");
              let savedDevices = [];
              if (saved) {
                try { savedDevices = JSON.parse(saved); } catch (e) {}
              }
              
              const cleanId = data.deviceId.replace(/\s/g, '');
              const exists = savedDevices.some((d: any) => d.id === cleanId);
              
              if (!exists) {
                const newDevice = {
                  id: cleanId,
                  password: data.password,
                  hostname: data.info?.hostname || "Assisted Device",
                  remark: "协助请求添加",
                  platform: data.info?.platform || "pc",
                  tags: []
                };
                savedDevices.push(newDevice);
                localStorage.setItem("rootdesk_devices_cache", JSON.stringify(savedDevices));
                localStorage.setItem("rootdesk_saved_devices", JSON.stringify(savedDevices));
                
                // Trigger a refresh of the device list in the UI
                window.dispatchEvent(new CustomEvent('rootdesk_device_added', { detail: newDevice }));
                window.dispatchEvent(new Event('storage'));
              }

              // 2. Send response
              sendMessage({
                type: 'assistance_response',
                deviceId: data.deviceId,
                success: true
              });

              // 3. Authenticate and redirect
              setLastAssistedDeviceId(cleanId);
              authenticateDevice(data.deviceId, data.password);
              
              // We'll handle the redirect in the DeviceList component when it sees the device becomes verified
              // or we can try to find a way to navigate from here.
              // Since we don't have router here, we'll rely on the user clicking the device in the list
              // or the DeviceList's auto-redirect logic if we add one.
            },
            onCancel: () => {
              sendMessage({
                type: 'assistance_response',
                deviceId: data.deviceId,
                success: false,
                message: '对方拒绝了您的请求'
              });
            }
          });
        } else if (data.type === 'device_list') {
          setDevices(prev => {
            const newDevices = data.devices || [];
            // Merge with existing devices to keep any info not present in the brief list
            const merged = [...prev];
            newDevices.forEach((newD: any) => {
              const idx = merged.findIndex(d => d.id === newD.id);
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...newD };
              } else {
                merged.push({
                  ...newD,
                  hostname: newD.hostname || "Unknown",
                  ip: newD.ip || "Unknown",
                  os: newD.os || "Unknown",
                  remark: newD.remark || "",
                  platform: newD.platform || "pc",
                } as Device);
              }
            });
            return merged;
          });
        } else if (data.type === 'device_status') {
          setDevices(prev => {
            const exists = prev.find(d => d.id === data.deviceId);
            const info = data.info || {};
            const updatedDevice = {
              id: data.deviceId,
              status: data.status,
              lastSeen: data.lastSeen || Date.now(),
              hostname: info.hostname || (exists?.hostname) || "Unknown",
              ip: info.ip || (exists?.ip) || "Unknown",
              os: info.os || (exists?.os) || "Unknown",
              remark: info.remark || (exists?.remark) || "",
              platform: info.platform || (exists?.platform) || "pc",
              ...info
            } as Device;
            
            if (exists) {
              // Merge existing device info with new status info
              return prev.map(d => d.id === data.deviceId ? { ...d, ...updatedDevice } : d);
            }
            return [...prev, updatedDevice];
          });
        } else if (data.type === 'device_auth_error') {
          notify({ type: 'error', title: '认证失败', message: data.message });
        } else if (data.type === 'viewer_count') {
          setDevices(prev => prev.map(d => d.id === data.deviceId ? { ...d, viewerCount: data.count } : d))
        } else if (data.type === 'error') {
          console.log("Global error received:", data);
          if (data.isSilent) {
            console.log("Suppressing silent error notification:", data.message);
            return;
          }
          let errorMsg = data.message || data.data?.message || "发生错误";
          if (errorMsg === 'Invalid device password') {
            errorMsg = '设备密码错误，请重新连接';
          }
          notify({
            type: 'error',
            title: '发生错误',
            message: errorMsg,
            isModal: true
          })
        } else if (data.type === 'session_invalidated') {
          console.log("Global session_invalidated received:", data);
          notify({
            type: 'warning',
            title: '会话已失效',
            message: data.message || `设备 ${data.deviceId} 密码已更新，请重新连接`,
            isModal: true
          })
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
      setSocket(null)
      socketRef.current = null
      
      // Reconnect after 3 seconds
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (!hasNotifiedErrorRef.current) {
        notify({
          type: 'error',
          title: '连接错误',
          message: '无法连接到服务器，请检查网络或稍后重试',
          isModal: true
        })
        hasNotifiedErrorRef.current = true
      }
      ws.close()
    }

    return ws
  }, [])

  useEffect(() => {
    const ws = connect()
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      ws.close()
    }
  }, [connect])

  const sendMessage = useCallback((message: any) => {
    const currentSocket = socketRef.current
    if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
      currentSocket.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected', message)
      // Only notify if not a silent message (like background status refresh)
      if (!message.isSilent) {
        notify({
          title: "连接错误",
          message: "未连接到服务器",
          type: "error"
        })
      }
    }
  }, [notify])

  const sendCommand = useCallback((deviceId: string, password: string, command: string, args: any = {}) => {
    const message = {
      type: 'command',
      deviceId,
      password,
      command,
      args
    }
    
    // This centralized method ensures all commands have the required auth info
    sendMessage(message)
  }, [sendMessage])

  const authenticateDevice = useCallback((deviceId: string, password: string) => {
    sendMessage({
      type: 'device_auth',
      deviceId,
      password
    })
  }, [sendMessage])

  const getTurnConfig = useCallback((deviceId: string, password: string) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const handler = async (event: MessageEvent) => {
        try {
          if (typeof event.data !== 'string') return;
          const data = JSON.parse(event.data);
          if (data.type === 'turn_config' && data.encryptedData) {
            socketRef.current?.removeEventListener('message', handler);
            
            // Decrypt using device password
            const encrypted = Uint8Array.from(atob(data.encryptedData), c => c.charCodeAt(0));
            
            // Get SHA-256 of password
            const msgUint8 = new TextEncoder().encode(password || '');
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const key = new Uint8Array(hashBuffer);
            
            let decryptedStr = '';
            for (let i = 0; i < encrypted.length; i++) {
              decryptedStr += String.fromCharCode(encrypted[i] ^ key[i % key.length]);
            }
            
            resolve(JSON.parse(decryptedStr));
          } else if (data.type === 'error' && data.message?.includes('TURN config')) {
            socketRef.current?.removeEventListener('message', handler);
            reject(new Error(data.message));
          }
        } catch (e) {
          console.error('[WebSocket] Failed to decrypt TURN config', e);
        }
      };

      socketRef.current.addEventListener('message', handler);
      socketRef.current.send(JSON.stringify({ type: 'get_turn_config', deviceId, password }));

      // Timeout after 5 seconds
      setTimeout(() => {
        socketRef.current?.removeEventListener('message', handler);
        reject(new Error('Timeout waiting for TURN config'));
      }, 5000);
    });
  }, []);

  return (
    <WebSocketContext.Provider value={{ 
      socket, 
      isConnected, 
      assistanceCode,
      lastAssistedDeviceId,
      setLastAssistedDeviceId,
      devices, 
      sendMessage, 
      sendCommand,
      authenticateDevice,
      getTurnConfig,
      lastMessage 
    }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}
