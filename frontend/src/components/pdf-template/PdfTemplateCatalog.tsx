'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { pdfTemplateApi, PdfTemplateCatalogItem } from '@/api/pdf-template-api';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';

function bytes(value: number) {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function CatalogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const access = usePermission({ read: 'PDF_TEMPLATE_READ', manage: 'PDF_TEMPLATE_MANAGE', delete: 'PDF_TEMPLATE_DELETE' });
  const [items, setItems] = useState<PdfTemplateCatalogItem[]>([]);
  const [facets, setFacets] = useState<{ modules: string[]; features: string[] }>({ modules: [], features: [] });
  const [availableCollections, setAvailableCollections] = useState<PdfTemplateCatalogItem[]>([]);
  const [availableLoading, setAvailableLoading] = useState(true);
  const [availableError, setAvailableError] = useState('');
  const [availableRetry, setAvailableRetry] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [pageSize] = useState(20);
  const [query, setQuery] = useState(params.get('search') || '');
  const [moduleCode, setModuleCode] = useState(params.get('moduleCode') || 'all');
  const [featureCode, setFeatureCode] = useState(params.get('featureCode') || 'all');
  const [configuration, setConfiguration] = useState(params.get('configured') || 'all');
  const [sortBy, setSortBy] = useState(params.get('sortBy') || 'displayName');
  const [sortDirection, setSortDirection] = useState(params.get('sortDirection') || 'asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await pdfTemplateApi.catalog({ page, pageSize, search: query, moduleCode, featureCode, configured: configuration, sortBy, sortDirection });
      setItems(result.items); setTotal(result.total); setFacets({ modules: result.modules || [], features: result.features || [] });
    } catch (cause: any) { setError(cause?.message || 'Không thể tải catalog.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [page, pageSize, query, moduleCode, featureCode, configuration, sortBy, sortDirection]);
  useEffect(() => {
    let cancelled = false;
    setAvailableLoading(true);
    setAvailableError('');
    setAvailableCollections([]);
    (async () => {
      try {
        const firstPage = await pdfTemplateApi.catalog({ page: 1, pageSize: 100, configured: 'false', sortBy: 'displayName', sortDirection: 'asc' });
        const pageCount = Math.max(1, Math.ceil(firstPage.total / firstPage.pageSize));
        const pages = [firstPage];
        for (let nextPage = 2; nextPage <= pageCount; nextPage += 1) {
          pages.push(await pdfTemplateApi.catalog({ page: nextPage, pageSize: 100, configured: 'false', sortBy: 'displayName', sortDirection: 'asc' }));
        }
        const unique = new Map(pages.flatMap((result) => result.items).filter((item) => !item.configured).map((item) => [item.templateTypeCode, item]));
        if (!cancelled) setAvailableCollections([...unique.values()]);
      } catch (cause: any) {
        if (!cancelled) setAvailableError(cause?.message || 'Không thể tải collection chưa cấu hình.');
      } finally {
        if (!cancelled) setAvailableLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [availableRetry]);
  useEffect(() => {
    const next = new URLSearchParams();
    [['page', page], ['search', query], ['moduleCode', moduleCode], ['featureCode', featureCode], ['configured', configuration], ['sortBy', sortBy], ['sortDirection', sortDirection]].forEach(([key, value]) => value && value !== 'all' && next.set(String(key), String(value)));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [page, query, moduleCode, featureCode, configuration, sortBy, sortDirection, pathname, router]);

  const modules = useMemo(() => facets.modules.length ? facets.modules : [...new Set(items.map((item) => item.moduleCode))].sort(), [facets.modules, items]);
  const features = useMemo(() => facets.features.length ? facets.features : [...new Set(items.filter((item) => moduleCode === 'all' || item.moduleCode === moduleCode).map((item) => item.featureCode))].sort(), [facets.features, items, moduleCode]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const returnQuery = new URLSearchParams(params.toString()); returnQuery.set('page', String(page));

  const deleteItem = async (item: PdfTemplateCatalogItem) => {
    if (!access.delete || mutating) return;
    if (!window.confirm(`Xóa PDF và toàn bộ layout của “${item.displayName}” (${item.templateTypeCode})? Collection vẫn được giữ nguyên và sẽ trở về Chưa cấu hình.`)) return;
    if (window.prompt(`Nhập chính xác ${item.templateTypeCode} để xác nhận:`) !== item.templateTypeCode) return;
    setMutating(true); setError('');
    try { await pdfTemplateApi.delete(item.templateTypeCode, item.version); await load(); setAvailableRetry((value) => value + 1); }
    catch (cause: any) { setError(cause?.message || 'Không thể xóa template.'); }
    finally { setMutating(false); }
  };

  if (!access.read) return <div className="p-8 text-sm">Bạn không có quyền xem PDF template.</div>;
  return <main className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6" aria-labelledby="pdf-template-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">PDF Template Designer</p><h1 id="pdf-template-title" className="text-2xl font-black text-slate-900">Quản lý mẫu PDF</h1><p className="text-sm text-slate-500">Mỗi collection đã đăng ký có tối đa một PDF và layout hiện hành.</p></div>{access.manage && <label className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Thêm mẫu<select aria-label="Collection chưa cấu hình" className="rounded-lg bg-white px-2 py-1 text-slate-900" defaultValue="" disabled={availableLoading || Boolean(availableError)} onChange={(event) => event.target.value && router.push(`/pdf-templates/new?templateTypeCode=${encodeURIComponent(event.target.value)}&returnTo=${encodeURIComponent(returnQuery.toString())}`)}><option value="">{availableLoading ? 'Đang tải collection...' : availableError ? 'Không tải được collection' : 'Chọn collection'}</option>{availableCollections.map((item) => <option key={item.templateTypeCode} value={item.templateTypeCode}>{item.displayName}</option>)}</select></label>}</div>
    {access.manage && availableError && <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{availableError}<button type="button" className="ml-3 underline" onClick={() => setAvailableRetry((value) => value + 1)}>Thử lại</button></div>}
    <div className="grid gap-3 rounded-2xl border bg-white/80 p-4 md:grid-cols-4" aria-label="Bộ lọc PDF template">
      <label className="text-xs font-semibold text-slate-600">Tìm kiếm<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên, mã collection..." className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold text-slate-600">Module<select value={moduleCode} onChange={(event) => { setModuleCode(event.target.value); setFeatureCode('all'); setPage(1); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="all">Tất cả</option>{modules.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Feature<select value={featureCode} onChange={(event) => { setFeatureCode(event.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="all">Tất cả</option>{features.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Cấu hình<select value={configuration} onChange={(event) => { setConfiguration(event.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="all">Tất cả</option><option value="true">Đã cấu hình</option><option value="false">Chưa cấu hình</option></select></label>
    </div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" className="ml-3 underline" onClick={() => void load()}>Thử lại</button></div>}
    {loading && <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">Đang tải danh sách template...</p>}
    {!loading && !error && !items.length && <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">Không có collection nào phù hợp bộ lọc.</p>}
    {!loading && <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-[1100px] w-full text-left text-sm"><caption className="sr-only">Danh sách PDF template theo collection</caption><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{[['displayName','Tên'],['templateTypeCode','Collection code'],['moduleCode','Module'],['featureCode','Feature'],['configured','Trạng thái'],['sourceFilename','Source filename'],['pageCount','Trang'],['sourceBytes','Dung lượng'],['checksum','Checksum'],['updatedAt','Cập nhật'],['actions','Thao tác']].map(([key, label]) => <th key={key} scope="col" className="px-4 py-3">{key === 'actions' ? label : <button type="button" onClick={() => { if (sortBy === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortDirection('asc'); } }}>{label}{sortBy === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</button>}</th>)}</tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item.templateTypeCode} className="align-top"><td className="px-4 py-4 font-semibold">{item.displayName}</td><td className="px-4 py-4 font-mono text-xs">{item.templateTypeCode}</td><td className="px-4 py-4">{item.moduleCode}</td><td className="px-4 py-4">{item.featureCode}</td><td className="px-4 py-4"><span className={item.configured ? 'text-emerald-700' : 'text-amber-700'}>{item.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span></td><td className="px-4 py-4">{item.sourceFilename || '—'}</td><td className="px-4 py-4">{item.pageCount || '—'}</td><td className="px-4 py-4">{bytes(item.sourceBytes)}</td><td className="max-w-40 truncate px-4 py-4 font-mono text-xs" title={item.checksum || undefined}>{item.checksum || '—'}</td><td className="px-4 py-4 text-xs">{item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : '—'}</td><td className="px-4 py-4"><div className="flex gap-2 whitespace-nowrap">{item.configured && access.manage && <button type="button" disabled={mutating} onClick={() => router.push(`/pdf-templates/${encodeURIComponent(item.templateTypeCode)}/edit?returnTo=${encodeURIComponent(returnQuery.toString())}`)} className="rounded-lg border px-2 py-1 text-xs font-semibold">Sửa</button>}{!item.configured && access.manage && <button type="button" disabled={mutating} onClick={() => router.push(`/pdf-templates/new?templateTypeCode=${encodeURIComponent(item.templateTypeCode)}&returnTo=${encodeURIComponent(returnQuery.toString())}`)} className="rounded-lg border px-2 py-1 text-xs font-semibold">Thêm mẫu</button>}{item.configured && access.delete && <button type="button" disabled={mutating} onClick={() => void deleteItem(item)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">Xóa</button>}</div></td></tr>)}</tbody></table></div>}
    {!loading && totalPages > 1 && <nav aria-label="Phân trang PDF template" className="flex items-center justify-between text-sm"><span>Trang {page}/{totalPages} · {total} collection</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Trước</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Sau</button></div></nav>}
  </main>;
}

export default function PdfTemplateCatalog() { return <RouteGuard requiredPermission="PDF_TEMPLATE_READ" fallbackPath="/"><CatalogPage /></RouteGuard>; }
