import os

input_file = 'd:/PROJECT/manager_points/frontend/src/app/grading/score/page.tsx'
output_dir = 'd:/PROJECT/manager_points/output'
output_file = os.path.join(output_dir, 'page.tsx')

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import useVirtualizer
if 'import { useVirtualizer } from "@tanstack/react-virtual";' not in content:
    content = content.replace('import { motion, AnimatePresence } from "framer-motion";', 
                              'import { motion, AnimatePresence } from "framer-motion";\nimport { useVirtualizer } from "@tanstack/react-virtual";')

# 2. Modify filteredStudentsForRoster
content = content.replace('return list.slice(0, 30);', 'return list;')

# 3. Find the render location and replace auto-scroll
auto_scroll_old = '''  // Tự động cuộn slider ngang đến vị trí sinh viên đang được active
  useEffect(() => {
    if (!activeStudentId || students.length === 0 || !sliderRef.current) return;

    // Sử dụng setTimeout nhẹ để đảm bảo DOM đã render xong các thẻ sinh viên
    const timer = setTimeout(() => {
      const slider = sliderRef.current;
      const card = document.getElementById(`student-card-${activeStudentId}`);
      if (slider && card) {
        const offsetLeft = card.offsetLeft;
        const cardWidth = card.clientWidth;
        const sliderWidth = slider.clientWidth;

        // Căn giữa thẻ sinh viên đang active trong lòng slider ngang
        slider.scrollTo({
          left: offsetLeft - sliderWidth / 2 + cardWidth / 2,
          behavior: "smooth",
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeStudentId, students]);'''

auto_scroll_new = '''  const activeStudentIndex = React.useMemo(() => {
    return filteredStudentsForRoster.findIndex((s) => s.id === activeStudentId);
  }, [filteredStudentsForRoster, activeStudentId]);

  const studentVirtualizer = useVirtualizer({
    count: filteredStudentsForRoster.length,
    getScrollElement: () => sliderRef.current,
    horizontal: true,
    estimateSize: () => isStudentSliderSticky ? 180 : 272,
    overscan: 5,
  });

  // Tự động cuộn slider ngang đến vị trí sinh viên đang được active
  useEffect(() => {
    if (!activeStudentId || students.length === 0 || !sliderRef.current || activeStudentIndex === -1) return;

    const timer = setTimeout(() => {
      studentVirtualizer.scrollToIndex(activeStudentIndex, { align: "center" });
    }, 100);

    return () => clearTimeout(timer);
  }, [activeStudentId, students, activeStudentIndex, studentVirtualizer]);'''

if auto_scroll_old in content:
    content = content.replace(auto_scroll_old, auto_scroll_new)
else:
    print("Could not find auto-scroll block!")

