# Task Scope: Chinh layout toolbar nhat ky dang nhap trang /system

## 1. Muc tieu

Dieu chinh layout khu vuc toolbar trong tab "Nhat ky hoat dong dang nhap" cua page `/system` de cac control nam tren 1 hang ngang theo dung thu tu:

1. Thanh search
2. Filter "Tat ca hoat dong"
3. Filter ngay
4. Nut realtime

Layout mong muon tren desktop/laptop: tieu de va trang thai realtime indicator nam ben trai, cum filter nam ben phai va khong bi roi thanh nhieu dong nhu anh hien tai.

## 2. Hien trang da kiem tra

File chinh:

- `frontend/src/app/system/page.tsx`

Doan toolbar hien tai dang nam trong container:

```tsx
<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
  ...
  <div className="flex flex-wrap items-center gap-3">
    <form>...</form>
    <Popover>...</Popover>
    {logsSelectedDate && <button>Xoa ngay</button>}
    <Select>...</Select>
    <button>Realtime</button>
  </div>
</div>
```

Van de:

- Container toolbar dang `flex-wrap`, nen cac item co the tu dong xuong dong khi tong width lon hon vung hien thi.
- Thu tu hien tai trong code dang la search -> calendar -> clear date -> select -> realtime, chua dung yeu cau moi.
- Nut "Xoa ngay" neu render nhu mot control rieng co the lam toolbar dai va day item xuong dong.
- Search width `w-48`, select width `w-[220px]`, calendar va realtime button co width tu noi dung. Can tinh lai width de vua 1 hang o viewport desktop trong card hien tai.

## 3. Pham vi can thuc hien

### 3.1. Sap xep lai thu tu control

Trong toolbar cua bang "Nhat ky hoat dong dang nhap", sap xep lai JSX theo thu tu:

```tsx
<form>Search</form>
<Select>Filter hoat dong</Select>
<Popover>Filter ngay</Popover>
<button>Realtime</button>
```

Ket qua hien thi:

```text
[Search IP/User] [Tat ca hoat dong] [Tat ca ngay / dd/MM/yyyy] [Tat Realtime]
```

### 3.2. Bo layout wrap tren desktop

De cum control luon nam 1 hang tren man hinh lon, doi toolbar container thanh dang khong wrap o breakpoint desktop:

```tsx
<div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:flex-nowrap xl:justify-end">
  ...
</div>
```

Desktop dung `xl:flex-nowrap`; tablet/mobile van duoc phep wrap de khong tran layout.

### 3.3. Chinh container cha

Container cha nen giu title ben trai va filter ben phai:

```tsx
<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
  <div className="flex items-center gap-2 shrink-0">
    ...
  </div>

  <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:flex-nowrap xl:justify-end">
    ...
  </div>
</div>
```

Neu card khong du rong o `xl`, co the dung breakpoint `2xl:flex-nowrap`, nhung uu tien `xl` vi anh chup dang o desktop rong.

### 3.4. Chuan hoa width tung control

De 4 control vua 1 hang va can thang hang:

- Search: `w-full sm:w-60 xl:w-60`
- Select hoat dong: `w-full sm:w-[220px] xl:w-[220px]`
- Calendar: `w-full sm:w-auto`, button co `min-w-[128px]`
- Realtime: `shrink-0`, chieu cao `h-9`

Vi du:

```tsx
<form className="relative flex w-full items-center sm:w-60 xl:w-60">
  <input className="h-9 w-full ..." />
</form>

<SelectTrigger className="h-9 w-full sm:w-[220px] xl:w-[220px] ...">
  <SelectValue placeholder="Tat ca hoat dong" />
</SelectTrigger>

<button
  type="button"
  className="h-9 w-full min-w-[128px] px-3 sm:w-auto ..."
>
  ...
</button>

<button
  type="button"
  className="h-9 shrink-0 whitespace-nowrap ..."
>
  ...
</button>
```

### 3.5. Xu ly nut xoa ngay

