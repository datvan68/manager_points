# 1. Task ID + Pipeline

- `Task ID: ACTIVITY-MEMBER-20260716-01`
- `Pipeline: feature_development`

# 2. Risk Level

`Risk level: medium` — thay đổi tác động đến giao diện quản lý thành viên, hợp đồng API và mô hình dữ liệu thành viên hoạt động trong môi trường phát triển; có kiểm soát phân quyền và dữ liệu lịch sử, không yêu cầu truy cập bí mật hay tạo tác dụng phụ bên ngoài. Thay đổi mã có thể hoàn tác bằng Git, nhưng việc áp dụng migration dữ liệu vào bất kỳ cơ sở dữ liệu nào phải qua Human Gate riêng.

# 3. Objective

Sửa luồng xóa tại tab “Thành viên” để modal hiển thị đúng và thành viên đã xóa biến mất khỏi danh sách hoạt động, đồng thời bổ sung chọn bằng checkbox và xóa nhiều qua `FloatingActionBar`. Cho phép tài khoản Admin tham gia hoạt động bằng chính định danh tài khoản Admin với vai trò thành viên, không ánh xạ hoặc giả lập Admin thành một bản ghi sinh viên bất kỳ.

# 4. Scope

- `frontend/src/components/activities/ActivityMemberTable.tsx`
  - Tách modal xác nhận khỏi vùng bảng có `overflow-hidden`/containing block hoặc render modal qua portal để backdrop và hộp thoại phủ đúng viewport.
  - Thêm checkbox chọn từng hàng và chọn tất cả các hàng đủ điều kiện đang hiển thị.
  - Quản lý tập ID được chọn, tự loại ID không còn trong `members`, khóa thao tác khi đang gửi yêu cầu và hiển thị `FloatingActionBar` khi có ít nhất một lựa chọn.
  - Cung cấp hành động “Xóa” trong `FloatingActionBar`, modal xác nhận xóa nhiều, số lượng đã chọn, hủy chọn và phản hồi thành công/thất bại rõ ràng.
  - Hiển thị thông tin danh tính đúng cho cả thành viên sinh viên và thành viên Admin.
- `frontend/src/components/activities/ActivityMemberTable.test.tsx`
  - Bổ sung regression test cho phạm vi hiển thị modal, xóa đơn, chọn từng hàng/chọn tất cả, mở/đóng `FloatingActionBar`, xóa nhiều, chống gửi lặp và xử lý lỗi một phần/toàn bộ.
- `frontend/src/components/modals/ConfirmModal.tsx`
  - Điều chỉnh cơ chế mount/portal và vòng đời xác nhận để modal không bị cắt bởi ancestor, không tự đóng trước khi Promise hoàn tất và không gọi `onClose` hai lần.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
  - Cập nhật state ngay sau xóa thành công hoặc chờ `loadActivityData()` hoàn tất để thành viên đã xóa không còn trên giao diện.
  - Thêm handler xóa nhiều với kết quả xác định cho từng ID và chỉ tải lại danh sách một lần sau batch.
  - Tìm membership của người dùng hiện tại theo định danh thành viên tổng quát, không chỉ theo `studentId`.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
  - Bổ sung test tích hợp component/API cho xóa đơn, xóa nhiều và membership của Admin không có `studentId`.
- `frontend/src/api/activity-api.ts`
  - Mở rộng kiểu `ActivityMember` để biểu diễn danh tính `student_id` hoặc `user_id` và thêm API client xóa nhiều theo endpoint backend đã xác minh.
- `frontend/src/api/activity-api.test.ts`
  - Kiểm tra method, URL, payload và xử lý lỗi của API xóa nhiều.
- `backend/src/activities/schemas/activity-member.schema.ts`
  - Mở rộng membership để tham chiếu trực tiếp `User` cho thành viên không phải sinh viên; `student_id` không còn bắt buộc tuyệt đối.
  - Bảo đảm mỗi membership có đúng một danh tính hợp lệ (`student_id` hoặc `user_id`) và uniqueness theo hoạt động, học kỳ và danh tính.
