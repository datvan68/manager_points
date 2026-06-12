# Taskscope 1: Redesign trang chủ tổng quan theo dữ liệu thật

Ngày scope: 2026-06-11  
Vai trò điều phối: `orchestrator`  
Pipeline áp dụng: feature discovery -> code-agent -> test-agent -> review-agent -> doc-agent

## 1. Mục tiêu

Thiết kế lại trang chủ `/` thành dashboard tổng quan vận hành thật của Manager Point, phản ánh đúng dữ liệu hiện có trong dự án thay vì số liệu hard-code, mock chart hoặc nội dung marketing.

Kết quả mong muốn:

- Trang chủ là màn hình làm việc đầu tiên sau đăng nhập, giúp người dùng hiểu ngay tình trạng học sinh/sinh viên, lớp, khoa, điểm rèn luyện, nhiệm vụ, thông báo và vận hành hệ thống.
- Trọng tâm first viewport phải là học sinh/sinh viên: ai nổi bật, ai cần chú ý, ai có khen thưởng, điểm cộng hoặc kỷ luật mới nhất.
- Tất cả KPI, danh sách, trạng thái và biểu đồ phải lấy từ API hoặc dữ liệu đã được backend cung cấp.
- Giao diện bám thiết kế hiện tại: compact glassmorphism, blue/silver, Tailwind, `Sidebar`, `Header`, `RouteGuard`, `AuthProvider`.
- Dashboard phải đổi nội dung theo vai trò/quyền: Admin, giảng viên/cố vấn, học sinh/sinh viên, operator hệ thống.
- Không đưa nội dung không có dữ liệu thật như "Upgrade to Pro", số phòng KTX trống, biểu đồ tăng trưởng giả.

## 2. Hiện trạng trang chủ

File liên quan:

- `frontend/src/app/page.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/providers/auth-provider.tsx`
- `frontend/src/components/dashboard/dashboard-helpers.ts`
- `frontend/src/components/dashboard/*`

Review cập nhật 2026-06-11:

- `frontend/src/app/page.tsx` đã được refactor một phần sang dashboard dữ liệu thật, có gọi nhiều API thật như sinh viên, lớp, khoa, học kỳ, đợt đánh giá, điểm tổng hợp, ghi nhận, nhiệm vụ, thông báo, tiêu chí/nhóm tiêu chí và hệ thống. API báo cáo ngày/chuyên cần vẫn cần kiểm tra bổ sung vì chưa thấy được gọi trong trang chủ hiện tại.
- Đã có các component dashboard riêng: `DashboardHeader`, `KpiGrid`, `EvaluationProgressPanel`, `AcademicOverviewPanel`, `AttendanceRecordPanel`, `TaskPanel`, `NotificationPanel`, `SystemOperationsPanel`, `QuickActionsPanel`, `ScoreDistributionChart`.
- Đã có helper `buildDashboardOverview(...)` trong `frontend/src/components/dashboard/dashboard-helpers.ts`.
- Review lần 2 cho thấy code runtime đã tiến thêm: `page.tsx` đã import/gọi `criteriaApi.getCriteria()` và `categoryApi.getCategories()`, đã đưa `criteria`, `categories` vào `rawState`, đã truyền sang `buildDashboardOverview(...)`.
- `DashboardMetrics` hiện đã có nhánh `studentHighlights` gồm `topRewards`, `topBonus`, `topDiscipline`, `topScores`, `mySpotlight`; `topProgress` vẫn mới ở mức optional, chưa thấy logic tính rõ.
- `StudentSpotlightPanel` đã được import và render ngay sau `DashboardHeader`, trước `Attention Alerts`, `KpiGrid`, `QuickActionsPanel`. Đây là đúng hướng với yêu cầu "đánh mạnh vào học sinh nằm trên đầu".
- `recentAcademicRecords` vẫn nên giữ đúng vai trò danh sách ghi nhận gần đây; không trộn với bảng top học sinh vì `studentHighlights` đã là cấu trúc riêng.
- Các điểm còn cần hoàn thiện sau review lần 2:
  - `dailyClassReportApi.getDailyClassReports()` chưa thấy được gọi trong `page.tsx`; trong helper phần `filteredDailyReports` và `attendanceRate` đang bị vô hiệu hóa/fallback `100`.
  - `NotificationPanel` có trong scope component nhưng chưa thấy được render trong `page.tsx`, dù dữ liệu `recentNotifications` đã được build trong metrics.
  - `categories` đã fetch nhưng hiện chưa thấy dùng rõ trong helper/UI; cần dùng để hiển thị nhóm tiêu chí hoặc bỏ khỏi scope P0 nếu chưa cần.
  - Cần kiểm chứng `topRewards`, `topBonus`, `topDiscipline` chỉ dùng record đúng loại khi lấy `latestRecordTitle`, `latestRecordAt`, `impactScore`, tránh lấy nhầm ghi nhận mới nhất của nhóm khác trong cùng học sinh.
  - Cần kiểm chứng sort top theo số lượt, điểm tác động và ngày mới nhất, không chỉ sort theo một phần tiêu chí.
  - Cần kiểm chứng responsive: desktop có thể dùng tab, nhưng phải có tín hiệu/counter rõ cho đủ 4 nhóm; mobile giới hạn 3 item hoặc layout không tràn.

Hiện trạng ban đầu trước khi refactor từng là dashboard tĩnh:

- KPI hard-code: tổng sinh viên `1,284`, khóa học `42`, phòng KTX trống `128`, tỉ lệ hoàn thành `94.2%`.
- Biểu đồ tăng trưởng dùng mảng giả `[40, 70, 45, 90, 65, 80, 55]`.
- Hoạt động gần đây là dữ liệu mock.
- Có thẻ `Upgrade to Pro`, không phù hợp hệ thống nội bộ.
- Chưa dùng các API thật đã có trong `frontend/src/api`.
- Chưa cá nhân hóa theo vai trò, quyền, lớp phụ trách hoặc hồ sơ sinh viên.

