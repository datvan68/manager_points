'use client';
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeSelect: (start: Date, end: Date) => void;
  onRangeConfirm?: (start: Date, end: Date | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  minDate?: Date;
  maxDate?: Date;
  defaultViewDate?: Date;
  monthOnly?: boolean;
  monthValue?: string;
  onMonthSelect?: (month: string) => void;
  mode?: 'single' | 'range';
  showPresets?: boolean;
  isMobileView?: boolean;
}

interface CalendarDayItem {
  day: number;
  monthOffset: -1 | 0 | 1;
  date: Date;
}

export function CustomCalendar({
  startDate,
  endDate,
  onRangeSelect,
  onRangeConfirm,
  onCancel,
  onConfirm,
  minDate,
  maxDate,
  defaultViewDate,
  monthOnly = false,
  monthValue,
  onMonthSelect,
  mode = 'range',
  showPresets,
  isMobileView = false,
}: CustomCalendarProps) {
  const initialViewDate = startDate || defaultViewDate || new Date();
  const [currentDate, setCurrentDate] = React.useState(initialViewDate);
  const [tempStart, setTempStart] = React.useState<Date | null>(startDate);
  const [tempEnd, setTempEnd] = React.useState<Date | null>(mode === 'single' ? null : endDate);
  const [direction, setDirection] = React.useState(0);
  const [view, setView] = React.useState<'days' | 'months' | 'years'>('days');
  const [yearGridStart, setYearGridStart] = React.useState(initialViewDate.getFullYear() - 4);

  // Sync date when startDate/endDate prop changes
  React.useEffect(() => {
    if (monthOnly && monthValue) {
      const parsed = new Date(`${monthValue}-01T00:00:00`);
      setCurrentDate(parsed);
      setTempStart(parsed);
      setTempEnd(null);
      setYearGridStart(parsed.getFullYear() - 4);
      return;
    }
    if (startDate) {
      setCurrentDate(startDate);
      setTempStart(startDate);
      setYearGridStart(startDate.getFullYear() - 4);
    } else {
      setTempStart(null);
      const fallback = defaultViewDate || new Date();
      setCurrentDate(fallback);
      setYearGridStart(fallback.getFullYear() - 4);
    }
    if (mode === 'single') {
      setTempEnd(null);
    } else if (endDate) {
      setTempEnd(endDate);
    } else {
      setTempEnd(null);
    }
  }, [startDate, endDate, monthOnly, monthValue, mode, defaultViewDate]);

  const daysOfWeek = [
    { label: 'T2', isWeekend: false },
    { label: 'T3', isWeekend: false },
    { label: 'T4', isWeekend: false },
    { label: 'T5', isWeekend: false },
    { label: 'T6', isWeekend: false },
    { label: 'T7', isWeekend: true },
    { label: 'CN', isWeekend: true },
  ];

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDayOffset = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
  const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();

  const generateDays = (): CalendarDayItem[] => {
    const days: CalendarDayItem[] = [];

    // Prefix days from previous month
    for (let i = startDayOffset - 1; i >= 0; i--) {
      const day = prevMonthLastDate - i;
      days.push({
        day,
        monthOffset: -1,
        date: new Date(currentYear, currentMonth - 1, day),
      });
    }

    // Days for current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        monthOffset: 0,
        date: new Date(currentYear, currentMonth, i),
      });
    }

    // Suffix days for next month to complete row grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        monthOffset: 1,
        date: new Date(currentYear, currentMonth + 1, i),
      });
    }

    return days;
  };

  const isDateDisabled = (date: Date) => {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    if (minDate) {
      const min = new Date(minDate);
      min.setHours(0, 0, 0, 0);
      if (target < min) return true;
    }
    if (maxDate) {
      const max = new Date(maxDate);
      max.setHours(0, 0, 0, 0);
      if (target > max) return true;
    }
    return false;
  };

  const handleDayClick = (dayItem: CalendarDayItem) => {
    if (isDateDisabled(dayItem.date)) return;

    // If clicking a day from adjacent month, switch month
    if (dayItem.monthOffset !== 0) {
      setDirection(dayItem.monthOffset);
      setCurrentDate(new Date(dayItem.date.getFullYear(), dayItem.date.getMonth(), 1));
    }

    const selected = new Date(dayItem.date);
    selected.setHours(0, 0, 0, 0);

    if (mode === 'single') {
      setTempStart(selected);
      setTempEnd(null);
      return;
    }

    let currentTempStart = tempStart ? new Date(tempStart) : null;
    let currentTempEnd = tempEnd ? new Date(tempEnd) : null;
    if (currentTempStart) currentTempStart.setHours(0, 0, 0, 0);
    if (currentTempEnd) currentTempEnd.setHours(0, 0, 0, 0);

    if (!currentTempStart || (currentTempStart && currentTempEnd)) {
      setTempStart(selected);
      setTempEnd(null);
    } else if (currentTempStart && !currentTempEnd) {
      if (selected.getTime() < currentTempStart.getTime()) {
        setTempEnd(currentTempStart);
        setTempStart(selected);
      } else {
        setTempEnd(selected);
      }
    }
  };

  const handleSelectToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setTempStart(today);
    setTempEnd(null);
  };

  const handleSelectYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    setCurrentDate(new Date(yesterday.getFullYear(), yesterday.getMonth(), 1));
    setTempStart(yesterday);
    setTempEnd(null);
  };

  const handleMonthClick = (month: number) => {
    const selected = new Date(currentYear, month, 1);
    setCurrentDate(selected);
    setTempStart(selected);
    setTempEnd(null);
    onMonthSelect?.(`${currentYear}-${String(month + 1).padStart(2, '0')}`);
  };

  const formatFullDate = (d: Date | null) =>
    d
      ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
      : '';

  const normalizeDateTime = (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  const isStart = (d: Date) => {
    if (!tempStart) return false;
    return normalizeDateTime(d) === normalizeDateTime(tempStart);
  };

  const isEnd = (d: Date) => {
    if (mode === 'single' || !tempEnd) return false;
    return normalizeDateTime(d) === normalizeDateTime(tempEnd);
  };

  const isInRange = (d: Date) => {
    if (mode === 'single' || !tempStart || !tempEnd) return false;
    const time = normalizeDateTime(d);
    const startTime = normalizeDateTime(tempStart);
    const endTime = normalizeDateTime(tempEnd);
    return time > startTime && time < endTime;
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return normalizeDateTime(d) === normalizeDateTime(today);
  };

  const shouldShowPresets = showPresets !== undefined ? showPresets : mode === 'single';

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 30 : -30,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 30 : -30,
      opacity: 0,
    }),
  };

  const containerClasses = isMobileView
    ? 'flex w-full flex-col font-sans bg-transparent'
    : 'flex max-h-[calc(100dvh-16px)] min-h-0 w-[320px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border border-slate-100 bg-white font-sans shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:rounded-[16px] sm:bg-[#f8fafb]';

  return (
    <div className={containerClasses}>
      {/* Quick Presets for Single Date Mode */}
      {shouldShowPresets && view === 'days' && (
        <div
          className={`flex items-center gap-2 border-b border-slate-100/80 bg-slate-50/70 sm:bg-white/50 ${
            isMobileView ? 'px-4 py-2.5' : 'px-3.5 pt-3 pb-1'
          }`}
        >
          <span className={`${isMobileView ? 'text-xs' : 'text-[11px]'} font-semibold text-slate-400`}>
            Chọn nhanh:
          </span>
          <button
            type="button"
            onClick={handleSelectToday}
            className={`${
              isMobileView
                ? 'px-3.5 py-1.5 text-xs min-h-[36px] rounded-xl'
                : 'px-2.5 py-1 text-[11px] rounded-lg'
            } font-semibold bg-white border border-slate-200/80 text-slate-700 hover:border-[#1A73E8] hover:text-[#1A73E8] hover:bg-blue-50/50 transition-all shadow-2xs active:scale-95`}
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={handleSelectYesterday}
            className={`${
              isMobileView
                ? 'px-3.5 py-1.5 text-xs min-h-[36px] rounded-xl'
                : 'px-2.5 py-1 text-[11px] rounded-lg'
            } font-semibold bg-white border border-slate-200/80 text-slate-700 hover:border-[#1A73E8] hover:text-[#1A73E8] hover:bg-blue-50/50 transition-all shadow-2xs active:scale-95`}
          >
            Hôm qua
          </button>
        </div>
      )}

      {/* Header */}
      <div
        className={`flex justify-between items-center border-b border-slate-100/80 bg-white ${
          isMobileView ? 'p-4 pb-3' : 'p-3.5 pb-2.5'
        }`}
      >
        {monthOnly ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYearGridStart(currentYear - 4)}
              className={`${
                isMobileView ? 'text-[15px] px-3 py-1.5 rounded-xl' : 'text-[14px] px-2 py-0.5 rounded-lg'
              } font-bold text-slate-900 hover:bg-slate-100`}
            >
              {currentYear}
            </button>
          </div>
        ) : view === 'days' ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setView('months')}
              className={`flex items-center gap-1 font-bold text-slate-900 hover:text-[#1A73E8] hover:bg-slate-100/80 transition-colors focus:outline-none ${
                isMobileView
                  ? 'text-[15px] px-2.5 py-1.5 min-h-[40px] rounded-xl'
                  : 'text-[14px] px-2 py-0.5 rounded-lg'
              }`}
              title="Chọn tháng"
            >
              <span>Tháng {currentMonth + 1}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => {
                setYearGridStart(currentYear - 4);
                setView('years');
              }}
              className={`flex items-center gap-1 font-bold text-slate-900 hover:text-[#1A73E8] hover:bg-slate-100/80 transition-colors focus:outline-none ${
                isMobileView
                  ? 'text-[15px] px-2.5 py-1.5 min-h-[40px] rounded-xl'
                  : 'text-[14px] px-2 py-0.5 rounded-lg'
              }`}
              title="Chọn năm"
            >
              <span>{currentYear}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        ) : view === 'months' ? (
          <h3 className={`${isMobileView ? 'text-[15px]' : 'text-[14px]'} font-bold text-slate-900 pl-2`}>
            Chọn tháng
          </h3>
        ) : (
          <h3 className={`${isMobileView ? 'text-[15px]' : 'text-[14px]'} font-bold text-slate-900 pl-2`}>
            {yearGridStart} - {yearGridStart + 11}
          </h3>
        )}

        <div className={`flex items-center text-slate-600 ${isMobileView ? 'gap-2' : 'gap-1'}`}>
          {monthOnly ? (
            <>
              <button
                onClick={() => setCurrentDate(new Date(currentYear - 1, currentMonth, 1))}
                className={`${
                  isMobileView
                    ? 'p-2.5 min-w-[40px] min-h-[40px] rounded-xl'
                    : 'p-1.5 rounded-lg'
                } hover:bg-slate-100 transition-colors flex items-center justify-center`}
                aria-label="Năm trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentYear + 1, currentMonth, 1))}
                className={`${
                  isMobileView
                    ? 'p-2.5 min-w-[40px] min-h-[40px] rounded-xl'
                    : 'p-1.5 rounded-lg'
                } hover:bg-slate-100 transition-colors flex items-center justify-center`}
                aria-label="Năm sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : view === 'days' ? (
            <>
              <button
                onClick={handlePrevMonth}
                className={`${
                  isMobileView
                    ? 'p-2.5 min-w-[40px] min-h-[40px] rounded-xl'
                    : 'p-1.5 rounded-lg'
                } hover:bg-slate-100 transition-colors focus:outline-none flex items-center justify-center`}
                aria-label="Tháng trước"
              >
                <ChevronLeft className={`${isMobileView ? 'w-4.5 h-4.5' : 'w-4 h-4'}`} />
              </button>
              <button
                onClick={handleNextMonth}
                className={`${
                  isMobileView
                    ? 'p-2.5 min-w-[40px] min-h-[40px] rounded-xl'
                    : 'p-1.5 rounded-lg'
                } hover:bg-slate-100 transition-colors focus:outline-none flex items-center justify-center`}
                aria-label="Tháng sau"
              >
                <ChevronRight className={`${isMobileView ? 'w-4.5 h-4.5' : 'w-4 h-4'}`} />
              </button>
            </>
          ) : view === 'months' ? (
            <button
              onClick={() => setView('days')}
              className={`${
                isMobileView ? 'text-sm px-3.5 py-1.5 min-h-[40px]' : 'text-xs px-2.5 py-1'
              } text-[#1A73E8] hover:text-blue-800 font-bold transition hover:bg-blue-50 rounded-xl focus:outline-none`}
            >
              Quay lại
            </button>
          ) : (
            <>
              <button
                onClick={() => setYearGridStart(prev => prev - 12)}
                className={`${
                  isMobileView
                    ? 'p-2.5 min-w-[40px] min-h-[40px] rounded-xl'
                    : 'p-1.5 rounded-lg'
                } hover:bg-slate-100 transition-colors focus:outline-none flex items-center justify-center`}
                aria-label="Nhóm năm trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setYearGridStart(prev => prev + 12)}
                className={`${
                  isMobileView
                    ? 'p-2.5 min-w-[40px] min-h-[40px] rounded-xl'
                    : 'p-1.5 rounded-lg'
                } hover:bg-slate-100 transition-colors focus:outline-none flex items-center justify-center`}
                aria-label="Nhóm năm sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('days')}
                className={`${
                  isMobileView ? 'text-sm px-3.5 py-1.5 min-h-[40px]' : 'text-xs px-2.5 py-1'
                } text-[#1A73E8] hover:text-blue-800 font-bold transition hover:bg-blue-50 rounded-xl ml-1 focus:outline-none`}
              >
                Quay lại
              </button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div
        className={`relative min-h-0 max-h-[calc(100dvh-140px)] overflow-y-auto ${
          isMobileView ? 'p-3.5 pt-2.5' : 'p-3 pt-2'
        }`}
      >
        {monthOnly ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {Array.from({ length: 12 }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleMonthClick(idx)}
                className={`${
                  isMobileView ? 'py-3 text-[13px] min-h-[44px]' : 'py-2.5 text-[11px]'
                } font-semibold rounded-xl transition-all ${
                  currentMonth === idx
                    ? 'bg-[#1A73E8] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-100'
                }`}
              >
                Tháng {idx + 1}
              </button>
            ))}
          </div>
        ) : view === 'days' ? (
          <>
            <div className="grid grid-cols-7 text-center mb-1">
              {daysOfWeek.map(d => (
                <div
                  key={d.label}
                  className={`${
                    isMobileView ? 'text-xs py-1' : 'text-[10.5px] py-0.5'
                  } font-bold ${d.isWeekend ? 'text-amber-600/80' : 'text-slate-400'}`}
                >
                  {d.label}
                </div>
              ))}
            </div>

            <div className={`relative w-full ${isMobileView ? 'min-h-[270px]' : 'min-h-[190px]'}`}>
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  key={`${currentYear}-${currentMonth}`}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 320, damping: 32 },
                    opacity: { duration: 0.15 },
                  }}
                  className={`grid grid-cols-7 absolute left-0 right-0 ${
                    isMobileView ? 'gap-y-1.5' : 'gap-y-1'
                  }`}
                >
                  {generateDays().map((item, idx) => {
                    const isOutside = item.monthOffset !== 0;
                    const start = isStart(item.date);
                    const end = isEnd(item.date);
                    const range = isInRange(item.date);
                    const today = isToday(item.date);
                    const disabled = isDateDisabled(item.date);

                    let bgClass = 'bg-transparent';
                    let textClass = disabled
                      ? 'text-slate-300 cursor-not-allowed opacity-40'
                      : isOutside
                      ? 'text-slate-300 hover:text-slate-500'
                      : 'text-slate-800';
                    let roundedClass = 'rounded-xl';

                    if (!disabled) {
                      if (mode === 'single') {
                        if (start) {
                          bgClass = 'bg-[#1A73E8] shadow-sm';
                          textClass = 'text-white font-bold';
                          roundedClass = 'rounded-xl';
                        } else if (today) {
                          textClass = 'text-[#1A73E8] font-bold';
                          bgClass = 'bg-blue-50/70 border border-blue-200/80';
                        }
                      } else {
                        if (start) {
                          bgClass = 'bg-[#1A73E8]';
                          textClass = 'text-white font-bold';
                          roundedClass =
                            tempEnd && tempEnd.getTime() !== tempStart?.getTime()
                              ? 'rounded-l-xl rounded-r-none'
                              : 'rounded-xl';
                        } else if (end) {
                          bgClass = 'bg-[#1A73E8]';
                          textClass = 'text-white font-bold';
                          roundedClass = 'rounded-r-xl rounded-l-none';
                        } else if (range) {
                          bgClass = 'bg-[#EBF2FA]';
                          textClass = 'text-[#1A73E8] font-semibold';
                          roundedClass = 'rounded-none';
                        } else if (today) {
                          textClass = 'text-[#1A73E8] font-bold';
                          bgClass = 'bg-blue-50/70 border border-blue-200/80';
                        }
                      }
                    }

                    const cellButtonSize = isMobileView
                      ? 'w-full max-w-[44px] h-[44px] text-[13.5px]'
                      : 'w-full max-w-[36px] h-[32px] text-[12px]';

                    return (
                      <button
                        key={`${item.monthOffset}-${item.day}-${idx}`}
                        type="button"
                        onClick={() => !disabled && handleDayClick(item)}
                        disabled={disabled}
                        className={`${cellButtonSize} flex items-center justify-center ${
                          !disabled ? 'hover:font-bold cursor-pointer' : ''
                        } transition-all mx-auto focus:outline-none ${textClass}`}
                      >
                        <div
                          className={`w-full h-full flex items-center justify-center transition-colors ${bgClass} ${roundedClass} ${
                            !start && !end && !range && !disabled && !today
                              ? 'hover:bg-slate-100 hover:rounded-xl'
                              : ''
                          }`}
                        >
                          {item.day}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : view === 'months' ? (
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {[
              'Tháng 1',
              'Tháng 2',
              'Tháng 3',
              'Tháng 4',
              'Tháng 5',
              'Tháng 6',
              'Tháng 7',
              'Tháng 8',
              'Tháng 9',
              'Tháng 10',
              'Tháng 11',
              'Tháng 12',
            ].map((m, idx) => {
              const isActive = currentMonth === idx;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCurrentDate(new Date(currentYear, idx, 1));
                    setView('days');
                  }}
                  className={`${
                    isMobileView ? 'py-3 text-[13px] min-h-[44px]' : 'py-2.5 text-[11px]'
                  } font-semibold rounded-xl text-center transition-all focus:outline-none ${
                    isActive
                      ? 'bg-[#1A73E8] text-white shadow-md shadow-blue-100'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-100'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {Array.from({ length: 12 }).map((_, idx) => {
              const y = yearGridStart + idx;
              const isActive = currentYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setCurrentDate(new Date(y, currentMonth, 1));
                    setView('months');
                  }}
                  className={`${
                    isMobileView ? 'py-3 text-[13px] min-h-[44px]' : 'py-2.5 text-[11px]'
                  } font-semibold rounded-xl text-center transition-all focus:outline-none ${
                    isActive
                      ? 'bg-[#1A73E8] text-white shadow-md shadow-blue-100'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-100'
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {isMobileView ? (
        <div className="z-10 flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-[#f8fafb] px-4 pt-3.5 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ngày đã chọn:</span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              {monthOnly
                ? `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`
                : mode === 'single'
                ? tempStart
                  ? formatFullDate(tempStart)
                  : 'Chưa chọn ngày'
                : `${tempStart ? formatFullDate(tempStart) : ''} ${
                    tempEnd && tempEnd.getTime() !== tempStart?.getTime()
                      ? `- ${formatFullDate(tempEnd)}`
                      : ''
                  }`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 w-full rounded-xl border border-slate-200/90 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center focus:outline-none shadow-2xs"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => {
                if (tempStart) {
                  if (onRangeConfirm) {
                    onRangeConfirm(tempStart, mode === 'single' ? null : tempEnd);
                  } else {
                    onRangeSelect(tempStart, mode === 'single' ? tempStart : tempEnd || tempStart);
                  }
                  onConfirm();
                }
              }}
              disabled={!tempStart}
              className="h-11 w-full rounded-xl bg-[#1A73E8] hover:bg-[#1557b0] text-white text-sm font-bold shadow-sm active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center focus:outline-none"
            >
              Xác nhận
            </button>
          </div>
        </div>
      ) : (
        <div className="z-10 flex shrink-0 items-center justify-between border-t border-slate-100 bg-[#f8fafb] px-4 py-3 sm:px-3.5 sm:py-2.5">
          <span className="text-[12px] sm:text-[11.5px] font-semibold text-slate-600 truncate max-w-[170px]">
            {monthOnly
              ? `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`
              : mode === 'single'
              ? tempStart
                ? formatFullDate(tempStart)
                : 'Chưa chọn ngày'
              : `${tempStart ? formatFullDate(tempStart) : ''} ${
                  tempEnd && tempEnd.getTime() !== tempStart?.getTime()
                    ? `- ${formatFullDate(tempEnd)}`
                    : ''
                }`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors focus:outline-none"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => {
                if (tempStart) {
                  if (onRangeConfirm) {
                    onRangeConfirm(tempStart, mode === 'single' ? null : tempEnd);
                  } else {
                    onRangeSelect(tempStart, mode === 'single' ? tempStart : tempEnd || tempStart);
                  }
                  onConfirm();
                }
              }}
              disabled={!tempStart}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#1557b0] disabled:opacity-50 transition-all shadow-xs active:scale-95 focus:outline-none"
            >
              Xác nhận
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

