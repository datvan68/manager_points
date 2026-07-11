export const activityTypeLabels: Record<string, string> = {
  'club': 'Câu lạc bộ',
  'event': 'Sự kiện',
  'activity': 'Hoạt động',
  'festival': 'Lễ hội',
};

export const activityCategoryLabels: Record<string, string> = {
  'academic': 'Học thuật',
  'sports': 'Thể thao',
  'art': 'Nghệ thuật',
  'volunteer': 'Tình nguyện',
  'technology': 'Công nghệ',
  'other': 'Khác',
};

export const activityStatusLabels: Record<string, string> = {
  'draft': 'Bản nháp',
  'published': 'Hoạt động',
  'completed': 'Đã kết thúc',
  'cancelled': 'Đã hủy',
};

export const activityStatusColors: Record<string, string> = {
  'draft': 'bg-slate-100 text-slate-600 border-slate-200',
  'published': 'bg-emerald-100 text-emerald-600 border-emerald-200',
  'completed': 'bg-blue-100 text-blue-600 border-blue-200',
  'cancelled': 'bg-red-100 text-red-600 border-red-200',
};

export const activityRoleLabels: Record<string, string> = {
  'president': 'Chủ nhiệm',
  'vice_president': 'Phó chủ nhiệm',
  'secretary': 'Thư ký',
  'treasurer': 'Thủ quỹ',
  'member': 'Thành viên',
};

export function isClubType(type?: string): boolean {
  return type === 'club';
}

export function showOfficerRoles(type?: string): boolean {
  return type === 'club';
}

export function showTransferOption(type?: string): boolean {
  return type === 'club';
}

export function showSlotsOption(type?: string): boolean {
  return type === 'club';
}

export function getActivityTypeLabel(type?: string): string {
  if (!type) return 'Hoạt động';
  return activityTypeLabels[type] || 'Hoạt động';
}

export function getActivityCategoryLabel(category?: string): string {
  if (!category) return 'Khác';
  return activityCategoryLabels[category] || 'Khác';
}

export function getActivityStatusLabel(status?: string): string {
  if (!status) return 'Bản nháp';
  return activityStatusLabels[status] || 'Bản nháp';
}

// ── Background Configuration & Templates ──

import { BACKGROUND_PRESETS, getClubAccentColor } from '@/components/activities/utils/schedule-helper';
import { API_ORIGIN } from '@/api/config';
import React from 'react';

