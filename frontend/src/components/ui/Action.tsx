'use client';

import React from 'react';
import { PencilLine, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  className?: string;
  hideEdit?: boolean;
  hideDelete?: boolean;
  hideView?: boolean;
}

const Action = ({ 
  onEdit, 
  onDelete, 
  onView,
  className,
  hideEdit = false,
  hideDelete = false,
  hideView = false
}: ActionProps) => {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {!hideView && onView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView?.();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-[10px] transition-all group hover:bg-slate-100"
          title="Xem chi tiết"
        >
          <Eye 
            size={16} 
            className="text-slate-400 group-hover:text-blue-600 transition-colors" 
          />
        </button>
      )}
      {!hideEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-[10px] transition-all group hover:bg-slate-100"
          title="Chỉnh sửa"
        >
          <PencilLine 
            size={16} 
            className="text-slate-400 group-hover:text-slate-900 transition-colors" 
          />
        </button>
      )}
      {!hideDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-[10px] transition-all group hover:bg-slate-100"
          title="Xóa"
        >
          <Trash2 
            size={16} 
            className="text-slate-400 group-hover:text-red-600 transition-colors" 
          />
        </button>
      )}
    </div>
  );
};

export default Action;
