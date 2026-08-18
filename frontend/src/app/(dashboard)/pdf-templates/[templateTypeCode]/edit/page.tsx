'use client';

import { useParams } from 'next/navigation';
import PdfTemplateEditorRoute from '@/components/pdf-template/PdfTemplateEditorRoute';

export default function EditPdfTemplatePage() {
  const params = useParams<{ templateTypeCode: string }>();
  return <PdfTemplateEditorRoute mode="edit" templateTypeCode={decodeURIComponent(params.templateTypeCode || '')} />;
}
