# Taskscope: Xây trang `/reports` báo cáo tổng hợp, xuất Excel và mô hình trực quan

Ngày scope: 2026-06-11  
Vai trò điều phối: `orchestrator`  
Pipeline áp dụng: `feature_development` -> `code-agent` -> `test-agent` -> `review-agent` -> `doc-agent`

## 1. Mục tiêu

Xây dựng trang `/reports` thành trung tâm báo cáo vận hành cho Manager Point, thay thế placeholder hiện tại bằng màn hình có dữ liệu thật, bộ lọc đầy đủ, bảng chi tiết, biểu đồ/mô hình trực quan và khả năng xuất Excel cho mọi bảng đang hiển thị.

Kết quả mong muốn:

- Người dùng xem được tình hình sinh viên, lớp, khoa, điểm rèn luyện, ghi nhận, chuyên cần, nhiệm vụ và thông báo tại một nơi.
- Mỗi bảng trong `/reports` đều có nút xuất Excel, xuất đúng toàn bộ dữ liệu sau khi áp bộ lọc, không chỉ trang phân trang hiện tại.
- Báo cáo có mô hình trực quan giúp nhìn nhanh xu hướng và điểm bất thường: phân bổ điểm, tiến độ đánh giá, chuyên cần, ghi nhận khen thưởng/kỷ luật, nhiệm vụ và thông báo.
- Dữ liệu lấy từ API thật đã có trong dự án; không dùng mock data, số liệu giả hoặc biểu đồ hard-code.
- Giao diện bám style hiện tại: Next.js App Router, Tailwind, compact glassmorphism, blue/silver, `Sidebar`, `Header`, `RouteGuard`, `AuthProvider`, `TabNavigation`, `CustomPagination`.
- Trang phải tôn trọng RBAC/dynamic route mapping của `/reports`, không lộ dữ liệu ngoài phạm vi vai trò.

## 2. Hiện trạng

File chính:

- `frontend/src/app/reports/page.tsx`

Hiện trạng review ngày 2026-06-11:

- `/reports` đã được triển khai bước đầu tại `frontend/src/app/reports/page.tsx`, không còn chỉ là placeholder.
- Đã có thư mục `frontend/src/components/reports/` với các component chính: header, filters, KPI, tabs, table, empty state, chart nhẹ, helper xử lý dữ liệu và helper export Excel.
- Route `/reports` đã được map trong `RouteGuard` và `Sidebar` dưới module `reports`.
- Frontend đã có dependency `xlsx`, đang dùng trong helper export của reports và các màn hình import/export khác.
- Tab P0 đã có: Tổng quan, Sinh viên, Điểm rèn luyện, Ghi nhận, Chuyên cần, Nhiệm vụ. Tab Hệ thống đã có điều kiện hiển thị theo quyền.
- Chưa có module báo cáo backend riêng. Các dữ liệu cần thiết phần lớn đang lấy từ API hiện tại.
- Chưa thấy chart library chuyên dụng trong `package.json`; reports hiện đang đi theo hướng chart nhẹ bằng React/Tailwind/framer-motion.
- Điểm còn lệch scope chính sau review mới nhất: các endpoint phân trang như task/progress/notification/logs vẫn đang lấy `limit: 1000`, nên chưa bảo đảm xuất đủ dữ liệu khi số dòng thực tế lên đến hàng nghìn hoặc vượt 1000.

Kết luận: scope này chuyển từ "xây mới route placeholder" sang "hoàn thiện và review route `/reports` đã có". Ưu tiên giữ kiến trúc frontend hiện tại, nhưng phải siết chiến lược export dữ liệu lớn: không được dựa vào page đang load nếu API còn phân trang. Chỉ chấp nhận export "toàn bộ" khi đã fetch đủ tất cả pages theo filter hoặc dùng backend export an toàn theo RBAC.

## 3. Nguồn dữ liệu cần dùng

### 3.1. Sinh viên, lớp, khoa

Frontend API:

- `studentApi.getStudents()` -> `GET /students`
- `studentApi.getMyStudent()` -> `GET /students/me`
- `classApi.getClasses()` -> `GET /classes`
- `departmentApi.getDepartments()` -> `GET /departments`

Trường chính:

- `Student.student_code`, `full_name`, `status`, `class_id`, `account_status`, `createdAt`
- `Class.class_name`, `class_year`, `dept_id`, `class_type`, `headquarters`, `user_id`
- `Department.name`, `code`

Báo cáo cần có:

- Tổng sinh viên theo trạng thái: đang học, bảo lưu, thôi học, tốt nghiệp, đình chỉ.
- Phân bổ sinh viên theo khoa, lớp, khóa/năm, hệ đào tạo, cơ sở.
- Bảng danh sách sinh viên theo bộ lọc.
- Top lớp/khoa có biến động hoặc dữ liệu cần chú ý.

### 3.2. Học kỳ và đợt đánh giá

Frontend API:

- `semesterApi.getSemesters()` -> `GET /semesters`
- `evaluationPeriodApi.getEvaluationPeriods()` -> `GET /api/evaluation-periods`

Trường chính:

- `Semester.semester_name`, `start_date`, `end_date`, `status`
- `EvaluationPeriod.status`, `sv_deadline`, `gv_deadline`, `admin_deadline`

Báo cáo cần có:

- Học kỳ active/upcoming.
- Đợt đánh giá đang chạy.
- Giai đoạn hiện tại: pending, sinh viên tự đánh giá, giảng viên duyệt, admin chốt, đã đóng.
- Deadline gần nhất và số ngày còn lại.
- Bảng đợt đánh giá theo học kỳ/trạng thái.

### 3.3. Điểm rèn luyện

Frontend API:

- `summariesPointApi.getSummariesPoints()` -> `GET /summaries-points`
- `evaluationDetailApi.getEvaluationDetails()` -> `GET /evaluation-detail`
- `categoryApi.getCategories()` -> `GET /categories`
- `criteriaApi.getCriteria()` -> `GET /criteria`

Trường chính:

- `SummaryPoint.total_score`, `grading`, `status`, `student_id`, `semester_id`
- `EvaluationDetail.current_count`, `system_score`, `sv_score`, `gv_score`, `final_score`, `status`, `criterion_id`
- `Category.category_name`, `max_score`, `sort_order`
- `Criterion.criterion_name`, `criterion_type`, `score_per_unit`, `max_score`, `min_score`

