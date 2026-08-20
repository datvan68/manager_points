'use client';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeSelect: (start: Date, end: Date) => void;
  onRangeConfirm?: (start: Date, end: Date | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  minDate?: Date;
  monthOnly?: boolean;
  monthValue?: string;
  onMonthSelect?: (month: string) => void;
}

export function CustomCalendar({ startDate, endDate, onRangeSelect, onRangeConfirm, onCancel, onConfirm, minDate, monthOnly = false, monthValue, onMonthSelect }: CustomCalendarProps) {
  const [currentDate, setCurrentDate] = React.useState(startDate || new Date()); // Default to current real-time date
  const [tempStart, setTempStart] = React.useState<Date | null>(startDate);
  const [tempEnd, setTempEnd] = React.useState<Date | null>(endDate);
  const [direction, setDirection] = React.useState(0); // 1 = right (next month), -1 = left (prev month)
  const [view, setView] = React.useState<'days' | 'months' | 'years'>('days');
  const [yearGridStart, setYearGridStart] = React.useState((startDate || new Date()).getFullYear() - 4);

  // Sync date when startDate prop changes
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
    }
    if (endDate) {
      setTempEnd(endDate);
    }
  }, [startDate, endDate, monthOnly, monthValue]);

  const daysOfWeek = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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

  // Calculate dynamic days for the current month/year
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // Get index of the first day of the month where Mon=0, Sun=6
  const startDayOffset = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  const generateDays = () => {
    let days = [];
    for (let i = 0; i < startDayOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const isDateDisabled = (dayNumber: number | null) => {
    if (!dayNumber) return false;
    if (!minDate) return false;
    const date = new Date(currentYear, currentMonth, dayNumber);
    date.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return date < min;
  };

  const handleDayClick = (dayNumber: number | null) => {
    if (!dayNumber) return;
    if (isDateDisabled(dayNumber)) return;
    const selected = new Date(currentYear, currentMonth, dayNumber);
    // Remove time parts for accurate comparisons
    selected.setHours(0, 0, 0, 0);

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

  const handleMonthClick = (month: number) => {
    const selected = new Date(currentYear, month, 1);
    setCurrentDate(selected);
    setTempStart(selected);
    setTempEnd(null);
    onMonthSelect?.(`${currentYear}-${String(month + 1).padStart(2, '0')}`);
  };

  const formatDate = (d: Date | null) => d ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}` : '';

  const normalizeDate = (year: number, month: number, day: number) => {
    return new Date(year, month, day).getTime();
  };

  const isStart = (day: number) => {
    if (!tempStart) return false;
    return normalizeDate(currentYear, currentMonth, day) === normalizeDate(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate());
  };

  const isEnd = (day: number) => {
    if (!tempEnd) return false;
    return normalizeDate(currentYear, currentMonth, day) === normalizeDate(tempEnd.getFullYear(), tempEnd.getMonth(), tempEnd.getDate());
  };

  const isInRange = (day: number) => {
    if (!tempStart || !tempEnd) return false;
    const time = normalizeDate(currentYear, currentMonth, day);
    const startTime = normalizeDate(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate());
    const endTime = normalizeDate(tempEnd.getFullYear(), tempEnd.getMonth(), tempEnd.getDate());
    return time > startTime && time < endTime;
  };

  const isSelected = (day: number) => {
    return isStart(day) || isEnd(day) || isInRange(day);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  };

  const variants = {
    enter: (direction: number) => {
      return {
        x: direction > 0 ? 30 : -30,
        opacity: 0
      };
    },
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => {
      return {
        zIndex: 0,
        x: direction < 0 ? 30 : -30,
        opacity: 0
      };
    }
  };

  return (
    <div className="flex max-h-[calc(100dvh-16px)] min-h-0 w-[320px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border border-slate-100 bg-white font-sans shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:rounded-[16px] sm:bg-[#f8fafb]">
      {/* Header */}
      <div className="flex justify-between items-center p-4 pb-2 border-b border-slate-100/60 bg-white">
        {monthOnly ? (
          <div className="flex items-center gap-1">
            <button onClick={() => setYearGridStart(currentYear - 4)} className="text-[14px] font-bold text-slate-900 px-2 py-0.5 rounded-lg">{currentYear}</button>
          </div>
        ) : view === 'days' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('months')}
              className="text-[14px] font-bold text-slate-900 hover:bg-slate-100 px-2 py-0.5 rounded-lg transition focus:outline-none"
            >
              Tháng {currentMonth + 1}
            </button>
            <button
              onClick={() => {
                setYearGridStart(currentYear - 4);
                setView('years');
              }}
              className="text-[14px] font-bold text-slate-900 hover:bg-slate-100 px-2 py-0.5 rounded-lg transition focus:outline-none"
            >
              {currentYear}
            </button>
          </div>
        ) : view === 'months' ? (
          <h3 className="text-[14px] font-bold text-slate-900 pl-2">Chọn tháng</h3>
        ) : (
          <h3 className="text-[14px] font-bold text-slate-900 pl-2">
            {yearGridStart} - {yearGridStart + 11}
          </h3>
        )}

        <div className="flex gap-1 text-slate-600">
          {monthOnly ? (
            <><button onClick={() => setCurrentDate(new Date(currentYear - 1, currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button><button onClick={() => setCurrentDate(new Date(currentYear + 1, currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button></>
          ) : view === 'days' ? (
            <>
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition focus:outline-none">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition focus:outline-none">
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : view === 'months' ? (
            <button
              onClick={() => setView('days')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold transition px-2.5 py-1 hover:bg-blue-50 rounded-lg focus:outline-none"
            >
              Quay lại
            </button>
          ) : (
            <>
              <button onClick={() => setYearGridStart(prev => prev - 12)} className="p-1.5 hover:bg-slate-100 rounded-lg transition focus:outline-none">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setYearGridStart(prev => prev + 12)} className="p-1.5 hover:bg-slate-100 rounded-lg transition focus:outline-none">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('days')}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold transition px-2.5 py-1 hover:bg-blue-50 rounded-lg ml-1 focus:outline-none"
              >
                Quay lại
              </button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="relative min-h-0 max-h-[calc(100dvh-128px)] overflow-y-auto p-3 pt-2">
        {monthOnly ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {Array.from({ length: 12 }).map((_, idx) => <button key={idx} onClick={() => handleMonthClick(idx)} className={`py-2.5 text-[11px] font-semibold rounded-lg ${currentMonth === idx ? 'bg-[#1a56db] text-white' : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-100'}`}>Tháng {idx + 1}</button>)}
          </div>
        ) : view === 'days' ? (
          <>
            <div className="grid grid-cols-7 text-center mb-1">
              {daysOfWeek.map(d => (
                <div key={d} className="text-[10px] font-bold text-slate-400 py-0.5">{d}</div>
              ))}
            </div>

            <div className="relative w-full min-h-[168px]">
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  key={`${currentYear}-${currentMonth}`}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                  className="grid grid-cols-7 gap-y-0.5 absolute left-0 right-0"
                >
                  {generateDays().map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} />;

                    const start = isStart(day);
                    const end = isEnd(day);
                    const range = isInRange(day);
                    const today = isToday(day);
                    const disabled = isDateDisabled(day);

                    let bgClass = "bg-transparent";
                    let textClass = disabled ? "text-slate-300 cursor-not-allowed opacity-40" : "text-slate-800";
                    let roundedClass = "rounded-lg";

                    if (!disabled) {
                      if (start) {
                        bgClass = "bg-[#1a56db]";
                        textClass = "text-white font-bold";
                        roundedClass = (tempEnd && tempEnd.getTime() !== tempStart?.getTime()) ? "rounded-l-lg rounded-r-none" : "rounded-lg";
                      } else if (end) {
                        bgClass = "bg-[#1a56db]";
                        textClass = "text-white font-bold";
                        roundedClass = "rounded-r-lg rounded-l-none";
                      } else if (range) {
                        bgClass = "bg-[#e1effe]";
                        textClass = "text-[#1a56db] font-semibold";
                        roundedClass = "rounded-none";
                      } else if (today) {
                        textClass = "text-blue-600 font-bold";
                        bgClass = "bg-blue-50/50";
                      }
                    }

                    return (
                      <button
                        key={day}
                        onClick={() => !disabled && handleDayClick(day)}
                        disabled={disabled}
                        className={`w-full max-w-[36px] h-[32px] flex items-center justify-center text-[12px] ${!disabled ? 'hover:font-bold cursor-pointer' : ''} transition-all mx-auto focus:outline-none ${textClass}`}
                      >
                        <div className={`w-full h-full flex items-center justify-center ${bgClass} ${roundedClass} ${(!start && !end && !range && !disabled) ? 'hover:bg-slate-200 hover:rounded-lg border border-transparent' : ''} ${today && !start && !end && !range && !disabled ? 'border-blue-200' : ''}`}>
                          {day}
                        </div>
                      </button>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : view === 'months' ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'].map((m, idx) => {
              const isActive = currentMonth === idx;
              return (
                <button
                  key={m}
                  onClick={() => {
                    setCurrentDate(new Date(currentYear, idx, 1));
                    setView('days');
                  }}
                  className={`py-2.5 text-[11px] font-semibold rounded-lg text-center transition-all focus:outline-none ${isActive
                    ? "bg-[#1a56db] text-white shadow-md shadow-blue-100"
                    : "text-slate-700 hover:bg-slate-100 bg-white border border-slate-100"
                    }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {Array.from({ length: 12 }).map((_, idx) => {
              const y = yearGridStart + idx;
              const isActive = currentYear === y;
              return (
                <button
                  key={y}
                  onClick={() => {
                    setCurrentDate(new Date(y, currentMonth, 1));
                    setView('months'); // Let them choose month next!
                  }}
                  className={`py-2.5 text-[11px] font-semibold rounded-lg text-center transition-all focus:outline-none ${isActive
                    ? "bg-[#1a56db] text-white shadow-md shadow-blue-100"
                    : "text-slate-700 hover:bg-slate-100 bg-white border border-slate-100"
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
      <div className="z-10 flex shrink-0 items-center justify-between border-t border-slate-200 bg-[#f8fafb] p-4">
        <span className="text-[13px] font-medium text-slate-500">
          {monthOnly ? `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}` : `${tempStart ? formatDate(tempStart) : ''} ${tempEnd && tempEnd.getTime() !== tempStart?.getTime() ? `- ${formatDate(tempEnd)}` : ''}`}
        </span>
        <div className="flex gap-3 text-[13px] font-bold">
          <button onClick={onCancel} className="text-rose-500 hover:text-rose-600 transition focus:outline-none">Huỷ</button>
          <button
            onClick={() => {
              if (tempStart) {
                if (onRangeConfirm) {
                  onRangeConfirm(tempStart, tempEnd);
                } else {
                  onRangeSelect(tempStart, tempEnd || tempStart);
                }
                onConfirm();
              }
            }}
            disabled={!tempStart}
            className="text-[#1a56db] hover:text-blue-800 disabled:opacity-50 transition focus:outline-none"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
