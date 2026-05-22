import React from 'react';
import { cn } from '@/lib/utils';

export const AVATAR_COLORS = [
  { bg: 'bg-[#eff6ff] dark:bg-blue-950/30', text: 'text-[#2563eb] dark:text-blue-400', border: 'border-[#dbeafe] dark:border-blue-900/50' },
  { bg: 'bg-[#ecfdf5] dark:bg-emerald-950/30', text: 'text-[#059669] dark:text-emerald-400', border: 'border-[#d1fae5] dark:border-emerald-900/50' },
  { bg: 'bg-[#f5f3ff] dark:bg-violet-950/30', text: 'text-[#7c3aed] dark:text-violet-400', border: 'border-[#ede9fe] dark:border-violet-900/50' },
  { bg: 'bg-[#fffbeb] dark:bg-amber-950/30', text: 'text-[#d97706] dark:text-amber-400', border: 'border-[#fef3c7] dark:border-amber-900/50' },
  { bg: 'bg-[#fff1f2] dark:bg-rose-950/30', text: 'text-[#e11d48] dark:text-rose-400', border: 'border-[#ffe4e6] dark:border-rose-900/50' },
  { bg: 'bg-[#e0f2fe] dark:bg-sky-950/30', text: 'text-[#0284c7] dark:text-sky-400', border: 'border-[#bae6fd] dark:border-sky-900/50' },
  { bg: 'bg-[#fdf2f8] dark:bg-pink-950/30', text: 'text-[#db2777] dark:text-pink-400', border: 'border-[#fce7f3] dark:border-pink-900/50' },
  { bg: 'bg-[#f0fdf4] dark:bg-green-950/30', text: 'text-[#16a34a] dark:text-green-400', border: 'border-[#dcfce7] dark:border-green-900/50' },
];

export const getAvatarColor = (name: string) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

export const getInitials = (fullName: string) => {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  return lastName ? lastName.charAt(0).toUpperCase() : '?';
};

interface StudentAvatarProps {
  fullName: string;
  className?: string;
  textClassName?: string;
  sizeClass?: string; // e.g. "w-9 h-9", "w-[28px] h-[28px]"
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  fullName,
  className,
  textClassName,
  sizeClass = "w-9 h-9"
}) => {
  const initials = getInitials(fullName);
  const colors = getAvatarColor(fullName);

  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center font-bold border select-none shrink-0", 
        sizeClass, 
        colors.bg, 
        colors.text, 
        colors.border,
        className
      )}
    >
      <span className={cn("font-semibold tracking-wider", textClassName)}>
        {initials}
      </span>
    </div>
  );
};
