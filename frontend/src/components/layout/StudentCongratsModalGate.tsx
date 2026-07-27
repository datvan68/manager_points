'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Diamond, Award } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { isStudentRole } from '@/utils/role.util';
import { summariesPointApi, LatestStudentSummary } from '@/api/summaries-point-api';
import { getRankStyle, RankTier, getCongratsMessage } from '@/lib/grading-rank';
import { getCongratsStorageKey } from './congrats-storage';


const DiamondSparkle = ({ size = 16, delay = 0, duration = 4, yOffset = -25 }: { size?: number; delay?: number; duration?: number; yOffset?: number }) => {
  return (
    <motion.svg
      className="text-sky-300/70 fill-current drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ 
        opacity: [0, 1, 1, 0], 
        y: [0, yOffset], 
        scale: [0.5, 1.2, 0.9, 0.5] 
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        delay: delay,
        ease: "easeInOut"
      }}
    >
      <path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2 Z" />
    </motion.svg>
  );
};

const FloatingDiamond = ({ size = 14, delay = 0, duration = 5, yOffset = -35 }: { size?: number; delay?: number; duration?: number; yOffset?: number }) => {
  return (
    <motion.svg
      className="text-cyan-300/40 stroke-current fill-none drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      initial={{ opacity: 0, y: 0, rotate: 0, scale: 0.7 }}
      animate={{ 
        opacity: [0, 0.8, 0.8, 0], 
        y: [0, yOffset], 
        rotate: [0, 90, 180],
        scale: [0.7, 1.1, 0.9, 0.7]
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        delay: delay,
        ease: "easeInOut"
      }}
    >
      <polygon points="12,2 22,12 12,22 2,12" strokeWidth="1.5" />
    </motion.svg>
  );
};

interface CongratsData {
  name: string;
  className: string;
  score: number;
  rankTier: RankTier;
  rankLabel: string;
  semester: string;
  summaryId: string;
  storageKey: string;
}



const getInitials = (name: string) => {
  if (!name) return 'SV';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const NeonHandwritingText = ({ text }: { text: string }) => {
  const words = text.split(' ');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setIsVisible(true);
      }, 700);
      return () => clearTimeout(timeout);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2
      }
    }
  } as const;

  const letterVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.9,
      y: 2,
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        duration: 0.35,
        ease: "easeOut"
      }
    }
  } as const;

  return (
    <div className="relative z-10 mb-2 select-none overflow-visible flex justify-center w-full min-h-[60px]">
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.h2 
            key="neon-title-loop"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ 
              opacity: 0, 
              scale: 0.95, 
              filter: 'blur(8px)',
              transition: { duration: 0.5, ease: "easeIn" } 
            }}
            className="text-[24px] sm:text-[38px] font-normal tracking-wide neon-handwriting-diamond leading-normal py-1 px-2 flex flex-nowrap whitespace-nowrap justify-center"
          >
            {words.map((word, wordIndex) => (
              <span key={wordIndex} className="inline-flex whitespace-nowrap">
                {Array.from(word).map((char, charIndex) => (
                  <motion.span
                    key={charIndex}
                    variants={letterVariants}
                    className="inline-block"
                  >
                    {char}
                  </motion.span>
                ))}
                {wordIndex < words.length - 1 && <span className="inline-block">&nbsp;</span>}
              </span>
            ))}
          </motion.h2>
        )}
      </AnimatePresence>
    </div>
  );
};


function resolveStudentCongratsIdentity(summary: LatestStudentSummary, user: any) {
  const summaryStudent = summary.student;
  const classObj = summaryStudent?.class_id;
  const isStudent = isStudentRole(user);

  return {
    name:
      summaryStudent?.full_name ||
      summary.studentName ||
      user?.display_name ||
      (!isStudent ? user?.user_name || user?.username : undefined) ||
      'Sinh viên',
    className:
      classObj?.class_name ||
      summary.className ||
      'Chưa cập nhật',
  };
}

export function isWithinCongratsWindow(lockedAt?: string, nowMs = Date.now()) {
  const lockedAtMs = Date.parse(lockedAt || '');
  const ageMs = nowMs - lockedAtMs;
  return Number.isFinite(lockedAtMs) && ageMs >= 0 && ageMs <= 72 * 60 * 60 * 1000;
}


