# Taskscope: Realtime danh sach /grading va kiem tra tinh duyet diem khi update production

## Muc tieu
- Trang `/grading` phai cap nhat danh sach diem ren luyen gan nhu realtime de nhieu tai khoan dang xem cung lop/hoc ky nam duoc thay doi ngay khi co nguoi khac thao tac.
- Kiem tra va co che chan ro rang: build/update production khong duoc lam thay doi trang thai duyet diem. Ban ghi da duyet (`locked`) khong duoc tu dong bi huy duyet neu khong goi dung chuc nang `cancelApproval`.
- Ghi ro cac diem phai phat su kien realtime: tao/khoi tao summary, sua chi tiet diem, them/xoa/sua academic record lam thay doi summary, duyet diem, huy duyet, xoa summary.

## Pham vi hien tai da kiem tra
- Frontend `/grading` dang dung `fetchData()` va `fetchSummaries()` trong `frontend/src/app/grading/page.tsx`; danh sach chi cap nhat khi load trang, doi filter, doi page, hoac sau thao tac tren chinh tab hien tai.
- Chua thay ha tang WebSocket/Socket.IO trong backend/frontend. Backend co `rxjs` va mot `systemEventEmitter` rieng cho system, nen co the mo rong theo huong EventEmitter + SSE/fetch stream ma khong can them dependency lon.
- API summary hien co trong `backend/src/summaries-point/summaries-point.controller.ts`: `GET /summaries-points`, `PATCH /:id/approve`, `PATCH /:id/cancel-approval`, `PATCH /cancel-approval/bulk`, `POST /initialize-class`, `DELETE /:id`.
- Logic backend dang bao ve trang thai da duyet:
  - `SummariesPointService.update()` chan sua summary neu `existingSummary.status === 'locked'`.
  - `EvaluationDetailService.create/update/remove()` chan them/sua/xoa detail neu summary da `locked`.
  - `AcademicRecordService.sync...()` bo qua summary da `locked`, khong tinh lai vao summary da duyet.
  - `recomputeTotalScore()` neu summary `locked` thi tinh lai grading theo total_score, neu khong locked moi gan `Chua xep loai`.
  - Chi `cancelApproval()` moi chuyen summary tu `locked` ve `draft`, xoa rank/final_score/locked_at.
- Vi vay ban than lenh build production khong lam thay doi du lieu MongoDB. Neu co hien tuong da duyet bi tro ve chua duyet sau deploy, can kiem tra migration/script/seed/restore API/cache stale hoac client dang nhan data cu, khong phai do `next build`/`nest build` tu dong doi status.

## Yeu cau chuc nang 1: realtime danh sach /grading

### Backend
1. Tao mot kenh phat su kien grading tap trung, vi du `grading-event-emitter.ts` hoac service `GradingRealtimeService`.
2. Them endpoint realtime, uu tien mot trong hai huong:
   - SSE/fetch stream: `GET /summaries-points/realtime` hoac `GET /summaries-points/events` tra event stream theo user da xac thuc.
   - WebSocket chi khi chap nhan bo sung dependency `@nestjs/websockets` va adapter phu hop.
3. Neu dung SSE voi token Bearer hien tai luu o frontend, khong dung native `EventSource` neu khong gui duoc header Authorization. Nen dung `fetch()` streaming de gui header `Authorization: Bearer <token>`, hoac thiet ke auth SSE rieng co thoi han ngan neu bat buoc dung query token.
4. Payload event toi thieu:
   - `type`: `summary_created`, `summary_updated`, `summary_deleted`, `summary_approved`, `summary_cancelled`, `summary_recomputed`, `academic_record_changed`.
   - `summaryId`, `studentId`, `classId`, `semesterId`, `status`, `totalScore`, `grading`, `updatedAt`, `updatedBy`.
   - `version` hoac `revision` neu co the, de frontend bo qua event cu.
