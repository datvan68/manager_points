# Task Scope: Sua popup xem day du noi dung danh muc/tieu chi tren /grading/categories

## Muc tieu

Dieu chinh tinh nang mo popup/dialog de xem day du noi dung cua danh muc va tieu chi tren trang `/grading/categories`, tranh tinh trang popup nam sat vien man hinh/container lam mat chu o dau dong nhu anh user gui.

Yeu cau mong muon:

1. Nguoi dung bam icon xem day du noi dung cua danh muc/tieu chi thi noi dung hien ro, khong bi cat trai/phai.
2. Popup/dialog co khoang cach an toan voi viewport va container cha.
3. Van giu duoc trai nghiem gon nhe: chi hien icon xem day du khi ten/noi dung bi rut gon.

## Hien trang lien quan

File can kiem tra chinh:

- `frontend/src/app/grading/categories/page.tsx`

File co pattern tooltip dang gay loi tuong tu can doi chieu/tai su dung:

- `frontend/src/app/grading/score/page.tsx`

Trong `/grading/categories`, cac vi tri dang truncate ten danh muc/tieu chi:

- Master list category: `h4` co `truncate` va `title={cat.name}`.
- Master-detail header: `h2` co `truncate` va `title={activeCat.name}`.
- Master-detail criteria row: `h4` co `truncate` va `title={item.name}`.
- Kanban category card cot 1/cot 2: `h3` rut gon khi `cat.name.length > 100`.
- Kanban criteria card cot 1/cot 2: `h4` rut gon khi `item.name.length > 50`.

Trong `/grading/score`, dang co component `CriteriaTooltip`:

```tsx
<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 ...">
```

Component nay hien label `Noi dung day du:` va can giua theo icon. Khi icon nam gan vien trai/phai hoac trong vung cha co `overflow-hidden`, popup rong co dinh `w-64` de bi cat noi dung.

## Root Cause

Nguyen nhan chinh cua loi trong anh:

- Popup dung `position: absolute` ben trong trigger wrapper.
- Can popup bang `left-1/2 -translate-x-1/2` ma khong co collision detection.
- Popup co width co dinh `w-64`, khong gioi han theo `viewport` nho.
- Mot so container cha tren `/grading/categories` co `overflow-hidden`, vi du card/khung noi dung, nen popup co the bi clip.
- Text trong popup chua co chinh sach wrap manh nhu `break-words`, `whitespace-normal`, `max-w-[calc(100vw-...)]`.

## Pham vi can sua

### 1. Tao component xem day du noi dung dung chung

De xuat tao component nho trong `frontend/src/app/grading/categories/page.tsx` hoac tach ra file rieng neu muon dung lai cho `/grading/score`:

- Ten goi y: `FullContentTooltip`, `FullContentPopover`, hoac `FullContentDialog`.
- Props toi thieu:
  - `content: string`
  - `label?: string`
  - `className?: string`

Component can:

- Dung icon `Info` tu `lucide-react` neu chua import.
- Dong khi click ra ngoai hoac bam lai icon.
- Stop propagation de khong trigger expand/drag/click card category.
- Chi render khi `content` dai hon nguong rut gon.

Nguong goi y:

- Category name: `content.length > 35` o header/list nho, hoac `> 100` neu dang cat bang logic hien co.
- Criteria name: `content.length > 50`.

### 2. Chon cach hien thi khong bi cat vien

Phuong an uu tien: dung Radix `Popover` da co san trong project.

File co san:

- `frontend/src/components/ui/popover.tsx`

De xuat:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <button type="button">...</button>
  </PopoverTrigger>
  <PopoverContent
    side="bottom"
    align="start"
    sideOffset={8}
    collisionPadding={16}
    className="z-[100] w-[min(20rem,calc(100vw-2rem))] p-3 rounded-xl bg-slate-900/95 text-white border border-white/10 shadow-xl"
  >
    ...
  </PopoverContent>