Kết luận mới sau review lần 2: không rewrite dashboard. Giữ implementation hiện tại, nhưng chuyển scope P0 sang hoàn thiện/chốt chất lượng `StudentSpotlightPanel`, sửa các phần dữ liệu thật còn thiếu như báo cáo ngày/thông báo, và viết test cho helper tính top học sinh.

## 3. Dữ liệu thật có sẵn trong dự án

### 3.1. Sinh viên, lớp, khoa

Nguồn frontend:

- `studentApi.getStudents()` -> `GET /students`
- `studentApi.getMyStudent()` -> `GET /students/me`
- `classApi.getClasses()` -> `GET /classes`
- `departmentApi.getDepartments()` -> `GET /departments`

Trường dữ liệu quan trọng:

- `Student.status`: `Studying`, `Reserved`, `Dropped`, `Graduated`, `Suspended`
- `Student.class_id`, `Student.training_point_id`, `Student.account_status`
- `Class.class_name`, `Class.class_year`, `Class.dept_id`, `Class.user_id`, `Class.class_type`, `Class.headquarters`
- `Department.name`, `Department.code`

Dashboard nên hiển thị:

- Tổng sinh viên theo trạng thái.
- Tổng lớp đang quản lý.
- Tổng khoa/phòng ban.
- Phân bổ sinh viên theo lớp, khoa, khóa/năm.
- Số tài khoản sinh viên active/inactive/locked nếu dữ liệu có.

### 3.2. Học kỳ và đợt đánh giá

Nguồn frontend:

- `semesterApi.getSemesters()` -> `GET /semesters`
- `evaluationPeriodApi.getEvaluationPeriods()` -> `GET /api/evaluation-periods`

Trường dữ liệu quan trọng:

- `Semester.status`: `active`, `inactive`, `upcoming`
- `EvaluationPeriod.status`: `pending`, `sv_phase`, `gv_phase`, `admin_phase`, `closed`
- `sv_deadline`, `gv_deadline`, `admin_deadline`

Dashboard nên hiển thị:

- Học kỳ active hoặc upcoming gần nhất.
- Đợt đánh giá hiện hành.
- Giai đoạn hiện tại: sinh viên tự đánh giá, giảng viên duyệt, admin chốt hoặc đã đóng.
- Deadline gần nhất và số ngày còn lại.

### 3.3. Điểm rèn luyện

Nguồn frontend:

- `summariesPointApi.getSummariesPoints()` -> `GET /summaries-points`
- `evaluationDetailApi.getEvaluationDetails()` -> `GET /evaluation-detail`
- `categoryApi.getCategories()` -> `GET /categories`
- `criteriaApi.getCriteria()` -> `GET /criteria`

Trường dữ liệu quan trọng:

- `SummaryPoint.total_score`
- `SummaryPoint.grading`
- `SummaryPoint.status`: `draft`, `sv_submitted`, `gv_reviewed`, `locked`
- `EvaluationDetail.status`, `system_score`, `sv_score`, `gv_score`, `final_score`
- `Category.max_score`
- `Criterion.criterion_type`: `khen_thuong`, `cong_diem`, `ky_luat`

Dashboard nên hiển thị:

- Điểm trung bình toàn hệ thống hoặc theo phạm vi được phép xem.
- Phân bổ trạng thái hồ sơ điểm: bản nháp, sinh viên đã nộp, giảng viên đã duyệt, đã khóa.
- Top học sinh theo điểm rèn luyện cao nhất/thấp nhất trong học kỳ đang chọn.
- Top khen thưởng: các học sinh có nhiều ghi nhận thuộc tiêu chí `khen_thuong`.
- Top điểm cộng: các học sinh có nhiều ghi nhận thuộc tiêu chí `cong_diem`.
- Top kỷ luật/cần chú ý: các học sinh có ghi nhận thuộc tiêu chí `ky_luat` hoặc điểm tác động âm.
- Top nhóm cần xử lý: hồ sơ chưa nộp, đang chờ duyệt, sắp hết hạn.
- Với sinh viên: điểm cá nhân, xếp loại, trạng thái bài tự đánh giá.
- Với giảng viên/cố vấn: số hồ sơ lớp phụ trách cần duyệt.

Ví dụ panel dữ liệu cần có:

- `TopKhenThuong`: tên học sinh, mã sinh viên, lớp, số lượt khen thưởng, tổng điểm tác động, ghi nhận mới nhất.
- `TopDiemCong`: tên học sinh, lớp, tổng điểm cộng, tiêu chí đóng góp nhiều nhất.
- `TopKyLuat`: tên học sinh, lớp, số lượt kỷ luật, tổng điểm bị trừ, ghi nhận mới nhất, trạng thái cần xử lý.
- `TopTienBo`: học sinh có điểm tăng mạnh hoặc nhiều ghi nhận tích cực trong 7/30 ngày gần nhất nếu đủ dữ liệu thời gian.

Cách tính P0 trên frontend:

- Tạo map `criteriaById` từ `criteriaApi.getCriteria()`.
- Tạo map `studentsById` từ `studentApi.getStudents()`.
- Tạo map `classesById` từ `classApi.getClasses()` để hiển thị tên lớp và build link hồ sơ.
- Với mỗi `AcademicRecord.active`, lấy `criterion_id`, tra `Criterion.criterion_type`.
- Chỉ tính record có `status === "active"` và không bị `is_deleted`.
- Ưu tiên lọc theo `semester_id` đang chọn; nếu record thiếu `semester_id` thì chỉ đưa vào nhóm "ghi nhận gần đây" hoặc đánh dấu là dữ liệu không gắn kỳ, không trộn vào top học kỳ.
- Hỗ trợ cả trường hợp `criterion_id` là object đã populate và trường hợp chỉ là string id.
- Hỗ trợ cả trường legacy `criteria_id` nếu dữ liệu cũ chưa migrate hết.
- Nhóm theo `student_id`.
- `khen_thuong`: đếm record có `criterion_type === "khen_thuong"`.
- `cong_diem`: cộng `Criterion.score_per_unit` hoặc `AcademicRecord.points_effect` nếu có.
- `ky_luat`: đếm record có `criterion_type === "ky_luat"` hoặc điểm tác động âm.
- Sort top theo số lượt, tổng điểm tác động, rồi `recorded_at` mới nhất.
- Mỗi top list giới hạn 5 học sinh ở desktop, 3 học sinh ở mobile; có link "Xem tất cả" tới `/students/record` nếu cần.
- Nếu không có dữ liệu top thật, hiển thị empty state rõ ràng, không tạo ví dụ giả trên runtime.

### 3.4. Ghi nhận và báo cáo lớp hằng ngày

Nguồn frontend:

- `academicRecordApi.getAcademicRecords()` -> `GET /academic-records`
- `dailyClassReportApi.getDailyClassReports()` -> `GET /daily-class-reports`

Trường dữ liệu quan trọng:

- `AcademicRecord.status`: `active`, `inactive`
- `recorded_at`, `record_title`, `criterion_id`, `daily_report_id`
- `DailyClassReport.report_date`, `total_present`, `total_absent`, `teacher_name`, `class_note`

Dashboard nên hiển thị:

- Số ghi nhận mới trong hôm nay/7 ngày.
- Báo cáo lớp hôm nay, số lớp đã báo cáo và chưa báo cáo.
- Tỉ lệ có mặt: `total_present / (total_present + total_absent)`.
- Các lớp có vắng nhiều hoặc chưa ghi nhận báo cáo.

### 3.5. Nhiệm vụ

Nguồn frontend:

- `studentTaskApi.getTasks({ page, limit, sort })` -> `GET /student-tasks`
- `studentTaskApi.getTaskProgressOverview(query)` -> `GET /student-tasks/progress/overview`

Trường dữ liệu quan trọng:

- `TaskListResponse.summary.totalTasks`
- `urgentTasks`, `completedTasks`, `progressPercentage`
- `StudentTask.deadline`, `priority`, `status`, `linkedPage`
- `TaskProgressOverviewResponse.summary.completionRate`

Dashboard nên hiển thị:

- Nhiệm vụ sắp đến hạn.
- Nhiệm vụ ưu tiên cao.
- Tỉ lệ hoàn thành nhiệm vụ.
- Với sinh viên: nhiệm vụ của chính mình.
- Với giảng viên/admin: tiến độ theo lớp/người được giao.

### 3.6. Thông báo

Nguồn frontend:

- `notificationApi.getUnreadCount()` -> `GET /notifications/unread-count`
- `notificationApi.getCountSummary()` -> `GET /notifications/count-summary`
- `notificationApi.getNotifications({ page: 1, limit: 5 })`

Dashboard nên hiển thị:

- Số thông báo chưa đọc.
- 5 thông báo mới nhất.
- Phân loại warning/success/info/system.
- Link điều hướng theo `routeUrl`.

### 3.7. Vận hành hệ thống

Nguồn frontend:

- `systemApi.getLoginLogsSummary()` -> `GET /api/system/login-logs/summary`
- `systemApi.getRequests({ page: 1, limit: 5 })`
- `systemApi.getBackups({ page: 1, limit: 5 })`

Chỉ hiển thị khi người dùng có quyền phù hợp:

- `SYSTEM_ADMIN`
- `LOGIN_LOG_READ`
- `SYSTEM_REQUEST_READ`
- `SYSTEM_REQUEST_MANAGE`
- `DATABASE_BACKUP_READ`

Dashboard nên hiển thị:

- Đăng nhập thành công/thất bại hôm nay và 7 ngày.
- Request vận hành đang pending/in_progress/critical.
- Backup gần nhất và trạng thái `queued`, `running`, `success`, `failed`.

## 4. Yêu cầu thiết kế UI

### 4.1. Nguyên tắc chung

- Giữ layout app hiện tại: `Sidebar` bên trái, `Header` phía trên, nội dung scroll trong main.
- Không tạo landing page hoặc hero marketing.
- Trang đầu tiên phải là workspace dashboard sử dụng được ngay.
- Dùng `lucide-react` cho icon.
- Dùng card nhỏ cho KPI và panel dữ liệu; không lồng card trong card.
- Bám style trong `docs/design/DESIGN.compact.md`:
  - `bg-white/45 backdrop-blur-md`
  - `border border-white/75`
  - text chính `#1E293B`
  - muted `#64748B`
  - accent `#1A73E8`
  - radius chính `rounded-xl`, container lớn `rounded-2xl`
- Tránh bảng màu một tông; bổ sung semantic colors cho warning/success/danger/info.
- Không dùng decorative orb/blob/gradient background rời rạc.

### 4.2. Cấu trúc màn hình đề xuất

#### Khu A: Header dashboard

Nội dung:

- Lời chào theo người dùng: tên, vai trò.
- Tóm tắt phạm vi dữ liệu: toàn trường, lớp phụ trách, hoặc hồ sơ cá nhân.
- Selector học kỳ/đợt đánh giá nếu có nhiều kỳ.
- Badge trạng thái đợt đánh giá hiện hành.
- Nút refresh dữ liệu.
- Timestamp lần cập nhật cuối.

