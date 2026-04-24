import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

export interface SessionInfo {
  id: string;
  feature: string;
  controllerIp: string;
  clientIp: string;
  deviceId: string;
  systemInfo: string;
  startTime: number;
  bytesTransferred: number;
  lastActive: number;
  bandwidth: number; // bytes per second
  isOnline: boolean;
}

export interface IpStats {
  ip: string;
  rx: number; // total received
  tx: number; // total sent
  rxSpeed: number; // bytes per second
  txSpeed: number; // bytes per second
  type: 'controller' | 'client' | 'unknown';
  connectedAt: number;
}

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const IP_STATS_FILE = path.join(DATA_DIR, 'ip_stats.json');

class AdminMonitor {
  private blacklist: Set<string> = new Set();
  private ipStats: Map<string, IpStats> = new Map();
  private activeSessions: Map<string, SessionInfo> = new Map();
  private adminClients: Set<WebSocket> = new Set();

  private activeControllers: any[] = [];
  private activeClients: any[] = [];

  // Temporary counters for speed calculation (reset every second)
  private speedCounters: Map<string, { rx: number, tx: number }> = new Map();
  private sessionSpeedCounters: Map<string, number> = new Map();

  constructor() {
    this.loadBlacklist();
    this.loadData();
    // Start the interval to calculate speeds and broadcast stats
    setInterval(() => {
      this.calculateSpeeds();
      this.cleanupStaleSessions();
      this.broadcastStats();
    }, 1000);
    
    // Save data periodically
    setInterval(() => {
      this.saveData();
    }, 10000);
  }

