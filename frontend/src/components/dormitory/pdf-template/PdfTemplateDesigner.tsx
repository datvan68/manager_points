'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { DORMITORY_PDF_TEMPLATE_CODE, dormitoryApi, DormitoryPdfTemplateField, DormitoryPdfTemplateLayout, DormitoryPdfTemplateRevision } from '@/api/dormitory-api';
import { usePermission } from '@/components/guards/RouteGuard';

const FIELD_LABELS: Record<string, string> = {
  name: 'Họ và tên', dob: 'Ngày sinh', gender: 'Giới tính', className: 'Lớp', faculty: 'Khoa', ethnicity: 'Dân tộc', religion: 'Tôn giáo', phone: 'Điện thoại', citizenId: 'Số căn cước', citizenIssueDate: 'Ngày cấp căn cước', citizenIssuePlace: 'Nơi cấp căn cước', permanentAddress: 'Địa chỉ thường trú', fatherName: 'Họ tên cha', fatherAge: 'Tuổi cha', fatherAddress: 'Địa chỉ cha', fatherContactAddress: 'Nơi ở hiện tại của cha', fatherOccupation: 'Nghề nghiệp cha', fatherPhone: 'Điện thoại cha', motherName: 'Họ tên mẹ', motherAge: 'Tuổi mẹ', motherAddress: 'Địa chỉ mẹ', motherContactAddress: 'Nơi ở hiện tại của mẹ', motherOccupation: 'Nghề nghiệp mẹ', motherPhone: 'Điện thoại mẹ', priority: 'Diện chính sách',
};
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

export function clampField(field: DormitoryPdfTemplateField): DormitoryPdfTemplateField {
  const width = Math.min(Math.max(field.width, 0.01), 1);
  const height = Math.min(Math.max(field.height, 0.01), 1);
  return { ...field, x: Math.min(Math.max(field.x, 0), 1 - width), y: Math.min(Math.max(field.y, 0), 1 - height), width, height };
}

export function moveField(field: DormitoryPdfTemplateField, dx: number, dy: number): DormitoryPdfTemplateField {
  return clampField({ ...field, x: field.x + dx, y: field.y + dy });
}

export function resizeField(field: DormitoryPdfTemplateField, handle: Handle, dx: number, dy: number): DormitoryPdfTemplateField {
  let { x, y, width, height } = field;
  const right = x + width; const bottom = y + height;
  if (handle.includes('w')) { x = Math.min(x + dx, right - 0.01); width = right - x; }
  if (handle.includes('e')) { width = Math.max(0.01, width + dx); }
  if (handle.includes('n')) { y = Math.min(y + dy, bottom - 0.01); height = bottom - y; }
  if (handle.includes('s')) { height = Math.max(0.01, height + dy); }
  return clampField({ ...field, x, y, width, height });
}

function styleDefaults(field: DormitoryPdfTemplateField): DormitoryPdfTemplateField { return { ...field, style: { fontFamily: 'Arial', fontSize: 11, minFontSize: 7, fontWeight: 400, color: '#000000', horizontalAlign: 'left', verticalAlign: 'middle', lineHeight: 1.15, padding: 0.5, background: 'transparent', overflow: 'shrink', maxLines: 1, ...field.style } }; }

function fieldWithKey(key: string, zIndex: number): DormitoryPdfTemplateField {
  return styleDefaults({ key, pageIndex: 0, x: 0.15, y: 0.15, width: 0.25, height: 0.03, rotation: 0, zIndex, style: { fontFamily: 'Arial', fontSize: 11, minFontSize: 7, fontWeight: 400, color: '#000000', horizontalAlign: 'left', verticalAlign: 'middle', lineHeight: 1.15, padding: 0.5, background: 'transparent', overflow: 'shrink', maxLines: 1 } });
}

