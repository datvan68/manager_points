# Taskscope: Sua thung rac he thong /students/record va chan tinh diem voi ghi nhan is_deleted

## Muc tieu
- Sua tinh nang "Thung rac he thong" tren trang `/students/record` de xoa vinh vien khong con bao loi 500/Internal Server Error tren production.
- Dam bao khi API bao thanh cong thi du lieu da duoc xoa that; khi API bao loi thi khong tao trang thai "da xoa trong DB nhung UI bao that bai".
- Xac nhan va sua luong tinh diem `/grading`: moi ghi nhan ren luyen co `is_deleted: true` hoac `status: inactive` khong duoc tinh vao tieu chi, pre-count, current-count, system-score, history va dong bo tong diem.

## Hien trang da kiem tra
- Frontend `/students/record` dang goi:
  - `academicRecordApi.getDeletedAcademicRecords()` -> `GET /academic-records/deleted/all`.
  - `academicRecordApi.forceDeleteAcademicRecord(id, true)` -> `DELETE /academic-records/:id/force?bypassDailyReportCheck=true`.
  - `dailyClassReportApi.forceDeleteDailyClassReport(id)` -> `DELETE /daily-class-reports/:id/force`.
- Backend `AcademicRecordService.forceRemove()` dang:
  - tim record bang `findById(id)`.
  - `findByIdAndDelete(id)` xoa vinh vien truoc.
  - sau do moi goi `await this.safeSync(deleted)` de dong bo diem.
- Trieu chung production "bao interval/internal server error, nhung thoat vao lai thi mat het ban ghi trong thung rac" rat phu hop voi kha nang: MongoDB da xoa thanh cong, nhung `safeSync()` hoac recompute/event sau xoa bi loi nen response tra 500.
- `AcademicRecordService.syncStudentCriterionScore()` va `syncMultipleStudentCriterionScores()` da dung filter dung: `status: 'active'` va `is_deleted: { $ne: true }`.
- Tuy nhien `EvaluationDetailService` con cac diem co nguy co tinh nham record da xoa mem:
  - `syncAcademicRecords()` query record voi `status: 'active'` nhung chua co `is_deleted: { $ne: true }`.
  - `getPreExistingRecordCount()` query `status: 'active'` nhung chua co `is_deleted: { $ne: true }`.
  - `getPreExistingCountsForSummary()` query `status: 'active'` nhung chua co `is_deleted: { $ne: true }`.
  - `getPreExistingCountsBulk()` aggregation `$match` co `status: 'active'` nhung chua co `is_deleted: { $ne: true }`.
- Ket luan tam thoi cho cau hoi `/grading`: luong sync diem tu `AcademicRecordService` khong tinh `is_deleted: true`, nhung cac API pre-count va mot so thao tac cong/tru ghi nhan truc tiep trong `EvaluationDetailService` co rui ro tinh ca record da xoa mem neu du lieu production ton tai ban ghi `status: active, is_deleted: true` hoac trang thai khong dong nhat.

## Pham vi sua backend thung rac ghi nhan
- Sua `AcademicRecordService.forceRemove()` de thao tac xoa vinh vien an toan/idempotent:
  - Chi cho xoa vinh vien record dang nam trong thung rac, hoac neu cho xoa truc tiep thi phai ghi ro rule. Khuyen nghi filter: `{ _id, $or: [{ status: 'inactive' }, { is_deleted: true }] }` cho thung rac.
  - Lay truoc `student_id`, `semester_id`, `criterion_id` can sync truoc khi xoa.
  - Sau khi `findByIdAndDelete()` thanh cong, sync diem bang helper rieng co try/catch logging; loi sync khong duoc bien thanh 500 gia neu record da xoa thanh cong.
  - Response nen tra `{ success: true, deletedId, syncStatus }` hoac record da xoa, nhung phai nhat quan de frontend xu ly.
  - Neu record da bi xoa boi request truoc do, endpoint nen tra thanh cong idempotent hoac 404 co message ro; khong de UI hieu nham.
- Sua `remove()` soft-delete de dong bo trang thai chac chan:
  - Luon set dong thoi `status: 'inactive'`, `is_deleted: true`, `deleted_at`, `deleted_by` neu schema cho phep.
  - Sau soft-delete sync diem phai loai record da xoa khoi count.
- Sua `restore()`:
  - Luon restore dong thoi `status: 'active'`, `is_deleted: false`.
  - Sync lai diem sau restore.
  - Neu summary da `locked`, khong duoc tu y thay doi diem da duyet; tra loi ro hoac skip sync theo invariant hien co.
- Them log backend cho production:
  - Log `recordId`, `studentId`, `semesterId`, `criterionId`, actor, phase `delete_db`/`sync_score`/`emit_event`.
  - Log stack trace that su cho loi 500 de khong chi thay "Internal Server Error".

## Pham vi sua backend bao cao lop trong thung rac
- Kiem tra `DailyClassReportService.forceRemove()` vi khi xoa vinh vien bao cao lop, service se goi `academicRecordService.forceRemove(recordId, requester, true)` cho cac record lien ket.
- Dam bao xoa vinh vien bao cao lop khong dung giua chung neu mot record lien ket da bi xoa truoc:
  - Co co che continue/failure list cho tung associated record.
  - Khong bao xoa that bai neu report va cac record con da khong con trong DB sau thao tac.
