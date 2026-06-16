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
        "relative w-full bg-white/45 backdrop-blur-md border-b border-white/70 h-[41px] flex items-center px-3 lg:px-[12px] shrink-0 z-[49] shadow-sm shadow-slate-200/10", 
        className
      )}
    >
      <div className="w-full lg:w-auto flex gap-0 lg:gap-[32px] h-full items-center">
        {tabs.map((tab) => {
          const isDropdown = tab.type === 'select-option';
          const isActive = activeTab === tab.id || (tab.options?.some(opt => opt.id === activeTab));
          
          if (isDropdown) {
            const currentLabel = tab.options?.find(opt => opt.id === activeTab)?.label || tab.label;
            
            return (
              <div 
                key={tab.id}
                className="relative h-full flex-1 lg:flex-none flex items-center justify-center"
                onMouseEnter={() => setOpenSelectId(tab.id)}
                onMouseLeave={() => setOpenSelectId(null)}
              >
                <button
                  className={cn(
                    "flex items-center justify-center w-full lg:w-auto gap-1.5 h-full px-1 text-[13.5px] leading-[20px] transition-all duration-200 cursor-pointer outline-none",
                    isActive 
                      ? 'text-[#1A73E8] font-bold' 
                      : 'text-[#64748B] font-medium hover:text-[#1E293B]'
                  )}
                >
                  <span className="shrink-0">{currentLabel}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", openSelectId === tab.id && "rotate-180")} strokeWidth={isActive ? 3 : 2} />
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1A73E8] rounded-t-full z-20"
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
                      className="absolute top-[41px] left-1/2 -translate-x-1/2 lg:left-[-8px] lg:translate-x-0 min-w-[160px] bg-white/80 backdrop-blur-md border border-white/70 rounded-xl shadow-md shadow-slate-300/30 py-1.5 z-[100] overflow-hidden"
                    >
                      {tab.options?.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            onTabChange(option.id);
                            setOpenSelectId(null);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-[12.5px] rounded-lg transition-all duration-150 ease-out hover:scale-[1.01] cursor-pointer",
                            activeTab === option.id 
                              ? 'bg-white/60 text-[#1A73E8] font-bold' 
                              : 'text-[#1E293B] hover:bg-white/60 font-medium'
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
                "relative flex-1 lg:flex-none flex items-center justify-center h-full px-1 text-[13.5px] leading-[20px] transition-colors duration-200 cursor-pointer outline-none",
                isActive 
                  ? 'text-[#1A73E8] font-bold' 
                  : 'text-[#64748B] font-medium hover:text-[#1E293B]'
              )}
            >
              <span className="shrink-0">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1A73E8] rounded-t-full z-20"
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
