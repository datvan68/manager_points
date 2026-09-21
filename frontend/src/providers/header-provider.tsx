'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type HeaderContextType = {
  customMappings: Record<string, string>;
  setCustomMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isBottomNavHidden: boolean;
  setIsBottomNavHidden: React.Dispatch<React.SetStateAction<boolean>>;
};

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const HeaderProvider = ({ children }: { children: React.ReactNode }) => {
  const [customMappings, setCustomMappings] = useState<Record<string, string>>({});
  const [isBottomNavHidden, setIsBottomNavHidden] = useState<boolean>(false);
  
  return (
    <HeaderContext.Provider value={{ customMappings, setCustomMappings, isBottomNavHidden, setIsBottomNavHidden }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const context = useContext(HeaderContext);
  return context;
};

export const HeaderCustomMappings = ({ mappings }: { mappings: Record<string, string> }) => {
  const context = useHeader();
  useEffect(() => {
    if (context) {
      context.setCustomMappings(mappings);
      return () => context.setCustomMappings({});
    }
  }, [mappings, context]);
  return null;
};

export const HideMobileBottomNav = () => {
  const context = useHeader();
  useEffect(() => {
    if (context?.setIsBottomNavHidden) {
      context.setIsBottomNavHidden(true);
      return () => context.setIsBottomNavHidden(false);
    }
  }, [context]);
  return null;
};
