'use client';

import { useParams } from 'next/navigation';
import PdfTemplateEditorRoute from '@/components/pdf-template/PdfTemplateEditorRoute';

export default function EditDormitoryPdfTemplatePage() {
  const params = useParams<{ templateTypeCode: string }>();
  return (
    <PdfTemplateEditorRoute
      mode="edit"
      templateTypeCode={decodeURIComponent(params.templateTypeCode || '')}
      routeBase="/dormitory/pdf-template"
    />
  );
}
