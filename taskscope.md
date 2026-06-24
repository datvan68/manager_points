# Taskscope: Sua loi button Xuat Excel bi lech/tran layout tren /grading

## Muc tieu
- Sua loi button `Xuat Excel` bi lech ra ngoai man hinh/tran khoi trang `/grading` khi doi thiet bi, resize viewport hoac dung kich thuoc tablet/desktop hep.
- Giu button `Xuat Excel` nam ben phai button `Xac nhan` khi 2 nut con du cho nam cung hang.
- Neu viewport hep, cum nut duoc wrap xuong dong hop ly theo thu tu `Xac nhan` -> `Xuat Excel`, khong tran ngang va khong bi che mat.
- Khong thay doi logic xuat Excel, filter, confirm filter, API export hay ten file export.

## Boi canh hien tai
File can kiem tra/sua chinh:
- `frontend/src/app/grading/page.tsx`

Vi tri lien quan:
- Desktop filter toolbar dang nam trong `motion.div` co class gan dung:

```tsx
className="hidden lg:flex ... flex-row gap-3 items-center ... w-full"
```

- Trong toolbar co nhieu phan tu `shrink-0`/`min-w-*`:
  - Search input.
  - Select hoc ky.
  - Nut cau hinh hoc ky.
  - Select khoa.
  - Select lop.
  - Button `Xac nhan`.
  - Button `Xuat Excel`.

- Button `Xuat Excel` hien dang dung:

```tsx
className="relative h-9 ... flex items-center gap-2"
```

Rui ro hien tai:
- Desktop toolbar bat dau hien tu breakpoint `lg` (`>=1024px`), nhung tong width cua cac select + search + 2 button co the lon hon viewport/tablet ngang.
- Nhieu phan tu dang `shrink-0`, lam hang filter khong co kha nang co lai/wrap dung cach.
- Khi viewport hep, button `Xuat Excel` bi day ra ngoai mep phai nhu anh nguoi dung gui.

## Pham vi sua

### 1. Chuan hoa layout toolbar responsive
File can sua:
- `frontend/src/app/grading/page.tsx`

Yeu cau:
- Toolbar desktop khong duoc gay horizontal overflow o cac viewport >= `lg`.
- Co the chon mot trong cac huong sau, uu tien cach it anh huong UI nhat:
  - Doi desktop toolbar tu `flex-row` sang `flex-wrap` voi cac nhom co `min-w-0`.
  - Tach filter controls va action buttons thanh 2 group rieng:
    - Filter group: search/selects, co the co lai hoac wrap.
    - Action group: `Xac nhan` + `Xuat Excel`, can giu thu tu va canh phai khi du rong.
  - Tang breakpoint desktop filter tu `lg` len `xl`, de tablet dung layout mobile/tablet hien co.
  - Dung CSS grid responsive cho toolbar, vi du search chiem cot linh hoat va action group nam cot cuoi, sau do wrap/row moi khi thieu rong.
- Parent/container can co `min-w-0`, `max-w-full`; khong dung cach che loi bang `overflow-hidden` neu no lam mat nut.
- Khong de bat ky phan tu con nao day page tao horizontal scroll.

Goi y class cho container:

```tsx
className="hidden xl:flex relative z-20 w-full max-w-full min-w-0 flex-wrap items-center gap-3 ..."
```

Hoac neu giu `lg:flex`:

```tsx
className="hidden lg:flex relative z-20 w-full max-w-full min-w-0 flex-wrap items-center gap-3 ..."
```

### 2. Tao action group cho Xac nhan + Xuat Excel
File can sua:
- `frontend/src/app/grading/page.tsx`

Yeu cau:
- Boc 2 nut vao wrapper rieng, vi du:

```tsx
<div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
  <Button>...</Button>
  <Button>...</Button>
</div>
```

