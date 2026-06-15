import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

interface LoadingTemplateProps {
  variant?: 'default' | 'card' | 'auth';
}

export function LoadingTemplate({ variant = 'default' }: LoadingTemplateProps) {
  if (variant === 'auth') {
    return (
      <div className="flex min-h-[300px] w-full flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-300">
        <Spinner className="h-8 w-8 text-[#1A73E8] animate-spin" />
        <p className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-6 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-4 w-[180px]" />
        </div>
        <Skeleton className="h-10 w-[120px] rounded-xl" />
      </div>

      {/* Main content Area - simulating a grid or a table */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Skeleton Card 1 */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/10">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </div>
        </div>

        {/* Skeleton Card 2 */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/10">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </div>
        </div>

        {/* Skeleton Card 3 */}
        <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/10">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Large Content Skeleton */}
      <div className="rounded-2xl border border-white/60 bg-white/40 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/10">
        <div className="space-y-4">
          <Skeleton className="h-6 w-[200px]" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
        </div>
      </div>

      {/* Spinner at the center for extra visual feedback */}
      <div className="flex justify-center py-4">
        <Spinner className="h-6 w-6 text-[#1A73E8]" />
      </div>
    </div>
  );
}
