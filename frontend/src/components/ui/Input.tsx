'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { controlBase } from './controlStyles';

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
          <label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        {multiline ? (
          <textarea
            className={cn(
              `flex min-h-[80px] w-full px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 resize-none ${controlBase}`,
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
              `flex h-10 w-full px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 ${controlBase}`,
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
