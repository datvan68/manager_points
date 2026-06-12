'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select'

interface PaginationProps {
  totalItems: number
  pageSize: number
  currentPage: number
  onPageChange: (page: number) => void
  label?: string
  className?: string
  isLoading?: boolean
  pageSizeOptions?: number[]
  onPageSizeChange?: (pageSize: number) => void
}

/**
 * Reusable Pagination Component
 * Based on Figma node-id=63:201
 */
export function CustomPagination({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  label = 'sự kiện',
  className,
  isLoading,
  pageSizeOptions = [5, 10, 20, 50, 100],
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const getPages = () => {
    const pages: (number | string)[] = []
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i)
      }
      
      if (currentPage < totalPages - 2) pages.push('...')
      if (!pages.includes(totalPages)) pages.push(totalPages)
    }
    return pages
  }

  if (totalPages <= 0 && !isLoading) return null

  return (
    <div 
      className={cn(
        "flex h-[51px] items-center justify-between pl-4 pr-2 bg-white rounded-b-[10px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] w-full",
        className
      )}
    >
      {/* Summary Text & Page Size Selector */}
      <div className="flex items-center gap-4 text-[#4a5565] text-[14px] leading-[20px] font-sans">
        <span>
          Hiển thị {startItem} - {endItem} trong tổng số {totalItems} {label}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-4 h-6">
            <span className="text-slate-500 text-[13px]">Số dòng:</span>
            <div className="w-[72px]">
              <Select
                value={String(pageSize)}
                onValueChange={(val: string) => onPageSizeChange(Number(val))}
              >
                <SelectTrigger className="h-7 text-[13px] font-medium text-slate-700 border-slate-200 rounded-[6px] bg-white px-2 py-0.5">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-100 shadow-xl rounded-lg min-w-[72px] z-[50]">
                  {pageSizeOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={String(option)}
                      className="text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer py-1 px-2.5"
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-[8px] hover:bg-slate-100 disabled:opacity-30 transition-colors"
          aria-label="Trang trước"
        >
          <ChevronLeft className="w-[14px] h-[14px] text-[#475569]" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-[2px]">
          {getPages().map((page, index) => {
            if (page === '...') {
              return (
                <div key={`dots-${index}`} className="flex items-center justify-center px-1 text-[#94a3b8]">
                  <MoreHorizontal className="w-4 h-4" />
                </div>
              )
            }

            const isActive = page === currentPage
            return (
              <button
                key={index}
                onClick={() => onPageChange(page as number)}
                className={cn(
                  "flex items-center justify-center w-[36px] h-[36px] rounded-[8px] text-[14px] font-medium transition-all",
                  isActive 
                    ? "bg-[#135bec] text-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" 
                    : "text-[#475569] hover:bg-slate-100"
                )}
              >
                {page}
              </button>
            )
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-[8px] hover:bg-slate-100 disabled:opacity-30 transition-colors"
          aria-label="Trang sau"
        >
          <ChevronRight className="w-[14px] h-[14px] text-[#475569]" />
        </button>
      </div>
    </div>
  )
}