5. Phat event sau khi transaction/thao tac DB thanh cong tai cac diem:
   - `SummariesPointService.create()`.
   - `initializeClass()` khi tao nhieu summary.
   - `update()` neu sua summary hop le.
   - `approveGrading()` sau khi save rank/status va populate xong.
   - `cancelApproval()` va `cancelApprovalBulk()` sau khi huy duyet thanh cong.
   - `remove()` sau khi xoa thanh cong.
   - `EvaluationDetailService.create/update/remove()` sau khi `recomputeTotalScore()`.
   - `AcademicRecordService.create/update/delete/restore/bulk/import` va cac ham sync lien quan sau khi summary bi anh huong duoc tinh lai.
6. Phan quyen event:
   - User chi nhan event thuoc scope minh duoc xem theo cung logic `assertCanAccessSummary`/`getSummaryScopeFilter`.
   - Admin/Supervisor co the nhan theo filter `classId`, `semesterId`.
   - Co van chi nhan lop minh phu trach.
   - Sinh vien neu co dung chung event chi nhan summary cua minh.
7. Khong gui toan bo danh sach qua event neu khong can. Event co the gom metadata + summary moi da populate; neu event thieu data, frontend fetch lai trang hien tai.
8. Them heartbeat/ping moi 20-30s va co co che reconnect/backoff.

### Frontend /grading
1. Them hook rieng, vi du `useGradingRealtime({ classId: appliedClass, semesterId: appliedSemester, enabled })`.
2. Khi `appliedClass` hoac `appliedSemester` thay doi:
   - Dong connection cu.
   - Mo connection moi theo filter hien tai.
   - Khong nhan event cua lop/hoc ky khac.
3. Khi nhan event:
   - Neu event co `classId`/`semesterId` khac filter hien tai thi bo qua.
   - Neu event la update/approve/cancel/recompute va summary dang co trong `apiSummariesPoints`, replace item theo `_id`.
   - Neu event la create/initialize va page hien tai co the bi anh huong, fetch lai trang 1 hoac fetch lai page hien tai tuy UX.
   - Neu event la delete, remove item khoi local state va cap nhat `totalItems`.
   - Cap nhat `preExistingCountsCache` cho summary bi anh huong, hoac invalidate/fetch lai counts cho summary do.
4. Tranh refresh qua nhieu:
   - Debounce/batch cac event lien tiep 300-800ms.
   - Neu dang sua modal/selection, khong reset selection tuy tien; chi reset nhung id da bi xoa/doi status khong con hop le.
5. Hien thi trang thai nhe tren UI:
   - `Dang dong bo`, `Da cap nhat vua xong`, `Mat ket noi - dang thu lai`.
   - Khong can popup moi event de tranh spam.
6. Fallback khi realtime loi:
   - Tu dong reconnect.
   - Neu mat ket noi lau, polling nhe moi 15-30s cho filter hien tai.
   - Khi tab quay lai foreground (`visibilitychange`), fetch lai de dong bo.

## Yeu cau chuc nang 2: tinh duyet diem sau update/build production

### Ket luan can xac nhan trong code
- Build production khong duoc chay seed/migration nao lam reset `summary_points.status` ve `draft`.
- Deploy/update app khong duoc goi API `cancelApproval`, `updateSummariesPoint({ status: 'draft' })`, hay restore database ngam.
- Neu summary da `locked`, cac luong cap nhat diem phai giu nguyen status `locked` va khong sua `details.final_score` tru khi thuc hien luong huy duyet co chu dich.

### Viec can lam
1. Tim tat ca noi co the ghi vao `summary_points.status` va `details.status`:
   - `summaries-point.service.ts`.
   - `evaluation-detail.service.ts`.
   - `academic-record.service.ts`.
   - import/restore/seed/migration neu co.
2. Dat rule bat bien:
   - `locked` chi ve `draft` qua `cancelApproval()`/`cancelApprovalBulk()` va phai co user hop le + log/reason.
   - `approveGrading()` chuyen sang `locked` va cap nhat `rank_*`.
   - Cac sync tu academic record/detail neu gap summary `locked` phai bo qua hoac tra loi loi ro rang, khong am tham mo khoa.
