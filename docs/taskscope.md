# Task scope: giảm thời gian chuyển trang, thời gian compile và CPU Docker

## 1. Bối cảnh

Khi chạy môi trường development bằng Docker, lần đầu mở một route thường mất nhiều giây để Next.js biên dịch. Trong thời gian đó CPU của container frontend tăng mạnh, bộ nhớ tăng và Docker ghi nhiều dữ liệu vào cache `.next`. Sau khi route đã được làm nóng, cùng route phản hồi nhanh hơn rõ rệt.

Kết quả đo hiện tại:

| Hạng mục | Lần đầu (cold) | Lần sau (warm) |
|---|---:|---:|
| `/students/record` | khoảng 15,9 giây | khoảng 0,24–0,31 giây |
| `/activities` | khoảng 25,1 giây | dưới 1 giây sau khi đã compile |
| `/reports` | khoảng 18,4 giây | dưới 1 giây sau khi đã compile |
| `/permissions` | khoảng 7,8 giây | khoảng 0,27 giây |

Trong phép đo `/students/record`, khoảng 14,6/15,9 giây thuộc về Next.js; phần code ứng dụng khoảng 0,96 giây. CPU frontend từng đạt khoảng 394–593% theo cách Docker tính trên nhiều core. Máy phát triển có 8 GB RAM, Docker được cấp khoảng 3,8 GB và hệ điều hành đã sử dụng swap đáng kể. Đây là bằng chứng cho thấy nguyên nhân chính là cold compile và áp lực tài nguyên, không phải thời gian gọi API.

Các yếu tố làm vấn đề nặng hơn:

- Frontend chạy `next dev --turbopack` trong container, đồng thời source được bind mount từ macOS vào `/app`.
- Cache `/app/.next` đã ở mức khoảng 840 MB và Turbopack có lần mất hơn 10 giây để ghi filesystem cache.
- Một số page/component quá lớn, ví dụ `students/record/page.tsx` hơn 5.000 dòng, `grading/score/page.tsx` gần 4.000 dòng và `ActivityScheduleWorkspace.tsx` hơn 3.000 dòng.
- Các thư viện nặng như XLSX, PDF, sơ đồ và animation có thể đi vào static import graph của route.
- `manifest.ts` đang dùng `force-dynamic` và `cache: 'no-store'`, khiến manifest phải gọi backend lặp lại.
- NestJS chạy watch trong container, chiếm thêm RAM/CPU và cạnh tranh tài nguyên với Next.js.

## 2. Mục tiêu

1. Giảm thời gian cold compile và thời gian chờ khi chuyển sang route chưa được compile.
2. Giảm CPU, RAM và filesystem I/O của Docker trong quá trình phát triển.
3. Cung cấp luồng development ưu tiên chạy Node.js trực tiếp trên máy host, trong khi MongoDB và Redis vẫn chạy bằng Docker.
4. Giảm kích thước import graph của các route nặng mà không thay đổi hành vi nghiệp vụ.
5. Có số đo trước/sau lặp lại được để xác nhận hiệu quả và ngăn regression.

## 3. Chỉ số thành công

Đo trên cùng một máy, sau khi khởi động sạch môi trường development và truy cập cùng tập route.

| Chỉ số | Baseline tham chiếu | Mục tiêu |
|---|---:|---:|
| Cold load `/students/record` | ~15,9 giây | <= 6 giây |
| Cold load `/activities` | ~25,1 giây | <= 8 giây |
| Cold load `/permissions` | ~7,8 giây | <= 4 giây |
| Warm navigation của route đã compile | ~0,24–1 giây | <= 1 giây |
| CPU frontend khi cold compile | peak ~394–593% | giảm ít nhất 30% so với baseline cùng máy |
| Thời gian ghi Turbopack filesystem cache | có lần >10 giây | không còn là phần chi phối thời gian chuyển trang |

Các ngưỡng cold load là mục tiêu development, không phải SLA production. Nếu sai số giữa các lần đo lớn hơn 20%, lấy trung vị của ít nhất 3 lần chạy.