export const getImageUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_ORIGIN}${url}`;
};

export interface StateButtonConfig {
  label?: string;
  bgClass?: string;
  textClass?: string;
}

export interface ActivityBackgroundConfig {
  preset?: string;
  pattern?: string;
  accentColor?: string;
  backgroundImageUrl?: string | null;
  useAvatarAsBackground?: boolean;
  petAccentType?: string;
  states?: {
    none?: StateButtonConfig;
    pending?: StateButtonConfig;
    active?: StateButtonConfig;
    rejected?: StateButtonConfig;
  };
}

export const DEFAULT_STATE_BUTTONS: Record<'none' | 'pending' | 'active' | 'rejected', { label: string; bgClass: string; textClass: string }> = {
  none: {
    label: 'Đăng ký',
    bgClass: 'bg-blue-600 hover:bg-blue-750 text-white',
    textClass: 'text-white'
  },
  pending: {
    label: 'Chờ duyệt',
    bgClass: 'border border-amber-250 bg-amber-50/90 text-amber-700',
    textClass: 'text-amber-700'
  },
  active: {
    label: 'Đã tham gia',
    bgClass: 'border border-emerald-250 bg-emerald-50/90 text-emerald-700',
    textClass: 'text-emerald-700'
  },
  rejected: {
    label: 'Bị từ chối',
    bgClass: 'border border-red-250 bg-red-50/90 text-red-700',
    textClass: 'text-red-700'
  }
};

export function getStateButtonConfig(
  activity: any,
  state: 'none' | 'pending' | 'active' | 'rejected'
): { label: string; bgClass: string; textClass: string } {
  const bgConfig = activity?.background_config || {};
  const statesConfig = bgConfig.states || {};
  const stateConfig = statesConfig[state] || {};
  const fallback = DEFAULT_STATE_BUTTONS[state];

  return {
    label: stateConfig.label || fallback.label,
    bgClass: stateConfig.bgClass || fallback.bgClass,
    textClass: stateConfig.textClass || fallback.textClass
  };
}

export function normalizeBackgroundConfig(config: any): any {
  const cfg = config || {};
  const states = {
    none: { ...DEFAULT_STATE_BUTTONS.none },
    pending: { ...DEFAULT_STATE_BUTTONS.pending },
    active: { ...DEFAULT_STATE_BUTTONS.active },
    rejected: { ...DEFAULT_STATE_BUTTONS.rejected }
  };
  
  if (cfg.states) {
    for (const key of ['none', 'pending', 'active', 'rejected'] as const) {
      if (cfg.states[key]) {
        states[key] = {
          label: cfg.states[key].label !== undefined && cfg.states[key].label !== null ? cfg.states[key].label : DEFAULT_STATE_BUTTONS[key].label,
          bgClass: cfg.states[key].bgClass !== undefined && cfg.states[key].bgClass !== null ? cfg.states[key].bgClass : DEFAULT_STATE_BUTTONS[key].bgClass,
          textClass: cfg.states[key].textClass !== undefined && cfg.states[key].textClass !== null ? cfg.states[key].textClass : DEFAULT_STATE_BUTTONS[key].textClass,
        };
      }
    }
  }

  return {
    preset: cfg.preset,
    pattern: cfg.pattern,
    accentColor: cfg.accentColor,
    backgroundImageUrl: cfg.backgroundImageUrl,
    useAvatarAsBackground: cfg.useAvatarAsBackground,
    petAccentType: cfg.petAccentType,
    states
  };
}

export interface BackgroundTemplate {
  id: string;
  name: string;
  bgClass: string;
  accentColor: string;
  patternId: string;
  category: 'classic' | 'premium' | 'active' | 'pet';
  isDark?: boolean;
}

export const BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  // Classic
  {
    id: 'minimal-clean',
    name: 'Tối giản Slate (Minimal Clean)',
    bgClass: 'bg-gradient-to-br from-slate-50 to-slate-100/80 border-slate-200/80 shadow-sm',
    accentColor: '#64748B',
    patternId: 'spark-dot-frame',
    category: 'classic',
  },
  {
    id: 'aurora-glass',
    name: 'Kính Cực quang (Aurora Glass)',
    bgClass: 'bg-gradient-to-tr from-indigo-50/90 via-purple-50/70 to-pink-50/80 border-indigo-100 backdrop-blur-md shadow-sm',
    accentColor: '#8B5CF6',
    patternId: 'glass-grid',
    category: 'classic',
  },
  {
    id: 'academic-crest',
    name: 'Học thuật Indigo (Academic Crest)',
    bgClass: 'bg-gradient-to-br from-indigo-50/80 via-blue-50/40 to-slate-50 border-indigo-200/60 shadow-sm',
    accentColor: '#4F46E5',
    patternId: 'academic-crest-pattern',
    category: 'classic',
  },
  {
    id: 'soft-silk',
    name: 'Lụa Mềm mại (Soft Silk)',
    bgClass: 'bg-gradient-to-br from-rose-50/70 via-orange-50/40 to-slate-100/60 border-rose-100 shadow-sm',
    accentColor: '#F43F5E',
    patternId: 'soft-waves-pattern',
    category: 'classic',
  },
  {
    id: 'eco-leaf',
    name: 'Môi trường Mint (Eco Environment)',
    bgClass: 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-green-50/40 border-emerald-200/60 shadow-sm',
    accentColor: '#10B981',
    patternId: 'eco-leaf-pattern',
    category: 'classic',
  },
  {
    id: 'medical-pulse',
    name: 'Y sinh Nhịp tim (Medical Pulse)',
    bgClass: 'bg-gradient-to-br from-cyan-50/80 via-teal-50/20 to-slate-50 border-cyan-200/60 shadow-sm',
    accentColor: '#06B6D4',
    patternId: 'medical-pulse-pattern',
    category: 'classic',
  },
  {
    id: 'lang-global',
    name: 'Ngôn ngữ Toàn cầu (Global Languages)',
    bgClass: 'bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-slate-100/50 border-blue-200/60 shadow-sm',
    accentColor: '#3B82F6',
    patternId: 'lang-global-pattern',
    category: 'classic',
  },

  // Premium
  {
    id: 'royal-gold',
    name: 'Hoàng gia Gold (Royal Gold)',
    bgClass: 'bg-gradient-to-br from-amber-500/10 via-amber-600/[0.04] to-yellow-500/10 border-amber-300 shadow-md',
    accentColor: '#D97706',
    patternId: 'premium-frame-pattern',
    category: 'premium',
  },
  {
    id: 'cyber-neon',
    name: 'Cyberpunk Neon (Cyber Neon)',
    bgClass: 'bg-gradient-to-br from-slate-900 via-slate-950 to-zinc-900 border-cyan-500/30 text-white shadow-lg',
    accentColor: '#06B6D4',
    patternId: 'circuit-neon-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'space-orbit',
    name: 'Vũ trụ Vô tận (Cosmic Space)',
    bgClass: 'bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 border-purple-500/30 text-white shadow-lg',
    accentColor: '#A855F7',
    patternId: 'space-orbit-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'carbon-3d',
    name: 'Vân Carbon (Carbon Tech)',
    bgClass: 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700/80 text-white shadow-md',
    accentColor: '#71717A',
    patternId: 'carbon-3d-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'abstract-geom',
    name: 'Hình học Trừu tượng (Abstract Geo)',
    bgClass: 'bg-gradient-to-br from-slate-50 via-sky-50/50 to-indigo-50/40 border-slate-300 shadow-sm',
    accentColor: '#0284C7',
    patternId: 'abstract-geom-pattern',
    category: 'premium',
  },
  {
    id: 'tech-ai',
    name: 'Trí tuệ Nhân tạo (AI Cognitive)',
    bgClass: 'bg-gradient-to-br from-violet-950 via-slate-900 to-zinc-950 border-purple-500/40 text-white shadow-lg',
    accentColor: '#8B5CF6',
    patternId: 'tech-ai-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'tech-hardware',
    name: 'Phần cứng Vi mạch (Hardware IoT)',
    bgClass: 'bg-gradient-to-br from-zinc-900 via-slate-950 to-zinc-950 border-emerald-500/40 text-white shadow-lg',
    accentColor: '#10B981',
    patternId: 'tech-hardware-pattern',
    category: 'premium',
    isDark: true,
  },
  {
    id: 'eng-mechanical',
    name: 'Cơ khí Bánh răng (Mechanical Gear)',
    bgClass: 'bg-gradient-to-br from-slate-100 via-amber-500/[0.03] to-slate-200/70 border-slate-300 shadow-sm',
    accentColor: '#B45309',
    patternId: 'eng-mechanical-pattern',
    category: 'premium',
  },

  // Active
  {
    id: 'sport-dynamic',
    name: 'Thể thao Năng động (Sport Dynamic)',
    bgClass: 'bg-gradient-to-br from-orange-500/10 via-amber-500/[0.03] to-red-500/10 border-orange-300 shadow-sm',
    accentColor: '#EA580C',
    patternId: 'sport-stripes-pattern',
    category: 'active',
  },
  {
    id: 'chroma-glow',
    name: 'Chroma Neon (Chroma Glow)',
    bgClass: 'bg-gradient-to-tr from-fuchsia-500/15 via-rose-500/10 to-amber-500/10 border-fuchsia-300/60 shadow-sm',
    accentColor: '#D946EF',
    patternId: 'chroma-glow-pattern',
    category: 'active',
  },
  {
    id: 'comic-pop',
    name: 'Comic Halftone (Comic Pop)',
    bgClass: 'bg-gradient-to-br from-emerald-50 via-teal-50/30 to-cyan-100/40 border-teal-200/80 shadow-sm',
    accentColor: '#0D9488',
    patternId: 'halftone-pop-pattern',
    category: 'active',
  },
  {
    id: 'ocean-wave',
    name: 'Sóng biển Mát lạnh (Ocean Wave)',
    bgClass: 'bg-gradient-to-br from-sky-50 via-cyan-50/40 to-blue-100/30 border-sky-200/80 shadow-sm',
    accentColor: '#0284C7',
    patternId: 'ocean-waves-pattern',
    category: 'active',
  },
  {
    id: 'sport-soccer',
    name: 'Bóng đá Sân cỏ (Soccer Field)',
    bgClass: 'bg-gradient-to-br from-green-500/10 via-emerald-500/[0.03] to-emerald-600/10 border-emerald-300 shadow-sm',
    accentColor: '#22C55E',
    patternId: 'sport-soccer-pattern',
    category: 'active',
  },
  {
    id: 'sport-basketball',
    name: 'Bóng rổ Đường phố (Street Basketball)',
    bgClass: 'bg-gradient-to-br from-orange-500/10 via-red-500/[0.04] to-orange-600/10 border-orange-300 shadow-sm',
    accentColor: '#F97316',
    patternId: 'sport-basketball-pattern',
    category: 'active',
  },
  {
    id: 'art-music',
    name: 'Nghệ thuật Âm nhạc (Art & Music)',
    bgClass: 'bg-gradient-to-br from-fuchsia-500/10 via-purple-500/[0.04] to-violet-600/10 border-fuchsia-300 shadow-sm',
    accentColor: '#D946EF',
    patternId: 'art-music-pattern',
    category: 'active',
  },
  {
    id: 'art-paint',
    name: 'Hội họa Sáng tạo (Creative Canvas)',
    bgClass: 'bg-gradient-to-tr from-pink-500/10 via-rose-500/[0.04] to-amber-500/10 border-rose-300 shadow-sm',
    accentColor: '#F43F5E',
    patternId: 'art-paint-pattern',
    category: 'active',
  },

  // Pet
  {
    id: 'paw-paradise',
    name: 'Dấu chân Vui nhộn (Paw Paradise)',
    bgClass: 'bg-gradient-to-br from-amber-50 via-orange-50/30 to-yellow-50 border-amber-200 shadow-sm',
    accentColor: '#D97706',
    patternId: 'paw-print-pattern',
    category: 'pet',
  },
  {
    id: 'cat-kingdom',
    name: 'Vương quốc Mèo (Cat Kingdom)',
    bgClass: 'bg-gradient-to-br from-rose-50 via-pink-50/20 to-rose-100/20 border-rose-200 shadow-sm',
    accentColor: '#EC4899',
    patternId: 'cat-kingdom-pattern',
    category: 'pet',
  },
  {
    id: 'dog-playland',
    name: 'Sân chơi Cún con (Dog Playland)',
    bgClass: 'bg-gradient-to-br from-sky-50 via-blue-50/20 to-indigo-50/20 border-sky-200 shadow-sm',
    accentColor: '#2563EB',
    patternId: 'dog-playland-pattern',
    category: 'pet',
  },
  {
    id: 'sweet-honey',
    name: 'Ong Mật Ngọt (Sweet Honey)',
    bgClass: 'bg-gradient-to-br from-yellow-500/10 via-amber-500/[0.04] to-orange-500/10 border-yellow-300 shadow-sm',
    accentColor: '#CA8A04',
    patternId: 'honey-comb-pattern',
    category: 'pet',
  }
];

export const getPatternStyle = (pattern?: string, color?: string): React.CSSProperties => {
  const c = color || '#3B82F6';
  
  let targetPattern = pattern;
  const aliasMap: Record<string, string> = {
    'gold-corners': 'premium-frame-pattern',
    'soft-waves': 'soft-waves-pattern',
    'circuit-corners': 'circuit-neon-pattern',
    'diagonal-frames': 'spark-dot-frame',
    'academic-lines': 'academic-crest-pattern',
    'premium-frame': 'premium-frame-pattern',
    'botanical-corners': 'soft-waves-pattern',
    'geometric-ribbon': 'spark-dot-frame',
    'wave-corner-mix': 'chroma-glow-pattern',
    'campus-badge-frame': 'academic-crest-pattern',
    'sport-stripes': 'sport-stripes-pattern',
    'celebration-stars': 'chroma-glow-pattern',
    'paw-print': 'paw-print-pattern',
    'cat-club': 'cat-kingdom-pattern',
    'dog-club': 'dog-playland-pattern',
    'pet-care-icons': 'paw-print-pattern',
    'animal-friends': 'paw-print-pattern',
    'tech-grid-pattern': 'glass-grid',
    'cyber-frame-pattern': 'circuit-neon-pattern',
    'blueprint-pattern': 'glass-grid',
    'carbon-panel-pattern': 'carbon-3d-pattern',
    'precision-blocks-pattern': 'abstract-geom-pattern',
    'symmetric-crest-pattern': 'academic-crest-pattern',
  };
  
  if (targetPattern && aliasMap[targetPattern]) {
    targetPattern = aliasMap[targetPattern];
  }

  let svgString = '';
  switch (targetPattern) {
    case 'spark-dot-frame':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.08">
    <circle cx="20" cy="20" r="1" /><circle cx="60" cy="20" r="1" /><circle cx="100" cy="20" r="1" /><circle cx="140" cy="20" r="1" /><circle cx="180" cy="20" r="1" /><circle cx="220" cy="20" r="1" /><circle cx="260" cy="20" r="1" />
    <circle cx="20" cy="50" r="1" /><circle cx="60" cy="50" r="1" /><circle cx="100" cy="50" r="1" /><circle cx="140" cy="50" r="1" /><circle cx="180" cy="50" r="1" /><circle cx="220" cy="50" r="1" /><circle cx="260" cy="50" r="1" />
    <circle cx="20" cy="80" r="1" /><circle cx="60" cy="80" r="1" /><circle cx="100" cy="80" r="1" /><circle cx="140" cy="80" r="1" /><circle cx="180" cy="80" r="1" /><circle cx="220" cy="80" r="1" /><circle cx="260" cy="80" r="1" />
    <circle cx="20" cy="110" r="1" /><circle cx="60" cy="110" r="1" /><circle cx="100" cy="110" r="1" /><circle cx="140" cy="110" r="1" /><circle cx="180" cy="110" r="1" /><circle cx="220" cy="110" r="1" /><circle cx="260" cy="110" r="1" />
  </g>
  <path d="M 12 12 H 40 M 12 12 V 40" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
  <path d="M 288 12 H 260 M 288 12 V 40" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
  <path d="M 12 148 H 40 M 12 148 V 120" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
  <path d="M 288 148 H 260 M 288 148 V 120" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" stroke-linecap="round" />
</svg>`;
      break;
    case 'glass-grid':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="glassGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.08" />
    </pattern>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="30%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="300" height="160" fill="url(#glassGrid)" />
  <path d="M -50 0 L 150 0 L 0 160 L -150 160 Z" fill="url(#shine)" />
</svg>`;
      break;
    case 'academic-crest-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" transform="translate(150, 80) scale(1.6)">
    <path d="M -12 -15 L 12 -15 C 12 -15, 15 2, 0 16 C -15 2, -12 -15, -12 -15 Z" />
    <path d="M -10 -13 L 10 -13 C 10 -13, 12.5 1, 0 13.5 C -12.5 1, -10 -13, -10 -13 Z" stroke-dasharray="1.5 1.5" />
    <path d="M -6 -4 Q -3 -6, 0 -4 Q 3 -6, 6 -4 L 6 3 Q 3 1, 0 3 Q -3 1, -6 3 Z" fill="${c}" fill-opacity="0.1" />
    <circle cx="0" cy="-8" r="1.5" fill="${c}" />
    <polygon points="0,-18 1,-16 3,-16 1.5,-15 2,-13 0,-14.5 -2,-13 -1.5,-15 -3,-16 -1,-16" fill="${c}" fill-opacity="0.8" stroke="none" />
  </g>
  <path d="M 85,80 Q 95,120, 150,125 Q 205,120, 215,80" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="4 2" opacity="0.25" />
</svg>`;
      break;
    case 'soft-waves-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <path d="M 0 100 Q 75 70, 150 110 T 300 90 L 300 160 L 0 160 Z" fill="${c}" opacity="0.08" />
  <path d="M 0 120 Q 85 95, 170 130 T 300 115 L 300 160 L 0 160 Z" fill="${c}" opacity="0.05" />
  <path d="M 0 80 Q 60 110, 130 75 T 300 100 L 300 160 L 0 160 Z" fill="${c}" opacity="0.03" />
</svg>`;
      break;
    case 'premium-frame-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <rect x="6" y="6" width="288" height="148" rx="6" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.3" />
  <rect x="10" y="10" width="280" height="140" rx="4" fill="none" stroke="${c}" stroke-width="0.6" stroke-dasharray="4 3" opacity="0.2" />
  <path d="M 6 22 L 22 6 M 6 26 V 6 H 26" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 294 22 L 278 6 M 294 26 V 6 H 274" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 6 138 L 22 154 M 6 134 V 154 H 26" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 294 138 L 278 154 M 294 134 V 154 H 274" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.4" />
  <path d="M 140 6 L 144 11 L 150 6 L 156 11 L 160 6 L 158 13 H 142 Z" fill="${c}" opacity="0.35" />
</svg>`;
      break;
    case 'circuit-neon-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <g fill="${c}" opacity="0.2">
    <circle cx="20" cy="30" r="1.5" /><circle cx="26" cy="30" r="1" /><circle cx="32" cy="30" r="1" />
    <circle cx="280" cy="130" r="1.5" /><circle cx="274" cy="130" r="1" /><circle cx="268" cy="130" r="1" />
  </g>
  <path d="M 10 120 L 70 120 L 90 140 L 180 140 L 190 130" fill="none" stroke="${c}" stroke-width="1" opacity="0.4" filter="url(#neonGlow)" />
  <path d="M 290 40 L 230 40 L 210 20 L 150 20" fill="none" stroke="${c}" stroke-width="1" opacity="0.4" filter="url(#neonGlow)" />
  <circle cx="90" cy="140" r="2.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.5" />
  <circle cx="210" cy="20" r="2.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.5" />
</svg>`;
      break;
    case 'space-orbit-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${c}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="300" height="160" fill="url(#centerGlow)" />
  <ellipse cx="150" cy="80" rx="120" ry="40" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.25" transform="rotate(-15 150 80)" />
  <ellipse cx="150" cy="80" rx="80" ry="25" fill="none" stroke="${c}" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.2" transform="rotate(-15 150 80)" />
  <ellipse cx="150" cy="80" rx="160" ry="55" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.15" transform="rotate(-15 150 80)" />
  <circle cx="60" cy="30" r="1" fill="#fff" opacity="0.6" />
  <circle cx="250" cy="40" r="1.5" fill="#fff" opacity="0.8" />
  <circle cx="80" cy="130" r="0.8" fill="#fff" opacity="0.5" />
  <circle cx="220" cy="120" r="1.2" fill="#fff" opacity="0.7" />
  <polygon points="180,40 181.5,43 185,43 182,45 183,48 180,46.5 177,48 178,45 175,43 178.5,43" fill="${c}" opacity="0.4" />
</svg>`;
      break;
    case 'carbon-3d-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="carbon" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#18181b" />
      <polygon points="0,0 3,0 0,3" fill="#27272a" />
      <polygon points="3,3 6,3 3,6" fill="#27272a" />
      <polygon points="3,0 6,0 6,3" fill="#09090b" opacity="0.4" />
      <polygon points="0,3 3,3 0,6" fill="#09090b" opacity="0.4" />
    </pattern>
  </defs>
  <rect width="300" height="160" fill="url(#carbon)" opacity="0.4" />
  <line x1="12" y1="0" x2="12" y2="160" stroke="${c}" stroke-width="1.5" opacity="0.25" />
  <line x1="288" y1="0" x2="288" y2="160" stroke="${c}" stroke-width="1.5" opacity="0.25" />
</svg>`;
      break;
    case 'abstract-geom-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <polygon points="0,0 120,0 70,160 0,160" fill="${c}" opacity="0.05" />
  <polygon points="300,160 180,160 230,0 300,0" fill="${c}" opacity="0.05" />
  <line x1="120" y1="0" x2="70" y2="160" stroke="${c}" stroke-width="0.8" stroke-dasharray="5 3" opacity="0.15" />
  <line x1="180" y1="160" x2="230" y2="0" stroke="${c}" stroke-width="0.8" stroke-dasharray="5 3" opacity="0.15" />
  <g stroke="${c}" stroke-width="0.8" opacity="0.25" fill="none" transform="translate(250, 40)">
    <circle cx="0" cy="0" r="8" />
    <line x1="-12" y1="0" x2="12" y2="0" />
    <line x1="0" y1="-12" x2="0" y2="12" />
  </g>
</svg>`;
      break;
    case 'sport-stripes-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.12">
    <polygon points="230,0 260,0 180,160 150,160" />
    <polygon points="265,0 285,0 205,160 185,160" />
    <polygon points="290,0 300,0 220,160 210,160" />
    <polygon points="0,20 30,20 0,80" />
  </g>
  <path d="M 12 140 L 22 148 L 12 156" fill="none" stroke="${c}" stroke-width="2" opacity="0.3" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 20 140 L 30 148 L 20 156" fill="none" stroke="${c}" stroke-width="1" opacity="0.2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
      break;
    case 'chroma-glow-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.3" />
      <stop offset="50%" stop-color="#EC4899" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#EAB308" stop-opacity="0.25" />
    </linearGradient>
  </defs>
  <rect width="300" height="160" fill="url(#neonGrad)" />
  <path d="M 0 60 C 80 20, 120 100, 200 50 T 300 80" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.4" stroke-linecap="round" />
  <path d="M 0 65 C 80 25, 120 105, 200 55 T 300 85" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.3" stroke-linecap="round" />
</svg>`;
      break;
    case 'halftone-pop-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="halftone" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1" fill="${c}" opacity="0.15" />
      <circle cx="15" cy="15" r="2" fill="${c}" opacity="0.1" />
      <circle cx="27" cy="27" r="1.5" fill="${c}" opacity="0.12" />
    </pattern>
  </defs>
  <rect width="300" height="160" fill="url(#halftone)" />
  <path d="M 260 20 L 275 25 L 265 32 L 285 35 L 255 48 L 262 35 L 250 32 Z" fill="${c}" opacity="0.3" />
  <path d="M 30 110 L 45 115 L 35 122 L 55 125 L 25 138 L 32 125 L 20 122 Z" fill="${c}" opacity="0.25" />
</svg>`;
      break;
    case 'ocean-waves-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <path d="M 0 110 C 60 90, 100 130, 170 100 C 240 70, 270 120, 300 95 L 300 160 L 0 160 Z" fill="${c}" opacity="0.12" />
  <path d="M 0 125 C 50 115, 90 140, 150 120 C 210 100, 250 135, 300 115 L 300 160 L 0 160 Z" fill="${c}" opacity="0.08" />
  <circle cx="45" cy="40" r="3.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.2" />
  <circle cx="52" cy="35" r="2" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.15" />
  <circle cx="250" cy="50" r="4" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.18" />
</svg>`;
      break;
    case 'paw-print-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.15" transform="translate(25, 25) rotate(-15)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
  <g fill="${c}" opacity="0.15" transform="translate(265, 115) rotate(20)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
  <g fill="${c}" opacity="0.08" transform="translate(250, 25) rotate(35) scale(0.8)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
  <g fill="${c}" opacity="0.08" transform="translate(30, 120) rotate(-30) scale(0.8)">
    <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
    <circle cx="2" cy="7" r="1.5" /><circle cx="6" cy="4" r="1.5" /><circle cx="10.5" cy="4" r="1.5" /><circle cx="14" cy="7" r="1.5" />
  </g>
</svg>`;
      break;
    case 'cat-kingdom-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="none" stroke="${c}" stroke-width="1.2" opacity="0.22">
    <path d="M 10 2 Q 13 12, 23 14" /><path d="M 10 2 Q 4 8, 2 18" />
    <path d="M 290 2 Q 287 12, 277 14" /><path d="M 290 2 Q 296 8, 298 18" />
  </g>
  <g fill="${c}" opacity="0.14" transform="translate(250, 120) rotate(-15) scale(0.8)">
    <path d="M 12 5 C 9 2, 6 2, 4 4 C 2 6, 2 9, 4 11 C 6 13, 9 13, 12 10 L 15 13 H 17 V 9 V 7 V 3 H 15 Z" />
  </g>
  <g fill="${c}" opacity="0.14" transform="translate(40, 28) scale(0.7)">
    <path d="M 12 5 C 9 2, 6 2, 4 4 C 2 6, 2 9, 4 11 C 6 13, 9 13, 12 10 L 15 13 H 17 V 9 V 7 V 3 H 15 Z" />
  </g>
  <path d="M 12 5 C 10 3, 7 3, 5 5 C 3 7, 3 10, 5 12 L 12 18 L 19 12 C 21 10, 21 7, 19 5 C 17 3, 14 3, 12 5 Z" fill="${c}" opacity="0.12" transform="translate(145, 20) scale(0.6)" />
</svg>`;
      break;
    case 'dog-playland-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="${c}" opacity="0.15" transform="translate(260, 25) rotate(35) scale(0.9)">
    <path d="M 3 6 C 2 4.5, 0.5 5, 1 7 C 0.5 9, 2 9.5, 3 8 L 13 8 C 14 9.5, 15.5 9, 15 7 C 15.5 5, 14 4.5, 13 6 Z" />
  </g>
  <g fill="${c}" opacity="0.15" transform="translate(30, 120) rotate(-25) scale(0.9)">
    <path d="M 3 6 C 2 4.5, 0.5 5, 1 7 C 0.5 9, 2 9.5, 3 8 L 13 8 C 14 9.5, 15.5 9, 15 7 C 15.5 5, 14 4.5, 13 6 Z" />
  </g>
  <circle cx="50" cy="35" r="7" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.14" />
  <path d="M 46.5 30 Q 50 35, 46.5 40 M 53.5 30 Q 50 35, 53.5 40" fill="none" stroke="${c}" stroke-width="0.6" stroke-dasharray="1 1" opacity="0.15" />
</svg>`;
      break;
    case 'honey-comb-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <defs>
    <pattern id="honeycomb" width="28" height="16" patternUnits="userSpaceOnUse">
      <path d="M 0 8 L 4 0 L 12 0 L 16 8 L 12 16 L 4 16 Z M 14 16 L 18 8 L 26 8 L 30 16" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.08" />
    </pattern>
  </defs>
  <rect width="300" height="160" fill="url(#honeycomb)" />
  <polygon points="12,12 18,6 30,6 36,12 30,18 18,18" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.25" />
  <polygon points="264,136 270,130 282,130 288,136 282,142 270,142" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.25" />
</svg>`;
      break;
    case 'eco-leaf-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g fill="none" stroke="${c}" stroke-width="1.2" opacity="0.22">
    <path d="M 5 25 C 15 25, 25 15, 25 5 C 15 5, 5 15, 5 25 Z" fill="${c}" fill-opacity="0.08" />
    <path d="M 5 25 L 20 10" />
    <path d="M 295 135 C 285 135, 275 145, 275 155 C 285 155, 295 145, 295 135 Z" fill="${c}" fill-opacity="0.08" />
    <path d="M 295 135 L 280 150" />
  </g>
  <path d="M 90 80 A 15 15 0 0 1 120 80 M 115 75 L 120 80 L 115 85" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" />
  <path d="M 120 80 A 15 15 0 0 1 105 95 M 109 99 L 105 95 L 101 99" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" />
</svg>`;
      break;
    case 'medical-pulse-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <path d="M 10 80 H 80 L 90 60 L 100 110 L 110 50 L 120 90 L 130 80 H 290" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.25" stroke-linecap="round" stroke-linejoin="round" />
  <g stroke="${c}" stroke-width="1" fill="none" opacity="0.15" transform="translate(260, 25) scale(0.9)">
    <path d="M 0 -6 H 4 V -2 H 8 V 2 H 4 V 6 H -4 V 2 H -8 V -2 H -4 V -6 Z" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="0.8" opacity="0.12" transform="translate(30, 115) scale(0.8)">
    <circle cx="10" cy="10" r="8" />
    <path d="M 10 18 Q 10 26, 18 26 T 26 18" />
    <circle cx="26" cy="18" r="3" fill="${c}" fill-opacity="0.2" />
  </g>
</svg>`;
      break;
    case 'lang-global-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="0.6" fill="none" opacity="0.16" transform="translate(255, 35)">
    <circle cx="0" cy="0" r="22" />
    <ellipse cx="0" cy="0" rx="22" ry="7" />
    <ellipse cx="0" cy="0" rx="7" ry="22" />
    <line x1="-22" y1="0" x2="22" y2="0" />
    <line x1="0" y1="-22" x2="0" y2="22" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="1" opacity="0.2" transform="translate(35, 120)">
    <path d="M 2 10 A 8 8 0 0 1 18 10 A 8 8 0 0 1 2 10 Z" fill="${c}" fill-opacity="0.08" />
    <path d="M 14 18 L 18 22 L 18 16" />
    <path d="M 8 13 L 10 7 L 12 13 M 9 11 H 11" stroke-width="0.8" />
  </g>
  <g fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" transform="translate(58, 115) scale(0.8)">
    <path d="M 2 10 A 8 8 0 0 1 18 10 A 8 8 0 0 1 2 10 Z" />
    <path d="M 6 18 L 2 22 L 2 16" />
    <path d="M 6 7 H 14 M 10 7 V 10 M 7 10 Q 10 13, 13 14 M 13 10 Q 10 13, 7 14" />
  </g>
</svg>`;
      break;
    case 'tech-ai-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <g stroke="${c}" stroke-width="0.8" fill="none" opacity="0.3">
    <line x1="60" y1="40" x2="100" y2="80" />
    <line x1="60" y1="120" x2="100" y2="80" />
    <line x1="100" y1="80" x2="160" y2="80" />
    <line x1="160" y1="80" x2="200" y2="40" />
    <line x1="160" y1="80" x2="200" y2="120" />
    <circle cx="60" cy="40" r="3.5" fill="#fff" />
    <circle cx="60" cy="120" r="3.5" fill="#fff" />
    <circle cx="100" cy="80" r="5" fill="${c}" />
    <circle cx="160" cy="80" r="5" fill="${c}" />
    <circle cx="200" cy="40" r="3.5" fill="#fff" />
    <circle cx="200" cy="120" r="3.5" fill="#fff" />
  </g>
</svg>`;
      break;
    case 'tech-hardware-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <rect x="20" y="20" width="260" height="120" rx="4" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.25" />
  <line x1="50" y1="20" x2="50" y2="10" stroke="${c}" stroke-width="0.8" opacity="0.3" />
  <line x1="100" y1="20" x2="100" y2="10" stroke="${c}" stroke-width="0.8" opacity="0.3" />
  <line x1="150" y1="20" x2="150" y2="10" stroke="${c}" stroke-width="0.8" opacity="0.3" />
  <line x1="200" y1="20" x2="200" y2="10" stroke="${c}" stroke-width="0.8" opacity="0.3" />
</svg>`;
      break;
    case 'eng-mechanical-pattern':
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <circle cx="260" cy="30" r="18" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.22" />
  <circle cx="260" cy="30" r="6" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.15" />
  <circle cx="40" cy="120" r="28" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.18" />
</svg>`;
      break;
    default:
      svgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" width="100%" height="100%" preserveAspectRatio="none">
  <rect width="300" height="160" fill="none" />
</svg>`;
      break;
  }

  const base64Svg = typeof window === 'undefined' 
    ? Buffer.from(svgString.trim()).toString('base64') 
    : btoa(unescape(encodeURIComponent(svgString.trim())));
    
  return {
    backgroundImage: `url("data:image/svg+xml;base64,${base64Svg}")`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
  };
};

