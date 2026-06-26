"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, Award, Diamond } from "lucide-react";
import { resolveRankTier, getRankStyle, getCongratsMessage, type RankStyle } from "@/lib/grading-rank";

export interface StudentData {
  id: string;
  studentCode?: string;
  name: string;
  email: string;
  dob: string;
  gender: string;
  score: number;
  status: string;
  gradingStatus: "draft" | "sv_submitted" | "gv_reviewed" | "locked" | "no_summary";
  classId: string;
  className?: string;
  avatarUrl?: string;
  colorTheme?: { bg: string; text: string };
}

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

const DEFAULT_ACTIVE_STUDENT_RANK_STYLE: RankStyle = {
  label: "Chưa duyệt",
  accent: "#64748B",
  bg: "bg-white/45 backdrop-blur-md",
  border: "border-white/70",
  text: "text-slate-500",
  glassBg: "bg-white/45 backdrop-blur-md",
  glassBorder: "border-white/70",
  glassGlow: "shadow-sm shadow-slate-300/40",
  titleText: "text-[#1E293B]",
  descText: "text-[#64748B]",
  statusText: "text-[#64748B]",
  scoreText: "text-[#1E293B]",
};

const getInitials = (name: string) => {
  if (!name) return "SV";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[parts.length - 2].charAt(0).toUpperCase();
    const last = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first}${last}`;
  }
  return name.slice(0, 2).toUpperCase();
};

export default function ActiveStudentRankCard({ activeStudent }: { activeStudent: StudentData }) {
  const activeStudentHasApprovedRank = activeStudent.gradingStatus === "locked";
  const activeStudentRankTier = resolveRankTier(activeStudent.score, activeStudent.gradingStatus);
  const activeStudentRankStyle = activeStudentHasApprovedRank
    ? getRankStyle(activeStudentRankTier)
    : DEFAULT_ACTIVE_STUDENT_RANK_STYLE;
  const activeStudentCongrats = activeStudentHasApprovedRank
    ? getCongratsMessage(activeStudentRankTier)
    : {
        msg: "Xếp hạng sẽ được hiển thị sau khi điểm được duyệt.",
        gradient: "from-slate-400 to-slate-500",
        rgb: "100, 116, 139",
      };

  return (
    <motion.div
      key={`rank-card-${activeStudent.id}-${activeStudent.score}-${activeStudent.gradingStatus}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className={`relative shrink-0 overflow-hidden w-full min-h-[110px] rounded-2xl p-5 md:p-6 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_240px_auto] gap-5 items-center border transition-all duration-300 ${
        activeStudentRankStyle.glassBorder || activeStudentRankStyle.border
      } ${
        activeStudentRankStyle.glassBg || activeStudentRankStyle.bg
      } ${
        activeStudentRankStyle.glassGlow || activeStudentRankStyle.glow || 'shadow-md shadow-slate-200/50'
      }`}
    >
      {/* Ambient Background Lights & Sparkling Particles for Diamond Tier */}
      {activeStudentRankTier === 'diamond' && (
        <>
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Floating Diamond Sparkles */}
            <div className="absolute top-[10%] left-[8%]">
              <DiamondSparkle size={14} delay={0.1} duration={3.0} yOffset={-15} />
            </div>
            <div className="absolute top-[25%] right-[12%]">
              <DiamondSparkle size={18} delay={0.5} duration={3.5} yOffset={-20} />
            </div>
            <div className="absolute top-[60%] left-[5%]">
              <DiamondSparkle size={12} delay={1.0} duration={2.5} yOffset={-12} />
            </div>
            <div className="absolute top-[75%] right-[8%]">
              <DiamondSparkle size={16} delay={0.3} duration={4.0} yOffset={-25} />
            </div>
            <div className="absolute bottom-[20%] left-[20%]">
              <DiamondSparkle size={14} delay={1.5} duration={3.2} yOffset={-15} />
            </div>

            {/* Floating Wireframe Diamonds */}
            <div className="absolute top-[18%] left-[22%]">
              <FloatingDiamond size={13} delay={0.2} duration={4.5} yOffset={-20} />
            </div>
            <div className="absolute top-[60%] right-[18%]">
              <FloatingDiamond size={16} delay={0.9} duration={5.0} yOffset={-30} />
            </div>
          </div>
        </>
      )}

      {/* Sweeping Sheen Highlight for premium cards (Diamond & Gold) */}
      {(activeStudentRankTier === 'diamond' || activeStudentRankTier === 'gold') && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 pointer-events-none z-10"
          initial={{ x: '-150%' }}
          animate={{ x: '150%' }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 5,
            ease: "easeInOut"
          }}
        />
      )}

      {/* LEFT SIDE: Student Information */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 w-full min-w-0 text-center sm:text-left">
        {/* Student Avatar with Glowing ring */}
        <div className="relative shrink-0 w-16 h-16 rounded-full flex items-center justify-center">
          {activeStudent.avatarUrl ? (
            <div
              className="w-full h-full rounded-full overflow-hidden border border-white/80 ring-2 ring-offset-2 ring-offset-transparent transition-all"
              style={{
                borderColor: activeStudentRankStyle.accent,
                boxShadow: `0 0 15px rgba(${activeStudentCongrats.rgb}, 0.3)`
              }}
            >
              <img
                alt={activeStudent.name}
                className="object-cover w-full h-full"
                src={activeStudent.avatarUrl}
              />
            </div>
          ) : (
            <div
              className={`w-full h-full rounded-full flex items-center justify-center font-bold text-[18px] border border-white/80 ring-2 ring-offset-2 ring-offset-transparent ${activeStudent.colorTheme?.bg || 'bg-slate-100'} ${activeStudent.colorTheme?.text || 'text-slate-600'}`}
              style={{
                boxShadow: `0 0 15px rgba(${activeStudentCongrats.rgb}, 0.3)`
              }}
            >
              {getInitials(activeStudent.name)}
            </div>
          )}

          {/* Active student indicator badge */}
          <div className="absolute -bottom-1 -right-1 bg-[#1A73E8] text-white border-2 border-white rounded-lg w-5.5 h-5.5 flex items-center justify-center shadow-md">
            <Check size={11} strokeWidth={3.5} />
          </div>
        </div>

        {/* Text details */}
        <div className="flex flex-col min-w-0 w-full">
          <h3
            title={activeStudent.name}
            className={`font-sans font-black text-[18px] md:text-[20px] tracking-tight leading-tight truncate ${
              activeStudentRankStyle.titleText || 'text-slate-800'
            }`}
          >
            {activeStudent.name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[12px] font-medium justify-center sm:justify-start min-w-0">
            <span className={`${activeStudentRankStyle.descText || 'text-slate-500'} shrink-0`}>
              MSSV: <strong className="font-bold">{activeStudent.studentCode || activeStudent.id}</strong>
            </span>
            <span className={`w-1 h-1 rounded-full shrink-0 ${activeStudentRankTier === 'unranked' ? 'bg-slate-400' : 'bg-current opacity-60'}`} />
            <span className={`${activeStudentRankStyle.descText || 'text-slate-500'} flex items-center min-w-0 gap-1`}>
              <span>Lớp:</span>
              <strong className="font-bold truncate max-w-[150px]" title={activeStudent.className || activeStudent.classId}>
                {activeStudent.className || activeStudent.classId}
              </strong>
            </span>
          </div>

          {/* Status Badge */}
          <div className="mt-2.5 flex items-center justify-center sm:justify-start">
            <span
              className={`text-[10.5px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full border shadow-sm ${
                activeStudent.gradingStatus === "locked"
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
              }`}
            >
              {activeStudent.gradingStatus === "locked" ? "Đã duyệt" : "Chưa duyệt"}
            </span>
          </div>
        </div>
      </div>

      {/* MIDDLE: Congrats/鼓勵 quote - Truncated on small screens for spacing */}
      <div className="hidden xl:flex flex-col max-w-[240px] text-right relative z-10">
        <p className={`text-[12px] italic leading-normal font-semibold line-clamp-2 ${activeStudentRankStyle.descText || 'text-slate-400'}`}>
          "{activeStudentCongrats.msg}"
        </p>
      </div>

      {/* RIGHT SIDE: Rank Badge & Realtime Score Container */}
      <div
        className="relative z-10 flex items-center gap-4.5 bg-white/10 backdrop-blur-md rounded-2xl p-3 px-4 border border-white/10 shadow-inner w-full md:w-auto justify-center md:justify-end border-t border-dashed border-white/20 pt-4 md:pt-3 md:border-t-0"
      >
        {/* Rank Badge Circular Icon with pulse */}
        <div
          className="relative w-12 h-12 rounded-xl flex items-center justify-center text-2xl border border-white/20 bg-white/20 shadow-md shrink-0"
          style={{
            boxShadow: activeStudentRankTier === 'diamond'
              ? `0 0 15px rgba(${activeStudentCongrats.rgb}, 0.4)`
              : `0 0 10px rgba(${activeStudentCongrats.rgb}, 0.15)`
          }}
        >
          {activeStudentRankTier === 'diamond' ? (
            <>
              <Diamond className="w-6 h-6 fill-current shrink-0 drop-shadow-[0_0_6px_rgba(125,211,252,0.85)]" style={{ color: activeStudentRankStyle.accent }} />
              {/* Pulse Ring */}
              <div className="absolute -inset-1 rounded-xl border border-sky-400 opacity-45 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
            </>
          ) : (
            <>
              <Award className="w-6 h-6 fill-current shrink-0" style={{ color: activeStudentRankStyle.accent }} />
            </>
          )}
        </div>

        {/* Rank Label & Points */}
        <div className="flex flex-col text-left">
          <span className={`text-[11px] font-extrabold uppercase tracking-widest ${activeStudentRankStyle.statusText || 'text-slate-400'}`}>
            Hạng: {activeStudentRankStyle.label}
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-2xl font-mono font-black tracking-tight leading-none ${activeStudentRankStyle.scoreText || 'text-slate-800'}`}>
              {activeStudent.score}
            </span>
            <span className="text-[12px] font-bold text-slate-400">/ 100đ</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