Không hiển thị text hướng dẫn dài.

#### Khu B: Học sinh nổi bật và cần chú ý

Admin/giảng viên:

- Panel này phải nằm ngay dưới header dashboard, trước KPI tổng quan.
- Hiển thị 3-4 nhóm học sinh dạng list compact:
  - Top khen thưởng.
  - Top điểm cộng.
  - Top kỷ luật/cần chú ý.
  - Top điểm rèn luyện cao nhất hoặc học sinh tiến bộ.
- Mỗi dòng học sinh gồm: avatar/initials, họ tên, mã sinh viên, lớp, điểm hiện tại hoặc điểm tác động, badge loại ghi nhận, ngày ghi nhận mới nhất.
- Có CTA nhanh đến hồ sơ học sinh: `/students/{classId}/{studentId}` nếu có đủ `classId` và `studentId`.
- Với giảng viên/cố vấn, chỉ lấy học sinh trong lớp phụ trách.
- Với sinh viên, thay panel top toàn hệ thống bằng thẻ cá nhân: điểm hiện tại, ghi nhận tích cực gần đây, ghi nhận cần xử lý nếu có.

Ví dụ nội dung:

- Khen thưởng: "Nguyễn Văn A - K45A - 4 lượt - +12 điểm - mới nhất: Tham gia hoạt động tình nguyện".
- Điểm cộng: "Trần Thị B - K45B - +18 điểm - tiêu chí nổi bật: Nghiên cứu khoa học".
- Kỷ luật: "Lê Văn C - K44A - 2 lượt - -8 điểm - cần cố vấn theo dõi".

#### Khu C: KPI hàng đầu

Admin/giảng viên:

- Tổng sinh viên đang học.
- Lớp đang quản lý.
- Điểm rèn luyện trung bình.
- Hồ sơ chờ xử lý.
- Nhiệm vụ khẩn cấp.
- Thông báo chưa đọc.

Sinh viên:

- Điểm rèn luyện hiện tại.
- Trạng thái hồ sơ điểm.
- Deadline gần nhất.
- Nhiệm vụ chưa hoàn thành.
- Thông báo chưa đọc.

Operator hệ thống:

- Đăng nhập thành công/thất bại hôm nay.
- Request vận hành đang chờ.
- Backup gần nhất.
- Thông báo hệ thống.

#### Khu D: Tiến độ đánh giá

Panel chính nên có:

- Progress theo status `draft`, `sv_submitted`, `gv_reviewed`, `locked`.
- Deadline phase hiện tại.
- Danh sách các lớp/hồ sơ cần hành động.
- CTA theo vai trò:
  - Sinh viên: vào `/grading/score`
  - Giảng viên: vào `/grading/score`
  - Admin: vào `/grading`

#### Khu E: Bản đồ học vụ

Panel compact:

- Phân bổ sinh viên theo trạng thái.
- Top lớp có nhiều sinh viên hoặc có vấn đề.
- Tổng lớp theo khoa/cơ sở.
- Link nhanh đến `/students`.

#### Khu F: Chuyên cần và ghi nhận

Panel:

- Báo cáo lớp hôm nay.
- Tỉ lệ có mặt.
- Ghi nhận mới nhất từ `academic-records`.
- Cảnh báo lớp chưa có báo cáo trong ngày nếu xác định được danh sách lớp.
- Link nhanh đến `/students/record`.

#### Khu G: Nhiệm vụ và thông báo

Hai panel song song:

- Nhiệm vụ sắp đến hạn, ưu tiên cao, trạng thái.
- Thông báo mới nhất và số chưa đọc.
- Link theo `linkedPage` hoặc `routeUrl`.

#### Khu H: Vận hành hệ thống

Chỉ hiển thị khi có quyền hệ thống:

- Login summary hôm nay/7 ngày.
- Request vận hành mới nhất.
- Backup gần nhất.
- Link đến `/system`.

## 5. Logic phân quyền và cá nhân hóa

### 5.1. Admin

Điều kiện:

- `user.role === "Admin"` hoặc `user.roleCode === "ADMIN"` hoặc có `ADMIN_FULL`.

Hiển thị:

- Toàn bộ KPI học vụ.
- Tiến độ đánh giá toàn hệ thống.
- Nhiệm vụ/notification toàn quyền theo API trả về.
- Panel vận hành nếu có quyền API.

### 5.2. Giảng viên/cố vấn

Điều kiện suy luận hiện tại:

- Role chứa `teacher`, `advisor`, `giảng viên`, `giáo viên`.
- Hoặc có quyền liên quan `STUDENT_PAGE`, `GRADING_PAGE`, `READ_STUDENT_TASK`.

Hiển thị:

- Lớp phụ trách nếu `Class.user_id` hoặc `advisor_id` khớp user.
- Sinh viên thuộc lớp phụ trách.
- Hồ sơ điểm cần duyệt.
- Báo cáo lớp và ghi nhận liên quan.
- Nhiệm vụ được giao hoặc do mình quản lý.

### 5.3. Sinh viên

Điều kiện:

- Role chứa `student`, `sinh vien`, `hoc sinh`.
- Có `studentId`/`classId` từ `AuthProvider` hoặc `students/me`.

Hiển thị:

- Hồ sơ cá nhân.
- Điểm rèn luyện của chính sinh viên.
- Tiến độ tự đánh giá.
- Nhiệm vụ của chính mình.
- Thông báo của chính mình.
- Không hiển thị dữ liệu toàn trường.

### 5.4. Operator hệ thống

Điều kiện:

- Có một trong các quyền hệ thống: `LOGIN_LOG_READ`, `SYSTEM_REQUEST_READ`, `DATABASE_BACKUP_READ`, `SYSTEM_ADMIN`.

