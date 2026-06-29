'use client';

import { ErrorTemplate } from '@/components/ui/error-template';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  return <ErrorTemplate error={error} reset={reset} title="Lỗi tải trang thông báo" />;
}
