'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type HeaderContextType = {
  customMappings: Record<string, string>;
  setCustomMappings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const HeaderProvider = ({ children }: { children: React.ReactNode }) => {
  const [customMappings, setCustomMappings] = useState<Record<string, string>>({});
  
  return (
    <HeaderContext.Provider value={{ customMappings, setCustomMappings }}>
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
