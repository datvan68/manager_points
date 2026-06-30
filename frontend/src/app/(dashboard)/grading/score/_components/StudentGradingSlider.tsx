"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Loader2,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { StudentData } from "../_types";

const NormalStudentSliderCard = React.memo(({
  student,
  isActive,
  isDirty,
  isSaving,
  onClick,
  virtualItem,
  measureElement,
  getInitials,
  renderGradingStatusBadge,
  isAutoSaveEnabled
}: any) => {
  const initials = getInitials(student.name);

  return (
    <div
      ref={measureElement}
      data-index={virtualItem.index}
      style={{
        position: 'absolute',
        top: 0,
        left: `${virtualItem.start}px`,
        height: '100%',
      }}
      className="pr-4"
    >
      <div
        id={`student-card-${student.id}`}
        onClick={() => onClick(student.id)}
        className={`relative cursor-pointer transition-[background-color,border-color,box-shadow,transform] duration-200 select-none flex items-center shrink-0 rounded-2xl p-[13px] w-[256px] gap-[12px] border-2 bg-white/55 backdrop-blur-sm shadow-sm ${
          isActive
            ? "border-[#1A73E8] bg-white/80 shadow-[0px_4px_16px_rgba(26,115,232,0.08)] scale-[1.015]"
            : "border-white hover:border-slate-300/40 hover:scale-[1.01]"
        }`}
      >
        {/* Avatar container */}
        <div className="relative shrink-0 rounded-full w-12 h-12">
          {student.avatarUrl ? (
            <div className="absolute inset-0 rounded-full overflow-hidden border border-white/80 ring-2 ring-white">
              <img
                alt={student.name}
                className="object-cover w-full h-full"
                src={student.avatarUrl}
              />
            </div>
          ) : (
            <div
              className={`absolute inset-0 rounded-full flex items-center justify-center font-bold border border-white/80 ring-2 ring-white text-[15px] ${student.colorTheme?.bg} ${student.colorTheme?.text}`}
            >
              {initials}
            </div>
          )}

          {/* Active Badge Checkmark */}
          {isActive && (
            <div className="absolute -bottom-1 -right-1 bg-[#1A73E8] text-white border-2 border-white rounded-lg w-5 h-5 flex items-center justify-center shadow-md">
              <Check size={11} strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Student Info & Realtime Progress */}
        <div className="flex-1 min-w-0 flex flex-col">
          <h4
            className="font-bold text-[#1E293B] text-[14.5px] truncate"
            title={student.name}
          >
            {student.name}
          </h4>
          
          <div className="flex items-center justify-between mt-0.5 w-full min-w-0">
            <span className="text-[#64748B] text-[11px] font-medium truncate">
              MSSV: {student.studentCode || student.id}
            </span>
            {renderGradingStatusBadge(student.gradingStatus)}
          </div>

          {/* Realtime progress bar */}
          <div className="flex gap-2.5 items-center mt-1.5">
            <div className="bg-[#EBF2FA] flex-1 h-[5px] rounded-lg overflow-hidden border border-white/20">
              <div
                style={{ width: `${student.score}%`, transition: 'width 0.3s ease' }}
                className="bg-[#1A73E8] h-full rounded-lg"
              />
            </div>
            <span className="font-bold text-[#1A73E8] text-[9.5px] tracking-wide shrink-0 flex items-center gap-1">
              {student.score}/100
              <div className="w-[11px] h-[11px] flex items-center justify-center shrink-0">
                {isSaving ? (
                  <Loader2 size={11} className="animate-spin text-amber-500" />
                ) : isDirty ? (
                  isAutoSaveEnabled ? (
                    <Loader2 size={11} className="animate-spin text-amber-500" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Có thay đổi chưa lưu thủ công" />
                  )
                ) : isAutoSaveEnabled ? (
                  <CheckCircle2 size={11} className="text-emerald-500" />
                ) : null}
              </div>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

NormalStudentSliderCard.displayName = "NormalStudentSliderCard";

const StickyStudentSliderCard = React.memo(({
  student,
  isActive,
  isDirty,
  isSaving,
  onClick,
  virtualItem,
  measureElement,
  getInitials,
  isAutoSaveEnabled
}: any) => {
  const initials = getInitials(student.name);

  return (
    <div
      ref={measureElement}
      data-index={virtualItem.index}
      style={{
        position: 'absolute',
        top: 0,
        left: `${virtualItem.start}px`,
        height: '100%',
      }}
      className="pr-4"
    >
      <div
        id={`student-card-sticky-${student.id}`}
        onClick={() => onClick(student.id)}
        className={`relative cursor-pointer transition-[background-color,border-color,box-shadow] duration-150 select-none flex items-center shrink-0 rounded-xl p-1.5 px-3 gap-2 h-9 w-max min-w-[220px] max-w-[240px] border ${
          isActive
            ? "border-[#1A73E8] bg-white/72 backdrop-blur-sm shadow-[0_0_0_2px_rgba(26,115,232,0.22),0_8px_22px_rgba(26,115,232,0.16)]"
            : "border-white/55 bg-white/45 shadow-sm hover:border-[#1A73E8]/30"
        }`}
      >
        {/* Avatar container */}
        <div className="relative shrink-0 rounded-full w-6 h-6">
          {student.avatarUrl ? (
            <div className="absolute inset-0 rounded-full overflow-hidden border border-white/80 ring-1 ring-white">
              <img
                alt={student.name}
                className="object-cover w-full h-full"
                src={student.avatarUrl}
              />
            </div>
          ) : (
            <div
              className={`absolute inset-0 rounded-full flex items-center justify-center font-bold border border-white/80 ring-1 ring-white text-[10px] ${student.colorTheme?.bg} ${student.colorTheme?.text}`}
            >
              {initials}
            </div>
          )}

          {/* Active Badge Checkmark */}
          {isActive && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-[#1A73E8] text-white border border-white rounded-full w-3 h-3 flex items-center justify-center shadow-sm">
              <Check size={8} strokeWidth={2} />
            </div>
          )}
        </div>

        {/* Student Info & Realtime Progress */}
        <div className="flex-1 min-w-0 flex flex-row items-center gap-2 justify-between">
          <h4
            className="font-bold text-[#1E293B] text-[13px] whitespace-nowrap truncate max-w-[110px]"
            title={student.name}
          >
            {student.name}
          </h4>
          
          {/* Realtime progress bar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-bold text-[11px] tracking-wide px-1.5 py-0.5 rounded-md border border-transparent bg-[#DFF3FF] text-[#0B74DE]">
              {student.score}
            </span>
            <div className="w-3 h-3 flex items-center justify-center shrink-0">
              {isSaving ? (
                <Loader2 size={12} className="animate-spin text-[#F59E0B]" />
              ) : isDirty ? (
                isAutoSaveEnabled ? (
                  <Loader2 size={12} className="animate-spin text-[#F59E0B]" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Có thay đổi chưa lưu thủ công" />
                )
              ) : isAutoSaveEnabled ? (
                <CheckCircle2 size={12} className="text-emerald-500" />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

StickyStudentSliderCard.displayName = "StickyStudentSliderCard";

interface StudentGradingSliderProps {
  students: StudentData[];
  activeStudentId: string;
  dirtyStudentIds: Set<string>;
  savingStudentIds: Set<string>;
  isInitialLoading: boolean;
  isRosterLoading: boolean;
  selectedClassId: string;
  apiClasses: any[];
  isAdminOrSupervisor: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onClassChange: (classId: string) => void;
  onActiveStudentChange: (studentId: string) => void;
  onOpenDeleteModal: () => void;
  renderGradingStatusBadge: (status: string) => React.ReactNode;
  isAutoSaveEnabled?: boolean;
  canToggleAutosave?: boolean;
  onToggleAutosave?: (enabled: boolean) => void;
}

export const StudentGradingSlider: React.FC<StudentGradingSliderProps> = React.memo(({
  students,
  activeStudentId,
  dirtyStudentIds,
  savingStudentIds,
  isInitialLoading,
  isRosterLoading,
  selectedClassId,
  apiClasses,
  isAdminOrSupervisor,
  scrollContainerRef,
  onClassChange,
  onActiveStudentChange,
  onOpenDeleteModal,
  renderGradingStatusBadge,
  isAutoSaveEnabled = true,
  canToggleAutosave = false,
  onToggleAutosave,
}) => {
  // Roster Search state
  const [rosterSearch, setRosterSearch] = useState("");

  // Reset search when class changes
  useEffect(() => {
    setRosterSearch("");
  }, [selectedClassId]);

  // Normal and Sticky slider DOM references
  const normalSliderRef = useRef<HTMLDivElement>(null);
  const stickySliderRef = useRef<HTMLDivElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const savedScrollLeftRef = useRef<number>(0);
  const revealReasonRef = useRef<"initial-load" | "student-click" | null>(null);
  const hasScrolledInitialRef = useRef(false);
  const prevActiveStudentIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!hasScrolledInitialRef.current && students.length > 0 && activeStudentId) {
      revealReasonRef.current = "initial-load";
      hasScrolledInitialRef.current = true;
    }
  }, [students, activeStudentId]);

  // Measured normal slider height
  const [normalSliderHeight, setNormalSliderHeight] = useState<number | undefined>(undefined);

  // Sticky state variables
  const [isStudentSliderSticky, setIsStudentSliderSticky] = useState(false);
  const [animateSticky, setAnimateSticky] = useState(false);
  const [showStickyStudents, setShowStickyStudents] = useState(false);
  const [hasStickyBeenActivated, setHasStickyBeenActivated] = useState(false);

  const mountTimerRef = useRef<any>(null);
  const idleCallbackRef = useRef<any>(null);

  // Drag to scroll refs & handlers
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const createDragHandlers = (ref: React.RefObject<HTMLDivElement | null>) => {
    const handleMouseDown = (e: React.MouseEvent) => {
      if (!ref.current) return;
      isDownRef.current = true;
      ref.current.classList.remove("scroll-smooth", "cursor-grab");
      ref.current.classList.add("scroll-auto", "cursor-grabbing");
      startXRef.current = e.pageX - ref.current.offsetLeft;
      scrollLeftRef.current = ref.current.scrollLeft;
    };

    const handleMouseUpOrLeave = () => {
      isDownRef.current = false;
      if (ref.current) {
        ref.current.classList.remove("scroll-auto", "cursor-grabbing");
        ref.current.classList.add("scroll-smooth", "cursor-grab");
      }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDownRef.current || !ref.current) return;
      e.preventDefault();
      const x = e.pageX - ref.current.offsetLeft;
      const walk = (x - startXRef.current) * 1.5;
      ref.current.scrollLeft = scrollLeftRef.current - walk;
    };

    return {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUpOrLeave,
      onMouseLeave: handleMouseUpOrLeave,
      onMouseMove: handleMouseMove,
    };
  };

  const normalDragHandlers = useMemo(() => createDragHandlers(normalSliderRef), []);
  const stickyDragHandlers = useMemo(() => createDragHandlers(stickySliderRef), []);

  // Filter students based on rosterSearch
  const filteredStudentsForRoster = useMemo(() => {
    let list = students;
    if (rosterSearch) {
      const searchLower = rosterSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.id.toLowerCase().includes(searchLower) ||
          (s.studentCode && s.studentCode.toLowerCase().includes(searchLower))
      );
    }
    return list;
  }, [students, rosterSearch]);

  const activeStudentIndex = useMemo(() => {
    return filteredStudentsForRoster.findIndex(s => s.id === activeStudentId);
  }, [filteredStudentsForRoster, activeStudentId]);

  // Virtualizer setup
  const normalStudentVirtualizer = useVirtualizer({
    horizontal: true,
    count: filteredStudentsForRoster.length,
    getScrollElement: () => normalSliderRef.current,
    estimateSize: () => 272,
    overscan: 5,
  });

  const stickyStudentVirtualizer = useVirtualizer({
    horizontal: true,
    count: filteredStudentsForRoster.length,
    getScrollElement: () => stickySliderRef.current,
    estimateSize: () => 240,
    overscan: 5,
  });

  const normalStudentVirtualizerRef = useRef(normalStudentVirtualizer);
  normalStudentVirtualizerRef.current = normalStudentVirtualizer;

  const stickyStudentVirtualizerRef = useRef(stickyStudentVirtualizer);
  stickyStudentVirtualizerRef.current = stickyStudentVirtualizer;

  useEffect(() => {
    const reason = revealReasonRef.current;
    if (activeStudentIndex !== -1 && reason && normalStudentVirtualizerRef.current) {
      if (!isStudentSliderSticky) {
        const behavior = reason === "initial-load" ? "auto" : "smooth";
        normalStudentVirtualizerRef.current.scrollToIndex(activeStudentIndex, { align: "center", behavior });
        revealReasonRef.current = null;
      } else {
        normalStudentVirtualizerRef.current.scrollToIndex(activeStudentIndex, { align: "center", behavior: "auto" });
        requestAnimationFrame(() => {
          if (normalSliderRef.current) {
            savedScrollLeftRef.current = normalSliderRef.current.scrollLeft;
          }
        });
        revealReasonRef.current = null;
      }
    }
  }, [activeStudentIndex, isStudentSliderSticky]);

  useLayoutEffect(() => {
    if (!isStudentSliderSticky && normalSliderRef.current) {
      const normal = normalSliderRef.current;
      const targetScrollLeft = savedScrollLeftRef.current;
      const originalScrollBehavior = normal.style.scrollBehavior;
      normal.style.scrollBehavior = "auto";
      normal.scrollLeft = targetScrollLeft;
      normal.style.scrollBehavior = originalScrollBehavior;
    }
  }, [isStudentSliderSticky]);

  // Scroll sticky slider to active student
  useEffect(() => {
    if (activeStudentIndex !== -1 && isStudentSliderSticky && showStickyStudents && stickyStudentVirtualizerRef.current) {
      const timer = setTimeout(() => {
        stickyStudentVirtualizerRef.current?.scrollToIndex(activeStudentIndex, { align: "center", behavior: "auto" });
      }, 150); // delay to let sticky transition settle
      return () => clearTimeout(timer);
    }
  }, [activeStudentIndex, isStudentSliderSticky, showStickyStudents]);

  // Calculate initials helper
  const getInitials = useCallback((name: string) => {
    if (!name) return "SV";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[parts.length - 2].charAt(0).toUpperCase();
      const last = parts[parts.length - 1].charAt(0).toUpperCase();
      return `${first}${last}`;
    }
    return name.slice(0, 2).toUpperCase();
  }, []);

  const handleStudentClick = useCallback((studentId: string) => {
    revealReasonRef.current = "student-click";
    onActiveStudentChange(studentId);
  }, [onActiveStudentChange]);

  // Normal slider navigation buttons
  const scrollSlider = (direction: "left" | "right") => {
    if (normalSliderRef.current) {
      const scrollAmount = 300;
      normalSliderRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Measure initial slider height
  useEffect(() => {
    if (isStudentSliderSticky || !sliderContainerRef.current) return;

    const updateHeight = () => {
      if (sliderContainerRef.current) {
        const height = sliderContainerRef.current.offsetHeight;
        // Clamp height between 120 and 320 to avoid anomalies
        const clampedHeight = Math.max(120, Math.min(320, height));
        setNormalSliderHeight(clampedHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateHeight);
    });

    resizeObserver.observe(sliderContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [isStudentSliderSticky, students, rosterSearch, isInitialLoading, isRosterLoading, selectedClassId]);

  const isStickyRef = useRef(false);

  // Monitor sliderContainer scroll position relative to root container to apply sticky state with hysteresis
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const slider = sliderContainerRef.current;
          if (!slider) {
            ticking = false;
            return;
          }

          const rootRect = root.getBoundingClientRect();
          const sliderRect = slider.getBoundingClientRect();
          
          // Calculate relative positions
          const relativeTop = sliderRect.top - rootRect.top;
          const relativeBottom = sliderRect.bottom - rootRect.top;
          const currentSticky = isStickyRef.current;

          // Apply hysteresis:
          // Turn sticky ON when slider bottom scrolls past root top (relativeBottom <= 0)
          // Turn sticky OFF when slider top scrolls back (relativeTop >= -12)
          if (!currentSticky && relativeBottom <= 0) {
            if (normalSliderRef.current) {
              savedScrollLeftRef.current = normalSliderRef.current.scrollLeft;
            }
            isStickyRef.current = true;
            setIsStudentSliderSticky(true);
            revealReasonRef.current = null;
          } else if (currentSticky && relativeTop >= -12) {
            isStickyRef.current = false;
            setIsStudentSliderSticky(false);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    // Run once initially to sync state
    handleScroll();

    root.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      root.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [scrollContainerRef, students, rosterSearch, isInitialLoading, isRosterLoading, selectedClassId]);

  // Manage sticky stages with idle scheduling and persistent mounting
  useEffect(() => {
    if (isStudentSliderSticky) {
      setHasStickyBeenActivated(true);
      
      const raf = requestAnimationFrame(() => {
        setAnimateSticky(true);
      });

      if (!showStickyStudents) {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          idleCallbackRef.current = (window as any).requestIdleCallback(() => {
            setShowStickyStudents(true);
          }, { timeout: 200 });
        } else {
          mountTimerRef.current = setTimeout(() => {
            setShowStickyStudents(true);
          }, 160);
        }
      }

      return () => {
        cancelAnimationFrame(raf);
        if (idleCallbackRef.current && typeof window !== "undefined" && "cancelIdleCallback" in window) {
          (window as any).cancelIdleCallback(idleCallbackRef.current);
        }
        if (mountTimerRef.current) {
          clearTimeout(mountTimerRef.current);
        }
      };
    } else {
      setAnimateSticky(false);
      isDownRef.current = false; // Reset drag state when leaving sticky mode
      if (mountTimerRef.current) {
        clearTimeout(mountTimerRef.current);
      }
      if (idleCallbackRef.current && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleCallbackRef.current);
      }
    }
  }, [isStudentSliderSticky, showStickyStudents]);

  return (
    <>
      {/* Sentinel indicator target for IntersectionObserver / scroll listener */}
      <div className="relative w-full h-0 pointer-events-none" aria-hidden="true">
        <div ref={sentinelRef} className="absolute top-0 w-full h-[1px]" />
      </div>

      {/* Normal Student Slider */}
      <div
        className="relative"
        style={{
          visibility: isStudentSliderSticky ? "hidden" : "visible",
          pointerEvents: isStudentSliderSticky ? "none" : "auto",
          height: isStudentSliderSticky ? (normalSliderHeight ? `${normalSliderHeight}px` : "148px") : "auto",
          overflow: isStudentSliderSticky ? "hidden" : "visible",
        }}
      >
        <div
          ref={sliderContainerRef}
          className="shrink-0 flex flex-col relative overflow-hidden pointer-events-auto bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-5 shadow-sm shadow-slate-300/40 gap-4 transition-[background-color,border-color,box-shadow] duration-200"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 min-w-0">
              <h3 className="font-sans font-bold text-[#64748B] text-[11px] tracking-[1px] uppercase shrink-0">
                Sinh viên đang chấm điểm
              </h3>
              <div className="relative w-full md:w-[220px]">
                <Select
                  value={selectedClassId || undefined}
                  onValueChange={onClassChange}
                  disabled={isRosterLoading || apiClasses.length === 0}
                >
                  <SelectTrigger className="h-8 bg-white/70 border-slate-200 text-xs font-semibold">
                    <SelectValue placeholder={isRosterLoading ? "Đang tải..." : "Chọn lớp"} />
                  </SelectTrigger>
                  <SelectContent>
                    {apiClasses.map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.class_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1 max-w-[240px]">
                <input
                  type="text"
                  placeholder="Tìm MSSV hoặc tên..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/70 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A73E8]"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* Switch Toggle Tự động lưu */}
              <div className="flex items-center gap-1.5 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => canToggleAutosave && onToggleAutosave?.(!isAutoSaveEnabled)}
                  disabled={!canToggleAutosave}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    !canToggleAutosave 
                      ? "bg-slate-50 border-slate-100/50 text-slate-400 cursor-not-allowed opacity-60" 
                      : isAutoSaveEnabled
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:border-slate-350"
                  }`}
                  title={canToggleAutosave ? "Bật/Tắt tự động lưu" : "Chỉ Admin mới có quyền bật/tắt Tự động lưu"}
                >
                  {isAutoSaveEnabled ? (
                    <ToggleRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Tự động lưu</span>
                </button>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {isAdminOrSupervisor && (
                <button
                  onClick={onOpenDeleteModal}
                  className="w-8 h-8 rounded-xl bg-rose-50 backdrop-blur-sm border border-rose-100 flex items-center justify-center text-rose-550 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer shadow-sm hover:scale-[1.05]"
                  title="Xóa bảng điểm"
                >
                  <Trash2 size={15} strokeWidth={2.5} />
                </button>
              )}
              <button
                onClick={() => scrollSlider("left")}
                className="w-8 h-8 rounded-xl bg-white/50 backdrop-blur-sm border border-white/80 flex items-center justify-center text-[#64748B] hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-sm hover:scale-[1.05]"
                title="Trượt sang trái"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => scrollSlider("right")}
                className="w-8 h-8 rounded-xl bg-white/50 backdrop-blur-sm border border-white/80 flex items-center justify-center text-[#64748B] hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-sm hover:scale-[1.05]"
                title="Trượt sang phải"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div
            ref={normalSliderRef}
            onMouseDown={normalDragHandlers.onMouseDown}
            onMouseUp={normalDragHandlers.onMouseUp}
            onMouseLeave={normalDragHandlers.onMouseUp}
            onMouseMove={normalDragHandlers.onMouseMove}
            className="flex gap-4 overflow-x-auto pl-1 pr-10 custom-scrollbar scroll-smooth cursor-grab select-none py-2.5"
          >
            {isInitialLoading || isRosterLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={`skel-hero-${idx}`}
                  className="flex items-center shrink-0 animate-pulse w-[256px] h-[83px] rounded-2xl p-3.5 gap-3 bg-white/50 backdrop-blur-sm border border-white/60"
                >
                  <Skeleton className="rounded-full bg-slate-100 shrink-0 animate-pulse w-12 h-12" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/4 bg-slate-100 rounded" />
                    <Skeleton className="h-3.5 w-1/2 bg-slate-100 rounded" />
                  </div>
                </div>
              ))
            ) : filteredStudentsForRoster.length === 0 ? (
              <div className="flex-1 py-6 flex flex-col items-center justify-center text-center text-[#64748B] font-medium text-[13.5px] border border-dashed border-slate-300/60 rounded-2xl bg-white/40 select-none">
                {!selectedClassId
                  ? "Vui lòng chọn lớp học để xem danh sách sinh viên."
                  : students.length === 0 
                    ? "Lớp này chưa có sinh viên."
                    : "Không tìm thấy sinh viên nào khớp với bộ lọc."}
              </div>
            ) : (
              <div
                style={{
                  height: "109px",
                  width: `${normalStudentVirtualizer.getTotalSize()}px`,
                  position: "relative",
                }}
              >
                {normalStudentVirtualizer.getVirtualItems().map((virtualItem) => {
                  const student = filteredStudentsForRoster[virtualItem.index];
                  const isActive = student.id === activeStudentId;
                  const isDirty = dirtyStudentIds.has(student.id);
                  const isSaving = savingStudentIds.has(student.id);

                  return (
                    <NormalStudentSliderCard
                      key={student.id || `student-card-${virtualItem.index}`}
                      student={student}
                      isActive={isActive}
                      isDirty={isDirty}
                      isSaving={isSaving}
                      onClick={handleStudentClick}
                      virtualItem={virtualItem}
                      measureElement={normalStudentVirtualizer.measureElement}
                      getInitials={getInitials}
                      renderGradingStatusBadge={renderGradingStatusBadge}
                      isAutoSaveEnabled={isAutoSaveEnabled}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent Mounted Sticky Slider Shell */}
      {hasStickyBeenActivated && (
        <div 
          className={`sticky -top-6 -mx-6 md:-mx-8 z-30 w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] transition-[opacity,visibility] duration-150 ease-out ${
            isStudentSliderSticky 
              ? "pointer-events-none" 
              : "pointer-events-none opacity-0 invisible h-0 overflow-hidden"
          }`}
        >
          <div
            className={`shrink-0 flex flex-col relative overflow-hidden pointer-events-auto pt-2 px-6 md:px-8 pb-2 bg-[#D9F4FF] border-b border-[#A8DAEC] shadow-[0_2px_8px_rgba(37,99,235,0.10)] rounded-b-2xl transform transition-[transform,opacity] duration-[180ms] ease-out ${
              animateSticky && isStudentSliderSticky ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            }`}
            style={{ height: "56px" }}
          >
            {showStickyStudents ? (
              <div
                ref={stickySliderRef}
                onMouseDown={stickyDragHandlers.onMouseDown}
                onMouseUp={stickyDragHandlers.onMouseUp}
                onMouseLeave={stickyDragHandlers.onMouseUp}
                onMouseMove={stickyDragHandlers.onMouseMove}
                className="flex gap-4 overflow-x-auto pl-1 pr-10 sticky-slider-scrollbar-none scroll-smooth cursor-grab select-none pt-1 pb-1 h-full items-center"
              >
                {isInitialLoading || isRosterLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={`skel-hero-sticky-${idx}`}
                      className="flex items-center shrink-0 animate-pulse min-w-[220px] h-9 rounded-xl p-1.5 px-3 gap-2 bg-white border border-slate-200/80"
                    >
                      <Skeleton className="rounded-full bg-slate-100 shrink-0 animate-pulse w-6 h-6" />
                      <div className="flex-1 flex flex-row items-center gap-2">
                        <Skeleton className="h-3 w-16 bg-slate-100 rounded" />
                      </div>
                    </div>
                  ))
                ) : filteredStudentsForRoster.length === 0 ? (
                  <div className="text-slate-400 text-xs py-1">Không có sinh viên</div>
                ) : (
                  <div
                    style={{
                      height: "36px",
                      width: `${stickyStudentVirtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {stickyStudentVirtualizer.getVirtualItems().map((virtualItem) => {
                      const student = filteredStudentsForRoster[virtualItem.index];
                      const isActive = student.id === activeStudentId;
                      const isDirty = dirtyStudentIds.has(student.id);
                      const isSaving = savingStudentIds.has(student.id);

                      return (
                        <StickyStudentSliderCard
                          key={`sticky-student-card-${student.id || virtualItem.index}`}
                          student={student}
                          isActive={isActive}
                          isDirty={isDirty}
                          isSaving={isSaving}
                          onClick={handleStudentClick}
                          virtualItem={virtualItem}
                          measureElement={stickyStudentVirtualizer.measureElement}
                          getInitials={getInitials}
                          isAutoSaveEnabled={isAutoSaveEnabled}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Temporary skeleton while rendering the list in idle state */
              <div className="flex gap-4 pl-1 pr-10 items-center h-full opacity-50">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={`placeholder-sticky-${idx}`}
                    className="flex items-center shrink-0 min-w-[220px] h-9 rounded-xl p-1.5 px-3 gap-2 bg-white border border-slate-200/50"
                  >
                    <div className="rounded-full bg-slate-100 shrink-0 w-6 h-6 animate-pulse" />
                    <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

StudentGradingSlider.displayName = "StudentGradingSlider";
