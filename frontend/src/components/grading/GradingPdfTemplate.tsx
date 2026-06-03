'use client';

import React from 'react';
import {
  X, Printer, Download, SlidersHorizontal, Loader2,
  GripVertical, Eye, EyeOff, Palette, Settings, Type, Layout
} from 'lucide-react';
import { toast } from 'sonner';
import { tokenStorage } from '@/api/auth-api';

interface CriteriaItem {
  id: string;
  name: string;
  pointsPerUnit: number;
  type: 'reward' | 'violation';
  maxScore?: number;
  minScore?: number;
}

interface Category {
  id: string;
  code?: string;
  title: string;
  maxPoints: number;
  items: CriteriaItem[];
}

interface StudentData {
  id: string;
  name: string;
  score: number;
  classId: string;
  semesterId: string;
  departmentId: string;
  summaryId: string;
  dob?: string;
}

interface GradingPdfTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: StudentData[];
  categories: Category[];
  evaluationCounts: Record<string, Record<string, number>>;
  semesterName: string;
  className: string;
}

export default function GradingPdfTemplate({
  isOpen,
  onClose,
  selectedStudents = [],
  categories = [],
  evaluationCounts = {},
  semesterName = '',
  className = ''
}: GradingPdfTemplateProps) {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [showConfigPanel, setShowConfigPanel] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'layout' | 'data' | 'style'>('layout');

  // Helper to generate mock counts for design canvas to make the preview vivid
  const getMockCounts = React.useCallback((cats: Category[]) => {
    const mockCounts: Record<string, number> = {};
    cats.forEach((cat) => {
      cat.items.forEach((item, idx) => {
        if (item.type === 'reward') {
          if (idx === 0) mockCounts[item.id] = 2;
          if (idx === 1) mockCounts[item.id] = 1;
        } else {
          if (idx === 0) mockCounts[item.id] = 0;
        }
      });
    });
    return mockCounts;
  }, []);

  // Helper to calculate mock student score dynamically based on categories & mockCounts
  const calculateMockScore = React.useCallback((cats: Category[], mockCounts: Record<string, number>) => {
    let totalScore = 0;
    cats.forEach(cat => {
      let catScore = 0;
      cat.items.forEach(item => {
        const count = mockCounts[item.id] || 0;
        const maxScore = item.maxScore || 10;
        const minScore = item.minScore || 0;
        const criterionScore = item.pointsPerUnit >= 0
          ? Math.max(minScore, Math.min(maxScore, count * item.pointsPerUnit))
          : Math.max(-maxScore, Math.min(0, count * item.pointsPerUnit));
        catScore += criterionScore;
      });
      const clampedScore = Math.max(0, Math.min(cat.maxPoints, catScore));
      totalScore += clampedScore;
    });
    return Math.min(100, totalScore);
  }, []);

  // Custom PDF Config State - Now includes ubnd, city, school, and title for editing
  const [pdfConfig, setPdfConfig] = React.useState(() => {
    let initialApproverName = 'NGƯỜI PHÊ DUYỆT';
    if (typeof window !== 'undefined') {
      try {
        const currentUser = tokenStorage.getUser();
        if (currentUser) {
          initialApproverName = currentUser.user_name || currentUser.username || initialApproverName;
        }
      } catch (e) {
        // Ignore
      }
    }
    return {
      sectionsOrder: ['header', 'title', 'student_info', 'criteria_1_2', 'criteria_3', 'summary', 'signatures'],
      hiddenSections: {
        header: false,
        title: false,
        student_info: false,
        criteria_1_2: false,
        criteria_3: false,
        summary: false,
        signatures: false,
      } as Record<string, boolean>,
      themeColor: '#135bec', // Default: Blue
      fontFamily: 'Times New Roman', // Default: Times New Roman
      fontSize: 'md' as 'sm' | 'md' | 'lg',
      customTexts: {
        semester: semesterName || 'I - Năm học 2025 - 2026',
        creatorName: 'Trần Thị Bích Ngọc',
        approverName: initialApproverName,
        approverTitle: 'XÁC NHẬN CỦA NHÀ TRƯỜNG',
        ubnd: 'ỦY BAN NHÂN DÂN',
        city: 'THÀNH PHỐ HỒ CHÍ MINH',
        school: 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN',
        title: 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN',
      }
    };
  });

  // Restore config from localStorage on mount or when template opens
  React.useEffect(() => {
    if (isOpen) {
      const savedConfig = localStorage.getItem('grading_pdf_config');
      const currentUser = tokenStorage.getUser();
      const defaultApproverName = currentUser?.user_name || currentUser?.username || 'NGƯỜI PHÊ DUYỆT';

      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          const savedApproverName = parsed.customTexts?.approverName;
          // Nếu cấu hình lưu trữ cũ là PGS.TS. NGUYỄN KHẮC HÙNG, di chuyển sang tên của user hiện tại
          const activeApproverName = (!savedApproverName || savedApproverName === 'PGS.TS. NGUYỄN KHẮC HÙNG' || savedApproverName === 'NGƯỜI PHÊ DUYỆT')
            ? defaultApproverName
            : savedApproverName;

          setPdfConfig(prev => ({
            ...prev,
            ...parsed,
            customTexts: {
              ...prev.customTexts,
              ...parsed.customTexts,
              semester: parsed.customTexts?.semester || semesterName || prev.customTexts.semester,
              approverName: activeApproverName
            }
          }));
        } catch (e) {
          console.error('Error parsing saved PDF config', e);
        }
      } else {
        setPdfConfig(prev => ({
          ...prev,
          customTexts: {
            ...prev.customTexts,
            approverName: defaultApproverName
          }
        }));
      }
    }
  }, [isOpen, semesterName]);

  const handleSaveConfig = () => {
    try {
      localStorage.setItem('grading_pdf_config', JSON.stringify(pdfConfig));
      toast.success('Đã lưu cấu hình thiết kế PDF thành công!', { duration: 3000 });
      setShowConfigPanel(false);
    } catch (error) {
      toast.error('Lỗi khi lưu cấu hình thiết kế');
    }
  };

  const handleCancelConfig = () => {
    const savedConfig = localStorage.getItem('grading_pdf_config');
    if (savedConfig) {
      try {
        setPdfConfig(JSON.parse(savedConfig));
      } catch (e) {
        // Fallback to defaults
      }
    }
    setShowConfigPanel(false);
  };

  // Setup Preview Mode variables
  const mockCounts = React.useMemo(() => getMockCounts(categories), [categories, getMockCounts]);
  const mockStudentScore = React.useMemo(() => calculateMockScore(categories, mockCounts), [categories, mockCounts, calculateMockScore]);

  const mockStudent: StudentData = React.useMemo(() => ({
    id: 'SV20269999',
    name: 'Nguyễn Văn A (Dữ liệu mẫu)',
    score: mockStudentScore,
    classId: 'CLASS_MOCK',
    semesterId: 'SEM_MOCK',
    departmentId: 'DEP_MOCK',
    summaryId: 'SUM_MOCK',
    dob: '2004-02-13'
  }), [mockStudentScore]);

  const previewStudents = showConfigPanel ? [mockStudent] : selectedStudents;

  const getStudentCounts = React.useCallback((studentId: string) => {
    if (showConfigPanel && studentId === mockStudent.id) {
      return mockCounts;
    }
    return evaluationCounts[studentId] || {};
  }, [showConfigPanel, mockStudent.id, mockCounts, evaluationCounts]);

  if (!isOpen) return null;

  // Helper to generate dynamic matching primary/light colors based on chosen theme
  const getThemeColors = (color: string) => {
    switch (color) {
      case '#10b981': // Emerald
        return { primary: '#10b981', light: '#ecfdf5', border: '#d1fae5', text: '#047857' };
      case '#475569': // Slate
        return { primary: '#475569', light: '#f8fafc', border: '#e2e8f0', text: '#334155' };
      case '#991b1b': // Burgundy
        return { primary: '#991b1b', light: '#fdf2f2', border: '#fde8e8', text: '#b91c1c' };
      case '#135bec': // Blue
      default:
        return { primary: '#135bec', light: '#eff6ff', border: '#dbeafe', text: '#1d4ed8' };
    }
  };

  const colors = getThemeColors(pdfConfig.themeColor);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Chưa rõ';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    let progress = 0;
    let status = 'Đang khởi tạo trình kết xuất...';

    const estimatedTime = Math.max(1800, selectedStudents.length * 1200);
    const intervalTime = 100;
    const totalSteps = estimatedTime / intervalTime;
    const progressPerStep = 95 / totalSteps;

    const updateProgressToast = (currentProgress: number, currentStatus: string) => {
      toast(
        <div className="w-full flex flex-col gap-1.5 p-1 min-w-[280px]">
          <div className="flex justify-between items-center text-[12.5px] font-semibold text-slate-700">
            <span className="truncate pr-2">{currentStatus}</span>
            <span className="text-emerald-600 font-bold font-mono text-[13px] shrink-0">
              {Math.round(currentProgress)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-0.5 border border-slate-200/40">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-100 ease-out"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>,
        {
          id: 'pdf-download',
          duration: Infinity,
        }
      );
    };

    updateProgressToast(progress, status);

    const progressInterval = setInterval(() => {
      if (progress < 95) {
        progress += progressPerStep;
        if (progress > 95) progress = 95;

        if (progress > 75) {
          status = 'Đang đóng gói file PDF...';
        } else if (progress > 45) {
          status = 'Puppeteer đang kết xuất bố cục Vector A4...';
        } else if (progress > 20) {
          status = 'Đang gửi dữ liệu và dựng giao diện ở Server...';
        }

        updateProgressToast(progress, status);
      }
    }, intervalTime);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const response = await fetch(`${API_BASE}/summaries-point/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedStudents,
          categories,
          evaluationCounts,
          semesterName,
          className,
          pdfConfig, // Gửi cấu hình tùy biến lên backend
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Không thể kết xuất PDF từ Server');
      }

      status = 'Đang tải xuống file PDF...';
      updateProgressToast(95, status);

      const blob = await response.blob();

      clearInterval(progressInterval);
      updateProgressToast(100, 'Tải xuống hoàn tất!');

      await new Promise(resolve => setTimeout(resolve, 300));

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phieu_diem_ren_luyen_${selectedStudents.length === 1 ? selectedStudents[0].id : 'hang_loat'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.dismiss('pdf-download');
      toast.success('Đã tải xuống file PDF thành công!', { duration: 3000 });
      setIsDownloading(false);
    } catch (error: any) {
      clearInterval(progressInterval);
      toast.dismiss('pdf-download');
      toast.error('Lỗi khi tải PDF: ' + error.message, { duration: 4000 });
      setIsDownloading(false);
    }
  };

  // HTML5 Drag and Drop Handlers for Custom Layout
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newOrder = [...pdfConfig.sectionsOrder];
    const [draggedItem] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    setPdfConfig(prev => ({
      ...prev,
      sectionsOrder: newOrder
    }));
  };

  const sectionLabels: Record<string, string> = {
    header: 'Quốc hiệu & Tên trường',
    title: 'Tiêu đề phiếu điểm',
    student_info: 'Thông tin cá nhân học sinh',
    criteria_1_2: 'Danh mục tiêu chí I & II',
    criteria_3: 'Danh mục tiêu chí III (Cộng đồng)',
    summary: 'Tổng điểm & Xếp loại chung',
    signatures: 'Chữ ký & Xác nhận đóng dấu',
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    header: <Layout size={14} className="text-blue-500" />,
    title: <Type size={14} className="text-purple-500" />,
    student_info: <SlidersHorizontal size={14} className="text-amber-500" />,
    criteria_1_2: <Printer size={14} className="text-emerald-500" />,
    criteria_3: <Printer size={14} className="text-teal-500" />,
    summary: <Palette size={14} className="text-rose-500" />,
    signatures: <Settings size={14} className="text-slate-500" />,
  };

  // Helper function to render a single section of a student's card
  const renderSection = (sectionName: string, student: StudentData, counts: Record<string, number>) => {
    if (pdfConfig.hiddenSections[sectionName]) return null;

    switch (sectionName) {
      case 'header':
        return (
          <div key="header" className="flex justify-between items-start border-b border-slate-100 pb-5 w-full shrink-0">
            <div className="text-center flex flex-col gap-0.5 w-[320px] shrink-0">
              <p className="font-medium text-[#1a1b1e] text-[13px] uppercase tracking-wide">
                <span
                  contentEditable={showConfigPanel}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newText = e.currentTarget.textContent || '';
                    setPdfConfig(prev => ({
                      ...prev,
                      customTexts: { ...prev.customTexts, ubnd: newText }
                    }));
                  }}
                  className={showConfigPanel ? "outline-none focus:ring-2 focus:ring-[#135bec]/40 focus:bg-blue-50/70 px-2 py-0.5 rounded-lg transition-all cursor-text border border-dashed border-blue-300 font-medium" : ""}
                  title={showConfigPanel ? "Nhấp chuột để sửa trực tiếp" : undefined}
                >
                  {pdfConfig.customTexts.ubnd}
                </span>
              </p>
              <p className="font-medium text-[#1a1b1e] text-[13px] uppercase tracking-wide">
                <span
                  contentEditable={showConfigPanel}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newText = e.currentTarget.textContent || '';
                    setPdfConfig(prev => ({
                      ...prev,
                      customTexts: { ...prev.customTexts, city: newText }
                    }));
                  }}
                  className={showConfigPanel ? "outline-none focus:ring-2 focus:ring-[#135bec]/40 focus:bg-blue-50/70 px-2 py-0.5 rounded-lg transition-all cursor-text border border-dashed border-blue-300 font-medium" : ""}
                  title={showConfigPanel ? "Nhấp chuột để sửa trực tiếp" : undefined}
                >
                  {pdfConfig.customTexts.city}
                </span>
              </p>
              <p className="font-bold text-[#1a1b1e] text-[13px] uppercase tracking-wide">
                <span
                  contentEditable={showConfigPanel}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newText = e.currentTarget.textContent || '';
                    setPdfConfig(prev => ({
                      ...prev,
                      customTexts: { ...prev.customTexts, school: newText }
                    }));
                  }}
                  style={{ whiteSpace: 'pre-line' }}
                  className={showConfigPanel ? "outline-none focus:ring-2 focus:ring-[#135bec]/40 focus:bg-blue-50/70 px-2 py-0.5 rounded-lg transition-all cursor-text border border-dashed border-blue-300 font-bold block" : "block"}
                  title={showConfigPanel ? "Nhấp chuột để sửa trực tiếp" : undefined}
                >
                  {pdfConfig.customTexts.school}
                </span>
              </p>
            </div>
            <div className="text-center flex flex-col gap-0.5 w-[320px] shrink-0">
              <p className="font-bold text-[#1a1b1e] text-[13px] uppercase tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold text-[#1a1b1e] text-[13px] tracking-wide">Độc lập - Tự do - Hạnh phúc</p>
            </div>
          </div>
        );

      case 'title':
        return (
          <div key="title" className="text-center py-5 flex flex-col gap-1 w-full mt-1 shrink-0">
            <h2 className="font-bold text-slate-900 text-[14px] tracking-tight uppercase leading-snug">
              <span
                contentEditable={showConfigPanel}
                suppressContentEditableWarning
                onBlur={(e) => {
                  const newText = e.currentTarget.textContent || '';
                  setPdfConfig(prev => ({
                    ...prev,
                    customTexts: { ...prev.customTexts, title: newText }
                  }));
                }}
                className={showConfigPanel ? "outline-none focus:ring-2 focus:ring-[#135bec]/40 focus:bg-blue-50/70 px-2 py-0.5 rounded-lg transition-all cursor-text border border-dashed border-blue-300 font-bold" : ""}
                title={showConfigPanel ? "Nhấp chuột để sửa trực tiếp" : undefined}
              >
                {pdfConfig.customTexts.title}
              </span>
            </h2>
            <p className="font-medium text-slate-500 text-[14px] italic">
              Học kỳ:{' '}
              <span
                contentEditable={showConfigPanel}
                suppressContentEditableWarning
                onBlur={(e) => {
                  const newText = e.currentTarget.textContent || '';
                  setPdfConfig(prev => ({
                    ...prev,
                    customTexts: { ...prev.customTexts, semester: newText }
                  }));
                }}
                className={showConfigPanel ? "outline-none focus:ring-2 focus:ring-[#135bec]/40 focus:bg-blue-50/70 px-2 py-0.5 rounded-lg transition-all cursor-text border border-dashed border-blue-300 font-semibold" : ""}
                title={showConfigPanel ? "Click để sửa học kỳ trực tiếp" : undefined}
              >
                {pdfConfig.customTexts.semester}
              </span>
            </p>
          </div>
        );

      case 'student_info':
        // Dữ liệu API (Tên, DOB, Lớp, MSSV) chỉ cho phép kéo thả vị trí, KHÔNG có contentEditable (không cho sửa)
        return (
          <div key="student_info" className="bg-[#f8fafc] border border-slate-100 rounded-2xl p-4.5 grid grid-cols-2 gap-x-8 gap-y-2.5 w-full mb-2 shrink-0 select-none">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-slate-500 min-w-[100px]">Họ và tên HSSV:</span>
              <span className="font-bold text-slate-800">{student.name}</span>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-slate-500 min-w-[80px]">Ngày sinh:</span>
              <span className="font-medium text-slate-800">{formatDate(student.dob) || '13/02/2004'}</span>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-slate-500 min-w-[100px]">Lớp học:</span>
              <span className="font-semibold text-slate-800">{className}</span>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-slate-500 min-w-[80px]">Mã HSSV:</span>
              <span className="font-bold text-slate-800 font-mono">{student.id}</span>
            </div>
          </div>
        );

      case 'criteria_1_2':
        // Dữ liệu bảng điểm tiêu chí từ API động, tự động ngắt trang mượt mà
        return (
          <div key="criteria_1_2" className="flex flex-col gap-4 w-full select-none">
            {categories.map((cat) => {
              let catScore = 0;
              cat.items.forEach(item => {
                const count = counts[item.id] || 0;
                const maxScore = item.maxScore || 10;
                const minScore = item.minScore || 0;
                const criterionScore = item.pointsPerUnit >= 0
                  ? Math.max(minScore, Math.min(maxScore, count * item.pointsPerUnit))
                  : Math.max(-maxScore, Math.min(0, count * item.pointsPerUnit));
                catScore += criterionScore;
              });
              const clampedScore = Math.max(0, Math.min(cat.maxPoints, catScore));

              return (
                <div key={cat.id} className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm w-full bg-white break-inside-avoid page-break-inside-avoid" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <div className="bg-[#f8fafc] border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between w-full gap-2">
                    <span className="font-bold text-slate-800 text-[12.5px] uppercase">
                      {cat.code ? `${cat.code}. ` : ''}{cat.title}
                    </span>
                    <div className="flex flex-col items-end text-right shrink-0 gap-2">
                      <span className="font-bold text-[#5f6368] text-[9.5px] tracking-wide uppercase leading-none">
                        Điểm đạt: {clampedScore}đ
                      </span>
                      <span className="font-bold text-slate-400 text-[8.5px] tracking-wide uppercase leading-none">
                        Tối đa: {cat.maxPoints}đ
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-4 py-1.5 text-[9.5px] font-bold text-slate-400 uppercase w-[520px]">Nội dung đánh giá</th>
                        <th className="px-4 py-1.5 text-[9.5px] font-bold text-slate-400 uppercase text-right w-[110px]">Điểm đạt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700 font-medium">
                      {cat.items.map(item => {
                        const count = counts[item.id] || 0;
                        const maxScore = item.maxScore || 10;
                        const minScore = item.minScore || 0;
                        const criterionScore = item.pointsPerUnit >= 0
                          ? Math.max(minScore, Math.min(maxScore, count * item.pointsPerUnit))
                          : Math.max(-maxScore, Math.min(0, count * item.pointsPerUnit));
                        const sign = criterionScore > 0 ? '+' : '';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 leading-relaxed">{item.name}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-[var(--pdf-primary)] font-mono text-[12.5px]">
                              {sign}{criterionScore.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        );

      case 'criteria_3':
        // Đã được gộp toàn bộ vào criteria_1_2 phía trên để tự động phân trang tự nhiên
        return null;

      case 'summary':
        // Tổng điểm rèn luyện (lấy từ dữ liệu API) không cho phép sửa, chỉ hiển thị
        return (
          <div key="summary" className="bg-[var(--pdf-light)] border border-[var(--pdf-border)] rounded-2xl p-4.5 flex items-center justify-between w-full mt-2 shadow-sm shrink-0 select-none">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-800 text-[14px]">TỔNG ĐIỂM RÈN LUYỆN CHUNG:</span>
              <span className="text-[11.5px] text-[var(--pdf-text)] font-semibold">Tự động cộng các danh mục điểm đạt</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-black text-[var(--pdf-primary)] text-[22px] font-mono leading-none">
                {student.score} / 100đ
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--pdf-border)] text-[var(--pdf-text)] uppercase tracking-wide">
                Xếp loại: {
                  student.score >= 90 ? 'Xuất sắc' :
                    student.score >= 80 ? 'Tốt' :
                      student.score >= 70 ? 'Khá' :
                        student.score >= 50 ? 'Trung bình' : 'Yếu'
                }
              </span>
            </div>
          </div>
        );

      case 'signatures':
        return (
          <div key="signatures" className="mt-8 pt-6 w-full border-t border-dashed border-slate-200 shrink-0">
            <div className="grid grid-cols-2 gap-12 w-full text-center">
              <div className="flex flex-col items-center gap-14">
                <p className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wide">HỌC SINH, SINH VIÊN</p>
                <div className="flex flex-col gap-1">
                  <p className="font-black text-slate-800 text-[13px]">
                    {student.name}
                  </p>
                  <p className="text-[10px] text-slate-400 italic font-semibold">(Ký và ghi rõ họ tên)</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-14">
                <p className="font-bold text-slate-800 text-[12.5px] uppercase tracking-wide">
                  <span
                    contentEditable={showConfigPanel}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newText = e.currentTarget.textContent || '';
                      setPdfConfig(prev => ({
                        ...prev,
                        customTexts: { ...prev.customTexts, approverTitle: newText }
                      }));
                    }}
                    className={showConfigPanel ? "outline-none focus:ring-2 focus:ring-[#135bec]/40 focus:bg-blue-50/70 px-2 py-0.5 rounded-lg transition-all cursor-text border border-dashed border-blue-300 uppercase font-bold" : ""}
                    title={showConfigPanel ? "Click để sửa chức vụ trực tiếp" : undefined}
                  >
                    {pdfConfig.customTexts.approverTitle}
                  </span>
                </p>
                <div className="flex flex-col gap-1">
                  <p className="font-black text-slate-800 text-[13px] uppercase">
                    <span
                      contentEditable={showConfigPanel}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const newText = e.currentTarget.textContent || '';
                        setPdfConfig(prev => ({
                          ...prev,
                          customTexts: { ...prev.customTexts, approverName: newText }
                        }));
                      }}
                      className={showConfigPanel ? "outline-none focus:ring-2 focus:ring-[#135bec]/40 focus:bg-blue-50/70 px-2 py-0.5 rounded-lg transition-all cursor-text border border-dashed border-blue-300" : ""}
                      title={showConfigPanel ? "Click để sửa tên trực tiếp" : undefined}
                    >
                      {pdfConfig.customTexts.approverName}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400 italic font-semibold">(Ký và ghi rõ họ tên)</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm no-print p-4">
      {/* Dynamic style generation mapping variables to selected theme configuration */}
      <style>{`
        @import url('https://fonts.cdnfonts.com/css/times-new-roman');
        .print-area {
          --pdf-primary: ${colors.primary};
          --pdf-light: ${colors.light};
          --pdf-border: ${colors.border};
          --pdf-text: ${colors.text};
          font-family: ${pdfConfig.fontFamily === 'Times New Roman'
          ? "'Times New Roman', Times, serif"
          : pdfConfig.fontFamily === 'Inter'
            ? "'Inter', sans-serif"
            : pdfConfig.fontFamily === 'Roboto'
              ? "'Roboto', sans-serif"
              : "'Playfair Display', serif"
        } !important;
          font-size: ${pdfConfig.fontSize === 'sm' ? '12px' : pdfConfig.fontSize === 'lg' ? '16px' : '14px'} !important;
        }

        /* Override modern Tailwind classes inside preview area for print compatibility */
        .print-area .bg-\\[\\#135bec\\] { background-color: var(--pdf-primary) !important; }
        .print-area .text-\\[\\#135bec\\] { color: var(--pdf-primary) !important; }
        .print-area .border-\\[\\#135bec\\] { border-color: var(--pdf-primary) !important; }
        
        .print-area .text-\\[\\#1a1b1e\\] { color: #1a1b1e !important; }
        .print-area .text-\\[\\#5f6368\\] { color: #5f6368 !important; }
        
        .print-area .bg-\\[\\#f8fafc\\] { background-color: #f8fafc !important; }
        .print-area .bg-\\[\\#eff6ff\\] { background-color: var(--pdf-light) !important; }
        
        .print-area .text-slate-900 { color: #0f172a !important; }
        .print-area .text-slate-800 { color: #1e293b !important; }
        .print-area .text-slate-700 { color: #334155 !important; }
        .print-area .text-slate-500 { color: #64748b !important; }
        .print-area .text-slate-400 { color: #94a3b8 !important; }
        
        .print-area .border-slate-100 { border-color: #f1f5f9 !important; }
        .print-area .border-slate-200 { border-color: #e2e8f0 !important; }
        .print-area .border-slate-200\\/80 { border-color: #e2e8f0 !important; }
        
        .print-area .bg-blue-50 { background-color: var(--pdf-light) !important; }
        .print-area .bg-blue-100 { background-color: var(--pdf-border) !important; }
        .print-area .border-blue-100 { border-color: var(--pdf-border) !important; }
        .print-area .text-blue-600 { color: var(--pdf-primary) !important; }
        .print-area .text-blue-700 { color: var(--pdf-primary) !important; }
        .print-area .text-blue-800 { color: var(--pdf-text) !important; }
        .print-area .text-blue-900 { color: var(--pdf-text) !important; }
        
        .print-area .divide-slate-100 > * + * { border-color: #f1f5f9 !important; }

        .print-footer {
          position: absolute;
          bottom: 38px;
          left: 60px;
          right: 60px;
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: white;
          z-index: 50;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            background: white !important;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .print-footer {
            position: fixed;
            bottom: 10mm;
            left: 16mm;
            right: 16mm;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: white;
            z-index: 9999;
          }
        }
      `}</style>

      {/* Modal Container with Dynamic width scaling when customization panel is active */}
      <div className={`bg-[#f0f2f5] w-full h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200 transition-all duration-300 ${showConfigPanel ? 'max-w-[1280px]' : 'max-w-[960px]'
        }`}>

        {/* Modal Header */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
              <Printer size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-[15px]">Xem trước bản in PDF</h3>
              <p className="text-[12px] text-slate-400 font-medium">Xuất phiếu điểm rèn luyện cho {selectedStudents.length} sinh viên đã chọn</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {showConfigPanel ? (
              <>
                <button
                  onClick={handleCancelConfig}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Hủy bỏ</span>
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="bg-[#135bec] hover:bg-blue-700 text-white font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  <SlidersHorizontal size={14} strokeWidth={2.5} />
                  <span>Lưu cấu hình</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowConfigPanel(true)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <SlidersHorizontal size={14} strokeWidth={2.5} />
                  <span>Tùy chỉnh</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                >
                  {isDownloading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} strokeWidth={2.5} />
                  )}
                  <span>{isDownloading ? 'Đang xuất PDF...' : 'Tải xuống PDF'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-[#135bec] hover:bg-blue-700 text-white font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  <Printer size={14} strokeWidth={2.5} />
                  <span>In / Lưu PDF</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Main Workspace Area */}
        <div className="flex-1 flex overflow-hidden">

          {/* Customizer Sidebar */}
          {showConfigPanel && (
            <div className="w-[360px] bg-white border-r border-slate-200 overflow-y-auto p-5 flex flex-col gap-6 shrink-0 custom-scrollbar select-none">

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-100 pb-1 w-full gap-2 shrink-0">
                {(['layout', 'data', 'style'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-all capitalize border ${activeTab === tab
                      ? 'bg-blue-50 border-blue-200 text-[#135bec]'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {tab === 'layout' ? 'Bố cục' : tab === 'data' ? 'Văn bản' : 'Giao diện'}
                  </button>
                ))}
              </div>

              {/* Tab Content: Bố cục */}
              {activeTab === 'layout' && (
                <div className="flex flex-col gap-4 flex-1">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[13px] mb-1">Kéo thả sắp xếp thứ tự</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Nhấp giữ và kéo các khối để thay đổi thứ tự in ấn</p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {pdfConfig.sectionsOrder.map((section, idx) => (
                      <div
                        key={section}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between transition-all cursor-grab active:cursor-grabbing group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <GripVertical size={14} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                          <div className="flex items-center gap-2">
                            {sectionIcons[section]}
                            <span className="font-bold text-slate-700 text-[12px]">
                              {sectionLabels[section]}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setPdfConfig(prev => ({
                              ...prev,
                              hiddenSections: {
                                ...prev.hiddenSections,
                                [section]: !prev.hiddenSections[section]
                              }
                            }));
                          }}
                          className={`p-1.5 rounded-lg border transition-all ${pdfConfig.hiddenSections[section]
                            ? 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100'
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                            }`}
                          title={pdfConfig.hiddenSections[section] ? "Hiển thị lại" : "Tạm ẩn đi"}
                        >
                          {pdfConfig.hiddenSections[section] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Content: Dữ liệu & Văn bản */}
              {activeTab === 'data' && (
                <div className="flex flex-col gap-5 flex-1">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[13px] mb-1">Nội dung văn bản tùy chỉnh</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Thay đổi các tiêu đề tĩnh trên bản in PDF</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Cơ quan chủ quản (UBND)</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.ubnd}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, ubnd: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Tỉnh / Thành phố chủ quản</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.city}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, city: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Tên trường học</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.school}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, school: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Tiêu đề chính của phiếu điểm</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.title}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, title: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[14px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Học kỳ hiển thị</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.semester}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, semester: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Tên người lập biểu (Người ký 1)</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.creatorName}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, creatorName: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Chức danh người phê duyệt (Người ký 2)</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.approverTitle}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, approverTitle: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Tên người phê duyệt (Người ký 2)</label>
                      <input
                        type="text"
                        value={pdfConfig.customTexts.approverName}
                        onChange={(e) => {
                          setPdfConfig(prev => ({
                            ...prev,
                            customTexts: { ...prev.customTexts, approverName: e.target.value }
                          }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#135bec] outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Giao diện (Theme & Style) */}
              {activeTab === 'style' && (
                <div className="flex flex-col gap-5 flex-1">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[13px] mb-1">Kiểu dáng & Tông màu</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Tự do thay đổi màu sắc, phông chữ bản in</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-slate-500">Tông màu chủ đạo</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { name: 'Blue', color: '#135bec' },
                          { name: 'Emerald', color: '#10b981' },
                          { name: 'Slate', color: '#475569' },
                          { name: 'Burgundy', color: '#991b1b' },
                        ].map((item) => (
                          <button
                            key={item.color}
                            onClick={() => {
                              setPdfConfig(prev => ({ ...prev, themeColor: item.color }));
                            }}
                            className={`h-9 rounded-xl relative border transition-all ${pdfConfig.themeColor === item.color
                              ? 'border-[#135bec] ring-2 ring-blue-500/20 scale-105 shadow-md'
                              : 'border-slate-200 hover:scale-102 hover:border-slate-400'
                              }`}
                            style={{ backgroundColor: item.color }}
                            title={item.name}
                          >
                            {pdfConfig.themeColor === item.color && (
                              <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-white shadow-sm" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Phông chữ</label>
                      <select
                        value={pdfConfig.fontFamily}
                        onChange={(e) => {
                          setPdfConfig(prev => ({ ...prev, fontFamily: e.target.value }));
                        }}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer shadow-sm transition-all"
                      >
                        <option value="Times New Roman">Times New Roman (Bản xứ - Khuyên dùng)</option>
                        <option value="Inter">Inter (Hiện đại)</option>
                        <option value="Roboto">Roboto (Hiện đại gọn)</option>
                        <option value="Playfair Display">Playfair Display (Cổ điển)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500">Cỡ chữ tổng thể</label>
                      <div className="flex border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {(['sm', 'md', 'lg'] as const).map((sz) => (
                          <button
                            key={sz}
                            onClick={() => {
                              setPdfConfig(prev => ({ ...prev, fontSize: sz }));
                            }}
                            className={`flex-1 py-1.5 text-[11px] font-bold transition-all ${pdfConfig.fontSize === sz
                              ? 'bg-slate-100 text-slate-800'
                              : 'bg-white text-slate-400 hover:text-slate-600'
                              }`}
                          >
                            {sz === 'sm' ? 'Nhỏ' : sz === 'md' ? 'Vừa' : 'Lớn'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scrollable Preview Area */}
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 custom-scrollbar bg-[#f0f2f5]">

            {/* Vùng in ấn thực tế (chuẩn A4) */}
            <div className="print-area flex flex-col gap-8 w-[794px] shrink-0">
              {previewStudents.map((student) => {
                const counts = getStudentCounts(student.id);

                return (
                  <div key={student.id} className="flex flex-col gap-8 w-[794px] print:gap-0">
                    {/* ====== TRANG IN ẤN CO GIÃN TỰ ĐỘNG CHUẨN A4 ====== */}
                    <div className="bg-white w-[794px] min-h-[1123px] p-[55px_60px_83px_60px] flex flex-col justify-between shadow-md border border-slate-100 relative box-border">
                      {/* Background Decorative */}
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0">
                        <div className="absolute bg-[var(--pdf-primary)] blur-[80px] bottom-[-150px] left-[-100px] rounded-full w-[350px] h-[350px]" />
                      </div>

                      <div className="relative z-10 flex flex-col flex-1 gap-5 text-left">
                        {pdfConfig.sectionsOrder.map((sectionName, idx) => {
                          return (
                            <div
                              key={sectionName}
                              draggable={showConfigPanel}
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, idx)}
                              className={`group relative transition-all duration-200 break-inside-avoid page-break-inside-avoid ${showConfigPanel
                                ? 'hover:ring-2 hover:ring-[#135bec]/30 hover:bg-blue-50/10 rounded-xl p-1 cursor-grab active:cursor-grabbing border border-transparent hover:border-blue-200/50'
                                : ''
                                }`}
                              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                            >
                              {showConfigPanel && (
                                <div className="absolute top-1 right-1 bg-[#135bec] text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none shadow flex items-center gap-1 text-[9px] font-bold">
                                  <span>Bố cục</span>
                                </div>
                              )}
                              {renderSection(sectionName, student, counts)}
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      <div className="border-t border-slate-200 pt-3 flex items-center justify-between w-full relative z-10 shrink-0 mt-8">
                        <span className="font-semibold text-slate-400 text-[9px] tracking-wider uppercase">
                          EDUPOINT MANAGEMENT SYSTEM - LƯU HÀNH NỘI BỘ
                        </span>
                        <span className="font-bold text-slate-700 text-[10.5px]">Phiếu điểm rèn luyện HSSV</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
