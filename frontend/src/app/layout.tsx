import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/providers/auth-provider'
import { Suspense } from 'react'
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt'
import { AppBrandingProvider } from '@/providers/app-branding-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HOCSINHSINHVIEN - Hệ thống quản lý',
  description: 'Hệ thống quản lý công việc và sinh viên',
  applicationName: 'HOCSINHSINHVIEN',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HSSV',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#EBF2FA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Suspense fallback={null}>
          <AuthProvider>
            <AppBrandingProvider>
              {children}
              <Toaster position="top-right" richColors />
              <PwaInstallPrompt />
            </AppBrandingProvider>
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  )
}
