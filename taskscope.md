# Taskscope: Sua loi build TypeScript trong /grading/score khi them select lop

## Pipeline

- `pipeline_id`: `bug_fix`
- `agent_id`: `orchestrator`
- Pham vi: frontend Next.js, trang `frontend/src/app/grading/score/page.tsx`

## Muc tieu

Sua loi build:

```text
./src/app/grading/score/page.tsx:2797:26
Type error: This comparison appears to be unintentional because the types '"teacher" | "admin" | "supervisor"' and '"student"' have no overlap.
```

Sau khi sua, `next build`/TypeScript type check phai pass va select chon lop trong slider van hien cho teacher/admin/supervisor.

## Hien trang

File lien quan:

- `frontend/src/app/grading/score/page.tsx`

Context code:

- `getRoleKey(currentUser?.role)` tra ve union:
  - `"admin"`
  - `"supervisor"`
  - `"teacher"`
  - `"student"`
- `shouldShowStudentSlider` dang duoc khai bao:

```ts
const shouldShowStudentSlider = currentUserRole !== "student";
```

- JSX slider dang render theo guard:

```tsx
{shouldShowStudentSlider && (
  ...
  {currentUserRole !== "student" && (
    <Select ... />
  )}
)}
```

## Root cause

Trong block:

```tsx
{shouldShowStudentSlider && (...)}
```

TypeScript suy luan `shouldShowStudentSlider === true` dong nghia `currentUserRole !== "student"`.

Vi vay ben trong block nay, type cua `currentUserRole` da bi narrow thanh:

```ts
"teacher" | "admin" | "supervisor"
```

Khi code tiep tuc so sanh:

```tsx
currentUserRole !== "student"
```

TypeScript bao loi vi union hien tai khong con gia tri `"student"` nua. Day la check bi trung lap, khong phai loi nghiep vu.

## Scope sua de xuat

### 1. Sua JSX tai header slider

Trong `frontend/src/app/grading/score/page.tsx`, tai khu vuc `STUDENT HERO SLIDER`, bo guard trung lap:

```tsx
{currentUserRole !== "student" && (
  <div className="relative w-full md:w-[220px]">
    <Select ... />
  </div>
)}
```

Thanh render truc tiep select trong block da duoc guard boi `shouldShowStudentSlider`:

```tsx
<div className="relative w-full md:w-[220px]">
  <Select ... />
</div>
```

Ly do: ca slider chi render khi user khong phai student, nen select lop van chi hien cho teacher/admin/supervisor.

### 2. Khong doi logic role neu khong can

Khong nen sua bang cach ep type/cast nhu:

```ts
(currentUserRole as string) !== "student"
```

hoac mo rong type gia tao. Cach nay chi che loi type, khong giai quyet check thua.

### 3. Kiem tra cac guard tuong tu

Can review them cac vi tri trong cung file co pattern:

```tsx
{shouldShowStudentSlider && (... currentUserRole !== "student" ...)}
```

hoac cac block da narrow role nhung van so sanh lai voi role da bi loai tru.

Vi tri can chu y theo search hien tai:

- `frontend/src/app/grading/score/page.tsx:2797`
- `frontend/src/app/grading/score/page.tsx:3353` neu nam trong block da narrow tuong tu

Chi sua nhung cho gay type error hoac thuc su trung guard, tranh refactor lan sang logic khac.

## Acceptance Criteria

- Build/type check khong con loi tai `page.tsx:2797`.
- Select chon lop van hien trong slider cho:
  - teacher
  - admin
  - supervisor
- Student khong thay slider/select lop nhu logic hien tai.
- Khong thay doi API call, state load roster, sessionStorage `grading_appliedClass`, hay behavior chon lop.
- Khong them cast `as any`/`as string` chi de ne TypeScript.

## Test Plan

1. Chay type check/build frontend:

```bash
cd frontend
npm run build
```

2. Test UI thu cong:

- Dang nhap teacher/admin/supervisor.
- Vao `/grading/score`.
- Xac nhan slider sinh vien hien thi.
- Xac nhan select lop hien thi, chon lop load dung roster.
- Dang nhap student.
- Xac nhan slider/select lop khong hien thi theo behavior hien tai.

## Rui ro

- Neu con guard role trung lap o vi tri khac, build co the tiep tuc fail o line tiep theo sau khi sua line 2797.
- Neu `shouldShowStudentSlider` sau nay duoc doi thanh dieu kien khac khong lien quan role, select lop can co boolean rieng nhu `canUseClassSelector`.

## Ghi chu implement

Huong sua goi y tot hon neu muon ro nghia ve sau:

```ts
const canUseClassSelector = shouldShowStudentSlider;
```

Sau do JSX dung:

```tsx
{canUseClassSelector && <ClassSelect />}
```

Tuy nhien voi scope fix build hien tai, cach gon nhat la bo check `currentUserRole !== "student"` ben trong block slider da duoc guard.