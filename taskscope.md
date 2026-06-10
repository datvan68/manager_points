# Taskscope: Khắc phục task không tự đổi trạng thái sau khi student lưu điểm rèn luyện

## 13. Review sau bản sửa mới nhất

### 13.1. Các mục đã được xử lý đúng ở bản mới

- `frontend/src/lib/task-linked-page.ts` đã sửa rule nhận diện auto-sync:
  - Đã có `isAutoEventPath(path)`.
  - Không còn dùng `startsWith(page)` trực tiếp.
  - Route như `/grading/scoreboard` hoặc `/students/recording` sẽ không bị nhận nhầm là auto-sync.
- `frontend/src/api/task-api.ts` đã bổ sung `deletedAt?: string | null` cho `StudentTask`.
- `frontend/src/app/grading/score/page.tsx` đã reset validation state khi `taskId` thay đổi:
  - Có `setIsValidating(true)`.
  - Có `setValidationError(null)`.
  - Guard đã chuyển sang `studentTaskApi.checkTaskAccess(taskId)` thay vì chỉ gọi `getTask`.
- Backend đã có endpoint access riêng:
  - `GET /student-tasks/:id/access`.
  - Endpoint này không yêu cầu `READ_STUDENT_TASK`, chỉ cần JWT rồi service kiểm tra active progress.
- `syncProgressForTask()` đã gọi `recalculateTaskAggregateStatus(taskId)` sau khi tạo/reactivate/inactivate progress.
- Manager quick action đã cascade trạng thái sang active progress bằng `cascadeStatusToActiveProgresses()`.

### 13.2. Vấn đề còn cần sửa/bổ sung

#### 13.2.1. Manager/admin có thể bị chặn khi click task gắn `/grading/score`

- `StudentTasksTab` luôn điều hướng task có linked page bằng `taskId`:

```ts
router.push(`${task.linkedPage}${separator}taskId=${task.id}`);
```

- Nhưng `/grading/score?taskId=...` hiện gọi `checkTaskAccess(taskId)`.
- `checkAccess()` chỉ cho phép khi user hiện tại có progress active:

```ts
const allowed = !!(progress && progress.isActive);
```

- Với manager/admin/supervisor, họ thường là người quản lý task chứ không phải assignee progress, nên khi click card task có linked page sẽ bị màn hình "Truy cập bị từ chối".

Yêu cầu chốt lại rule:

- Flow student/assignee:
  - Giữ `taskId`.
  - Bắt buộc có active progress.
  - Cho phép auto-sync started/completed.
- Flow manager/admin/supervisor:
  - Hoặc cho `checkAccess()` trả `allowed: true` nếu user có quyền quản lý task, nhưng frontend không gửi linked-event cho vai trò này.
  - Hoặc khi manager click card thì điều hướng không kèm `taskId`, ví dụ `/grading/score`, để đi theo quyền `GRADING_PAGE` bình thường.

Khuyến nghị:

- Với manager/admin, card linked page nên mở trang nghiệp vụ ở chế độ quản lý, không kích hoạt task auto-sync cá nhân.
- Chỉ student/teacher assignee mới mở linked page kèm `taskId` để auto-sync tiến độ cá nhân.

#### 13.2.2. `checkAccess()` nên kiểm thêm linked page thuộc auto-sync trước khi trả allowed

- Hiện `checkAccess()` chỉ kiểm task tồn tại và user có active progress.
- Frontend đang kiểm `linkedPage` có phải `/grading/score` hay không, nhưng backend vẫn nên tự bảo vệ endpoint access để tránh dùng nhầm cho task manual/none.

Yêu cầu:

- Normalize `task.linkedPage` trong `checkAccess()`.
- Nếu `linkedPage` rỗng hoặc không thuộc whitelist auto-sync (`/students/record`, `/grading/score`) thì trả `allowed: false` hoặc `BadRequestException`.
- Nếu cần dùng access endpoint cho cả manual task trong tương lai, đổi tên response rõ hơn:

```ts
{
  allowed: boolean;
  mode: 'none' | 'manual' | 'auto';
  linkedPage: string;
  progressId?: string;
}
```

#### 13.2.3. Teacher creator đang lệch giữa service và test

- Test trong `backend/test/student-tasks.e2e-spec.ts` kỳ vọng teacher creator có thể `PATCH /student-tasks/:id/status`.
- Unit test trong `backend/src/student-tasks/student-tasks.service.spec.ts` cũng mô tả teacher creator được update.
- Nhưng code `StudentTasksService.updateStatus()` ở nhánh teacher không có check creator, chỉ check `targetType === 'teacher'` và teacher được assign.

Yêu cầu chọn một rule nghiệp vụ:

- Nếu teacher creator được phép quản lý task mình tạo:
  - Thêm `isCreator = task.createdBy?.toString() === user.userId`.
  - Cho phép khi `isCreator || isAssignedTeacher`.