Báo cáo cần có:

- Phân bổ xếp loại rèn luyện: xuất sắc, tốt, khá, trung bình, yếu.
- Điểm trung bình theo khoa/lớp/học kỳ.
- Tiến độ chấm điểm theo trạng thái: draft, sv_submitted, gv_reviewed, locked.
- Bảng điểm tổng hợp theo sinh viên.
- Bảng chi tiết tiêu chí/nhóm tiêu chí nếu có dữ liệu.
- Danh sách sinh viên điểm cao/thấp và các hồ sơ chưa hoàn tất.

### 3.4. Ghi nhận khen thưởng, cộng điểm, kỷ luật

Frontend API:

- `academicRecordApi.getAcademicRecords()` -> `GET /academic-records`
- `academicRecordApi.getAcademicRecordsByStudent(studentId)`
- `academicRecordApi.getAcademicRecordsByDailyReport(dailyReportId)`

Trường chính:

- `student_id`, `criterion_id`, `semester_id`, `daily_report_id`
- `record_title`, `description`, `recorded_at`, `recorded_by`
- `status`, `is_deleted`
- tương thích cũ: `points_effect`, `date_record`, `criteria_id`

Báo cáo cần có:

- Tổng ghi nhận theo loại tiêu chí: `khen_thuong`, `cong_diem`, `ky_luat`.
- Ghi nhận theo thời gian, lớp, khoa, người ghi nhận.
- Top sinh viên có nhiều khen thưởng/cộng điểm/kỷ luật.
- Bảng ghi nhận chi tiết, có link sang hồ sơ sinh viên nếu đủ dữ liệu route.
- Loại bỏ record đã xóa mềm hoặc inactive khỏi số liệu mặc định.

### 3.5. Báo cáo ngày và chuyên cần

Frontend API:

- `dailyClassReportApi.getDailyClassReports()` -> `GET /daily-class-reports`
- `dailyClassReportApi.getDailyClassReportsByClass(classId)`

Trường chính:

- `class_id`, `report_date`, `total_present`, `total_absent`, `teacher_name`, `class_note`

Báo cáo cần có:

- Tỉ lệ hiện diện toàn hệ thống/lớp/khoa/thời gian.
- Lớp có vắng nhiều nhất.
- Xu hướng chuyên cần theo ngày/tuần/tháng.
- Bảng báo cáo lớp chi tiết.
- Kết nối số ghi nhận vi phạm từ `academicRecords.daily_report_id` nếu có.

### 3.6. Nhiệm vụ và tiến độ

Frontend API:

- `studentTaskApi.getTasks(query)` -> `GET /student-tasks`
- `studentTaskApi.getTaskProgressOverview(query)` -> `GET /student-tasks/progress/overview`

Trường chính:

- Task: `title`, `type`, `subject`, `deadline`, `priority`, `status`, `targetType`, `targetScope`
- Progress: `assigneeName`, `assigneeType`, `className`, `status`, `startedAt`, `completedAt`, `deadline`

Báo cáo cần có:

- Tổng nhiệm vụ, nhiệm vụ gấp, hoàn thành, tỉ lệ tiến độ.
- Tiến độ theo lớp/đối tượng/trạng thái.
- Bảng nhiệm vụ và bảng tiến độ người nhận.
- Cảnh báo quá hạn hoặc sắp đến hạn.

### 3.7. Thông báo và hệ thống

Frontend API hiện có:

- `notificationApi` cho danh sách/count summary nếu cần.
- `systemApi.getLoginLogsSummary()` cho tổng quan đăng nhập nếu cần hiển thị vận hành.

Báo cáo cần có ở P1:

- Tổng thông báo theo loại/trạng thái đọc.
- Tỉ lệ đã đọc/chưa đọc.
- Bảng thông báo gần đây.
- Tóm tắt đăng nhập/hệ thống nếu dữ liệu đã có và quyền cho phép.

## 4. Phạm vi màn hình `/reports`

### 4.1. Layout tổng thể

Trang dùng layout:

- `Sidebar`
- `Header`
- `RouteGuard useDynamicMapping`
- Nội dung scroll trong `main`, tránh `h-screen` bị tràn không kiểm soát.

Vùng đầu trang:

- Tiêu đề: "Báo cáo"
- Mô tả ngắn: "Tổng hợp vận hành sinh viên, điểm rèn luyện, chuyên cần và nhiệm vụ"
- Nút hành động:
  - `Xuất workbook tổng hợp`
  - `Làm mới dữ liệu`
  - `Lưu bộ lọc` nếu cần P2

Global filters:

- Học kỳ
- Đợt đánh giá
- Khoa
- Lớp
- Khoảng ngày
- Trạng thái sinh viên
- Loại báo cáo
- Tìm kiếm

Filter phải áp dụng đồng bộ cho KPI, chart và bảng. Khi filter thay đổi, số liệu và Excel phải phản ánh đúng filter hiện tại.

### 4.2. Tabs chính

Đề xuất dùng `TabNavigation` với các tab:

1. `Tổng quan`
2. `Sinh viên`
3. `Điểm rèn luyện`
4. `Ghi nhận`
5. `Chuyên cần`
6. `Nhiệm vụ`
7. `Thông báo & hệ thống` ở P1

Không dùng landing page/hero marketing. First screen phải là dashboard báo cáo thật.

## 5. Nội dung từng tab

### 5.1. Tab Tổng quan

KPI cards:

- Tổng sinh viên trong phạm vi filter.
- Sinh viên đang học.
- Điểm rèn luyện trung bình.
- Hồ sơ đã khóa/chưa hoàn tất.
- Tỉ lệ chuyên cần.
- Ghi nhận kỷ luật/khen thưởng trong khoảng ngày.
- Nhiệm vụ quá hạn/sắp hạn.

Mô hình trực quan:

- Biểu đồ phân bổ xếp loại rèn luyện.
- Funnel tiến độ đánh giá: draft -> sv_submitted -> gv_reviewed -> locked.
- Heatmap hoặc grid chuyên cần theo lớp/ngày.
- Stacked bars ghi nhận theo loại.
- Bảng "Cần chú ý" gồm sinh viên điểm thấp, vắng nhiều, nhiều kỷ luật, hồ sơ chưa khóa.

### 5.2. Tab Sinh viên

