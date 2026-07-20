'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'hssv-pwa-install-prompt-dismissed'

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function canRegisterServiceWorker() {
  return window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [installed, setInstalled] = useState(false)
  const [showIosInstructions, setShowIosInstructions] = useState(false)

  useEffect(() => {
    const standalone = isStandalone()
    const wasDismissed = window.localStorage.getItem(DISMISS_KEY) === 'true'

    setInstalled(standalone)
    setDismissed(wasDismissed)
    setShowIosInstructions(!standalone && !wasDismissed && isIOS())

    if ('serviceWorker' in navigator && canRegisterServiceWorker()) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Installation UI remains available if registration is temporarily unavailable.
      })
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setShowIosInstructions(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
    setShowIosInstructions(false)
    setDeferredPrompt(null)
  }

  const install = async () => {
    if (!deferredPrompt) {
      return
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)

    if (choice.outcome === 'dismissed') {
      dismiss()
    }
  }

  if (installed || dismissed || (!deferredPrompt && !showIosInstructions)) {
    return null
  }

  return (
    <aside
      aria-label="Cài đặt ứng dụng"
      className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-md rounded-xl border border-blue-100 bg-white p-4 shadow-xl sm:left-auto sm:right-6"
    >
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Thêm HSSV vào thiết bị</p>
          {showIosInstructions ? (
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Trong Safari, nhấn Chia sẻ rồi chọn <span className="font-medium">Thêm vào Màn hình chính</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Mở nhanh hơn từ biểu tượng ứng dụng trên màn hình chính hoặc máy tính.
            </p>
          )}
        </div>
        <button
          aria-label="Đóng hướng dẫn cài đặt"
          className="h-8 w-8 rounded-md text-lg leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={dismiss}
          type="button"
        >
          ×
        </button>
      </div>
      {!showIosInstructions && (
        <button
          className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={() => void install()}
          type="button"
        >
          Cài đặt ứng dụng
        </button>
      )}
    </aside>
  )
}