Hiển thị:

- Panel vận hành hệ thống.
- Không bắt buộc thấy toàn bộ dữ liệu học vụ nếu thiếu quyền học vụ.

## 6. Yêu cầu dữ liệu và tính toán

### 6.1. Phương án P0: dùng API hiện có từ frontend

Trong `frontend/src/app/page.tsx`, tạo data loader client-side bằng `Promise.allSettled`:

- `studentApi.getStudents()`
- `classApi.getClasses()`
- `departmentApi.getDepartments()`
- `semesterApi.getSemesters()`
- `evaluationPeriodApi.getEvaluationPeriods()`
- `summariesPointApi.getSummariesPoints()`
- `criteriaApi.getCriteria()`
- `categoryApi.getCategories()`
- `dailyClassReportApi.getDailyClassReports()`
- `academicRecordApi.getAcademicRecords()`
- `studentTaskApi.getTasks({ page: 1, limit: 5, sort: "deadline_asc" })`
- `notificationApi.getUnreadCount()`
- `notificationApi.getNotifications({ page: 1, limit: 5 })`
- Gọi `systemApi.*` có điều kiện theo permission.

Mỗi API lỗi riêng không được làm sập toàn trang. Panel lỗi hiển thị trạng thái nhẹ và các panel khác vẫn render.

Điểm cần sửa trong code hiện tại:

- Đã có trong code hiện tại: `frontend/src/app/page.tsx` đã import/gọi `criteriaApi` và `categoryApi`.
- Đã có trong code hiện tại: `rawState` đã bổ sung `criteria` và `categories`.
- Đã có trong code hiện tại: lời gọi `buildDashboardOverview(...)` đã truyền `criteria`, `categories` theo object config.
- Cần giữ chữ ký helper dạng object config, không quay lại danh sách tham số dài:

```ts
buildDashboardOverview({
  user,
  students,
  classes,
  departments,
  semesters,
  periods,
  summaries,
  dailyReports,
  academicRecords,
  criteria,
  categories,
  tasks,
  notifications,
  unreadCount,
  systemData,
  selectedSemesterId,
});
```

- Đã có trong code hiện tại: `DashboardMetrics` có nhánh `studentHighlights`; tiếp tục không nhét top học sinh vào `recentAcademicRecords` vì khác ý nghĩa dữ liệu.
- Cần bổ sung/chốt tiếp:
  - Fetch và truyền `dailyClassReportApi.getDailyClassReports()` nếu vẫn giữ panel báo cáo ngày/chuyên cần trong dashboard.
  - Render `NotificationPanel` hoặc quyết định thay thế bằng vùng thông báo khác; nếu không render thì bỏ khỏi danh sách component P0 để scope không gây hiểu nhầm.
  - Dùng `categories` trong UI/helper nếu cần tên nhóm tiêu chí; nếu không dùng thì đánh dấu là P1 hoặc remove khỏi data loader để giảm request.
  - Tách records theo từng loại trước khi lấy `latestRecordTitle`, `latestRecordAt`, `recordCount`, `impactScore` cho `topRewards`, `topBonus`, `topDiscipline`.
  - Thêm `topProgress` chỉ khi có dữ liệu so sánh kỳ trước/30 ngày; nếu chưa đủ dữ liệu thì không hiển thị nhãn "tiến bộ".

### 6.2. Phương án P1: thêm API tổng hợp dashboard

Nếu P0 gây quá nhiều request hoặc dữ liệu quá lớn, thêm endpoint backend:

- `GET /api/dashboard/overview`

Response đề xuất:

```ts
interface DashboardOverview {
  scope: "global" | "advisor" | "student" | "system";
  generatedAt: string;
  academic: {
    totalStudents: number;
    studyingStudents: number;
    totalClasses: number;
    totalDepartments: number;
    studentStatusCounts: Record<string, number>;
  };
  evaluation: {
    activeSemester?: any;
    activePeriod?: any;
    summaryStatusCounts: Record<string, number>;
    averageScore: number | null;
    pendingReviewCount: number;
    lockedCount: number;
  };
  studentHighlights: {
    topScores: StudentHighlightItem[];
    topRewards: StudentHighlightItem[];
    topBonus: StudentHighlightItem[];
    topDiscipline: StudentHighlightItem[];
    topProgress?: StudentHighlightItem[];
    mySpotlight?: StudentPersonalSpotlight;
  };
  attendance: {
    todayReports: number;
    missingReports: number;
    presentRate: number | null;
    recentRecords: any[];
  };
  tasks: {
    totalTasks: number;
    urgentTasks: number;
    completedTasks: number;
    progressPercentage: number;
    upcoming: any[];
  };
  notifications: {
    unread: number;
    latest: any[];
  };
  system?: {
    loginSummary?: any;
    pendingRequests?: number;
    latestBackups?: any[];
  };
}

interface StudentHighlightItem {
  studentId: string;
  classId?: string;
  studentName: string;
  studentCode?: string;
  className?: string;
  currentScore?: number | null;
  grading?: string | null;
  recordCount: number;
  impactScore: number;
  latestRecordTitle?: string;
  latestRecordAt?: string;
  dominantCriterionName?: string;
  type: "khen_thuong" | "cong_diem" | "ky_luat" | "score" | "progress";
  href?: string;
}

interface StudentPersonalSpotlight {
  studentId: string;
  classId?: string;
  currentScore: number | null;
  grading: string | null;
  evaluationStatus: "draft" | "sv_submitted" | "gv_reviewed" | "locked" | null;
  positiveRecords: StudentHighlightItem[];
  warningRecords: StudentHighlightItem[];
  nextAction?: {
    label: string;
    href: string;
  };
}
```

