'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { pdfTemplateApi, PdfTemplateMetadata } from '@/api/pdf-template-api';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';
import PdfTemplateEditor from './PdfTemplateEditor';

type Props = { templateTypeCode: string; mode: 'new' | 'edit'; routeBase?: string };

function EditorRoute({ templateTypeCode, mode, routeBase = '/dormitory/pdf-template' }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const access = usePermission({ manage: 'PDF_TEMPLATE_MANAGE' });
  const [metadata, setMetadata] = useState<PdfTemplateMetadata | null>(null);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const returnTo = params.get('returnTo');
  const returnPath = returnTo ? `${routeBase}?${returnTo}` : routeBase;
  const goBack = () => {
    if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Rời trang sẽ mất các thay đổi này?')) return;
    router.push(returnPath);
  };

  useEffect(() => {
    let cancelled = false;
    if (!templateTypeCode) {
      setError('Thiếu mã collection.');
      return;
    }
    pdfTemplateApi
      .metadata(templateTypeCode)
      .then((value) => {
        if (cancelled) return;
        if (mode === 'new' && value.configured) setError('Collection này đã được cấu hình.');
        else if (mode === 'edit' && !value.configured) setError('Collection này chưa có template để sửa.');
        else setMetadata(value);
      })
      .catch((cause: any) => {
        if (!cancelled) setError(cause?.message || 'Không thể tải metadata template.');
      });
    return () => {
      cancelled = true;
    };
  }, [templateTypeCode, mode]);

  if (!access.manage) return <div className="p-8 text-sm">Bạn không có quyền quản lý PDF template.</div>;

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col space-y-4 overflow-y-auto p-4 lg:p-6" aria-labelledby="pdf-editor-title">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            ← Quay lại catalog
          </button>
          <h1 id="pdf-editor-title" className="text-xl font-bold text-slate-900">
            {mode === 'new' ? 'Thêm mẫu PDF' : 'Sửa mẫu PDF'}
          </h1>
          {metadata && (
            <span className="text-xs text-slate-500 font-mono">
              {metadata.displayName} ({metadata.templateTypeCode})
            </span>
          )}
        </div>
      </div>
      {error ? (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button type="button" className="ml-3 underline font-semibold" onClick={goBack}>
            Quay lại
          </button>
        </div>
      ) : metadata ? (
        <div className="flex flex-1 min-h-0 flex-col">
          <PdfTemplateEditor metadata={metadata} onSaved={() => router.push(returnPath)} onDirtyChange={setDirty} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">
          Đang tải metadata...
        </p>
      )}
    </main>
  );
}

export default function PdfTemplateEditorRoute(props: Props) {
  const { routeBase = '/dormitory/pdf-template' } = props;
  return (
    <RouteGuard requiredPermission="PDF_TEMPLATE_MANAGE" fallbackPath={routeBase}>
      <EditorRoute {...props} routeBase={routeBase} />
    </RouteGuard>
  );
}