Khong nen de nut "Xoa ngay" la mot item doc lap trong toolbar desktop neu muc tieu la 1 hang gon.

Phuong an khuyen nghi:

- Tich hop clear date vao calendar button bang icon `X` nho ben trong nut ngay.
- Click `X` thi `stopPropagation()` va clear `logsSelectedDate`.
- Calendar button van la 1 control duy nhat trong toolbar.

Vi du:

```tsx
<button type="button" className="...">
  <Calendar size={14} />
  <span>{logsSelectedDate ? format(logsSelectedDate, "dd/MM/yyyy") : "Tat ca ngay"}</span>
  {logsSelectedDate && (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        setLogsSelectedDate(null);
        setLogsPage(1);
      }}
      className="..."
    >
      <X size={12} />
    </span>
  )}
</button>
```

Phuong an toi thieu:

- Bo nut "Xoa ngay" khoi toolbar neu nghiep vu cho phep.
- Reset ngay bang mot option "Tat ca ngay" trong calendar/popover neu component co san ho tro.

### 3.6. Khong thay doi logic fetch/polling

Task nay chi chinh layout. Khong thay doi:

- API `getLoginLogs`
- API `getLoginLogsSummary`
- Logic `logsSelectedDate`
- Logic `logsFilterAction`
- Logic realtime polling
- Permission `LOGIN_LOG_READ`

Chi chinh JSX/className va thu tu render trong toolbar.

## 4. Luu y UX/UI

- Cac control phai can giua theo chieu doc, cung chieu cao `h-9`.
- Toolbar khong bi tach thanh 3 dong tren desktop nhu anh hien tai.
- Text trong button realtime khong bi xuong dong.
- Select dropdown va calendar popover khong bi che/cat boi card.
- Mobile/tablet duoc phep wrap, nhung moi control phai full-width hoac co width hop ly, khong tran ra ngoai card.
- Khong them text huong dan dai trong UI.

## 5. Test cases bat buoc

### 5.1. Desktop layout

- Mo `/system`.
- Vao tab/khu vuc "Nhat ky hoat dong dang nhap".
- Kiem tra cum toolbar hien thi 1 hang theo thu tu:
  `Search -> Tat ca hoat dong -> Tat ca ngay -> Tat Realtime`.
- Khong co control nao bi roi xuong dong khi viewport desktop du rong.

### 5.2. Responsive

- Kiem tra viewport tablet/mobile.
- Toolbar duoc phep xuong dong nhung khong tran card.
- Search/select/calendar khong bi cat text kho hieu.

### 5.3. Tuong tac filter

- Search van submit duoc va reset page dung nhu hien tai.
- Select "Tat ca hoat dong" va cac action con van fetch dung.
- Calendar van mo popover va chon ngay duoc.
- Clear ngay, neu con giu chuc nang nay, khong lam mo calendar ngoai y muon.
- Nut realtime van bat/tat dung trang thai polling.

## 6. Tieu chi nghiem thu

- Toolbar login logs tai `/system` nam 1 hang ngang tren desktop.
- Thu tu control dung: search -> filter hoat dong -> filter ngay -> realtime.
- Khong con tinh trang filter ngay/select/realtime bi xep doc thanh nhieu hang trong viewport desktop.
- Khong thay doi nghiep vu filter/log summary/realtime.
- Khong phat sinh loi TypeScript hoac hydration.

## 7. Ngoai pham vi

- Khong thiet ke lai toan bo page `/system`.
- Khong doi component `Select`, `Popover`, `CustomCalendar` dung chung.
- Khong sua backend.
- Khong sua logic thong ke KPI.
- Khong sua cac tab khac trong `/system`.

## 8. Pipeline de xuat

`feature_development`

1. `code-agent/search`: Doc toolbar hien tai trong `frontend/src/app/system/page.tsx`.
2. `code-agent/code_gen`: Sap xep lai JSX va className cua toolbar login logs.
3. `test-agent`: Kiem tra layout desktop/mobile va tuong tac filter co san.
4. `review-agent`: Review regression ve responsive, overflow, popover z-index va polling.
