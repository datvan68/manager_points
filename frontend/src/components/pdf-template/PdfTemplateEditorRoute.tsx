'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { pdfTemplateApi, PdfTemplateMetadata } from '@/api/pdf-template-api';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';
import PdfTemplateEditor from './PdfTemplateEditor';

type Props = { templateTypeCode: string; mode: 'new' | 'edit' };

function EditorRoute({ templateTypeCode, mode }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const access = usePermission({ manage: 'PDF_TEMPLATE_MANAGE' });
  const [metadata, setMetadata] = useState<PdfTemplateMetadata | null>(null);
  const [error, setError] = useState('');
  const returnTo = params.get('returnTo');
  const returnPath = returnTo ? `/pdf-templates?${returnTo}` : '/pdf-templates';

  useEffect(() => {
    let cancelled = false;
    if (!templateTypeCode) { setError('Thiếu mã collection.'); return; }
    pdfTemplateApi.metadata(templateTypeCode).then((value) => {
      if (cancelled) return;
      if (mode === 'new' && value.configured) setError('Collection này đã được cấu hình.');
      else if (mode === 'edit' && !value.configured) setError('Collection này chưa có template để sửa.');
      else setMetadata(value);
    }).catch((cause: any) => { if (!cancelled) setError(cause?.message || 'Không thể tải metadata template.'); });
    return () => { cancelled = true; };
  }, [templateTypeCode, mode]);

  if (!access.manage) return <div className="p-8 text-sm">Bạn không có quyền quản lý PDF template.</div>;
  return <main className="space-y-4 p-6" aria-labelledby="pdf-editor-title"><button type="button" onClick={() => router.push(returnPath)} className="rounded-lg border px-3 py-2 text-sm font-semibold">← Quay lại catalog</button><h1 id="pdf-editor-title" className="text-2xl font-black">{mode === 'new' ? 'Thêm mẫu PDF' : 'Sửa mẫu PDF'}</h1>{error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" className="ml-3 underline" onClick={() => router.push(returnPath)}>Quay lại</button></div> : metadata ? <PdfTemplateEditor metadata={metadata} onSaved={() => router.push(returnPath)} /> : <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">Đang tải metadata...</p>}</main>;
}

export default function PdfTemplateEditorRoute(props: Props) {
  return <RouteGuard requiredPermission="PDF_TEMPLATE_MANAGE" fallbackPath="/pdf-templates"><EditorRoute {...props} /></RouteGuard>;
}
