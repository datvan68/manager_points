# Taskscope: Kiem tra va toi uu do muot Web Manager Points

agent_id: orchestrator
pipeline_id: performance_review_scope
ngay_lap: 2026-06-21

## 1. Muc tieu

He thong hien co dau hieu van hanh chua muot tren web, dac biet o cac man hinh co nhieu du lieu, nhieu animation va nhieu state client-side.

Muc tieu cua scope nay:
- Xac dinh cac diem nghen uu tien trong frontend Next.js.
- Lap pham vi cong viec ro rang de toi uu do muot khi load trang, scroll, chuyen tab, tim kiem, chon sinh vien/lop va thao tac cham diem.
- Giu nguyen logic nghiep vu, quyen truy cap, API contract va du lieu hien co trong dot toi uu dau tien.

## 2. Hien trang da kiem tra

### 2.1 Cong nghe frontend

- Frontend dung Next.js 16, React 19, TypeScript, Tailwind CSS.
- Nhieu man hinh la client component (`"use client"`), data fetching chu yeu nam trong `useEffect`.
- Dependency `@tanstack/react-virtual` da co trong `frontend/package.json`, nhung slider sinh vien o `/grading/score` chua su dung virtualization.
- `framer-motion` duoc import rong rai tren nhieu page/component, tao nguy co animation/re-render qua nhieu khi danh sach lon.

### 2.2 Hotspot 1: `/grading/score`

File chinh: `frontend/src/app/grading/score/page.tsx` (~3388 dong).

Van de da thay:
- `filteredStudentsForRoster` van cat cung `list.slice(0, 30)`, nen danh sach sau item 30 khong duoc render du search co ket qua.
- Slider sinh vien render truc tiep bang `filteredStudentsForRoster.map(...)`, chua dung `useVirtualizer`.
- Auto-scroll active student dua vao DOM id bang `document.getElementById("student-card-${activeStudentId}")`; cach nay se hong khi ap dung virtualization va cung khong tot neu card chua render.
- Main scroll handler goi state update truc tiep khi scroll (`setShowScrollTop`, `setIsStudentSliderSticky`), co the gay re-render day hon can thiet.
- Khi doi active student, effect load detail phu thuoc `categories`; neu categories thay doi co the goi lai API detail.
- `calculateRealtimeScore` goi `setStudents(prev => prev.map(...))` moi lan doi diem tieu chi, lam ca danh sach sinh vien bi map lai.
- Cac card slider, category, history dung `motion.div` nhieu; animation mount/unmount co the lam scroll/interaction giat tren may yeu.

### 2.3 Hotspot 2: `/students/record`

File chinh: `frontend/src/app/students/record/page.tsx` (~4840 dong).

Van de da thay:
- Page qua lon, gom nhieu luong: list, add/edit/detail, trash, import, config, class/student tab.
- Nhieu state local nam chung trong mot component lon, moi thay doi filter/modal/layout co nguy co re-render vung UI lon.
- Table/card list chua thay co virtualization; page size mac dinh 20 nen tam on, nhung card layout co nhieu animation va drawer/detail co the nang.
- Co timer loading gia lap (`setTimeout(() => setIsLoading(false), 500)` va pagination timeout), lam cam giac phan hoi cham hon thuc te.
- Doc/ghi `localStorage` va load cau hinh nam trong component lon; nen tach nho hoac cache de giam chi phi mount.

### 2.4 Hotspot 3: `/reports`

File chinh: `frontend/src/app/reports/page.tsx` (~1223 dong).

Van de da thay:
- Da co dynamic import cho report tabs, day la huong tot.
- `loadTabSpecificData` set `isLoading(true)` cho moi tab/page change, co the lam toan trang nhay loading thay vi chi loading vung tab.
- Co nhieu effect co the kich hoat load lai: active tab, pagination, filter reset. Can dam bao khong double fetch khi filter/pagination thay doi lien tiep.
- `processReportsData(dataset, filters)` duoc tinh trong render; voi dataset lon nen memo hoa theo dependency.
- Export report co the xu ly workbook tren main thread, gay dung UI khi export nhieu dong.