Bảng chi tiết:

- Mã sinh viên
- Họ tên
- Lớp
- Khoa
- Khóa/năm
- Hệ đào tạo
- Cơ sở
- Trạng thái học tập
- Trạng thái tài khoản
- Ngày tạo/cập nhật nếu có

Mô hình trực quan:

- Bar chart sinh viên theo khoa.
- Donut/progress bars theo trạng thái học tập.
- Ranking lớp có nhiều sinh viên nhất.

Excel:

- `Bao_cao_Sinh_vien_<yyyyMMdd_HHmmss>.xlsx`
- Sheet: `Sinh viên`
- Sheet phụ P1: `Theo khoa`, `Theo lớp`, `Theo trạng thái`

### 5.3. Tab Điểm rèn luyện

Bảng tổng hợp:

- Mã sinh viên
- Họ tên
- Lớp
- Khoa
- Học kỳ
- Tổng điểm
- Xếp loại
- Trạng thái hồ sơ
- Số tiêu chí có phát sinh
- Ngày cập nhật

Bảng chi tiết tiêu chí P1:

- Mã sinh viên
- Họ tên
- Nhóm tiêu chí
- Tiêu chí
- Loại tiêu chí
- Số lần
- Điểm hệ thống
- Điểm sinh viên
- Điểm giảng viên
- Điểm cuối
- Trạng thái

Mô hình trực quan:

- Distribution chart theo xếp loại.
- Box/range hoặc bars điểm trung bình theo lớp/khoa.
- Funnel trạng thái chấm điểm.
- Top/bottom students theo điểm.

Excel:

- `Bao_cao_Diem_ren_luyen_<yyyyMMdd_HHmmss>.xlsx`
- Sheets: `Tong hop`, `Chi tiet tieu chi`, `Phan bo xep loai`, `Tien do`

### 5.4. Tab Ghi nhận

Bảng chi tiết:

- Ngày ghi nhận
- Mã sinh viên
- Họ tên
- Lớp
- Khoa
- Loại: khen thưởng/cộng điểm/kỷ luật
- Tiêu chí
- Tiêu đề ghi nhận
- Mô tả
- Điểm tác động
- Người ghi nhận
- Nguồn báo cáo ngày
- Trạng thái

Mô hình trực quan:

- Stacked bars theo loại ghi nhận.
- Timeline ghi nhận theo ngày/tháng.
- Top sinh viên/lớp có nhiều kỷ luật.
- Top sinh viên/lớp có nhiều khen thưởng.

Excel:

- `Bao_cao_Ghi_nhan_<yyyyMMdd_HHmmss>.xlsx`
- Sheets: `Ghi nhan chi tiet`, `Theo loai`, `Top sinh vien`, `Theo lop`

### 5.5. Tab Chuyên cần

Bảng chi tiết:

- Ngày báo cáo
- Lớp
- Khoa
- Giáo viên ghi nhận
- Có mặt
- Vắng
- Tổng
- Tỉ lệ hiện diện
- Ghi chú lớp
- Số ghi nhận liên quan

Mô hình trực quan:

- Line/bar xu hướng tỉ lệ hiện diện theo thời gian.
- Heatmap lớp x ngày.
- Ranking lớp vắng nhiều.
- Cards cảnh báo lớp dưới ngưỡng chuyên cần.

Excel:

- `Bao_cao_Chuyen_can_<yyyyMMdd_HHmmss>.xlsx`
- Sheets: `Bao cao lop`, `Theo ngay`, `Theo lop`, `Canh bao`

### 5.6. Tab Nhiệm vụ

Bảng nhiệm vụ:

- Tiêu đề
- Loại
- Chủ đề
- Deadline
- Ưu tiên
- Trạng thái
- Đối tượng
- Phạm vi giao
- Tiến độ hoàn thành

Bảng tiến độ người nhận:

- Nhiệm vụ
- Người nhận
- Loại người nhận
- Sinh viên/lớp liên quan
- Trạng thái
- Bắt đầu
- Hoàn thành
- Cập nhật gần nhất

Mô hình trực quan:

- Progress bars theo trạng thái.
- Cards nhiệm vụ quá hạn/sắp hạn.
- Breakdown theo đối tượng nhận.

Excel:

- `Bao_cao_Nhiem_vu_<yyyyMMdd_HHmmss>.xlsx`
- Sheets: `Nhiem vu`, `Tien do nguoi nhan`, `Tong hop`

### 5.7. Tab Thông báo & hệ thống P1

Bảng thông báo:

- Tiêu đề
- Loại
- Người tạo
- Đối tượng nhận
- Đã đọc/chưa đọc
- Ngày tạo

Bảng hệ thống:

- Nhóm log/tác vụ
- Tổng số
- Thành công/lỗi nếu API có
- Thời điểm gần nhất

Excel:

- `Bao_cao_Thong_bao_He_thong_<yyyyMMdd_HHmmss>.xlsx`

## 6. Yêu cầu xuất Excel

### 6.1. Nguyên tắc chung

- Dùng `xlsx` hiện có trong frontend cho export nhỏ/vừa khi dữ liệu đã được tải đủ.
- Mỗi bảng có nút `Xuất Excel`.
- Xuất toàn bộ dữ liệu sau filter, không chỉ dữ liệu đang phân trang.
- Không dùng mảng đang hiển thị trên UI làm nguồn export nếu API response có `total > items.length`.
- Workbook tổng hợp phải xuất tất cả nhóm dữ liệu người dùng có quyền xem.
- Tên file dùng tiếng Việt không dấu, format thời gian `yyyyMMdd_HHmmss`.
- Sheet name ngắn, không vượt giới hạn Excel.
- Header tiếng Việt, dễ đọc.
- Date format thống nhất `dd/MM/yyyy` hoặc `dd/MM/yyyy HH:mm`.
- Số điểm, tỉ lệ phần trăm, tổng số phải là kiểu number khi có thể, không ép string trừ cột hiển thị ký hiệu `%`.
- Khi không có dữ liệu, toast lỗi rõ ràng: "Không có dữ liệu để xuất Excel".
- Khi dữ liệu bị giới hạn bởi phân trang/limit, UI phải cảnh báo rõ và chuyển sang luồng fetch-all hoặc backend export; không được tải file Excel thiếu dòng một cách im lặng.

### 6.2. Workbook tổng hợp

