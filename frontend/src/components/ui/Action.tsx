'use client';

import React from 'react';
import { PencilLine, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermission } from '@/components/guards/RouteGuard';

interface ActionProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  className?: string;
  hideEdit?: boolean;
  hideDelete?: boolean;
  hideView?: boolean;
  /** Custom permission code required to show the Edit button */
  permissionEdit?: string;
  /** Custom permission code required to show the Delete button */
  permissionDelete?: string;
  /** Custom permission code required to show the View button */
  permissionView?: string;
}

const Action = ({ 
  onEdit, 
  onDelete, 
  onView,
  className,
  hideEdit = false,
  hideDelete = false,
  hideView = false,
  permissionEdit,
  permissionDelete,
  permissionView
}: ActionProps) => {
  // Use usePermission hook for checking individual actions
  const permissions = usePermission({
    edit: permissionEdit || '',
    delete: permissionDelete || '',
    view: permissionView || '',
  });

  const canEdit = permissionEdit ? permissions.edit : true;
  const canDelete = permissionDelete ? permissions.delete : true;
  const canView = permissionView ? permissions.view : true;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {!hideView && onView && canView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView?.();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 ease-out group hover:bg-white/60 border border-transparent hover:border-white/50 hover:scale-[1.05] active:scale-[0.95]"
          title="Xem chi tiết"
        >
          <Eye 
            size={16} 
            className="text-slate-400 group-hover:text-blue-600 transition-colors" 
          />
        </button>
      )}
      {!hideEdit && canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 ease-out group hover:bg-white/60 border border-transparent hover:border-white/50 hover:scale-[1.05] active:scale-[0.95]"
          title="Chỉnh sửa"
        >
          <PencilLine 
            size={16} 
            className="text-slate-400 group-hover:text-slate-900 transition-colors" 
          />
        </button>
      )}
      {!hideDelete && canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 ease-out group hover:bg-white/60 border border-transparent hover:border-white/50 hover:scale-[1.05] active:scale-[0.95]"
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
