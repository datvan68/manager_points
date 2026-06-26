# Taskscope2: Fix canh bao single_option cap nhat khong dung khi cham diem /grading/score

## Muc tieu

Khac phuc canh bao sai ngu canh khi thao tac them/chon diem tai trang `/grading/score`:

> Tuy chon cho tieu chi ... co the khong duoc cap nhat do quyen han.

Canh bao nay hien dang duoc frontend hien thi khi backend tra `actual_count` khong khop ky vong cua UI, nhung noi dung lai quy ve "quyen han". Can xu ly dung ban chat: neu loi do quyen thi bao quyen; neu loi do sync option/record/detail thi bao va sua theo luong `academic_record` la nguon du lieu duy nhat.

## Hien trang can sua

Tai `frontend/src/app/grading/score/page.tsx`, khi tieu chi co `scoring_mode === 'single_option'`, frontend gui intent:

- `intent_type: 'select_option'`
- `selected_option_id`

Sau do frontend kiem tra:

- Co option duoc chon thi ky vong `res.actual_count === 1`
- Neu khong khop thi hien toast warning "co the khong duoc cap nhat do quyen han"

Van de:

1. Warning nay khong chac la loi quyen han.
2. Backend validate `selected_option_id` bang `@IsMongoId()`, trong khi option cua criterion dang la `{ id: string; label: string; score: number }`, khong bat buoc la MongoDB ObjectId.
3. `academic_record` chua co field rieng de luu option da chon; backend dang dua option vao `record_title` roi parse nguoc khi rebuild `evaluation_detail`.
4. Neu `summary_point` bi khoa, khong ton tai, hoac sync detail that bai, frontend cung co the hien warning "do quyen han" du khong phai loi quyen.

## Nguyen tac sua

1. `academic_record` la nguon du lieu duy nhat.
2. Voi tieu chi `single_option`, moi lan chon option phai tao hoac cap nhat 1 `academic_record` active dai dien cho option dang chon.
3. `evaluation_detail` chi la du lieu tong hop/rebuild tu `academic_record`.
4. Khong parse `selected_option_id` tu `record_title` lam logic chinh.
5. Khong dung warning "do quyen han" cho cac loi sync/du lieu.

## Backend scope

### 1. Dieu chinh DTO intent

File: `backend/src/academic-record/dto/intent-score.dto.ts`

Sua `selected_option_id`:

- Bo `@IsMongoId()` tren `selected_option_id`.
- Dung `@IsString()` vi option id trong criterion schema la string.
- Giu validate MongoDB ObjectId cho `student_id`, `criterion_id`, `semester_id`.

Ket qua mong muon:

- Option id dang `opt1`, `option_10`, hoac string noi bo cua criterion van duoc chap nhan.
- Neu option id khong ton tai trong criterion thi backend tra loi domain ro rang, khong phai loi validate MongoDB id.

### 2. Bo sung field option vao academic_record

File: `backend/src/academic-record/schemas/academic-record.schema.ts`

Bo sung field:

- `selected_option_id?: string`
- `selected_option_label?: string`
- `selected_option_score?: number`

Ly do:

- Luu option co cau truc, khong phu thuoc `record_title`.
- Rebuild `evaluation_detail` on dinh hon.
- De truy vet lich su cham diem va debug sync de hon.

### 3. Sua `handleScoreIntent` cho `select_option`

File: `backend/src/academic-record/academic-record.service.ts`

Khi `intent_type === 'select_option'`:

1. Load criterion theo `criterion_id`.
2. Kiem tra criterion co `scoring_mode === 'single_option'`.
3. Neu `selected_option_id` co gia tri:
   - Tim option trong `criterion.options` theo `option.id === selected_option_id`.
   - Neu khong thay, tra `BadRequestException` voi message ro rang.
   - Neu da co active academic_record cho student/semester/criterion thi update record do.
   - Neu chua co thi create 1 record moi.
   - Gan `selected_option_id`, `selected_option_label`, `selected_option_score`.
   - Gan `record_title` chi de hien thi, khong dung lam source chinh.
4. Neu `selected_option_id` rong/null:
   - Hieu la bo chon option.
   - Xoa vinh vien academic_record active lien quan neu requester co quyen.
   - Sync lai `evaluation_detail` ve count 0 / option null.

### 4. Sua rebuild/sync evaluation_detail

File: `backend/src/academic-record/academic-record.service.ts`

Trong `syncStudentCriterionScore` va cac ham rebuild tu academic_record:

