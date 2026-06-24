# Taskscope: Hien thi tieu chi locked thanh P.HSSV tren /grading/score

## Muc tieu
- Dieu chinh UI trang `/grading/score` de cac tieu chi co `is_locked: true` khong hien 2 badge `SV` va `GV`.
- Voi tieu chi locked, chi hien badge nguon diem tu P.HSSV theo format:
  - `P.HSSV: 10d`
- Diem `P.HSSV` phai la diem he thong tinh tu cac record/ghi nhan cua sinh vien, khong phai diem SV/GV cham tay.
- Dam bao thay doi nay chi anh huong cach hien thi, khong lam sai tong diem, diem muc nay, copy score, save score hoac trang thai duyet.

## Hien trang da kiem tra
- File UI chinh: `frontend/src/app/grading/score/page.tsx`.
- Du lieu tieu chi duoc map tu backend tai `page.tsx`:
  - `is_locked: !!cri.is_locked`.
- Schema backend co san field `is_locked` tai:
  - `backend/src/criteria/schemas/criterion.schema.ts`.
- Diem record-derived duoc backend sync tai:
  - `backend/src/academic-record/academic-record.service.ts`.
- Backend dang dem record theo filter:
  - `student_id`
  - `semester_id`
  - `criterion_id`
  - `status: 'active'`
  - `is_deleted: { $ne: true }`
- Sau khi dem record, backend sync vao summary detail:
  - `detail.current_count = activeCount`
  - `detail.system_score = systemScore`
- Trong danh sach tieu chi tren UI, block render badge diem hien tai nam quanh phan `category.items.map((item) => ...)`.
- UI hien dang luon render:
  - Badge `SV: ...`
  - Badge `GV: ...`
  - Badge `Dat: ...` khi detail da locked.
- `item.is_locked` hien moi duoc dung de:
  - Disable select/counter.
  - Disable nut tang/giam.
  - Giu nguyen tieu chi khi reset/copy score.
- Vi vay voi tieu chi locked, man hinh van hien `SV: Chua cham` va `GV: Chua cham`, gay hieu nham nhu anh nguoi dung gui.

## Ket luan root cause
- Root cause la UI khong tach case `item.is_locked` khi render badges nguon diem.
- `is_locked` cua tieu chi dang duoc xu ly dung cho control nhap diem, nhung chua duoc xu ly cho phan hien thi badge `SV/GV`.
- Can them branch render rieng:
  - Neu `item.is_locked === true`: an badge `SV`, an badge `GV`, hien badge `P.HSSV`.
  - Neu `item.is_locked !== true`: giu hien thi `SV/GV` nhu hien tai.

## Quy tac nghiep vu de ap dung
- `is_locked` o day la khoa theo cau hinh tieu chi, khac voi `activeStudent.gradingStatus === "locked"` la trang thai da duyet/chot bang diem cua sinh vien.
- Tieu chi locked la diem do P.HSSV/he thong quan ly thong qua cac record/ghi nhan, sinh vien va giang vien khong cham truc tiep.
- Diem hien tren badge `P.HSSV` phai lay tu record-derived score:
  - Uu tien `detail.system_score` neu co.
  - Neu `detail.system_score` chua co, tinh fallback tu `detail.current_count` hoac `count` hien co bang cong thuc tieu chi.
  - Khong dung `detail.sv_score` hoac `detail.gv_score` lam nguon hien thi badge `P.HSSV`.
- Neu bang diem da duoc chot va `final_score` ton tai, can kiem tra nghiep vu truoc khi uu tien `final_score` cho tieu chi locked:
  - Neu `final_score` duoc sinh tu `system_score` khi chot thi co the hien `final_score`.
  - Neu co nguy co `final_score` bi ghi de boi nguon khac, badge `P.HSSV` van nen hien `system_score` de dung nghia diem tu record.
- Record bi xoa mem (`is_deleted: true`) hoac `status !== 'active'` khong duoc tinh vao `P.HSSV`.
- Format hien thi:
  - Badge: `P.HSSV: 10d`
  - Dung `formatScoreLabel(phssvScore, hasViolation)` de dong nhat format diem thuong/vi pham.

## Pham vi sua frontend
- File can sua chinh:
  - `frontend/src/app/grading/score/page.tsx`
- Trong block `Scores Badges + Don gia`:
  - Them condition `item.is_locked`.
  - Neu locked:
    - Tinh `phssvScore` tu `detail?.system_score` hoac fallback tu record count.
    - Render mot badge duy nhat label `P.HSSV:`.
    - Khong render badge `SV`.
    - Khong render badge `GV`.
    - Can can nhac khong hien badge `Dat:` rieng cho tieu chi locked neu no lap nghia voi `P.HSSV`.
  - Neu khong locked:
    - Giu nguyen badges `SV` va `GV`.
- Nen tao helper nho trong `page.tsx` hoac `_utils/score-calculation.ts` neu can:
  - `getRecordDerivedCriterionScore(item, count, selectedOptionId, detail)`.
  - Helper nay uu tien `detail.system_score`, khong fallback qua `sv_score/gv_score`.
