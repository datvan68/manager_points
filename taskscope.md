# Task Scope: Khắc phục lỗi chọn option nhưng điểm hiển thị thành điểm tối đa

## Bối cảnh

Ở màn hình chấm điểm, tiêu chí dạng `single_option` có danh sách lựa chọn riêng, ví dụ:

```text
Lớp phó (8đ)
```

Nhưng sau khi chọn option, UI vẫn hiển thị điểm mục này là `+10đ` hoặc bằng điểm tối đa của tiêu chí. Điều đúng phải là: chọn option nào thì điểm realtime, điểm lưu, điểm tổng và lịch sử phải theo đúng `option.score` của option đó.

## Kết luận kiểm tra hiện tại

Root cause có khả năng cao nằm ở frontend `frontend/src/app/grading/score/page.tsx`.

Các đoạn đã thấy:

- `handleOptionSet()` lưu `selectedOptionsState[studentId][criterionId] = optionId`, đồng thời set `evaluationCounts[criterionId] = 1`.
- `calculateRealtimeScore()` đã có nhánh `single_option` và dùng `option.score`, đây là hướng đúng.
- Nhưng phần render UI lại tính:
  - `criterionScore = calculateCriterionScore(item, count)`
  - `achievedPoints = getCriterionContributionScore(item, count)`
- Với `single_option`, `count` thường là `1`, nên `getCriterionContributionScore()` vẫn tính theo `pointsPerUnit/maxScore`. Nếu `pointsPerUnit` hoặc `maxScore` là 10 thì UI sẽ hiển thị `+10đ` dù option đang chọn là `8đ`.
- Sau khi lưu, `persistStudentScore()` fetch lại `freshDetails`, nhưng khi tính `finalScore` lại tiếp tục dùng `getCriterionContributionScore(cri, freshCounts[cri.id] || 0)` cho mọi tiêu chí. Với `single_option`, `freshCounts` là `1`, nên tổng điểm có thể bị tính lại sai theo điểm tối đa thay vì `selected_option_score`.

Backend `backend/src/evaluation-detail/evaluation-detail.service.ts` hiện đã xử lý đúng hướng cho `single_option`:

- Khi tạo/cập nhật detail, nếu `selected_option_id` hợp lệ thì:
  - `system_score = option.score`
  - `selected_option_id = option.id`
  - `selected_option_label = option.label`
  - `selected_option_score = option.score`
  - `current_count = 1`

Vì vậy phạm vi sửa chính nên tập trung vào frontend display/recalculate sau khi save, và chỉ bổ sung backend test nếu phát hiện endpoint trả dữ liệu thiếu.

## Mục tiêu sửa

Sau khi sửa:

- Option `Lớp phó (8đ)` phải hiển thị `+8đ`, không hiển thị `+10đ`.
- Mọi option khác phải hiển thị đúng `option.score`.
- Tổng điểm realtime phải đổi ngay khi đổi option.
- Sau khi bấm lưu và reload lại trang, điểm vẫn giữ đúng theo option đã chọn.
- `summary.total_score`, `EvaluationDetail.system_score`, `selected_option_score`, `sv_score/gv_score` phải thống nhất.

## Phạm vi cần thực hiện

### 1. Tạo helper tính điểm thống nhất cho tiêu chí

File chính:

```text
frontend/src/app/grading/score/page.tsx
```

Cần tách một helper dùng chung, ví dụ:

```ts
const getCriterionScoreForState = (
  criterion: Criteria,
  count: number,
  selectedOptionId?: string | null,
) => {
  if (criterion.scoring_mode === "single_option") {
    const option = criterion.options?.find((opt) => opt.id === selectedOptionId);
    if (!option) {
      return criterion.type === "violation" ? criterion.maxScore ?? 10 : 0;
    }

    if (criterion.type === "violation" && criterion.is_score_counted === false) {
      return option.score - (criterion.maxScore ?? 10);
    }

    return option.score;
  }

  return getCriterionContributionScore(criterion, count);
};
```

Lưu ý:

- Không dùng `count` để tính điểm option, vì `count = 1` chỉ biểu thị đã chọn một option.
- `count` vẫn cần giữ để backend biết trạng thái chọn/bỏ chọn, nhưng không được xem là số lần nhân điểm.
- Cần thống nhất cách xử lý `violation + is_score_counted === false` giữa realtime, save và hiển thị.

### 2. Sửa điểm hiển thị trên giao diện

Trong render danh sách tiêu chí, thay các dòng đang tính:

```ts
const criterionScore = calculateCriterionScore(item, count);
const achievedPoints = getCriterionContributionScore(item, count);
```

bằng logic có xét option:

```ts
const selectedOptionId = selectedOptionsState[activeStudentId]?.[item.id] || null;
const achievedPoints = getCriterionScoreForState(item, count, selectedOptionId);
const criterionScore = achievedPoints;
```

Các vị trí cần kiểm tra:

- Điểm realtime mobile cạnh tên tiêu chí.
- Điểm realtime desktop `"Điểm mục này"`.
- Badge `"Đạt"` khi tiêu chí đã duyệt/chốt.
- Điểm danh mục đang tính realtime ở phần `categories.map`.

### 3. Sửa tính tổng điểm sau khi lưu

Trong `persistStudentScore()`, sau khi lấy `freshDetails`, cần build thêm map option:

```ts
const freshSelectedOptions: Record<string, string> = {};

freshDetails.forEach((detail) => {
  if (detail.selected_option_id) {
    freshSelectedOptions[criId] = detail.selected_option_id;
  }
});
```

Sau đó khi tính `finalScore`, dùng helper mới:

```ts
catScore += getCriterionScoreForState(
  cri,
  freshCounts[cri.id] || 0,
  freshSelectedOptions[cri.id] || null,
);
```