Nút `Xuất workbook tổng hợp` tạo một file:

- `Bao_cao_Tong_hop_Manager_Point_<yyyyMMdd_HHmmss>.xlsx`

Sheets tối thiểu P0:

- `Tong quan`
- `Sinh vien`
- `Diem ren luyen`
- `Ghi nhan`
- `Chuyen can`
- `Nhiem vu`

Sheets P1:

- `Thong bao`
- `He thong`
- `Dictionary` hoặc `Bo loc` ghi lại bộ lọc đã áp dụng, thời điểm xuất, người xuất nếu có.

### 6.3. Helper export

Nên tách helper:

- `frontend/src/components/reports/report-export.ts`
- hoặc `frontend/src/lib/report-export.ts`

Helper cần hỗ trợ:

- `createWorkbook()`
- `appendJsonSheet(workbook, sheetName, rows, columnConfig)`
- `autosizeColumns(worksheet, rows, columnConfig)`
- `writeWorkbook(workbook, fileName)`
- `sanitizeSheetName(sheetName)`
- `formatDate(value)`
- `formatPercent(value)`

Không copy-paste logic export ở từng tab nếu có thể dùng helper chung.

### 6.4. Chiến lược xuất dữ liệu hàng nghìn dòng

Mục tiêu là xuất đủ dữ liệu theo filter hiện tại mà không làm treo trình duyệt và không vượt quyền người dùng.

Phân tầng xử lý:

- `<= 5.000 rows` cho một bảng và API đã trả đủ dữ liệu: có thể export trực tiếp bằng `xlsx` ở frontend.
- `> loaded rows` hoặc API trả `total > items.length`: bắt buộc gọi helper `fetchAllPagesForExport()` trước khi ghi Excel, lấy từng chunk theo `page/limit` hoặc `offset/limit` tùy API.
- `> 10.000 rows` cho một bảng, workbook tổng hợp nhiều sheet lớn, hoặc dữ liệu có PII/logs: ưu tiên backend export server-side thay vì gom toàn bộ vào browser memory.
- Nếu một sheet vượt giới hạn Excel `1,048,576` rows, phải split sheet theo suffix `_1`, `_2` hoặc chặn export với thông báo rõ và đề xuất CSV/backend job.

Yêu cầu `fetchAllPagesForExport()` P0 nếu vẫn export ở frontend:

- Nhận cùng bộ filter đang áp dụng trên UI.
- Fetch theo chunk ổn định, đề xuất `limit: 500` hoặc `limit: 1000`.
- Dừng khi `items.length >= total`, khi page rỗng, hoặc khi đạt `maxExportRows` cấu hình.
- Có timeout/error handling; nếu fail giữa chừng thì không ghi file thiếu.
- Trả metadata `{ total, loaded, isComplete, source: 'frontend-paged' }` để ghi vào sheet `Bo loc`.
- Không fetch login logs nếu user không có quyền logs.

Yêu cầu UX:

- Trước khi export lớn, hiển thị trạng thái "Đang chuẩn bị dữ liệu..." và disable nút export tương ứng.
- Nếu dữ liệu vượt ngưỡng frontend, hiển thị lựa chọn "Xuất bằng máy chủ" hoặc thông báo cần backend export, không cố tải hết trong browser.
- Sheet `Bo loc` phải ghi: bộ lọc, thời điểm xuất, người xuất, tổng số rows theo từng sheet, nguồn dữ liệu `loaded | frontend-paged | backend-job`, và cảnh báo nếu có sheet bị giới hạn.

Yêu cầu backend export P1 hoặc P0 nếu dữ liệu thực tế thường xuyên vượt 10.000 rows:

- Endpoint tạo job: `POST /reports/exports`
- Endpoint trạng thái: `GET /reports/exports/:jobId`
- Endpoint tải file: `GET /reports/exports/:jobId/download`
- Backend tự enforce RBAC, áp filter, query theo cursor/chunk, stream workbook ra file tạm hoặc object storage; không load toàn bộ dataset vào RAM.
- Job có trạng thái `queued | running | done | failed | expired`, có `createdBy`, `filters`, `tables`, `rowCounts`, `expiresAt`.
- File export hết hạn sau thời gian cấu hình để tránh lưu PII lâu dài.

## 7. Yêu cầu mô hình trực quan

Do chưa có chart library chuyên dụng, P0 ưu tiên chart nhẹ bằng React/Tailwind/framer-motion như dashboard hiện tại:

- Bar chart
- Stacked bar
- Progress/funnel
- Heatmap grid
- Ranking list
- KPI cards

Nếu sau review thấy cần chart library, đề xuất `recharts` hoặc thư viện tương đương ở P1 và phải cập nhật dependency có kiểm soát.

Các mô hình trực quan bắt buộc P0:

- Phân bổ xếp loại rèn luyện.
- Funnel tiến độ đánh giá.
- Tỉ lệ chuyên cần theo lớp/thời gian.
- Ghi nhận theo loại.
- Tiến độ nhiệm vụ.

Yêu cầu UI:

- Chart phải có empty state khi không có dữ liệu.
- Có tooltip hoặc label đủ hiểu.
- Không dùng màu một tông duy nhất; dùng blue/silver làm nền và màu phụ cho trạng thái.
- Responsive desktop/mobile, không tràn chữ, không overlap.
- Các bảng giữ layout ổn định khi hover/filter/pagination.

## 8. RBAC và phạm vi dữ liệu

Trang `/reports` phải chạy trong:

- `RouteGuard useDynamicMapping`
- `AuthProvider`
- `useAuth()`
- `usePermission()` nếu cần kiểm tra quyền từng hành động.

Vai trò và phạm vi đề xuất:

- Admin: xem toàn bộ báo cáo.
- Teacher/advisor: xem lớp/sinh viên mình phụ trách nếu backend đã scope; không tự mở rộng dữ liệu ở frontend.
- Supervisor/operator: xem nhóm báo cáo được cấp quyền.
- Student: chỉ xem dữ liệu cá nhân nếu route được cấp quyền cho student; nếu chưa có scope cá nhân đầy đủ thì ẩn tab nhạy cảm.

Nguyên tắc:

