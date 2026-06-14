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
  label = 'bản ghi',
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
        "flex h-[51px] items-center justify-between pl-4 pr-2 bg-white/45 backdrop-blur-md border-t border-white/70 rounded-b-2xl shadow-sm w-full",
        className
      )}
    >
      {/* Summary Text & Page Size Selector */}
      <div className="flex items-center gap-4 text-[#1E293B] text-[13.5px] leading-[20px] font-sans font-medium">
        <span>
          Hiển thị {startItem}-{endItem} trên tổng số {totalItems} {label}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-white/60 pl-4 h-6">
            <span className="text-slate-500 text-[13px]">Số dòng:</span>
            <div className="w-[72px]">
              <Select
                value={String(pageSize)}
                onValueChange={(val: string) => onPageSizeChange(Number(val))}
              >
                <SelectTrigger className="h-8 text-[13px] font-semibold text-[#1E293B] border-white/80 rounded-xl bg-white/50 backdrop-blur-sm px-2.5 py-1 hover:bg-white/70 transition-all cursor-pointer">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-md border border-slate-100/60 shadow-xl rounded-xl min-w-[72px] z-[50]">
                  {pageSizeOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={String(option)}
                      className="text-[13px] font-semibold text-[#1E293B] hover:bg-slate-50 cursor-pointer py-1 px-2.5 rounded-lg"
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
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/30 border border-white/60 hover:bg-white/80 hover:scale-[1.01] disabled:opacity-30 disabled:hover:scale-100 transition-all duration-150 ease-out cursor-pointer"
          aria-label="Trang trước"
        >
          <ChevronLeft className="w-[14px] h-[14px] text-[#1E293B]" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-[4px]">
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
                  "flex items-center justify-center w-8 h-8 rounded-full text-[13.5px] font-bold transition-all duration-150 ease-out cursor-pointer",
                  isActive 
                    ? "bg-[#1A73E8] text-white shadow-sm hover:scale-[1.01]" 
                    : "text-[#1E293B] bg-white/30 border border-white/40 hover:bg-white/80 hover:scale-[1.01]"
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
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/30 border border-white/60 hover:bg-white/80 hover:scale-[1.01] disabled:opacity-30 disabled:hover:scale-100 transition-all duration-150 ease-out cursor-pointer"
          aria-label="Trang sau"
        >
          <ChevronRight className="w-[14px] h-[14px] text-[#1E293B]" />
        </button>
      </div>
    </div>
  )
}