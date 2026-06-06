import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SummaryPoint,
  SummaryPointDocument,
} from './schemas/summary-point.schema';
import { CreateSummaryPointDto } from './dto/create-summary-point.dto';
import { UpdateSummaryPointDto } from './dto/update-summary-point.dto';

@Injectable()
export class SummariesPointService {
  constructor(
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
  ) {}

  async create(
    createSummaryPointDto: CreateSummaryPointDto,
  ): Promise<SummaryPoint> {
    const created = new this.summaryPointModel(createSummaryPointDto);
    return created.save();
  }

  async findAll(): Promise<SummaryPoint[]> {
    return this.summaryPointModel
      .find()
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();
  }

  async findOne(id: string): Promise<SummaryPoint> {
    const summaryPoint = await this.summaryPointModel
      .findById(id)
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();
    if (!summaryPoint) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return summaryPoint;
  }

  async update(
    id: string,
    updateSummaryPointDto: UpdateSummaryPointDto,
  ): Promise<SummaryPoint> {
    const updated = await this.summaryPointModel
      .findByIdAndUpdate(id, updateSummaryPointDto, { returnDocument: 'after' })
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();
    if (!updated) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<SummaryPoint> {
    const deleted = await this.summaryPointModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return deleted;
  }

  async generatePdf(
    selectedStudents: any[],
    categories: any[],
    evaluationCounts: any,
    semesterName: string,
    className: string,
    pdfConfig?: any,
  ): Promise<Buffer> {
    // Dynamically require puppeteer at runtime to support backend initialization
    const puppeteer = require('puppeteer');
    const htmlContent = this.generateHtml(
      selectedStudents,
      categories,
      evaluationCounts,
      semesterName,
      className,
      pdfConfig,
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'load' });

      // Render to A4 PDF with full-bleed background colors (margin: 0)
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  private generateHtml(
    selectedStudents: any[],
    categories: any[],
    evaluationCounts: any,
    semesterName: string,
    className: string,
    pdfConfig?: any,
  ): string {
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

    // Set fallback default config if not provided by the client
    const config = pdfConfig || {
      sectionsOrder: [
        'header',
        'title',
        'student_info',
        'criteria_1_2',
        'criteria_3',
        'summary',
        'signatures',
      ],
      hiddenSections: {},
      themeColor: '#135bec',
      fontFamily: 'Times New Roman',
      fontSize: 'md',
      customTexts: {
        semester: semesterName || 'I - Năm học 2025 - 2026',
        creatorName: 'Trần Thị Bích Ngọc',
        approverName: 'NGƯỜI PHÊ DUYỆT',
        approverTitle: 'XÁC NHẬN CỦA NHÀ TRƯỜNG',
        ubnd: 'ỦY BAN NHÂN DÂN',
        city: 'THÀNH PHỐ HỒ CHÍ MINH',
        school: 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN',
        title: 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN',
      },
    };

    const customTexts = config.customTexts || {
      semester: semesterName || 'I - Năm học 2025 - 2026',
      creatorName: 'Trần Thị Bích Ngọc',
      approverName: 'PGS.TS. NGUYỄN KHẮC HÙNG',
      approverTitle: 'XÁC NHẬN CỦA NHÀ TRƯỜNG',
      ubnd: 'ỦY BAN NHÂN DÂN',
      city: 'THÀNH PHỐ HỒ CHÍ MINH',
      school: 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN',
      title: 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN',
    };

    const hiddenSections = config.hiddenSections || {};
    const sectionsOrder = config.sectionsOrder || [
      'header',
      'title',
      'student_info',
      'criteria_1_2',
      'criteria_3',
      'summary',
      'signatures',
    ];

    // Helper to generate dynamic colors based on chosen theme
    const getThemeColors = (colorStr: string) => {
      switch (colorStr) {
        case '#10b981': // Emerald
          return {
            primary: '#10b981',
            light: '#ecfdf5',
            border: '#d1fae5',
            text: '#047857',
          };
        case '#475569': // Slate
          return {
            primary: '#475569',
            light: '#f8fafc',
            border: '#e2e8f0',
            text: '#334155',
          };
        case '#991b1b': // Burgundy
          return {
            primary: '#991b1b',
            light: '#fdf2f2',
            border: '#fde8e8',
            text: '#b91c1c',
          };
        case '#135bec': // Blue
        default:
          return {
            primary: '#135bec',
            light: '#eff6ff',
            border: '#dbeafe',
            text: '#1d4ed8',
          };
      }
    };

    const colors = getThemeColors(config.themeColor);

    // Dynamic rendering of each section to HTML
    const renderSectionHtml = (
      sectionName: string,
      student: any,
      counts: any,
    ) => {
      if (hiddenSections[sectionName]) return '';

      switch (sectionName) {
        case 'header':
          return `
            <div class="flex justify-between items-start border-b border-slate-100 pb-5 w-full shrink-0">
              <div class="text-center flex flex-col gap-0.5 w-[320px] shrink-0">
                <p class="font-medium text-[#1a1b1e] text-[13px] uppercase tracking-wide">${customTexts.ubnd || 'ỦY BAN NHÂN DÂN'}</p>
                <p class="font-medium text-[#1a1b1e] text-[13px] uppercase tracking-wide">${customTexts.city || 'THÀNH PHỐ HỒ CHÍ MINH'}</p>
                <p class="font-bold text-[#1a1b1e] text-[13px] uppercase tracking-wide" style="white-space: pre-line">${customTexts.school || 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN'}</p>
              </div>
              <div class="text-center flex flex-col gap-0.5 w-[320px] shrink-0">
                <p class="font-bold text-[#1a1b1e] text-[13px] uppercase tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p class="font-bold text-[#1a1b1e] text-[13px] tracking-wide">Độc lập - Tự do - Hạnh phúc</p>
              </div>
            </div>
          `;

        case 'title':
          return `
            <div class="text-center py-5 flex flex-col gap-1 w-full mt-1 shrink-0">
              <h2 class="font-bold text-slate-900 text-[14px] tracking-tight uppercase leading-snug">
                ${customTexts.title || 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN'}
              </h2>
              <p class="font-medium text-slate-500 text-[13px] italic">
                Học kỳ: ${customTexts.semester}
              </p>
            </div>
          `;

        case 'student_info':
          return `
            <div class="bg-[#f8fafc] border border-slate-100 rounded-2xl w-full mb-2 shrink-0" style="padding: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px; row-gap: 10px;">
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 110px; display: inline-block;">Họ và tên HSSV:</span>
                <span class="font-bold text-slate-800">${student.name}</span>
              </div>
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 90px; display: inline-block;">Ngày sinh:</span>
                <span class="font-medium text-slate-800">${formatDate(student.dob) || '13/02/2004'}</span>
              </div>
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 110px; display: inline-block;">Lớp học:</span>
                <span class="font-semibold text-slate-800">${className}</span>
              </div>
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 90px; display: inline-block;">Mã HSSV:</span>
                <span class="font-bold text-slate-800 font-mono">${student.id}</span>
              </div>
            </div>
          `;

        case 'criteria_1_2':
          let allCategoriesHtml = '';
          categories.forEach((cat) => {
            let catScore = 0;
            cat.items.forEach((item: any) => {
              const count = counts[item.id] || 0;
              const maxScore = item.maxScore || item.max_score || 10;
              const minScore = item.minScore || item.min_score || 0;
              const criterionScore = item.pointsPerUnit >= 0
                ? Math.max(minScore, Math.min(maxScore, count * item.pointsPerUnit))
                : Math.max(-maxScore, Math.min(0, count * item.pointsPerUnit));
              catScore += criterionScore;
            });
            const clampedScore = Math.max(0, Math.min(cat.maxPoints, catScore));

            let itemsTrHtml = '';
            cat.items.forEach((item: any) => {
              const count = counts[item.id] || 0;
              const maxScore = item.maxScore || item.max_score || 10;
              const minScore = item.minScore || item.min_score || 0;
              const criterionScore = item.pointsPerUnit >= 0
                ? Math.max(minScore, Math.min(maxScore, count * item.pointsPerUnit))
                : Math.max(-maxScore, Math.min(0, count * item.pointsPerUnit));
              const sign = criterionScore > 0 ? '+' : '';
              itemsTrHtml += `
                <tr class="hover:bg-slate-50/50">
                  <td class="px-4 py-2.5 leading-relaxed text-left">${item.name}</td>
                  <td class="px-4 py-2.5 text-right font-bold text-[var(--pdf-primary)] font-mono text-[12.5px]">
                    ${sign}${criterionScore.toFixed(1)}
                  </td>
                </tr>
              `;
            });

            allCategoriesHtml += `
              <div class="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm w-full mb-3 break-inside-avoid" style="break-inside: avoid; page-break-inside: avoid; background-color: white;">
                <div class="bg-[#f8fafc] border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between w-full gap-2">
                  <span class="font-bold text-slate-800 text-[12.5px] uppercase">
                    ${cat.code ? `${cat.code}. ` : ''}${cat.title}
                  </span>
                  <div class="flex flex-col items-end text-right shrink-0 gap-2">
                    <span class="font-bold text-[#5f6368] text-[9.5px] tracking-wide uppercase leading-none">
                      Điểm đạt: ${clampedScore}đ
                    </span>
                    <span class="font-bold text-slate-400 text-[8.5px] tracking-wide uppercase leading-none">
                      Tối đa: ${cat.maxPoints}đ
                    </span>
                  </div>
                </div>
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-white border-b border-slate-100">
                      <th class="px-4 py-1.5 text-[9.5px] font-bold text-slate-400 uppercase w-[520px]">Nội dung đánh giá</th>
                      <th class="px-4 py-1.5 text-[9.5px] font-bold text-slate-400 uppercase text-right w-[110px]">Điểm đạt</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-[12px] text-slate-700 font-medium">
                    ${itemsTrHtml}
                  </tbody>
                </table>
              </div>
            `;
          });
          return `<div class="flex flex-col gap-4 w-full">${allCategoriesHtml}</div>`;

        case 'criteria_3':
          // Đã được gộp toàn bộ vào criteria_1_2 phía trên để tự động phân trang tự nhiên giống frontend
          return '';

        case 'summary':
          return `
            <div class="bg-[var(--pdf-light)] border border-[var(--pdf-border)] rounded-2xl flex items-center justify-between w-full mt-2 shadow-sm shrink-0" style="padding: 18px 24px;">
              <div class="flex flex-col gap-1 text-left">
                <span class="font-bold text-slate-800 text-[14px]">TỔNG ĐIỂM RÈN LUYỆN CHUNG:</span>
                <span class="text-[11.5px] text-[var(--pdf-text)] font-semibold">Tự động cộng các danh mục điểm đạt</span>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span class="font-black text-[var(--pdf-primary)] text-[22px] font-mono leading-none">
                  ${student.score} / 100đ
                </span>
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--pdf-border)] text-[var(--pdf-text)] uppercase tracking-wide">
                  Xếp loại: ${
                    student.score >= 90
                      ? 'Xuất sắc'
                      : student.score >= 80
                        ? 'Tốt'
                        : student.score >= 70
                          ? 'Khá'
                          : student.score >= 50
                            ? 'Trung bình'
                            : 'Yếu'
                  }
                </span>
              </div>
            </div>
          `;

        case 'signatures':
          return `
            <div class="mt-8 pt-6 w-full border-t border-dashed border-slate-200 shrink-0">
              <div class="grid grid-cols-2 gap-12 w-full text-center">
                <div class="flex flex-col items-center gap-14">
                  <p class="font-bold text-slate-800 text-[12.5px] uppercase tracking-wide">HỌC SINH, SINH VIÊN</p>
                  <div class="flex flex-col gap-1">
                    <p class="font-black text-slate-800 text-[13px]">${student.name}</p>
                    <p class="text-[10px] text-slate-400 italic font-semibold">(Ký và ghi rõ họ tên)</p>
                  </div>
                </div>
                <div class="flex flex-col items-center gap-14">
                  <p class="font-bold text-slate-800 text-[12.5px] uppercase tracking-wide">${customTexts.approverTitle}</p>
                  <div class="flex flex-col gap-1">
                    <p class="font-black text-slate-800 text-[13px] uppercase">${customTexts.approverName}</p>
                    <p class="text-[10px] text-slate-400 italic font-semibold">(Ký và ghi rõ họ tên)</p>
                  </div>
                </div>
              </div>
            </div>
          `;

        default:
          return '';
      }
    };

    let studentsHtml = '';

    selectedStudents.forEach((student) => {
      const counts = evaluationCounts[student.id] || {};

      // Aggregate all configuration sections into a single flow with auto-page break rules
      let contentHtml = '';
      sectionsOrder.forEach((sectionName: string) => {
        const sectionHtml = renderSectionHtml(sectionName, student, counts);
        if (sectionHtml && sectionHtml.trim() !== '') {
          contentHtml += `
            <div class="break-inside-avoid">
              ${sectionHtml}
            </div>
          `;
        }
      });

      studentsHtml += `
        <div class="student-container page-break-after-always">
          <!-- ====== BẢN IN CO GIÃN TỰ ĐỘNG CHUẨN A4 ====== -->
          <div class="page bg-white relative box-border">
            <!-- Background Decorative -->
            <div class="absolute inset-0 opacity-[0.03] pointer-events-none z-0">
              <div class="absolute bg-[var(--pdf-primary)] blur-[80px] bottom-[-150px] left-[-100px] rounded-full w-[350px] h-[350px]"></div>
            </div>

            <div class="relative z-10 flex flex-col justify-between min-h-full">
              <div class="flex flex-col gap-5 text-left">
                ${contentHtml}
              </div>

              <!-- Footer chung cho phiếu điểm cố định ở cuối mỗi trang in -->
              <div class="print-footer">
                <span class="font-semibold text-slate-400 text-[9px] tracking-wider uppercase">
                  EDUPOINT MANAGEMENT SYSTEM - LƯU HÀNH NỘI BỘ
                </span>
                <span class="font-bold text-slate-700 text-[10.5px]">Phiếu điểm rèn luyện HSSV</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Phiếu điểm rèn luyện</title>
        <!-- Google Fonts: Inter, Roboto, Times New Roman CDN -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Roboto:ital,wght@0,400;0,500;0,700;0,900;1,400&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" rel="stylesheet">
        <link href="https://fonts.cdnfonts.com/css/times-new-roman" rel="stylesheet">
        <!-- CDN Tailwind CSS v4 -->
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          :root {
            --pdf-primary: ${colors.primary};
            --pdf-light: ${colors.light};
            --pdf-border: ${colors.border};
            --pdf-text: ${colors.text};
          }
          body {
            font-family: ${
              config.fontFamily === 'Times New Roman'
                ? "'Times New Roman', Times, serif"
                : config.fontFamily === 'Inter'
                  ? "'Inter', sans-serif"
                  : config.fontFamily === 'Roboto'
                    ? "'Roboto', sans-serif"
                    : "'Playfair Display', serif"
            };
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            -webkit-print-color-adjust: exact;
            font-size: ${config.fontSize === 'sm' ? '12px' : config.fontSize === 'lg' ? '16px' : '14px'};
          }
          
          /* Override color classes on the fly for compatibility */
          .bg-\\[\\#135bec\\] { background-color: var(--pdf-primary) !important; }
          .text-\\[\\#135bec\\] { color: var(--pdf-primary) !important; }
          .border-\\[\\#135bec\\] { border-color: var(--pdf-primary) !important; }
          
          .text-\\[\\#1a1b1e\\] { color: #1a1b1e !important; }
          .text-\\[\\#5f6368\\] { color: #5f6368 !important; }
          
          .bg-\\[\\#f8fafc\\] { background-color: #f8fafc !important; }
          .bg-\\[\\#eff6ff\\] { background-color: var(--pdf-light) !important; }
          
          .text-slate-900 { color: #0f172a !important; }
          .text-slate-800 { color: #1e293b !important; }
          .text-slate-700 { color: #334155 !important; }
          .text-slate-500 { color: #64748b !important; }
          .text-slate-400 { color: #94a3b8 !important; }
          
          .border-slate-100 { border-color: #f1f5f9 !important; }
          .border-slate-200 { border-color: #e2e8f0 !important; }
          .border-slate-200\\/80 { border-color: #e2e8f0 !important; }
          
          .bg-blue-50 { background-color: var(--pdf-light) !important; }
          .bg-blue-100 { background-color: var(--pdf-border) !important; }
          .border-blue-100 { border-color: var(--pdf-border) !important; }
          .text-blue-600 { color: var(--pdf-primary) !important; }
          .text-blue-700 { color: var(--pdf-primary) !important; }
          .text-blue-800 { color: var(--pdf-text) !important; }
          .text-blue-900 { color: var(--pdf-text) !important; }
          
          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm 16mm 22mm 16mm;
            box-sizing: border-box;
            background-color: white;
            position: relative;
          }
          .print-footer {
            position: absolute;
            bottom: 10mm;
            left: 16mm;
            right: 16mm;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: white;
            z-index: 50;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page-break-after-always {
            page-break-after: always;
            break-after: page;
          }
          @media print {
            body {
              background-color: white;
            }
            .page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 16mm 22mm 16mm;
              margin: 0;
              box-shadow: none;
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
        </style>
      </head>
      <body>
        <div class="flex flex-col items-center gap-8 py-8 no-print print:p-0 print:gap-0">
          ${studentsHtml}
        </div>
      </body>
      </html>
    `;
  }
}