Không dùng `getCriterionContributionScore(cri, freshCounts[cri.id] || 0)` cho `single_option`.

### 4. Sửa tính tổng điểm sau khi xóa lịch sử/chỉnh lại detail

Trong `handleDeleteHistoryRecord()` cũng có đoạn tính lại tổng điểm từ `freshCounts`. Cần áp dụng cùng helper mới và map `selected_option_id` từ `freshDetails`.

Nếu detail option bị xóa hoặc bỏ chọn:

- `selected_option_id = null`
- `selected_option_score = null`
- `current_count = 0`
- UI quay về `0đ` hoặc trạng thái chưa chọn, không rơi về `maxScore`.

### 5. Sửa load dữ liệu ban đầu và đổi sinh viên

Hiện khi load details đã có:

```ts
optionsMap[criId] = detail.selected_option_id;
```

Cần đảm bảo:

- `setSelectedOptionsState()` luôn được gọi với `optionsMap` sau khi load active student.
- Khi đổi sinh viên, option đã lưu phải được bind vào dropdown.
- Điểm hiển thị sau load phải tính từ `selectedOptionsState` hoặc từ `evaluationDetailsMap[criId].selected_option_id` trong lúc state option chưa kịp set.

Khuyến nghị fallback hiển thị:

```ts
const selectedOptionId =
  selectedOptionsState[activeStudentId]?.[item.id] ||
  detail?.selected_option_id ||
  null;
```

### 6. Sửa copy điểm nếu có copy tiêu chí option

Luồng sao chép điểm hiện truyền `counts` vào `persistStudentScore()`, nhưng option nằm trong `selectedOptionsState`.

Cần kiểm tra case:

- Copy từ sinh viên A có option `Lớp phó (8đ)` sang sinh viên B.
- B phải nhận đúng `selected_option_id`, `selected_option_label`, `selected_option_score`.
- Nếu hiện tại chỉ copy `count = 1` mà không copy option id, kết quả sẽ không đủ dữ liệu để lưu đúng option.

Nếu chưa hỗ trợ copy option, cần ghi rõ behavior: hoặc không copy tiêu chí `single_option`, hoặc copy cả selected option.

### 7. Backend validation cần giữ

Files liên quan:

```text
backend/src/evaluation-detail/evaluation-detail.service.ts
backend/src/evaluation-detail/test/evaluation-detail.service.spec.ts
```

Yêu cầu:

- Không cho frontend tự gửi score tùy ý nếu `selected_option_id` không tồn tại.
- `selected_option_id` phải được validate theo `criterion.options`.
- `system_score` phải luôn bằng `option.score`.
- Khi update option từ `opt1` sang `opt2`, `system_score` và `selected_option_score` phải đổi theo `opt2`.

Backend hiện có vẻ đã làm phần này, nhưng cần test regression để khóa hành vi.

## Test cần bổ sung/cập nhật

Frontend:

- Test helper mới:
  - reward `single_option`, option 8 điểm, `count = 1` -> trả `8`.
  - reward `single_option`, option 10 điểm -> trả `10`.
  - reward `single_option`, chưa chọn option -> trả `0`.
  - count mode vẫn dùng `pointsPerUnit/maxScore` như cũ.
  - violation `is_score_counted=false` giữ đúng logic trừ điểm nếu nghiệp vụ yêu cầu.
- Test render: chọn option 8 điểm thì text `"Điểm mục này"` hiển thị `+8đ`.
- Test save/recalculate: sau khi `freshDetails` có `selected_option_score = 8`, `summary.total_score` không bị tính thành 10.

Backend:

- Bổ sung hoặc giữ test trong `evaluation-detail.service.spec.ts`:
  - create `single_option` với `opt1.score = 8` -> `system_score = 8`.
  - update sang `opt2.score = 10` -> `system_score = 10`.
  - option không tồn tại -> `BadRequestException`.

## Acceptance Criteria

- Chọn `Lớp phó (8đ)` thì UI hiển thị `+8đ`.
- Không còn trường hợp dropdown chọn option 8đ nhưng điểm chính bên phải vẫn hiện `+10đ`.
- Badge `"Tối đa 10đ"` có thể vẫn hiển thị để mô tả trần tiêu chí, nhưng điểm chính phải là điểm option.
- Tổng điểm danh mục và tổng điểm sinh viên cập nhật đúng ngay sau khi chọn option.
- Bấm lưu, reload trang, đổi sinh viên rồi quay lại vẫn giữ đúng option và điểm.
- API detail lưu đúng `selected_option_id`, `selected_option_label`, `selected_option_score`, `system_score`.
- Không làm thay đổi cách tính của tiêu chí dạng `count`.

## Thứ tự triển khai đề xuất

1. Tạo helper tính điểm thống nhất cho `count` và `single_option`.
2. Thay toàn bộ điểm hiển thị realtime dùng helper mới.
3. Thay phần tính `finalScore` sau save và sau delete history dùng helper mới.
4. Đảm bảo load/switch student fallback từ `detail.selected_option_id`.
5. Kiểm tra copy score với tiêu chí option.
6. Bổ sung test frontend helper/render và backend service nếu thiếu.
7. Test thủ công case `Lớp phó (8đ)` trên giao diện.

## Ghi chú rủi ro

- Không sửa bằng cách đổi `maxScore` của tiêu chí thành điểm option, vì `maxScore` là trần của tiêu chí, không phải điểm của từng option.
- Không dùng `current_count = 1` để suy ra điểm option.
- Không tin score do frontend gửi nếu backend đã có `criterion.options`; backend phải là nguồn xác thực cuối cùng cho option hợp lệ.