### 2.5 Hotspot 4: Dashboard `/`

File chinh: `frontend/src/app/page.tsx`.

Van de da thay:
- Dashboard import tat ca sub-components truc tiep, gom chart/panel he thong. Neu user khong can panel do, van co nguy co tang initial bundle.
- Data lay qua `systemApi.getDashboardMetrics`, day la huong tot neu backend da aggregate. Tuy nhien can kiem tra payload va bundle chart.
- Refresh/semester change set state o page cha, lam toan dashboard re-render.

### 2.6 Hotspot 5: Layout chung

File lien quan: `frontend/src/components/layout/Sidebar.tsx`.

Van de da thay:
- Sidebar fetch route permission public va filter menu tren client.
- Da co cache module-level TTL 60 giay, tot cho navigation.
- Can tiep tuc dam bao Sidebar/Header khong re-render nang theo tung page state.

## 3. Nguyen nhan kha nang cao

1. Render list chua ao hoa o slider cham diem va mot so list nang.
2. Component page qua lon, state tap trung, lam thay doi nho gay re-render rong.
3. Animation `framer-motion` ap dung tren nhieu item list/card.
4. Scroll handler cap nhat React state truc tiep khi scroll.
5. Data fetching client-side co nguy co double fetch va loading toan trang.
6. Mot so tinh toan derived data va export xu ly tren main thread.

## 4. Pham vi toi uu dot 1

### 4.1 Toi uu `/grading/score` truoc

Do uu tien: P0.

Cong viec:
- Bo `slice(0, 30)` trong `filteredStudentsForRoster`.
- Ap dung `@tanstack/react-virtual` cho horizontal student slider.
- Render chi visible student cards + overscan, khong render ca danh sach filtered.
- Chuan hoa width card sticky/non-sticky de virtualizer tinh size on dinh.
- Doi auto-scroll active student sang `studentVirtualizer.scrollToIndex(activeStudentIndex, { align: "center" })`.
- Tach `StudentSliderCard` thanh component rieng va memo hoa props can thiet.
- Giam/restrict `framer-motion` trong virtualized cards; progress bar co the giu animation nhe, card mount animation nen tat hoac don gian hoa.
- Throttle/debounce/rAF scroll state cua `mainRef` hoac dung `IntersectionObserver` cho sticky/show scroll top.
- Memo hoa derived data: active student index, active summary, flattened criteria neu can.

Khong lam trong dot 1:
- Khong doi backend API.
- Khong doi quy trinh cham diem, save/copy/delete summary.
- Khong doi permission/role guard.

### 4.2 On dinh data fetching `/grading/score`

Do uu tien: P1.

Cong viec:
- Gop logic load detail active student dang bi lap o initial load va effect active student thanh helper dung chung.
- Dam bao effect load detail chi chay khi `activeStudentId`, `studentSummaryMap`, `isInitialLoading` thay doi that su can thiet.
- Su dung primitive dependencies thay vi object/function de tranh fetch lai khong can thiet.
- Neu can, dung cache in-memory nho cho detail theo `summaryId` trong session hien tai.

### 4.3 Toi uu `/reports`

Do uu tien: P1.

Cong viec:
- Memo hoa `processReportsData(dataset, filters)`.
- Khong set loading toan trang khi chi doi tab/page; chi loading tab hien tai.
- Kiem tra va chan double fetch khi filter thay doi dong thoi reset pagination.
- Dua export workbook lon sang dynamic import/on-demand path; neu export lon van giat, xem xet Web Worker hoac server-side export.

### 4.4 Toi uu `/students/record`

Do uu tien: P2.

Cong viec:
- Tach page thanh cac component: filters, student list, class report list, trash modal, import actions, detail drawer.
- Memo hoa row/card item; handler truyen xuong dung `useCallback` khi co loi ich ro.
- Xoa loading delay gia lap neu khong co muc dich UX bat buoc.
- Neu list tang lon hon page size 20 hoac co card view nang, ap dung virtualization cho table/card.

### 4.5 Toi uu bundle/layout chung

