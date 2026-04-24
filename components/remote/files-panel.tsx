"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  ChevronRight,
  ChevronDown,
  Upload,
  Download,
  Trash2,
  Plus,
  Copy,
  Scissors,
  ArrowUp,
  Home,
  RotateCcw,
  Grid,
  List,
  Search,
  MoreHorizontal,
  FileCode,
  Eye,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut,
  Minus,
  Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useNotification } from "@/components/ui/custom-notification"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeviceInfo } from "./device-list"
import { useWebSocket } from "@/components/websocket-provider"

interface FileItem {
  name: string
  type: "folder" | "file"
  size?: string
  modified: string
  ext?: string
  children?: FileItem[]
}

interface FilesPanelProps {
  device: DeviceInfo
  onBack?: () => void
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileIcon(item: FileItem) {
  if (item.type === "folder") return Folder
  const ext = item.ext?.toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(ext || "")) return FileImage
  if (["mp4", "avi", "mov", "mkv", "wmv"].includes(ext || "")) return FileVideo
  if (["zip", "rar", "7z", "tar.gz", "tar"].includes(ext || "")) return FileArchive
  if (["py", "js", "ts", "tsx", "json", "html", "css", "sql", "ini", "xml", "yaml", "yml"].includes(ext || "")) return FileCode
  if (["txt", "md", "docx", "xlsx", "pdf", "log", "csv"].includes(ext || "")) return FileText
  return File
}

function getFileIconColor(item: FileItem) {
  if (item.type === "folder") return "text-primary"
  const ext = item.ext?.toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext || "")) return "text-info"
  if (["mp4", "avi", "mov"].includes(ext || "")) return "text-warning"
  if (["zip", "rar", "7z", "tar.gz"].includes(ext || "")) return "text-destructive"
  if (["py", "js", "ts", "tsx", "json", "html", "css", "ini", "xml", "yaml", "yml"].includes(ext || "")) return "text-success"
  return "text-muted-foreground"
}

