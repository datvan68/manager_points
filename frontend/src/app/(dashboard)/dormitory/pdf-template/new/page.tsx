'use client';

import { useSearchParams } from 'next/navigation';
import PdfTemplateEditorRoute from '@/components/pdf-template/PdfTemplateEditorRoute';

export default function NewDormitoryPdfTemplatePage() {
  const params = useSearchParams();
  return (
    <PdfTemplateEditorRoute
      mode="new"
      templateTypeCode={params.get('templateTypeCode') || ''}
      routeBase="/dormitory/pdf-template"
    />
  );
}
