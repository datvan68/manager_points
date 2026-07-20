'use client'

import { useEffect, useRef, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = 'hidden' | 'ready' | 'requesting' | 'accepted' | 'ios' | 'dismissed' | 'error' | 'installed'
const DISMISS_KEY = 'hssv-pwa-install-prompt-dismissed'

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || iosNavigator.standalone)
}
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) }
function canRegisterServiceWorker() { return window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname) }

export function PwaInstallPrompt() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const installedRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<InstallState>('hidden')

  const clearTimeoutState = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }

  useEffect(() => {
    installedRef.current = isStandalone()
    if (installedRef.current) setState('installed')
    else if (window.localStorage.getItem(DISMISS_KEY) !== 'true' && isIOS()) setState('ios')

    if ('serviceWorker' in navigator && canRegisterServiceWorker()) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      promptRef.current = event as BeforeInstallPromptEvent
      if (!installedRef.current && window.localStorage.getItem(DISMISS_KEY) !== 'true') setState('ready')
    }
    const onAppInstalled = () => {
      installedRef.current = true
      promptRef.current = null
      clearTimeoutState()
      setState('installed')
    }
    const onInstallRequest = () => {
      if (installedRef.current) return
      if (isIOS()) { setState('ios'); return }
      const prompt = promptRef.current
      if (!prompt) { setState('error'); return }
      void install(prompt)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    window.addEventListener('hssv-pwa-install-request', onInstallRequest)
    return () => {
      clearTimeoutState()
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      window.removeEventListener('hssv-pwa-install-request', onInstallRequest)
    }
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, 'true')
    promptRef.current = null
    clearTimeoutState()
    setState('dismissed')
  }

  async function install(prompt = promptRef.current) {
    if (!prompt) { setState('error'); return }
    try {
      setState('requesting')
      await prompt.prompt()
      const choice = await prompt.userChoice
      promptRef.current = null
      if (choice.outcome === 'dismissed') { dismiss(); return }
      setState('accepted')
      timeoutRef.current = setTimeout(() => setState((current) => current === 'accepted' ? 'error' : current), 15000)
    } catch {
      setState('error')
    }
  }

  if (state === 'hidden' || state === 'dismissed' || state === 'installed') return null
  const isIos = state === 'ios'
  const isBusy = state === 'requesting' || state === 'accepted'
  const copy = state === 'requesting' ? 'Đang mở hộp thoại cài đặt của trình duyệt…'
    : state === 'accepted' ? 'Đã xác nhận. Đang hoàn tất cài đặt; biểu tượng sẽ xuất hiện trên thiết bị.'
    : state === 'error' ? 'Chưa thể mở cài đặt. Hãy dùng menu của trình duyệt để cài ứng dụng.'
    : isIos ? 'Trong Safari, nhấn Chia sẻ rồi chọn Thêm vào Màn hình chính.'
    : 'Mở nhanh hơn từ biểu tượng ứng dụng trên màn hình chính hoặc máy tính.'

  return (
    <aside aria-label="Cài đặt ứng dụng" className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-md rounded-2xl border border-white/70 bg-white/70 p-4 text-[#1E293B] shadow-sm shadow-slate-300/40 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-semibold leading-6">Thêm HSSV vào thiết bị</p>
          <p aria-live="polite" className="mt-1 text-sm leading-5 text-[#64748B]">{copy}</p>
        </div>
        {!isBusy && <button aria-label="Đóng hướng dẫn cài đặt" className="flex h-8 w-8 items-center justify-center rounded-xl text-lg text-[#64748B] transition-all duration-150 ease-out hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8]" onClick={dismiss} type="button">×</button>}
      </div>
      {!isIos && (
        <button className="mt-3 w-full rounded-xl bg-[#1A73E8] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8] disabled:cursor-wait disabled:opacity-70" disabled={isBusy} onClick={() => void install()} type="button">
          {state === 'error' ? 'Thử lại' : isBusy ? 'Đang cài đặt ứng dụng…' : 'Cài đặt ứng dụng'}
        </button>
      )}
    </aside>
  )
}