- `backend/src/activities/dto/activity-member.dto.ts`
  - Bổ sung DTO xóa nhiều có danh sách Mongo ID hợp lệ, không rỗng, không trùng; cập nhật DTO tham gia/thêm thành viên nếu cần để hỗ trợ định danh Admin trực tiếp.
- `backend/src/activities/activities.controller.ts`
  - Thêm endpoint xóa nhiều thành viên dưới cùng cơ chế xác thực/phân quyền quản lý thành viên như xóa đơn.
  - Truyền định danh người dùng đăng nhập vào luồng tham gia mà không giả định `studentId` tồn tại.
- `backend/src/activities/activities.service.ts`
  - Giữ lịch sử bằng soft delete (`status: left`, `left_at`) nhưng mặc định loại `left` khỏi danh sách tab “Thành viên”; chỉ trả lịch sử khi có filter được yêu cầu rõ ràng.
  - Làm cho xóa đơn idempotent và xóa nhiều có kết quả rõ ràng cho ID hợp lệ, không tồn tại hoặc đã rời hoạt động.
  - Thay `resolveStudentId`/nhánh lấy sinh viên bất kỳ cho Admin bằng cơ chế principal thực: sinh viên dùng `student_id`, Admin dùng `user_id`.
  - Áp dụng kiểm tra trùng membership, trạng thái tham gia, giới hạn thành viên và truy vấn “hoạt động của tôi” cho cả hai loại principal.
  - Không làm thay đổi dữ liệu hoặc membership của sinh viên khác khi Admin tham gia.
- `backend/src/activities/activities.service.spec.ts`
  - Bổ sung test lọc bản ghi `left`, xóa đơn idempotent, xóa nhiều, Admin tham gia bằng `user_id`, chống trùng và loại bỏ hành vi chọn sinh viên bất kỳ.
- `backend/src/activities/activities.controller.spec.ts`
  - Bổ sung test route, validation và guard của endpoint xóa nhiều và tham gia bằng tài khoản Admin.
- `backend/scripts/migrate-activity-member-principals.ts`
  - Nếu dữ liệu hiện hữu cần thay đổi index/schema, tạo migration có dry-run mặc định, báo cáo bản ghi mâu thuẫn và chỉ thực thi khi có cờ `--execute`; không tự động chạy migration.
- `backend/package.json`
  - Chỉ thêm script dry-run/execute cho migration trên nếu migration thực sự cần thiết sau khi kiểm tra index và dữ liệu hiện hữu.

# 5. Out of Scope

- Xóa cứng lịch sử membership, điểm danh, kết quả hoạt động hoặc dữ liệu học tập liên quan.
- Thay đổi quy tắc chuyển câu lạc bộ, số lượt tự chuyển, tính điểm, hoàn thành hoạt động hoặc lịch hoạt động ngoài phần cần thiết để nhận diện principal.
- Thay đổi vai trò hệ thống, quyền Admin toàn cục, đăng nhập, JWT hoặc tạo hồ sơ sinh viên cho Admin.
- Thiết kế lại toàn bộ `ConfirmModal`, `FloatingActionBar`, bảng dữ liệu hoặc các tab khác.
- Sửa nội dung tiếng Việt, mojibake hoặc format/line ending hàng loạt ngoài các dòng nằm trong Scope.
- Chạy migration trên development, staging hoặc production; deploy, release, merge hoặc publish.
- Sửa các thay đổi đang có của người dùng trong `frontend/src/app/(dashboard)/activities/page.tsx` và `frontend/src/components/activities/ActivityForm.tsx`.

# 6. Context & Dependencies

