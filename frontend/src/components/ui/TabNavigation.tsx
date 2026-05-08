'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface TabOption {
  id: string;
  label: string;
}

interface Tab {
  id: string;
  label: string;
  type?: 'tab' | 'select-option';
  options?: TabOption[];
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ 
  tabs, 
  activeTab, 
  onTabChange,
  className = ''
}) => {
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);

  return (
    <div 
      className={cn(
        "relative w-full bg-white border-b border-[#e2e8f0] h-[41px] flex items-center px-[12px] shrink-0 z-[50]", 
        className
      )}
    >
      <div className="flex gap-[32px] h-full items-center">
        {tabs.map((tab) => {
          const isDropdown = tab.type === 'select-option';
          const isActive = activeTab === tab.id || (tab.options?.some(opt => opt.id === activeTab));
          
          if (isDropdown) {
            const currentLabel = tab.options?.find(opt => opt.id === activeTab)?.label || tab.label;
            
            return (
              <div 
                key={tab.id}
                className="relative h-full flex items-center"
                onMouseEnter={() => setOpenSelectId(tab.id)}
                onMouseLeave={() => setOpenSelectId(null)}
              >
                <button
                  className={cn(
                    "flex items-center gap-1.5 h-full px-1 text-[14px] leading-[20px] transition-all duration-200 cursor-pointer outline-none",
                    isActive 
                      ? 'text-[#137fec] font-bold' 
                      : 'text-[#475569] font-medium hover:text-[#137fec]'
                  )}
                >
                  <span className="shrink-0">{currentLabel}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", openSelectId === tab.id && "rotate-180")} strokeWidth={isActive ? 3 : 2} />
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#137fec] rounded-t-full z-20"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>

                <AnimatePresence>
                  {openSelectId === tab.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-[41px] left-[-8px] min-w-[160px] bg-white border border-[#e2e8f0] rounded-lg shadow-xl py-1.5 z-[100] overflow-hidden"
                    >
                      {tab.options?.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            onTabChange(option.id);
                            setOpenSelectId(null);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 text-[13.5px] transition-colors",
                            activeTab === option.id 
                              ? 'bg-blue-50/50 text-[#137fec] font-bold' 
                              : 'text-[#475569] hover:bg-slate-50 font-medium'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center h-full px-1 text-[14px] leading-[20px] transition-colors duration-200 cursor-pointer outline-none",
                isActive 
                  ? 'text-[#137fec] font-bold' 
                  : 'text-[#475569] font-medium hover:text-[#137fec]'
              )}
            >
              <span className="shrink-0">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#137fec] rounded-t-full z-20"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TabNavigation;
