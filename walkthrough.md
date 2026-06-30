# Realtime Sync Update Walkthrough

## 1. Backend Changes
- **ID Normalization**: C?p nh?t hàm \safeSync\ trong \cademic-record.service.ts\ ð? x? l? ðúng \_id\ khi \student_id\, \semester_id\, \criterion_id\ là d? li?u ð? ðý?c populate (Object), ð?m b?o \.toString()\ tr? v? ðúng giá tr?.
- **Recompute Total Score**: C?p nh?t \ecomputeTotalScore\ trong \summaries-point.service.ts\ ð? return b?n ghi summary m?i nh?t, giúp hàm sync s? d?ng l?i d? li?u chi ti?t và ði?m t?ng ð? c?p nh?t.
- **Enrich Realtime Payload**: Thêm \updatedDetail\, \	otalScore\, \grading\, \criterionId\ vào s? ki?n phát qua \gradingEventEmitter\ khi có thay ð?i academic record. S?a type payload trong \grading-realtime.service.ts\.
- **Block Invalid Evaluation Detail Updates**: Ngãn c?n vi?c frontend c?p nh?t tr?c ti?p \current_count\, \selected_option_id\, hay \log\ b?ng endpoint \update\ và \emove\ c?a \evaluation-detail.service.ts\. Thay vào ðó, backend quãng \BadRequestException\ yêu c?u ngý?i dùng s? d?ng intent ho?c thay ð?i minh ch?ng ð? ð?m b?o tính toàn v?n d? li?u.

## 2. Frontend Changes
- **Remove evaluationDetail update for logs**: Thay ð?i \rontend/src/app/(dashboard)/grading/score/page.tsx\ ð? không dùng API \updateEvaluationDetail\ hay \deleteEvaluationDetail\ khi ngý?i dùng b?m xóa log. Thay vào ðó, g?i \cademicRecordApi.sendIntent\ (truy?n \intent_type: 'clear_score'\ ho?c \'set_target_count'\) ð? backend x? l? và t? c?p nh?t record minh ch?ng týõng ?ng.
- **Hook Modification**: Ð?i hook \useGradingRealtime\ ð? cho phép \classId\ và \semesterId\ là tùy ch?n (optional) và ch? append vào request URL n?u có, giúp d? dàng tái s? d?ng trên các màn h?nh qu?n l? sinh viên khác bi?t.
- **Realtime /students/record**: Tích h?p \useGradingRealtime\ vào trang h? sõ minh ch?ng (\StudentRecordPage\). Khi nh?n event thay ð?i, hook s? trigger hàm fetch ð? t?i l?i danh sách h? sõ m?i ngay l?p t?c mà không c?n F5.
- **Realtime /grading/score**: Thêm hook \useGradingRealtime\ vào màn h?nh ch?m ði?m chi ti?t. B?t các event có cùng \studentId\ v?i sinh viên ðang m?. T? ð?ng update state \evaluationCounts\, \selectedOptionsState\, \evaluationDetailsMap\ d?a trên \updatedDetail\ c?a payload, giúp giao di?n luôn ð?ng b? hai chi?u v?i /students/record.