# 4. Modify rendering
render_old = '''                    : filteredStudentsForRoster.length === 0 ? (
                      <div className="flex-1 py-6 flex flex-col items-center justify-center text-center text-[#64748B] font-medium text-[13.5px] border border-dashed border-slate-300/60 rounded-2xl bg-white/40 select-none">
                        {!selectedClassId
                          ? "Vui lòng chọn lớp học để xem danh sách sinh viên."
                          : students.length === 0 
                            ? "Lớp này chưa có sinh viên."
                            : "Không tìm thấy sinh viên nào khớp với bộ lọc."}
                      </div>
                    ) : filteredStudentsForRoster.map((student, idx) => {
                      const isActive = student.id === activeStudentId;
                      const initials = getInitials(student.name);

                      return (
                        <motion.div
                          key={student.id || `student-card-${idx}`}
                          id={`student-card-${student.id}`}
                          onClick={() => setActiveStudentId(student.id)}
                          className={`relative bg-white/55 backdrop-blur-sm border-2 cursor-pointer transition-[background-color,border-color,box-shadow,transform] duration-200 select-none shadow-sm flex items-center shrink-0 ${
                            isStudentSliderSticky
                              ? "rounded-xl p-1.5 px-3 w-fit gap-2 h-9"
                              : "rounded-2xl p-[13px] w-[256px] gap-[12px]"
                          } ${
                            isActive
                              ? "border-[#1A73E8] bg-white/80 shadow-[0px_4px_16px_rgba(26,115,232,0.08)] scale-[1.015]"
                              : "border-white hover:border-slate-300/40 hover:scale-[1.01]"
                          }`}
                        >
                          {/* Avatar container */}
                          <div className={`relative shrink-0 rounded-full transition-all duration-200 ${isStudentSliderSticky ? "w-6 h-6" : "w-12 h-12"}`}>
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
                                className={`absolute inset-0 rounded-full flex items-center justify-center font-bold border border-white/80 ring-2 ring-white transition-all duration-200 ${isStudentSliderSticky ? "text-[10px]" : "text-[15px]"} ${student.colorTheme?.bg} ${student.colorTheme?.text}`}
                              >
                                {initials}
                              </div>
                            )}

                            {/* Active Badge Checkmark */}
                            {isActive && !isStudentSliderSticky && (
                              <div className="absolute -bottom-1 -right-1 bg-[#1A73E8] text-white border-2 border-white rounded-lg w-5 h-5 flex items-center justify-center shadow-md">
                                <Check size={11} strokeWidth={3} />
                              </div>
                            )}
                            {isActive && isStudentSliderSticky && (
                              <div className="absolute -bottom-0.5 -right-0.5 bg-[#1A73E8] text-white border border-white rounded-full w-3 h-3 flex items-center justify-center shadow-md">
                                <Check size={8} strokeWidth={2} />
                              </div>
                            )}
                          </div>

                          {/* Student Info & Realtime Progress */}
                          <div className={`flex-1 min-w-0 flex ${isStudentSliderSticky ? "flex-row items-center gap-2" : "flex-col"}`}>
                            <h4
                              className={`font-bold text-[#1E293B] truncate transition-all duration-200 ${isStudentSliderSticky ? "text-[13px] max-w-[120px]" : "text-[14.5px]"}`}
                              title={student.name}
                            >
                              {student.name}
                            </h4>
                            
                            {!isStudentSliderSticky && (
                              <div className="flex items-center justify-between mt-0.5 w-full min-w-0">
                                <span className="text-[#64748B] text-[11px] font-medium truncate">
                                  MSSV: {student.id}
                                </span>
                                {renderGradingStatusBadge(student.gradingStatus)}
                              </div>
                            )}

                            {/* Realtime progress bar */}
                            {isStudentSliderSticky ? (
                              <div className="flex items-center">
                                <span className="font-bold text-[#1A73E8] text-[11px] tracking-wide shrink-0 bg-blue-50/50 px-1.5 py-0.5 rounded-md border border-blue-100/50">
                                  {student.score}
                                </span>
                              </div>
                            ) : (
                              <div className="flex gap-2.5 items-center mt-1.5">
                                <div className="bg-[#EBF2FA] flex-1 h-[5px] rounded-lg overflow-hidden border border-white/20">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${student.score}%` }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 80,
                                      damping: 15,
                                    }}
                                    className="bg-[#1A73E8] h-full rounded-lg"
                                  />
                                </div>
                                <span className="font-bold text-[#1A73E8] text-[9.5px] tracking-wide shrink-0">
                                  {student.score}/100
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}'''