- Voi criterion `single_option`, lay option tu field `academic_record.selected_option_id`.
- Chi fallback parse tu `record_title` cho du lieu cu neu field moi chua co.
- `activeCount` cua `single_option` nen la `1` khi co record active hop le, `0` khi khong co record.
- `system_score` lay tu `selected_option_score` hoac tu `criterion.options`.
- `evaluation_detail.selected_option_id`, `selected_option_label`, `selected_option_score` phai khop record active moi nhat.

### 5. Phan biet loi quyen va loi sync

Backend response/error can ro rang:

- 403: khong co quyen thao tac.
- 400: option khong hop le hoac criterion khong phai single_option.
- 200 success nhung `evaluation_detail` null: can co field canh bao ky thuat, vi co the summary bi khoa/khong ton tai.

De xuat response intent bo sung:

```ts
{
  success: true,
  actual_count: number,
  evaluation_detail?: any,
  sync_status: 'synced' | 'summary_missing' | 'summary_locked',
  warning_code?: string
}
```

## Frontend scope

### 1. Sua message warning

File: `frontend/src/app/grading/score/page.tsx`

Khong hien mac dinh:

> co the khong duoc cap nhat do quyen han

Thay bang phan nhanh theo ket qua:

- Loi 403: "Ban khong co quyen cap nhat tieu chi nay."
- Loi 400 option invalid: hien message backend, vi day la loi cau hinh/du lieu option.
- `sync_status === 'summary_locked'`: "Bang diem dang bi khoa nen thay doi chua duoc dong bo vao chi tiet diem."
- `sync_status === 'summary_missing'`: "Chua tim thay bang diem tong hop de dong bo chi tiet diem."
- `actual_count` khong khop nhung request success: "Thay doi da duoc ghi nhan vao academic_record nhung chi tiet diem chua dong bo dung. Vui long tai lai hoac kiem tra sync."

### 2. Khong dung `actual_count !== 1` lam ket luan quyen han

Voi `single_option`:

- Neu backend success va co `evaluation_detail.selected_option_id` khop option vua chon thi coi la thanh cong.
- Neu bo chon option thi ky vong `actual_count === 0` va `selected_option_id` null.
- Neu backend success nhung detail khong khop, hien warning sync, khong noi ve quyen.

### 3. Cap nhat state theo backend

Sau intent `select_option` thanh cong:

- Cap nhat `selectedOptionsState` tu `res.evaluation_detail.selected_option_id` neu co.
- Cap nhat count tu `res.actual_count`.
- Neu `evaluation_detail` null nhung success, giu optimistic state tam thoi va danh dau can reload/sync.

## Permission rules can giu

1. Admin: duoc tang/giam/chon/bo chon, tru tieu chi bi khoa.
2. Teacher: khong duoc xoa diem do admin cham; duoc thao tac trong lop phu trach theo rule hien co.
3. Student: chi duoc xoa/sua diem do student cham.
4. Neu vi pham permission thi backend tra 403, frontend hien dung message quyen han.

## Migration/backfill du lieu cu

Can co script hoac logic fallback de nang cap record cu:

1. Tim academic_record co `record_title` dang "Lua chon option ...".
2. Parse option id cu.
3. Doi chieu voi `criterion.options`.
4. Gan `selected_option_id`, `selected_option_label`, `selected_option_score`.
5. Rebuild lai `evaluation_detail` tu academic_record.

Khong bat buoc xoa `record_title`; chi khong dung no lam source chinh nua.

## Acceptance criteria

1. Tai `/grading/score`, chon option cho tieu chi single_option tao/cap nhat 1 academic_record active.
2. `academic_record` luu ro `selected_option_id`, `selected_option_label`, `selected_option_score`.
3. `evaluation_detail.current_count` thanh `1` khi co option, `0` khi bo option.
4. `evaluation_detail.selected_option_id` khop option da chon.
5. Khong con hien warning "co the khong duoc cap nhat do quyen han" khi loi thuc te la sync/du lieu.
6. Neu user khong co quyen that, backend tra 403 va frontend hien message quyen han ro rang.
7. Option id dang string khong phai MongoDB ObjectId van cham duoc neu ton tai trong `criterion.options`.
8. Reload trang xong option va so lan van giu dung theo academic_record.

## Test can bo sung

Backend:

- `select_option` chap nhan selected_option_id dang string.
- `select_option` tao academic_record moi khi chua co.
- `select_option` update academic_record cu khi da co.
- `select_option` invalid option tra 400.
- Rebuild detail lay option tu academic_record field moi.
- Fallback du lieu cu tu `record_title` van hoat dong.

Frontend:

- Khi single_option success va detail khop, khong hien warning.
- Khi backend 403, hien message quyen han.
- Khi success nhung detail khong khop, hien warning sync.
- Khi option id khong phai MongoDB ObjectId, payload van gui va khong bi chan o frontend.
