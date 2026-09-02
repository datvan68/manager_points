import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export type SelectionValue = string | string[];

export function toggleSelectionValue(value: string[], item: string): string[] {
  return value.includes(item) ? value.filter(entry => entry !== item) : [...value, item];
}

export function quickGridClass(itemCount: number): string {
  return itemCount > 6
    ? 'auto-rows-[52px] sm:auto-rows-[56px] xl:auto-rows-[52px] max-h-[360px] sm:max-h-[190px] lg:max-h-[190px] xl:max-h-[206px] overflow-y-auto pr-2'
    : 'max-h-none overflow-visible';
}

export interface RecordOptionRowProps {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export function RecordOptionRow({
  id,
  label,
  subLabel,
  badge,
  selected,
  onClick,
  className = '',
}: RecordOptionRowProps) {
  return (
    <button
      key={id}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 md:py-2 text-left font-semibold transition-colors min-h-[44px] md:min-h-0 text-sm md:text-xs ${
        selected
          ? 'bg-blue-50 text-blue-800 font-bold'
          : 'hover:bg-slate-50 text-slate-700'
      } ${className}`}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate">{label}</span>
        {subLabel && <span className="text-xs md:text-[11px] text-slate-500 font-normal">{subLabel}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {badge && <span className="text-xs md:text-[11px] text-slate-400 font-mono">{badge}</span>}
        {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
      </div>
    </button>
  );
}

export interface RecordSelectionDialogProps {
  label: string;
  labelClassName?: string;
  title: string;
  description?: string;
  hideHeader?: boolean;
  value: SelectionValue;
  displayValue?: string;
  multiple?: boolean;
  disabled?: boolean;
  placeholder: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchable?: boolean;
  isMobile?: boolean;
  mobileShowCloseButton?: boolean;
  mobilePreventOpenAutoFocus?: boolean;
  onConfirm: (value: SelectionValue) => void;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  children: (draftValue: SelectionValue, setDraftValue: (value: SelectionValue) => void, searchQuery: string) => React.ReactNode;
}

export function RecordSelectionDialog({
  label, labelClassName, title, description, hideHeader = false, value, displayValue, multiple = false, disabled, placeholder, searchValue = '', onSearchChange,
  onConfirm, loading, onLoadMore, hasMore, searchable = false, isMobile = false, children,
  mobileShowCloseButton = true, mobilePreventOpenAutoFocus = false,
}: RecordSelectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<SelectionValue>(value);
  const [internalSearch, setInternalSearch] = useState('');

  useEffect(() => {
    if (open) {
      setDraftValue(value);
      setInternalSearch('');
    }
  }, [open, value]);

  const committedLabel = displayValue || (Array.isArray(value) ? (value.length ? `${value.length} mục đã chọn` : placeholder) : (value || placeholder));
  const setDraft = (next: SelectionValue) => setDraftValue(multiple ? (Array.isArray(next) ? next : [next].filter(Boolean)) : (Array.isArray(next) ? next[0] || '' : next));
  const handleConfirm = () => {
    onConfirm(draftValue);
    setOpen(false);
  };

  const selectionContent = (
    <div className="mx-auto flex min-h-0 h-full w-full max-w-4xl flex-col gap-3.5 sm:gap-4 overflow-hidden">
      {hideHeader ? (
        <div className="sr-only">
          {isMobile ? (
            <>
              <DialogTitle className="sr-only">{title}</DialogTitle>
              <DialogDescription className="sr-only">{description || 'Chọn giá trị rồi nhấn Xác nhận để áp dụng.'}</DialogDescription>
            </>
          ) : (
            <>
              <h2 className="sr-only">{title}</h2>
              <p className="sr-only">{description || 'Chọn giá trị rồi nhấn Xác nhận để áp dụng.'}</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 pr-8">
          <div>
            {isMobile ? <DialogTitle className="text-base font-bold text-slate-800">{title}</DialogTitle> : <h2 className="text-base lg:text-lg font-semibold leading-none tracking-tight">{title}</h2>}
            {isMobile ? <DialogDescription className="mt-1 text-xs text-muted-foreground">{description || 'Chọn giá trị rồi nhấn Xác nhận để áp dụng.'}</DialogDescription> : <p className="mt-1 text-sm text-muted-foreground">{description || 'Chọn giá trị rồi nhấn Xác nhận để áp dụng.'}</p>}
          </div>
          <X className="sr-only" aria-hidden="true" />
        </div>
      )}
      {(onSearchChange || searchable) && (
        <Input
          autoFocus={!(isMobile && mobilePreventOpenAutoFocus)}
          type="search"
          role="combobox"
          aria-label={`Tìm ${label.toLowerCase()}`}
          value={onSearchChange ? searchValue : internalSearch}
          onChange={e => onSearchChange ? onSearchChange(e.target.value) : setInternalSearch(e.target.value)}
          placeholder={`Tìm ${label.toLowerCase()}...`}
          className="h-11 md:h-10 min-h-[44px] md:min-h-0 rounded-xl bg-white text-sm md:text-xs focus-visible:!border-slate-200 focus-visible:!ring-0"
        />
      )}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3" role="listbox" aria-label={`Danh sách ${label.toLowerCase()}`}>
        {children(draftValue, setDraft, onSearchChange ? searchValue : internalSearch)}
        {loading && <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Đang tải...</div>}
        {hasMore && <Button type="button" variant="outline" onClick={onLoadMore} disabled={loading} className="mx-auto mt-3 flex h-11 md:h-9 min-h-[44px] md:min-h-0 text-sm md:text-xs">Tải thêm</Button>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 sm:pt-4">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 md:h-9 min-h-[44px] md:min-h-0 px-4 text-sm md:text-xs">Hủy</Button>
        <Button type="button" onClick={handleConfirm} className="h-11 md:h-9 min-h-[44px] md:min-h-0 px-4 text-sm md:text-xs bg-[#005bbf] text-white hover:bg-[#004ca0]"><Check className="h-4 w-4" />Xác nhận</Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      <label className={cn("text-[11px] md:text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 ml-1", labelClassName)}>{label}</label>
      {isMobile ? (
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="h-11 md:h-9 md:sm:h-10 min-h-[44px] md:min-h-0 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-sm md:text-xs md:sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 focus-visible:!border-slate-200 focus-visible:!ring-0"
          >
            <span className={`truncate ${committedLabel === placeholder ? 'font-normal text-[#64748B]/60' : ''}`}>{committedLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
              showCloseButton={mobileShowCloseButton}
              onOpenAutoFocus={mobilePreventOpenAutoFocus ? (event) => event.preventDefault() : undefined}
              className="left-1/2 top-1/2 h-[min(78dvh,560px)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-0 bg-slate-50/95 p-3 sm:p-4"
            >
              {selectionContent}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="h-11 md:h-9 md:sm:h-10 min-h-[44px] md:min-h-0 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-sm md:text-xs md:sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 focus-visible:!border-slate-200 focus-visible:!ring-0"
            >
              <span className={`truncate ${committedLabel === placeholder ? 'font-normal text-[#64748B]/60' : ''}`}>{committedLabel}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="h-[min(26rem,calc(100vh-3rem))] max-h-[calc(100vh-3rem)] w-[min(24rem,calc(100vw-2rem))] overflow-hidden border-0 bg-slate-50/95 p-3">
            {selectionContent}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export interface StudentOptionItem {
  _id: string;
  full_name: string;
  student_code: string;
  class_id?: any;
}

export interface MobileStudentSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  students: StudentOptionItem[];
  selectedStudentIds: string[];
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function MobileStudentSelectionDialog({
  open,
  onOpenChange,
  title = 'Chọn sinh viên',
  description = 'Chọn danh sách sinh viên rồi nhấn Xác nhận để lưu ghi nhận.',
  students,
  selectedStudentIds,
  onConfirm,
  onCancel,
  loading = false,
  hasMore = false,
  onLoadMore,
}: MobileStudentSelectionDialogProps) {
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>(selectedStudentIds);

  useEffect(() => {
    if (open) {
      setDraftSelectedIds(selectedStudentIds);
    }
  }, [open, selectedStudentIds]);

  const toggleStudent = (id: string) => {
    setDraftSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id],
    );
  };

  const handleConfirm = () => {
    onConfirm(draftSelectedIds);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-1/2 top-1/2 h-[min(82dvh,600px)] max-h-[calc(100dvh-2.5rem)] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-0 bg-slate-50/95 p-3.5 sm:p-4 shadow-2xl"
      >
        <div className="mx-auto flex min-h-0 h-full w-full flex-col gap-3 overflow-hidden">
          <div className="sr-only">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>

          <div
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2"
            role="listbox"
            aria-label="Danh sách sinh viên"
          >
            <div className="flex flex-col gap-1.5">
              {students.map(student => {
                const isSelected = draftSelectedIds.includes(student._id);
                return (
                  <button
                    key={student._id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleStudent(student._id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left font-semibold transition-colors min-h-[48px] text-sm ${
                      isSelected
                        ? 'border border-rose-400/90 bg-rose-50/90 text-rose-900 shadow-2xs'
                        : 'border border-slate-100 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate text-sm font-bold leading-tight">{student.full_name}</span>
                      <span className="text-xs text-slate-500 font-mono leading-tight">MSSV: {student.student_code}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {isSelected && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-100/90 border border-red-200/80 px-1.5 py-0.5 rounded">
                          Đã chọn
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {!loading && students.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400 italic">Không tìm thấy sinh viên.</div>
              )}
              {loading && (
                <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải...
                </div>
              )}
              {hasMore && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onLoadMore}
                  disabled={loading}
                  className="mx-auto mt-2 flex h-11 min-h-[44px] text-sm"
                >
                  Tải thêm sinh viên
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="h-11 min-h-[44px] px-5 text-sm font-bold"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="h-11 min-h-[44px] px-5 text-sm font-bold bg-[#005bbf] text-white hover:bg-[#004ca0]"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Xác nhận
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