## 4. Phạm vi thực hiện

### Giai đoạn 0 — Tạo phép đo chuẩn

- Thêm script benchmark development có khả năng:
  - ghi thời gian khởi động frontend và backend;
  - gọi tuần tự các route đại diện: `/`, `/students/record`, `/activities`, `/reports`, `/permissions`, `/system`;
  - tách kết quả cold và warm;
  - ghi lại `docker stats`, kích thước `.next` và log compile tại các mốc tương ứng;
  - xuất báo cáo dạng Markdown hoặc JSON để so sánh trước/sau.
- Ghi rõ điều kiện đo: cấu hình máy, lượng RAM cấp cho Docker, trạng thái cache, commit và lệnh khởi động.
- Không dùng một lần đo duy nhất để kết luận.

**Đầu ra:** script benchmark, hướng dẫn chạy và báo cáo baseline được lưu trong `docs/performance/`.

### Giai đoạn 1 — Tách luồng development khỏi Docker bind mount

- Bổ sung một cấu hình Compose chỉ khởi động hạ tầng cần thiết: MongoDB và Redis. Có thể thực hiện bằng file Compose riêng hoặc profile rõ tên; không làm thay đổi lệnh production hiện có.
- Bổ sung cấu hình và tài liệu để chạy:
  - frontend trực tiếp trên host tại cổng `3000`;
  - backend trực tiếp trên host tại cổng `8001`;
  - MongoDB tại `mongodb://localhost:27017/manager-point`;
  - Redis tại `localhost:6379`;
  - `NEXT_PUBLIC_API_URL=http://localhost:8001` và `FRONTEND_URL=http://localhost:3000`.
- Thêm script cấp repository hoặc tài liệu lệnh chuẩn để người phát triển không phải tự ghép lệnh.
- Giữ luồng full-Docker hiện tại làm phương án tương thích/CI, nhưng đánh dấu luồng host Node + Docker infrastructure là luồng development khuyến nghị trên macOS.
- Bảo đảm biến môi trường bí mật tiếp tục lấy từ `.env`, không hard-code vào Compose hoặc script.

**File dự kiến:** `docker-compose.yml`, một file Compose development/infra phù hợp, `frontend/package.json`, `backend/package.json`, tài liệu README liên quan và file `.env.example` nếu dự án đang sử dụng.

### Giai đoạn 2 — Giảm import graph của frontend

Ưu tiên xử lý theo số đo, bắt đầu từ các route có cold compile lâu và file lớn nhất:

1. `frontend/src/app/(dashboard)/students/record/page.tsx`.
2. `frontend/src/app/(dashboard)/grading/score/page.tsx`.
3. `frontend/src/components/activities/ActivityScheduleWorkspace.tsx` và route `/activities` liên quan.
4. `frontend/src/app/(dashboard)/permissions/page.tsx`.
5. `frontend/src/app/(dashboard)/system/page.tsx`.

Với từng route:

- Tách page lớn thành các module theo trách nhiệm: data hook, bảng/danh sách, bộ lọc, form, modal/drawer và tiện ích thuần.
- Chỉ dùng `dynamic import` cho phần không cần ở lần render đầu, ví dụ modal import dữ liệu, PDF viewer/export, biểu đồ/sơ đồ, editor và các popup nặng.
- Chuyển `xlsx`, `pdfjs-dist`, `html-to-image`, `@xyflow/react`, `dagre` và thư viện tương tự sang import theo hành động người dùng khi có thể.
- Không lazy-load phần giao diện cốt lõi gây layout shift hoặc làm chậm thao tác đầu tiên.
- Giữ nguyên API contract, quyền truy cập, validation, trạng thái loading/error và hành vi responsive.
- Không chỉ “chuyển code sang file khác”: một module vẫn bị static import thì vẫn nằm trong graph compile của route. Mỗi lần tách phải được xác nhận bằng benchmark hoặc phân tích bundle/import graph.
- Bổ sung test cho logic được tách khỏi page và cập nhật test UI liên quan.

