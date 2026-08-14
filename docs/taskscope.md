# Task Identity and Pipeline

- Task: `remove-registration-row-pdf-actions-and-match-reference-pdf`; pipeline: `bug_fix`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `a84150c465403467439a0bff8d80d4437f8028d3`; planning date: `2026-08-14`; environment: development.
- Planning-only authority: tài liệu này chỉ mô tả phạm vi triển khai và kiểm chứng; chưa cho phép sửa mã nguồn, triển khai, hoặc thay đổi dữ liệu.
- Reference PDF: `D:\WORK - OFF\KTX\ĐƠN XIN VÀO KÝ TÚC XÁ (MỚI).pdf`; SHA-256: `B527F4F28AF2A9ACAB4B936C830071DE635FCFF8C1A3CB0EECB641E7CA9FA9AC`.
- UI reference: `C:\Users\hoang\AppData\Local\Temp\codex-clipboard-2ace71c2-5902-4f1e-a9f8-2a51a3c528e0.png`; cặp nút cần bỏ là `Xem trước` và `Xuất PDF` trong thao tác từng dòng.
- Populated-PDF correction references:
  - `C:\Users\hoang\AppData\Local\Temp\codex-clipboard-eecb6dbd-3ffd-45f1-ad1e-d63fd73c4739.png`: khoảng cách dòng không đều và giá trị đang cao hơn baseline của nhãn.
  - `C:\Users\hoang\AppData\Local\Temp\codex-clipboard-5e1bf8ef-a8c3-4dd7-8d2f-e6852db1907b.png`: các đường gạch/dòng dưới slot dữ liệu phải được bỏ.
- Effective Rules Manifest (SHA-256): `safety.md` `6A3F283B835394B1AF1F6380D94CBA260ACBED8A60D3065DD5365BB15806A772`; `global.md` `67806F70A5F89ADF42E3BE88413CC76CC27A02C90FAD0609AE71DE34D046A43F`; operating contract `51F3677C7E44121529CC0A4B17E5667BCBD2147EE63C6F30207C10D5DEB51790`; orchestrator `B782109E896B2FA48A6523358A788A9DB9B81B72F3D8FC66F70019395738D716`; pipeline `0419C072380887F96B37FE4EB48DAE764306F46FB03190B176A43EBCEA3F41F3`.

# Risk Level

- Risk: high. Thay đổi đi qua frontend/backend, tác động mẫu đơn hành chính và ánh xạ dữ liệu cá nhân của HSSV/phụ huynh.
- Mã nguồn có thể hoàn tác bằng Git; không có migration, thay đổi schema, ghi PDF lâu dài, thay đổi quyền, hoặc thay đổi trạng thái đăng ký.
- Yêu cầu “giống mẫu 100%” bắt buộc có kiểm tra render trực quan toàn trang; assertion HTML hoặc text đơn thuần không đủ.

# Objective

Loại bỏ đúng hai nút theo từng dòng `Xem trước` và `Xuất PDF` khỏi tab registrations, đồng thời tạo PDF đơn KTX một trang bám mẫu PDF được cung cấp, nhưng áp dụng ba hiệu chỉnh rõ ràng từ ảnh mới: nhịp dòng đồng đều, giá trị cùng baseline với nhãn, và slot dữ liệu chỉ giữ khoảng trống cố định không có đường gạch/dòng chấm. Dữ liệu thiếu để trống mà không làm dịch chuyển bố cục.

# Scope Boundaries

