'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface FloatingActionBarProps {
    selectedCount: number;
    onClear: () => void;
    actions: React.ReactNode;
    variant?: 'light' | 'dark';
    itemLabel?: string;
}

export default function FloatingActionBar({
    selectedCount,
    onClear,
    actions,
    variant = 'light',
    itemLabel = 'sinh viên'
}: FloatingActionBarProps) {
    const isVisible = selectedCount > 0;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 80, x: '-50%', opacity: 0 }}
                    animate={{ y: 0, x: '-50%', opacity: 1 }}
                    exit={{ y: 80, x: '-50%', opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    className={`fixed bottom-[80px] md:bottom-6 left-1/2 z-50 flex items-center flex-nowrap whitespace-nowrap gap-1.5 sm:gap-2.5 px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-[12px] rounded-xl shrink-0 select-none pointer-events-auto border max-w-[calc(100%-2rem)] sm:max-w-none ${
                        variant === 'dark'
                            ? 'bg-slate-900/85 border-slate-800 text-white shadow-xl shadow-black/20'
                            : 'bg-white/60 border-white/80 text-slate-700 shadow-md shadow-slate-900/5'
                    }`}
                >
                    {/* Thông tin số lượng sinh viên được chọn */}
                    <div className={`flex items-center flex-nowrap whitespace-nowrap gap-1.5 sm:gap-2 border-r pr-2.5 sm:pr-3 shrink-0 ${variant === 'dark' ? 'border-slate-700/80' : 'border-[#e2e8f0]'}`}>
                        {variant === 'dark' ? (
                            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-[#137fec]/15 border border-[#137fec]/30 flex items-center justify-center text-[#137fec] shrink-0">
                                <Check size={11} strokeWidth={3.5} />
                            </div>
                        ) : (
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                        )}
                        <span className="text-[12px] sm:text-[13px] font-medium whitespace-nowrap shrink-0">
                            <span className="hidden sm:inline">Đã chọn </span>
                            <strong className={`font-bold ${variant === 'dark' ? 'text-white' : 'text-[#135bec]'}`}>{selectedCount}</strong>
                            <span className="hidden sm:inline"> {itemLabel}</span>
                            <span className="inline sm:hidden"> đã chọn</span>
                        </span>
                    </div>

                    {/* Các hành động */}
                    <div className="flex items-center flex-nowrap whitespace-nowrap gap-1.5 sm:gap-2 shrink-0">
                        {actions}

                        <button
                            onClick={onClear}
                            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[12px] font-semibold transition-all select-none rounded-xl whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                                variant === 'dark'
                                    ? 'text-slate-300 hover:text-white hover:bg-white/5'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-black/5'
                            }`}
                        >
                            <span className="hidden sm:inline">Hủy chọn</span>
                            <span className="inline sm:hidden" title="Hủy chọn"><X size={14} strokeWidth={2.5} /></span>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