  private loadData() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        this.activeSessions = new Map(Object.entries(data));
      }
      if (fs.existsSync(IP_STATS_FILE)) {
        const data = JSON.parse(fs.readFileSync(IP_STATS_FILE, 'utf-8'));
        this.ipStats = new Map(Object.entries(data));
      }
    } catch (e) {
      console.error('[Monitor] Error loading data:', e);
    }
  }

  private saveData() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(this.activeSessions), null, 2));
      fs.writeFileSync(IP_STATS_FILE, JSON.stringify(Object.fromEntries(this.ipStats), null, 2));
    } catch (e) {
      console.error('[Monitor] Error saving data:', e);
    }
  }

  private loadBlacklist() {
    try {
      if (fs.existsSync(BLACKLIST_FILE)) {
        const data = fs.readFileSync(BLACKLIST_FILE, 'utf-8');
        const list = JSON.parse(data);
        if (Array.isArray(list)) {
          this.blacklist = new Set(list);
          console.log('[Monitor] Loaded blacklist:', list);
        }
      }
    } catch (e) {
      console.error('[Monitor] Error loading blacklist:', e);
    }
  }

  private saveBlacklist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(Array.from(this.blacklist), null, 2));
    } catch (e) {
      console.error('[Monitor] Error saving blacklist:', e);
    }
  }

  public updateActiveConnections(controllers: any[], clients: any[]) {
    this.activeControllers = controllers;
    this.activeClients = clients;
  }

  private normalizeIp(ip: string): string {
    return ip.startsWith('::ffff:') ? ip.substring(7) : ip;
  }

  // --- Blacklist Management ---
  public isBlacklisted(ip: string): boolean {
    return this.blacklist.has(this.normalizeIp(ip));
  }

  public addToBlacklist(ip: string) {
    this.blacklist.add(this.normalizeIp(ip));
    this.saveBlacklist();
    this.broadcastStats();
  }

  public removeFromBlacklist(ip: string) {
    this.blacklist.delete(this.normalizeIp(ip));
    this.saveBlacklist();
    this.broadcastStats();
  }

  public getBlacklist(): string[] {
    return Array.from(this.blacklist);
  }

  // --- Traffic & Connection Tracking ---
  public registerConnection(ip: string, type: 'controller' | 'client') {
    if (!this.ipStats.has(ip)) {
      this.ipStats.set(ip, {
        ip,
        rx: 0,
        tx: 0,
        rxSpeed: 0,
        txSpeed: 0,
        type,
        connectedAt: Date.now()
      });
    } else {
      // Update type if it was unknown
      const stats = this.ipStats.get(ip)!;
      stats.type = type;
    }
  }

  public recordTraffic(ip: string, rxBytes: number, txBytes: number) {
    if (!ip) return;
    
    // Update total
    const stats = this.ipStats.get(ip);
    if (stats) {
      stats.rx += rxBytes;
      stats.tx += txBytes;
    } else {
      this.ipStats.set(ip, {
        ip,
        rx: rxBytes,
        tx: txBytes,
        rxSpeed: 0,
        txSpeed: 0,
        type: 'unknown',
        connectedAt: Date.now()
      });
    }

    // Update speed counter
    let speed = this.speedCounters.get(ip);
    if (!speed) {
      speed = { rx: 0, tx: 0 };
      this.speedCounters.set(ip, speed);
    }
    speed.rx += rxBytes;
    speed.tx += txBytes;
  }

  // --- Session Tracking ---
  public recordSessionActivity(controllerIp: string, clientIp: string, deviceId: string, systemInfo: string, feature: string, bytes: number) {
    if (!controllerIp || !clientIp) return;
    
    const sessionId = `${controllerIp}-${clientIp}-${deviceId}-${feature}`;
    const now = Date.now();

    let session = this.activeSessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        feature,
        controllerIp,
        clientIp,
        deviceId,
        systemInfo,
        startTime: now,
        bytesTransferred: 0,
        lastActive: now,
        bandwidth: 0,
        isOnline: true
      };
      this.activeSessions.set(sessionId, session);
    }

    session.bytesTransferred += bytes;
    session.lastActive = now;
    session.isOnline = true;

    // Update session speed counter
    const currentSpeed = this.sessionSpeedCounters.get(sessionId) || 0;
    this.sessionSpeedCounters.set(sessionId, currentSpeed + bytes);
  }

  private cleanupStaleSessions() {
    const now = Date.now();
    for (const [id, session] of this.activeSessions.entries()) {
      // If no activity for 5 seconds, consider session ended
      if (now - session.lastActive > 5000) {
        session.isOnline = false;
        session.bandwidth = 0;
        this.sessionSpeedCounters.delete(id);
      }
      // Optional: Remove completely if offline for a long time (e.g., 24 hours)
      if (now - session.lastActive > 24 * 60 * 60 * 1000) {
        this.activeSessions.delete(id);
      }
    }
  }

  private calculateSpeeds() {
    // Calculate IP speeds
    for (const [ip, stats] of this.ipStats.entries()) {
      const speed = this.speedCounters.get(ip);
      if (speed) {
        stats.rxSpeed = speed.rx;
        stats.txSpeed = speed.tx;
        // Reset counter
        speed.rx = 0;
        speed.tx = 0;
      } else {
        stats.rxSpeed = 0;
        stats.txSpeed = 0;
      }
    }

    // Calculate session speeds
    for (const [id, session] of this.activeSessions.entries()) {
      const bytes = this.sessionSpeedCounters.get(id) || 0;
      session.bandwidth = bytes;
      this.sessionSpeedCounters.set(id, 0);
    }
  }

  // --- Admin WebSocket Management ---
  public addAdminClient(ws: WebSocket) {
    this.adminClients.add(ws);
    // Send initial state
    this.sendStatsToClient(ws);
    
    ws.on('close', () => {
      this.adminClients.delete(ws);
    });
  }

  private broadcastStats() {
    if (this.adminClients.size === 0) return;
    
    const stats = this.getStatsSnapshot();
    const message = JSON.stringify({ type: 'monitor_stats', data: stats });
    
    for (const client of this.adminClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  private sendStatsToClient(ws: WebSocket) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'monitor_stats', data: this.getStatsSnapshot() }));
    }
  }

  private getStatsSnapshot() {
    let totalRxSpeed = 0;
    let totalTxSpeed = 0;

    const ips = Array.from(this.ipStats.values());
    for (const stat of ips) {
      totalRxSpeed += stat.rxSpeed;
      totalTxSpeed += stat.txSpeed;
    }

    return {
      overview: {
        controllerCount: this.activeControllers.length,
        clientCount: this.activeClients.length,
        totalRxSpeed,
        totalTxSpeed,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
      sessions: Array.from(this.activeSessions.values()),
      ips,
      blacklist: Array.from(this.blacklist),
      activeControllers: this.activeControllers,
      activeClients: this.activeClients
    };
  }
}

export const monitor = new AdminMonitor();
