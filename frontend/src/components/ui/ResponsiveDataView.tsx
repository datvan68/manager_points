'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface ResponsiveColumn<T = any> {
  key: string;
  header: string;
  priority?: 'primary' | 'secondary' | 'metadata' | 'action';
  className?: string;
  render?: (value: any, row: T) => React.ReactNode;
  mobileRender?: (row: T) => React.ReactNode;
  hideOnMobile?: boolean;
}

interface ResponsiveDataViewProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  keyExtractor: (row: T, index: number) => string;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl';
  
  // Custom card render overrides
  renderCard?: (row: T, index: number) => React.ReactNode;
  
  // Checkbox/Selection support
  selection?: {
    selectedKeys: string[];
    onSelectRow: (key: string, checked: boolean) => void;
    onSelectAll?: (checked: boolean) => void;
    allSelected?: boolean;
  };
  
  // Pagination node to display at the bottom
  pagination?: React.ReactNode;
  hidePaginationOnMobile?: boolean;
  
  // Row click
  onRowClick?: (row: T) => void;
  
  // Table/Card custom styles
  tableClassName?: string;
  rowClassName?: string | ((row: T) => string);
  cardClassName?: string;
  
  // Mobile infinite scroll support
  mobileFooter?: React.ReactNode;
  mobileScrollRef?: React.Ref<HTMLDivElement>;
  mobileVirtualization?: boolean;
  
  // Desktop infinite scroll support
  desktopFooter?: React.ReactNode;
  desktopScrollRef?: React.Ref<HTMLDivElement>;
}

