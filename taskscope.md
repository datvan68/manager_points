# Taskscope: Them select chon lop trong slider `/grading/score`

## Muc tieu

Trang `/grading/score` hien co slider "Sinh vien dang cham diem" de teacher/admin/supervisor chon nhanh sinh vien dang cham. Can bo sung mot select chon lop ngay tren khu vuc slider de nguoi dung co quyen teacher/admin/supervisor co the chon lop truc tiep tai trang nay, sau do danh sach sinh vien trong slider duoc reload theo lop vua chon.

Text hien thi tren UI phai dung tieng Viet co dau, vi du:

```text
Chon lop
Tat ca lop / Ten lop
Dang tai danh sach sinh vien...
Vui long chon lop hoc de xem danh sach sinh vien.
```

## Hien trang kiem tra

File chinh:

- `frontend/src/app/grading/score/page.tsx`

Cac diem lien quan hien tai:

- `frontend/src/app/grading/score/page.tsx:38` da import `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`.
- `frontend/src/app/grading/score/page.tsx:44` da import `classApi`.
- `frontend/src/app/grading/score/page.tsx:729` co state `students`.
- `frontend/src/app/grading/score/page.tsx:774` co state `selectedSemesterId`.
- `frontend/src/app/grading/score/page.tsx:775` co state `selectedClassId`.
- `frontend/src/app/grading/score/page.tsx:851` lay `currentUser` tu `tokenStorage.getUser()`.
- `frontend/src/app/grading/score/page.tsx:862` co `currentUserRole = getRoleKey(currentUser?.role)`.
- `frontend/src/app/grading/score/page.tsx:863` co `isAdminOrSupervisor`.
- `frontend/src/app/grading/score/page.tsx:873` co `shouldShowStudentSlider = currentUserRole !== "student"`.
- `frontend/src/app/grading/score/page.tsx:960` load classes bang `classApi.getClasses()`.
- `frontend/src/app/grading/score/page.tsx:969` dang scope class cho teacher theo `advisor_id`/`user_id`.
- `frontend/src/app/grading/score/page.tsx:983` doc `grading_appliedClass` tu `sessionStorage`.
- `frontend/src/app/grading/score/page.tsx:997` set `selectedClassId(effectiveClassId)`.
- `frontend/src/app/grading/score/page.tsx:1002` co local helper `fetchAllSummaries(sem, clsId, resolvedStudentId)`.
- `frontend/src/app/grading/score/page.tsx:1050` lay roster bang `studentApi.getStudents({ classId: effectiveClassId })`.
- `frontend/src/app/grading/score/page.tsx:1064` lay summaries bang `summariesPointApi.getSummariesPoints({ semesterId, classId, page: 1, limit: 1000 })`.
- `frontend/src/app/grading/score/page.tsx:1117` map roster voi summaries bang `mapRosterWithSummaries`.
- `frontend/src/app/grading/score/page.tsx:1120` build `studentSummaryMap`.
- `frontend/src/app/grading/score/page.tsx:1382` effect tu dong scroll slider toi active student.
- `frontend/src/app/grading/score/page.tsx:2684` bat dau block `STUDENT HERO SLIDER`.
- `frontend/src/app/grading/score/page.tsx:2695` header slider hien title, search, nut xoa, nut trai/phai.
- `frontend/src/app/grading/score/page.tsx:2740` `sliderRef` render danh sach card sinh vien.

Hien tai `/grading/score` chi doc lop da ap dung tu `sessionStorage` hoac auto chon lop dau tien cho teacher. Admin/supervisor neu chua co `grading_appliedClass` co the khong co cach doi lop truc tiep trong slider cua trang cham diem.

## Pham vi chinh sua de xuat

Chi chinh trong:

- `frontend/src/app/grading/score/page.tsx`

Khong can doi backend API, khong can doi schema database, khong can sua `/grading` list page neu khong can thiet.

### 1. Them select lop trong header slider

Them select vao header cua `STUDENT HERO SLIDER`, gan voi `selectedClassId`.

Vi tri de xuat:

- Trong block `!isStudentSliderSticky`.
- Nam gan search input, theo layout responsive:
  - desktop: title -> class select -> search
  - mobile/tablet: title tren dong dau, select va search wrap xuong dong duoi neu thieu rong

