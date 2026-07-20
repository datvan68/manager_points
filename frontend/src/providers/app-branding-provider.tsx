'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { API_BASE } from '@/api/config'
import { appBrandingApi, type AppBranding } from '@/api/system-api'

const fallbackBranding: AppBranding = { name: 'HOCSINHSINHVIEN - Hệ thống quản lý', shortName: 'HSSV', version: 'static' }
const AppBrandingContext = createContext(fallbackBranding)

export function appIconUrl(size: '180' | '192' | '512' | 'maskable-512', version: string) {
  return version === 'static'
    ? `/icons/${size === 'maskable-512' ? 'icon-maskable-512' : size === '180' ? 'apple-touch-icon' : `icon-${size}`}.png`
    : `${API_BASE}/app-branding/icons/${size}/${version}.png`
}

export function AppBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState(fallbackBranding)

  useEffect(() => {
    let active = true
    void appBrandingApi.get().then((value) => active && setBranding(value)).catch(() => undefined)
    const events = new EventSource(`${API_BASE}/app-branding/events`)
    events.onmessage = (event) => {
      try { if (active) setBranding(JSON.parse(event.data) as AppBranding) } catch { /* Ignore malformed event data. */ }
    }
    return () => { active = false; events.close() }
  }, [])

  useEffect(() => {
    document.title = branding.name
    document.querySelector('meta[name="application-name"]')?.setAttribute('content', branding.name)
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', branding.shortName)
    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
    if (appleIcon) appleIcon.href = appIconUrl('180', branding.version)
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => { link.href = appIconUrl('192', branding.version) })
  }, [branding])

  return <AppBrandingContext.Provider value={useMemo(() => branding, [branding])}>{children}</AppBrandingContext.Provider>
}

export function useAppBranding() { return useContext(AppBrandingContext) }
