'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface FloatingActionBarProps {
    selectedCount: number;
    onClear: () => void;
    actions: React.ReactNode;
    variant?: 'light' | 'dark';
}

export default function FloatingActionBar({
    selectedCount,
    onClear,
    actions,
    variant = 'light'
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
                    className={`fixed bottom-6 left-2/3 -translate-x-1/2 z-50 flex items-center flex-nowrap whitespace-nowrap gap-3 px-5 py-2.5 backdrop-blur-[12px] shadow-[0_10px_30px_rgba(15,23,42,0.12)] rounded-full shrink-0 select-none pointer-events-auto border ${variant === 'dark'
                        ? 'bg-[#1e2022]/90 border-slate-800 text-white shadow-[0px_8px_32px_rgba(0,0,0,0.24)]'
                        : 'bg-white/70 border-white/80 text-slate-700'
                        }`}
                >
                    {/* Thông tin số lượng sinh viên được chọn */}
                    <div className={`flex items-center flex-nowrap whitespace-nowrap gap-2 border-r pr-3.5 shrink-0 ${variant === 'dark' ? 'border-slate-700/80' : 'border-[#e2e8f0]'}`}>
                        {variant === 'dark' ? (
                            <div className="w-5 h-5 rounded-full bg-[#137fec]/15 border border-[#137fec]/30 flex items-center justify-center text-[#137fec] shrink-0">
                                <Check size={11} strokeWidth={3.5} />
                            </div>
                        ) : (
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                        )}
                        <span className="text-[13px] font-medium whitespace-nowrap shrink-0">
                            Đã chọn <strong className={`font-bold ${variant === 'dark' ? 'text-white' : 'text-[#135bec]'}`}>{selectedCount}</strong> sinh viên
                        </span>
                    </div>

                    {/* Các hành động */}
                    <div className="flex items-center flex-nowrap whitespace-nowrap gap-2 shrink-0">
                        {actions}

                        <button
                            onClick={onClear}
                            className={`px-3 py-2 text-[12px] font-medium transition-all select-none rounded-full whitespace-nowrap shrink-0 ${variant === 'dark'
                                ? 'text-slate-300 hover:text-white hover:bg-white/5'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-black/5'
                                }`}
                        >
                            Hủy chọn
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