export function FilesPanel({ device, onBack }: FilesPanelProps) {
  const { sendCommand, lastMessage } = useWebSocket()
  const { notify } = useNotification()
  const [currentPath, setCurrentPath] = useState<string[]>(device.platform === 'pc' ? [] : ["/sdcard"])
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [currentFiles, setCurrentFiles] = useState<FileItem[]>([])
  const [previewData, setPreviewData] = useState<{ name: string, data: string, type: string } | null>(null)
  const [textContent, setTextContent] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [searchIndex, setSearchIndex] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  
  
  // Tree view state
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [folderCache, setFolderCache] = useState<Record<string, FileItem[]>>({})
  
  // Move/Copy/Rename state
  const [operationModal, setOperationModal] = useState<{ type: 'move' | 'copy' | 'rename', file: string, isOpen: boolean }>({ type: 'move', file: '', isOpen: false })
  const [targetPath, setTargetPath] = useState("")

  // Image preview state
  const [zoomLevel, setZoomLevel] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  // Reset zoom/pan when preview file changes
  useEffect(() => {
     if (previewData) {
         setZoomLevel(1)
         setPan({ x: 0, y: 0 })
     }
  }, [previewData?.name])
  
  // Refs to track user intent and avoid closure staleness in useEffect
  const previewingFileRef = useRef<string | null>(null)
  const downloadingFilesRef = useRef<Set<string>>(new Set())
  const lastOperationRef = useRef<string | null>(null)

  // Request files on path change
  useEffect(() => {
    let pathStr = device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/')
    
    // For Windows, if path is empty, it means "My Computer" (Drives list)
    if (device.platform === 'pc' && currentPath.length === 0) {
      sendCommand(device.id, device.password || "", "files", { action: "drives" })
      return
    }

    // Ensure Windows drive root has a backslash (e.g., C: -> C:\)
    if (device.platform === 'pc' && currentPath.length === 1 && currentPath[0].endsWith(':')) {
      pathStr += '\\'
    }
    
    sendCommand(device.id, device.password || "", "files", { action: "list", path: pathStr || (device.platform === 'pc' ? '' : '/') })
  }, [currentPath, device.id, device.password, device.platform, sendCommand])

  // Handle incoming files
  useEffect(() => {
    if (lastMessage && lastMessage.deviceId === device.id) {
       if (lastMessage.type === 'file_list' && Array.isArray(lastMessage.data)) {
         const newFiles = lastMessage.data.map((f: any) => ({
            name: f.name,
            type: f.is_dir ? 'folder' : 'file',
            size: f.size ? formatSize(f.size) : '--',
            modified: new Date(f.mtime * 1000).toLocaleDateString(),
            ext: f.name.split('.').pop()
         }))
         
         // Try to determine which path this list belongs to
         // If lastMessage.path exists, use it. Otherwise, fallback to currentPath.
         const listPath = lastMessage.path 
            ? (device.platform === 'pc' ? lastMessage.path.replace(/\\/g, '\\') : lastMessage.path)
            : (device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/'));

         // Normalize current path string for comparison
         const currentPathStr = device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/');
         
         // Update cache
         setFolderCache(prev => ({ ...prev, [listPath]: newFiles }));

         // If this list matches current view, update currentFiles
         // Note: Windows paths might have trailing backslash issues, handle carefully
         const normalize = (p: string) => p.replace(/[\\/]+$/, '');
         if (normalize(listPath) === normalize(currentPathStr) || (currentPath.length === 0 && listPath === '')) {
             setCurrentFiles(newFiles);
         }
         
         // Show success toast if an operation was pending
         if (lastOperationRef.current) {
             let description = "文件列表已更新";
             if (lastOperationRef.current === 'move') description = "移动操作完成";
             else if (lastOperationRef.current === 'copy') description = "复制操作完成";
             else if (lastOperationRef.current === 'rename') description = "重命名操作完成";
             else if (lastOperationRef.current === 'delete') description = "删除操作完成";
             else if (lastOperationRef.current === 'upload') description = "上传操作完成";
             
             notify({
                 title: "操作完成",
                 message: description,
                 type: "success"
             });
             lastOperationRef.current = null;
         }
       } else if (lastMessage.type === 'drive_list' && Array.isArray(lastMessage.data)) {
         const newDrives = lastMessage.data.map((d: any) => ({
            name: d.name,
            type: 'folder' as const,
            size: d.size ? formatSize(d.size) : '--',
            modified: '--',
            ext: ''
         }))
         setCurrentFiles(newDrives)
         setFolderCache(prev => ({ ...prev, "": newDrives })); // Cache root/drives
       } else if (lastMessage.type === 'file_download') {
         const fileName = lastMessage.path.split(/[/\\]/).pop() || ''
         const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
         
         // Check if this is the file we are waiting to preview
         const targetPreview = previewingFileRef.current;
         const isPreview = targetPreview && (
            normalizePath(lastMessage.path) === normalizePath(targetPreview) ||
            lastMessage.path.endsWith(targetPreview.split(/[/\\]/).pop() || '') ||
            fileName === targetPreview.split(/[/\\]/).pop()
         );

         // Check if this is a file we explicitly requested to download
         const isDownload = downloadingFilesRef.current.has(lastMessage.path) || downloadingFilesRef.current.has(fileName);

         if (isPreview) {
            const ext = fileName.split('.').pop()?.toLowerCase() || ''
            
            let type = 'unknown'
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
               type = 'image'
            } else if (['txt', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'md', 'csv', 'log', 'xml', 'yaml', 'yml', 'ini', 'conf', 'sh', 'bat', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'php', 'rb', 'lua'].includes(ext)) {
               type = 'text'
            }
            
            setPreviewData({ name: fileName, data: lastMessage.data, type })
            
            // If text, decode immediately for editor
            if (type === 'text') {
                try {
                    const binaryString = atob(lastMessage.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                    }
                    const text = new TextDecoder('utf-8').decode(bytes);
                    setTextContent(text);
                } catch (e) {
                    setTextContent("无法解码文本内容");
                }
            }
            
            // Clear the ref as we've handled it
            previewingFileRef.current = null;
         } else if (isDownload) {
            // Trigger download
            const link = document.createElement('a')
            link.href = `data:application/octet-stream;base64,${lastMessage.data}`
            link.download = fileName || 'download'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            // Remove from tracking
            downloadingFilesRef.current.delete(lastMessage.path);
            downloadingFilesRef.current.delete(fileName);
         } else {
             // Ignore unsolicited downloads to prevent spam/bugs
             console.log("Ignored unsolicited file download:", lastMessage.path);
         }
       } else if (lastMessage.type === 'error') {
         if (lastMessage.message === 'Invalid device password') {
           if (onBack) onBack();
         }
       }
    }
  }, [lastMessage, device.id, onBack, notify])

  // Effect to load folder content when browsing in modal
  useEffect(() => {
      if (operationModal.isOpen && (operationModal.type === 'move' || operationModal.type === 'copy')) {
          const path = targetPath;
          // Check cache
          if (!folderCache[path]) {
               let pathStr = path;
               if (device.platform === 'pc' && path === '') {
                   // Request drives
                   sendCommand(device.id, device.password || '', 'files', { action: 'drives' })
                   return;
               }
               
               // Normal list
               sendCommand(device.id, device.password || '', 'files', { action: 'list', path: pathStr })
          }
      }
  }, [operationModal.isOpen, targetPath, folderCache, device.id, device.platform, sendCommand])

  const handleDownload = (fullPath: string) => {
    const fileName = fullPath.split(/[/\\]/).pop() || ''
    
    // Track intent
    downloadingFilesRef.current.add(fullPath);
    downloadingFilesRef.current.add(fileName);

    sendCommand(device.id, device.password || "", "files", { action: "download", path: fullPath })
    
    notify({
        title: "下载请求已发送",
        message: `正在请求下载 ${fileName}`,
        type: "info"
    })
  }

  const handlePreview = (fullPath: string) => {
    // Track intent
    previewingFileRef.current = fullPath;

    sendCommand(device.id, device.password || "", "files", { action: "download", path: fullPath })
  }

  const handleExpand = (name: string, currentFullPath: string) => {
      const newExpanded = new Set(expandedPaths);
      const fullPath = device.platform === 'pc' 
        ? (currentFullPath ? `${currentFullPath}\\${name}` : name)
        : (currentFullPath === '/' ? `/${name}` : `${currentFullPath}/${name}`);
      
      if (newExpanded.has(fullPath)) {
          newExpanded.delete(fullPath);
      } else {
          newExpanded.add(fullPath);
          // Fetch if not cached
          if (!folderCache[fullPath]) {
              sendCommand(device.id, device.password || '', 'files', { action: 'list', path: fullPath })
          }
      }
      setExpandedPaths(newExpanded);
  }

  const handleRename = (fullPath: string) => {
      setOperationModal({ type: 'rename', file: fullPath, isOpen: true });
      const name = fullPath.split(/[/\\]/).pop() || '';
      setTargetPath(name); 
  }

  const handleMove = (fullPath: string) => {
      setOperationModal({ type: 'move', file: fullPath, isOpen: true });
      setTargetPath(device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/'));
  }

  const handleCopy = (fullPath: string) => {
      setOperationModal({ type: 'copy', file: fullPath, isOpen: true });
      setTargetPath(device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/'));
  }

  const confirmOperation = () => {
      if (!operationModal.file || !targetPath) return;
      
      let destPath = '';
      const fileName = operationModal.file.split(/[/\\]/).pop();

      if (operationModal.type === 'rename') {
          // For rename, targetPath is the new name
          const parentPath = device.platform === 'pc' 
            ? operationModal.file.substring(0, operationModal.file.lastIndexOf('\\'))
            : operationModal.file.substring(0, operationModal.file.lastIndexOf('/'));
            
          destPath = device.platform === 'pc'
            ? (parentPath ? `${parentPath}\\${targetPath}` : targetPath)
            : (parentPath === '/' ? `/${targetPath}` : `${parentPath}/${targetPath}`);
      } else {
          // For move/copy, targetPath is the destination folder
          destPath = device.platform === 'pc' 
            ? (targetPath.endsWith('\\') ? `${targetPath}${fileName}` : `${targetPath}\\${fileName}`)
            : (targetPath.endsWith('/') ? `${targetPath}${fileName}` : `${targetPath}/${fileName}`);
      }

      sendCommand(device.id, device.password || '', 'files', { 
              action: operationModal.type === 'move' ? 'mv' : (operationModal.type === 'copy' ? 'cp' : 'mv'), // Rename is essentially move
              src: operationModal.file, 
              dst: destPath 
          });
      
      lastOperationRef.current = operationModal.type;
      
      notify({
          title: "请求已发送",
          message: `正在请求${operationModal.type === 'move' ? '移动' : (operationModal.type === 'copy' ? '复制' : '重命名')}文件...`,
          type: "info"
      })
      
      setOperationModal({ ...operationModal, isOpen: false });
      // Refresh current view
      const currentPathStr = device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/');
      sendCommand(device.id, device.password || '', 'files', { action: 'list', path: currentPathStr || (device.platform === 'pc' ? '' : '/') })
  }

  const handleSaveFile = () => {
    if (!previewData) return;
    
    // Encode text back to base64
    try {
        // Use TextEncoder to handle UTF-8 correctly
        const encoder = new TextEncoder();
        const data = encoder.encode(textContent);
        // Convert Uint8Array to binary string
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);
        
        const pathStr = device.platform === 'pc' ? [...currentPath, previewData.name].join('\\') : [...currentPath, previewData.name].join('/')
        
        sendCommand(device.id, device.password || '', 'files', { action: 'upload', path: pathStr, data: base64 })
        
        lastOperationRef.current = 'upload';
        notify({
            title: "保存请求已发送",
            message: "正在上传文件...",
            type: "info"
        })
    } catch (e) {
        notify({
            title: "保存失败",
            message: String(e),
            type: "error",
            isModal: true
        })
    }
  }

  const handleSearch = () => {
    if (!textareaRef.current || !searchKeyword) return;
    
    const text = textareaRef.current.value;
    const nextIndex = text.toLowerCase().indexOf(searchKeyword.toLowerCase(), searchIndex + 1);
    
    if (nextIndex !== -1) {
        setSearchIndex(nextIndex);
        scrollToMatch(nextIndex);
    } else {
        // Wrap around
        const firstIndex = text.toLowerCase().indexOf(searchKeyword.toLowerCase());
        if (firstIndex !== -1) {
            setSearchIndex(firstIndex);
            scrollToMatch(firstIndex);
        } else {
            notify({
                title: "未找到内容",
                message: "搜索关键词在当前文本中未找到",
                type: "info"
            })
        }
    }
  }

  const scrollToMatch = (index: number) => {
      if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(index, index + searchKeyword.length);
          
          // Calculate line number to scroll
          const textBefore = textareaRef.current.value.substring(0, index);
          const lines = textBefore.split('\n').length;
          const lineHeight = 20; // Approximate line height in px
          const scrollTop = (lines - 5) * lineHeight; // Scroll to show context
          
          textareaRef.current.scrollTop = scrollTop > 0 ? scrollTop : 0;
          if (backdropRef.current) {
              backdropRef.current.scrollTop = textareaRef.current.scrollTop;
          }
      }
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (backdropRef.current) {
          backdropRef.current.scrollTop = e.currentTarget.scrollTop;
          backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
  }

  // Highlight renderer
  const renderHighlights = (text: string, keyword: string) => {
      if (!keyword) return text;
      
      const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
      return parts.map((part, i) => 
          part.toLowerCase() === keyword.toLowerCase() ? 
              <span key={i} className="bg-yellow-500/50 text-transparent">{part}</span> : 
              <span key={i} className="text-transparent">{part}</span>
      );
  }

  const handleRemoteOpen = (fullPath: string) => {
    sendCommand(device.id, device.password || '', 'exec', device.platform === 'pc' ? `start "" "${fullPath}"` : `xdg-open "${fullPath}"`)
    notify({
        title: "远程打开请求已发送",
        message: `尝试在设备上打开文件`,
        type: "info"
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDownloadImage = () => {
    if (!previewData) return;
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${previewData.data}`;
    link.download = previewData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleDelete = (fullPath: string) => {
    if (!confirm(`确定要删除 ${fullPath} 吗?`)) return
    sendCommand(device.id, device.password || '', 'files', { action: 'rm', path: fullPath })
    
    lastOperationRef.current = 'delete';
    
    notify({
        title: "删除请求已发送",
        message: `正在请求删除文件...`,
        type: "info"
    })
    
    // Refresh
    setTimeout(() => {
        const currentPathStr = device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/');
        sendCommand(device.id, device.password || '', 'files', { action: 'list', path: currentPathStr || (device.platform === 'pc' ? '' : '/') })
    }, 500)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      const pathStr = device.platform === 'pc' ? [...currentPath, file.name].join('\\') : [...currentPath, file.name].join('/')
      
      sendCommand(device.id, device.password || '', 'files', { action: 'upload', path: pathStr, data: base64 })
      
      lastOperationRef.current = 'upload';
      notify({
          title: "上传请求已发送",
          message: `正在上传 ${file.name}...`,
          type: "info"
      })
      
      // Refresh list after a delay
      setTimeout(() => {
          const currentPathStr = device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/');
          sendCommand(device.id, device.password || '', 'files', { action: 'list', path: currentPathStr || (device.platform === 'pc' ? '' : '/') })
      }, 1000)
    }
    reader.readAsDataURL(file)
  }

  const filteredFiles = currentFiles.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleNavigate = (path: string) => {
    if (device.platform === 'pc') {
        setCurrentPath(path.split('\\').filter(Boolean));
    } else {
        const parts = path.split('/').filter(Boolean);
        if (parts.length > 0) {
            parts[0] = '/' + parts[0];
        }
        setCurrentPath(parts);
    }
  }

  const handleUp = () => {
    setCurrentPath(prev => prev.length > 0 ? prev.slice(0, -1) : prev)
  }

  const toggleSelect = (name: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const RenderFileItem = ({ item, path, depth = 0 }: { item: FileItem, path: string, depth?: number }) => {
    const IconComponent = getFileIcon(item)
    const iconColor = getFileIconColor(item)
    const isSelected = selectedFiles.has(item.name)
    
    const fullPath = device.platform === 'pc' 
        ? (path ? `${path}\\${item.name}` : item.name)
        : (path === '/' ? `/${item.name}` : `${path}/${item.name}`);
        
    const isExpanded = expandedPaths.has(fullPath);
    const children = folderCache[fullPath];
    const isLoading = isExpanded && !children;

    return (
      <div key={fullPath}>
        <div
          className={cn(
            "group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors rounded-sm",
            isSelected ? "bg-primary/10 text-foreground" : "hover:bg-secondary/50 text-foreground"
          )}
          style={{ paddingLeft: `${depth * 16}px` }}
          onClick={() => {
            if (item.type === "folder") handleNavigate(fullPath)
            else toggleSelect(item.name)
          }}
        >
          {item.type === "folder" ? (
              <div 
                className="p-0.5 hover:bg-muted rounded-sm cursor-pointer mr-1"
                onClick={(e) => {
                    e.stopPropagation();
                    handleExpand(item.name, path);
                }}
              >
                  {isExpanded ? <Minus className="h-3 w-3 text-muted-foreground" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
              </div>
          ) : (
              <div className="w-4 mr-1" />
          )}
          
          <IconComponent className={cn("h-4 w-4 shrink-0", iconColor)} />
          <span className="flex-1 truncate font-mono">{item.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">{item.size || "--"}</span>
          <span className="text-[10px] text-muted-foreground shrink-0 hidden md:block ml-4 w-20">{item.modified}</span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-card border-border text-foreground">
              <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleRemoteOpen(fullPath) }}>
                <ExternalLink className="h-3 w-3 mr-2" /> 远程打开
              </DropdownMenuItem>
              {item.type === 'file' && (
                <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handlePreview(fullPath) }}>
                  <Eye className="h-3 w-3 mr-2" /> 预览
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleDownload(fullPath) }}>
                <Download className="h-3 w-3 mr-2" /> 下载
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleRename(fullPath) }}>
                <Pencil className="h-3 w-3 mr-2" /> 重命名
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleCopy(fullPath) }}>
                <Copy className="h-3 w-3 mr-2" /> 复制到...
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-secondary focus:text-secondary-foreground" onClick={(e) => { e.stopPropagation(); handleMove(fullPath) }}>
                <Scissors className="h-3 w-3 mr-2" /> 移动到...
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem 
                className="text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); handleDelete(fullPath) }}
              >
                <Trash2 className="h-3 w-3 mr-2" /> 删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Render Children */}
        {isExpanded && (
            <div className="border-l border-border/50 ml-[19px]">
                {isLoading ? (
                    <div className="pl-8 py-1 text-xs text-muted-foreground">加载中...</div>
                ) : (
                    children?.map(child => (
                        <RenderFileItem 
                            key={child.name} 
                            item={child} 
                            path={fullPath} 
                            depth={depth + 1} 
                        />
                    ))
                )}
            </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <h2 className="text-sm font-medium text-foreground">文件管理 - {device.name}</h2>
        <div className="flex items-center gap-1">
          <div className="relative">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUpload} />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
                let pathStr = device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/')
                if (device.platform === 'pc' && currentPath.length === 1 && currentPath[0].endsWith(':')) {
                  pathStr += '\\'
                }
                sendCommand(device.id, device.password || '', 'files', { action: 'list', path: pathStr || (device.platform === 'pc' ? 'C:\\' : '/') })
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Path bar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-card/50 overflow-x-auto shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => setCurrentPath(device.platform === 'pc' ? [] : ["/sdcard"])}
        >
          <Home className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
          onClick={handleUp}
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <div className="flex items-center gap-0.5 flex-1 min-w-0">
          {currentPath.length === 0 && device.platform === 'pc' && (
            <span className="text-[11px] font-mono text-muted-foreground px-1">此电脑</span>
          )}
          {currentPath.map((segment, i) => (
            <div key={i} className="flex items-center shrink-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
              <button 
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-secondary transition-colors"
                onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
              >
                {segment}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", viewMode === "list" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setViewMode("list")}
          >
            <List className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", viewMode === "grid" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-1.5 border-b border-border bg-card/50 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-8 text-xs bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {viewMode === "list" ? (
          <div className="py-1">
            {/* List header */}
            <div className="flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border mx-2 mb-1">
              <div className="w-3 shrink-0" />
              <div className="w-4 shrink-0" />
              <span className="flex-1">名称</span>
              <span className="shrink-0 hidden sm:block">大小</span>
              <span className="shrink-0 hidden md:block ml-4 w-20">修改时间</span>
              <div className="w-5 shrink-0" />
            </div>
            {filteredFiles.map(item => (
                <RenderFileItem 
                    key={item.name} 
                    item={item} 
                    path={device.platform === 'pc' ? currentPath.join('\\') : currentPath.join('/')} 
                />
            ))}
            {filteredFiles.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-xs">
                    {currentFiles.length === 0 ? "正在加载..." : "没有找到文件"}
                </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-3">
            {filteredFiles.map(item => {
              const IconComponent = getFileIcon(item)
              const iconColor = getFileIconColor(item)
              return (
                <button
                  key={item.name}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-md border transition-colors text-center",
                    selectedFiles.has(item.name)
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-secondary/50"
                  )}
                  onClick={() => item.type === "folder" ? handleNavigate(device.platform === 'pc' ? (currentPath.join('\\') + '\\' + item.name) : (currentPath.join('/') + '/' + item.name)) : toggleSelect(item.name)}
                >
                  <IconComponent className={cn("h-8 w-8", iconColor)} />
                  <span className="text-[10px] font-mono text-foreground truncate w-full">{item.name}</span>
                  {item.size && <span className="text-[9px] text-muted-foreground">{item.size}</span>}
                </button>
              )
            })}
          </div>
        )}
        </ScrollArea>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card text-[10px] text-muted-foreground shrink-0">
        <span>{filteredFiles.length} 个项目</span>
        {selectedFiles.size > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5 bg-secondary text-secondary-foreground">
            已选择 {selectedFiles.size} 个
          </Badge>
        )}
      </div>

      {/* Operation Modal */}
      {operationModal.isOpen && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card border border-border shadow-lg rounded-lg w-full max-w-md p-4 space-y-4 flex flex-col max-h-[80vh]">
                  <div className="flex items-center justify-between shrink-0">
                      <h3 className="font-medium text-sm">
                          {operationModal.type === 'move' ? '移动到...' : (operationModal.type === 'copy' ? '复制到...' : '重命名')}
                      </h3>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOperationModal({ ...operationModal, isOpen: false })}>
                          <X className="h-4 w-4" />
                      </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground truncate shrink-0">
                      {operationModal.type === 'rename' ? '原名称: ' : '项目: '} {operationModal.file.split(/[/\\]/).pop()}
                  </div>

                  {operationModal.type === 'rename' ? (
                      <div className="space-y-1">
                          <label className="text-xs font-medium">新名称</label>
                          <Input 
                              value={targetPath}
                              onChange={(e) => setTargetPath(e.target.value)}
                              className="h-8 text-xs"
                              autoFocus
                          />
                      </div>
                  ) : (
                      <>
                        {/* Path Navigation */}
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded border border-border shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" 
                                disabled={targetPath === '' || (device.platform !== 'pc' && targetPath === '/')}
                                onClick={() => {
                                    // Handle Up
                                    if (device.platform === 'pc') {
                                        if (targetPath.includes('\\')) {
                                            setTargetPath(targetPath.substring(0, targetPath.lastIndexOf('\\')));
                                        } else {
                                            setTargetPath(''); // Go to drives
                                        }
                                    } else {
                                        if (targetPath === '/') return;
                                        const parts = targetPath.split('/').filter(Boolean);
                                        parts.pop();
                                        setTargetPath(parts.length > 0 ? '/' + parts.join('/') : '/');
                                    }
                                }}
                            >
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <div className="text-xs font-mono truncate flex-1">
                                {targetPath || (device.platform === 'pc' ? '此电脑' : '/')}
                            </div>
                        </div>

                        {/* Folder List */}
                        <div className="flex-1 min-h-0 border border-border rounded bg-background overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="p-1">
                                    {/* Loading State */}
                                    {!folderCache[targetPath] && targetPath !== '' && (
                                        <div className="p-4 text-center text-xs text-muted-foreground">加载中...</div>
                                    )}
                                    
                                    {/* Empty State */}
                                    {folderCache[targetPath]?.filter(f => f.type === 'folder').length === 0 && (
                                        <div className="p-4 text-center text-xs text-muted-foreground">无子文件夹</div>
                                    )}

                                    {/* Folders */}
                                    {folderCache[targetPath]?.filter(f => f.type === 'folder').map(folder => (
                                        <div 
                                            key={folder.name}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/50 rounded cursor-pointer text-xs"
                                            onClick={() => {
                                                const newPath = device.platform === 'pc' 
                                                    ? (targetPath ? `${targetPath}\\${folder.name}` : folder.name)
                                                    : (targetPath === '/' ? `/${folder.name}` : `${targetPath}/${folder.name}`);
                                                setTargetPath(newPath);
                                            }}
                                        >
                                            <Folder className="h-4 w-4 text-blue-400 shrink-0" />
                                            <span className="truncate">{folder.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                      </>
                  )}

                  <div className="flex justify-end gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOperationModal({ ...operationModal, isOpen: false })}>
                          取消
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={confirmOperation}>
                          {operationModal.type === 'move' ? '移动到此处' : (operationModal.type === 'copy' ? '复制到此处' : '确定')}
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 sm:p-8">
          <div className="relative w-full max-w-4xl max-h-full bg-card rounded-xl shadow-2xl flex flex-col overflow-hidden border border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
              <h3 className="text-sm font-medium text-foreground truncate pr-4">{previewData.name}</h3>
              <div className="flex items-center gap-2">
                {previewData.type === 'text' && (
                  <>
                    <div className="flex items-center gap-1 bg-background border border-border rounded-md px-2 py-1 h-8">
                        <Search className="h-3 w-3 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="搜索..." 
                            className="w-24 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleSearch}>
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSaveFile}>
                        <FileText className="h-3 w-3 mr-1" /> 保存
                    </Button>
                  </>
                )}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPreviewData(null)}
                >
                    <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-0 bg-background flex flex-col min-h-[500px] h-[80vh]">
              {previewData.type === 'image' ? (
                <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-muted/30">
                    {/* Toolbar */}
                    <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-background/90 backdrop-blur shadow-sm border border-border p-1 rounded-lg">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.max(0.1, z - 0.1))}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center text-xs font-mono tabular-nums">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.min(5, z + 0.1))}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setZoomLevel(1); setPan({x:0, y:0}); }}>
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownloadImage}>
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                    
                    {/* Image Area */}
                    <div 
                        className="flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-move"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <img 
                            src={`data:image/jpeg;base64,${previewData.data}`} 
                            alt={previewData.name} 
                            draggable={false}
                            style={{ 
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`, 
                                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain'
                            }}
                            className="select-none pointer-events-none shadow-lg rounded-sm" 
                        />
                    </div>
                </div>
              ) : previewData.type === 'text' ? (
                <div className="relative flex-1 min-h-0 w-full">
                    {/* Highlight Backdrop */}
                    <div 
                        ref={backdropRef}
                        className="absolute inset-0 w-full h-full p-4 text-xs font-mono leading-relaxed break-words whitespace-pre-wrap outline-none border-none resize-none bg-transparent overflow-hidden pointer-events-none z-0"
                        aria-hidden="true"
                    >
                        {renderHighlights(textContent, searchKeyword)}
                    </div>
                    
                    {/* Editor Textarea */}
                    <textarea
                        ref={textareaRef}
                        className="absolute inset-0 w-full h-full p-4 text-xs font-mono leading-relaxed break-words whitespace-pre-wrap outline-none border-none resize-none bg-transparent text-foreground z-10 caret-foreground"
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        onScroll={handleScroll}
                        spellCheck={false}
                    />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
                  <File className="h-12 w-12 opacity-50" />
                  <p className="text-sm text-muted-foreground">不支持预览此文件类型</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = `data:application/octet-stream;base64,${previewData.data}`
                      link.download = previewData.name
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      setPreviewData(null)
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> 下载文件
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
