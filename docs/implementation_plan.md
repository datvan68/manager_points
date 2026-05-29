# Kế hoạch triển khai: Server-side PDF Generation sử dụng Puppeteer (NestJS & Next.js)

Kế hoạch này thực hiện chuyển đổi toàn bộ kiến trúc xuất PDF điểm rèn luyện sinh viên từ giải pháp Client-side (`html2pdf.js`/`html2canvas` đầy rủi ro tương thích) sang **Server-side Rendering PDF** chuẩn công nghiệp bằng **Puppeteer** tích hợp ở Backend NestJS.

---

## User Review Required

> [!IMPORTANT]
> - **Lợi ích vượt trội của giải pháp Server-side (Puppeteer)**:
>   1. **Triệt tiêu 100% lỗi tương thích màu**: Puppeteer khởi chạy một Chromium headless engine thực tế ở server. Chromium hỗ trợ bản xứ hoàn hảo tất cả các chuẩn màu hiện đại (`oklch`, `oklab`, `lab`, `lch`) của Tailwind CSS v4. Chúng ta hoàn toàn không cần Proxy, không cần dọn dẹp stylesheet, không lo bể layout hay tự động reload trang ở client.
>   2. **Giao diện Client mượt mà tuyệt đối**: Ở Frontend, quá trình tải xuống chỉ là một lệnh gọi API thông thường. Màn hình của người dùng hoàn toàn tĩnh lặng, không nhấp nháy, không lag giật.
>   3. **Màu sắc và Layout giống 100% Figma**: Bằng việc nhúng CDN của Tailwind v4 (`https://cdn.tailwindcss.com`) vào HTML render của Puppeteer, Puppeteer sẽ tự động biên dịch toàn bộ cấu trúc HTML và các class Tailwind v4 giống hệt như trên Web. Bản in PDF sẽ có chất lượng vector sắc nét nhất, căn lề và ngắt trang hoàn hảo.
> - **Thay đổi ở Backend**: Cài đặt gói `puppeteer` (`npm install puppeteer`) ở thư mục `backend`, định nghĩa API `@Post('export-pdf')` nhận dữ liệu rèn luyện và trả về PDF buffer stream.
> - **Thay đổi ở Frontend**: Cập nhật hàm `handleDownloadPdf` của `GradingPdfTemplate.tsx` để call API Backend và tải file PDF. Đồng thời, **gỡ bỏ hoàn toàn** các hàm chuyển đổi màu phức tạp, ES6 Proxy và cơ chế ảo hóa styleSheets vừa thêm trước đó, trả lại sự sạch sẽ tối đa cho frontend code.

---

## Proposed Changes

### [Backend NestJS]

#### 1. Cài đặt thư viện `puppeteer`
* Thực hiện cài đặt gói `puppeteer` trong dự án `backend`.

#### 2. [MODIFY] [summaries-point.controller.ts](file:///d:/PROJECT/manager%20point/backend/src/summaries-point/summaries-point.controller.ts)
- Bổ sung import `@Res() res: Response` từ `'express'`.
- Thêm route `@Post('export-pdf')` để nhận dữ liệu, gọi service sinh PDF và stream kết quả về cho client.

#### 3. [MODIFY] [summaries-point.service.ts](file:///d:/PROJECT/manager%20point/backend/src/summaries-point/summaries-point.service.ts)
- Import `puppeteer`.
- Viết hàm `generateHtml` sinh ra chuỗi HTML hoàn chỉnh cho tất cả sinh viên được chọn. Chuỗi HTML này copy chính xác cấu trúc layout in ấn từ frontend, đổi `className` thành `class`, và sử dụng CDN của Tailwind v4.
- Viết hàm `generatePdf` khởi chạy Puppeteer headless, nạp HTML content, render ra PDF buffer A4 (margin = 0, printBackground = true) và trả về buffer.

---

### [Frontend Next.js]

#### 4. [MODIFY] [GradingPdfTemplate.tsx](file:///d:/PROJECT/manager%20point/frontend/src/components/grading/GradingPdfTemplate.tsx)
- Gỡ bỏ hoàn toàn các helper chuyển đổi màu `oklabToRgb`, `oklchToRgb`, `convertModernColorStringToRgb` và `tempCleanStylesheets`.
- Cập nhật hàm `handleDownloadPdf` để gửi request tới backend `POST /api/summaries-point/export-pdf` với body chứa toàn bộ dữ liệu cần thiết, sau đó nhận về kết quả Blob và tự động download file.

---

## Chi tiết Triển khai API Backend

### 1. Route Controller (`summaries-point.controller.ts`)
```typescript
import { Response } from 'express';
import { Res } from '@nestjs/common';

@Post('export-pdf')
@ApiOperation({ summary: 'Xuất file PDF kết quả điểm rèn luyện sinh viên bằng Puppeteer' })
async exportPdf(@Body() body: any, @Res() res: Response) {
  const { selectedStudents, categories, evaluationCounts, semesterName, className } = body;
  
  const pdfBuffer = await this.summariesPointService.generatePdf(
    selectedStudents,
    categories,
    evaluationCounts,
    semesterName,
    className
  );
  
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=phieu_diem_ren_luyen.pdf`,
    'Content-Length': pdfBuffer.length,
  });
  
  res.end(pdfBuffer);
}
```

---

## Verification Plan

### Manual Verification
1. **Kiểm tra biên dịch**: Đảm bảo cả backend NestJS và frontend Next.js biên dịch thành công sau khi tích hợp.
2. **Kiểm tra xuất PDF**:
   * Tick chọn sinh viên, bấm "Xuất PDF" để mở modal preview.
   * Bấm "Tải xuống PDF".
   * Xác nhận toast hiển thị thông báo tải xuống mượt mà, màn hình client **hoàn toàn êm ái, không nhấp nháy, không bị bể style đằng sau modal, không bị reload trang Next.js**.
   * File PDF được tải về máy thành công, mở ra kiểm tra chất lượng in ấn sắc nét vector, màu sắc HEX và oklch tự động của Tailwind v4 được Chromium render chuẩn xác 100% khớp Figma.
