'use client';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeSelect: (start: Date, end: Date) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CustomCalendar({ startDate, endDate, onRangeSelect, onCancel, onConfirm }: CustomCalendarProps) {
  const [currentDate, setCurrentDate] = useState(startDate || new Date()); // Default to current real-time date
  const [tempStart, setTempStart] = useState<Date | null>(startDate);
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate);
  const [direction, setDirection] = useState(0); // 1 = right (next month), -1 = left (prev month)

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

  const handleDayClick = (dayNumber: number | null) => {
    if (!dayNumber) return;
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
    <div className="flex flex-col font-sans w-[calc(100vw-32px)] sm:w-[320px] bg-white sm:bg-[#f8fafb] rounded-[20px] sm:rounded-[16px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center p-4 pb-2">
        <h3 className="text-[14px] font-bold text-slate-900">
          Tháng {currentMonth + 1}, {currentYear}
        </h3>
        <div className="flex gap-1.5 text-slate-600">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-200 rounded transition">
             <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-slate-200 rounded transition">
             <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 pt-1 relative min-h-[290px]">
        <div className="grid grid-cols-7 text-center mb-2">
          {daysOfWeek.map(d => (
            <div key={d} className="text-[11px] font-bold text-slate-400 py-1">{d}</div>
          ))}
        </div>
        
        <div className="relative w-full h-[260px]">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={`${currentYear}-${currentMonth}`}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                className="grid grid-cols-7 gap-y-1 absolute left-0 right-0"
              >
                {generateDays().map((day, idx) => {
                  if (day === null) return <div key={`empty-${idx}`} />;
                  
                  const start = isStart(day);
                  const end = isEnd(day);
                  const range = isInRange(day);
                  const today = isToday(day);

                  let bgClass = "bg-transparent";
                  let textClass = "text-slate-800";
                  let roundedClass = "rounded-lg";

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

                  return (
                    <button 
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`w-full max-w-[40px] h-[36px] flex items-center justify-center text-[13px] hover:font-bold transition-all mx-auto ${textClass}`}
                    >
                        <div className={`w-full h-full flex items-center justify-center ${bgClass} ${roundedClass} ${(!start && !end && !range) ? 'hover:bg-slate-200 hover:rounded-lg border border-transparent' : ''} ${today && !start && !end && !range ? 'border-blue-200' : ''}`}>
                           {day}
                        </div>
                    </button>
                  )
                })}
              </motion.div>
            </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center z-10 p-4 border-t border-slate-200 bg-[#f8fafb]">
        <span className="text-[13px] font-medium text-slate-500">
          {tempStart ? formatDate(tempStart) : ''} {tempEnd && tempEnd.getTime() !== tempStart?.getTime() ? `- ${formatDate(tempEnd)}` : ''}
        </span>
        <div className="flex gap-3 text-[13px] font-bold">
          <button onClick={onCancel} className="text-rose-500 hover:text-rose-600 transition">Huỷ</button>
          <button 
             onClick={() => {
                 if (tempStart) {
                     onRangeSelect(tempStart, tempEnd || tempStart);
                     onConfirm();
                 }
             }}
             disabled={!tempStart}
             className="text-[#1a56db] hover:text-blue-800 disabled:opacity-50 transition"
          >
             Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
