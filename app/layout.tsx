import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from 'sonner'
import { WebSocketProvider } from '@/components/websocket-provider'
import { NotificationProvider } from '@/components/ui/custom-notification'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'RootDesk - 专业远程控制与桌面管理平台',
  description: 'RootDesk 是一款高性能、安全可靠的远程控制解决方案，支持桌面管理、实时监控、文件传输与 IT 远程运维。适用于企业办公、远程技术支持及个人设备管理。',
  keywords: ['远程控制', '远程桌面', '桌面管理', '远程办公', '实时监控', '文件传输', 'IT运维', 'RootDesk', '远程技术支持', '跨平台远程控制'],
  authors: [{ name: 'RootDesk' }],
  robots: 'index, follow',
  generator: 'rootdesk.cn',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NotificationProvider>
            <WebSocketProvider>
              {children}
            </WebSocketProvider>
            <Toaster />
            <SonnerToaster position="top-center" richColors />
          </NotificationProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
