# Taskscope: Fix /grading/score tao academic_record va rang buoc evaluation_detail

## Muc tieu

Khac phuc hien trang tai trang `/grading/score`: khi admin/teacher/student bam tang so lan cua tieu chi, UI co the hien thi tang tam thoi nhung backend khong tao `academic_record`, dan den `evaluation_detail.current_count` khong duoc sync va so lan khong on dinh sau khi tai lai/lay lai du lieu.

Sau khi fix, moi thao tac cham diem tren `/grading/score` phai di qua `academic_record` truoc. `evaluation_detail` chi la du lieu tong hop/cache duoc rebuild tu `academic_record`.

## Ket luan review hien trang

Tai frontend `frontend/src/app/grading/score/page.tsx`:

- `handleCountChange(criteriaId, delta)` hien chi cap nhat local state `evaluationCounts` va tinh diem realtime.
- `handleCountSet(criteriaId, value)` cung chi cap nhat local state.
- Viec goi backend tao/xoa record hien nam trong `persistStudentScore`, thong qua `academicRecordApi.sendIntent(...)`.
- Neu user bam `+` nhung flow save/persist khong duoc goi, hoac logic so sanh voi `evaluation_detail` cu khong nhan ra thay doi, `academic_record` se khong duoc tao.
- Khi fetch lai, count duoc lay tu `evaluation_detail`/record da sync; neu khong co `academic_record`, count quay ve gia tri cu.

Tai backend:

- `backend/src/academic-record/academic-record.service.ts` da co `handleScoreIntent`.
- Intent `increase`, `decrease`, `set_target_count` co kha nang tao/xoa `academic_record`.
- Sau khi xu ly intent, service goi `syncStudentCriterionScore(student_id, semester_id, criterion_id)` de rebuild `evaluation_detail`.
- Nghia la backend da co huong dung, nhung `/grading/score` can dung no lam duong ghi chinh cho count.

Van de cot loi: UI dang cho phep thay doi count o local state truoc, nhung viec tao `academic_record` chua duoc rang buoc bat buoc ngay tai thao tac tang/giam hoac tai luong persist duy nhat.

## Nguyen tac bat buoc

### 1. academic_record la source of truth

Moi diem/su kien cham diem co hieu luc phai co `academic_record` active.

Khong duoc xem `evaluation_detail.current_count` la nguon goc de quyet dinh diem. Truong nay chi duoc tinh lai tu danh sach `academic_record` active theo bo khoa:

```text
student_id + semester_id + criterion_id
```

### 2. evaluation_detail la aggregate/cache

`evaluation_detail` chi ton tai de hien thi nhanh diem tong hop tren bang diem.

Invariant can dam bao:

```text
Co academic_record active => phai sync ra evaluation_detail tuong ung.
Co evaluation_detail co diem/current_count/option => phai truy ve duoc academic_record active tuong ung.
Khong co academic_record active => evaluation_detail khong duoc giu diem ao.
```

Quan he dung khong phai 1-1, ma la:

```text
academic_record 1..n -> evaluation_detail 1
```

Vi du count criterion:

```text
3 academic_record active
=> 1 evaluation_detail.current_count = 3
```

### 3. Tat ca thao tac ghi diem phai di qua academic_record

Ap dung cho:

- Bam `+` tang so lan.
- Bam `-` giam so lan.
- Keo/chon picker de set so lan truc tiep.
- Chon option cua tieu chi `single_option`.
- Nhap diem tay neu co.
- Diem khoa/he thong/import neu duoc ghi nhan thanh diem co hieu luc.

Khong con luong ghi truc tiep vao `evaluation_detail` de tao diem.

## Rang buoc evaluation_detail mo coi

### Dinh nghia du lieu mo coi

`evaluation_detail` duoc xem la mo coi/khong hop le neu no co gia tri diem nhung khong co `academic_record` active tuong ung theo bo khoa:

```text
summary.student_id + summary.semester_id + evaluation_detail.criterion_id
```

Cac truong hop can coi la co gia tri diem:

- `current_count > 0`
- `system_score` khac gia tri mac dinh/0 theo tieu chi
- `selected_option_id != null`
- `selected_option_score != null`
- `sv_score`, `gv_score`, `final_score` co gia tri do cham diem tao ra

### Rule bat buoc

Khong cho phep `evaluation_detail` ton tai nhu mot nguon diem doc lap.

Khi backend phat hien:

```text
evaluation_detail co diem/current_count/option
nhung khong co academic_record active tuong ung
```

thi phai xu ly theo mot trong hai cach ro rang:

1. Neu day la du lieu cu hop le can giu diem: chay migration/repair de tao bu `academic_record` tuong ung.
2. Neu day la diem ao/sai: rebuild `evaluation_detail` theo `academic_record`, tuc la xoa detail hoac reset ve 0/null.