- Không tự bypass quyền bằng cách gọi endpoint không scope nếu backend đã có endpoint scoped phù hợp.
- Không đưa email/thông tin cá nhân nhạy cảm vào log.
- Excel chỉ chứa dữ liệu người dùng đang được phép xem.
- Khi API lỗi quyền, hiển thị empty/error state nhẹ, không fallback sang mock.

## 9. Kiến trúc frontend đề xuất

Thư mục mới:

```text
frontend/src/components/reports/
  ReportPageHeader.tsx
  ReportFilters.tsx
  ReportKpiGrid.tsx
  ReportTabs.tsx
  ReportTable.tsx
  ReportEmptyState.tsx
  charts/
    ReportBarChart.tsx
    ReportStackedBar.tsx
    ReportFunnel.tsx
    ReportHeatmap.tsx
  tabs/
    OverviewReportTab.tsx
    StudentReportTab.tsx
    ScoreReportTab.tsx
    AcademicRecordReportTab.tsx
    AttendanceReportTab.tsx
    TaskReportTab.tsx
    SystemReportTab.tsx
  report-helpers.ts
  report-export.ts
  report-types.ts
```

Trang:

- `frontend/src/app/reports/page.tsx`

Nguyên tắc code:

- `page.tsx` chỉ orchestration: fetch dữ liệu, giữ filter state, render layout.
- Logic tính toán để trong `report-helpers.ts`.
- Type tập trung trong `report-types.ts`.
- Export tập trung trong `report-export.ts`.
- Component table dùng chung để tránh lặp filter/pagination/export.
- Không sửa lớn các trang khác trừ khi cần tái sử dụng helper export.

## 10. Logic tổng hợp dữ liệu

Helper cần build một object báo cáo từ dữ liệu raw:

```ts
interface ReportsDataset {
  students: Student[];
  classes: Class[];
  departments: Department[];
  semesters: Semester[];
  evaluationPeriods: EvaluationPeriod[];
  summaries: SummaryPoint[];
  evaluationDetails: EvaluationDetail[];
  categories: Category[];
  criteria: Criterion[];
  academicRecords: AcademicRecord[];
  dailyReports: DailyClassReport[];
  tasks: StudentTask[];
  taskProgress: StudentTaskProgress[];
}
```

Output đề xuất:

```ts
interface ReportsOverview {
  kpis: ReportKpi[];
  tables: {
    students: StudentReportRow[];
    scores: ScoreReportRow[];
    scoreDetails: ScoreDetailReportRow[];
    records: AcademicRecordReportRow[];
    attendance: AttendanceReportRow[];
    tasks: TaskReportRow[];
    taskProgress: TaskProgressReportRow[];
  };
  charts: {
    scoreDistribution: ChartDatum[];
    evaluationFunnel: ChartDatum[];
    attendanceTrend: ChartDatum[];
    attendanceHeatmap: HeatmapDatum[];
    recordTypeDistribution: ChartDatum[];
    taskProgressDistribution: ChartDatum[];
  };
}
```

Mapping ID phải xử lý an toàn:

- Object populated hoặc string ID đều phải đọc được.
- Dùng helper `getEntityId(value)`.
- Khi thiếu class/department, hiển thị `Chưa xác định`, không crash.
- Ngày có thể là ISO hoặc `dd/MM/yyyy`; cần helper parse date thống nhất.

## 11. Backend P1/P2 nếu cần

P0 có thể dùng API hiện có cho màn hình và export nhỏ/vừa. Tuy nhiên với dữ liệu hàng nghìn dòng, backend export phải được ưu tiên khi frontend không thể chứng minh đã fetch đủ dữ liệu. Tạo backend module `reports` nếu:

- Dữ liệu quá lớn khiến frontend fetch toàn bộ chậm.
- Cần aggregation theo MongoDB để đúng RBAC.
- Cần export server-side cho file lớn hoặc workbook nhiều sheet.
- Cần cache báo cáo.

Module đề xuất:

```text
backend/src/reports/
  reports.module.ts
  reports.controller.ts
  reports.service.ts
  dto/report-query.dto.ts
```

Endpoint đề xuất:

- `GET /reports/overview`
- `GET /reports/students`
- `GET /reports/scores`
- `GET /reports/records`
- `GET /reports/attendance`
- `GET /reports/tasks`
- `POST /reports/exports`
- `GET /reports/exports/:jobId`
- `GET /reports/exports/:jobId/download`

Không thêm backend chỉ khi frontend có helper fetch-all pages, có cảnh báo `total > loaded`, và dữ liệu thực tế nằm trong ngưỡng export an toàn. Nếu yêu cầu nghiệp vụ là "xuất đầy đủ mọi bảng" với dữ liệu thường xuyên vượt 10.000 rows hoặc chứa logs/PII, backend export là bắt buộc trước nghiệm thu.

## 12. Loading, error, empty state

Yêu cầu:

- Loading skeleton cho KPI, chart, table.
- Error state theo từng nguồn dữ liệu; API nào lỗi thì phần liên quan hiển thị cảnh báo, không làm sập cả trang nếu còn dữ liệu khác.
- Có nút `Thử lại`.
- Empty state riêng cho từng tab.
- Toast khi export thành công/thất bại.
- Không `console.log` dữ liệu cá nhân; chỉ `console.warn/error` ngắn, không dump payload.

## 13. Tiêu chí nghiệm thu P0

P0 hoàn thành khi:

- `/reports` không còn placeholder.
- Trang render đúng trong layout chung với `Sidebar`, `Header`, `RouteGuard`.
- Có global filters: học kỳ, khoa, lớp, khoảng ngày, tìm kiếm.
- Có ít nhất 6 tab: Tổng quan, Sinh viên, Điểm rèn luyện, Ghi nhận, Chuyên cần, Nhiệm vụ.
- Tất cả KPI/chart/table lấy từ API thật hoặc dữ liệu đã được backend trả về.
- Mỗi tab có ít nhất một bảng chi tiết.
- Mỗi bảng có nút xuất Excel và xuất đúng toàn bộ rows sau filter.
- Có nút xuất workbook tổng hợp.
- Nếu API phân trang trả `total > items.length`, export phải fetch đủ pages hoặc chuyển sang backend export; không tạo file thiếu dữ liệu.
- Sheet `Bo loc` ghi bộ lọc, thời điểm xuất, người xuất, row counts theo sheet và nguồn dữ liệu export.
- Có các visual bắt buộc: score distribution, evaluation funnel, attendance trend/heatmap, record type distribution, task progress.
- Responsive tốt ở desktop và mobile.
- Không dùng mock data trong `/reports`.
- Không thêm số liệu hard-code.
- Không phá các trang hiện có.

