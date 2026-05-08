import React from 'react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#f6f6f8] min-h-screen content-stretch flex flex-col items-center justify-center relative overflow-hidden isolate">
      {/* Portal screens background (Solid light gray without blur glows) */}
      {children}
    </div>
  );
}