</Popover>
```

Ly do:

- Radix Popover tu tinh va flip/shift khi gan canh viewport.
- `collisionPadding={16}` giu popup cach vien man hinh.
- Portal giup tranh bi container cha `overflow-hidden` cat.

Neu khong muon dung Popover, phuong an thay the la render popup bang fixed overlay/dialog:

- Desktop: `position: fixed`, tinh `left/top` theo `getBoundingClientRect()` va clamp trong viewport.
- Mobile: hien dialog center hoac bottom sheet nho de noi dung khong bi cat.

### 3. Sua layout/text trong popup

Popup can co style bao ve text dai:

```tsx
className="max-w-[calc(100vw-2rem)] whitespace-normal break-words leading-relaxed"
```

Noi dung nen co:

- Tieu de: `Noi dung day du:` hoac `Noi dung danh muc:` / `Noi dung tieu chi:` neu muon ro hon.
- Body: text day du, khong truncate.
- `max-h-[50vh] overflow-y-auto custom-scrollbar` neu noi dung qua dai.

Can tranh:

- `whitespace-nowrap` trong body popup.
- Popup nam ben trong container co `overflow-hidden` neu khong dung Portal.
- Width co dinh duy nhat `w-64` tren mobile.

### 4. Gan vao cac vi tri bi rut gon tren `/grading/categories`

Can them icon xem day du tai cac vi tri sau:

1. Master list category card:
   - Gan sau ten `cat.name` trong block `h4`.
   - Neu ten qua dai, hien icon canh ten.

2. Master-detail category header:
   - Gan sau `activeCat.name`.
   - Dam bao icon khong lam header bi tran, dung wrapper `flex items-center min-w-0`.

3. Master-detail criteria row:
   - Gan sau `item.name`.
   - Button icon phai `shrink-0` de khong bi mat khi hang hep.

4. Kanban category card cot 1 va cot 2:
   - Gan sau ten danh muc trong `h3`.
   - `onClick` cua icon can `stopPropagation()` de khong toggle expand.

5. Kanban criteria card cot 1 va cot 2:
   - Gan sau ten tieu chi trong `h4`.
   - `onMouseDown/onDragStart` nen `stopPropagation()` neu card co draggable.

### 5. Can nhac dong bo voi `/grading/score`

Anh user gui khop voi `CriteriaTooltip` hien co trong `frontend/src/app/grading/score/page.tsx`.

Trong scope nay, uu tien sua `/grading/categories`. Tuy nhien nen ghi chu de tranh duplicate bug:

- Neu tao component dung chung, co the thay `CriteriaTooltip` trong `/grading/score` bang component moi.
- Neu chua sua `/grading/score`, it nhat can tranh copy lai pattern `absolute left-1/2 -translate-x-1/2 w-64` sang `/grading/categories`.

## Ngoai pham vi

- Khong thay doi API/backend.
- Khong thay doi schema category/criteria.
- Khong thay doi logic tinh diem, validate diem, drag/drop.
- Khong thay doi noi dung data hien co.
- Khong can redesign lai toan bo card danh muc/tieu chi.

## Acceptance Criteria

- Tren `/grading/categories`, ten danh muc dai co icon xem day du va bam vao se hien day du noi dung.
- Ten tieu chi dai co icon xem day du va bam vao se hien day du noi dung.
- Popup/dialog khong bi cat chu khi icon nam gan vien trai, vien phai, tren mobile hoac trong card co `overflow-hidden`.
- Noi dung trong popup wrap dung, khong tran ngang, khong mat chu dau dong.
- Click icon khong lam card category bi expand/collapse ngoai y muon.
- Click icon tren criteria card khong kich hoat drag/drop ngoai y muon.
- Click ra ngoai hoac bam lai icon dong popup.
- Keyboard/focus co the thao tac co ban: button co `aria-label`, focus ring khong bi mat.

## Kiem thu de xuat

1. Chay kiem tra frontend:

```bash
npm run lint
npm run build
```

2. Kiem tra thu cong tren `/grading/categories`:

- Tao/sua danh muc co ten rat dai, hon 100 ky tu.
- Tao/sua tieu chi co ten rat dai, hon 100 ky tu.
- Mo popup xem day du o card gan vien trai man hinh.
- Mo popup xem day du o card gan vien phai man hinh.
- Kiem tra ca Master-detail va Kanban.
- Kiem tra desktop va mobile width nho.
- Dam bao popup khong bi crop, khong tran ngang, noi dung doc duoc day du.
- Dam bao click icon khong toggle expand category va khong bat dau drag card.

3. Neu refactor dung chung voi `/grading/score`:

- Kiem tra lai popup `Noi dung day du:` tren `/grading/score` tai danh muc/tieu chi nam gan vien trai/phai.
- Dam bao tooltip cu khong con bi cat nhu anh user gui.