- Ảnh lỗi cho thấy backdrop/modal chỉ phủ trong vùng bảng thay vì viewport; `ActivityMemberTable` hiện đặt `ConfirmModal` bên trong container có `overflow-hidden` và hiệu ứng backdrop.
- `ConfirmModal` hiện gọi `onConfirm()` rồi gọi `onClose()` ngay lập tức, không chờ Promise của thao tác xóa.
- `activities.service.ts::removeMember` hiện soft-delete bằng `status: 'left'`; `getMembers` hiện không loại `left` khi không truyền filter nên bản ghi vẫn được trả về tab “Thành viên”.
- `activities.service.ts::getMyActivities` hiện có fallback lấy bản ghi sinh viên đầu tiên khi người dùng là Admin; hành vi này phải bị loại bỏ.
- Schema `ActivityMember` hiện bắt buộc `student_id`, vì vậy cần mô hình principal hỗ trợ trực tiếp `user_id` cho Admin mà vẫn tương thích thành viên sinh viên hiện hữu.
- Giữ soft delete để không phá lịch sử và các liên kết nghiệp vụ; “xóa” trong giao diện nghĩa là rời danh sách thành viên hiện tại, không phải xóa vật lý.
- Frontend dùng Next.js 16, React 19, Vitest 3; backend dùng NestJS 11, Mongoose 9 và Jest 30.
- Các file hiện chứa nội dung tiếng Việt và có dấu hiệu terminal hiển thị mojibake; phải đọc/ghi UTF-8, phân biệt lỗi terminal với lỗi file, bảo toàn BOM và `LF`/`CRLF` hiện có.
- Worktree đã có thay đổi không thuộc task; chỉ sửa các file Scope và không ghi đè phần việc của người dùng.

# 7. Steps

## PLAN

- Kiểm tra encoding/BOM/line endings của mọi file sẽ sửa trước lần ghi đầu tiên.
- Đọc đầy đủ luồng `getMembers`, `joinActivity`, `getMyActivities`, `removeMember`, guard controller, schema/index membership, API client, page detail, `ActivityMemberTable`, `ConfirmModal`, `FloatingActionBar` và các test liên quan.
- Xác nhận các consumer của `student_id` trong activity, schedule, attendance và completion trước khi chốt kiểu principal; nếu cần sửa ngoài Scope thì dừng và xin mở rộng Scope.
- Xác nhận semantics: xóa là soft delete và danh sách mặc định chỉ gồm membership chưa `left`.
- Xác nhận không cần migration hoặc lập diff/index plan và Human Gate trước khi thực thi migration.

## EXECUTE

- `backend/src/activities/schemas/activity-member.schema.ts`: thêm định danh `user_id` cho Admin, validation đúng một principal và index uniqueness phù hợp; kết quả mong đợi là Admin có membership độc lập, không mượn `student_id`.
- `backend/src/activities/activities.service.ts`: chuẩn hóa principal, bỏ fallback sinh viên bất kỳ, lọc membership `left`, làm xóa đơn/xóa nhiều idempotent; kết quả mong đợi là dữ liệu trả về và trạng thái UI nhất quán.
- `backend/src/activities/dto/activity-member.dto.ts` và `backend/src/activities/activities.controller.ts`: thêm hợp đồng batch delete được validate và bảo vệ; kết quả mong đợi là chỉ người có quyền quản lý mới xóa được danh sách ID thuộc hoạt động.
- `frontend/src/api/activity-api.ts` và page detail: gọi hợp đồng mới, cập nhật/tải lại state đúng một lần và nhận diện membership Admin theo `user_id`; kết quả mong đợi là xóa xong hàng biến mất và Admin có trạng thái tham gia thực.
- `frontend/src/components/modals/ConfirmModal.tsx`: portal modal ra `document.body`, chờ callback xác nhận và khóa thao tác trong lúc pending; kết quả mong đợi là modal phủ viewport, không bị cắt và không gửi lặp.
- `frontend/src/components/activities/ActivityMemberTable.tsx`: thêm selection, select-all, `FloatingActionBar` và xác nhận batch; kết quả mong đợi là thanh chỉ xuất hiện khi có lựa chọn và phản ánh đúng số lượng.
- Các file test trong Scope: thêm regression/unit/integration test tương ứng trước hoặc cùng thay đổi mã.
- Chỉ tạo migration/script package nếu index hoặc dữ liệu hiện hữu yêu cầu; dry-run phải là mặc định.

