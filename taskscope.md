# Taskscope: Kiem tra truong Khoa trong "Them ghi nhan Ren luyen"

## 1. Ket luan nhanh

Truong **Khoa** trong man **Them Ghi nhan Ren luyen** van dang dung du lieu tinh/hard-code trong frontend, chua lay tu API `departmentApi.getDepartments()`.

Backend va frontend da co API that cho danh sach Khoa:

- Backend: `GET /departments`
- Frontend client: `departmentApi.getDepartments()`

Tuy nhien rieng component `AddRecordView` chua import/chua goi API nay. State `department` hien chi dung de hien thi dropdown va khong duoc gui trong payload tao/cap nhat ghi nhan ren luyen.

## 2. Bang chung code

### Frontend - man Them Ghi nhan Ren luyen

File: `frontend/src/components/grading/AddRecordView.tsx`

- Component man hinh: `AddRecordView`
- Tieu de form: `Them Ghi nhan Ren luyen`
- State Khoa dang hard-code:
  - `const [department, setDepartment] = useState('Cong nghe thong tin')`
- Dropdown Khoa dang co 4 option tinh:
  - `Cong nghe thong tin`
  - `Dien tu - Vien thong`
  - `Kinh te`
  - `Co khi`
- Component chi load:
  - `classApi.getClasses()`
  - `criteriaApi.getCriteria()`
  - `semesterApi.getSemesters()`
- Khong thay:
  - `departmentApi` import trong file nay
  - `departmentApi.getDepartments()` trong file nay
  - hook/store nao cap danh sach Khoa cho form nay

### Frontend - payload luu ghi nhan

File: `frontend/src/components/grading/AddRecordView.tsx`

Khi cap nhat mot ghi nhan, payload gui:

- `student_id`
- `criterion_id`
- `semester_id`
- `record_title`
- `description`
- `status`
- `recorded_at`
- `recorded_by`

Khi tao hang loat, payload gui:

- `student_id`
- `criterion_id`
- `semester_id`
- `record_title`
- `description`
- `status`
- `recorded_at`
- `recorded_by`
- `idempotency_key`
- `source`

Khong co field `department`, `faculty`, `department_id`, hay `dept_id` trong payload luu ghi nhan.

### Frontend - API Khoa da ton tai

File: `frontend/src/api/department-api.ts`

- `departmentApi.getDepartments()` goi `${API_BASE}/departments`
- API client nay da duoc dung o cac man khac:
  - `frontend/src/app/students/page.tsx`
  - `frontend/src/app/grading/page.tsx`
  - `frontend/src/components/popups/ClassPopup.tsx`
  - `frontend/src/components/popups/StudentPopup.tsx`

### Backend - API Khoa that

Files:

- `backend/src/departments/departments.controller.ts`
- `backend/src/departments/departments.service.ts`
- `backend/src/departments/schemas/department.schema.ts`

Backend co module `departments` that:

- `GET /departments`
- `GET /departments/:id`
- `POST /departments`
- `PATCH /departments/:id`
- `DELETE /departments/:id`

Schema `Department` gom cac truong chinh:

- `name`
- `code`
- `description`

Khong thay endpoint/model rieng ten `faculty` hoac `faculties`.

### Backend - ghi nhan ren luyen

Files:

- `backend/src/academic-record/academic-record.controller.ts`
- `backend/src/academic-record/schemas/academic-record.schema.ts`

Ghi nhan ren luyen dung resource `academic-records`, trong schema khong luu truc tiep Khoa. Khoa duoc suy ra theo sinh vien/lop:

- `AcademicRecord.student_id`
- `Student.class_id`
- `Class.dept_id`

Vi vay neu chi can filter UI theo Khoa, co the xu ly o frontend bang danh sach Department + Class, khong can them field vao `AcademicRecord`.

## 3. Mock/seed lien quan

File: `frontend/src/app/students/page.tsx`

