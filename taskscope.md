# Taskscope: Kiem tra loi Lich su ghi nhan khong hien thi trang /grading/score

## Muc tieu
- Kiem tra vi sao tab `Lich su ghi nhan` tren trang `/grading/score` khong hien thi du lieu.
- Xac dinh nguon du lieu dang dung cho lich su: `summary.details[].log`, `evaluation-detail`, hay `academic-records`.
- De xuat pham vi sua de lich su hien thi dung sau khi tai trang, chuyen sinh vien, luu diem, sao chep diem va xoa lich su.

## Hien trang da kiem tra
- Frontend chinh nam tai `frontend/src/app/grading/score/page.tsx`.
- Component rieng `frontend/src/app/grading/score/_components/ScoreHistoryPanel.tsx` dang ton tai nhung hien khong duoc import/su dung trong `page.tsx`.
- `page.tsx` dang render tab lich su inline tai khoi `subTab === "history"` va loc theo:
  - `historyRecords.filter((r) => r.studentId === activeStudentId)`.
- `historyRecords` duoc tao tu `detail.log` cua API:
  - `evaluationDetailApi.getEvaluationDetailsBySummary(summaryId)`.
- Frontend dang goi `getEvaluationDetailsBySummary(summaryId)` khong truyen `includeLogs`.
- API frontend co san tham so:
  - `getEvaluationDetailsBySummary(summaryId: string, includeLogs?: boolean)`.
  - Neu truyen `true` se goi `/evaluation-detail/summary/:summaryId?includeLogs=true`.
- Backend controller `EvaluationDetailController.findBySummaryId()` dang xu ly:
  - `const fetchLogs = includeLogs === 'true'`.
  - Nghia la neu frontend khong truyen `includeLogs=true`, backend se xem la `false`.
- Backend service `EvaluationDetailService.findBySummaryId(summaryId, requester, fetchLogs)` se `.select({ 'details.log': 0 })` khi `fetchLogs` la `false`.
- Vi vay root cause co kha nang cao la frontend khong yeu cau lay log, nen `detail.log` bi loai khoi response va `activeHistory` luon rong.

## Ket luan root cause
- Loi chinh: `/grading/score` khong truyen `includeLogs=true` khi load chi tiet cham diem cho tab lich su.
- Do controller mac dinh query thieu `includeLogs` thanh `false`, backend loai bo `details.log` khoi response.
- Ket qua:
  - Diem/current_count van co the hien thi dung.
  - Tab `Lich su ghi nhan` khong co ban ghi vi frontend map tu `detail.log || []`.

## Cac diem can luu y them
- `EvaluationDetailService.findBySummaryId()` co default parameter `fetchLogs = true`, nhung controller luon truyen boolean tu query.
  - Thuc te qua controller, mac dinh la `false`, khac voi default cua service.
  - Can thong nhat contract API: mac dinh co lay logs hay khong, hoac frontend bat buoc truyen ro.
- `ScoreHistoryPanel.tsx` co interface `HistoryRecord` khac voi interface `HistoryRecord` trong `page.tsx`:
  - Component yeu cau `detailId`, `evaluatorName?`.
  - `page.tsx` dung `studentId`, `updated_by?`.
  - Neu muon dung lai component rieng, can chuan hoa type truoc.
- `page.tsx` co logic build history lap lai nhieu lan:
  - Load ban dau.
  - Lazy-load khi doi `activeStudentId`.
  - Sau khi luu diem.
  - Sau khi xoa lich su.
  - Sau khi copy score.
  - Nen tach helper `mapDetailsToHistoryRecords(details, studentId, categories, fallbackRole)` de tranh sai lech.
- Xoa lich su hien dua vao id dang `${detail._id}-log-${index}` va split bang `-log-`.
  - Nen chuan hoa thanh object co `detailId` va `logIndex` rieng de tranh loi parse id.
- Khi xoa log, backend `EvaluationDetailService.update()` chi set `details.$.log` neu `log.length > 0`.
  - Flow hien tai neu cleanLog rong thi frontend xoa detail luon, nen khong bi case update log rong.
  - Tuy nhien can test ky neu chi muon xoa het log nhung van giu detail/current_count.