P1 cần backend service tôn trọng quyền và scope dữ liệu theo user.

## 7. Trạng thái loading, empty, error

Yêu cầu:

- Loading toàn trang chỉ dùng lần đầu; sau đó từng panel có skeleton riêng.
- Empty state phải cụ thể, ví dụ: "Chưa có đợt đánh giá đang mở", "Không có nhiệm vụ sắp hạn".
- Error state không lộ token, endpoint raw hoặc stack trace.
- Nếu API trả 403, panel phải ẩn hoặc báo không có quyền, không spam toast.
- Refresh không làm nhảy layout; giữ kích thước card ổn định.

## 8. Responsive

Desktop:

- Grid 12 cột.
- KPI cards 4-6 item theo nội dung.
- Khu tiến độ đánh giá chiếm 7-8 cột, panel phụ chiếm 4-5 cột.

Tablet:

- KPI 2 cột.
- Panel xếp 1-2 cột tùy độ rộng.

Mobile:

- Nội dung có padding dưới để không bị mobile bottom navigation che.
- KPI cuộn hoặc xếp 1 cột.
- Không dùng bảng rộng ngang; dùng list compact.
- Text trong badge/button không được tràn.

## 9. Task triển khai đề xuất

### P0 - Thay dashboard tĩnh bằng dữ liệu thật

1. Review code hiện tại trước khi sửa:
   - Giữ lại các component dashboard đã có nếu đang hoạt động tốt.
   - Không tạo lại dashboard từ đầu khi chỉ cần bổ sung `studentHighlights`.
   - Xác nhận còn hard-code/mock nào trong `frontend/src/app/page.tsx` hoặc `frontend/src/components/dashboard/*` thì loại bỏ.
2. Hoàn thiện cấu trúc component nhỏ cho dashboard:
   - `DashboardPage`
   - `DashboardHeader`
   - `StudentSpotlightPanel`
   - `StudentLeaderboardPanel`
   - `KpiGrid`
   - `EvaluationProgressPanel`
   - `AcademicOverviewPanel`
   - `AttendanceRecordPanel`
   - `TaskPanel`
   - `NotificationPanel`
   - `SystemOperationsPanel`
3. Tạo helper tổng hợp dữ liệu ở frontend:
   - `buildDashboardOverview(raw, user, permissions)`
   - `getActiveSemester(semesters)`
   - `getActiveEvaluationPeriod(periods)`
   - `countByStatus(items, field)`
   - `calculateAverageScore(summaries)`
   - `calculateAttendanceRate(reports)`
   - `buildStudentCriterionLeaderboards(students, academicRecords, criteria, summaries)`
   - `buildStudentSpotlight(user, students, summaries, academicRecords, criteria)`
4. Xác nhận và giữ phần đã có trong code hiện tại:
   - `criteriaApi.getCriteria()`
   - `categoryApi.getCategories()`
   - `criteria`, `categories` trong `rawState`
   - `studentHighlights.topRewards`
   - `studentHighlights.topBonus`
   - `studentHighlights.topDiscipline`
   - `studentHighlights.topScores`
   - `studentHighlights.mySpotlight`
   - `StudentSpotlightPanel` render ngay sau `DashboardHeader`
5. Hoàn thiện `DashboardMetrics.studentHighlights`:
   - Bổ sung `topProgress` chỉ khi có dữ liệu so sánh theo thời gian/kỳ trước.
   - Đảm bảo mỗi top list chỉ tính đúng record của nhóm đó khi lấy `recordCount`, `impactScore`, `latestRecordTitle`, `latestRecordAt`.
   - Không dùng `agg.records` toàn bộ cho latest record của từng tab nếu học sinh vừa có khen thưởng vừa có kỷ luật.
6. Hoàn thiện `StudentSpotlightPanel`:
   - Admin/giảng viên: hiển thị rõ top khen thưởng, điểm cộng, kỷ luật/cần chú ý, điểm cao/tiến bộ.
   - Sinh viên: hiển thị spotlight cá nhân, không hiển thị top toàn trường.
   - Panel này phải render ngay sau `DashboardHeader` và trước `Attention Alerts`, `KpiGrid`, `QuickActionsPanel`.
   - Nếu dùng tab, desktop vẫn phải có counter/tín hiệu rõ cho đủ các nhóm; người dùng không cần đoán có top khen thưởng/kỷ luật ở tab khác.
7. Implement hoặc giữ sub-list bên trong `StudentSpotlightPanel`:
   - Dữ liệu lấy từ `studentHighlights`, không tự gọi API riêng nếu đã có overview.
   - Mỗi item có link hồ sơ `/students/{classId}/{studentId}` khi đủ dữ liệu.
   - `Xem tất cả ghi nhận` dẫn tới `/students/record`.
8. Bổ sung lại dữ liệu báo cáo ngày/chuyên cần nếu panel vẫn còn trong dashboard:
   - Import/gọi `dailyClassReportApi.getDailyClassReports()`.
   - Truyền `dailyReports` vào `buildDashboardOverview`.
   - Không để `filteredDailyReports = []` và `attendanceRate = 100` nếu không có lý do nghiệp vụ rõ.
9. Render hoặc loại khỏi scope `NotificationPanel`:
   - Nếu render, dùng `metrics.recentNotifications`.
   - Nếu không cần panel riêng, cập nhật tài liệu/UI để chỉ còn unread KPI và link thông báo.
10. Xóa toàn bộ số liệu hard-code trong trang chủ nếu còn.
11. Xóa thẻ `Upgrade to Pro` nếu còn.
12. Chỉ hiển thị panel hệ thống khi có quyền phù hợp.
13. Tạo loading/error/empty state theo từng panel.