Mỗi route là một thay đổi độc lập, được benchmark và nghiệm thu trước khi chuyển sang route kế tiếp. Không refactor đồng thời toàn bộ frontend trong một pull request.

### Giai đoạn 3 — Cache manifest và branding

- Thay `dynamic = 'force-dynamic'` và `cache: 'no-store'` trong `frontend/src/app/manifest.ts` bằng chiến lược cache/revalidate phù hợp.
- Branding không cần thay đổi tức thời theo từng request; sử dụng TTL hoặc cơ chế invalidation có chủ đích.
- Khi backend không sẵn sàng, tiếp tục trả manifest mặc định hợp lệ như hiện tại.
- Xác nhận việc cập nhật tên/icon thương hiệu vẫn xuất hiện trong thời gian đã cam kết.
- Bổ sung test cho trường hợp API thành công, API lỗi và dữ liệu branding được cache/revalidate.

**Giả định để triển khai:** TTL mặc định 5 phút. Nếu nghiệp vụ yêu cầu branding cập nhật tức thời, phải chốt cơ chế invalidation trước khi sửa.

### Giai đoạn 4 — Giảm tải backend development

- Đo riêng thời gian NestJS khởi động, thời gian rebuild sau khi sửa một file và mức RAM/CPU khi idle.
- Kiểm tra phạm vi watch để loại trừ `dist`, log, upload, coverage và các thư mục sinh tự động nếu đang bị theo dõi.
- Kiểm tra cấu hình TypeScript/Nest compiler và chỉ thay đổi compiler khi benchmark chứng minh có lợi, source map và decorator metadata vẫn đúng.
- Không chạy monitoring stack mặc định trong luồng development thông thường.
- Rà soát các cron chạy mỗi phút và heartbeat/SSE trong môi trường development; chỉ vô hiệu hóa hoặc giảm tần suất khi có biến môi trường rõ ràng và không làm sai môi trường production.
- Giữ giới hạn heap có chủ đích; không coi việc tăng heap là giải pháp chính cho compile chậm.

### Giai đoạn 5 — Kiểm chứng production

- Chạy `npm run build` và `npm run start` cho frontend để đo trải nghiệm không có on-demand compilation.
- Xác nhận các route chính hoạt động trong production build, không có lỗi hydration, dynamic import hoặc biến môi trường.
- So sánh production với development để phân biệt chi phí compile của công cụ và thời gian thực thi ứng dụng.
- Không dùng `docker-compose.prod.yml` như lệnh dev nhanh vì file này phụ thuộc image registry, secret và cấu hình triển khai production.

## 5. Ngoài phạm vi

- Không thay đổi nghiệp vụ, giao diện hoặc API chỉ để đạt số benchmark.
- Không nâng cấp Next.js, React, NestJS hoặc thay bundler trong scope đầu tiên. Việc so sánh Turbopack với Webpack chỉ được thực hiện như một thử nghiệm có số đo; đổi mặc định cần task riêng.
- Không xóa Docker volume, database hoặc cache của người phát triển bằng script tự động.
- Không tăng RAM/CPU Docker như giải pháp duy nhất.
- Không tối ưu MongoDB query hoặc endpoint khi chưa có trace chứng minh API là bottleneck của route tương ứng.
- Không triển khai production hoặc thay đổi pipeline CI/CD trong task này, ngoài việc bảo đảm cấu hình mới không làm hỏng các luồng đó.

## 6. Thứ tự triển khai đề xuất

1. Giai đoạn 0: khóa baseline và công cụ đo.
2. Giai đoạn 1: tạo luồng host Node + Docker infrastructure; đo lại ngay để xác định phần cải thiện từ filesystem/watch.
3. Giai đoạn 3: cache manifest vì thay đổi nhỏ, rủi ro thấp và loại bỏ request động lặp lại.
4. Giai đoạn 2: tối ưu từng route theo thứ tự tác động đo được.
5. Giai đoạn 4: tối ưu backend watcher nếu vẫn còn áp lực tài nguyên.
6. Giai đoạn 5: chạy build, regression test và lập báo cáo cuối.

