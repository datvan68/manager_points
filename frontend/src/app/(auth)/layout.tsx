import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#f6f6f8] min-h-screen content-stretch flex flex-col items-center justify-center p-4 relative overflow-hidden isolate">
      {/* Decorative Background Blurs */}
      <div className="absolute bg-[rgba(19,91,236,0.05)] blur-[32px] right-[-96px] top-[-96px] rounded-full w-[384px] h-[384px] z-[-1] pointer-events-none" />
      <div className="absolute bg-[rgba(19,91,236,0.05)] blur-[32px] bottom-[-96px] left-[-96px] rounded-full w-[384px] h-[384px] z-[-1] pointer-events-none" />

      {/* Main Content Area */}
      {children}
    </div>
  );
}
