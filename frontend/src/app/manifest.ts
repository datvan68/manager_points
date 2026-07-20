import type { MetadataRoute } from 'next'
import { API_BASE } from '@/api/config'

export const dynamic = 'force-dynamic'

async function getBranding() {
  try {
    const response = await fetch(`${API_BASE}/app-branding`, { cache: 'no-store' })
    if (response.ok) return await response.json() as { name: string; shortName: string; version: string }
  } catch { /* Static metadata remains available while the API is offline. */ }
  return { name: 'HOCSINHSINHVIEN - Hệ thống quản lý', shortName: 'HSSV', version: 'static' }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getBranding()
  const icon = (size: '192' | '512' | 'maskable-512') => branding.version === 'static'
    ? `/icons/${size === 'maskable-512' ? 'icon-maskable-512' : `icon-${size}`}.png`
    : `${API_BASE}/app-branding/icons/${size}/${branding.version}.png`

  return {
    name: branding.name,
    short_name: branding.shortName,
    description: 'Hệ thống quản lý công việc và sinh viên',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'vi',
    background_color: '#f9fafb',
    theme_color: '#155dfc',
    icons: [
      { src: icon('192'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon('512'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon('maskable-512'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
