# Task Scope: Cap nhat hien thi tong diem tieu chi tren /grading/categories

## Muc tieu

Cap nhat trang `/grading/categories` theo yeu cau:

1. Bo validate chan khi tong diem toi da cac tieu chi vuot qua diem toi da cua danh muc.
2. Tren UI dang co `Diem toi da` va `So tieu chi`, bo sung them item `Tong diem tieu chi`.
3. Khi `Tong diem tieu chi` vuot qua `Diem toi da` cua danh muc, text `Diem toi da: ...` chuyen sang mau do de canh bao.

## Hien trang lien quan

File frontend chinh:

- `frontend/src/app/grading/categories/page.tsx`
- `frontend/src/components/grading/CriteriaModal.tsx`

File API/backend lien quan de doi chieu:

- `frontend/src/api/criteria-api.ts`
- `backend/src/criteria/criteria.service.ts`
- `backend/src/criteria/dto/create-criterion.dto.ts`
- `backend/src/criteria/schemas/criterion.schema.ts`
- `backend/src/categories/schemas/category.schema.ts`

Du lieu hien tai:

- Category frontend map `cat.maxPoints` tu backend `category.max_score`.
- Criteria frontend map `item.maxPoints` tu backend `criterion.max_score`.
- Criteria duoc gan danh muc qua `categoryId`.

## Root Cause / Diem can dieu chinh

Hien tai trang dang chan mot so thao tac khi tong `maxPoints` cua criteria trong danh muc vuot qua `cat.maxPoints`.

### 1. Validate trong modal them/sua tieu chi

Trong `frontend/src/components/grading/CriteriaModal.tsx`, ham `handleSave` dang co doan validate tong diem:

- Tinh tong criteria cung danh muc.
- Tach nhom `ky_luat` va nhom khong phai `ky_luat`.
- Neu tong `maxPoints` cua nhom vuot `parentCat.maxPoints` thi set `newErrors.maxPoints` va khong cho save.

Can bo logic chan nay theo yeu cau moi.

Van giu cac validate co ban:

- Ten tieu chi bat buoc.
- Danh muc bat buoc.
- `minPoints <= maxPoints`.
- `points <= maxPoints`.

### 2. Validate khi keo tha tieu chi sang danh muc khac

Trong `frontend/src/app/grading/categories/page.tsx`, ham `handleDrop` dang chan drop neu tong diem criteria cua danh muc dich vuot `targetCat.maxPoints`.

Can bo logic chan nay de nguoi dung van co the chuyen tieu chi sang danh muc, ke ca khi tong diem tieu chi vuot diem toi da danh muc.

Van giu cac hanh vi sau:

- Khong lam gi neu drop vao chinh danh muc hien tai.
- Cap nhat `categoryId` va `categoryObjectId` tren state.
- Goi `criteriaApi.updateCriterion(...)` de luu danh muc moi.
- Hien toast thanh cong/that bai nhu hien tai.

## Pham vi can sua

### 1. Them helper tinh tong diem tieu chi

Tao helper dung lai trong `frontend/src/app/grading/categories/page.tsx`, vi hien tai co nhieu noi render thong tin category.

De xuat:

```ts
const getCategoryCriteriaTotalMaxPoints = (categoryId: string) =>
  criteria
    .filter((item) => item.categoryId === categoryId)
    .reduce((sum, item) => sum + Number(item.maxPoints || 0), 0);
```

Neu can toi uu re-render, co the dung `useMemo` tao map theo `categoryId`, nhung khong bat buoc neu so luong criteria nho.

Quy uoc tinh trong scope nay:

- `Tong diem tieu chi` = tong `maxPoints` cua tat ca criteria trong danh muc.
- Khong chan theo loai `khen_thuong`, `cong_diem`, `ky_luat`.
- Khong loai tru criteria `is_score_counted === false` tru khi product co yeu cau rieng sau nay.

### 2. Cap nhat card category o che do Kanban

Trong `frontend/src/app/grading/categories/page.tsx`, card category dang render o hai cot:

