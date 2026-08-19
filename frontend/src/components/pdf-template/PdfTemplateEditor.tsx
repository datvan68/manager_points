'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { ApiError } from '@/api/http-client';
import {
  pdfTemplateApi,
  PdfTemplateItem,
  PdfTemplateLayout,
  PdfTemplateMetadata,
} from '@/api/pdf-template-api';
import {
  moveField,
  resizeField,
  Handle,
} from '@/components/dormitory/pdf-template/PdfTemplateDesigner';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  metadata: PdfTemplateMetadata;
  mode?: 'new' | 'edit';
  onSaved: () => void;
  onBack?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

type PdfRenderState = 'loading' | 'missing' | 'ready' | 'error';

export function canRenderPdfOverlays(
  state: PdfRenderState,
  renderedPage: number | null,
  pageIndex: number
) {
  return state === 'ready' && renderedPage === pageIndex;
}

function initialLayout(metadata: PdfTemplateMetadata): PdfTemplateLayout {
  return {
    pages: [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }],
    items: metadata.fields.map((field, index) => ({
      id: crypto.randomUUID(),
      fieldKey: field.key,
      formatter: field.allowedFormatters[0] || 'plain',
      pageIndex: 0,
      x: 0.12,
      y: Math.min(0.94, 0.12 + (index % 25) * 0.025),
      width: 0.7,
      height: 0.025,
      rotation: 0,
      zIndex: index,
      style: field.defaultStyle,
    })),
  };
}

const RESIZE_HANDLES: {
  handle: Handle;
  cursor: string;
  positionClass: string;
  title: string;
}[] = [
  { handle: 'nw', cursor: 'cursor-nwse-resize', positionClass: '-top-1.5 -left-1.5', title: 'Resize northwest' },
  { handle: 'ne', cursor: 'cursor-nesw-resize', positionClass: '-top-1.5 -right-1.5', title: 'Resize northeast' },
  { handle: 'sw', cursor: 'cursor-nesw-resize', positionClass: '-bottom-1.5 -left-1.5', title: 'Resize southwest' },
  { handle: 'se', cursor: 'cursor-nwse-resize', positionClass: '-bottom-1.5 -right-1.5', title: 'Resize southeast' },
];