export default function ResponsiveDataView<T>({
  data,
  columns,
  isLoading = false,
  emptyState,
  keyExtractor,
  breakpoint = 'md',
  renderCard,
  selection,
  pagination,
  onRowClick,
  tableClassName = '',
  rowClassName = '',
  cardClassName = '',
  hidePaginationOnMobile = false,
  mobileFooter,
  mobileScrollRef,
  mobileVirtualization = false,
  desktopFooter,
  desktopScrollRef
}: ResponsiveDataViewProps<T>) {
  const internalMobileScrollRef = React.useRef<HTMLDivElement>(null);
  const setMobileScrollElement = React.useCallback((node: HTMLDivElement | null) => {
    internalMobileScrollRef.current = node;
    if (typeof mobileScrollRef === 'function') mobileScrollRef(node);
    else if (mobileScrollRef) mobileScrollRef.current = node;
  }, [mobileScrollRef]);
  const mobileVirtualizer = useVirtualizer({
    count: mobileVirtualization ? data.length : 0,
    getScrollElement: () => internalMobileScrollRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });
  
  const getBreakpointClass = (bp: 'sm' | 'md' | 'lg' | 'xl') => {
    switch (bp) {
      case 'sm': return { table: 'hidden sm:block', cards: 'block sm:hidden', paginationHidden: 'hidden sm:block' };
      case 'md': return { table: 'hidden md:block', cards: 'block md:hidden', paginationHidden: 'hidden md:block' };
      case 'lg': return { table: 'hidden lg:block', cards: 'block lg:hidden', paginationHidden: 'hidden lg:block' };
      case 'xl': return { table: 'hidden xl:block', cards: 'block xl:hidden', paginationHidden: 'hidden xl:block' };
    }
  };

  const bpClasses = getBreakpointClass(breakpoint);

  // Group columns by priority for default card layout
  const primaryCol = columns.find(c => c.priority === 'primary');
  const secondaryCol = columns.find(c => c.priority === 'secondary');
  const actionCol = columns.find(c => c.priority === 'action');
  const metadataCols = columns.filter(c => c.priority === 'metadata' || (!c.priority && c.key !== primaryCol?.key && c.key !== secondaryCol?.key && c.key !== actionCol?.key));

  const handleSelectAllChange = (checked: boolean) => {
    if (selection && selection.onSelectAll) {
      selection.onSelectAll(checked);
    }
  };

  const renderDefaultCard = (row: T, index: number) => {
    const key = keyExtractor(row, index);
    const isChecked = selection?.selectedKeys.includes(key) || false;
    
    return (
      <div 
        key={key}
        onClick={() => onRowClick && onRowClick(row)}
        className={`bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-white/60 ${onRowClick ? 'cursor-pointer' : ''} ${cardClassName}`}
      >
        {/* Card Header: Title (Primary), Badge/Checkbox & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {selection && (
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => selection.onSelectRow(key, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
              />
            )}
            <div className="min-w-0">
              {primaryCol ? (
                <div className="font-bold text-sm text-[#1E293B] truncate">
                  {primaryCol.render ? primaryCol.render(row[primaryCol.key as keyof T], row) : String(row[primaryCol.key as keyof T] ?? '')}
                </div>
              ) : (
                <div className="font-bold text-sm text-[#1E293B]">Mục #{index + 1}</div>
              )}
              {secondaryCol && (
                <div className="text-xs text-[#64748B] mt-0.5 truncate">
                  {secondaryCol.render ? secondaryCol.render(row[secondaryCol.key as keyof T], row) : String(row[secondaryCol.key as keyof T] ?? '')}
                </div>
              )}
            </div>
          </div>
          
          {actionCol && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-1.5 justify-end">
              {actionCol.render ? actionCol.render(row[actionCol.key as keyof T], row) : String(row[actionCol.key as keyof T] ?? '')}
            </div>
          )}
        </div>

        {/* Card Metadata List */}
        {metadataCols.length > 0 && (
          <div className="grid grid-cols-1 gap-2 pt-3 border-t border-white/40 text-xs">
            {metadataCols.map(col => {
              if (col.hideOnMobile) return null;
              
              const val = row[col.key as keyof T];
              const renderedVal = col.render ? col.render(val, row) : String(val ?? '');
              return (
                <div key={col.key} className="flex justify-between items-center gap-2">
                  <span className="text-[#64748B] font-semibold shrink-0">{col.header}:</span>
                  <span className="text-slate-800 font-bold text-right truncate max-w-[200px]" title={typeof renderedVal === 'string' ? renderedVal : undefined}>
                    {renderedVal}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
      {/* 1. Cards View (Mobile/Tablet) */}
      <div ref={setMobileScrollElement} className={`${bpClasses.cards} flex-1 overflow-y-auto p-4`}>
        {isLoading ? (
          // Skeleton Cards
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white/40 border border-white/60 rounded-2xl p-4 flex flex-col gap-3 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5 w-full">
                    {selection && <Skeleton className="w-4 h-4 rounded" />}
                    <div className="w-1/2 space-y-2">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
                <div className="pt-3 border-t border-white/30 space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-3.5 w-1/4 rounded" /><Skeleton className="h-3.5 w-1/3 rounded" /></div>
                  <div className="flex justify-between"><Skeleton className="h-3.5 w-1/4 rounded" /><Skeleton className="h-3.5 w-1/4 rounded" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 flex justify-center">{emptyState || <p className="text-sm text-slate-500 font-medium">Không có dữ liệu</p>}</div>
        ) : (
          mobileVirtualization ? (
            <div className="relative w-full" style={{ height: mobileVirtualizer.getTotalSize() }}>
              {mobileVirtualizer.getVirtualItems().map(item => {
                const row = data[item.index];
                return (
                  <div key={keyExtractor(row, item.index)} ref={mobileVirtualizer.measureElement} data-index={item.index} className="absolute left-0 top-0 w-full pb-3" style={{ transform: `translateY(${item.start}px)` }}>
                    {renderCard ? renderCard(row, item.index) : renderDefaultCard(row, item.index)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.map((row, idx) => renderCard ? renderCard(row, idx) : renderDefaultCard(row, idx))}
            </div>
          )
        )}
        {mobileFooter}
      </div>

      {/* 2. Table View (Desktop) */}
      <div ref={desktopScrollRef} className={`${bpClasses.table} flex-1 overflow-auto`}>
        <table className={`w-full border-collapse ${tableClassName}`}>
          <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-white/80 shadow-[0_1px_0_0_rgba(255,255,255,0.8)]">
            <tr>
              {selection && (
                <th className="px-5 py-4 w-12 text-center select-none">
                  {selection.onSelectAll && (
                    <input
                      type="checkbox"
                      checked={selection.allSelected || (data.length > 0 && data.every(row => selection.selectedKeys.includes(keyExtractor(row, 0))))}
                      onChange={(e) => handleSelectAllChange(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  )}
                </th>
              )}
              {columns.map(col => (
                <th 
                  key={col.key} 
                  className={`px-5 py-4 text-[11px] font-extrabold text-[#64748B] uppercase tracking-wider select-none ${col.className || 'text-left'}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {isLoading ? (
              // Skeleton Rows
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="bg-white/20">
                  {selection && (
                    <td className="px-5 py-4 text-center">
                      <Skeleton className="w-4 h-4 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className="px-5 py-4">
                      <Skeleton className="h-4 w-2/3 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="px-6 py-12 text-center text-slate-500 font-medium">
                  {emptyState || 'Không có dữ liệu'}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = keyExtractor(row, idx);
                const isSelected = selection?.selectedKeys.includes(key) || false;
                const rClassName = typeof rowClassName === 'function' ? rowClassName(row) : rowClassName;
                return (
                  <tr 
                    key={key} 
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-white/60 transition-colors duration-150 ease-out bg-white/25 ${onRowClick ? 'cursor-pointer' : ''} ${rClassName}`}
                  >
                    {selection && (
                      <td className="px-5 py-3.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => selection.onSelectRow(key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className={`px-5 py-3.5 align-middle ${col.className || ''}`}>
                        {col.render ? col.render(row[col.key as keyof T], row) : String(row[col.key as keyof T] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {desktopFooter}
      </div>

      {/* 3. Pagination Footer (outside scroll area) */}
      {pagination && (
        <div className={`sticky bottom-0 z-10 border-t border-white/60 mt-auto bg-white/40 backdrop-blur-md w-full ${hidePaginationOnMobile ? bpClasses.paginationHidden : ''}`}>
          {pagination}
        </div>
      )}
    </div>
  );
}