- Nếu teacher creator không được phép nếu không có `UPDATE_STUDENT_TASK`:
  - Cập nhật lại unit/e2e test và message cho khớp.

Khuyến nghị:

- Teacher creator nên được phép quản lý task mình tạo, nhưng nếu thao tác là status cá nhân thì vẫn phải đi qua progress của chính teacher.
- Với task target student do teacher tạo, teacher creator nên dùng quyền quản lý/cascade, không dùng nhánh assignee cá nhân.

#### 13.2.4. Cascade manager update đang nuốt lỗi và không recalc sau cascade

- `StudentTasksService.updateStatus()` set `task.status = status` trước, sau đó gọi `cascadeStatusToActiveProgresses()` trong `try/catch`.
- Nếu cascade lỗi, code chỉ `console.error` nhưng vẫn return task đã đổi status.
- Điều này có thể làm `task.status` lệch với progress overview.

Yêu cầu:

- Không nuốt lỗi cascade trong flow cập nhật trạng thái tổng hợp.
- Sau cascade, gọi `recalculateTaskAggregateStatus(taskId)` hoặc để `cascadeStatusToActiveProgresses()` tự gọi recalc.
- Nếu task không có active progress, không nên cho manager set aggregate thành `completed`; cần trả lỗi rõ hoặc giữ aggregate theo rule mặc định `not_started`.

Acceptance:

- Cascade lỗi thì API trả lỗi, không báo thành công giả.
- Sau manager quick action, `task.status` phải bằng trạng thái aggregate tính từ active progresses.
- Task có 0 active progress không được hiển thị completed chỉ vì manager bấm quick action.

#### 13.2.5. `cascadeStatusToActiveProgresses()` nên trả thống kê số progress bị ảnh hưởng

- Hiện method không trả kết quả, nên caller không biết có bao nhiêu active progress được update.

Yêu cầu:

```ts
{
  matched: number;
  modified: number;
}
```

- Dùng kết quả này để:
  - Warn/log nếu `matched = 0`.
  - Chặn hoặc xác nhận lại rule với task không có assignee active.

#### 13.2.6. E2E test cũ chưa setup progress nên có thể fail

- `backend/test/student-tasks.e2e-spec.ts` tạo task trực tiếp bằng `studentTaskModel.create()`.
- Nhưng flow mới yêu cầu student update status thông qua `StudentTaskProgress`.
- Test student `PATCH /student-tasks/:id/status` kỳ vọng `200`, nhưng nếu chưa gọi sync/backfill hoặc chưa tạo progress record thì service sẽ trả `403`.

Yêu cầu sửa test:

- Sau khi tạo `testTask`, gọi service `syncProgressForTask(testTask._id.toString())`; hoặc
- Tạo trực tiếp progress record cho assigned student trong setup; hoặc
- Tạo task qua API/service thật để trigger sync.

QA cần có:

- Assigned student có active progress -> PATCH status trả `200`.
- Assigned student nhưng progress inactive -> trả `400`.
- Assigned student nhưng chưa có progress do lỗi sync -> trả `403` với message rõ.
- Unassigned student -> trả `403`.

#### 13.2.7. Khi update task bằng modal, field `status` có thể bị override bởi aggregate

- `UpdateTaskDto` và frontend vẫn có thể gửi `status`.
- `StudentTasksService.update()` cập nhật `task.status`, rồi gọi `syncProgressForTask()`.
- Vì `syncProgressForTask()` đã recalc aggregate, status vừa gửi từ modal có thể bị ghi đè theo progress.

Yêu cầu:

- Nếu `task.status` là aggregate derived từ progress, không cho update trực tiếp qua edit task modal.
- Loại `status` khỏi payload update task thông thường, hoặc route status update phải đi qua progress/cascade rõ ràng.
- UI nên tách:
  - Edit metadata task: title, deadline, priority, linkedPage, target.
  - Update progress/status: qua quick action hoặc tab progress overview.

### 13.3. QA bổ sung cho bản mới

- Student click task `/grading/score?taskId=...`, chỉnh điểm và lưu:
  - Progress cá nhân chuyển `completed`.
  - Aggregate task cập nhật đúng.
- Manager/admin click cùng task:
  - Không bị guard `checkAccess` chặn sai.
  - Không gửi linked-event cá nhân nếu không phải assignee.
- Task manual hoặc no-linked:
  - Không gọi linked-event.
  - Status chỉ đổi qua thao tác thủ công/progress overview.
- Teacher creator:
  - Test rõ creator được phép hay không được phép.
  - Kết quả service, frontend và e2e phải cùng một rule.
- Manager quick action:
  - Cascade thành công cho toàn bộ active progress.
  - Cascade lỗi thì API trả lỗi.
  - Task không có active progress không bị set completed sai.
