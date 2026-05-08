'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

const Research = React.forwardRef<HTMLInputElement, ResearchProps>(
  ({ className, containerClassName, ...props }, ref) => {
    return (
      <div 
        className={cn(
          "flex items-center gap-2 h-10 px-3 py-2.5 bg-[#ebebeb3] border border-[#dadada]/50 rounded-[10px] w-full max-w-[231px] transition-all focus-within:border-[#135bec]/50 focus-within:bg-white focus-within:shadow-sm",
          containerClassName
        )}
      >
        <Search className="shrink-0 size-4 text-[#0a0a0a80]" />
        <input
          ref={ref}
          type="text"
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-[14px] text-gray-900 placeholder:text-[#0a0a0a80] w-full",
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
