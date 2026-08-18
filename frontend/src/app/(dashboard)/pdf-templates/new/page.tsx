'use client';

import { useSearchParams } from 'next/navigation';
import PdfTemplateEditorRoute from '@/components/pdf-template/PdfTemplateEditorRoute';

export default function NewPdfTemplatePage() {
  const params = useSearchParams();
  return <PdfTemplateEditorRoute mode="new" templateTypeCode={params.get('templateTypeCode') || ''} />;
}
