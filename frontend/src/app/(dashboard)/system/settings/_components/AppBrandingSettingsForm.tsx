'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { ImagePlus, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { appBrandingApi } from '@/api/system-api'
import { useAppBranding } from '@/providers/app-branding-provider'
import { useAuth } from '@/providers/auth-provider'

const iconSizes = { 'icon-180': 180, 'icon-192': 192, 'icon-512': 512, 'icon-maskable-512': 512 } as const

function makeIcon(source: string, size: number) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) { reject(new Error('Canvas is unavailable')); return }
      const crop = Math.min(image.naturalWidth, image.naturalHeight)
      context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, 0, 0, size, size)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Cannot create PNG')), 'image/png')
    }
    image.onerror = () => reject(new Error('Cannot load the selected image'))
    image.src = source
  })
}

export default function AppBrandingSettingsForm() {
  const { user } = useAuth()
  const branding = useAppBranding()
  const [name, setName] = useState(branding.name)
  const [shortName, setShortName] = useState(branding.shortName)
  const [source, setSource] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const allowed = Boolean(user && ((user as any).permissions?.includes('SYSTEM_ADMIN') || (user as any).role?.toLowerCase?.().includes('admin')))

  useEffect(() => { setName(branding.name); setShortName(branding.shortName) }, [branding])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Vui lòng chọn ảnh hợp lệ.'); return }
    if (source) URL.revokeObjectURL(source)
    setSource(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!source) { toast.error('Vui lòng chọn biểu tượng vuông cho ứng dụng.'); return }
    try {
      setSaving(true)
      const icons = Object.fromEntries(await Promise.all(Object.entries(iconSizes).map(async ([key, size]) => [key, await makeIcon(source, size)]))) as Record<string, Blob>
      await appBrandingApi.update({ name, shortName, icons })
      toast.success('Đã cập nhật thương hiệu ứng dụng cho tất cả tài khoản đang mở.')
    } catch (error: any) {
      toast.error(error.message || 'Không thể lưu thương hiệu ứng dụng.')
    } finally { setSaving(false) }
  }

  if (!allowed) return null
  return (
    <section className="rounded-2xl border border-white/70 bg-white/50 p-5 shadow-sm shadow-slate-300/40 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A73E8]/10 text-[#1A73E8]"><ImagePlus size={20} /></div>
        <div><h2 className="text-[18px] font-semibold text-[#1E293B]">Thương hiệu ứng dụng</h2><p className="text-[13px] text-[#64748B]">Tên và biểu tượng cho tab, PWA và các tài khoản đang mở.</p></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-[12px] font-medium text-[#1E293B]">Tên ứng dụng<input aria-label="Tên ứng dụng" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-white/80 bg-white/50 px-3 py-2 text-[13px] outline-none transition-all duration-150 focus:ring-2 focus:ring-[#1A73E8]/30" /></label>
        <label className="text-[12px] font-medium text-[#1E293B]">Tên ngắn trên biểu tượng<input aria-label="Tên ngắn trên biểu tượng" value={shortName} maxLength={24} onChange={(event) => setShortName(event.target.value)} className="mt-1 w-full rounded-xl border border-white/80 bg-white/50 px-3 py-2 text-[13px] outline-none transition-all duration-150 focus:ring-2 focus:ring-[#1A73E8]/30" /></label>
      </div>
      <div className="mt-3 flex items-center gap-3"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-[13px] font-medium text-[#1E293B] transition-all duration-150 hover:scale-[1.01]"><ImagePlus size={16} /> Chọn biểu tượng vuông<input aria-label="Chọn biểu tượng vuông" className="sr-only" type="file" accept="image/*" onChange={onFileChange} /></label>{source && <img src={source} alt="Xem trước biểu tượng" className="h-12 w-12 rounded-xl border border-white/80 object-cover" />}</div>
      <div className="mt-4 flex justify-end"><button type="button" disabled={saving} onClick={() => void save()} className="flex items-center gap-2 rounded-xl bg-[#1A73E8] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 hover:scale-[1.01] hover:bg-blue-600 disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu thương hiệu</button></div>
    </section>
  )
}
