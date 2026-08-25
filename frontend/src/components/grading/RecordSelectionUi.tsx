import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';

export type SelectionValue = string | string[];

export function toggleSelectionValue(value: string[], item: string): string[] {
  return value.includes(item) ? value.filter(entry => entry !== item) : [...value, item];
}

export function quickGridClass(itemCount: number): string {
  return itemCount > 6
    ? 'max-h-[300px] sm:max-h-[340px] lg:max-h-[260px] xl:max-h-[300px] overflow-y-auto pr-1'
    : 'max-h-none overflow-visible';
}

interface RecordSelectionDialogProps {
  label: string;
  title: string;
  description?: string;
  value: SelectionValue;
  displayValue?: string;
  multiple?: boolean;
  disabled?: boolean;
  placeholder: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchable?: boolean;
  onConfirm: (value: SelectionValue) => void;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  children: (draftValue: SelectionValue, setDraftValue: (value: SelectionValue) => void, searchQuery: string) => React.ReactNode;
}

export function RecordSelectionDialog({
  label, title, description, value, displayValue, multiple = false, disabled, placeholder, searchValue = '', onSearchChange,
  onConfirm, loading, onLoadMore, hasMore, searchable = false, children,
}: RecordSelectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<SelectionValue>(value);
  const [internalSearch, setInternalSearch] = useState('');

  useEffect(() => {
    if (open) setDraftValue(value);
  }, [open, value]);

  const committedLabel = displayValue || (Array.isArray(value) ? (value.length ? `${value.length} mục đã chọn` : placeholder) : (value || placeholder));
  const setDraft = (next: SelectionValue) => setDraftValue(multiple ? (Array.isArray(next) ? next : [next]) : (Array.isArray(next) ? next[0] || '' : next));
  const handleConfirm = () => {
    onConfirm(draftValue);
    setOpen(false);
  };

  return (
    <div className="flex flex-col w-full">
      <label className="text-xs font-semibold text-slate-600 mb-1 ml-1">{label}</label>
      <Button type="button" variant="ghost" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="h-9 sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-xs sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60">
        <span className={`truncate ${committedLabel === placeholder ? 'font-normal text-[#64748B]/60' : ''}`}>{committedLabel}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-1/2 top-1/2 h-[min(90dvh,720px)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-0 bg-slate-50/95 p-4 sm:p-6 lg:p-10">
          <div className="mx-auto flex min-h-0 h-full w-full max-w-4xl flex-col gap-4 overflow-hidden">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div><DialogTitle>{title}</DialogTitle><DialogDescription>{description || 'Chọn giá trị rồi nhấn Xác nhận để áp dụng.'}</DialogDescription></div>
              <X className="sr-only" aria-hidden="true" />
            </div>
            {(onSearchChange || searchable) && <Input autoFocus type="search" role="combobox" aria-label={`Tìm ${label.toLowerCase()}`} value={onSearchChange ? searchValue : internalSearch} onChange={e => onSearchChange ? onSearchChange(e.target.value) : setInternalSearch(e.target.value)} placeholder={`Tìm ${label.toLowerCase()}...`} className="h-10 rounded-xl bg-white" />}
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3" role="listbox" aria-label={`Danh sách ${label.toLowerCase()}`}>
              {children(draftValue, setDraft, onSearchChange ? searchValue : internalSearch)}
              {loading && <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Đang tải...</div>}
              {hasMore && <Button type="button" variant="outline" onClick={onLoadMore} disabled={loading} className="mx-auto mt-3 flex">Tải thêm</Button>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
              <Button type="button" onClick={handleConfirm}><Check className="h-4 w-4" />Xác nhận</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