Mac dinh trong runtime sau khi fix:

```text
academic_record thang khi co lech du lieu.
evaluation_detail phai bi rebuild theo academic_record.
```

### Rang buoc theo tung loai tieu chi

Count criterion:

```text
evaluation_detail.current_count phai bang so academic_record active.
current_count = 3 => phai co dung 3 academic_record active.
current_count = 0 => khong duoc con diem ao trong detail.
```

Single option criterion:

```text
selected_option_id != null => phai co academic_record active dai dien option dang chon.
Khong co academic_record active => selected_option_id/label/score phai ve null va count ve 0, hoac xoa detail.
```

Manual score criterion neu co:

```text
manual/system score co hieu luc => phai co academic_record active dai dien lan cham diem do.
Khong co academic_record active => manual score khong duoc tiep tuc tinh vao tong diem.
```

### Noi enforce

Rang buoc nay phai enforce o backend service, khong chi enforce tren frontend.

Cac entrypoint can tuan thu:

- `POST /academic-records/intent`
- sync/rebuild tu `academic_record` sang `evaluation_detail`
- API lay evaluation detail cho `/grading/score`
- job repair/migration neu co
- cac flow import/daily report/manual score co tao diem

Frontend chi hien thi ket qua backend da sync; frontend khong duoc tu tao diem ao bang cach day `evaluation_detail` len truoc.

## Scope fix chinh

### 1. Sua flow tang so lan tai /grading/score

Khi user bam nut `+` tren tieu chi count:

1. Frontend goi API:

```ts
academicRecordApi.sendIntent({
  student_id: activeStudentId,
  semester_id: selectedSemesterId,
  criterion_id: criteriaId,
  intent_type: "increase",
  note: reason,
})
```

2. Backend tao them 1 `academic_record` active.
3. Backend rebuild `evaluation_detail` bang `syncStudentCriterionScore(...)`.
4. Backend tra ve:

```ts
{
  success: true,
  actual_count: number,
  evaluation_detail: EvaluationDetail | null
}
```

5. Frontend cap nhat `evaluationCounts[studentId][criterionId]` bang `actual_count` tu response, khong lay gia tri optimistic lam gia tri cuoi.
6. Frontend cap nhat `evaluationDetailsMap` bang `evaluation_detail` moi neu backend tra ve.
7. Frontend tinh lai tong diem tu count/option moi.

Ket qua bat buoc:

```text
Bam 00 -> 01
=> tao 1 academic_record
=> evaluation_detail.current_count = 1
=> UI hien 01 on dinh sau khi refresh/fetch lai
```

### 2. Sua flow giam so lan

Khi user bam nut `-`:

1. Frontend goi API:

```ts
academicRecordApi.sendIntent({
  student_id: activeStudentId,
  semester_id: selectedSemesterId,
  criterion_id: criteriaId,
  intent_type: "decrease",
  note: reason,
})
```

2. Backend xoa vinh vien 1 `academic_record` duoc phep xoa.
3. Backend rebuild `evaluation_detail`.
4. Frontend dung `actual_count` tu response de cap nhat UI.

Neu backend khong the xoa record do rule phan quyen, frontend phai hien warning va rollback ve `actual_count`.

### 3. Sua flow set count truc tiep

Khi user dung picker/slider de doi `00 -> 03` hoac `03 -> 01`, frontend khong duoc chi sua local state.

Frontend goi:

```ts
academicRecordApi.sendIntent({
  student_id: activeStudentId,
  semester_id: selectedSemesterId,
  criterion_id: criteriaId,
  intent_type: "set_target_count",
  target_count: value,
  note: reason,
})
```

Backend tinh diff:

```text
target_count > current academic_record count => tao them record
target_count < current academic_record count => xoa record duoc phep xoa
target_count = current academic_record count => khong doi
```

Frontend chi chap nhan count cuoi cung la `actual_count` tu backend.

### 4. Khong dung evaluation-detail bulkUpsert lam duong ghi count

Tren `/grading/score`, bo/chan luong dung:

```ts
evaluationDetailApi.bulkUpsertEvaluationDetails(...)
```

de ghi `current_count` nhu nguon chinh.

Neu van can `bulkUpsert` cho metadata/trang thai, endpoint do khong duoc tu tao diem ao. Count/option/manual score phai duoc tao qua `academic-records/intent`.

## Thay doi frontend can lam

### File

```text
frontend/src/app/grading/score/page.tsx
frontend/src/api/academic-record-api.ts
frontend/src/app/grading/score/_utils/score-calculation.ts
```

### Viec can sua

1. Tach handler async cho count intent:

```ts
async function applyCountIntent(criteriaId: string, intent: "increase" | "decrease" | "set_target_count", targetCount?: number)
```

2. `handleCountChange(criteriaId, +1)` phai goi `applyCountIntent(..., "increase")`.
3. `handleCountChange(criteriaId, -1)` phai goi `applyCountIntent(..., "decrease")`.
4. `handleCountSet(criteriaId, value)` phai goi `applyCountIntent(..., "set_target_count", value)`.
5. Trong luc request dang chay, khoa control cua dung `studentId + criterionId` de tranh double click tao record lap.
6. Sau response, update state bang `actual_count`.
7. Neu request fail, rollback ve count truoc do va hien toast loi.
8. Sau moi intent thanh cong, refresh hoac patch lai:

```text
evaluationCounts
evaluationDetailsMap
students[].score
dirty/saving state
```

9. Khong dua vao `preExistingCountsState`, `original_count`, `non_deletable_count` de clamp UI nua.
10. Nut `+` khong bi disable sai khi count dang bang `sliderMax`; neu can tang tiep thi `sliderMax` phai mo rong theo `count + 1` hoac theo max hop le cua tieu chi.

## Thay doi backend can lam

### File

```text
backend/src/academic-record/academic-record.service.ts
backend/src/academic-record/academic-record.controller.ts
backend/src/academic-record/dto/intent-score.dto.ts
backend/src/evaluation-detail/evaluation-detail.service.ts
backend/src/summaries-point/summaries-point.service.ts
```

### Viec can kiem tra/sua

1. `handleScoreIntent` phai la duong ghi chinh cho count.
2. Intent `increase` bat buoc tao dung 1 `academic_record` active.
3. Intent `set_target_count` bat buoc tao/xoa record theo diff giua `target_count` va so record active hien tai.
4. Sau moi mutation, goi `syncStudentCriterionScore(student_id, semester_id, criterion_id)`.
5. `syncStudentCriterionScore` phai:

```text
- dem academic_record active
- tinh system_score theo criterion
- tao evaluation_detail neu count > 0 va detail chua ton tai
- update evaluation_detail neu detail da ton tai
- xoa evaluation_detail hoac dua ve 0 neu khong con record active theo rule san pham da chon
- phat hien va repair/reset evaluation_detail mo coi
- recompute total score cua summary
```

6. `evaluation-detail.service.bulkUpsert` khong duoc ghi de `current_count` truc tiep nhu source of truth.
7. Can co transaction hoac co che atomic hop ly cho:

```text
create/delete academic_record
sync evaluation_detail
recompute total score
```

Neu chua dung Mongo transaction, can dam bao co retry/rebuild idempotent de tranh record tao roi nhung detail chua sync.

## Repair/migration du lieu cu

Can co script/job rieng de quet du lieu hien co va phat hien lech giua `evaluation_detail` va `academic_record`.

### Bao cao can co

Script can thong ke:

```text
- summary_id
- student_id
- semester_id
- criterion_id
- evaluation_detail.current_count
- active academic_record count
- selected_option_id neu co
- system_score/sv_score/gv_score/final_score neu co
- loai lech: missing_records, extra_records, count_mismatch, orphan_detail
```

### Huong repair

Khong nen tu dong quyet dinh tat ca truong hop neu chua co xac nhan nghiep vu.

De xuat 2 mode:

```text
--mode=report
Chi bao cao lech, khong sua DB.

--mode=repair-from-records
Lay academic_record lam dung, rebuild/xoa/reset evaluation_detail.

--mode=backfill-records
Tao bu academic_record tu evaluation_detail cu neu nghiep vu xac nhan diem cu la hop le.
```

Mode mac dinh cho runtime sau khi fix la `repair-from-records` vi `academic_record` la source of truth.

## Rule phan quyen

### Admin

- Duoc tang/giam count khong dieu kien, tru cac tieu chi bi khoa tuyet doi theo rule san pham.
- Khi giam count, admin duoc xoa record cua bat ky nguoi tao nao neu record thuoc diem chinh sua tren `/grading/score`.

### Teacher

- Duoc tang count cho sinh vien thuoc lop/pham vi phu trach.
- Khong duoc xoa diem/record do admin tao.
- Khi giam count, chi xoa record teacher duoc phep xoa theo rule backend.

### Student

- Chi duoc thao tac diem cua chinh minh trong giai doan cho phep.
- Chi duoc xoa record do student do tao.
- Khong duoc xoa record cua teacher/admin/system.

### Locked criteria

- Neu tieu chi `is_locked` la khoa tuyet doi tren UI, khong cho user thao tac tang/giam.
- Neu diem locked van can hien thi, no cung phai den tu `academic_record` active va duoc sync sang `evaluation_detail`.