## Pham vi sua de hien thi dung
- Frontend `frontend/src/app/grading/score/page.tsx`:
  - Doi tat ca call can build lich su tu:
    - `evaluationDetailApi.getEvaluationDetailsBySummary(summaryId)`
    - sang `evaluationDetailApi.getEvaluationDetailsBySummary(summaryId, true)`.
  - Cac vi tri can uu tien:
    - Load du lieu active student ban dau.
    - Lazy-load khi `activeStudentId` thay doi.
    - Refetch sau khi luu diem.
    - Refetch sau khi xoa lich su.
    - Copy score neu can hien history cua target/source ngay lap tuc.
  - Tach helper map log thanh `HistoryRecord[]` de dung chung.
  - Reset `historyPage` ve 1 khi doi sinh vien, doi hoc ky, doi lop, hoac refetch history.
  - Hien loading/empty state phan biet:
    - Dang tai lich su.
    - Da tai xong nhung chua co log.
    - Loi khong tai duoc lich su.
- Frontend `frontend/src/api/evaluation-detail-api.ts`:
  - Giu tham so `includeLogs?: boolean` hoac them helper ro nghia `getEvaluationDetailsBySummaryWithLogs(summaryId)`.
  - Dam bao query string dung `includeLogs=true` khi can lich su.
- Backend `backend/src/evaluation-detail/evaluation-detail.controller.ts`:
  - Can chot contract:
    - Cach 1: giu mac dinh khong tra logs de toi uu payload, frontend bat buoc truyen `includeLogs=true`.
    - Cach 2: doi default controller thanh true neu endpoint nay chu yeu phuc vu man cham diem.
  - Neu giu Cach 1, bo sung test xac nhan khong co query thi khong tra log, co query thi tra log.
- Backend `backend/src/evaluation-detail/evaluation-detail.service.ts`:
  - Kiem tra `findBySummaryId()` tra du lieu co `details.log` khi `fetchLogs=true`.
  - Kiem tra permission `assertCanAccessSummary()` khong chan nham role Teacher/Student/Admin/Supervisor hop le.

## Acceptance criteria
- Khi mo `/grading/score`, chon sinh vien da tung luu diem, tab `Lich su ghi nhan` hien cac log da co trong `summary.details[].log`.
- Khi chuyen qua sinh vien khac, lich su refetch dung sinh vien moi, khong hien data cua sinh vien cu.
- Khi bam `Luu thay doi`, lich su moi xuat hien ngay sau khi save thanh cong, khong can refresh trang.
- Khi reload trang, lich su da luu van con va hien thi lai dung.
- Khi xoa 1 dong lich su, danh sach cap nhat lai, diem/current_count/tong diem dong bo dung.
- Khi user khong co quyen xem summary, API tra loi ro rang va UI khong hien empty state gay hieu nham la khong co lich su.
- Production build khong phat sinh TypeScript/lint error lien quan `HistoryRecord` hoac `includeLogs`.

## Test can bo sung
- Backend:
  - `GET /evaluation-detail/summary/:summaryId?includeLogs=true` tra ve `details.log`.
  - `GET /evaluation-detail/summary/:summaryId` khong tra log neu giu contract toi uu payload.
  - Permission theo role khong lam mat lich su cua sinh vien/lop duoc phep xem.
- Frontend:
  - Mock `evaluationDetailApi.getEvaluationDetailsBySummary` de xac nhan `/grading/score` truyen `includeLogs=true` khi build history.
  - Test map `detail.log` thanh `HistoryRecord` dung `studentId`, `title`, `count`, `points`, `role`, `status`.
  - Test doi `activeStudentId` reset `historyPage` va thay doi danh sach history.
  - Test empty state chi hien khi API da tra thanh cong va log that su rong.

## Ngoai pham vi
- Khong thay doi cong thuc tinh diem ren luyen trong task nay.
- Khong thay doi logic phe duyet/chot diem neu khong lien quan truc tiep toi lich su.
- Khong gop/refactor toan bo trang `/grading/score` ngoai cac helper can thiet cho history.
- Khong sua UI tong the cua trang neu chi xu ly loi khong hien lich su.