- Khi khong du rong, wrapper co the xuong dong nhung khong tran viewport.
- `Xuat Excel` luon nam sau/phai `Xac nhan` trong cung group.
- Button can co kich thuoc on dinh:
  - `h-9`
  - `min-w-0`
  - `whitespace-nowrap`
  - text khong bi cat vo nghia.
- Tren man hinh hep co the dung responsive text:
  - icon luon hien.
  - text `Xuat Excel` co the an o breakpoint nho neu can, nhung phai co `title`/`aria-label` ro rang.
- Loading spinner khong lam button doi width bat thuong.

Goi y class cho nut:

```tsx
className="relative h-9 min-w-0 whitespace-nowrap rounded-xl ... inline-flex items-center justify-center gap-2 px-3 sm:px-4"
```

### 3. Dieu chinh width cua select/search de khong ep tran
File can sua:
- `frontend/src/app/grading/page.tsx`

Yeu cau:
- Search input group nen co `min-w-0` va width linh hoat.
- Cac select nen dung `min-w` hop ly nhung khong tat ca deu `shrink-0` khi o breakpoint chat.
- Neu giu desktop toolbar o `lg`, can test truong hop ten khoa/lop dai.
- Neu ten khoa/lop dai trong SelectValue, text phai truncate trong trigger thay vi lam trigger phinh rong.

Goi y:

```tsx
<div className="min-w-0 flex-1 basis-[240px]">
```

Cho select:

```tsx
<div className="min-w-[150px] max-w-full flex-1 lg:flex-none">
```

### 4. Giu nguyen logic nghiep vu export
Khong thay doi:
- `handleExportSummaryExcel`.
- Dieu kien disabled cua button export:

```tsx
!appliedSemester || !appliedClass || isExportingExcel || isTableLoading
```

- Tooltip/title cua button export.
- Icon `FileSpreadsheet`.
- Loading spinner khi dang export.
- Logic confirm filter va applied class/semester.

## Acceptance Criteria
- O viewport desktop rong, `Xuat Excel` nam ben phai `Xac nhan` dung nhu yeu cau cu.
- O viewport tablet/desktop hep, button khong bi day ra ngoai trang va khong tao horizontal scroll.
- O cac kich thuoc sau khong co overflow ngang:
  - 390 x 844
  - 768 x 1024
  - 1024 x 768
  - 1180 x 820
  - 1366 x 768
  - 1440 x 900
- Khi zoom trinh duyet 125% tren desktop, toolbar van khong lam button tran mep phai.
- Neu action group bi wrap, thu tu van la `Xac nhan` truoc, `Xuat Excel` sau.
- Text trong button khong de len nhau, khong bi che boi nut ba cham/menu hoac mep trang.
- Khong lam hong cac flow:
  - Chon khoa/lop/hoc ky.
  - Bam `Xac nhan` de tai danh sach.
  - Bam `Xuat Excel` de tai file Excel.
  - Mobile/tablet filter va advanced filter button.

## Kiem thu de xuat
Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Neu project co test frontend cho trang grading thi chay them:

```bash
cd frontend
npm test -- grading
```

Manual/visual test:
- Mo `/grading`.
- Resize browser qua cac moc 390, 768, 1024, 1180, 1366, 1440.
- Kiem tra khong xuat hien horizontal scrollbar.
- Kiem tra nut `Xuat Excel` khong bi lech ra ngoai mep phai.
- Chon khoa/lop/hoc ky, bam `Xac nhan`, sau do bam `Xuat Excel` de dam bao logic van hoat dong.
- Test voi ten khoa/lop dai neu co du lieu mau.

Co the dung Playwright screenshot neu can xac minh UI:

```bash
cd frontend
npm run dev
```

Sau do chup/kiem tra `/grading` o cac viewport tren.

## Ngoai pham vi
- Khong sua backend export Excel.
- Khong doi template Excel/filename.
- Khong doi design tong the trang `/grading` ngoai layout responsive cua toolbar/filter/action buttons.
- Khong doi permission hoac role export.
