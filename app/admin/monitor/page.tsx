"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Activity, Shield, Users, Server, Ban, ArrowUpRight, ArrowDownRight } from "lucide-react"

interface SessionInfo {
  id: string;
  feature: string;
  controllerIp: string;
  clientIp: string;
  deviceId: string;
  systemInfo: string;
  startTime: number;
  bytesTransferred: number;
  lastActive: number;
  bandwidth: number;
  isOnline: boolean;
}

interface GroupedSession {
  controllerIps: string[];
  clientIp: string;
  deviceId: string;
  systemInfo: string;
  features: { name: string; bandwidth: number }[];
  totalBandwidth: number;
  startTime: number;
  isOnline: boolean;
}

interface MonitorStats {
  overview: {
    controllerCount: number;
    clientCount: number;
    totalRxSpeed: number;
    totalTxSpeed: number;
    uptime: number;
    memoryUsage: any;
  };
  sessions: SessionInfo[];
  ips: any[];
  blacklist: string[];
  activeControllers: { ip: string, lastSeen: number, assistanceCode?: string }[];
  activeClients: { id: string, ip: string, hostname: string, lastSeen: number }[];
}

export default function AdminMonitorPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState<MonitorStats | null>(null)
  const [newBlacklistIp, setNewBlacklistIp] = useState("")
  const [showControllers, setShowControllers] = useState(false)
  const [showClients, setShowClients] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<"all" | "online" | "offline">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const wsRef = useRef<WebSocket | null>(null)
  
  // Load cached credentials on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('admin_user');
      const savedPass = localStorage.getItem('admin_pass');
      if (savedUser) setUser(savedUser);
      if (savedPass) setPass(savedPass);
    }
  })

  const connectWs = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const wsUrl = `${protocol}//${host}${basePath}/admin/ws`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'admin_auth', user, pass }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'admin_auth_success') {
        setIsAuthenticated(true)
        setError("")
        // Cache credentials if rememberMe is checked
        if (rememberMe) {
          localStorage.setItem('admin_user', user);
          localStorage.setItem('admin_pass', pass);
        } else {
          localStorage.removeItem('admin_user');
          localStorage.removeItem('admin_pass');
        }
      } else if (data.type === 'admin_auth_error') {
        setError(data.message)
        ws.close()
      } else if (data.type === 'monitor_stats') {
        setStats(data.data)
      }
    }

    ws.onclose = () => {
      if (isAuthenticated) {
        setIsAuthenticated(false)
        setTimeout(connectWs, 3000) // Reconnect
      }
    }

    wsRef.current = ws
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    connectWs()
  }

  const handleAddBlacklist = () => {
    if (!newBlacklistIp) return
    wsRef.current?.send(JSON.stringify({ type: 'admin_command', action: 'blacklist_add', ip: newBlacklistIp }))
    setNewBlacklistIp("")
  }

  const handleRemoveBlacklist = (ip: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'admin_command', action: 'blacklist_remove', ip }))
  }

  const handleKickSession = (controllerIp: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'admin_command', action: 'kick_session', controllerIp }))
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  // Group sessions by deviceId
  const groupedSessions: GroupedSession[] = []
  if (stats) {
    const groupMap = new Map<string, GroupedSession>()
    stats.sessions.forEach(session => {
      const key = session.deviceId || `${session.controllerIp}-${session.clientIp}`
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          controllerIps: [session.controllerIp],
          clientIp: session.clientIp,
          deviceId: session.deviceId,
          systemInfo: session.systemInfo,
          features: [],
          totalBandwidth: 0,
          startTime: session.startTime,
          isOnline: session.isOnline
        })
      }
      const group = groupMap.get(key)!
      if (!group.controllerIps.includes(session.controllerIp)) {
        group.controllerIps.push(session.controllerIp)
      }
      group.features.push({ name: session.feature, bandwidth: session.bandwidth })
      group.totalBandwidth += session.bandwidth
      group.startTime = Math.min(group.startTime, session.startTime)
      group.isOnline = group.isOnline || session.isOnline
    })
    groupedSessions.push(...Array.from(groupMap.values()))
  }

  const filteredSessions = groupedSessions.filter(s => {
    if (sessionFilter === "online") return s.isOnline;
    if (sessionFilter === "offline") return !s.isOnline;
    return true;
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Top 10 IP Traffic
  const topIps = stats?.ips ? [...stats.ips].sort((a, b) => (b.rx + b.tx) - (a.rx + a.tx)).slice(0, 10) : [];

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> 服务端监控登录</CardTitle>
            <CardDescription>请输入管理员账号密码</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input placeholder="用户名" value={user} onChange={e => setUser(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Input type="password" placeholder="密码" value={pass} onChange={e => setPass(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                <label htmlFor="remember" className="text-sm">记住密码</label>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">登录</Button>
              <p className="text-xs text-muted-foreground text-center">
                账号密码请在项目 data 目录下 credentials.json 文件查看
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!stats) return <div className="p-8 text-center">加载中...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          服务端实时监控
        </h1>
        <Badge variant="outline" className="text-sm">
          运行时间: {formatDuration(stats.overview.uptime * 1000)}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowControllers(true)}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">在线控制端</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.controllerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">点击查看详情</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowClients(true)}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">在线客户端</CardTitle>
            <Server className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.clientCount}</div>
            <p className="text-xs text-muted-foreground mt-1">点击查看详情</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总上行速率 (TX)</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatBytes(stats.overview.totalTxSpeed)}/s</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总下行速率 (RX)</CardTitle>
            <ArrowDownRight className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{formatBytes(stats.overview.totalRxSpeed)}/s</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>活跃业务会话</CardTitle>
            <CardDescription>当前正在进行的远程控制、文件传输等操作</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={sessionFilter === "all" ? "default" : "outline"} size="sm" onClick={() => { setSessionFilter("all"); setCurrentPage(1); }}>全部</Button>
            <Button variant={sessionFilter === "online" ? "default" : "outline"} size="sm" onClick={() => { setSessionFilter("online"); setCurrentPage(1); }}>在线</Button>
            <Button variant={sessionFilter === "offline" ? "default" : "outline"} size="sm" onClick={() => { setSessionFilter("offline"); setCurrentPage(1); }}>离线</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>状态</TableHead>
                <TableHead>业务类型</TableHead>
                <TableHead>控制端 IP</TableHead>
                <TableHead>客户端 IP</TableHead>
                <TableHead>设备 ID</TableHead>
                <TableHead>系统信息</TableHead>
                <TableHead>实时带宽</TableHead>
                <TableHead>持续时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSessions.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">暂无活跃会话</TableCell></TableRow>
              ) : (
                paginatedSessions.map(session => (
                  <TableRow key={session.deviceId || session.clientIp}>
                    <TableCell>
                      <Badge variant={session.isOnline ? "default" : "secondary"}>
                        {session.isOnline ? "在线" : "离线"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {session.features.map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {f.name} ({formatBytes(f.bandwidth)}/s)
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex flex-col gap-1">
                        {session.controllerIps.map((ip, i) => (
                          <span key={i}>{ip}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{session.clientIp}</TableCell>
                    <TableCell className="font-mono text-xs">{session.deviceId}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{session.systemInfo}</TableCell>
                    <TableCell>{formatBytes(session.totalBandwidth)}/s</TableCell>
                    <TableCell>{formatDuration(Date.now() - session.startTime)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => handleKickSession(session.controllerIps[0])} disabled={!session.isOnline}>
                        剔除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>上一页</Button>
              <span className="text-sm text-muted-foreground">第 {currentPage} 页，共 {totalPages} 页</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>下一页</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 10 IP Traffic */}
        <Card>
          <CardHeader>
            <CardTitle>IP 流量排行 (Top 10)</CardTitle>
            <CardDescription>按总流量排序的 IP 列表</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP 地址</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>总接收 (RX)</TableHead>
                  <TableHead>总发送 (TX)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topIps.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">暂无数据</TableCell></TableRow>
                ) : (
                  topIps.map((ipData, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{ipData.ip}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ipData.type === 'controller' ? '控制端' : ipData.type === 'client' ? '客户端' : '未知'}</Badge>
                      </TableCell>
                      <TableCell>{formatBytes(ipData.rx)}</TableCell>
                      <TableCell>{formatBytes(ipData.tx)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Blacklist Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ban className="w-5 h-5 text-destructive" /> 黑名单管理</CardTitle>
            <CardDescription>被封禁的 IP 将无法建立任何 WebSocket 连接</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="输入要封禁的 IP 地址" 
                value={newBlacklistIp} 
                onChange={e => setNewBlacklistIp(e.target.value)}
              />
              <Button variant="destructive" onClick={handleAddBlacklist}>封禁</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>封禁 IP</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.blacklist.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">黑名单为空</TableCell></TableRow>
                ) : (
                  stats.blacklist.map(ip => (
                    <TableRow key={ip}>
                      <TableCell className="font-mono text-sm">{ip}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleRemoveBlacklist(ip)}>
                          解封
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Controllers Modal */}
      {showControllers && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>在线控制端详情</CardTitle>
                <CardDescription>当前连接的控制端列表</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setShowControllers(false)}>关闭</Button>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP 地址</TableHead>
                    <TableHead>协助码</TableHead>
                    <TableHead>最后活动时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.activeControllers?.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center">暂无在线控制端</TableCell></TableRow>
                  ) : (
                    stats.activeControllers?.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{c.ip}</TableCell>
                        <TableCell className="font-mono">{c.assistanceCode || '-'}</TableCell>
                        <TableCell>{new Date(c.lastSeen).toLocaleTimeString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clients Modal */}
      {showClients && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[80vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>在线客户端详情</CardTitle>
                <CardDescription>当前连接的受控端列表</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setShowClients(false)}>关闭</Button>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备 ID</TableHead>
                    <TableHead>主机名</TableHead>
                    <TableHead>IP 地址</TableHead>
                    <TableHead>最后活动时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.activeClients?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center">暂无在线客户端</TableCell></TableRow>
                  ) : (
                    stats.activeClients?.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{c.id}</TableCell>
                        <TableCell>{c.hostname}</TableCell>
                        <TableCell className="font-mono">{c.ip}</TableCell>
                        <TableCell>{new Date(c.lastSeen).toLocaleTimeString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