- Kiem tra `findByDailyReportId(id, true)` tra ca record active va deleted de force delete dung, nhung khong tinh nham cac record nay vao diem.

## Pham vi sua frontend /students/record
- Khi xoa vinh vien tung ghi nhan:
  - Sau API thanh cong: remove item khoi `deletedRecords` ngay, dong modal confirm, refetch thung rac nen chay nen.
  - Neu API tra loi "not found" sau retry hoac do da xoa truoc: xem nhu da xoa thanh cong va refetch.
  - Hien message loi backend that su neu con loi sync/permission.
- Khi xoa vinh vien tat ca:
  - Khong dung `Promise.all` kieu fail-fast neu 1 item loi lam UI bao that bai trong khi cac item khac da xoa.
  - Doi sang `Promise.allSettled`, tong hop `deletedCount`, `failed`, `notFoundCount`.
  - Sau batch luon refetch `fetchDeletedItems()` de UI khop DB.
- Neu loi production la timeout/proxy, can co loading/progress va batch size nho hon thay vi ban nhieu delete song song cung luc.

## Pham vi sua /grading khong tinh is_deleted
- Bo sung `is_deleted: { $ne: true }` vao tat ca query/aggregation dem academic record trong `EvaluationDetailService`:
  - `syncAcademicRecords()`.
  - `getPreExistingRecordCount()`.
  - `getPreExistingCountsForSummary()`.
  - `getPreExistingCountsBulk()`.
- Khi `syncAcademicRecords()` can giam count:
  - Chi hard-delete/soft-delete nhung record active, chua xoa mem, va duoc phep xoa.
  - Khong dung record trong thung rac de tinh `diff`, tranh tinh sai so luong can them/xoa.
- Kiem tra frontend `/grading/score`:
  - `preExistingCountsState` phai nhan count da loc `is_deleted` tu backend.
  - History record neu lay tu API student records thi API da filter `status: active, is_deleted: { $ne: true }`; giu invariant nay.
- Kiem tra cac import/commit ghi nhan lop:
  - Khi import tao academic record, mac dinh phai co `status: active`, `is_deleted: false` hoac khong co `is_deleted` de partial filter van dung.

## Cau hoi nghiep vu can chot
- Xoa vinh vien trong thung rac co duoc ap dung voi record sinh ra tu bao cao lop ngay (`daily_report_id`) khong?
  - Hien frontend dang goi `forceDeleteAcademicRecord(id, true)` nen dang bypass check daily report.
  - Neu nghiep vu muon chi xoa qua bao cao lop, can bo bypass o frontend va backend phai tra message ro.
  - Neu nghiep vu cho phep thung rac xoa vinh vien record con, backend phai xu ly lien ket daily report nhat quan, khong de report con dem sai `recordedStudentsCount`.

## Acceptance criteria
- Tren production-like build, vao `/students/record` -> Thung rac he thong -> xoa vinh vien 1 ghi nhan:
  - API khong tra 500 neu DB da xoa thanh cong.
  - Item bien mat khoi thung rac ngay va sau reload van khong xuat hien.
  - Diem tong hop cua sinh vien/semester/criterion duoc recompute dung neu summary chua locked.
- Xoa vinh vien tat ca ghi nhan trong thung rac:
  - UI hien dung so thanh cong/that bai.
  - Khong co tinh trang toast bao that bai nhung refresh lai mat het.
- Khoi phuc ghi nhan:
  - Record quay ve danh sach active.
  - `/grading` tinh lai count va system_score co bao gom record vua restore neu summary chua locked.
- `/grading`:
  - Record `is_deleted: true` khong duoc tinh vao `current_count`, `original_count`, `system_score`, pre-count bulk, lich su hien thi.
  - Record `status: inactive` khong duoc tinh.
  - Cac summary `locked` khong bi recompute lam thay doi diem da duyet.

## Test can bo sung
- Backend unit/integration:
  - `forceRemove()` xoa thanh cong ngay ca khi sync sau xoa gap loi gia lap; response khong duoc 500 neu chon chinh sach non-blocking sync.
  - `forceRemove()` voi record da bi xoa truoc do co hanh vi idempotent theo rule da chot.
  - `getPreExistingCountsForSummary()` khong dem record `{ status: 'active', is_deleted: true }`.
  - `getPreExistingCountsBulk()` khong dem record `{ status: 'active', is_deleted: true }`.
  - `syncAcademicRecords()` khong dung record deleted de tinh diff.
  - `syncStudentCriterionScore()` sau soft-delete/restore/force-delete tinh dung active count.
- Frontend:
  - Mock force delete partial failure: UI van cap nhat item thanh cong va bao loi tung item.
  - Xoa tat ca dung `allSettled`, khong fail-fast.
- Manual production-like:
  - `npm run build` frontend/backend neu co.
  - Chay app production, tao record -> soft delete -> vao thung rac -> force delete -> reload.
  - Tao du lieu canh: 1 record active, 1 record inactive, 1 record active + is_deleted true; vao `/grading` kiem tra count chi tinh record active khong deleted.

## Ngoai pham vi
- Khong thay doi cong thuc tinh diem/tieu chi ngoai viec loai bo record deleted.
- Khong thay doi UI lon cua `/students/record`, chi sua luong thung rac, thong bao, loading/progress neu can.
- Khong auto-huy duyet summary da locked khi xoa/khoi phuc ghi nhan.