## VERIFY

- Chạy test frontend tập trung cho bảng thành viên, page detail và API.
- Chạy typecheck frontend.
- Chạy test backend tập trung cho activities service/controller.
- Chạy build backend.
- Kiểm tra diff cuối, danh sách file thay đổi, encoding/BOM/line endings và không có `U+FFFD` mới.
- Thực hiện kiểm tra giao diện thủ công ở desktop và mobile: modal phủ viewport, checkbox/select-all đúng, `FloatingActionBar` không che thao tác và hàng biến mất sau xóa.
- Kiểm tra hai tài khoản: sinh viên tham gia như cũ; Admin không có `studentId` tham gia bằng chính `user_id` và không tác động membership sinh viên khác.

## REFINE

- Nếu modal còn bị cắt, xác định ancestor/stacking context cụ thể và chỉ điều chỉnh portal/z-index/overflow cần thiết.
- Nếu hàng đã xóa còn xuất hiện, kiểm tra response `getMembers`, filter `left` và thứ tự hoàn tất reload; sửa lớp nhỏ nhất gây sai lệch.
- Nếu batch có lỗi một phần, giữ chọn các ID thất bại, bỏ các ID thành công và hiển thị tổng hợp kết quả; không gửi lại ID thành công.
- Nếu Admin vẫn cần `student_id` ở consumer ngoài Scope, dừng để báo đường dẫn/symbol cụ thể và xin mở rộng Scope thay vì tạo hồ sơ sinh viên giả.
- Chạy lại verification bị ảnh hưởng trước; dừng ngay khi tất cả tiêu chí đạt hoặc khi chạm Human Gate/giới hạn vòng lặp.

# 8. Acceptance Criteria

1. Nhấn xóa một thành viên mở đúng một modal/backdrop phủ toàn viewport ở desktop và mobile; modal không bị giới hạn trong chiều cao/rộng của bảng.
2. Xác nhận xóa chỉ gửi một request, khóa nút trong lúc pending, chỉ đóng sau khi hoàn tất và hiển thị lỗi mà không báo thành công giả.
3. Sau xóa thành công, hàng tương ứng biến mất khỏi tab “Thành viên” mà không cần refresh trình duyệt; tải lại trang vẫn không hiển thị membership có `status: left`.
4. Dữ liệu membership được soft delete với `status: left` và `left_at`; không xóa cứng dữ liệu lịch sử hoặc dữ liệu liên quan.
5. Checkbox từng hàng và checkbox chọn tất cả có trạng thái checked/indeterminate đúng; lựa chọn được dọn khi dữ liệu thay đổi.
6. `FloatingActionBar` chỉ mở khi `selectedCount > 0`, hiển thị đúng số thành viên, hỗ trợ hủy chọn và mở xác nhận xóa nhiều.
7. Xóa nhiều xử lý mỗi ID tối đa một lần, reload danh sách tối đa một lần sau batch, loại các ID thành công và giữ/ghi rõ các ID thất bại để người dùng thử lại.
8. Endpoint batch delete từ chối payload rỗng/sai ID/trùng ID theo DTO và không cho thao tác với membership thuộc hoạt động khác; guard tương đương xóa đơn.
9. Admin không có `studentId` có thể tham gia hoạt động bằng chính `user_id`, nhận role membership mặc định `member`, xuất hiện đúng danh tính trong danh sách và được tìm thấy trong “hoạt động của tôi”.
10. Không còn code path chọn bản ghi sinh viên bất kỳ để đại diện cho Admin; Admin tham gia không tạo, sửa hoặc chiếm membership của sinh viên.
11. Luồng sinh viên hiện hữu, kiểm tra trùng membership, giới hạn thành viên và trạng thái tham gia tiếp tục vượt qua regression tests.
12. Frontend typecheck, các test frontend/backend tập trung và backend build đều exit `0`.
13. Nội dung tiếng Việt hiện hữu còn đúng; không có `U+FFFD` mới, không có diff chỉ do encoding/BOM/line-ending và lỗi render terminal không bị coi là file corruption.
14. Diff cuối chỉ chứa các file Scope thực sự cần thiết và không làm thay đổi hai file dirty ngoài Scope đã nêu.