## 14. Test và kiểm chứng

### 14.1. Unit test/helper

Nên viết test cho:

- Filter theo học kỳ/khoa/lớp/khoảng ngày.
- Mapping student -> class -> department.
- Tính điểm trung bình và phân bổ xếp loại.
- Tính tỉ lệ chuyên cần.
- Tính top khen thưởng/kỷ luật.
- Tính funnel trạng thái đánh giá.
- Tính task progress distribution.
- Export helper: sheet name, column order, empty rows, date/percent format.
- Export phân trang: mock `total > items.length` và kiểm tra không ghi workbook thiếu rows.
- Export lớn: kiểm tra ngưỡng `maxFrontendExportRowsPerSheet`, `maxFrontendWorkbookRows` và fallback backend/error state.

### 14.2. Build/lint

Chạy:

```bash
npm run build
```

Trong `frontend`.

Nếu lint hiện tại có cấu hình lỗi sẵn thì ghi lại rõ lỗi không liên quan. Không sửa lan man ngoài scope.

### 14.3. Manual QA

Kiểm tra:

- Admin xem được toàn hệ thống.
- User không có quyền `/reports` bị chặn bởi `RouteGuard`.
- Filter thay đổi làm KPI/chart/table/Excel thay đổi đồng bộ.
- Export từng bảng mở được bằng Excel/LibreOffice.
- Với dữ liệu giả lập 2.500 rows, export phải đủ 2.500 rows sau filter hoặc hiển thị backend-export flow.
- Workbook tổng hợp có đủ sheet.
- Mobile không tràn bảng; bảng có scroll ngang hoặc card fallback.
- Empty state không crash khi API trả mảng rỗng.

## 15. Phân chia công việc theo agent

### 15.1. `orchestrator`

Nhiệm vụ:

- Điều phối scope.
- Giữ quyết định P0/P1/P2.
- Kiểm tra conflict giữa UX, RBAC, export và dữ liệu.
- Không trực tiếp deploy.

### 15.2. `code-agent`

Nhiệm vụ:

- Thay `frontend/src/app/reports/page.tsx`.
- Tạo components/helpers trong `frontend/src/components/reports`.
- Tích hợp API hiện có.
- Tạo export Excel helper.
- Tạo chart nhẹ bằng React/Tailwind/framer-motion.

### 15.3. `test-agent`

Nhiệm vụ:

- Viết test cho helper tính toán và export.
- Chạy build/lint/test phù hợp.
- Ghi rõ test gap nếu repo chưa có setup frontend test.

### 15.4. `review-agent`

Nhiệm vụ:

- Review RBAC và dữ liệu nhạy cảm.
- Review việc Excel xuất đúng toàn bộ rows sau filter.
- Review responsive và state lỗi.
- Review không có mock/hard-code.

### 15.5. `doc-agent`

Nhiệm vụ:

- Cập nhật tài liệu nếu có thay đổi API hoặc cách dùng báo cáo.
- Cập nhật taskscope nếu scope thay đổi trong quá trình triển khai.

## 16. Ưu tiên triển khai

### P0 - Bắt buộc

- Trang `/reports` hoàn chỉnh với 6 tab chính.
- API thật cho sinh viên, lớp, khoa, học kỳ, đợt đánh giá, điểm, ghi nhận, chuyên cần, nhiệm vụ.
- Global filters.
- KPI và visual cốt lõi.
- Export Excel từng bảng.
- Export workbook tổng hợp.
- Export không thiếu rows khi API phân trang; nếu chưa có backend export thì phải có fetch-all pages và cảnh báo giới hạn.
- RBAC qua `RouteGuard`.
- Build pass.

### P1 - Nâng cao

- Tab Thông báo & hệ thống.
- Sheet phụ thống kê cho từng workbook.
- Lưu bộ lọc gần nhất trong localStorage.
- Drilldown từ chart sang bảng đã filter.
- Backend aggregation nếu performance kém.
- Backend export job cho workbook lớn hoặc dữ liệu thường xuyên vượt ngưỡng frontend.
- Chart library nếu chart tự dựng không đủ tốt.

### P2 - Sau nghiệm thu

- Lịch xuất báo cáo định kỳ.
- Lưu mẫu báo cáo theo vai trò.
- Chia sẻ báo cáo bằng link có quyền.
- PDF report nếu người dùng yêu cầu.

## 17. Rủi ro và lưu ý

- Một số endpoint hiện trả dữ liệu toàn bộ hoặc scoped theo backend; cần xác nhận hành vi bằng role thật trước khi release.
- `dailyClassReportApi` dùng cả `class_note` và DTO dùng `class_notes`; cần normalize tránh mất ghi chú.
- Ngày dữ liệu có thể là ISO hoặc `dd/MM/yyyy`; bắt buộc parse an toàn.
- `AcademicRecord` có field cũ và mới; cần ưu tiên field mới nhưng fallback field cũ.
- Nếu table rất lớn, export frontend có thể chậm hoặc crash memory; không vượt ngưỡng frontend đã định, chuyển sang backend export job.
- Không đưa email hoặc thông tin cá nhân không cần thiết vào Excel nếu không nằm trong yêu cầu nghiệp vụ.

## 18. Review hiện trạng triển khai mới nhất

Mục này là checklist bắt buộc sau khi đã có bản triển khai đầu tiên của `/reports`.

### 18.1. Các phần đã đi đúng scope

- `frontend/src/app/reports/page.tsx` đã render route thật trong `RouteGuard`, `Sidebar`, `Header`.
- Đã tách nhóm component dưới `frontend/src/components/reports/`.
- Đã có global filters cho học kỳ, khoa, lớp, trạng thái sinh viên, khoảng ngày và tìm kiếm.
- Đã có các tab chính cho tổng quan, sinh viên, điểm rèn luyện, ghi nhận, chuyên cần, nhiệm vụ và hệ thống theo quyền.
- Đã có helper `report-helpers.ts` để map dữ liệu raw thành KPI, bảng và chart.
- Đã có helper `report-export.ts` dùng `xlsx` để tạo workbook/sheet.
- Đã fetch thêm `evaluationPeriodApi`, `evaluationDetailApi`, `categoryApi`, `criteriaApi` và đưa vào `ReportsDataset`.
- Đã có bảng `Chi tiết tiêu chí` trong tab Điểm rèn luyện và bảng `Tiến độ người nhận` trong tab Nhiệm vụ.
- Workbook tổng hợp đã có sheet `Bo loc`, các sheet chi tiết chính, thông báo và logs theo quyền.
- `report-export.ts` đã ghi percent dạng number và format `0.0%`.
- Export logs đã mask email/IP khi ghi Excel.
- Mỗi bảng chính hiện có nút `Xuất Excel` và dùng dữ liệu đã filter, nhưng vẫn phụ thuộc dataset đã load từ API.
- Chart P0 đã dùng component nội bộ, chưa cần thêm dependency chart mới.