- Mau badge de de nhan dien:
  - Nen dung emerald/slate hoac mau trung tinh khac voi blue `SV` va amber `GV`.
  - Van giu glass/light style hien tai cua row.
- Title/tooltip:
  - Tooltip cho badge locked nen ghi ngan gon: `Diem tinh tu ghi nhan cua P.HSSV`.
- Khong can doi logic disable control vi control locked hien da bi disable dung.

## Pham vi backend can xac nhan
- `backend/src/academic-record/academic-record.service.ts`
  - Xac nhan record active va chua xoa mem moi duoc tinh vao `activeCount`.
  - Xac nhan khi them/sua/xoa/khoi phuc record thi `syncStudentCriterionScore()` duoc goi va cap nhat lai `current_count`, `system_score`.
  - Xac nhan khong sync vao summary da `status === 'locked'`, hoac neu nghiep vu can cap nhat ca bang da chot thi phai co task rieng.
- `backend/src/evaluation-detail/evaluation-detail.service.ts`
  - Xac nhan khi update direct grading khong lam sai record-derived score cua tieu chi `is_locked`.
  - Neu tieu chi locked khong cho SV/GV cham, backend nen chan update `sv_score/gv_score` cho criterion locked trong task rieng neu hien chua co.
- API response cua `/evaluation-detail/summary/:summaryId` can tra du `system_score` va `current_count` de UI hien `P.HSSV` dung.

## Pham vi can kiem tra them
- `frontend/src/app/grading/score/_utils/score-calculation.ts`
  - Khong bat buoc sua neu tinh `phssvScore` ngay trong `page.tsx`.
  - Neu tao helper, can test rieng cho record-derived score.
- `frontend/src/app/grading/score/_utils/copy-score.ts`
  - Da co logic giu nguyen tieu chi `is_locked`; khong nen thay doi trong task nay.
- `frontend/src/components/grading/GradingPdfTemplate.tsx`
  - Neu PDF/phieu in cung co hien chi tiet `SV/GV` theo tieu chi, nen tao task rieng hoac mo rong scope de dong bo label `P.HSSV`.

## Acceptance criteria
- Vao `/grading/score`, voi tieu chi co `is_locked: true`, UI khong con hien badge `SV` va `GV`.
- Tieu chi locked hien dung mot badge `P.HSSV: <diem>d`.
- Diem trong badge `P.HSSV` lay tu `detail.system_score` do record/ghi nhan tinh ra.
- Neu co 2 record active, moi record +5d, badge hien `P.HSSV: 10d`.
- Neu record bi xoa mem `is_deleted: true`, diem `P.HSSV` phai giam/khong tinh record do sau khi sync.
- Tieu chi khong locked van hien `SV` va `GV` nhu hien tai.
- Control nhap diem cua tieu chi locked van bi disable, khong cho sinh vien/giao vien sua.
- Tong diem danh muc va tong diem sinh vien khong doi sai so voi diem record-derived hien tai.
- Responsive mobile/desktop khong bi tran badge, khong lam vo layout row tieu chi.

## Test can bo sung
- Unit/UI test cho render row tieu chi:
  - `is_locked: true` -> co text `P.HSSV`, khong co text `SV:`, khong co text `GV:`.
  - `is_locked: false` -> co `SV:` va `GV:`, khong co `P.HSSV`.
- Test helper record-derived score:
  - co `detail.system_score = 10` -> badge hien `P.HSSV: 10d`.
  - khong co `detail.system_score`, co `current_count = 2`, `pointsPerUnit = 5` -> fallback hien 10d.
  - khong fallback qua `sv_score/gv_score` neu `system_score` dang null.
  - violation `is_score_counted=false` khong bi tru diem hai lan.
- Backend/regression test:
  - Tao record active -> `current_count` va `system_score` cua summary detail tang dung.
  - Xoa mem record -> record do khong con tinh vao `system_score`.
  - Khoi phuc record -> record duoc tinh lai vao `system_score`.
- Manual QA:
  - 1 tieu chi cong diem locked max 10, 2 record x 5d -> `P.HSSV: 10d`.
  - 1 tieu chi ky luat locked co record vi pham -> hien diem con lai/tru diem dung format hien co.
  - 1 sinh vien chua duyet va 1 sinh vien da duyet.
  - Kiem tra mobile viewport de badge khong tran dong.

## Ngoai pham vi
- Khong thay doi cong thuc tinh diem ren luyen.
- Khong thay doi API criteria/evaluation-detail neu backend da tra `is_locked`, `current_count`, `system_score` dung.
- Khong thay doi luong phe duyet/chot diem.
- Khong thay doi logic copy score/reset score ngoai viec dam bao UI hien thi dung.
- Khong sua PDF/export neu nguoi dung chi yeu cau man hinh `/grading/score`; co the lap task rieng neu can dong bo phieu in.