- Frontend và test tập trung:
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`
- Backend template/mapping PDF và test tập trung:
  - `backend/src/dormitory/services/registrations.service.ts`
  - `backend/src/dormitory/services/registrations.service.spec.ts`
- PDF mẫu quyết định nội dung, font, kích thước trang, khung ảnh và vùng chữ ký; giữ nguyên file mẫu. Ba hiệu chỉnh trực quan trong ảnh mới có độ ưu tiên cao hơn mẫu đối với nhịp dòng, baseline dữ liệu và việc bỏ đường kẻ của slot nhập liệu.
- Bỏ cặp nút trong cell `Thao tác` của từng dòng và các JSX/nhánh quyền chỉ phục vụ cặp nút đó. Giữ nguyên Sửa, Xóa và Xếp phòng.
- Giữ endpoint PDF, API client, luồng PDF khi chọn đúng một dòng qua `FloatingActionBar`, dialog xem trước và nút tải trong dialog. Nếu sau khi bỏ cặp nút có helper/state thực sự không còn được dùng, chỉ xóa phần đã được chứng minh là dead code.

# Out of Scope

- Xóa toàn bộ khả năng tạo PDF, xóa endpoint `GET /dormitory/registrations/:id/application-pdf`, thay đổi `DORM_REG_READ`, source lookup `FORMAL|PUBLIC|ADMIN_TEMPORARY`, tên file hoặc `Content-Disposition`.
- Đổi thiết kế bảng, `FloatingActionBar`, dialog, thao tác Sửa/Xóa/Xếp phòng, form đăng ký, schema/DTO, phân phòng, hợp đồng hoặc xuất Excel.
- Thêm thư viện PDF/font, lưu PDF, gộp PDF, migration, triển khai, xử lý dữ liệu thật hoặc sao chép PDF mẫu vào artifact chạy production.
- Sáng tạo nội dung, logo, trường dữ liệu hoặc placeholder không có trong mẫu; xóa gạch chân tiêu ngữ hoặc viền khung ảnh (không phải đường kẻ của slot dữ liệu).

# Context and Dependencies

- PDF mẫu được tạo bởi Microsoft Word 2019, PDF 1.7, không mã hóa, không JavaScript/AcroForm, gồm đúng 1 trang A4 dọc (`595.32 x 842.04 pt`).
- Render 144 DPI xác nhận: quốc hiệu và tiêu ngữ căn giữa; tiêu đề `ĐƠN XIN VÀO KÝ TÚC XÁ`; dòng kính gửi; khung ảnh đứng bên trái; năm dòng thông tin đầu nằm bên phải khung; địa chỉ thường trú HSSV và các dòng cha/mẹ chạy toàn chiều rộng; đoạn cam kết; hai cột chữ ký ở cuối nội dung.
- Mẫu dùng Times New Roman, chữ đen trên nền trắng; tiêu đề/quốc hiệu và `NGƯỜI LÀM ĐƠN` in đậm; ghi chú chữ ký người làm đơn in nghiêng. Theo hiệu chỉnh mới, mọi slot dữ liệu trong phần HSSV, cha/mẹ và ưu tiên phải bỏ đường chấm/gạch nhưng vẫn giữ chiều rộng để các nhãn và giá trị sau đó không dịch chuyển.
- Template hiện tại đã có khung ảnh và grid hai cột. CSS hiện dùng `.details/.detail-row { line-height/height: 1.75 }` và `.field { min-height: 1.25em; padding; border-bottom; vertical-align: baseline; overflow: hidden }`. Tổ hợp inline-block/min-height/overflow làm baseline của giá trị cao hơn nhãn và đường kẻ bị chia đoạn quanh text; đây là nguyên nhân trực tiếp cần sửa và có regression test.
- Nhịp dòng phải được đo theo baseline-to-baseline trong từng nhóm. Các khoảng cách chủ ý giữa quốc hiệu, tiêu đề, kính gửi, grid HSSV, phần cha/mẹ, cam kết và chữ ký được giữ riêng, không bị ép bằng khoảng cách của dòng dữ liệu.
- PDF hiện được dựng bằng HTML/CSS và Puppeteer; `applicationViewModel`, escaping, chờ font, retry TargetClose và cleanup đã có test hồi quy, phải được bảo toàn.
- Frontend hiện có cặp nút theo dòng tại column `actions`; ngoài ra còn có hành động PDF sau khi chọn một dòng và dialog. Hai nhóm sau không phải hai nút trong ảnh và được giữ nguyên.

# Steps

1. Băm và render PDF mẫu cùng hai ảnh correction ở DPI cố định; lập fidelity contract gồm page box, crop/content bounds, font roles, baseline, khung ảnh, wrapping, signature columns, whitespace và ba override mới.
2. Cập nhật frontend test để yêu cầu cell thao tác không chứa nút/accessible name/title `Xem trước đơn…` hoặc `Xuất PDF đơn…`, trong khi Sửa/Xóa/Xếp phòng và luồng PDF theo dòng đã chọn vẫn còn.
3. Bỏ cặp nút theo dòng khỏi `page.tsx`; dọn fragment/điều kiện/import/helper chỉ khi không còn consumer, không thay đổi quyền hoặc handler của luồng PDF được giữ lại.
4. Bổ sung backend regression tests cho wording/order, HTML escaping, blank values, khung ảnh, hình học A4, chữ ký hai cột, absence của field underline/border và nội dung không có trong mẫu. Test phải phân biệt field underline với gạch chân tiêu ngữ/viền khung ảnh được giữ lại.
5. Điều chỉnh `applicationHtml` theo fidelity contract bằng số đo cố định: dùng một cơ chế row-height/line-height nhất quán cho các dòng dữ liệu; loại bỏ `border-bottom` và các dash/dot giả khỏi `.field`; giữ fixed width của từng slot; loại bỏ hoặc thay các thuộc tính inline-block/min-height/overflow gây sai baseline.
6. Căn text động cùng typographic baseline với label cùng dòng, không căn theo đỉnh hoặc đáy của hộp slot. Giá trị phải bắt đầu trong khoảng trống ngay sau nhãn; field trống vẫn chiếm đúng chiều rộng nhưng không để lại đường nhìn thấy.
7. Ánh xạ chỉ các dữ liệu hiện có vào đúng slot. Giá trị thiếu/sai để trống; giá trị dài phải có quy tắc fit/clip/wrap được kiểm chứng và không làm đổi một trang hoặc xô lệch vùng chữ ký.
8. Sinh PDF từ fixture trống/tối đa thiếu, đầy đủ, dữ liệu dài và ký tự HTML cho cả ba source; rasterize cùng DPI, đo baseline/row gap, tạo overlay/pixel diff và sửa sai lệch trong giới hạn vòng lặp.
9. Chạy test/build/typecheck tập trung, kiểm tra trực quan desktop/mobile cho bảng, rồi rà soát diff/status cuối.

# Acceptance Criteria

- AC1: Mỗi dòng registrations không còn hai nút `Xem trước` và `Xuất PDF`, kể cả accessible name/title tương ứng; cell vẫn hiển thị đúng các thao tác Sửa/Xóa/Xếp phòng theo quyền hiện có.
- AC2: Chọn đúng một dòng vẫn mở được luồng PDF qua `FloatingActionBar`; dialog xem trước, retry, đóng, tải PDF, loading/error và thu hồi object URL vẫn hoạt động.
- AC3: PDF kết quả luôn là đúng 1 trang A4 dọc, không bị cắt, tràn, chồng chữ, lỗi dấu tiếng Việt hoặc trang trắng.
- AC4: Toàn bộ text tĩnh trùng mẫu về wording, thứ tự, dấu câu, viết hoa và dấu tiếng Việt; không xuất hiện nội dung ngoài mẫu hoặc `undefined`, `null`, `Invalid Date`.
- AC5: Mọi dòng dữ liệu trong cùng một section có khoảng cách baseline-to-baseline đồng đều (sai số tối đa 1 px ở 144 DPI); không còn khoảng nhảy bất thường như giữa `Lớp` và `Dân tộc`. Khoảng cách section chủ ý vẫn bám fidelity contract.
- AC6: Giá trị động và nhãn trên cùng dòng dùng chung typographic baseline (sai số tối đa 1 px ở 144 DPI); họ tên, ngày sinh, giới tính, điện thoại và các field khác không còn nằm cao hơn nhãn như ảnh lỗi.
- AC7: Không có `border-bottom`, dotted/dashed rule, chuỗi dash hoặc đường gạch nhìn thấy dưới bất kỳ slot dữ liệu nào. Slot trống vẫn giữ fixed width; gạch chân tiêu ngữ và viền khung ảnh vẫn hiện đúng.
- AC8: Với form có dữ liệu, text tĩnh, slot width, wrapping, khung ảnh, commitment và vùng chữ ký không dịch chuyển; thay đổi so với PDF mẫu chỉ gồm giá trị được điền và ba correction đã phê duyệt.
- AC9: Dữ liệu đầy đủ/thiếu của `FORMAL`, `PUBLIC`, `ADMIN_TEMPORARY` đều tạo được PDF đọc được; giá trị được escape và điền đúng slot, giá trị thiếu giữ nguyên hình học khoảng trống.
- AC10: Source lookup, permission, safe filename, response headers, font-ready wait, TargetClose retry và cleanup regressions vẫn pass.
- AC11: PDF mẫu giữ nguyên SHA-256; final diff chỉ có bốn file implementation/test đã nêu và `docs/taskscope.md`, không có thay đổi ngoài phạm vi.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => AC1-AC2 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => thay đổi JSX/dead-code cleanup không tạo lỗi type.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/registrations.service.spec.ts` => AC3-AC4 và AC7, AC9-AC10 pass; active template không còn field underline/border và vẫn giữ motto underline/photo border.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => template/mapping PDF compile thành công.
- Repository root :: `rg -n -S "aria-label=\{`Xem trước đơn|aria-label=\{`Xuất PDF đơn|title=\"Xem trước đơn\"" "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx"` => không có match; `openSelectedPdfPreview` và PDF dialog vẫn có match.
- Visual fidelity harness :: render fixture trống/đầy đủ ở 144 DPI, đo tọa độ baseline và khoảng cách các row => AC5-AC8 pass; overlay với PDF mẫu chỉ có các deviation thuộc ba correction mới và slot dữ liệu.
- Manual UI :: desktop và mobile, có/không có từng quyền => cặp nút theo dòng biến mất; các action còn lại, selection, focus, loading/error/retry/download hoạt động đúng.
- Repository root :: `(Get-FileHash -Algorithm SHA256 -LiteralPath 'D:\WORK - OFF\KTX\ĐƠN XIN VÀO KÝ TÚC XÁ (MỚI).pdf').Hash` => `B527F4F28AF2A9ACAB4B936C830071DE635FCFF8C1A3CB0EECB641E7CA9FA9AC`.
- Repository root :: `git diff --check` và `git status --short` => AC11 pass.

# Safety Gates

- Không cần Human Gate cho sửa mã nguồn cục bộ, fixture tổng hợp và so sánh hình ảnh cục bộ trong phạm vi này.
- Fidelity Gate F1: không được tuyên bố hoàn tất nếu chưa render và kiểm tra trực quan trang PDF mới nhất; text test/HTML test không thay thế gate này.
- Cần phê duyệt mới trước deployment, truy cập dữ liệu HSSV/phụ huynh thật, cài font/runtime hệ thống, thêm dependency, thay đổi quyền hoặc persistent data.
- Dừng và sửa taskscope nếu fidelity yêu cầu thay endpoint/public contract, thêm trường dữ liệu, nhúng file mẫu vào production hoặc vượt quá các write boundaries.

# Artifacts and Checkpoints

- Fidelity contract: PDF hash/metadata, renderer/version/DPI, page bounds, content bounds, font roles, row-gap/baseline coordinates, khung ảnh, signature geometry, slot widths và ba correction override.
- Data-slot matrix: label mẫu → view-model key → ba source → formatter → blank/overflow rule.
- Fixture: trống/tối đa thiếu, đầy đủ cho ba source, chuỗi dài tiếng Việt, ngày/enum sai và text giống HTML.
- Visual artifacts: reference PNG, generated PNG, overlay, pixel diff và deviation report; không commit artifact QA trừ khi được yêu cầu.
- Checkpoint sau frontend regression, backend content contract, blank-form overlay, source/edge-case matrix và final diff review.

# Execution Budgets

- Dependency order: lock reference → frontend regression/removal → backend regression/template → focused checks → visual diff loop → final review.
- Một writer trên mỗi path; deadline mỗi bước `1200s`; retry tooling `2`; engineering loop `3`; visual remediation `5`; review remediation `2`; không tự tạo/switch branch hoặc worktree.
- Nếu F1 chưa đạt sau budget, báo `partially completed`/`blocked`; không hạ chuẩn “100% giống mẫu”.