### 18.2. Blocker cần bổ sung trước khi nghiệm thu P0

#### 18.2.1. Nguồn dữ liệu evaluation period và chi tiết tiêu chí đã bổ sung, cần kiểm chứng

Code hiện tại đã import/fetch `evaluationPeriodApi`, `evaluationDetailApi`, `categoryApi`, `criteriaApi` và đã đưa `evaluationPeriods`, `evaluationDetails`, `categories`, `criteria` vào `ReportsDataset`. Không còn xem đây là blocker thiếu code, nhưng vẫn cần test dữ liệu thật để bảo đảm join đúng.

Yêu cầu kiểm chứng:

- `processReportsData()` tạo `tables.scoreDetails` từ dữ liệu thật, không hard-code.
- Mapping category/criteria đúng tên, đúng điểm và không bị `undefined` khi thiếu reference.
- Filter học kỳ/đợt đánh giá áp dụng đúng cho cả bảng tổng hợp và bảng chi tiết.

Acceptance:

- Filter học kỳ/đợt đánh giá ảnh hưởng đúng đến điểm tổng hợp và chi tiết tiêu chí.
- Tab Điểm rèn luyện có thể hiển thị hoặc export bảng `Chi tiết tiêu chí` khi API có dữ liệu.
- Nếu API trả rỗng, UI hiển thị empty state rõ, không crash.

#### 18.2.2. Xuất đủ mọi bảng đã bổ sung, cần kiểm chứng dữ liệu đầy đủ

Scope yêu cầu "mọi bảng đầy đủ". Code hiện tại đã có export riêng cho:

- Bảng sinh viên.
- Bảng điểm rèn luyện tổng hợp.
- Bảng chi tiết tiêu chí.
- Bảng ghi nhận.
- Bảng chuyên cần.
- Bảng nhiệm vụ.
- Bảng tiến độ người nhận nhiệm vụ.
- Bảng thông báo.
- Bảng logs hệ thống theo quyền.
- Workbook tổng hợp có sheet `Bo loc`.

Yêu cầu còn lại:

- Workbook tổng hợp phải append các sheet có quyền xem: `Tong quan`, `Bo loc`, `Sinh vien`, `Diem ren luyen`, `Chi tiet tieu chi`, `Ghi nhan`, `Chuyen can`, `Nhiem vu`, `Tien do nhiem vu`, và `He thong/Thong bao` nếu có quyền.
- Với sheet không có rows nhưng thuộc P0, vẫn nên tạo sheet có header hoặc ghi rõ trong sheet `Tong quan` là không có dữ liệu, để người dùng biết không bị thiếu sheet do lỗi.
- Quan trọng nhất: export từng bảng và workbook tổng hợp không được thiếu rows khi API phân trang hoặc `total > loaded`.

Acceptance:

- Export từng bảng mở được bằng Excel/LibreOffice.
- Workbook tổng hợp không bỏ sót bảng đang hiển thị trên UI.
- Tên sheet được sanitize và không vượt giới hạn 31 ký tự.

#### 18.2.3. Kiểu dữ liệu Excel phần trăm đã sửa, cần test workbook thực tế

`report-export.ts` hiện đã ghi `type: 'percent'` dạng number và set cell format `z: '0.0%'`. Không còn là blocker code chính, nhưng vẫn cần test file thực tế vì Excel formatting dễ lệch khi column config thay đổi.

Yêu cầu kiểm chứng:

- Cột phần trăm trong attendance/task có thể sort/filter/tính toán như number.
- Dữ liệu đầu vào `85`, `0.85`, `"0.85"` phải được chuẩn hóa đúng theo quy ước của từng field, tránh nhân/chia 100 sai.
- Không phá hiển thị bảng UI; chỉ kiểm tra dữ liệu Excel.

Acceptance:

- Trong Excel, cột phần trăm có thể sort/filter/tính toán như number.
- Header vẫn là tiếng Việt dễ đọc.

#### 18.2.4. Quyền và dữ liệu nhạy cảm trong tab hệ thống đã siết một phần, cần review

Bản hiện tại có điều kiện fetch login logs theo admin/permission và đã mask email/IP khi export. Vẫn cần review vì logs là dữ liệu nhạy cảm và workbook tổng hợp có thể bị chia sẻ ra ngoài.

Yêu cầu review:

- Chỉ fetch/export login logs khi user là admin hoặc có đúng quyền đọc logs.
- Nếu chỉ có quyền xem reports nhưng không có quyền logs, không render tab hệ thống và không append sheet logs trong workbook.
- Mask email/IP phải áp dụng cho cả export từng tab và workbook tổng hợp.
- Nếu nghiệp vụ yêu cầu log đầy đủ, chỉ cho phép khi permission là `SYSTEM_ADMIN` và cần ghi rõ trong scope.
- Không `console.error` kèm payload response chứa PII.

Acceptance:

- User không có quyền logs không thấy dữ liệu logs trong UI lẫn Excel.
- Workbook tổng hợp không chứa sheet hệ thống khi user không có quyền.

#### 18.2.5. Dữ liệu hàng nghìn dòng không được export dựa trên `limit: 1000`

Hiện các API task/progress/notification/logs vẫn gọi với `limit: 1000`. Bản code đã có `hasLimitWarning`, nhưng nếu người dùng bấm export trong trạng thái này thì file vẫn có nguy cơ chỉ chứa phần dữ liệu đã load. Với yêu cầu "xuất Excel mọi bảng đầy đủ", đây là blocker P0/P1 tùy quy mô dữ liệu thực tế.

Vấn đề cần chốt:

- UI table có thể phân trang để xem nhanh, nhưng export phải lấy dataset đầy đủ theo filter.
- Không được dùng `processed.tables.*` làm nguồn export nếu dataset gốc đang bị giới hạn bởi `total > items.length`.
- Không được ghi workbook tổng hợp nếu một sheet bị thiếu rows mà không báo lỗi/cảnh báo.

Giải pháp P0 nếu dữ liệu ở mức hàng nghìn dòng:

- Tạo helper dùng chung `fetchAllPagesForExport()` trong frontend hoặc service layer.
- Helper nhận `endpointFetcher`, `filters`, `pageSize`, `maxRows`, `tableName`.
- Fetch tuần tự theo page/chunk đến khi đủ `total`; đề xuất `pageSize = 500` hoặc `1000`.
- Export button gọi helper này trước khi tạo workbook nếu phát hiện `total > loaded`.
- Nếu fetch đủ, ghi Excel bằng `reportExportHelper` và ghi sheet `Bo loc` với `rowCounts` thực tế.
- Nếu fetch không đủ, timeout hoặc vượt `maxRows`, không tạo file thiếu; hiển thị toast/error rõ.

Ngưỡng đề xuất:

- `maxFrontendExportRowsPerSheet = 5000` cho export trực tiếp bằng browser.
- `maxFrontendWorkbookRows = 10000` tính tổng các sheet trong workbook tổng hợp.
- Ngưỡng là cấu hình, không hard-code rải rác trong component.

Giải pháp P1/P0 bắt buộc nếu dữ liệu thường xuyên vượt ngưỡng:

- Thêm backend export job theo section 6.4 và 11.
- Frontend chỉ gửi `filters`, `tables`, `scope`, `format`; backend tự query đủ dữ liệu theo RBAC.
- Backend stream workbook theo chunk để tránh giữ toàn bộ rows trong RAM.
- Frontend poll trạng thái job, hiển thị progress và tải file khi `done`.

Acceptance:

- Khi API trả `total = 2500`, export phải có đủ 2500 rows sau filter, không chỉ 1000.
- Khi tổng rows vượt ngưỡng frontend, UI không treo và không tạo file thiếu; người dùng nhận thông báo hoặc luồng backend job.
- Sheet `Bo loc` ghi rõ tổng rows từng sheet và nguồn export.
- Workbook mở được bằng Excel/LibreOffice, các cột số/phần trăm vẫn là number.
- Review-agent kiểm tra riêng case `total > items.length` cho từng bảng phân trang.

#### 18.2.6. Cần test/build trước khi chốt

Chưa được nghiệm thu nếu chưa có kiểm chứng.

Yêu cầu:

- Chạy `npm run build` trong `frontend`.
- Nếu có setup test, thêm/chạy test cho `report-helpers.ts` và `report-export.ts`.
- Manual QA desktop/mobile cho `/reports`.
- Kiểm tra export Excel từng tab và workbook tổng hợp.

Acceptance:

- Build pass hoặc ghi rõ lỗi không liên quan.
- Không còn lỗi TypeScript vì thiếu field như `tables.scoreDetails`, `tables.taskProgress`, `charts.attendanceHeatmap`.
- UI không overlap trên mobile.

### 18.3. Handoff cho `code-agent`

```json
{
  "from": "orchestrator",
  "to": "code-agent",
  "task_id": "reports-review-completion",
  "instruction": "Hoàn thiện /reports theo các blocker 18.2 mới nhất: kiểm chứng các bảng/sheet đã bổ sung, sửa luồng export để không dùng dữ liệu bị giới hạn bởi limit 1000, thêm fetchAllPagesForExport cho endpoint phân trang hoặc backend export job khi vượt ngưỡng, ghi rowCounts/nguồn dữ liệu vào sheet Bo loc, và bảo đảm RBAC/PII cho logs.",
  "skill": "code_gen",
  "input": {
    "primary_files": [
      "frontend/src/app/reports/page.tsx",
      "frontend/src/components/reports/report-types.ts",
      "frontend/src/components/reports/report-helpers.ts",
      "frontend/src/components/reports/report-export.ts",
      "frontend/src/components/reports/tabs/*"
    ],
    "acceptance_source": "taskscope.md sections 13, 14, 18"
  },
  "deadline": "120s",
  "on_failure": "stop"
}
```

### 18.4. Handoff cho `test-agent`

```json
{
  "from": "orchestrator",
  "to": "test-agent",
  "task_id": "reports-test-verification",
  "instruction": "Kiểm chứng /reports sau khi code-agent hoàn thiện: build frontend, test helper filter/mapping/export, manual QA export workbook và responsive.",
  "skill": "code_gen(mode=test)",
  "input": {
    "commands": [
      "npm run build"
    ],
    "working_directory": "frontend",
    "focus": [
      "report-helpers",
      "report-export",
      "RBAC system tab",
      "Excel all rows after filter",
      "case total > items.length",
      "large export thresholds"
    ]
  },
  "deadline": "120s",
  "on_failure": "retry_once"
}
```

### 18.5. Handoff cho `review-agent`

```json
{
  "from": "orchestrator",
  "to": "review-agent",
  "task_id": "reports-final-review",
  "instruction": "Review cuối cho /reports: ưu tiên bug, RBAC, dữ liệu nhạy cảm, export thiếu rows/sheets, hiệu năng fetch all, responsive và không dùng mock/hard-code.",
  "skill": "search + summarize",
  "input": {
    "review_scope": [
      "frontend/src/app/reports/page.tsx",
      "frontend/src/components/reports/**",
      "frontend/src/api/*"
    ],
    "gate": "must_approve_before_done"
  },
  "deadline": "120s",
  "on_failure": "stop"
}
```

## 19. Definition of Done

Hoàn thành khi `review-agent` xác nhận:

- Scope P0 đã được triển khai đủ.
- Không còn placeholder.
- Không có mock/hard-code trong báo cáo.
- Dữ liệu, filter, chart, bảng và Excel nhất quán.
- Export Excel không thiếu rows khi API phân trang; nếu vượt ngưỡng frontend thì có backend job hoặc thông báo chặn rõ ràng.
- Không vi phạm RBAC.
- Build/test đã chạy hoặc nêu rõ lý do không chạy được.
- File `taskscope.md` phản ánh đúng chức năng đã triển khai.