## API contract can chot

Endpoint:

```http
POST /academic-records/intent
```

Request:

```ts
type IntentScoreDto = {
  student_id: string;
  semester_id: string;
  criterion_id: string;
  intent_type:
    | "increase"
    | "decrease"
    | "set_target_count"
    | "select_option"
    | "set_manual_score"
    | "clear_score";
  target_count?: number;
  selected_option_id?: string | null;
  manual_score?: number;
  note?: string;
  idempotency_key?: string;
}
```

Response:

```ts
type IntentScoreResponse = {
  success: true;
  actual_count: number;
  evaluation_detail: EvaluationDetail | null;
  summary_total_score?: number;
  changed_record_ids?: string[];
  warnings?: string[];
}
```

`actual_count` la gia tri duy nhat frontend duoc tin de hien thi sau mutation.

## Idempotency va double click

Can tranh viec user bam `+` nhieu lan do request cham:

- Frontend khoa control theo key `studentId:criterionId` khi request dang pending.
- Backend nen ho tro `idempotency_key` cho tung thao tac.
- Neu retry cung `idempotency_key`, backend khong tao record trung.

De xuat key:

```text
grading-score:{studentId}:{semesterId}:{criterionId}:{intent}:{timestamp-or-client-action-id}
```

## Acceptance criteria

1. Tai `/grading/score`, tieu chi dang hien `00`, bam `+` mot lan:

```text
academic_record active tang tu 0 len 1
evaluation_detail.current_count = 1
UI hien 01
refresh trang van hien 01
```

2. Bam `+` tu `01 -> 02`:

```text
academic_record active tang tu 1 len 2
evaluation_detail.current_count = 2
UI hien 02
```

3. Bam `-` tu `02 -> 01`:

```text
1 academic_record duoc phep xoa bi xoa vinh vien
evaluation_detail.current_count = 1
UI hien 01
```

4. Teacher giam count nhung record gan nhat do admin tao:

```text
backend khong xoa record admin
response actual_count giu nguyen
UI rollback ve actual_count
toast canh bao ro ly do
```

5. Student giam count cua record do student tao:

```text
record bi xoa
evaluation_detail sync lai
UI cap nhat dung
```

6. Student giam count cua record do teacher/admin tao:

```text
record khong bi xoa
actual_count khong giam
UI rollback
```

7. Khong con truong hop UI hien `01` tam thoi roi quay ve `00` sau fetch lai neu API tao record thanh cong.

8. Khong con `evaluation_detail` co count/diem ma khong co `academic_record` active tuong ung.

9. Neu database co san `evaluation_detail.current_count = 3` nhung active `academic_record count = 0`, job report phai danh dau la `orphan_detail`.

10. Sau repair theo `repair-from-records`, detail mo coi phai bi xoa/reset va tong diem summary phai recompute lai.

11. Sau backfill theo `backfill-records`, so `academic_record` active phai khop voi gia tri hop le tu `evaluation_detail` cu.

## Test cases can bo sung

### Backend unit/integration

- `handleScoreIntent increase` tao 1 `academic_record` khi current count = 0.
- `handleScoreIntent increase` tao them record khi current count > 0.
- `handleScoreIntent set_target_count` tao dung so record theo diff.
- `handleScoreIntent decrease` hard-delete 1 record duoc phep xoa.
- Teacher khong xoa duoc record admin.
- Student chi xoa duoc record cua chinh student.
- Sau moi intent, `evaluation_detail.current_count` bang so `academic_record` active.
- Khi khong con record active, `evaluation_detail` khong con diem ao.
- Phat hien `evaluation_detail` co diem nhung khong co `academic_record` active.
- `repair-from-records` reset/xoa detail mo coi va recompute total score.
- `backfill-records` tao bu record tu detail cu khi duoc chon mode nay.

### Frontend

- Click `+` goi `academicRecordApi.sendIntent` voi `intent_type = "increase"`.
- Click `-` goi `intent_type = "decrease"`.
- Picker set value goi `intent_type = "set_target_count"`.
- UI cap nhat count bang `actual_count` tu response.
- Request fail thi rollback count cu.
- Trong luc request pending, control bi khoa de tranh double submit.
- UI khong tu hien diem tu `evaluation_detail` mo coi neu backend da tra ve count/detail sau rebuild.

## Ngoai pham vi

- Khong doi cong thuc tinh diem neu cong thuc hien tai dung.
- Khong doi UI tong the cua `/grading/score`, chi sua flow ghi du lieu.
- Khong tu dong backfill record tu du lieu cu neu chua co xac nhan nghiep vu.
- Khong xoa audit/log lich su ngoai cac `academic_record` duoc xoa theo intent va rule quyen.
