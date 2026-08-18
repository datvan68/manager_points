'use client';

import { useEffect, useMemo, useState } from 'react';
import { pdfTemplateApi, PdfTemplateCatalogItem, PdfTemplateMetadata } from '@/api/pdf-template-api';
import PdfTemplateEditor from './PdfTemplateEditor';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';

function bytes(value: number) {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function Page() {
  const access = usePermission({ read: 'PDF_TEMPLATE_READ', manage: 'PDF_TEMPLATE_MANAGE' });
  const [items, setItems] = useState<PdfTemplateCatalogItem[]>([]);
  const [selected, setSelected] = useState<PdfTemplateMetadata | null>(null);
  const [query, setQuery] = useState('');
  const [moduleCode, setModuleCode] = useState('all');
  const [featureCode, setFeatureCode] = useState('all');
  const [configuration, setConfiguration] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await pdfTemplateApi.catalog()); }
    catch (cause: any) { setError(cause?.message || 'Không thể tải catalog.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const modules = useMemo(() => [...new Set(items.map((item) => item.moduleCode))].sort(), [items]);
  const features = useMemo(() => [...new Set(items.filter((item) => moduleCode === 'all' || item.moduleCode === moduleCode).map((item) => item.featureCode))].sort(), [items, moduleCode]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesText = !needle || [item.displayName, item.templateTypeCode, item.moduleCode, item.featureCode].some((value) => value.toLowerCase().includes(needle));
      const matchesModule = moduleCode === 'all' || item.moduleCode === moduleCode;
      const matchesFeature = featureCode === 'all' || item.featureCode === featureCode;
      const matchesConfiguration = configuration === 'all' || (configuration === 'configured' ? item.configured : !item.configured);
      return matchesText && matchesModule && matchesFeature && matchesConfiguration;
    });
  }, [items, query, moduleCode, featureCode, configuration]);

  if (!access.read) return <div className="p-8 text-sm">Bạn không có quyền xem PDF template.</div>;
  return <main className="space-y-6 p-6" aria-labelledby="pdf-template-title">
    <div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">PDF Template Designer</p><h1 id="pdf-template-title" className="text-2xl font-black text-slate-900">Quản lý mẫu PDF</h1><p className="text-sm text-slate-500">Chọn một collection đã đăng ký để preview synthetic và lưu trực tiếp cấu hình hiện hành.</p></div>
    <div className="grid gap-3 rounded-2xl border bg-white/80 p-4 md:grid-cols-4" aria-label="Bộ lọc PDF template">
      <label className="text-xs font-semibold text-slate-600">Tìm kiếm<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, mã collection..." className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold text-slate-600">Module<select value={moduleCode} onChange={(event) => { setModuleCode(event.target.value); setFeatureCode('all'); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="all">Tất cả</option>{modules.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Feature<select value={featureCode} onChange={(event) => setFeatureCode(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="all">Tất cả</option>{features.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Cấu hình<select value={configuration} onChange={(event) => setConfiguration(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="all">Tất cả</option><option value="configured">Đã cấu hình</option><option value="missing">Chưa có PDF</option></select></label>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">Đang tải danh sách template...</p>}
    {!loading && !error && !visible.length && <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">Không có collection nào phù hợp bộ lọc.</p>}
    {!loading && <div className="grid gap-4 md:grid-cols-2">{visible.map((item) => <article key={item.templateTypeCode} className="rounded-2xl border bg-white/80 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">{item.moduleCode} / {item.featureCode}</p><h2 className="mt-1 font-bold">{item.displayName}</h2></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.configured ? 'Đã cấu hình' : 'Chưa có PDF'}</span></div>
      <p className="mt-2 break-all text-xs text-slate-500">{item.templateTypeCode}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600"><div><dt className="font-semibold">Source</dt><dd>{item.sourceFilename || '—'}</dd></div><div><dt className="font-semibold">Trang / dung lượng</dt><dd>{item.pageCount || '—'} / {bytes(item.sourceBytes)}</dd></div><div><dt className="font-semibold">Checksum</dt><dd className="truncate" title={item.checksum || undefined}>{item.checksum || '—'}</dd></div><div><dt className="font-semibold">Cập nhật</dt><dd>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : '—'}</dd></div></dl>
      {access.manage && <button type="button" onClick={async () => { try { setSelected(await pdfTemplateApi.metadata(item.templateTypeCode)); } catch (cause: any) { setError(cause?.message || 'Không thể mở template.'); } }} className="mt-4 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-600">Edit template</button>}
    </article>)}</div>}
    {selected && access.manage && <PdfTemplateEditor metadata={selected} onSaved={async () => { setSelected(await pdfTemplateApi.metadata(selected.templateTypeCode)); await load(); }} />}
  </main>;
}

export default function PdfTemplateCatalog() { return <RouteGuard requiredPermission="PDF_TEMPLATE_READ" fallbackPath="/"><Page /></RouteGuard>; }