export const isDarkTemplate = (patternId?: string): boolean => {
  if (!patternId) return false;
  const template = BACKGROUND_TEMPLATES.find((t) => t.id === patternId || t.patternId === patternId);
  return !!template?.isDark;
};

export interface BackgroundConfigResult {
  cardBgClass: string;
  accentColor: string;
  isCustomBg: boolean;
  customBgUrl: string | null;
  patternId: string | undefined;
  isDark: boolean;
}

export const getActivityBackgroundConfig = (activity: any): BackgroundConfigResult => {
  const bgConfig = activity.background_config || {};
  const pattern = bgConfig.pattern;
  const preset = bgConfig.preset;
  
  const template = BACKGROUND_TEMPLATES.find((t) => t.id === pattern);
  const isDark = !!template?.isDark;
  
  const cardBgClass = template 
    ? template.bgClass 
    : (BACKGROUND_PRESETS.find((p) => p.id === preset)?.className || "bg-white/45 border-white/70");
    
  const accentColor = bgConfig.accentColor || (template ? template.accentColor : getClubAccentColor(activity));
  
  const isCustomBg = !!(bgConfig.backgroundImageUrl || (bgConfig.useAvatarAsBackground && activity.logo_url));
  
  const customBgUrl = bgConfig.backgroundImageUrl
    ? getImageUrl(bgConfig.backgroundImageUrl)
    : (bgConfig.useAvatarAsBackground && activity.logo_url)
      ? getImageUrl(activity.logo_url)
      : null;
      
  return {
    cardBgClass,
    accentColor,
    isCustomBg,
    customBgUrl,
    patternId: pattern,
    isDark,
  };
};