Do uu tien: P2.

Cong viec:
- Dynamic import cac panel/dashboard chart khong can cho first viewport hoac khong can theo role.
- Kiem tra `framer-motion` import rong; voi animation don gian co the thay bang CSS transition.
- Giu Sidebar/Header memo/cache, tranh truyen props moi khong can thiet.

## 5. Acceptance criteria

- `/grading/score` khong con gioi han 30 sinh vien; search thay du ket qua trong lop.
- Slider sinh vien chi render visible cards + overscan; DOM node student card khong tang theo tong so sinh vien.
- Click student card van load dung detail cham diem.
- Auto-scroll den active student hoat dong ke ca khi card chua render truoc do.
- Drag-scroll, nut trai/phai, sticky slider, empty state va loading skeleton van hoat dong.
- Scroll trang cham diem khong gay re-render lien tuc ro rang.
- `/reports` chuyen tab/page khong nhay loading toan trang neu chi load noi dung tab.
- Export report van dung du lieu va khong lam hong UI state.
- Build TypeScript thanh cong.
- Khong thay doi logic nghiep vu, permission, role guard.

## 6. Test plan

### 6.1 Automated

Chay trong `frontend`:

```bash
npm run build
npm test
```

Neu build/test hien co qua nang, uu tien:

```bash
npm test -- grading
npm test -- reports
npm test -- students
```

### 6.2 Manual `/grading/score`

- Dang nhap admin/supervisor/teacher.
- Mo lop co nhieu sinh vien hon 30.
- Tim sinh vien nam sau vi tri 30 bang MSSV/ten.
- Click nhieu sinh vien lien tiep va xac nhan detail load dung.
- Bam trai/phai, drag-scroll, scroll page de slider sticky roi tiep tuc chon sinh vien.
- Kiem tra empty state: chua chon lop, lop rong, search khong co ket qua.
- Kiem tra student role khong bi hien slider ngoai y muon.

### 6.3 Manual `/reports`

- Chuyen qua tung tab report.
- Doi filter hoc ky/lop/search/status.
- Doi page size/page tren cac tab.
- Export tung tab va export tong hop.
- Xac nhan loading chi anh huong dung vung dang load.

### 6.4 Manual `/students/record`

- Chuyen table/card view.
- Tim kiem, loc lop, loc ngay, doi page size.
- Mo drawer/detail/edit/import/trash.
- Xac nhan khong co delay gia lap lam nguoi dung tuong he thong cham.

## 7. Rui ro can kiem soat

- Virtualization horizontal de sai width co the lam scroll lech hoac card bi overlap.
- Sticky slider hien dung `w-fit`; neu giu width dong, can measurement chinh xac.
- Tat animation qua manh co the lam UI mat cam giac feedback; nen giam co chon loc.
- Cache detail cham diem co the lam du lieu cu sau khi save/delete/copy; phai invalidate dung `summaryId`.
- Sua effect dependencies co the lam mat fetch can thiet neu rut gon qua tay.
- Export report neu dua sang worker/dynamic import can test ky filename, sheet, masked logs.

## 8. Thu tu trien khai de xuat

1. Implement virtualization slider `/grading/score`.
2. Sua auto-scroll active student va bo `slice(0, 30)`.
3. Giam re-render scroll/sticky tren `/grading/score`.
4. Tach va memo hoa card/row nang o `/grading/score`.
5. Chay build/test, manual test cham diem.
6. Toi uu loading va memo data o `/reports`.
7. Tach nho `/students/record` va bo delay loading gia lap.
8. Kiem tra bundle/animation chung sau khi cac hotspot P0/P1 on dinh.

## 9. Ghi chu theo Vercel React best practices

- Uu tien loai waterfall va fetch lap lai truoc khi toi uu nho.
- Dung dynamic import cho thanh phan nang khong can trong first interaction.
- Dung memo/component boundary cho vung tinh toan nang, khong memo hoa cac primitive don gian.
- Dung passive listener/rAF/throttle cho scroll/touch neu co listener native.
- Dung virtualization hoac `content-visibility` cho danh sach dai.