- Co co che seed Khoa/Lop khi `NEXT_PUBLIC_ENABLE_MOCK_SEED === "true"`.
- Seed nay goi API that `departmentApi.createDepartment(...)`, khong phai la dropdown static trong `AddRecordView`.

Files mock cu:

- `frontend/src/lib/mock-data/students.ts`
- `frontend/src/lib/mock-data/add-record.ts`
- `frontend/src/lib/mock-data/ghinhan.ts`

Chua thay cac file mock nay duoc import truc tiep vao `AddRecordView` hoac `students/record/page.tsx` cho dropdown Khoa hien tai.

## 4. Pham vi can sua de bo mock Khoa trong form

### Muc tieu

Chuyen dropdown **Khoa** trong `AddRecordView` tu danh sach hard-code sang danh sach lay tu API `departmentApi.getDepartments()`.

### Frontend scope

File can sua chinh:

- `frontend/src/components/grading/AddRecordView.tsx`

Viec can lam:

1. Import `departmentApi` va type `Department`.
2. Them state `departments`.
3. Trong `loadData()`, goi them `departmentApi.getDepartments()`.
4. Doi state `department` tu ten Khoa hard-code sang `departmentId`.
5. Render dropdown Khoa bang `departments.map(...)`.
6. Khi chon Khoa, reset `classId`, `selectedStudentId`, `classStudents`, `addedViolations`.
7. Loc dropdown Lop theo `Class.dept_id` trung voi `departmentId`.
8. Xu ly trang thai rong/loading/error:
   - Chua co Khoa
   - Khong tai duoc danh sach Khoa
   - Khoa da chon khong co Lop
9. Edit mode: tu `recordToEdit.student_id.class_id.dept_id` hoac API student/class de set lai `departmentId` tuong ung.

### Backend scope

Khong can sua backend neu muc tieu chi la bo mock dropdown Khoa va loc Lop theo Khoa trong form.

Chi can can nhac backend neu muon:

- Them filter `departmentId` truc tiep vao API ghi nhan ren luyen.
- Luu snapshot ten Khoa tai thoi diem tao ghi nhan.
- Export/report can truy van nhanh theo Khoa ma khong populate qua Lop/Sinh vien.

## 5. Acceptance criteria

- Dropdown Khoa trong **Them Ghi nhan Ren luyen** hien dung danh sach tu `GET /departments`.
- Khong con 4 option hard-code trong `AddRecordView`.
- Chon Khoa nao thi dropdown Lop chi hien Lop thuoc Khoa do.
- Doi Khoa se reset Lop, Sinh vien va danh sach ghi nhan tam de tranh luu nham.
- Tao moi ghi nhan van goi `academicRecordApi.bulkCreateAcademicRecords(...)` nhu hien tai.
- Cap nhat ghi nhan van goi `academicRecordApi.updateAcademicRecord(...)` nhu hien tai.
- Payload ghi nhan khong can them `department` neu backend tiep tuc suy ra Khoa qua `student_id -> class_id -> dept_id`.
- Neu API `/departments` loi, UI hien thong bao ro va khong fallback ve danh sach mock am tham.

## 6. Rui ro va luu y

- `Class.dept_id` co the la string hoac object Department; can normalize khi loc Lop.
- Neu tai khoan bi gioi han Khoa, `GET /departments` co the chi tra ve cac Khoa duoc phep xem; UI nen ton trong ket qua API.
- Hien `department` trong `AddRecordView` dang khong anh huong payload, nen viec sua chu yeu tac dong trai nghiem chon/lop/sinh vien.
- Can can than edit mode: ban ghi cu khong co Khoa truc tiep, phai suy ra tu sinh vien hoac lop cua sinh vien.

## 7. De xuat task tiep theo

Implement fix trong `frontend/src/components/grading/AddRecordView.tsx`:

- Thay dropdown Khoa hard-code bang API departments.
- Loc Lop theo Khoa.
- Bo state `department` dang luu ten Khoa tinh, thay bang `departmentId`.
- Them regression test/kiem tra thu cong cho tao moi va edit mode.