### P1 - Tối ưu và chuẩn hóa

1. Thêm `GET /api/dashboard/overview` nếu số lượng request P0 quá lớn.
2. Backend aggregate theo role/scope.
3. Thêm cache nhẹ 30-60 giây cho overview.
4. Thêm query theo học kỳ/đợt đánh giá.
5. Thêm test service aggregate.

### P2 - Nâng trải nghiệm

1. Thêm bộ lọc nhanh: học kỳ, lớp, khoa, trạng thái điểm.
2. Thêm action nhanh theo quyền: tạo nhiệm vụ, vào chấm điểm, xem báo cáo lớp, xử lý request hệ thống.
3. Thêm biểu đồ compact bằng CSS/div hoặc thư viện hiện có nếu dự án đã dùng.
4. Thêm trạng thái "cần chú ý" cho deadline sắp hết, login failure tăng, backup failed.

## 10. Acceptance criteria

### Dữ liệu

- Không còn KPI, chart, activity list hard-code trong `/`.
- `frontend/src/app/page.tsx` có import và gọi `criteriaApi.getCriteria()`.
- `frontend/src/app/page.tsx` có import và gọi `categoryApi.getCategories()` nếu UI/helper cần tên nhóm tiêu chí.
- `rawState` hoặc object dữ liệu tương đương có `criteria` và `categories`.
- `buildDashboardOverview` nhận được `criteria` để tính top theo `Criterion.criterion_type`.
- `DashboardMetrics` có nhánh `studentHighlights`, không trộn dữ liệu top học sinh vào `recentAcademicRecords`.
- Review lần 2 xác nhận các tiêu chí trên đã có trong code hiện tại; khi implement tiếp không được xóa/làm tụt các phần này.
- Khi API có dữ liệu, dashboard hiển thị đúng tổng số sinh viên/lớp/khoa.
- `SummaryPoint.status` được đếm đúng theo `draft`, `sv_submitted`, `gv_reviewed`, `locked`.
- Điểm trung bình bỏ qua record không có `total_score` hợp lệ.
- Khu học sinh nằm trên đầu dashboard, trước các KPI tổng quan.
- `StudentSpotlightPanel` render ngay sau `DashboardHeader` trong `frontend/src/app/page.tsx`.
- Top khen thưởng lấy từ `AcademicRecord` + `Criterion.criterion_type === "khen_thuong"`, không hard-code.
- Top điểm cộng lấy từ `Criterion.criterion_type === "cong_diem"` hoặc điểm tác động dương hợp lệ.
- Top kỷ luật/cần chú ý lấy từ `Criterion.criterion_type === "ky_luat"` hoặc điểm tác động âm hợp lệ.
- `latestRecordTitle` và `latestRecordAt` của từng top phải lấy từ record thuộc đúng nhóm đang hiển thị, không lấy record mới nhất của nhóm khác trong cùng học sinh.
- `impactScore` của top khen thưởng/điểm cộng/kỷ luật phải cộng đúng các record thuộc nhóm đó, không dùng tổng điểm tác động lẫn cả record trái loại.
- Sort top khen thưởng theo `recordCount` giảm dần, sau đó `impactScore` giảm dần, sau đó ngày ghi nhận mới nhất giảm dần.
- Sort top điểm cộng theo `impactScore` giảm dần, sau đó `recordCount` giảm dần, sau đó ngày ghi nhận mới nhất giảm dần.
- Sort top kỷ luật/cần chú ý theo `recordCount` giảm dần, sau đó điểm trừ nặng hơn lên trước, sau đó ngày ghi nhận mới nhất giảm dần.
- Các top list chỉ tính `AcademicRecord.status === "active"` và không tính record `is_deleted`.
- Top list tôn trọng học kỳ đang chọn qua `semester_id`.
- Nếu `criterion_id` đã populate object thì dùng trực tiếp; nếu là string id thì tra trong `criteriaById`.
- Nếu dữ liệu cũ dùng `criteria_id`, helper vẫn xử lý fallback.
- Mỗi item top học sinh hiển thị tối thiểu họ tên, mã sinh viên, lớp, số lượt hoặc điểm tác động, ghi nhận mới nhất.
- Link item học sinh mở đúng hồ sơ `/students/{classId}/{studentId}` khi có đủ dữ liệu.
- Nếu vẫn giữ panel báo cáo ngày/chuyên cần, `dailyClassReportApi.getDailyClassReports()` phải được gọi và `attendanceRate` không được hard-code `100`.
- Nếu vẫn giữ thông báo trong dashboard ngoài KPI unread, `NotificationPanel` hoặc vùng thông báo tương đương phải render từ `metrics.recentNotifications`.
- Nếu `categories` được fetch trong P0, phải có mục đích hiển thị/tính toán rõ; nếu chưa dùng thì chuyển sang P1 hoặc bỏ fetch để giảm request.
- Tỉ lệ chuyên cần không chia cho 0.
- Nhiệm vụ sắp hạn sort theo deadline gần nhất.
- Thông báo chưa đọc lấy từ `notificationApi.getUnreadCount()`.

### Quyền

- Người chưa đăng nhập vẫn bị `AuthProvider` chuyển về `/login`.
- Sinh viên không thấy dữ liệu toàn trường nếu API/user scope không cho phép.
- Sinh viên chỉ thấy spotlight cá nhân, không thấy bảng top khen thưởng/kỷ luật toàn trường.
- Giảng viên/cố vấn chỉ thấy top học sinh trong lớp/phạm vi được giao nếu xác định được `Class.user_id`/`advisor_id`.
- User không có quyền hệ thống không thấy panel login logs/request/backup.
- User có `LOGIN_LOG_READ` thấy được summary đăng nhập nếu API cho phép.
- User có `SYSTEM_REQUEST_READ` thấy request vận hành.
- Admin thấy toàn bộ panel hợp lệ.