# 9. Verification Commands

`D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/activities/ActivityMemberTable.test.tsx "src/app/(dashboard)/activities/[activityId]/page.test.tsx" src/api/activity-api.test.ts -> 0; toàn bộ regression test thành viên, xóa đơn/xóa nhiều và Admin membership pass`

`D:\PROJECT\manager_points\frontend :: npm run typecheck -> 0; không có lỗi TypeScript`

`D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/activities/activities.service.spec.ts src/activities/activities.controller.spec.ts -> 0; service/controller activities pass`

`D:\PROJECT\manager_points\backend :: npm run build -> 0; NestJS build thành công`

`D:\PROJECT\manager_points :: git diff --check -> 0; không có whitespace error`

`D:\PROJECT\manager_points :: git status --short -> 0; chỉ các file Scope dự kiến và thay đổi có sẵn của người dùng được liệt kê`

`D:\PROJECT\manager_points :: git diff -- docs/taskscope.md frontend/src/components/activities/ActivityMemberTable.tsx frontend/src/components/modals/ConfirmModal.tsx "frontend/src/app/(dashboard)/activities/[activityId]/page.tsx" frontend/src/api/activity-api.ts backend/src/activities/schemas/activity-member.schema.ts backend/src/activities/dto/activity-member.dto.ts backend/src/activities/activities.controller.ts backend/src/activities/activities.service.ts -> 0; diff khớp Scope, không có thay đổi encoding/line-ending ngoài ý muốn`

# 10. Safety Gates

- Trigger: cần sửa file hoặc consumer ngoài danh sách Scope do chuyển từ student-only sang principal tổng quát. Pause: trước khi sửa file đó. Required approval: người dùng duyệt mở rộng Scope và mức rủi ro cập nhật.
- Trigger: cần áp dụng migration/index vào bất kỳ cơ sở dữ liệu development, staging hoặc production. Pause: trước lệnh `--execute`. Required approval: người dùng duyệt dry-run report, changed-index plan, backup/rollback plan và môi trường đích.
- Trigger: phát hiện bản ghi membership mâu thuẫn (cùng có cả `student_id`/`user_id`, không có principal hoặc trùng unique key) cần sửa/xóa. Pause: trước mutation dữ liệu. Required approval: người dùng duyệt danh sách đã ẩn dữ liệu nhạy cảm và chiến lược xử lý.
- Trigger: yêu cầu xóa cứng membership hoặc dữ liệu liên quan. Pause: trước khi tạo/chạy thao tác destructive. Required approval: người dùng xác nhận phạm vi, backup và rollback; cập nhật risk level.
- Trigger: deploy, release, merge, publish hoặc thay đổi production. Pause: trước hành động. Required approval: Human Gate riêng đúng môi trường và artifact.
- Trigger: bulk encoding conversion. Pause: trước khi ghi. Required approval: người dùng duyệt source/target encoding, phạm vi chính xác và rollback plan.

# 11. Artifacts to Review

- Khi mở rộng Scope: `git diff --name-only` và danh sách path/symbol mới kèm lý do phụ thuộc.
- Trước migration execute: output dry-run của `backend/scripts/migrate-activity-member-principals.ts`, index diff, số lượng bản ghi theo nhóm kết quả, backup và rollback plan; không chứa email hoặc dữ liệu cá nhân thô.
- Trước xóa cứng/destructive data action: truy vấn đếm bản ghi mục tiêu, danh sách collection bị ảnh hưởng, backup artifact và rollback command.
- Trước deploy/release/merge/publish: final diff, kết quả test/build/typecheck, migration status và ảnh QA modal/`FloatingActionBar` trên desktop/mobile.

# 12. Loop_iterations Override

`Loop_iterations: 3 (default, stop early on success)`