## 7. Kiểm thử và xác minh

### Frontend

Từ thư mục `frontend`:

```bash
npm run typecheck
npm test
npm run build
```

Chạy test tập trung cho từng component/page đã sửa trong quá trình phát triển. Script `lint` hiện dùng `next lint`; cần xác nhận tương thích với phiên bản Next.js hiện tại trước khi đưa lint vào cổng bắt buộc.

### Backend

Từ thư mục `backend`:

```bash
npm run build
npm test -- --runInBand
```

Nếu thay đổi cấu hình scheduler, SSE hoặc bootstrap, chạy thêm test tích hợp/e2e liên quan.

### Hiệu năng

- Chạy benchmark ít nhất 3 lần cho baseline và 3 lần sau thay đổi.
- Đo cả cold cache và warm cache.
- Không chạy ứng dụng nặng khác trong lúc benchmark.
- Lưu trung vị, min/max, CPU peak, memory peak và kích thước `.next`.
- Nếu một thay đổi không cải thiện chỉ số mục tiêu hoặc làm regression chức năng, hoàn tác riêng thay đổi đó thay vì gộp vào kết quả chung.

## 8. Tiêu chí nghiệm thu

1. Có tài liệu và lệnh chuẩn để chạy MongoDB/Redis bằng Docker, frontend/backend trực tiếp trên macOS.
2. Full-Docker development hiện tại vẫn sử dụng được và production Compose không bị thay đổi hành vi ngoài ý muốn.
3. Các route mục tiêu đạt ngưỡng ở mục **Chỉ số thành công**, hoặc báo cáo nêu rõ bằng số liệu bottleneck còn lại và scope tiếp theo.
4. Warm navigation không chậm hơn baseline quá 10%.
5. Manifest không còn gọi branding API ở mọi request nhưng vẫn có fallback hợp lệ và cập nhật trong TTL đã chốt.
6. Các thư viện nặng không cần cho initial render được tải theo nhu cầu ở các route đã tối ưu.
7. Frontend typecheck, test, production build và backend build/test vượt qua trong phạm vi thay đổi.
8. Không có thay đổi nghiệp vụ, quyền truy cập, dữ liệu hoặc API contract.
9. Báo cáo cuối chứa số đo trước/sau, cấu hình máy, cách tái hiện và các vấn đề còn lại.

## 9. Rủi ro và phương án kiểm soát

| Rủi ro | Kiểm soát |
|---|---|
| Khác biệt biến môi trường giữa host và Docker | Cung cấp `.env.example`, kiểm tra kết nối khi khởi động và ghi rõ URL host/container |
| Dynamic import làm lỗi SSR hoặc hydration | Chỉ tắt SSR khi component thực sự phụ thuộc browser API; có test và production build |
| Tách page lớn gây regression nghiệp vụ | Chia theo route, PR nhỏ, giữ test hành vi và so sánh UI trước/sau |
| Cache branding làm cập nhật chậm | TTL 5 phút hoặc invalidation rõ ràng; ghi nhận kỳ vọng nghiệp vụ |
| Benchmark không ổn định do swap/cache | Chạy nhiều lần trên cùng điều kiện và dùng trung vị |
| Dọn cache làm mất dữ liệu hoặc che nguyên nhân | Không tự động xóa volume/cache; thao tác thủ công phải được người dùng xác nhận |

## 10. Definition of Done

Task hoàn thành khi toàn bộ tiêu chí nghiệm thu được đáp ứng, báo cáo benchmark trước/sau đã được lưu, hướng dẫn development mới có thể được một thành viên khác làm theo từ đầu, và không còn thay đổi chưa được kiểm chứng bằng test hoặc số đo.