render_new = '''                    : filteredStudentsForRoster.length === 0 ? (
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
                          width: `${studentVirtualizer.getTotalSize()}px`,
                          height: '100%',
                          position: 'relative',
                        }}
                      >
                        {studentVirtualizer.getVirtualItems().map((virtualItem) => {
                          const student = filteredStudentsForRoster[virtualItem.index];
                          const isActive = student.id === activeStudentId;
                          const initials = getInitials(student.name);

                          return (
                            <motion.div
                              key={student.id || `student-card-${virtualItem.index}`}
                              id={`student-card-${student.id}`}
                              onClick={() => setActiveStudentId(student.id)}
                              ref={studentVirtualizer.measureElement}
                              data-index={virtualItem.index}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                transform: `translateX(${virtualItem.start}px)`,
                              }}
                              className={`relative bg-white/55 backdrop-blur-sm border-2 cursor-pointer transition-[background-color,border-color,box-shadow] duration-200 select-none shadow-sm flex items-center shrink-0 ${
                                isStudentSliderSticky
                                  ? "rounded-xl p-1.5 px-3 w-fit gap-2 h-9"
                                  : "rounded-2xl p-[13px] w-[256px] gap-[12px]"
                              } ${
                                isActive
                                  ? "border-[#1A73E8] bg-white/80 shadow-[0px_4px_16px_rgba(26,115,232,0.08)] scale-[1.015]"
                                  : "border-white hover:border-slate-300/40 hover:scale-[1.01]"
                              }`}
                            >
                              {/* Avatar container */}
                              <div className={`relative shrink-0 rounded-full transition-all duration-200 ${isStudentSliderSticky ? "w-6 h-6" : "w-12 h-12"}`}>
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
                                    className={`absolute inset-0 rounded-full flex items-center justify-center font-bold border border-white/80 ring-2 ring-white transition-all duration-200 ${isStudentSliderSticky ? "text-[10px]" : "text-[15px]"} ${student.colorTheme?.bg} ${student.colorTheme?.text}`}
                                  >
                                    {initials}
                                  </div>
                                )}

                                {/* Active Badge Checkmark */}
                                {isActive && !isStudentSliderSticky && (
                                  <div className="absolute -bottom-1 -right-1 bg-[#1A73E8] text-white border-2 border-white rounded-lg w-5 h-5 flex items-center justify-center shadow-md">
                                    <Check size={11} strokeWidth={3} />
                                  </div>
                                )}
                                {isActive && isStudentSliderSticky && (
                                  <div className="absolute -bottom-0.5 -right-0.5 bg-[#1A73E8] text-white border border-white rounded-full w-3 h-3 flex items-center justify-center shadow-md">
                                    <Check size={8} strokeWidth={2} />
                                  </div>
                                )}
                              </div>

                              {/* Student Info & Realtime Progress */}
                              <div className={`flex-1 min-w-0 flex ${isStudentSliderSticky ? "flex-row items-center gap-2" : "flex-col"}`}>
                                <h4
                                  className={`font-bold text-[#1E293B] truncate transition-all duration-200 ${isStudentSliderSticky ? "text-[13px] max-w-[120px]" : "text-[14.5px]"}`}
                                  title={student.name}
                                >
                                  {student.name}
                                </h4>
                                
                                {!isStudentSliderSticky && (
                                  <div className="flex items-center justify-between mt-0.5 w-full min-w-0">
                                    <span className="text-[#64748B] text-[11px] font-medium truncate">
                                      MSSV: {student.id}
                                    </span>
                                    {renderGradingStatusBadge(student.gradingStatus)}
                                  </div>
                                )}

                                {/* Realtime progress bar */}
                                {isStudentSliderSticky ? (
                                  <div className="flex items-center">
                                    <span className="font-bold text-[#1A73E8] text-[11px] tracking-wide shrink-0 bg-blue-50/50 px-1.5 py-0.5 rounded-md border border-blue-100/50">
                                      {student.score}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex gap-2.5 items-center mt-1.5">
                                    <div className="bg-[#EBF2FA] flex-1 h-[5px] rounded-lg overflow-hidden border border-white/20">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${student.score}%` }}
                                        transition={{
                                          type: "spring",
                                          stiffness: 80,
                                          damping: 15,
                                        }}
                                        className="bg-[#1A73E8] h-full rounded-lg"
                                      />
                                    </div>
                                    <span className="font-bold text-[#1A73E8] text-[9.5px] tracking-wide shrink-0">
                                      {student.score}/100
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}'''

if render_old in content:
    content = content.replace(render_old, render_new)
else:
    print("Could not find render block!")

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success replacing')