### UX

- Trang chủ mở nhanh, không trắng màn hình khi một API lỗi.
- Loading skeleton không làm layout nhảy mạnh.
- Mobile không bị che bởi bottom navigation.
- Các button/link dẫn đúng route:
  - `/students`
  - `/students/record`
  - `/students/tasks`
  - `/grading`
  - `/grading/score`
  - `/notifications`
  - `/system`
- Không có text marketing hoặc dữ liệu không thuộc dự án thật.

### Visual

- Bám glassmorphism compact hiện tại.
- Không dùng `rounded-full` cho button/badge/input, trừ avatar/trạng thái nhỏ có lý do rõ.
- Không dùng card lồng card.
- Không có text tràn hoặc chồng nhau ở desktop/mobile.
- Icon dùng `lucide-react`.

## 11. Kiểm thử đề xuất

### Manual QA

1. Đăng nhập Admin:
   - Kiểm tra toàn bộ KPI và panel.
   - Kiểm tra khu học sinh nằm đầu dashboard.
   - Kiểm tra top khen thưởng, điểm cộng, kỷ luật có dữ liệu từ ghi nhận thật.
   - Kiểm tra link nhanh.
   - Kiểm tra panel hệ thống.
2. Đăng nhập sinh viên:
   - Kiểm tra chỉ thấy dữ liệu cá nhân.
   - Kiểm tra spotlight cá nhân thay cho bảng top toàn trường.
   - Kiểm tra nhiệm vụ và điểm cá nhân.
   - Kiểm tra không thấy vận hành hệ thống.
3. Đăng nhập giảng viên/cố vấn:
   - Kiểm tra lớp phụ trách.
   - Kiểm tra top học sinh chỉ nằm trong lớp/phạm vi phụ trách.
   - Kiểm tra hồ sơ cần duyệt.
4. Tắt một API hoặc mock lỗi 403:
   - Panel tương ứng lỗi nhẹ.
   - Các panel khác vẫn hoạt động.
5. Test responsive:
   - Desktop 1440px.
   - Tablet 768px.
   - Mobile 390px.

### Automated checks

- `npm run build` trong `frontend`.
- Nếu thêm backend API: `npm test` trong `backend`.
- Nếu thêm helper tính toán: unit test cho các hàm count/average/rate/deadline.

## 12. Rủi ro và lưu ý

- Một số API hiện trả danh sách toàn bộ, có thể nặng nếu dữ liệu lớn; P1 nên gom aggregate ở backend.
- Role detection hiện còn dựa vào chuỗi role name ở nhiều nơi; cần ưu tiên `roleCode` khi có.
- Một số text trong terminal đang bị lệch encoding, nhưng source file vẫn là tiếng Việt; khi sửa UI cần kiểm tra render thật trên browser.
- Nếu route permission `/` chưa được seed, sidebar đang fallback hiển thị; không nên khóa trang chủ nhầm.
- Không dùng dữ liệu từ `frontend/src/lib/mock-data` cho dashboard mới, trừ khi chỉ làm fallback dev có nhãn rõ.

## 13. Kế hoạch agent đề xuất

1. `code-agent`: refactor `frontend/src/app/page.tsx`, tạo component/helper dashboard, kết nối API hiện có.
2. `test-agent`: thêm test helper tính toán, chạy build frontend.
3. `review-agent`: review quyền, trạng thái lỗi, performance request và responsive.
4. `code-agent`: nếu P0 quá nặng, thêm `dashboard` module backend ở P1.
5. `doc-agent`: cập nhật tài liệu vận hành dashboard sau khi code hoàn tất.

## 14. Trạng thái hiện tại

Chưa thực hiện sửa code runtime trong lần cập nhật tài liệu này.

Review code tại thời điểm 2026-06-11 cho thấy dashboard runtime đã có implementation một phần trong `frontend/src/app/page.tsx` và `frontend/src/components/dashboard/*`.

Review lần 2 cập nhật lại hiện trạng:

- Đã fetch `criteriaApi.getCriteria()` và `categoryApi.getCategories()` trong trang chủ.
- Đã có `criteria`, `categories` trong `rawState`.
- Đã truyền `criteria`, `categories` vào `buildDashboardOverview(...)`.
- Đã có `studentHighlights` trong `DashboardMetrics`.
- Đã có `StudentSpotlightPanel` render ngay dưới `DashboardHeader`.
- Đã có logic top khen thưởng, điểm cộng, kỷ luật/cần chú ý tính từ `AcademicRecord` + `Criterion.criterion_type`.

Phần còn thiếu/cần chốt tiếp:

- Kiểm chứng và sửa nếu cần việc tính `latestRecordTitle`, `latestRecordAt`, `impactScore` theo đúng từng loại top, không dùng lẫn record khác loại.
- Bổ sung sort đầy đủ theo số lượt, điểm tác động và thời gian ghi nhận mới nhất.
- `topProgress` chưa có logic rõ, chỉ nên hiển thị khi có dữ liệu so sánh hợp lệ.
- `dailyClassReportApi.getDailyClassReports()` chưa thấy được gọi; attendance đang fallback trong helper.
- `NotificationPanel` chưa thấy render trong `page.tsx`; cần render hoặc bỏ khỏi scope.
- Cần chạy build/test và QA responsive cho `StudentSpotlightPanel` sau khi chốt code.

Vì vậy scope triển khai tiếp theo nên ưu tiên hoàn thiện/kiểm thử các điểm trên, không rewrite toàn bộ dashboard nếu các panel hiện có vẫn hoạt động đúng.
