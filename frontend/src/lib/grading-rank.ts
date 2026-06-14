export type RankTier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'unranked';

export interface RankStyle {
  label: string;
  accent: string;
  bg: string;
  border: string;
  text: string;
  glow?: string;
  icon?: string;
  glassBg?: string;
  glassBorder?: string;
  glassGlow?: string;
  titleText?: string;
  descText?: string;
  statusText?: string;
  scoreText?: string;
  badgeBg?: string;
  badgeText?: string;
}

export const rankTierStyles: Record<RankTier, RankStyle> = {
  diamond: {
    label: 'Xuất sắc',
    accent: '#7DD3FC',
    bg: 'bg-sky-950/45',
    border: 'border-sky-400/30',
    text: 'text-sky-300',
    glow: 'shadow-[0_0_16px_rgba(56,189,248,0.4)]',
    icon: '💎',
    glassBg: 'premium-card-diamond premium-shimmer-effect',
    glassBorder: 'border-transparent',
    glassGlow: 'shadow-[0_12px_40px_rgba(56,189,248,0.45)]',
    titleText: 'text-white font-extrabold tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]',
    descText: 'text-sky-100/95 font-bold',
    statusText: 'text-sky-200 font-black tracking-widest drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]',
    scoreText: 'text-white drop-shadow-[0_0_15px_rgba(56,189,248,1)]',
    badgeBg: 'bg-gradient-to-r from-sky-950/80 via-slate-900/80 to-cyan-950/80 border border-sky-400/50',
    badgeText: 'text-sky-200 font-bold drop-shadow-[0_0_5px_rgba(56,189,248,0.7)]',
  },
  gold: {
    label: 'Tốt',
    accent: '#FBBF24',
    bg: 'bg-amber-950/45',
    border: 'border-amber-400/30',
    text: 'text-amber-300',
    icon: '🥇',
    glassBg: 'premium-card-gold premium-shimmer-effect',
    glassBorder: 'border-transparent',
    glassGlow: 'shadow-[0_12px_40px_rgba(251,191,36,0.45)]',
    titleText: 'text-white font-extrabold tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]',
    descText: 'text-amber-100/95 font-bold',
    statusText: 'text-amber-200 font-black tracking-widest drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]',
    scoreText: 'text-white drop-shadow-[0_0_15px_rgba(251,191,36,1)]',
    badgeBg: 'bg-gradient-to-r from-amber-950/80 via-slate-900/80 to-yellow-950/80 border border-amber-400/50',
    badgeText: 'text-amber-200 font-bold drop-shadow-[0_0_5px_rgba(251,191,36,0.7)]',
  },
  silver: {
    label: 'Khá',
    accent: '#cbd5e1',
    bg: 'bg-slate-950/45',
    border: 'border-slate-400/30',
    text: 'text-slate-300',
    icon: '🥈',
    glassBg: 'premium-card-silver premium-shimmer-effect',
    glassBorder: 'border-transparent',
    glassGlow: 'shadow-[0_12px_40px_rgba(203,213,225,0.4)]',
    titleText: 'text-white font-extrabold tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]',
    descText: 'text-slate-100/95 font-bold',
    statusText: 'text-slate-200 font-black tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]',
    scoreText: 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,1)]',
    badgeBg: 'bg-gradient-to-r from-slate-900/80 via-slate-950/80 to-slate-900/80 border border-slate-400/50',
    badgeText: 'text-slate-200 font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.6)]',
  },
  bronze: {
    label: 'Trung bình',
    accent: '#F97316',
    bg: 'bg-orange-950/45',
    border: 'border-orange-400/30',
    text: 'text-orange-300',
    icon: '🥉',
    glassBg: 'premium-card-bronze premium-shimmer-effect',
    glassBorder: 'border-transparent',
    glassGlow: 'shadow-[0_12px_40px_rgba(249,115,22,0.4)]',
    titleText: 'text-white font-extrabold tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]',
    descText: 'text-orange-100/95 font-bold',
    statusText: 'text-orange-200 font-black tracking-widest drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]',
    scoreText: 'text-white drop-shadow-[0_0_15px_rgba(249,115,22,1)]',
    badgeBg: 'bg-gradient-to-r from-orange-950/80 via-slate-900/80 to-amber-950/80 border border-orange-400/50',
    badgeText: 'text-orange-200 font-bold drop-shadow-[0_0_5px_rgba(249,115,22,0.6)]',
  },
  unranked: {
    label: 'Yếu',
    accent: '#EF4444',
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    icon: '⚠️',
    glassBg: 'premium-card-unranked premium-shimmer-effect',
    glassBorder: 'border-transparent',
    glassGlow: 'shadow-[0_8px_32px_rgba(239,68,68,0.2)]',
    titleText: 'text-white font-extrabold tracking-wide drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    descText: 'text-rose-200/90 font-semibold',
    statusText: 'text-rose-300 font-extrabold tracking-wider drop-shadow-[0_0_5px_rgba(239,68,68,0.4)]',
    scoreText: 'text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]',
    badgeBg: 'bg-rose-950/60 border border-rose-400/40',
    badgeText: 'text-rose-300 drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]',
  },
};

export function getRankStyle(tier?: RankTier | null): RankStyle {
  return rankTierStyles[tier ?? 'unranked'] ?? rankTierStyles.unranked;
}

export function resolveRankTier(score: number | null, status?: string): RankTier {
  if (status !== 'locked' || score === null || score === undefined) return 'unranked';
  if (score >= 90) return 'diamond';
  if (score >= 80) return 'gold';
  if (score >= 70) return 'silver';
  if (score >= 50) return 'bronze';
  return 'unranked';
}

export interface CongratsMessage {
  msg: string;
  gradient: string;
  rgb: string;
}

export function getCongratsMessage(tier: RankTier): CongratsMessage {
  switch (tier) {
    case 'diamond':
      return {
        msg: "Xuất sắc! Sự nỗ lực vượt bậc của bạn đã đạt đến đỉnh cao. Hãy tiếp tục phát huy tinh thần dẫn đầu này nhé! 💎🚀",
        gradient: "from-cyan-400 to-blue-500",
        rgb: "34, 211, 238",
      };
    case 'gold':
      return {
        msg: "Chúc mừng bạn! Kết quả học tập và rèn luyện vô cùng ấn tượng. Bạn đã làm rất tốt, tiếp tục duy trì phong độ này nhé! 🥇✨",
        gradient: "from-amber-400 to-orange-500",
        rgb: "245, 158, 11",
      };
    case 'silver':
      return {
        msg: "Thành tích rất tốt! Sự cố gắng của bạn đang gặt hái những quả ngọt. Tiến thêm một bước nữa để chạm tới đỉnh cao mới nào! 🥈💪",
        gradient: "from-slate-400 to-slate-600",
        rgb: "148, 163, 184",
      };
    case 'bronze':
      return {
        msg: "Cảm ơn nỗ lực rèn luyện của bạn! Bạn đã hoàn thành tốt chặng đường này. Hãy giữ vững ngọn lửa nhiệt huyết để bứt phá hơn nữa nhé! 🥉🔥",
        gradient: "from-orange-400 to-amber-700",
        rgb: "180, 83, 9",
      };
    default:
      return {
        msg: "Chúc mừng bạn đã hoàn thành đợt chấm điểm rèn luyện! Mỗi nỗ lực nhỏ hôm nay là bước đệm lớn cho thành công ngày mai. Tiến lên nhé! 🌟",
        gradient: "from-blue-400 to-indigo-500",
        rgb: "59, 130, 246",
      };
  }
}

