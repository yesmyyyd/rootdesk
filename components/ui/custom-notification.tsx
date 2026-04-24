"use client"

import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number
  isModal?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
}

interface NotificationContextType {
  notify: (notification: Omit<Notification, 'id'>) => void
  close: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notificationsRef = useRef<Notification[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keep ref in sync with state
  useEffect(() => {
    notificationsRef.current = notifications
  }, [notifications])

  const close = useCallback((id: string) => {
    console.log('Closing notification:', id)
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id)
      notificationsRef.current = filtered
      return filtered
    })
  }, [])

  const notify = useCallback((notification: Omit<Notification, 'id'>) => {
    // Prevent duplicate modals with same message
    if (notification.isModal) {
      const isDuplicate = notificationsRef.current.some(n => n.isModal && n.message === notification.message);
      if (isDuplicate) {
        console.log('Duplicate modal notification ignored:', notification.message);
        return;
      }
    }

    const id = Math.random().toString(36).substring(2, 9)
    const newNotification = { ...notification, id }
    
    console.log('Adding notification:', newNotification.title, newNotification.isModal ? '(Modal)' : '(Toast)');
    
    setNotifications((prev) => {
      const updated = [...prev, newNotification]
      notificationsRef.current = updated
      return updated
    })

    if (!notification.isModal && notification.duration !== 0) {
      setTimeout(() => {
        close(id)
      }, notification.duration || 5000)
    }
  }, [close])

  const toasts = notifications.filter(n => !n.isModal)
  const modals = notifications.filter(n => n.isModal)

  const notificationContent = mounted ? createPortal(
    <>
      {/* Toasts Container */}
      <div className="fixed bottom-4 right-4 z-[10001] flex flex-col gap-2 w-full max-w-[400px] pointer-events-none px-4 sm:px-0">
        <AnimatePresence mode="popLayout">
          {toasts.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md",
                n.type === 'error' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                n.type === 'success' ? "bg-success/10 border-success/20 text-success" :
                n.type === 'warning' ? "bg-warning/10 border-warning/20 text-warning" :
                "bg-card/80 border-border text-foreground"
              )}
            >
              <div className="shrink-0 mt-0.5">
                {n.type === 'error' && <AlertCircle className="h-5 w-5" />}
                {n.type === 'success' && <CheckCircle2 className="h-5 w-5" />}
                {n.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
                {n.type === 'info' && <Info className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold leading-none mb-1">{n.title}</h4>
                <p className="text-xs opacity-90 leading-relaxed">{n.message}</p>
              </div>
              <button 
                type="button"
                onClick={() => close(n.id)}
                className="shrink-0 p-1 hover:bg-black/5 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modals Container */}
      {modals.map((n) => (
        <Dialog key={n.id} open={true} onOpenChange={(open) => { if (!open) close(n.id) }}>
          <DialogContent className="sm:max-w-md bg-card border-border text-foreground p-0 overflow-hidden">
            <div className={cn(
              "h-2 w-full",
              n.type === 'error' ? "bg-destructive" :
              n.type === 'success' ? "bg-success" :
              n.type === 'warning' ? "bg-warning" :
              "bg-primary"
            )} />
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                  n.type === 'error' ? "bg-destructive/10 text-destructive" :
                  n.type === 'success' ? "bg-success/10 text-success" :
                  n.type === 'warning' ? "bg-warning/10 text-warning" :
                  "bg-primary/10 text-primary"
                )}>
                  {n.type === 'error' && <AlertCircle className="h-6 w-6" />}
                  {n.type === 'success' && <CheckCircle2 className="h-6 w-6" />}
                  {n.type === 'warning' && <AlertTriangle className="h-6 w-6" />}
                  {n.type === 'info' && <Info className="h-6 w-6" />}
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">{n.title}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">系统通知</DialogDescription>
                </div>
              </div>
              <div className="text-sm text-foreground/80 leading-relaxed mb-6">
                {n.message}
              </div>
              <DialogFooter className="sm:justify-end gap-2">
                {n.onCancel && (
                  <Button
                    variant="outline"
                    className="px-6 rounded-xl font-medium transition-all active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation();
                      n.onCancel?.();
                      close(n.id);
                    }}
                  >
                    {n.cancelText || '取消'}
                  </Button>
                )}
                <Button
                  variant={n.type === 'error' ? 'destructive' : n.type === 'success' ? 'default' : 'default'}
                  className={cn(
                    "px-8 rounded-xl font-medium transition-all active:scale-95",
                    n.type === 'success' && "bg-success hover:bg-success/90 text-success-foreground"
                  )}
                  onClick={(e) => {
                    console.log('Confirm button clicked for:', n.id);
                    e.stopPropagation();
                    n.onConfirm?.();
                    close(n.id);
                  }}
                >
                  {n.confirmText || '确定'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </>,
    document.body
  ) : null

  return (
    <NotificationContext.Provider value={{ notify, close }}>
      {children}
      {notificationContent}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
