'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { controlBase } from './controlStyles';

interface ResearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

const Research = React.forwardRef<HTMLInputElement, ResearchProps>(
  ({ className, containerClassName, ...props }, ref) => {
    return (
      <div 
        className={cn(
          `flex items-center gap-2 h-9 px-3 py-1.5 w-full max-w-[231px] border border-white/80 bg-white/50 backdrop-blur-sm focus-within:bg-white/70 focus-within:shadow-xs transition-all duration-150 ease-out ${controlBase}`,
          containerClassName
        )}
      >
        <Search className="shrink-0 size-3.5 text-slate-400" />
        <input
          ref={ref}
          type="text"
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-xs font-medium text-slate-700 placeholder:text-slate-400 w-full",
            className
          )}
          placeholder="Tìm kiếm..."
          {...props}
        />
      </div>
    );
  }
);

Research.displayName = "Research";

export { Research };