Goi y UI:

```tsx
<div className="relative w-full md:w-[220px]">
  <Select
    value={selectedClassId || undefined}
    onValueChange={handleClassChange}
    disabled={isRosterLoading || apiClasses.length === 0}
  >
    <SelectTrigger className="h-8 bg-white/70 border-slate-200 text-xs font-semibold">
      <SelectValue placeholder="Chon lop" />
    </SelectTrigger>
    <SelectContent>
      {apiClasses.map((cls) => (
        <SelectItem key={cls._id} value={cls._id}>
          {cls.class_name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Text tren UI khi implement phai co dau:

- placeholder: `Chọn lớp`
- loading label neu can: `Đang tải...`

### 2. Role duoc thay doi lop

Select chi hien cho non-student:

- `teacher`
- `admin`
- `supervisor`

Student khong hien select vi trang student chi cham diem cua chinh minh.

Danh sach option dung `apiClasses` da duoc scope san:

- teacher: chi thay cac lop minh la advisor theo logic hien co `advisor_id || user_id`.
- admin/supervisor: thay tat ca lop backend tra ve.

Khong duoc cho teacher chon lop ngoai scope bang cach bypass UI. Neu handler nhan classId khong nam trong `apiClasses`, bo qua va toast loi ngan gon.

### 3. Tach helper reload roster/summaries theo lop

Nen tach logic dang nam trong `loadRealData` thanh helper dung lai khi doi lop, vi hien tai doan load roster/summaries/map active student dang bi lap logic trong initial load.

Goi y helper:

```tsx
const loadClassRosterAndSummaries = React.useCallback(
  async (classId: string, semesterId: string, options?: { preferStudentId?: string }) => {
    // fetch roster
    // fetch summaries
    // filter period_id null
    // map roster with summaries
    // build studentSummaryMap
    // set students, summaries, summaryMap
    // set active student
  },
  [currentUserRole, studentIdParam]
);
```

Yeu cau trong helper:

- Goi `studentApi.getStudents({ classId })`.
- Goi `summariesPointApi.getSummariesPoints({ semesterId, classId, page: 1, limit: 1000 })`.
- Chi giu summaries hoc ky tong hop: `!sum.period_id || sum.period_id === null`.
- Map bang helper hien co `mapRosterWithSummaries(filteredStudents, summariesData, colors)`.
- Build `studentSummaryMap` bang `buildSummaryIndex` va `findSummaryForStudent`.
- Khi co `studentIdParam` va sinh vien do nam trong lop hien tai, co the active sinh vien do trong initial load.
- Khi user doi lop bang select, nen active sinh vien dau tien cua lop moi, khong giu `studentIdParam` cu neu no khong thuoc lop moi.

### 4. Handler khi chon lop

Them handler `handleClassChange(classId: string)`.

Flow de xuat:

1. Neu classId rong, trung voi `selectedClassId`, hoac khong nam trong `apiClasses`, dung lai.
2. Set `selectedClassId(classId)`.
3. Luu `sessionStorage.setItem("grading_appliedClass", classId)` de dong bo voi logic hien co.
4. Reset UI phu thuoc lop cu:
   - `setRosterSearch("")`
   - `setActiveStudentId("")`
   - `setStudents([])`
   - `setApiSummariesPoints([])`
   - `setStudentSummaryMap({})`
   - `setEvaluationDetailsMap({})`
   - `setEvaluationCounts({})`
   - `setSelectedOptionsState({})`
   - `setPreExistingCountsState({})`
   - `setHistoryRecords([])`
5. Bat state loading rieng cho roster, vi `isFetching` dang dung cho detail active student va `isInitialLoading` dang dung cho lan load dau.
6. Goi helper reload roster/summaries voi `selectedSemesterId` va classId.
7. Neu loi, toast: `Không thể tải danh sách sinh viên của lớp đã chọn.`

Goi y state moi:

```tsx
const [isRosterLoading, setIsRosterLoading] = useState(false);
```

Slider skeleton nen hien khi:

```tsx
isInitialLoading || isRosterLoading
```

### 5. Khong lam stale detail cua lop cu

Effect load detail theo `activeStudentId` hien phu thuoc vao:

```tsx
[activeStudentId, studentSummaryMap, categories, isInitialLoading]
```

Sau khi doi lop, can dam bao:

- Khong render lich su ghi nhan cua sinh vien lop cu trong luc roster lop moi dang tai.
- Khong giu `evaluationCounts`, `selectedOptionsState`, `preExistingCountsState` cua lop cu neu active student moi chua load xong.
- Nut luu diem khong thao tac vao summary cu khi dang doi lop.
- `activeStudentId` chi duoc set sau khi `studentSummaryMap` cua lop moi da duoc build.

Neu can, disable nut save/copy/delete khi `isRosterLoading`.

### 6. Empty/loading state trong slider

Khi dang reload lop:

```text
Đang tải danh sách sinh viên...
```

Khi lop da chon nhung khong co sinh vien:

```text
Lớp này chưa có sinh viên.
```

Khi chua chon lop:

```text
Vui lòng chọn lớp học để xem danh sách sinh viên.
```

Khi search khong co ket qua:

```text
Không tìm thấy sinh viên nào khớp với bộ lọc.
```

Co the tiep tuc dung block empty hien co o `frontend/src/app/grading/score/page.tsx:2765`, nhung can phan biet `isRosterLoading`, `selectedClassId`, va `students.length`.

### 7. Khong thay doi ngoai pham vi

Khong lam cac viec sau trong task nay:

- Khong doi backend endpoint.
- Khong doi co che tinh diem, luu diem, approve/lock summary.
- Khong doi logic deadline/giai doan cham diem.
- Khong doi `mapRosterWithSummaries`, `summary-matching` neu khong bat buoc.
- Khong hien select cho student role.
- Khong auto initialize summary cho lop moi. Neu lop chua co summary, giu behavior hien co: card sinh vien co trang thai `no_summary` va cac hanh dong cham diem phu thuoc `studentSummaryMap`.

## Acceptance criteria

- Teacher/admin/supervisor thay select chon lop trong slider cua `/grading/score`.
- Student khong thay select chon lop.
- Teacher chi thay va chon duoc cac lop minh phu trach.
- Admin/supervisor thay va chon duoc cac lop duoc backend tra ve.
- Khi chon lop moi, slider hien loading/skeleton trong luc tai roster.
- Sau khi tai xong, slider hien danh sach sinh vien cua dung lop moi.
- `activeStudentId` duoc reset sang sinh vien dau tien cua lop moi, hoac rong neu lop khong co sinh vien.
- Search trong slider duoc reset khi doi lop.
- History, counts, selected options, pre-existing counts va details khong con hien du lieu sinh vien/lop cu sau khi doi lop.
- `studentSummaryMap` va `apiSummariesPoints` duoc build lai theo `selectedSemesterId + selectedClassId`.
- `sessionStorage.grading_appliedClass` duoc cap nhat theo lop vua chon.
- Nut trai/phai slider van hoat dong nhu hien tai.
- Sticky slider va auto-scroll toi active student khong bi loi.
- Khong co request API lap vo han khi doi lop.
- Khong phat sinh loi TypeScript/lint tu cac state/helper moi.

## Test plan

1. Dang nhap teacher co it nhat 2 lop phu trach.
2. Mo `/grading/score`, xac nhan select hien va option chi gom lop cua teacher.
3. Chon lop khac, xac nhan slider reload va danh sach sinh vien doi theo lop.
4. Chon mot sinh vien, xac nhan detail/category/history load theo sinh vien moi.
5. Search sinh vien trong lop A, doi sang lop B, xac nhan search bi reset.
6. Dang nhap admin/supervisor, xac nhan select hien nhieu lop va co the doi lop bat ky trong danh sach.
7. Dang nhap student, xac nhan khong hien select lop va flow tu cham diem khong doi.
8. Chon lop khong co sinh vien, xac nhan empty state hien dung.
9. Chon lop co sinh vien nhung chua co summary, xac nhan card hien nhung nut luu diem bi disable theo logic hien co.
10. Reload trang sau khi chon lop moi, xac nhan trang doc lai `grading_appliedClass` va load dung lop.

## Trang thai

Day la taskscope de agent trien khai. Chua chinh code implementation.
