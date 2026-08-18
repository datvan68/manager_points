'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { ApiError } from '@/api/http-client';
import { pdfTemplateApi, PdfTemplateItem, PdfTemplateLayout, PdfTemplateMetadata } from '@/api/pdf-template-api';

type Props = { metadata: PdfTemplateMetadata; onSaved: () => void };

function initialLayout(metadata: PdfTemplateMetadata): PdfTemplateLayout {
  return { pages: [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }], items: metadata.fields.map((field, index) => ({ id: crypto.randomUUID(), fieldKey: field.key, formatter: field.allowedFormatters[0], pageIndex: 0, x: 0.12, y: Math.min(0.94, 0.12 + (index % 25) * 0.025), width: 0.7, height: 0.025, rotation: 0, zIndex: index, style: field.defaultStyle })) };
}

export default function PdfTemplateEditor({ metadata, onSaved }: Props) {
  const [layout, setLayout] = useState<PdfTemplateLayout | null>(metadata.layout);
  const [source, setSource] = useState<File>();
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceState, setSourceState] = useState<'loading' | 'missing' | 'ready' | 'error'>('loading');
  const [renderedPage, setRenderedPage] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [fixture, setFixture] = useState('short');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [conflict, setConflict] = useState(false);
  const drag = useRef<{ id: string; x: number; y: number } | undefined>(undefined);
  const dirty = Boolean(source || (layout && JSON.stringify(layout) !== JSON.stringify(metadata.layout)));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const controller = new AbortController();
    setRenderedPage(null); setSourceUrl(''); setSourceState(metadata.configured ? 'loading' : 'missing');
    if (metadata.configured) {
      pdfTemplateApi.source(metadata.templateTypeCode, controller.signal).then((blob) => {
        if (controller.signal.aborted) return;
        setSourceUrl(URL.createObjectURL(blob));
      }).catch((error) => {
        if (controller.signal.aborted) return;
        setSourceState('error'); setMessage(error?.message || 'Không thể tải source PDF.');
      });
    }
    return () => { controller.abort(); };
  }, [metadata.templateTypeCode, metadata.version, metadata.configured, retry]);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => {
    if (!sourceUrl || !canvasRef.current || !layout) return;
    let disposed = false;
    let loadingTask: any;
    let renderTask: any;
    let document: any;
    setSourceState('loading'); setRenderedPage(null);
    const canvas = canvasRef.current;
    canvas.width = 0;
    canvas.height = 0;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        loadingTask = pdfjs.getDocument({ url: sourceUrl, useWorkerFetch: true, isEvalSupported: false });
        document = await loadingTask.promise;
        if (disposed) return;
        const pages = [];
        for (let index = 1; index <= document.numPages; index += 1) {
          const sourcePage = await document.getPage(index);
          const viewport = sourcePage.getViewport({ scale: 1 });
          pages.push({ pageIndex: index - 1, width: viewport.width, height: viewport.height, rotation: viewport.rotation });
        }
        setLayout((current) => current ? { ...current, pages } : current);
        const activePageIndex = Math.min(pageIndex, document.numPages - 1);
        if (activePageIndex !== pageIndex) setPageIndex(activePageIndex);
        const activePage = await document.getPage(activePageIndex + 1);
        const viewport = activePage.getViewport({ scale: zoom });
        if (!canvas || disposed) return;
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        renderTask = activePage.render({ canvasContext: canvas.getContext('2d', { alpha: false })!, viewport });
        await renderTask.promise;
        if (!disposed) { setRenderedPage(activePageIndex); setSourceState('ready'); }
      } catch (error: any) {
        if (!disposed && error?.name !== 'RenderingCancelledException') { setSourceState('error'); setMessage(error?.message || 'Không thể phân tích hoặc render PDF.'); }
      } finally {
        if (document) await document.destroy();
      }
    })();
    return () => { disposed = true; renderTask?.cancel(); void loadingTask?.destroy?.(); };
  }, [sourceUrl, pageIndex, zoom, layout ? layout.pages.length : 0]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const page = layout?.pages[pageIndex] || layout?.pages[0];
  const selectedItem = useMemo(() => layout?.items.find((item) => item.id === selected), [layout, selected]);
  const clientErrors = useMemo(() => {
    if (!layout) return ['Chưa có source PDF và layout.'];
    const errors: string[] = [];
    if (!layout.pages.length) errors.push('Layout phải có ít nhất một trang.');
    if (layout.items.length > 500) errors.push('Layout vượt quá 500 field.');
    for (const item of layout.items) {
      if (!Number.isInteger(item.pageIndex) || !layout.pages[item.pageIndex]) errors.push(`${item.fieldKey}: trang không hợp lệ.`);
      if (![item.x, item.y, item.width, item.height].every(Number.isFinite) || item.width <= 0 || item.height <= 0 || item.x < 0 || item.y < 0 || item.x + item.width > 1 || item.y + item.height > 1) errors.push(`${item.fieldKey}: field vượt ngoài trang.`);
    }
    return [...new Set(errors)];
  }, [layout]);

  const update = (id: string, patch: Partial<PdfTemplateItem>) => setLayout((current) => current && ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const replacement = (file: File) => {
    if (dirty && !window.confirm('Thay PDF nền sẽ có thể làm sai vị trí các field. Tiếp tục?')) return;
    setSource(file);
    const url = URL.createObjectURL(file);
    setSourceUrl(() => url);
    setSourceState('loading'); setRenderedPage(null);
    if (!layout) setLayout(initialLayout(metadata));
    setPageIndex(0); setMessage('PDF mới đã chọn; hãy preview và kiểm tra trước khi lưu.');
  };
  const startDrag = (event: React.PointerEvent, item: PdfTemplateItem) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: item.id, x: event.clientX, y: event.clientY }; setSelected(item.id); };
  const move = (event: React.PointerEvent) => {
    if (!drag.current || !layout || !page) return;
    const item = layout.items.find((entry) => entry.id === drag.current?.id);
    if (item) {
      const snapValue = (value: number) => snap ? Math.round(value / 0.005) * 0.005 : value;
      const x = snapValue(item.x + (event.clientX - drag.current.x) / (page.width * zoom));
      const y = snapValue(item.y + (event.clientY - drag.current.y) / (page.height * zoom));
      update(item.id, { x: Math.max(0, Math.min(1 - item.width, x)), y: Math.max(0, Math.min(1 - item.height, y)) });
    }
    drag.current = { ...drag.current, x: event.clientX, y: event.clientY };
  };
  const keyboard = (event: React.KeyboardEvent, item: PdfTemplateItem) => {
    if (event.key === 'Delete') { event.preventDefault(); setLayout((current) => current && ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) })); setSelected(undefined); return; }
    const step = event.shiftKey ? 0.01 : 0.001;
    const delta = event.key === 'ArrowLeft' ? { x: -step } : event.key === 'ArrowRight' ? { x: step } : event.key === 'ArrowUp' ? { y: -step } : event.key === 'ArrowDown' ? { y: step } : null;
    if (delta) { event.preventDefault(); update(item.id, { x: Math.max(0, Math.min(1 - item.width, item.x + (delta.x || 0))), y: Math.max(0, Math.min(1 - item.height, item.y + (delta.y || 0))) }); }
  };
  const preview = async () => {
    if (!layout || clientErrors.length) return setMessage(clientErrors[0]);
    setBusy(true); setMessage('');
    try { const blob = await pdfTemplateApi.preview(metadata.templateTypeCode, layout, fixture, source); setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); }); setMessage('Preview synthetic đã sẵn sàng.'); }
    catch (error: any) { setMessage(error?.message || 'Preview thất bại.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!layout || clientErrors.length || !window.confirm('Lưu template này thành cấu hình hiện hành?')) return;
    setBusy(true); setMessage(''); setConflict(false);
    try {
      if (!metadata.configured && !source) throw new Error('Template mới cần source PDF.');
      await pdfTemplateApi.validate(metadata.templateTypeCode, layout, source);
      if (metadata.configured) await pdfTemplateApi.save(metadata.templateTypeCode, metadata.version, layout, source);
      else await pdfTemplateApi.create(metadata.templateTypeCode, layout, source!);
      setMessage('Đã lưu template hiện hành.'); onSaved();
    }
    catch (error: any) { if (error instanceof ApiError && error.status === 409) setConflict(true); setMessage(error?.message || 'Save thất bại.'); }
    finally { setBusy(false); }
  };

  if (!layout) return <section className="rounded-2xl border border-dashed p-6 text-sm text-slate-500" aria-label="PDF template editor"><p>Chưa có PDF nền. Chọn source PDF để bắt đầu.</p><label className="mt-3 inline-block cursor-pointer rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white">Chọn PDF<input type="file" accept="application/pdf" className="sr-only" onChange={(event) => event.target.files?.[0] && replacement(event.target.files[0])} /></label>{message && <p role="status" className="mt-3">{message}</p>}</section>;
  if (!page) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Layout không có metadata trang hợp lệ.</p>;

  return <section className="space-y-4" aria-label="PDF template editor">
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white/80 p-4"><label className="rounded-xl border px-3 py-2 text-sm font-semibold cursor-pointer">Thay PDF nền<input type="file" accept="application/pdf" className="sr-only" onChange={(event) => event.target.files?.[0] && replacement(event.target.files[0])} /></label><label className="text-sm">Trang <select aria-label="Trang PDF" value={pageIndex} onChange={(event) => setPageIndex(Number(event.target.value))} className="ml-2 rounded border px-2 py-1">{layout.pages.map((entry) => <option key={entry.pageIndex} value={entry.pageIndex}>{entry.pageIndex + 1} / {layout.pages.length}</option>)}</select></label><label className="text-sm">Zoom <select aria-label="Zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="ml-2 rounded border px-2 py-1"><option value="0.5">50%</option><option value="1">100%</option><option value="2">200%</option></select></label><label className="text-sm"><input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} className="mr-1" />Snap</label><label className="text-sm"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} className="mr-1" />Grid</label><label className="text-sm">Fixture <select value={fixture} onChange={(event) => setFixture(event.target.value)} className="ml-2 rounded border px-2 py-1"><option value="short">Short</option><option value="long">Long</option><option value="missing">Missing</option><option value="vietnamese">Vietnamese</option></select></label><button type="button" onClick={preview} disabled={busy || clientErrors.length > 0} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Preview</button><button type="button" onClick={save} disabled={busy || clientErrors.length > 0 || !layout.items.length} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save</button>{message && <span role="status" className="text-sm text-slate-600">{message}</span>}</div>
    {conflict && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><span>Template đã được operator khác lưu. Các thay đổi local vẫn được giữ.</span><button type="button" onClick={onSaved} className="rounded-lg border border-amber-300 px-3 py-1 font-semibold">Tải phiên bản mới</button></div>}
    {clientErrors.length > 0 && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p className="font-bold">Không thể lưu khi còn lỗi layout</p><ul className="mt-1 list-disc pl-5">{clientErrors.slice(0, 5).map((error) => <li key={error}>{error}</li>)}</ul></div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]"><div className="overflow-auto rounded-2xl border bg-slate-100 p-6"><div className="relative mx-auto shadow-xl" style={{ width: page.width * zoom, height: page.height * zoom, backgroundImage: showGrid ? 'linear-gradient(to right, rgba(37,99,235,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,.12) 1px, transparent 1px)' : undefined, backgroundSize: showGrid ? `${page.width * 0.05 * zoom}px ${page.height * 0.05 * zoom}px` : undefined }}><canvas ref={canvasRef} aria-label={`PDF page ${pageIndex + 1}`} className="absolute inset-0 block" />{sourceState === 'loading' && <p className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm">Đang tải và render trang PDF...</p>}{sourceState === 'missing' && <p className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm">Chưa có source PDF. Hãy chọn một file PDF.</p>}{sourceState === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 p-4 text-center text-sm text-red-700"><p role="alert">{message || 'Không thể tải hoặc render PDF.'}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-lg border px-3 py-2 font-semibold">Thử lại</button></div>}{sourceState === 'ready' && renderedPage === pageIndex && layout.items.filter((item) => item.pageIndex === pageIndex).map((item) => <button key={item.id} type="button" aria-label={item.fieldKey} onPointerDown={(event) => startDrag(event, item)} onPointerMove={move} onPointerUp={() => { drag.current = undefined; }} onKeyDown={(event) => keyboard(event, item)} onClick={() => setSelected(item.id)} className={`absolute border text-left text-[9px] focus:outline-none focus:ring-2 focus:ring-blue-600 ${selected === item.id ? 'border-blue-600 bg-blue-100/40' : 'border-blue-300/50 bg-white/10'}`} style={{ left: item.x * page.width * zoom, top: item.y * page.height * zoom, width: item.width * page.width * zoom, height: item.height * page.height * zoom, zIndex: item.zIndex + 1 }}>{item.fieldKey}</button>)}</div></div><aside className="rounded-2xl border bg-white/80 p-4" aria-label="Field controls"><h2 className="font-bold">Field palette</h2><div className="mt-3 max-h-80 space-y-2 overflow-auto text-xs">{metadata.fields.map((field) => <button key={field.key} type="button" className="block w-full rounded-lg border px-2 py-2 text-left hover:bg-slate-50" onClick={() => { const id = crypto.randomUUID(); setLayout((current) => current && ({ ...current, items: [...current.items, { id, fieldKey: field.key, formatter: field.allowedFormatters[0], pageIndex, x: 0.1, y: 0.1, width: 0.2, height: 0.03, rotation: 0, zIndex: current.items.length, style: field.defaultStyle }] })); setSelected(id); }}>{field.label}<span className="ml-1 text-slate-400">{field.key}</span></button>)}</div>{selectedItem && <div className="mt-4 space-y-2 border-t pt-4"><h3 className="font-bold">Geometry / typography</h3>{(['x', 'y', 'width', 'height', 'rotation', 'zIndex'] as const).map((key) => <label key={key} className="flex items-center justify-between gap-2 text-xs">{key}<input type="number" step="0.001" value={selectedItem[key]} onChange={(event) => update(selectedItem.id, { [key]: Number(event.target.value) })} className="w-24 rounded border px-2 py-1" /></label>)}<label className="flex items-center justify-between gap-2 text-xs">Formatter<select value={selectedItem.formatter} onChange={(event) => update(selectedItem.id, { formatter: event.target.value })} className="w-32 rounded border px-2 py-1">{(metadata.fields.find((field) => field.key === selectedItem.fieldKey)?.allowedFormatters || []).map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs">Font size<input type="number" min="6" max="48" step="1" value={selectedItem.style.fontSize} onChange={(event) => update(selectedItem.id, { style: { ...selectedItem.style, fontSize: Number(event.target.value) } })} className="w-24 rounded border px-2 py-1" /></label><label className="text-xs">Overflow<select value={selectedItem.style.overflow} onChange={(event) => update(selectedItem.id, { style: { ...selectedItem.style, overflow: event.target.value as PdfTemplateItem['style']['overflow'] } })} className="w-32 rounded border px-2 py-1"><option value="shrink">shrink</option><option value="wrap">wrap</option><option value="clip">clip</option></select></label></div>}</aside></div>{previewUrl && <div className="rounded-2xl border bg-white p-4"><h2 className="mb-2 font-bold">Synthetic preview</h2><iframe title="Synthetic PDF preview" src={previewUrl} className="h-[700px] w-full" /></div>}
  </section>;
}
