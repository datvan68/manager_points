'use client';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface PopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const Popup: React.FC<PopupProps> = ({ isOpen, onClose, title, children, action, className, contentClassName }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={`relative w-full flex flex-col max-h-[90vh] overflow-hidden ${className?.includes('bg-') ? '' : 'bg-white/80 backdrop-blur-xl border border-white/80'} ${className?.includes('rounded-') ? '' : 'rounded-2xl'} ${className?.includes('shadow-') ? '' : 'shadow-xl shadow-slate-300/30'} ${className || 'max-w-lg'}`}
          >
            {title !== undefined && (
              <div className="flex items-center justify-between p-4 border-b border-white/40 bg-white/40 backdrop-blur-md z-10 sticky top-0">
                <div className="flex items-center gap-3">
                  {typeof title === 'string' ? (
                    <h3 className="text-lg font-bold text-[#1E293B]">{title}</h3>
                  ) : (
                    title
                  )}
                  {action}
                </div>
              <button 
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/60 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>
            )}
            {!title && (
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/60 transition-colors z-20 focus:outline-none"
              >
                <X size={20} />
              </button>
            )}
            <div className={contentClassName !== undefined ? contentClassName : "p-6 overflow-y-auto custom-scrollbar"}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Popup;
