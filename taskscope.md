## Bo Sung Sau Review

Phan nay bo sung cac hang muc con thieu sau khi review `frontend/src/app/grading/categories/page.tsx` theo `taskscope.md`. Can hoan tat cac muc nay truoc khi xem task UI la dat.

### 1. Chuan hoa radius con sot

Trong `CategoriesPage`, tiep tuc thay cac radius khong dung design tren button, badge, input, card nho, skeleton va indicator:

- Doi `rounded-md` thanh `rounded-xl`.
- Doi `rounded-lg` thanh `rounded-xl`.
- Doi `rounded-[8px]` thanh `rounded-xl`.
- Doi `rounded-[16px]` thanh `rounded-2xl`.
- Doi `rounded` tren badge, skeleton, button thanh `rounded-xl`, tru truong hop checkbox native.
- Khong dung `rounded-full` cho indicator, badge, skeleton, button hoac card. `rounded-full` chi hop le cho avatar/anh tron.

Khu vuc can kiem tra ky:

- Toolbar trong `master-detail`, gom button xoa da chon va button them tieu chi.
- Action buttons trong criteria list cua `master-detail`.
- Action buttons tren category card trong `kanban`.
- Action buttons trong criteria item cua `kanban`.
- Skeleton trong category sidebar, detail panel va kanban cards.

### 2. Sua indicator khong phai avatar

Thanh chi bao mau hien dang dung `rounded-full` can doi sang strip bo nhe:

```tsx
className = "w-1.5 h-10 rounded-xl shrink-0";
```

Voi active indicator canh phai, dung:

```tsx
className =
  "absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#1A73E8] rounded-l-xl";
```

Khong dung `rounded-full` cho cac indicator nay.

### 3. Hoan thien glass border cho Kanban category cards

Kanban category card hien co `border-t-[3px]` nhung thieu crisp glass border. Can giu border top mau neu can phan nhom, dong thoi bo sung border kinh:

```tsx
className={`bg-white/55 backdrop-blur-md border border-white/75 border-t-[3px] ${borderClass} rounded-2xl shadow-sm ...`}
```

Neu Tailwind conflict giua `border` va `border-t-[3px]`, dam bao ket qua cuoi van co:

- Border tong the trang/bac: `border-white/75`.
- Border top mau semantic: `border-t-[3px]`.
- Radius card lon: `rounded-2xl`.
- Hover: `hover:scale-[1.01] hover:shadow-md`.

Ap dung cho ca hai cot `col-1` va `col-2`, bao gom skeleton card trong trang thai loading.

### 4. Doi vung expanded criteria trong Kanban sang glass

Khong dung nen phang:

```tsx
bg - [#faf9fd] / 70;
```

Thay bang glass surface nhe:

```tsx
className =
  "bg-white/35 backdrop-blur-md border-t border-white/60 w-full p-5 flex flex-col gap-4";
```

Empty state ben trong cung can border/glass dung design:

```tsx
className =
  "border border-dashed border-white/70 bg-white/40 backdrop-blur-sm rounded-xl ...";
```

### 5. Chuan hoa action icon buttons

Icon button sua/xoa/mo rong nen thong nhat:

```tsx
className =
  "w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 transition-all duration-150 cursor-pointer";
```

Voi destructive action:

```tsx
className =
  "w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all duration-150 cursor-pointer";
```

Khong dung `p-1.5 rounded-lg` cho icon button nua.

### 6. Chuan hoa badges va point chips

Badge/chip diem con dung `rounded` hoac `rounded-lg` can doi sang `rounded-xl`.

Vi du:

```tsx
className = "px-2 py-0.5 rounded-xl text-[10px] font-bold ...";
```

Point chip:

```tsx
className={`px-3 py-1.5 rounded-xl ${pointBg} shrink-0`}
```

### 7. Chuan hoa skeleton

Skeleton can bam layout UI that:

- Skeleton card: `rounded-2xl`.
- Skeleton button/icon/badge/input: `rounded-xl`.
- Khong dung `rounded-full` trong skeleton tru avatar.
- Khong dung `rounded-lg`.

Vi du:

```tsx
<Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
<Skeleton className="h-3 w-16 bg-slate-100/80 rounded-xl" />
```

### 8. Gioi han stagger animation

List dung delay theo index can tranh delay qua dai khi nhieu item:

```tsx
transition={{ delay: Math.min(idx * 0.02, 0.12) }}
```

Ap dung cho category list trong `master-detail` va cac list criteria neu dang dung `itemIdx * 0.02`.

### 9. Checklist review lai sau khi sua

Chay cac lenh kiem tra nhanh:

```bash
rg "rounded-md|rounded-lg|rounded-\[8px\]|rounded-\[16px\]|rounded-full|bg-\[#faf9fd\]" frontend/src/app/grading/categories/page.tsx
rg "backdrop-blur|border-white|bg-white/" frontend/src/app/grading/categories/page.tsx
```

Ket qua mong muon:

- Lenh dau khong con match trong cac component thuoc `CategoriesPage`, tru `rounded-full` neu that su la avatar.
- Lenh hai cho thay cac panel/card chinh deu dung glass surface.

Sau do can build frontend de xac nhan khong phat sinh loi:

```bash
npm run build
```