export default function PdfTemplateDesigner() {
  const access = usePermission({ read: 'DORM_PDF_TEMPLATE_READ', manage: 'DORM_PDF_TEMPLATE_MANAGE', publish: 'DORM_PDF_TEMPLATE_PUBLISH' });
  const [revision, setRevision] = useState<DormitoryPdfTemplateRevision | null>(null);
  const [layout, setLayout] = useState<DormitoryPdfTemplateLayout | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const dragRef = useRef<{ key: string; startX: number; startY: number; field: DormitoryPdfTemplateField; handle?: Handle } | null>(null);

  const selected = layout?.fields.find((field) => field.key === selectedKey) || null;
  const sortedFields = useMemo(() => [...(layout?.fields || [])].sort((a, b) => a.zIndex - b.zIndex), [layout]);

  const load = useCallback(async () => {
    if (!access.read) return;
    setLoading(true); setMessage('');
    try {
      const [metadata, revisions] = await Promise.all([dormitoryApi.pdfTemplates.get(), dormitoryApi.pdfTemplates.revisions()]);
      const draft = revisions.find((item) => item.status === 'DRAFT') || null;
      const current = draft || metadata.activeRevision || null;
      setRevision(current);
      setLayout(current?.layout || metadata.defaultLayout || null);
      if (current) {
        const blob = await dormitoryApi.pdfTemplates.source(DORMITORY_PDF_TEMPLATE_CODE, current.id);
        setSourceUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
      }
    } catch (error: any) { setMessage(error?.message || 'Không thể tải template PDF.'); }
    finally { setLoading(false); }
  }, [access.read]);

  useEffect(() => { void load(); return () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }; }, [load]);
  useEffect(() => { const onBeforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', onBeforeUnload); return () => window.removeEventListener('beforeunload', onBeforeUnload); }, [dirty]);

  const updateField = (key: string, updater: (field: DormitoryPdfTemplateField) => DormitoryPdfTemplateField) => {
    if (!access.manage) return;
    setLayout((current) => current ? { ...current, fields: current.fields.map((field) => field.key === key ? clampField(updater(field)) : field) } : current); setDirty(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current; if (!active || !layout) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - active.startX) / rect.width; const dy = (event.clientY - active.startY) / rect.height;
    updateField(active.key, () => active.handle ? resizeField(active.field, active.handle, dx, dy) : moveField(active.field, dx, dy));
  };
  const stopPointer = () => { dragRef.current = null; };
  const startPointer = (event: PointerEvent<HTMLButtonElement>, field: DormitoryPdfTemplateField, handle?: Handle) => { event.stopPropagation(); if (!access.manage) return; (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId); dragRef.current = { key: field.key, startX: event.clientX, startY: event.clientY, field, handle }; setSelectedKey(field.key); };
  const nudge = (dx: number, dy: number) => { if (selectedKey && access.manage) updateField(selectedKey, (field) => moveField(field, dx, dy)); };

  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (!selectedKey || !access.manage) return; if (event.key === 'Delete') { setLayout((current) => current ? { ...current, fields: current.fields.filter((field) => field.key !== selectedKey) } : current); setSelectedKey(null); setDirty(true); } const step = event.shiftKey ? 0.01 : 0.0025; if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-step, 0); } if (event.key === 'ArrowRight') { event.preventDefault(); nudge(step, 0); } if (event.key === 'ArrowUp') { event.preventDefault(); nudge(0, -step); } if (event.key === 'ArrowDown') { event.preventDefault(); nudge(0, step); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [selectedKey, access.manage]);

  const upload = async () => { if (!file || !access.manage) return; setBusy(true); setMessage(''); try { const created = await dormitoryApi.pdfTemplates.create(file); setRevision(created); setLayout(created.layout); setDirty(false); const blob = await dormitoryApi.pdfTemplates.source(DORMITORY_PDF_TEMPLATE_CODE, created.id); setSourceUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); }); setMessage('Đã tạo draft.'); } catch (error: any) { setMessage(error?.message || 'Upload PDF thất bại.'); } finally { setBusy(false); } };
  const restoreDraft = async () => { if (!revision || !access.manage) return; setBusy(true); try { const draft = await dormitoryApi.pdfTemplates.restore(DORMITORY_PDF_TEMPLATE_CODE, revision.id); setRevision(draft); setLayout(draft.layout); setDirty(false); setMessage('Đã tạo draft mới từ revision.'); } catch (error: any) { setMessage(error?.message || 'Không thể tạo draft.'); } finally { setBusy(false); } };
  const save = async () => { if (!revision || !layout || revision.status !== 'DRAFT' || !access.manage) return; setBusy(true); setErrors([]); try { const saved = await dormitoryApi.pdfTemplates.update(DORMITORY_PDF_TEMPLATE_CODE, revision.id, revision.revisionToken, layout.fields); setRevision(saved); setLayout(saved.layout); setDirty(false); setMessage('Đã lưu draft.'); } catch (error: any) { setMessage(error?.message || 'Lưu draft thất bại; hãy tải lại để xử lý conflict.'); } finally { setBusy(false); } };
  const validate = async () => { if (!revision) return; setBusy(true); try { const result = await dormitoryApi.pdfTemplates.validate(DORMITORY_PDF_TEMPLATE_CODE, revision.id); setErrors(result.errors || []); setMessage(result.valid ? `Layout hợp lệ · checksum ${result.layoutChecksum?.slice(0, 12) || ''}` : 'Layout còn lỗi, chưa thể publish.'); } catch (error: any) { setMessage(error?.message || 'Validate thất bại.'); } finally { setBusy(false); } };
  const publish = async () => { if (!revision || revision.status !== 'DRAFT' || !access.publish) return; const validation = await dormitoryApi.pdfTemplates.validate(DORMITORY_PDF_TEMPLATE_CODE, revision.id); setErrors(validation.errors || []); if (!validation.valid) { setMessage('Publication bị chặn vì layout chưa hợp lệ.'); return; } if (!window.confirm('Publish revision này? Revision đã publish sẽ immutable.')) return; setBusy(true); try { const result = await dormitoryApi.pdfTemplates.publish(DORMITORY_PDF_TEMPLATE_CODE, revision.id); setRevision(result); setDirty(false); setMessage(`Đã publish revision ${result.revision} · ${result.layoutChecksum.slice(0, 12)}`); } catch (error: any) { setMessage(error?.message || 'Publish thất bại.'); } finally { setBusy(false); } };

  if (!access.read) return <main className="p-6"><div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Bạn không có quyền xem template PDF KTX.</div></main>;
  if (loading) return <main className="p-6 text-sm text-slate-500">Đang tải designer...</main>;

  return <main className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 sm:p-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-black text-slate-900">Thiết kế mẫu PDF KTX</h1><p className="text-xs text-slate-500">DORMITORY_APPLICATION · tọa độ lưu chuẩn hóa theo A4</p></div><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{revision ? `${revision.status} · rev ${revision.revision}` : 'Chưa có template'}</span><label className="cursor-pointer rounded-lg border bg-white px-3 py-2 font-semibold">Upload PDF<input className="sr-only" type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={!access.manage} /></label>{file && <button type="button" onClick={() => void upload()} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Đang upload...' : 'Tạo draft'}</button>}</div></header>
    {message && <div role="status" className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">{message}</div>}{errors.length > 0 && <div role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{errors.join(' · ')}</div>}
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
      <aside className="order-2 flex min-h-0 w-full flex-col gap-3 overflow-auto rounded-xl border bg-white p-3 lg:order-1 lg:w-72">
        <section><h2 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Field palette</h2><div className="grid grid-cols-2 gap-1">{Object.entries(FIELD_LABELS).map(([key, label]) => <button key={key} type="button" disabled={!access.manage || !!layout?.fields.some((field) => field.key === key)} onClick={() => { setLayout((current) => current ? { ...current, fields: [...current.fields, fieldWithKey(key, current.fields.length)] } : current); setSelectedKey(key); setDirty(true); }} className="rounded-md border px-2 py-1.5 text-left text-[11px] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">{label}</button>)}</div></section>
        {selected && <section className="border-t pt-3"><h2 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Field properties</h2><div className="grid grid-cols-2 gap-2 text-[11px]">{(['x', 'y', 'width', 'height'] as const).map((key) => <label key={key}>{key}<input type="number" min={0} max={1} step={0.0005} value={selected[key]} onChange={(event) => updateField(selected.key, (field) => ({ ...field, [key]: Number(event.target.value) }))} className="mt-1 w-full rounded border px-2 py-1" /></label>)}<label>Font<input type="number" min={6} max={48} value={selected.style.fontSize} onChange={(event) => updateField(selected.key, (field) => ({ ...field, style: { ...field.style, fontSize: Number(event.target.value) } }))} className="mt-1 w-full rounded border px-2 py-1" /></label><label>Min font<input type="number" min={5} max={48} value={selected.style.minFontSize} onChange={(event) => updateField(selected.key, (field) => ({ ...field, style: { ...field.style, minFontSize: Number(event.target.value) } }))} className="mt-1 w-full rounded border px-2 py-1" /></label><label className="col-span-2">Overflow<select value={selected.style.overflow} onChange={(event) => updateField(selected.key, (field) => ({ ...field, style: { ...field.style, overflow: event.target.value as 'shrink' | 'wrap' | 'clip' } }))} className="mt-1 w-full rounded border px-2 py-1"><option value="shrink">Shrink</option><option value="wrap">Wrap</option><option value="clip">Clip</option></select></label></div><button type="button" onClick={() => { setLayout((current) => current ? { ...current, fields: current.fields.filter((field) => field.key !== selected.key) } : current); setSelectedKey(null); setDirty(true); }} className="mt-2 w-full rounded border border-rose-200 px-2 py-1.5 text-xs font-semibold text-rose-700">Xóa field</button></section>}
        <section className="mt-auto border-t pt-3"><div className="flex gap-2"><button type="button" onClick={() => void save()} disabled={!revision || revision.status !== 'DRAFT' || !access.manage || busy || !dirty} className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Lưu draft</button><button type="button" onClick={() => void validate()} disabled={!revision || busy} className="rounded-lg border px-3 py-2 text-xs font-semibold">Validate</button></div><div className="mt-2 flex gap-2"><button type="button" onClick={() => void restoreDraft()} disabled={!revision || revision.status === 'DRAFT' || !access.manage || busy} className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Tạo draft từ revision</button><button type="button" onClick={() => void publish()} disabled={!revision || revision.status !== 'DRAFT' || !access.publish || busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Publish</button></div></section>
      </aside>
      <section className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-slate-100 p-3 lg:order-2"><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><div className="flex items-center gap-1"><span className="font-semibold">Zoom</span>{[0.5, 1, 2].map((value) => <button key={value} type="button" onClick={() => setZoom(value)} className={`rounded px-2 py-1 ${zoom === value ? 'bg-blue-600 text-white' : 'bg-white'}`}>{value * 100}%</button>)}<button type="button" onClick={() => nudge(0, -0.0025)} className="rounded bg-white px-2 py-1" aria-label="Nudge lên">↑</button><button type="button" onClick={() => nudge(0, 0.0025)} className="rounded bg-white px-2 py-1" aria-label="Nudge xuống">↓</button></div>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded bg-white px-2 py-1 font-semibold text-blue-700">Mở source PDF</a>}</div><div className="min-h-0 flex-1 overflow-auto"><div className="relative mx-auto" style={{ width: `${595.32 * zoom}px`, height: `${842.04 * zoom}px` }} onPointerMove={onPointerMove} onPointerUp={stopPointer} onPointerCancel={stopPointer}><iframe title="PDF source" src={sourceUrl || undefined} className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-white" />{layout?.fields.map((field) => <button key={field.key} type="button" aria-label={FIELD_LABELS[field.key] || field.key} onClick={() => setSelectedKey(field.key)} onPointerDown={(event) => startPointer(event, field)} className={`absolute border text-left ${selectedKey === field.key ? 'border-blue-600 bg-blue-100/30 ring-2 ring-blue-300' : 'border-blue-400/30 hover:border-blue-500'}`} style={{ left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`, height: `${field.height * 100}%`, zIndex: field.zIndex + 10, transform: `rotate(${field.rotation}deg)`, color: field.style.color, fontFamily: field.style.fontFamily, fontSize: `${field.style.fontSize * zoom}px`, fontWeight: field.style.fontWeight, overflow: 'hidden', background: field.style.background === 'white' ? 'rgba(255,255,255,.7)' : 'transparent' }}>{FIELD_LABELS[field.key] || field.key}{selectedKey === field.key && HANDLES.map((handle) => <span key={handle} onPointerDown={(event) => startPointer(event as any, field, handle)} className={`absolute h-2 w-2 rounded-full border border-blue-700 bg-white ${handle.includes('n') ? 'top-[-5px]' : handle.includes('s') ? 'bottom-[-5px]' : 'top-1/2 -translate-y-1/2'} ${handle.includes('w') ? 'left-[-5px]' : handle.includes('e') ? 'right-[-5px]' : 'left-1/2 -translate-x-1/2'}`} />)}</button>)}</div></div></section>
    </div>
  </main>;
}