- Cot 1 quanh block map `categories.filter(cat => cat.columnId === 'col-1' || !cat.columnId)`.
- Cot 2 quanh block map `categories.filter(cat => cat.columnId === 'col-2')`.

Moi card hien dang co:

```tsx
Diem toi da: {cat.maxPoints}
So tieu chi: {catCriteria.length}
```

Can bo sung:

```tsx
Tong diem tieu chi: {criteriaTotalMaxPoints}
```

Dong info can wrap tot tren man hinh nho:

- Dung `flex flex-wrap gap-x-4 gap-y-1` hoac layout tuong duong.
- Khong de text bi chen, tran, hoac lam nut action bi lech.

### 3. Doi mau `Diem toi da` khi vuot tong diem

Neu:

```ts
criteriaTotalMaxPoints > Number(cat.maxPoints || 0)
```

thi item `Diem toi da` can chuyen sang mau do.

De xuat class:

```tsx
const isCriteriaTotalOverMax = criteriaTotalMaxPoints > Number(cat.maxPoints || 0);
```

Khi `isCriteriaTotalOverMax === true`:

- Label `Diem toi da:` doi sang text do, vi user yeu cau text nay chuyen mau do.
- Gia tri `{cat.maxPoints}` cung nen doi sang nen/text do de canh bao ro hon.

Vi du style:

```tsx
isCriteriaTotalOverMax
  ? 'text-red-600 bg-red-50'
  : 'text-blue-600 bg-blue-50/50'
```

Khong can chan save/drop; day chi la canh bao UI.

### 4. Cap nhat che do Master-detail

Trang co che do `master-detail`, header danh muc dang hien:

```tsx
Diem toi da: {activeCat.maxPoints}
Tong tieu chi: {activeCriteria.length}
```

Can bo sung `Tong diem tieu chi` va ap dung cung logic doi mau `Diem toi da` khi tong diem tieu chi vuot `activeCat.maxPoints`.

### 5. Cap nhat skeleton neu can

Skeleton card category hien chi co 2 placeholder info item.

Co the them placeholder thu 3 de loading state gan voi UI moi, nhung khong bat buoc neu skeleton van khong gay layout shift lon.

## Ngoai pham vi

- Khong thay doi schema MongoDB.
- Khong thay doi API contract cua `categories` hoac `criteria`.
- Khong thay doi cach tinh diem ren luyen tai `/grading/score`.
- Khong tu dong dieu chinh `max_score` cua category.
- Khong drop/modify data hien co trong database.
- Khong them validate backend moi cho tong diem criteria.

## Acceptance Criteria

- Them/sua criteria thanh cong ngay ca khi tong `maxPoints` criteria trong category vuot `cat.maxPoints`.
- Keo tha criteria sang category khac thanh cong ngay ca khi category dich bi vuot tong diem.
- Moi category card o Kanban hien du 3 item:
  - `Diem toi da`
  - `So tieu chi`
  - `Tong diem tieu chi`
- Header category o Master-detail cung hien `Tong diem tieu chi`.
- Khi `Tong diem tieu chi > Diem toi da`, item `Diem toi da` chuyen sang mau do.
- Khi `Tong diem tieu chi <= Diem toi da`, item `Diem toi da` giu style binh thuong.
- UI khong bi tran, khong che nut sua/xoa/expand tren desktop va mobile.

## Kiem thu de xuat

1. Chay lint/build frontend:

```bash
npm run lint
npm run build
```

2. Kiem tra flow tren `/grading/categories`:

- Tao danh muc co `Diem toi da = 10`.
- Them 2 criteria moi, moi criteria co `maxPoints = 10`.
- Dam bao modal khong bao loi tong diem vuot max va van save duoc.
- Dam bao card hien `Tong diem tieu chi: 20`.
- Dam bao text `Diem toi da: 10` chuyen mau do.
- Giam/xoa criteria de tong diem ve `<= 10`, dam bao `Diem toi da` tro lai mau binh thuong.
- Keo criteria tu danh muc khac vao danh muc dang vuot max, dam bao khong bi chan.
- Lap lai tren ca Kanban va Master-detail.
