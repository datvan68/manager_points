'use client';

import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Heart, AlertCircle, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tokenStorage } from '@/api/auth-api';
import { activityScheduleApi } from '@/api/activity-api';
import {
  activityCategoryLabels,
  getActivityBackgroundConfig,
  getPatternStyle,
  getStateButtonConfig
} from './activity-view-policy';
import { getActivityScheduleSummary as getActivityScheduleSummary } from '@/components/activities/utils/activity-schedule-helper';

// Pet Accent Layer Component
const PetAccentLayer = ({ type, color }: { type?: string; color: string }) => {
  if (!type || type === 'none') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden pet-accent-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pawBorderTop {
          0% { transform: translate(-20px, 4px) rotate(90deg); opacity: 0; }
          5% { opacity: 0.25; }
          45% { opacity: 0.25; }
          50% { transform: translate(320px, 4px) rotate(90deg); opacity: 0; }
          100% { transform: translate(320px, 4px) rotate(90deg); opacity: 0; }
        }

        @keyframes pawBorderBottom {
          0% { transform: translate(320px, 222px) rotate(-90deg); opacity: 0; }
          50% { transform: translate(320px, 222px) rotate(-90deg); opacity: 0; }
          55% { opacity: 0.25; }
          95% { opacity: 0.25; }
          100% { transform: translate(-20px, 222px) rotate(-90deg); opacity: 0; }
        }

        @keyframes catPeeking {
          0% { transform: translateY(100%); }
          5% { transform: translateY(0); }
          30% { transform: translateY(0); }
          35% { transform: translateY(100%); }
          100% { transform: translateY(100%); }
        }

        @keyframes dogBoneDrift {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0.15; }
          50% { transform: translate(-8px, 6px) rotate(15deg); opacity: 0.3; }
          100% { transform: translate(0, 0) rotate(0deg); opacity: 0.15; }
        }

        @keyframes petFlying {
          0% { transform: translate(-20px, 2px); opacity: 0; }
          8% { opacity: 0.35; }
          92% { opacity: 0.35; }
          100% { transform: translate(320px, 2px); opacity: 0; }
        }

        .paw-print-top {
          animation: pawBorderTop 15s linear infinite;
        }
        .paw-print-bottom {
          animation: pawBorderBottom 15s linear infinite;
        }
        .cat-peeking {
          animation: catPeeking 12s ease-in-out infinite;
        }
        .dog-bone-float {
          animation: dogBoneDrift 8s ease-in-out infinite;
        }
        .pet-flying {
          animation: petFlying 20s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .pet-accent-animated {
            animation: none !important;
            display: none !important;
          }
        }
      ` }} />
      {type === 'paw-border' && (
        <>
          <div className="absolute pet-accent-animated paw-print-top" style={{ color }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
              <circle cx="2" cy="7" r="1.5" />
              <circle cx="6" cy="4" r="1.5" />
              <circle cx="10.5" cy="4" r="1.5" />
              <circle cx="14" cy="7" r="1.5" />
            </svg>
          </div>
          <div className="absolute pet-accent-animated paw-print-bottom" style={{ color }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M 8 12 C 5 10, 4 14, 8 15 C 12 14, 11 10, 8 12 Z" />
              <circle cx="2" cy="7" r="1.5" />
              <circle cx="6" cy="4" r="1.5" />
              <circle cx="10.5" cy="4" r="1.5" />
              <circle cx="14" cy="7" r="1.5" />
            </svg>
          </div>
        </>
      )}
      {type === 'cat-slide' && (
        <div className="absolute bottom-0 left-6 pet-accent-animated cat-peeking" style={{ color }}>
          <svg className="w-8 h-4" viewBox="0 0 32 16" fill="currentColor" opacity="0.25">
            <path d="M 4 16 L 10 2 Q 13 8, 16 16 Z" />
            <path d="M 20 16 L 26 2 Q 29 8, 32 16 Z" />
          </svg>
        </div>
      )}
      {type === 'dog-bone' && (
        <div className="absolute top-8 right-6 pet-accent-animated dog-bone-float" style={{ color }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25">
            <path d="M17 3a2.82 2.82 0 0 0-4 0L12 4l-1-1a2.82 2.82 0 0 0-4 0 2.82 2.82 0 0 0 0 4l.3.3a4.78 4.78 0 0 1 0 6.8l-.3.3a2.82 2.82 0 0 0 0 4 2.82 2.82 0 0 0 4 0l1-1 1 1a2.82 2.82 0 0 0 4 0 2.82 2.82 0 0 0 0-4l-.3-.3a4.78 4.78 0 0 1 0-6.8l.3-.3a2.82 2.82 0 0 0 0-4z" />
          </svg>
        </div>
      )}
      {type === 'pet-orbit' && (
        <div className="absolute top-1 left-0 pet-accent-animated pet-flying" style={{ color }}>
          <svg className="w-4.5 h-3" viewBox="0 0 18 12" fill="currentColor" opacity="0.25">
            <path d="M 0 4 Q 4 -1, 8 3 Q 12 -1, 16 4 Q 8 6, 0 4 Z" />
          </svg>
        </div>
      )}
    </div>
  );
};

// Activity Status Badge
function ActivityStatusBadge({ status, isDark }: { status: string; isDark?: boolean }) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: 'Nháp', bg: 'bg-slate-100/80', text: 'text-slate-650' },
    published: { label: 'Hoạt động', bg: 'bg-emerald-100/90', text: 'text-emerald-700' },
    completed: { label: 'Kết thúc', bg: 'bg-blue-100/90', text: 'text-blue-700' },
    cancelled: { label: 'Hủy', bg: 'bg-red-100/90', text: 'text-red-700' },
  };
  const config = configs[status] || configs.draft;

  return (
    <span className={cn(
      "text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm border border-black/5 shadow-sm",
      isDark ? "bg-white/10 text-white border-white/10" : cn(config.bg, config.text)
    )}>
      <span className={cn(
        "w-1 h-1 rounded-full animate-pulse",
        isDark ? "bg-white" : status === 'published' ? 'bg-emerald-500' : 'bg-current'
      )} />
      {config.label}
    </span>
  );
}

interface ActivityCardProps {
  activity: any;
  onJoinClick: (activity: any) => void;
  onFavoriteClick: (activity: any) => Promise<void>;
  onEditClick: (activity: any) => void;
  onDeleteClick: (activity: any) => void;
  canManage: boolean;
  onNavigateToDetail: (activityId: string) => void;
  onConfigureDesign?: (activity: any) => void;
  joinPending?: boolean;
}

export default function ActivityCard({
  activity,
  onJoinClick,
  onFavoriteClick,
  onEditClick,
  onDeleteClick,
  canManage,
  onNavigateToDetail,
  onConfigureDesign,
  joinPending = false,
}: ActivityCardProps) {
  const hasScheduleSummary = Array.isArray(activity.schedule_summary) && activity.schedule_summary.length > 0;
  const [scheduleSummary, setScheduleSummary] = useState<any[]>(hasScheduleSummary ? activity.schedule_summary : []);
  const [loadingSchedule, setLoadingSchedule] = useState(!hasScheduleSummary);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const currentUser = tokenStorage.getUser();
  const isStudent = currentUser?.role?.toLowerCase() === 'student';

  const { cardBgClass, accentColor, isCustomBg, customBgUrl, patternId, isDark } = getActivityBackgroundConfig(activity);

  useEffect(() => {
    const providedSummary = Array.isArray(activity.schedule_summary) ? activity.schedule_summary : [];
    if (providedSummary.length > 0) {
      setScheduleSummary(providedSummary);
      setLoadingSchedule(false);
      return;
    }

    setScheduleSummary([]);
    setLoadingSchedule(true);

    if (!activity._id) {
      setLoadingSchedule(false);
      return;
    }

    let isMounted = true;

    // Prioritize getActivityTimeline (no pagination limit) to avoid missing
    // current-week schedules when getAll's default limit (20) is exceeded
    // by older completed/cancelled entries.
    const fetchViaTimeline = activityScheduleApi
      && typeof activityScheduleApi.getActivityTimeline === 'function';
    const fetchViaGetAll = activityScheduleApi
      && typeof activityScheduleApi.getAll === 'function';

    if (fetchViaTimeline) {
      activityScheduleApi.getActivityTimeline(activity._id)
        .then((timeline: any) => {
          if (isMounted) {
            const timelineItems = Array.isArray(timeline)
              ? timeline
              : (timeline?.items || timeline?.data?.items || timeline?.result?.items || []);
            setScheduleSummary(getActivityScheduleSummary(timelineItems, activity._id));
          }
        })
        .catch(async (err: any) => {
          // Fallback to getAll with a high limit when timeline access is denied
          if (!isMounted || !fetchViaGetAll) {
            console.error('Error fetching activity timeline:', activity._id, err);
            return;
          }
          try {
            const res = await activityScheduleApi.getAll({
              activity_id: activity._id,
              limit: 100,
            });
            if (isMounted) {
              const schedulePayload = (res as any)?.data ?? res;
              const scheduleItems = Array.isArray(schedulePayload)
                ? schedulePayload
                : (schedulePayload?.items
                  || schedulePayload?.data?.items
                  || schedulePayload?.result?.items
                  || []);
              setScheduleSummary(getActivityScheduleSummary(scheduleItems, activity._id));
            }
          } catch (fallbackErr) {
            console.error('Error fetching schedules for activity:', activity._id, fallbackErr);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingSchedule(false);
        });
    } else if (fetchViaGetAll) {
      Promise.resolve(activityScheduleApi.getAll({ activity_id: activity._id, limit: 100 }))
        .then((res: any) => {
          if (isMounted) {
            const schedulePayload = res?.data ?? res;
            const scheduleItems = Array.isArray(schedulePayload)
              ? schedulePayload
              : (schedulePayload?.items
                || schedulePayload?.data?.items
                || schedulePayload?.result?.items
                || []);
            setScheduleSummary(getActivityScheduleSummary(scheduleItems, activity._id));
          }
        })
        .catch((err: any) => {
          console.error('Error fetching schedules for activity:', activity._id, err);
        })
        .finally(() => {
          if (isMounted) setLoadingSchedule(false);
        });
    } else {
      setLoadingSchedule(false);
    }

    return () => {
      isMounted = false;
    };
  }, [activity._id, activity.schedule_summary]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      await onFavoriteClick(activity);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const hasJoined = activity.membership_status === 'active';
  const isPending = activity.membership_status === 'pending';
  const isRejected = activity.membership_status === 'rejected';

  return (
    <div
      onClick={() => onNavigateToDetail(activity._id)}
      className={cn(
        "group relative bg-white backdrop-blur-md rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-slate-50/90 transition-all duration-300 flex flex-col min-h-[250px] cursor-pointer border p-4 justify-between gap-3.5 template-shine-effect select-none",
        cardBgClass
      )}
      style={{
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
        boxShadow: isDark
          ? `0 4px 20px -2px rgba(0,0,0,0.35)`
          : `0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)`,
      }}
    >
      {/* Corner Dots */}
      <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />
      <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />
      <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />
      <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full z-20 pointer-events-none transition-all duration-300" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${accentColor}50` }} />

      {/* Custom Background image fallback */}
      {customBgUrl && (
        <>
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${customBgUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              filter: 'blur(4.5px)',
            }}
          />
          <div className={cn("absolute inset-0 pointer-events-none z-0 bg-gradient-to-b", isDark ? "from-black/70 via-black/80 to-black/85" : "from-white/80 via-white/85 to-white/90")} />
        </>
      )}

      {/* SVG Pattern Overlay */}
      {patternId && (
        <div
          className="absolute inset-0 pointer-events-none opacity-65 z-0"
          style={getPatternStyle(patternId, accentColor)}
        />
      )}

      {/* Pet Accent Motion Layer */}
      <PetAccentLayer
        type={activity.background_config?.petAccentType}
        color={accentColor}
      />

      {/* Top badges and Favorite */}
      <div className="flex justify-between items-start gap-2 z-10">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={cn(
            "text-[9px] font-extrabold px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm border transition-all duration-300",
            isDark
              ? "bg-white/10 text-slate-200 border-white/10"
              : "bg-white/70 text-slate-800 border-slate-200/50"
          )}>
            {activityCategoryLabels[activity.category] || activity.category}
          </span>

          <ActivityStatusBadge status={activity.participation_status || 'published'} isDark={isDark} />

          <span className={cn(
            "text-[9px] font-mono font-bold tracking-wider transition-all duration-300",
            isDark ? "text-white/40" : "text-slate-400/80"
          )}>
            {activity.code}
          </span>
        </div>

        <button
          disabled={favoriteLoading}
          onClick={handleFavoriteClick}
          className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-pink-500 flex items-center justify-center backdrop-blur-sm shadow-sm border border-slate-100/50 active:scale-90 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {favoriteLoading ? (
            <span className="w-3.5 h-3.5 border border-pink-500 border-t-transparent rounded-full animate-spin" />
          ) : activity.is_favorited ? (
            <Heart size={13} className="fill-pink-500 text-pink-500" />
          ) : (
            <Heart size={13} className="transition-colors" />
          )}
        </button>
      </div>

      {/* Name and Code */}
      <div className="flex-1 flex flex-col justify-start min-w-0 z-10 mt-1">
        <h3 className={cn(
          "text-sm font-bold group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug",
          isDark ? "text-slate-100" : "text-slate-800"
        )}>
          {activity.name}
        </h3>
      </div>

      {/* Middle: Schedules & Location */}
      <div className={cn(
        "space-y-1.5 text-xs font-semibold w-full z-10 my-1",
        isDark ? "text-slate-300" : "text-slate-700"
      )}>
        {/* Schedule rows */}
        {loadingSchedule ? (
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-[10px] text-slate-400">Đang tải lịch...</span>
          </div>
        ) : scheduleSummary && scheduleSummary.length > 0 ? (
          <div className="space-y-1">
            {scheduleSummary.slice(0, 2).map((row, idx) => (
              <div key={idx} className="flex items-start gap-1.5 py-0.5">
                <Clock size={12} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className={cn(
                    "block text-[11px] font-bold leading-normal break-words",
                    isDark ? "text-slate-200" : "text-slate-850"
                  )} title={`${row.weekdays.join(', ')}: ${row.timeRange}`}>
                    {row.weekdays.join(', ')}: {row.timeRange}
                  </span>
                </div>
              </div>
            ))}
            {scheduleSummary.length > 2 && (
              <div className="text-[10px] text-slate-400 font-bold pl-3.5">
                + {scheduleSummary.length - 2} ngày khác
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-0.5">
            <Clock size={12} className="text-blue-500 shrink-0" />
            <span className={cn(
              "text-[11px] font-bold",
              isDark ? "text-slate-200" : "text-slate-800"
            )}>Chưa xếp lịch</span>
          </div>
        )}

        {/* Location / Classroom */}
        <div className="flex items-center gap-1.5 py-0.5">
          <MapPin size={12} className="text-amber-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className={cn(
              "block text-[11px] font-bold truncate",
              isDark ? "text-slate-200" : "text-slate-800"
            )} title={activity.classroom}>
              {activity.classroom || 'Chưa xếp phòng'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom stats and Actions */}
      <div className={cn(
        "flex items-center justify-between gap-2 z-10 border-t pt-2.5 mt-auto",
        isDark ? "border-white/15" : "border-slate-100/50"
      )}>
        {/* Stats */}
        <div className={cn(
          "flex items-center gap-2 text-xs font-semibold shrink-0",
          isDark ? "text-slate-400" : "text-slate-500"
        )}>
          <div className="flex items-center gap-1" title={`${activity.active_members_count ?? 0} thành viên`}>
            <Users size={12} className="text-slate-400 shrink-0" />
            <span className={cn(
              "text-[11px] font-bold",
              isDark ? "text-slate-300" : "text-slate-700"
            )}>{activity.active_members_count ?? 0}/{activity.max_members ?? '∞'}</span>
          </div>
          <div className="flex items-center gap-1" title={`${activity.favorite_count || 0} lượt yêu thích`}>
            <Heart size={12} className={activity.is_favorited ? "fill-pink-500 text-pink-500 shrink-0" : "text-slate-400 shrink-0"} />
            <span className={cn(
              "text-[11px] font-bold",
              isDark ? "text-slate-300" : "text-slate-600"
            )}>{activity.favorite_count || 0}</span>
          </div>
        </div>

        {/* Actions button */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const rawStatus = activity.membership_status;
            const status = ['none', 'pending', 'active', 'rejected'].includes(rawStatus)
              ? rawStatus
              : 'none';
            const btnConfig = getStateButtonConfig(activity, status as any);

            if (status === 'none') {
              return (
                <Button
                  disabled={joinPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    onJoinClick(activity);
                  }}
                  className={cn("h-7 px-2.5 text-[10px] font-black cursor-pointer shadow-sm border-0 disabled:opacity-50 disabled:cursor-not-allowed", btnConfig.bgClass, btnConfig.textClass)}
                >
                  {joinPending ? "Đang xử lý..." : "Đăng ký"}
                </Button>
              );
            }

            if (status === 'pending') {
              return (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-0.5 cursor-default select-none opacity-60 cursor-not-allowed", btnConfig.bgClass, btnConfig.textClass)}
                >
                  Chờ duyệt
                </span>
              );
            }

            if (status === 'active') {
              return (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-0.5 cursor-default select-none opacity-80", btnConfig.bgClass, btnConfig.textClass)}
                >
                  Đã tham gia
                </span>
              );
            }

            return (
              <span
                className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-0.5", btnConfig.bgClass, btnConfig.textClass)}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                {status === 'rejected' && <AlertCircle size={10} />}
                {btnConfig.label}
              </span>
            );
          })()}

          {canManage && (
            <div className="flex items-center gap-1">
              {onConfigureDesign && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigureDesign(activity);
                  }}
                  className="h-7 w-7 p-0 border border-slate-200 text-slate-650 hover:bg-slate-50 bg-white/70 backdrop-blur-sm rounded-lg cursor-pointer shrink-0 mr-1 flex items-center justify-center"
                  title="Thiết kế thẻ"
                  data-testid="configure-design-button"
                >
                  <Palette size={13} />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