3. Neu co nhu cau sua diem sau khi da duyet:
   - UI phai yeu cau huy duyet truoc.
   - Sau khi huy duyet moi cho sua, sau do nguoi co quyen duyet lai.
   - Khong tu dong huy duyet khi cap nhat du lieu/import/build.
4. Them audit log/metadata cho moi lan huy duyet:
   - `cancelled_by`, `cancelled_at`, `cancel_reason` neu schema cho phep, hoac it nhat log trong details.
   - Event realtime `summary_cancelled` phai kem nguoi thao tac.
5. Khi production deploy xong:
   - Khong clear local state theo cach lam UI hien thi sai thanh `Chua duyet` neu API van tra `locked`.
   - Neu co cache API/CDN, dam bao `GET /summaries-points` khong bi cache sai du lieu cu.

## Acceptance criteria
- Mo 2 tai khoan khac nhau cung xem `/grading` voi cung lop/hoc ky. Tai khoan A duyet diem mot sinh vien, tai khoan B thay row doi sang `Da duyet/locked` trong vong 1-3 giay, khong can reload trang.
- Tai khoan A huy duyet, tai khoan B thay row doi ve `draft/Chua duyet` trong vong 1-3 giay.
- Tai khoan A them/sua/xoa chi tiet diem hoac academic record cho summary chua locked, tai khoan B thay total/grading/status lien quan duoc cap nhat.
- Event cua lop/hoc ky khac khong lam danh sach hien tai bi doi.
- Khi disconnect/reconnect, frontend fetch lai mot lan de khong mat event.
- Summary da `locked` khong bi tu dong ve `draft` sau `npm run build`, `npm run start:prod`, restart backend, restart frontend, hoac deploy production.
- Cap nhat academic record/detail lien quan den summary da `locked` bi chan/bo qua theo rule hien co va khong lam thay doi `status`, `final_score`, `rank_*`.
- Chi khi goi API huy duyet hop le thi summary moi ve `draft`, UI cua tat ca client cap nhat realtime.

## Test can co
- Backend unit test cho service:
  - `approveGrading()` set `status = locked`, set detail `status/final_score/locked_at/locked_by`, set `rank_*`.
  - `cancelApproval()` la duong duy nhat dua locked ve draft.
  - `update()` summary locked phai throw BadRequest.
  - `EvaluationDetailService.create/update/remove()` summary locked phai throw BadRequest.
  - `AcademicRecordService.sync...()` gap summary locked thi khong sua status/details/final_score.
- Backend realtime test:
  - Khi approve/cancel/update/delete thanh cong thi emit dung event voi `classId`, `semesterId`, `summaryId`.
  - User khong co quyen khong nhan event ngoai scope.
- Frontend test:
  - Hook realtime replace/remove row dung `_id`.
  - Bo qua event khac class/semester.
  - Reconnect/fallback polling co goi lai `fetchSummaries()`.
- Manual test production-like:
  - `cd backend && npm run build`.
  - `cd frontend && npm run build`.
  - Chay backend/frontend production, tao summary, approve, restart service, mo lai `/grading`, status van `locked`.
  - Test 2 browser/2 account cung lop/hoc ky.

## Ngoai pham vi
- Khong thay doi thuat toan tinh diem/xep loai neu khong phat hien bug rieng.
- Khong doi mau giao dien `/grading` ngoai cac chi tiet can hien thi trang thai dong bo.
- Khong tu dong huy duyet diem khi co thay doi/import/deploy. Moi huy duyet phai la hanh dong co chu dich.

## Ghi chu rui ro
- Native `EventSource` khong gui duoc Authorization header, can can nhac ky neu he thong dang xac thuc bang Bearer token trong localStorage.
- Neu dung polling thay realtime push, can thong bao ro do chi la near-realtime va do tre tuy interval; yeu cau hien tai nen uu tien server push.
- Event realtime phai phat sau khi DB save thanh cong, neu phat truoc co the UI hien thi data chua commit.
