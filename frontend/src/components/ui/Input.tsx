'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
  error?: string;
  containerClassName?: string;
  multiline?: boolean;
  rows?: number;
}

const Input = React.forwardRef<any, InputProps>(
  ({ className, label, required, error, containerClassName, type, multiline, rows = 3, ...props }, ref) => {
    return (
      <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
        {label && (
          <label className="flex items-center gap-1 px-1 text-sm font-medium text-slate-700">
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        {multiline ? (
          <textarea
            className={cn(
              "flex min-h-[80px] w-full rounded-lg border border-slate-200/60 bg-[#f8fafc] px-3 py-2 text-sm text-slate-900 ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#135bec]/20 focus-visible:border-[#135bec]/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none",
              error && "border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500",
              className
            )}
            rows={rows}
            ref={ref}
            {...(props as any)}
          />
        ) : (
          <input
            type={type}
            className={cn(
              "flex h-10 w-full rounded-lg border border-slate-200/60 bg-[#f8fafc] px-3 py-2 text-sm text-slate-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#135bec]/20 focus-visible:border-[#135bec]/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
              error && "border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500",
              className
            )}
            ref={ref}
            {...(props as any)}
          />
        )}
        {error && (
          <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
