# Task Scope: Sticky Student Slider On Grading Score Page

## Target Area

- Page: `/grading/score`
- Main file: `frontend/src/app/grading/score/page.tsx`
- Section: `STUDENT HERO SLIDER`
- Related state/behavior:
  - `shouldShowStudentSlider`
  - `filteredStudentsForRoster`
  - `activeStudentId`
  - `sliderRef`
  - `scrollSlider()`
  - drag-to-scroll handlers

## User Request

Khi cham diem tren trang `/grading/score`, nguoi dung thuong cuon xuong de cham cac danh muc tieu chi. Thanh slider sinh vien hien tai se troi len khoi man hinh, lam kho chuyen nhanh giua cac sinh vien.

Can thay doi:

1. Khi cuon xuong khu vuc cham diem, thanh slider sinh vien phai co dinh o top.
2. Doi mau nen cua thanh slider khi dang sticky de de nhan dang va tranh roi mat.
3. Khong thay doi logic tinh diem, logic chon sinh vien, hoac logic luu/cham diem.

## Current Finding

- Student slider dang render truc tiep trong `frontend/src/app/grading/score/page.tsx`.
- Wrapper hien tai:
  - `bg-white/45`
  - `backdrop-blur-md`
  - `border border-white/70`
  - `rounded-2xl`
  - `relative overflow-hidden`
- Slider nam ben trong scroll container chinh cua page:
  - main content co `overflow-y-auto custom-scrollbar`
- Vi slider khong co `sticky`, khi nguoi dung cuon xuong danh muc tieu chi thi slider bien mat khoi viewport.

## Required Fix

1. Bien wrapper cua `STUDENT HERO SLIDER` thanh sticky header trong vung content scroll.
2. Dung class Tailwind tuong duong:
   - `sticky`
   - `top-0` hoac top offset phu hop voi layout thuc te
   - `z-30` hoac cao hon cac card tieu chi nhung khong de len modal/sidebar
3. Doi background khi sticky de tach ro voi danh muc tieu chi ben duoi.
4. Nen uu tien mau nen trung tinh, de doc:
   - default: `bg-white/45`
   - sticky: `bg-slate-50/95` hoac `bg-white/95`
   - border: `border-slate-200/80`
   - shadow: `shadow-md shadow-slate-200/60`
5. Giu lai blur neu khong gay nhieu hieu ung thi giac:
   - `backdrop-blur-md`
6. Dam bao thanh slider khong che mat noi dung dau tien cua danh muc tieu chi.
7. Neu sticky gay sat mep qua, them padding/top spacing hop ly cho section ben duoi.

## UI/UX Requirements

1. Khi nguoi dung cuon danh muc tieu chi, thanh slider sinh vien van nam o top de co the doi sinh vien nhanh.
2. Mau nen sticky can ro rang hon nen page, khong trong suot qua muc gay roi mat.
3. Active student card trong slider van giu highlight hien tai.
4. O tim kiem sinh vien va nut dieu huong trai/phai van click duoc khi sticky.
5. Drag-to-scroll tren slider van hoat dong.
6. Empty state va skeleton loading trong slider van hien thi dung.
7. Tren mobile, slider sticky khong duoc che qua nhieu chieu cao man hinh.
8. Khong tao overlap voi sidebar, top nav, modal, toast, hoac floating scroll-to-top button.

## Suggested Implementation Shape

Option toi thieu:

```tsx
{shouldShowStudentSlider && (
  <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-md shadow-slate-200/60 shrink-0 flex flex-col gap-4 overflow-hidden">
    ...
  </div>
)}
```

Neu can phan biet trang thai sticky that su, co the them state theo `IntersectionObserver` hoac scroll listener noi bo de doi class:

```tsx
const [isStudentSliderSticky, setIsStudentSliderSticky] = useState(false);
```

Sau do chi ap dung background/shadow dam hon khi `isStudentSliderSticky === true`.

Chi dung cach nay neu CSS sticky thuan khong du de dat yeu cau nhan dien.

## Safety Rules

- Khong thay doi `activeStudentId` flow.
- Khong thay doi `evaluationCounts`.
- Khong thay doi `studentSummaryMap`.
- Khong thay doi API call cham diem, luu diem, copy diem, xoa bang diem.
- Khong thay doi cong thuc tinh diem tieu chi.
- Khong thay doi permission theo role.
- Khong them dependency moi chi de lam sticky UI.
- Khong hard-code chieu cao tuyet doi neu co the dung responsive spacing.

## Acceptance Criteria

- Tren `/grading/score`, khi cuon xuong danh muc tieu chi, thanh slider sinh vien van co dinh o top.
- Slider co mau nen ro hon luc sticky, de phan biet voi noi dung cham diem ben duoi.
- Nguoi dung co the click sinh vien khac trong slider khi dang o vi tri cuon sau.
- Search sinh vien trong slider van hoat dong.
- Nut cuon trai/phai cua slider van hoat dong.
- Drag-to-scroll slider van hoat dong.
- Active student card van duoc highlight nhu hien tai.
- Danh muc tieu chi khong bi che mat boi slider sticky.
- Layout desktop va mobile khong bi overlap, clipping, hoac layout shift lon.

## Suggested Verification

1. Mo `/grading/score`.
2. Chon lop co nhieu sinh vien va co danh muc tieu chi dai.
3. Cuon xuong giua/cuoi danh sach tieu chi.
4. Xac nhan slider sinh vien van co dinh o top.
5. Xac nhan mau nen slider de nhin, khong gay roi mat voi card tieu chi.
6. Click doi sinh vien khi dang cuon o giua danh sach.
7. Search sinh vien tren slider.
8. Test nut trai/phai va keo ngang slider.
9. Kiem tra mobile/responsive width.
10. Chay frontend lint/test neu project co script phu hop.
