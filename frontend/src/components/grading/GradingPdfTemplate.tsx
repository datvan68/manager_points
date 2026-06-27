'use client';

import React from 'react';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { summariesPointApi } from '@/api/summaries-point-api';
import { buildPdfPayloads, type NormalizedEvalDetail, type NormalizedCriterion } from '@/utils/pdf-score-utils';

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
  evaluationCounts: Record<string, Record<string, number | NormalizedEvalDetail>>;
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

  const payloads = React.useMemo(() => {
    if (!isOpen) return [];
    return buildPdfPayloads(selectedStudents, categories, evaluationCounts, semesterName, className);
  }, [isOpen, selectedStudents, categories, evaluationCounts, semesterName, className]);

  if (!isOpen) return null;

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
      const blob = await summariesPointApi.exportPdf({ payloads });

      status = 'Đang tải xuống file PDF...';
      updateProgressToast(95, status);

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

  const semesterParts = (semesterName || '').split('-');
  const termStr = semesterParts[0]?.trim() || '';
  const yearStr = semesterParts.slice(1).join('-')?.trim() || '';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm no-print p-4">
      <style>{`
        @import url('https://fonts.cdnfonts.com/css/times-new-roman');
        .print-area {
          font-family: 'Times New Roman', Times, serif !important;
          color: black !important;
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
        }
      `}</style>

      <div className="bg-[#f0f2f5] w-full h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200 max-w-[960px]">
        {/* Modal Header */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shadow-sm">
              <Printer size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-[15px]">Xem trước bản in PDF</h3>
              <p className="text-[12px] text-slate-500 font-medium">Xuất phiếu điểm rèn luyện PL01 cho {selectedStudents.length} sinh viên</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
              className="bg-[#1a1b1e] hover:bg-black text-white font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-black/20 cursor-pointer"
            >
              <Printer size={14} strokeWidth={2.5} />
              <span>In / Lưu PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer ml-2"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-8 custom-scrollbar bg-[#f0f2f5]">
          <div className="print-area flex flex-col gap-8 w-[794px] shrink-0">
            {payloads.map((payload, idx) => {
              const { student, categories: mappedCategories, summary } = payload;
              return (
                <div key={student.id} className={`flex flex-col gap-8 w-[794px] print:gap-0 bg-white border border-slate-300 shadow-sm print:border-none print:shadow-none ${idx > 0 ? 'page-break' : ''}`}>
                  <div 
                    className="page box-border w-[794px] min-h-[1123px] relative mx-auto bg-white" 
                    style={{
                      padding: '15mm 20mm 20mm 20mm',
                      fontFamily: '"Times New Roman", Times, serif',
                      fontSize: '13pt',
                      color: 'black',
                      lineHeight: '1.3'
                    }}
                  >
                    <table style={{ width: '100%', border: 'none', marginBottom: '10px' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '40%', textAlign: 'center', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'normal', fontSize: '13pt' }}>ỦY BAN NHÂN DÂN</div>
                            <div style={{ fontWeight: 'normal', fontSize: '13pt' }}>THÀNH PHỐ HỒ CHÍ MINH</div>
                            <div style={{ fontWeight: 'bold', fontSize: '13pt', textTransform: 'uppercase' }}>TRƯỜNG CAO ĐẲNG BÁCH KHOA<br/>NAM SÀI GÒN</div>
                          </td>
                          <td style={{ width: '60%', textAlign: 'center', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                            <div style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline' }}>Độc lập - Tự do - Hạnh phúc</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ textAlign: 'center', margin: '20px 0' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14pt' }}>PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN</div>
                    </div>

                    <table style={{ width: '100%', border: 'none', marginBottom: '10px', fontSize: '13pt' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '75%' }}><span style={{ whiteSpace: 'nowrap' }}>Họ và tên học sinh, sinh viên: </span><span style={{ fontWeight: 'bold' }}>{student.name}</span></td>
                          <td style={{ width: '25%' }}><span style={{ whiteSpace: 'nowrap' }}>Ngày sinh: </span><span style={{ fontWeight: 'normal' }}>{student.dob || '......./......./..............'}</span></td>
                        </tr>
                        <tr>
                          <td><span style={{ whiteSpace: 'nowrap' }}>Lớp: </span><span style={{ fontWeight: 'normal' }}>{className}</span></td>
                          <td><span style={{ whiteSpace: 'nowrap' }}>Mã SV: </span><span style={{ fontWeight: 'normal' }}>{student.studentCode}</span></td>
                        </tr>
                        <tr>
                          <td><span style={{ whiteSpace: 'nowrap' }}>Học kỳ: </span><span style={{ fontWeight: 'normal' }}>{termStr}</span></td>
                          <td><span style={{ whiteSpace: 'nowrap' }}>Năm học: </span><span style={{ fontWeight: 'normal' }}>{yearStr}</span></td>
                        </tr>
                      </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '12pt', marginBottom: '20px' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid black', padding: '4px', width: '5%' }}>STT</th>
                          <th style={{ border: '1px solid black', padding: '4px', width: '60%' }}>NỘI DUNG ĐÁNH GIÁ</th>
                          <th style={{ border: '1px solid black', padding: '4px', width: '10%' }}>Điểm tối đa</th>
                          <th style={{ border: '1px solid black', padding: '4px', width: '10%' }}>Điểm đạt được</th>
                          <th style={{ border: '1px solid black', padding: '4px', width: '15%' }}>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappedCategories.map((cat) => {
                          return (
                            <React.Fragment key={cat.id}>
                              <tr>
                                <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '4px' }}>{cat.code || ''}</td>
                                <td style={{ border: '1px solid black', fontWeight: 'bold', padding: '4px' }}>{cat.title}</td>
                                <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '4px' }}>{cat.maxPoints || ''}</td>
                                <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '4px' }}>{cat.achievedScore}</td>
                                <td style={{ border: '1px solid black', padding: '4px' }}></td>
                              </tr>
                              {cat.items.map((item: any) => {
                                return (
                                  <tr key={item.id} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                    <td style={{ border: '1px solid black', textAlign: 'center', padding: '4px' }}>{item.index}</td>
                                    <td style={{ border: '1px solid black', padding: '4px' }}>{item.name}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center', padding: '4px' }}>{item.maxScore}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center', padding: '4px' }}>{item.achievedScore}</td>
                                    <td style={{ border: '1px solid black', padding: '4px' }}></td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        
                        <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <td colSpan={3} style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', padding: '4px' }}>Tổng cộng: I, II, III, IV, V</td>
                          <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '4px' }}>{summary.coreTotal}</td>
                          <td style={{ border: '1px solid black', padding: '4px' }}></td>
                        </tr>
                        <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <td colSpan={3} style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', padding: '4px' }}>Tổng cộng điểm thưởng</td>
                          <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '4px' }}>{summary.bonusTotal}</td>
                          <td style={{ border: '1px solid black', padding: '4px' }}></td>
                        </tr>
                        <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <td colSpan={3} style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', padding: '4px' }}>Tổng cộng: I, II, III, IV, V, VI (Không quá 100 điểm)</td>
                          <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '4px' }}>{summary.finalTotal}</td>
                          <td style={{ border: '1px solid black', padding: '4px' }}></td>
                        </tr>
                        <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <td colSpan={3} style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', padding: '4px' }}>Xếp loại rèn luyện</td>
                          <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '4px' }}>{summary.classification}</td>
                          <td style={{ border: '1px solid black', padding: '4px' }}></td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <table style={{ width: '45%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '11pt', marginBottom: '20px' }}>
                        <tbody>
                          <tr><td style={{ border: '1px solid black', padding: '2px 4px' }}>Từ 90 đến 100</td><td style={{ border: '1px solid black', padding: '2px 4px' }}>Xuất sắc</td></tr>
                          <tr><td style={{ border: '1px solid black', padding: '2px 4px' }}>Từ 80 đến dưới 90</td><td style={{ border: '1px solid black', padding: '2px 4px' }}>Tốt</td></tr>
                          <tr><td style={{ border: '1px solid black', padding: '2px 4px' }}>Từ 70 đến dưới 80</td><td style={{ border: '1px solid black', padding: '2px 4px' }}>Khá</td></tr>
                          <tr><td style={{ border: '1px solid black', padding: '2px 4px' }}>Từ 50 đến dưới 70</td><td style={{ border: '1px solid black', padding: '2px 4px' }}>Trung bình</td></tr>
                          <tr><td style={{ border: '1px solid black', padding: '2px 4px' }}>Dưới 50</td><td style={{ border: '1px solid black', padding: '2px 4px' }}>Yếu</td></tr>
                        </tbody>
                      </table>

                      <table style={{ width: '100%', border: 'none', fontSize: '13pt' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 'bold' }}>HỌC SINH, SINH VIÊN</div>
                              <div style={{ fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</div>
                              <div style={{ height: '60px' }}></div>
                              <div style={{ fontWeight: 'bold' }}>{student.name}</div>
                            </td>
                            <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top' }}>
                              <div>........, Ngày ..... tháng ..... năm 20.....</div>
                              <div style={{ fontWeight: 'bold', fontSize: '10pt', whiteSpace: 'nowrap' }}>GIÁO VIÊN CHỦ NHIỆM/CỐ VẤN HỌC TẬP</div>
                              <div style={{ fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</div>
                              <div style={{ height: '60px' }}></div>
                              <div style={{ fontWeight: 'bold' }}></div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
