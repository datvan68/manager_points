'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type DormitoryChoice = { value: string; label: string };

type DormitoryChoicePopoverProps = {
  value: string;
  options: DormitoryChoice[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  invalid?: boolean;
};

export default function DormitoryChoicePopover({ value, options, onValueChange, placeholder = 'Chọn một giá trị', ariaLabel, disabled = false, invalid = false }: DormitoryChoicePopoverProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} aria-label={ariaLabel} aria-invalid={invalid || undefined} className="h-10 w-full justify-between rounded-xl border border-white/70 bg-white/50 px-3 text-sm font-normal">
          <span className={selected ? 'truncate text-slate-800' : 'truncate text-slate-500'}>{selected?.label || placeholder}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[120] w-[calc(100vw-2rem)] max-w-[280px] overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="listbox" aria-label={ariaLabel} className="max-h-[min(16rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map(option => (
            <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onValueChange(option.value); setOpen(false); }} className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] aria-selected:bg-blue-50 aria-selected:font-semibold aria-selected:text-blue-700">
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
