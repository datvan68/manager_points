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
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={`relative bg-white rounded-xl shadow-xl w-full flex flex-col max-h-[90vh] overflow-hidden ${className || 'max-w-lg'}`}
          >
            {title !== undefined && (
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white z-10 sticky top-0">
                <div className="flex items-center gap-3">
                  {typeof title === 'string' ? (
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                  ) : (
                    title
                  )}
                  {action}
                </div>
              <button 
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            )}
            {!title && (
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors z-20"
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
