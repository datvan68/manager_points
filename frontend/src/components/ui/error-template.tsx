'use client';

import * as React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorTemplateProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

export function ErrorTemplate({ error, reset, title = "Đã xảy ra lỗi hệ thống" }: ErrorTemplateProps) {
  React.useEffect(() => {
    console.error('Render error boundary captured:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
        <AlertCircle className="h-10 w-10" />
        <div className="absolute -inset-0.5 -z-10 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 opacity-20 blur-sm" />
      </div>
      
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-[#1E293B] dark:text-[#F8FAFC]">
        {title}
      </h2>
      
      <p className="mx-auto mb-8 max-w-md text-sm text-[#64748B] dark:text-[#94A3B8]">
        {error.message || "Chúng tôi xin lỗi vì sự bất tiện này. Một lỗi không mong muốn đã xảy ra. Vui lòng thử lại hoặc liên hệ với bộ phận hỗ trợ."}
      </p>

      {error.digest && (
        <span className="mb-6 rounded-md bg-[#F1F5F9] px-2.5 py-1 text-xs font-mono text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]">
          Mã lỗi: {error.digest}
        </span>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button 
          onClick={() => reset()}
          variant="default"
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Thử lại
        </Button>
        
        <Button
          onClick={() => window.location.href = '/'}
          variant="outline"
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Về trang chủ
        </Button>
      </div>
    </div>
  );
}