export default function StudentCongratsModalGate() {
  const { user } = useAuth();
  const router = useRouter();
  const [congratsData, setCongratsData] = useState<CongratsData | null>(null);

  useEffect(() => {
    const checkStudentCongrats = async () => {
      if (!user || !isStudentRole(user)) return;
      
      try {
        const summary: LatestStudentSummary | null = await summariesPointApi.getMyLatestSummary();
        if (summary && summary.status === 'locked') {
          const userId = user.id || user.studentId;
          if (!userId || !summary._id) return;

          const lockedAt = summary.locked_at || '';
          if (!isWithinCongratsWindow(lockedAt)) return;
          const storageKey = getCongratsStorageKey(userId, summary._id, lockedAt);
          const congratsShown = sessionStorage.getItem(storageKey);
          if (!congratsShown) {
            const semName = summary.semester && summary.semester !== 'N/A' ? summary.semester : 'Học kỳ';
            const identity = resolveStudentCongratsIdentity(summary, user);
            setCongratsData({
              name: identity.name,
              className: identity.className,
              score: summary.total_score || 0,
              rankTier: summary.rank_tier || 'unranked',
              rankLabel: summary.rank_label || 'Chưa xếp hạng',
              semester: semName,
              summaryId: summary._id,
              storageKey: storageKey
            });
          }
        }
      } catch (err) {
        console.error('Failed to load congrats info:', err);
      }
    };
    
    checkStudentCongrats();
  }, [user]);

  const handleDismiss = () => {
    if (congratsData) {
      sessionStorage.setItem(congratsData.storageKey, "true");
      setCongratsData(null);
    }
  };

  const handleViewDetails = () => {
    if (congratsData) {
      sessionStorage.setItem(congratsData.storageKey, "true");
      setCongratsData(null);
      router.push("/grading/score");
    }
  };

  return (
    <AnimatePresence>
      {congratsData ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          />

          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className={`congrats-modal-card ${
              congratsData.rankTier === 'diamond' ? 'congrats-modal-card-diamond' : ''
            } relative overflow-hidden w-[calc(100%-0.5rem)] xs:w-full max-w-[450px] rounded-3xl p-5 xs:p-6 sm:p-8 flex flex-col items-center text-center ${
              getRankStyle(congratsData.rankTier).glassBorder || getRankStyle(congratsData.rankTier).border
            } ${
              getRankStyle(congratsData.rankTier).glassBg || getRankStyle(congratsData.rankTier).bg
            } ${
              getRankStyle(congratsData.rankTier).glassGlow || getRankStyle(congratsData.rankTier).glow || 'shadow-2xl'
            }
            `}
          >
            {/* Ambient Background Lights & Sparkling Particles for Diamond Tier */}
            {congratsData.rankTier === 'diamond' && (
              <>
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  {/* Floating Diamond Sparkles */}
                  <div className="absolute top-[12%] left-[12%]">
                    <DiamondSparkle size={18} delay={0.2} duration={3.2} yOffset={-20} />
                  </div>
                  <div className="absolute top-[28%] right-[10%]">
                    <DiamondSparkle size={22} delay={0.8} duration={3.8} yOffset={-25} />
                  </div>
                  <div className="absolute top-[55%] left-[8%]">
                    <DiamondSparkle size={14} delay={1.4} duration={2.8} yOffset={-15} />
                  </div>
                  <div className="absolute top-[72%] right-[12%]">
                    <DiamondSparkle size={20} delay={0.5} duration={4.2} yOffset={-30} />
                  </div>
                  <div className="absolute bottom-[22%] left-[22%]">
                    <DiamondSparkle size={16} delay={1.9} duration={3.5} yOffset={-18} />
                  </div>

                  {/* Floating Wireframe Diamonds */}
                  <div className="absolute top-[22%] left-[25%]">
                    <FloatingDiamond size={15} delay={0.4} duration={4.8} yOffset={-25} />
                  </div>
                  <div className="absolute top-[65%] right-[20%]">
                    <FloatingDiamond size={18} delay={1.1} duration={5.2} yOffset={-35} />
                  </div>
                  <div className="absolute bottom-[35%] left-[15%]">
                    <FloatingDiamond size={13} delay={0.7} duration={4.5} yOffset={-20} />
                  </div>

                  {/* Decorative Large Diamond Outline Shapes in corners */}
                  <svg className="absolute -top-12 -left-12 w-44 h-44 text-sky-400/10 stroke-current fill-none" viewBox="0 0 100 100">
                    <polygon points="50,10 90,50 50,90 10,50" strokeWidth="0.75" />
                    <polygon points="50,22 78,50 50,78 22,50" strokeWidth="0.5" opacity="0.6" />
                  </svg>
                </div>

                {/* Sweeping premium sheen highlight */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 pointer-events-none z-10"
                  initial={{ x: '-150%' }}
                  animate={{ x: '150%' }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    repeatDelay: 4.5,
                    ease: "easeInOut"
                  }}
                />
              </>
            )}

            {/* Huy hiệu hạng (Rank Icon) dạng vòng tròn phát sáng glassmorphic */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl shadow-md border border-white/10 mb-4 sm:mb-6 bg-white/10 backdrop-blur-md z-10"
              style={{
                boxShadow: congratsData.rankTier === 'diamond' 
                  ? `0 0 35px rgba(${getCongratsMessage(congratsData.rankTier).rgb}, 0.45), inset 0 0 15px rgba(255, 255, 255, 0.2)`
                  : `0 0 25px rgba(${getCongratsMessage(congratsData.rankTier).rgb}, 0.2)`,
              }}
            >
              {congratsData.rankTier === 'diamond' ? (
                <>
                  <Diamond className="w-10 h-10 sm:w-12 sm:h-12 fill-currentColor shrink-0 drop-shadow-[0_0_12px_rgba(125,211,252,0.85)]" style={{ color: getRankStyle(congratsData.rankTier).accent }} />
                  {/* Additional Diamond Shine Aura */}
                  <motion.div 
                    className="absolute inset-0 rounded-full bg-sky-400/15 filter blur-md pointer-events-none"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Pulse Rings */}
                  <div
                    className="absolute -inset-2 rounded-full border border-sky-400 opacity-35 animate-ping pointer-events-none"
                    style={{ animationDuration: '3s' }}
                  />
                  <div
                    className="absolute -inset-4 rounded-full border border-cyan-400 opacity-20 animate-ping pointer-events-none"
                    style={{ animationDuration: '3s', animationDelay: '1.5s' }}
                  />
                </>
              ) : (
                <>
                  <Award className="w-10 h-10 sm:w-12 sm:h-12 fill-currentColor shrink-0" style={{ color: getRankStyle(congratsData.rankTier).accent }} />
                  {/* Pulse Ring */}
                  <div
                    className="absolute -inset-2 rounded-full border border-current opacity-20 animate-ping pointer-events-none"
                    style={{ color: getRankStyle(congratsData.rankTier).accent }}
                  />
                </>
              )}
            </motion.div>

            {/* Tiêu đề Chúc mừng */}
            {congratsData.rankTier === 'diamond' ? (
              <NeonHandwritingText text="Chúc mừng hoàn thành!" />
            ) : (
              <h2 className={`relative z-10 text-xl sm:text-2xl font-black tracking-tight uppercase bg-gradient-to-r ${getCongratsMessage(congratsData.rankTier).gradient} bg-clip-text text-transparent mb-1`}>
                Chúc mừng hoàn thành!
              </h2>
            )}
            <p className={`relative z-10 text-[11px] sm:text-[12px] font-bold uppercase tracking-widest mb-4 sm:mb-6 ${getRankStyle(congratsData.rankTier).descText || 'text-slate-400'}`}>
              {congratsData.semester}
            </p>

            {/* Box Thông tin Sinh viên (Glassmorphic) */}
            <div className="relative z-10 w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6 text-left">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-[14px] sm:text-[16px] text-white bg-gradient-to-r ${getCongratsMessage(congratsData.rankTier).gradient} shrink-0`}>
                {getInitials(congratsData.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-extrabold text-[14px] sm:text-[15px] truncate ${getRankStyle(congratsData.rankTier).titleText || 'text-white'}`}>{congratsData.name}</h4>
                <p className={`text-[11px] sm:text-[11.5px] font-bold ${getRankStyle(congratsData.rankTier).descText || 'text-slate-400'}`}>
                  Lớp: {congratsData.className}
                </p>
              </div>
            </div>

            {/* Trình diễn Điểm & Xếp hạng */}
            <div className="relative z-10 flex flex-col items-center justify-center mb-5 sm:mb-6">
              <div className="flex items-baseline gap-1">
                <span className={`text-5xl sm:text-6xl font-black font-mono tracking-tight bg-gradient-to-r ${getCongratsMessage(congratsData.rankTier).gradient} bg-clip-text text-transparent`}>
                  {congratsData.score}
                </span>
                <span className="text-lg sm:text-xl font-bold text-slate-400">/ 100đ</span>
              </div>
              <div className="mt-2.5">
                <span className={`text-[12px] font-extrabold px-3.5 py-1 rounded-full ${getRankStyle(congratsData.rankTier).bg} ${getRankStyle(congratsData.rankTier).text} border ${getRankStyle(congratsData.rankTier).border} shadow-sm`}>
                  Hạng: {congratsData.rankLabel}
                </span>
              </div>
            </div>

            {/* Lời chúc / Khích lệ */}
            <p className={`relative z-10 text-[13px] font-medium leading-relaxed max-w-[360px] mb-2 italic ${getRankStyle(congratsData.rankTier).descText || 'text-slate-300'}`}>
              "{getCongratsMessage(congratsData.rankTier).msg}"
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full mt-6 sm:mt-8 z-10">
              <button
                onClick={handleViewDetails}
                className={`flex-1 py-2.5 sm:py-3 bg-gradient-to-r ${getCongratsMessage(congratsData.rankTier).gradient} hover:opacity-90 active:scale-[0.98] text-white font-bold text-[13.5px] sm:text-[14px] rounded-full shadow-lg transition-all cursor-pointer border border-white/20`}
                style={{
                  boxShadow: `0 8px 20px rgba(${getCongratsMessage(congratsData.rankTier).rgb}, 0.15)`,
                }}
              >
                Xem chi tiết
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white font-bold text-[13.5px] sm:text-[14px] rounded-full transition-all cursor-pointer border border-white/10"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
