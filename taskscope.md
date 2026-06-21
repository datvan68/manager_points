# Taskscope: Dam bao teacher dang nhap luon vao /students/tasks

## 1. Pipeline

- `pipeline_id`: `feature_development`
- `agent_id`: `orchestrator`
- `muc tieu`: Kiem tra va dieu chinh luong sau dang nhap de tai khoan teacher luon mo trang `/students/tasks` dau tien, ke ca khi chua co nhiem vu nao duoc tao.

## 2. Ket qua kiem tra hien tai

### 2.1. Duong login truc tiep

File: `frontend/src/app/(auth)/login/page.tsx`

- Line 56-57 hien dang xu ly:

```tsx
if (isStudentRole(result.user) || isTeacherRole(result.user)) {
  router.push('/students/tasks');
}
```

Ket luan: Neu `result.user` duoc nhan dien dung la teacher, sau khi submit login thanh cong frontend se dieu huong den `/students/tasks`.

### 2.2. Duong da authenticated nhung dang o public route

File: `frontend/src/providers/auth-provider.tsx`

- `AuthProvider` cung co logic redirect user dang authenticated o public route ve `/students/tasks` neu la student hoac teacher.

Ket luan: Teacher da dang nhap ma mo lai `/login` cung se bi day ve `/students/tasks`.

### 2.3. Trang `/students/tasks` khi chua co task

File: `frontend/src/components/students/tasks/StudentTasksTab.tsx`

- Line 700 render danh sach khi `tasks.length > 0`.
- Line 871 render empty state: `Khong tim thay nhiem vu nao.`

Ket luan: So luong task bang 0 khong lam redirect di trang khac. Trang van o `/students/tasks` va hien empty state.

## 3. Rui ro can dieu chinh

File: `frontend/src/app/students/tasks/page.tsx`

- Line 107 chi bypass `RouteGuard` cho student:

```tsx
const bypassGuard = isStudent;
```

- Line 120-122 boc teacher/admin/supervisor bang:

```tsx
<RouteGuard anyPermission={["STUDENT_PAGE", "READ_STUDENT_TASK"]}>
  <StudentTasksPageContent />
</RouteGuard>
```

File: `frontend/src/components/guards/RouteGuard.tsx`

- Line 206 check `anyPermission`.
- Line 233 redirect ve `fallbackPath || '/'` neu khong co quyen.

Ket luan: Ve logic login, teacher da duoc day sang `/students/tasks`. Tuy nhien teacher co the khong o lai duoc trang nay neu tai khoan teacher thieu ca 2 quyen `STUDENT_PAGE` va `READ_STUDENT_TASK`, vi `RouteGuard` se redirect ve `/`.

## 4. Pham vi dieu chinh de dam bao yeu cau

### 4.1. Frontend route entry

File can sua: `frontend/src/app/students/tasks/page.tsx`

Muc tieu:

- Cho teacher bypass guard giong student, hoac cap fallback/permission logic rieng de teacher luon duoc vao `/students/tasks`.
- De xuat ngan gon:

```tsx
const isTeacher = isTeacherRole(user);
const bypassGuard = isStudent || isTeacher;
```

Can import/reuse `isTeacherRole` tu `@/utils/role.util` thay vi tu check chuoi thu cong.

### 4.2. Login redirect

File can kiem tra: `frontend/src/app/(auth)/login/page.tsx`

Muc tieu:

- Giu nguyen logic hien co:

```tsx
if (isStudentRole(result.user) || isTeacherRole(result.user)) {
  router.push('/students/tasks');
}
```

- Khong phu thuoc vao API danh sach task.

### 4.3. AuthProvider redirect

File can kiem tra: `frontend/src/providers/auth-provider.tsx`

Muc tieu:

- Giu dong bo voi login page: teacher/student o public route luon ve `/students/tasks`.
- Khong them API check task count vao auth flow.

## 5. Acceptance Criteria

- Teacher login thanh cong luon vao `/students/tasks` dau tien.
- Khi database chua co task nao, teacher van o `/students/tasks` va thay empty state, khong bi redirect ve `/`.
- Student van vao `/students/tasks` nhu hien tai.
- Admin/supervisor khong bi thay doi luong login hien tai neu khong nam trong yeu cau.
- Khong them fetch task count vao login/auth provider.
- Khong dung workaround kieu delay/timer redirect.

## 6. Test Plan

1. Login bang tai khoan teacher co day du permission: ky vong vao `/students/tasks`.
2. Login bang tai khoan teacher thieu `STUDENT_PAGE` va `READ_STUDENT_TASK`: ky vong van o `/students/tasks` sau dieu chinh.
3. Xoa/khong tao task nao, reload `/students/tasks`: ky vong hien empty state `Khong tim thay nhiem vu nao.`
4. Login bang student: ky vong van vao `/students/tasks`.
5. Chay build/typecheck frontend:

```bash
cd frontend
npm run build
```