export default function PdfTemplateEditor({
  metadata,
  mode = 'edit',
  onSaved,
  onBack,
  onDirtyChange,
}: Props) {
  const [layout, setLayout] = useState<PdfTemplateLayout | null>(metadata.layout);
  const [source, setSource] = useState<File>();
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceState, setSourceState] = useState<PdfRenderState>('loading');
  const [renderedPage, setRenderedPage] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const [viewMode, setViewMode] = useState<'fit' | '100'>('fit');
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // ConfirmModal states
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File>();

  const dragRef = useRef<
    | {
        mode: 'move' | 'resize';
        handle?: Handle;
        id: string;
        startX: number;
        startY: number;
        initialItem: PdfTemplateItem;
      }
    | undefined
  >(undefined);

  const dirty =
    !isSaved &&
    Boolean(source || (layout && JSON.stringify(layout) !== JSON.stringify(metadata.layout)));

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const controller = new AbortController();
    setRenderedPage(null);
    setSourceUrl('');
    setSourceState(metadata.configured ? 'loading' : 'missing');
    if (metadata.configured) {
      pdfTemplateApi
        .source(metadata.templateTypeCode, controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return;
          setSourceUrl(URL.createObjectURL(blob));
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setSourceState('error');
          setMessage(error?.message || 'Không thể tải source PDF.');
        });
    }
    return () => {
      controller.abort();
    };
  }, [metadata.templateTypeCode, metadata.version, metadata.configured, retry]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateSize();
      });
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const page = layout?.pages[pageIndex] || layout?.pages[0];
  const availableWidth = Math.max(100, containerSize.width - 48);
  const availableHeight = Math.max(100, containerSize.height - 48);
  const fitScale = page ? Math.min(availableWidth / page.width, availableHeight / page.height) : 1;
  const effectiveScale = viewMode === 'fit' ? Math.max(0.1, fitScale) : 1.0;

  useEffect(() => {
    if (!sourceUrl || !canvasRef.current || !layout) return;
    let disposed = false;
    let loadingTask: any;
    let renderTask: any;
    let document: any;
    setSourceState('loading');
    setRenderedPage(null);
    const canvas = canvasRef.current;
    canvas.width = 0;
    canvas.height = 0;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
        loadingTask = pdfjs.getDocument({
          url: sourceUrl,
          useWorkerFetch: true,
          isEvalSupported: false,
        });
        document = await loadingTask.promise;
        if (disposed) return;
        const pages = [];
        for (let index = 1; index <= document.numPages; index += 1) {
          const sourcePage = await document.getPage(index);
          const viewport = sourcePage.getViewport({ scale: 1 });
          pages.push({
            pageIndex: index - 1,
            width: viewport.width,
            height: viewport.height,
            rotation: viewport.rotation,
          });
        }
        setLayout((current) => (current ? { ...current, pages } : current));
        const activePageIndex = Math.min(pageIndex, document.numPages - 1);
        if (activePageIndex !== pageIndex) setPageIndex(activePageIndex);
        const activePage = await document.getPage(activePageIndex + 1);
        const viewport = activePage.getViewport({ scale: effectiveScale });
        if (!canvas || disposed) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = activePage.render({
          canvasContext: canvas.getContext('2d', { alpha: false })!,
          viewport,
        });
        await renderTask.promise;
        if (!disposed) {
          setRenderedPage(activePageIndex);
          setSourceState('ready');
        }
      } catch (error: any) {
        if (!disposed && error?.name !== 'RenderingCancelledException') {
          setSourceState('error');
          setMessage(error?.message || 'Không thể phân tích hoặc render PDF.');
        }
      } finally {
        if (document) await document.destroy();
      }
    })();
    return () => {
      disposed = true;
      renderTask?.cancel?.();
      void loadingTask?.destroy?.();
    };
  }, [sourceUrl, pageIndex, effectiveScale, layout ? layout.pages.length : 0]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen, previewUrl]);

  const selectedItem = useMemo(
    () => layout?.items.find((item) => item.id === selected),
    [layout, selected]
  );

  const clientErrors = useMemo(() => {
    if (!layout) return ['Chưa có source PDF và layout.'];
    const errors: string[] = [];
    if (!layout.pages.length) errors.push('Layout phải có ít nhất một trang.');
    if (layout.items.length > 500) errors.push('Layout vượt quá 500 field.');
    for (const item of layout.items) {
      if (!Number.isInteger(item.pageIndex) || !layout.pages[item.pageIndex]) {
        errors.push(`${item.fieldKey}: trang không hợp lệ.`);
      }
      if (
        ![item.x, item.y, item.width, item.height].every(Number.isFinite) ||
        item.width <= 0 ||
        item.height <= 0 ||
        item.x < 0 ||
        item.y < 0 ||
        item.x + item.width > 1 ||
        item.y + item.height > 1
      ) {
        errors.push(`${item.fieldKey}: field vượt ngoài trang.`);
      }
    }
    return [...new Set(errors)];
  }, [layout]);

  const update = (id: string, patch: Partial<PdfTemplateItem>) => {
    setIsSaved(false);
    setLayout((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          }
        : current
    );
  };

  const applyReplacement = (file: File) => {
    setSource(file);
    const url = URL.createObjectURL(file);
    setSourceUrl(() => url);
    setSourceState('loading');
    setRenderedPage(null);
    if (!layout) setLayout(initialLayout(metadata));
    setPageIndex(0);
    setIsSaved(false);
    setMessage('PDF mới đã chọn; hãy preview và kiểm tra trước khi lưu.');
  };

  const handleFileSelected = (file: File) => {
    if (dirty) {
      setPendingFile(file);
      setConfirmReplaceOpen(true);
      return;
    }
    applyReplacement(file);
  };

  const handleBackClick = () => {
    if (dirty) {
      setConfirmBackOpen(true);
      return;
    }
    onBack?.();
  };

  const startDrag = (event: React.PointerEvent, item: PdfTemplateItem) => {
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
    }
    dragRef.current = {
      mode: 'move',
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      initialItem: { ...item },
    };
    setSelected(item.id);
  };

  const startResize = (event: React.PointerEvent, item: PdfTemplateItem, handle: Handle) => {
    event.stopPropagation();
    event.preventDefault();
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
    }
    dragRef.current = {
      mode: 'resize',
      handle,
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      initialItem: { ...item, style: { ...item.style } },
    };
    setSelected(item.id);
  };

  const move = (event: React.PointerEvent) => {
    if (!dragRef.current || !layout || !page) return;
    const { mode, id, startX, startY, initialItem, handle } = dragRef.current;
    const rawDx = (event.clientX - startX) / (page.width * effectiveScale);
    const rawDy = (event.clientY - startY) / (page.height * effectiveScale);

    const snapStep = 0.005;
    const dx = Math.round(rawDx / snapStep) * snapStep;
    const dy = Math.round(rawDy / snapStep) * snapStep;

    if (mode === 'move') {
      const updated = moveField(initialItem, dx, dy);
      update(id, { x: updated.x, y: updated.y });
    } else if (mode === 'resize' && handle) {
      const updated = resizeField(initialItem, handle, dx, dy);
      const isCornerResize =
        (handle.includes('n') || handle.includes('s')) &&
        (handle.includes('e') || handle.includes('w'));

      let nextStyle = initialItem.style;
      if (isCornerResize && initialItem.height > 0 && initialItem.style?.fontSize) {
        const heightRatio = updated.height / initialItem.height;
        const rawFontSize = initialItem.style.fontSize * heightRatio;
        const scaledFontSize = Math.min(48, Math.max(6, Math.round(rawFontSize)));
        nextStyle = {
          ...initialItem.style,
          fontSize: scaledFontSize,
        };
      }

      update(id, {
        x: updated.x,
        y: updated.y,
        width: updated.width,
        height: updated.height,
        style: nextStyle,
      });
    }
  };

  const stopDrag = (event: React.PointerEvent) => {
    if (dragRef.current) {
      if (event.currentTarget.releasePointerCapture) {
        try {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {}
      }
      dragRef.current = undefined;
    }
  };

  const keyboard = (event: React.KeyboardEvent, item: PdfTemplateItem) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      setIsSaved(false);
      setLayout((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((entry) => entry.id !== item.id),
            }
          : current
      );
      setSelected(undefined);
      return;
    }
    const step = event.shiftKey ? 0.01 : 0.001;
    const delta =
      event.key === 'ArrowLeft'
        ? { x: -step }
        : event.key === 'ArrowRight'
        ? { x: step }
        : event.key === 'ArrowUp'
        ? { y: -step }
        : event.key === 'ArrowDown'
        ? { y: step }
        : null;
    if (delta) {
      event.preventDefault();
      const updated = moveField(item, delta.x || 0, delta.y || 0);
      update(item.id, { x: updated.x, y: updated.y });
    }
  };

  const preview = async () => {
    if (!layout || clientErrors.length) return setMessage(clientErrors[0]);
    if (!canRenderPdfOverlays(sourceState, renderedPage, pageIndex)) {
      return setMessage('Hãy chờ trang PDF render thành công trước khi preview.');
    }
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError('');
    setBusy(true);
    setMessage('');
    try {
      const blob = await pdfTemplateApi.preview(
        metadata.templateTypeCode,
        layout,
        'vietnamese',
        source
      );
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setMessage('Preview synthetic đã sẵn sàng.');
    } catch (error: any) {
      const errText = error?.message || 'Preview thất bại.';
      setPreviewError(errText);
      setMessage(errText);
    } finally {
      setPreviewLoading(false);
      setBusy(false);
    }
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewLoading(false);
    setPreviewError('');
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return '';
    });
    previewButtonRef.current?.focus();
  };

  const handleSaveClick = () => {
    if (!layout || clientErrors.length || !layout.items.length) return;
    if (!canRenderPdfOverlays(sourceState, renderedPage, pageIndex)) {
      setMessage('Hãy chờ trang PDF render thành công trước khi lưu.');
      return;
    }
    setConfirmSaveOpen(true);
  };

  const performSave = async () => {
    if (!layout) return;
    setBusy(true);
    setMessage('');
    setConflict(false);
    try {
      if (!metadata.configured && !source) throw new Error('Template mới cần source PDF.');
      await pdfTemplateApi.validate(metadata.templateTypeCode, layout, source);
      if (metadata.configured) {
        await pdfTemplateApi.save(metadata.templateTypeCode, metadata.version, layout, source);
      } else {
        await pdfTemplateApi.create(metadata.templateTypeCode, layout, source!);
      }
      setIsSaved(true);
      setMessage('Đã lưu template hiện hành.');
      onSaved();
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 409) setConflict(true);
      setMessage(error?.message || 'Save thất bại.');
    } finally {
      setBusy(false);
    }
  };

  if (!layout) {
    return (
      <section className="flex flex-col h-full min-h-0 w-full overflow-hidden" aria-label="PDF template editor">
        <div className="relative w-full bg-white/45 backdrop-blur-md border-b border-white/70 h-[41px] flex items-center px-3 lg:px-[12px] shrink-0 z-[49] shadow-sm shadow-slate-200/10 gap-2 lg:gap-3 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBackClick}
                className="h-7 px-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900 transition-colors shrink-0"
              >
                ← Quay lại
              </Button>
            )}
            {onBack && <div className="h-4 w-px bg-slate-200/80 shrink-0" />}
            <h1 id="pdf-editor-title" className="text-[13.5px] font-bold text-slate-900 truncate shrink-0">
              {mode === 'new' ? 'Thêm mẫu PDF' : 'Sửa mẫu PDF'}
            </h1>
            <span className="text-[11px] font-medium text-slate-500 font-mono hidden md:inline truncate">
              {metadata.displayName} ({metadata.templateTypeCode})
            </span>
          </div>
        </div>

        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 bg-white/50 max-w-md w-full">
            <p className="font-semibold text-slate-700">Chưa có PDF nền. Chọn source PDF để bắt đầu thiết kế.</p>
            <label className="mt-4 inline-flex items-center gap-2 cursor-pointer rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
              Chọn file PDF
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(event) => event.target.files?.[0] && handleFileSelected(event.target.files[0])}
              />
            </label>
            {message && <p role="status" className="mt-3 text-slate-600 font-medium">{message}</p>}
          </div>
        </div>
      </section>
    );
  }

  if (!page) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        Layout không có metadata trang hợp lệ.
      </p>
    );
  }

  return (
    <section className="flex flex-col h-full min-h-0 w-full overflow-hidden" aria-label="PDF template editor">
      {/* Redesigned 41px Command Bar */}
      <div className="relative w-full bg-white/45 backdrop-blur-md border-b border-white/70 h-[41px] flex items-center px-3 lg:px-[12px] shrink-0 z-[49] shadow-sm shadow-slate-200/10 gap-2 lg:gap-3 justify-between">
        {/* Left: Back button, Title & Metadata */}
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="h-7 px-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900 transition-colors shrink-0"
            >
              ← Quay lại
            </Button>
          )}
          {onBack && <div className="h-4 w-px bg-slate-200/80 shrink-0" />}
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <h1 id="pdf-editor-title" className="text-[13.5px] font-bold text-slate-900 truncate shrink-0">
              {mode === 'new' ? 'Thêm mẫu PDF' : 'Sửa mẫu PDF'}
            </h1>
            <span className="text-[11px] font-medium text-slate-500 font-mono hidden md:inline truncate">
              {metadata.displayName} ({metadata.templateTypeCode})
            </span>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          <label className="inline-flex items-center gap-1 rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm text-slate-700 hover:bg-white/70 hover:border-[#1A73E8]/20 hover:text-[#1A73E8] px-2.5 py-1 text-[12px] font-semibold cursor-pointer transition-all shadow-xs shrink-0">
            Thay PDF nền
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(event) => event.target.files?.[0] && handleFileSelected(event.target.files[0])}
            />
          </label>

          <label className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-600 shrink-0">
            <span className="hidden sm:inline">Trang</span>
            <select
              aria-label="Trang PDF"
              value={pageIndex}
              onChange={(event) => setPageIndex(Number(event.target.value))}
              className="rounded-xl border border-white/70 bg-white/50 px-2 py-0.5 text-[12px] font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {layout.pages.map((entry) => (
                <option key={entry.pageIndex} value={entry.pageIndex}>
                  {entry.pageIndex + 1} / {layout.pages.length}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center rounded-xl border border-white/70 bg-white/50 p-0.5 gap-0.5 shrink-0" role="group" aria-label="Chế độ xem">
            <button
              type="button"
              onClick={() => setViewMode('fit')}
              className={cn(
                "px-2.5 py-0.5 text-[12px] font-semibold rounded-lg transition-all",
                viewMode === 'fit'
                  ? "bg-[#1A73E8] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Fit page
            </button>
            <button
              type="button"
              onClick={() => setViewMode('100')}
              className={cn(
                "px-2.5 py-0.5 text-[12px] font-semibold rounded-lg transition-all",
                viewMode === '100'
                  ? "bg-[#1A73E8] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              100%
            </button>
          </div>
        </div>

        {/* Right: Status, Preview, Save */}
        <div className="flex items-center gap-2 shrink-0">
          {message && (
            <span role="status" className="text-[11px] font-medium text-slate-600 max-w-[140px] lg:max-w-xs truncate mr-1">
              {message}
            </span>
          )}
          <Button
            ref={previewButtonRef}
            type="button"
            variant="secondary"
            size="sm"
            onClick={preview}
            disabled={busy || clientErrors.length > 0}
            className="h-7 px-3 text-[12px] font-bold shrink-0 bg-slate-800 hover:bg-slate-900 text-white"
          >
            Preview
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSaveClick}
            disabled={busy || clientErrors.length > 0 || !layout.items.length}
            className="h-7 px-3 text-[12px] font-bold shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 p-3 lg:p-4 flex flex-col space-y-3 overflow-hidden">
        {conflict && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200 shrink-0"
          >
            <span>Template đã được operator khác lưu. Các thay đổi local vẫn được giữ.</span>
            <button
              type="button"
              onClick={onSaved}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold hover:bg-amber-100/50"
            >
              Tải phiên bản mới
            </button>
          </div>
        )}

        {clientErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200 shrink-0"
          >
            <p className="font-bold">Không thể lưu khi còn lỗi layout:</p>
            <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">
              {clientErrors.slice(0, 5).map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Main Workspace */}
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-stretch overflow-hidden">
          {/* Canvas Area */}
          <div
            ref={containerRef}
            className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 lg:p-6 relative flex items-start justify-center min-h-[450px] lg:min-h-0"
          >
            <div
              className="relative mx-auto shadow-xl bg-white transition-all shrink-0"
              style={{
                width: page.width * effectiveScale,
                height: page.height * effectiveScale,
              }}
            >
              <canvas
                ref={canvasRef}
                aria-label={`PDF page ${pageIndex + 1}`}
                className="absolute inset-0 block pointer-events-none"
              />

              {sourceState === 'loading' && (
                <p className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-medium text-slate-600 backdrop-blur-[1px]">
                  Đang tải và render trang PDF...
                </p>
              )}

              {sourceState === 'missing' && (
                <p className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-medium text-slate-500 backdrop-blur-[1px]">
                  Chưa có source PDF. Hãy chọn một file PDF.
                </p>
              )}

              {sourceState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 p-4 text-center text-sm text-red-700">
                  <p role="alert">{message || 'Không thể tải hoặc render PDF.'}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRetry((value) => value + 1)}
                    className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                  >
                    Thử lại
                  </Button>
                </div>
              )}

              {/* Field overlays */}
              {canRenderPdfOverlays(sourceState, renderedPage, pageIndex) &&
                layout.items
                  .filter((item) => item.pageIndex === pageIndex)
                  .map((item) => {
                    const isSelected = selected === item.id;
                    const itemFontSize = item.style?.fontSize ?? 12;
                    const effectiveFontSize = itemFontSize * effectiveScale;
                    const hAlign = item.style?.horizontalAlign || 'left';
                    const vAlign = item.style?.verticalAlign || 'top';
                    const padding = (item.style?.padding ?? 2) * effectiveScale;
                    const lineHeight = item.style?.lineHeight ?? 1.15;
                    const bgWhite = item.style?.background === 'white';

                    const justifyClass =
                      hAlign === 'center'
                        ? 'justify-center text-center'
                        : hAlign === 'right'
                        ? 'justify-end text-right'
                        : 'justify-start text-left';

                    const itemsAlignClass =
                      vAlign === 'middle'
                        ? 'items-center'
                        : vAlign === 'bottom'
                        ? 'items-end'
                        : 'items-start';

                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        aria-label={item.fieldKey}
                        onPointerDown={(event) => startDrag(event, item)}
                        onPointerMove={move}
                        onPointerUp={stopDrag}
                        onPointerCancel={stopDrag}
                        onKeyDown={(event) => keyboard(event, item)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(item.id);
                        }}
                        className={`absolute select-none overflow-visible focus:outline-none transition-colors ${
                          isSelected
                            ? 'border-2 border-blue-600 bg-blue-500/20 text-blue-950 font-bold shadow-md ring-2 ring-blue-400/40'
                            : 'border border-blue-400/70 bg-blue-50/40 text-blue-800 hover:border-blue-600 hover:bg-blue-100/50'
                        }`}
                        style={{
                          left: item.x * page.width * effectiveScale,
                          top: item.y * page.height * effectiveScale,
                          width: item.width * page.width * effectiveScale,
                          height: item.height * page.height * effectiveScale,
                          zIndex: isSelected ? 50 : item.zIndex + 1,
                          cursor: 'move',
                        }}
                      >
                        <div
                          className={`w-full h-full overflow-hidden truncate font-mono font-semibold leading-tight flex ${justifyClass} ${itemsAlignClass}`}
                          style={{
                            fontSize: `${effectiveFontSize}px`,
                            padding: `${padding}px`,
                            lineHeight,
                            backgroundColor: bgWhite ? '#ffffff' : undefined,
                            textAlign: hAlign,
                          }}
                        >
                          <span className="truncate">{item.fieldKey}</span>
                        </div>

                        {/* 4 visible corner resize handles on selected item */}
                        {isSelected &&
                          RESIZE_HANDLES.map((h) => (
                            <div
                              key={h.handle}
                              role="button"
                              tabIndex={-1}
                              title={h.title}
                              aria-label={h.title}
                              onPointerDown={(event) => startResize(event, item, h.handle)}
                              onPointerMove={move}
                              onPointerUp={stopDrag}
                              onPointerCancel={stopDrag}
                              className={`absolute ${h.positionClass} ${h.cursor} w-2.5 h-2.5 bg-blue-600 border border-white rounded-sm shadow-sm hover:scale-125 z-50 transition-transform`}
                            />
                          ))}
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* Right Sidebar */}
          <aside
            className="flex flex-col min-h-0 h-full rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-md"
            aria-label="Field controls"
          >
            {/* Field Palette */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Field palette</h2>
              <span className="text-[11px] font-medium text-slate-400">{metadata.fields.length} trường</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 py-2 pr-1 text-xs">
              {metadata.fields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  className="w-full flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-2 text-left hover:bg-blue-50/50 hover:border-blue-200 transition-colors group"
                  onClick={() => {
                    const id = crypto.randomUUID();
                    setIsSaved(false);
                    setLayout((current) =>
                      current && {
                        ...current,
                        items: [
                          ...current.items,
                          {
                            id,
                            fieldKey: field.key,
                            formatter: field.allowedFormatters[0] || 'plain',
                            pageIndex,
                            x: 0.1,
                            y: 0.1,
                            width: 0.2,
                            height: 0.03,
                            rotation: 0,
                            zIndex: current.items.length,
                            style: field.defaultStyle,
                          },
                        ],
                      }
                    );
                    setSelected(id);
                  }}
                >
                  <span className="font-medium text-slate-700 group-hover:text-blue-700 truncate">
                    {field.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1.5">
                    {field.key}
                  </span>
                </button>
              ))}
            </div>

            {/* Field Properties Panel */}
            {selectedItem && (
              <div className="shrink-0 border-t border-slate-200 pt-3 mt-auto space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Thuộc tính field
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaved(false);
                      setLayout(
                        (current) =>
                          current && {
                            ...current,
                            items: current.items.filter((e) => e.id !== selectedItem.id),
                          }
                      );
                      setSelected(undefined);
                    }}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Xóa field
                  </button>
                </div>

                <p className="text-xs font-bold text-slate-800 font-mono truncate">
                  {selectedItem.fieldKey}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {(['x', 'y', 'width', 'height', 'rotation', 'zIndex'] as const).map((key) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-1 text-[11px] font-medium text-slate-600"
                    >
                      <span>{key}</span>
                      <input
                        type="number"
                        aria-label={key}
                        step={key === 'rotation' || key === 'zIndex' ? '1' : '0.001'}
                        value={selectedItem[key]}
                        onChange={(event) =>
                          update(selectedItem.id, { [key]: Number(event.target.value) })
                        }
                        className="w-16 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs font-mono"
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                    <span>Formatter</span>
                    <select
                      value={selectedItem.formatter}
                      onChange={(event) => update(selectedItem.id, { formatter: event.target.value })}
                      className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      {(
                        metadata.fields.find((f) => f.key === selectedItem.fieldKey)
                          ?.allowedFormatters || ['plain']
                      ).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                    <span>Font size</span>
                    <input
                      type="number"
                      min="6"
                      max="48"
                      step="1"
                      value={selectedItem.style.fontSize}
                      onChange={(event) =>
                        update(selectedItem.id, {
                          style: {
                            ...selectedItem.style,
                            fontSize: Number(event.target.value),
                          },
                        })
                      }
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-right font-mono"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                    <span>Align H</span>
                    <select
                      aria-label="Align H"
                      value={selectedItem.style.horizontalAlign}
                      onChange={(event) =>
                        update(selectedItem.id, {
                          style: {
                            ...selectedItem.style,
                            horizontalAlign: event.target.value as PdfTemplateItem['style']['horizontalAlign'],
                          },
                        })
                      }
                      className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                    <span>Align V</span>
                    <select
                      aria-label="Align V"
                      value={selectedItem.style.verticalAlign}
                      onChange={(event) =>
                        update(selectedItem.id, {
                          style: {
                            ...selectedItem.style,
                            verticalAlign: event.target.value as PdfTemplateItem['style']['verticalAlign'],
                          },
                        })
                      }
                      className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="top">top</option>
                      <option value="middle">middle</option>
                      <option value="bottom">bottom</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                    <span>Overflow</span>
                    <select
                      value={selectedItem.style.overflow}
                      onChange={(event) =>
                        update(selectedItem.id, {
                          style: {
                            ...selectedItem.style,
                            overflow: event.target.value as PdfTemplateItem['style']['overflow'],
                          },
                        })
                      }
                      className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="shrink">shrink</option>
                      <option value="wrap">wrap</option>
                      <option value="clip">clip</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Synthetic Preview Modal */}
      {isPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Synthetic PDF preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closePreview();
            }
          }}
        >
          <div className="flex flex-col w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-slate-900">Synthetic preview</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closePreview}
                className="h-8 px-3 text-xs font-semibold"
                aria-label="Đóng preview"
              >
                Đóng preview
              </Button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-[500px] p-4 bg-slate-100/50 overflow-auto flex items-center justify-center">
              {previewLoading && (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <p className="text-xs font-medium">Đang tạo synthetic preview...</p>
                </div>
              )}

              {!previewLoading && previewError && (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-red-700 max-w-md">
                  <p role="alert" className="font-medium">{previewError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={preview}
                    className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                  >
                    Thử lại
                  </Button>
                </div>
              )}

              {!previewLoading && !previewError && previewUrl && (
                <iframe
                  title="Synthetic PDF preview"
                  src={previewUrl}
                  className="h-[75vh] w-full rounded-xl border border-slate-200 bg-white shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Save Modal */}
      <ConfirmModal
        isOpen={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        onConfirm={performSave}
        title="Xác nhận lưu template"
        message="Lưu template này thành cấu hình hiện hành?"
        confirmLabel="Lưu template"
        cancelLabel="Hủy"
        variant="info"
      />

      {/* Confirm Back Modal */}
      <ConfirmModal
        isOpen={confirmBackOpen}
        onClose={() => setConfirmBackOpen(false)}
        onConfirm={() => {
          setConfirmBackOpen(false);
          onBack?.();
        }}
        title="Xác nhận rời trang"
        message="Bạn có thay đổi chưa lưu. Rời trang sẽ mất các thay đổi này?"
        confirmLabel="Rời trang"
        cancelLabel="Ở lại"
        variant="warning"
      />

      {/* Confirm Replace Background PDF Modal */}
      <ConfirmModal
        isOpen={confirmReplaceOpen}
        onClose={() => {
          setConfirmReplaceOpen(false);
          setPendingFile(undefined);
        }}
        onConfirm={() => {
          setConfirmReplaceOpen(false);
          if (pendingFile) applyReplacement(pendingFile);
          setPendingFile(undefined);
        }}
        title="Xác nhận thay PDF nền"
        message="Thay PDF nền sẽ có thể làm sai vị trí các field. Tiếp tục?"
        confirmLabel="Thay PDF"
        cancelLabel="Hủy"
        variant="warning"
      />
    </section>
  );
}
