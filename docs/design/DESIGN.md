# DESIGN.md — Design System (Minimalist Glassmorphism & Pill Style)

Tài liệu này là **nguồn sự thật duy nhất** về thiết kế hệ thống giao diện. Agent bắt buộc phải đọc file này trước khi viết bất kỳ dòng UI nào. Mọi component, màu sắc, spacing, và hiệu ứng chuyển động đều phải tuân thủ nghiêm ngặt để đảm bảo tính đồng nhất.

---

## 1. Design Philosophy

Sự kết hợp tinh tế giữa **Chủ nghĩa tối giản (Minimalism)** và **Hiệu ứng kính mờ (Glassmorphism)**:

- **Chất liệu kính xuyên thấu:** Sử dụng các lớp nền bán trong suốt (`backdrop-blur`) kết hợp viền trắng/bạc mảnh để giả lập các tấm kính mờ tinh khiết xếp chồng nhẹ trên nền gradient.
- **Cấu trúc hình học tối giản:** Ứng dụng cấu trúc bo tròn tuyệt đối dạng viên thuốc (`rounded-full` / Pill-shaped) từ mẫu `image_764e83.png` cho toàn bộ các thành phần inline, badge, button, và input.
- **Loại bỏ Neomorphism:** Tuyệt đối không dùng bóng đổ đôi dập nổi. Depth (độ sâu) được tạo nên từ độ mờ của kính (`backdrop-blur-md`), viền phản chiếu ánh sáng và bóng đổ đáy cực mịn (`shadow-sm`).
- **Avatar Stacking:** Các phần tử ảnh tròn xếp chồng lấn nhẹ (`-space-x-2.5`) có viền trắng tinh tế tạo điểm nhấn gọn gàng trên nền tối giản.

---

## 2. Color System

Hệ màu công nghệ hiện đại dựa trên bộ ba **Xanh dương, Trắng, và Bạc**:

- `--color-base-bg`: `linear-gradient(135deg, #EBF2FA 0%, #DCE6F1 100%)` (Nền dốc nhẹ màu xanh dương sương mù pha bạc, không dùng màu trắng tinh làm nền trang).
- `--color-glass-surface`: `rgba(255, 255, 255, 0.45)` (Nền bề mặt kính mờ màu trắng đục nhẹ).
- `--color-border-glow`: `rgba(255, 255, 255, 0.75)` (Đường viền trắng bạc mảnh mờ để giữ hiệu ứng khúc xạ ánh sáng cạnh kính).
- `--color-accent-blue`: `#1A73E8` (Xanh dương hoàng gia - chỉ dùng tương tác CTA chính, active state).
- `--color-text-main`: `#1E293B` (Xanh dương đen sẫm mang lại độ tương phản cao nhưng dịu mắt).
- `--color-text-muted`: `#64748B` (Màu xám bạc/slate phục vụ cho các thông tin phụ trợ).

---

## 3. Typography

##### Type Scale

| Token       | Size | Weight | Line-height | Dùng cho                                  |
| :---------- | :--- | :----- | :---------- | :---------------------------------------- |
| display-2xl | 48px | 600    | 1.1         | Chỉ số KPI, Hero number                   |
| display-xl  | 36px | 600    | 1.2         | Tiêu đề chính trang (Page title)          |
| display-lg  | 28px | 500    | 1.3         | Tiêu đề các phân vùng lớn                 |
| heading-md  | 20px | 600    | 1.4         | Tiêu đề thẻ (Card title)                  |
| heading-sm  | 16px | 600    | 1.4         | Tiêu đề khối chức năng con                |
| body-lg     | 15px | 400    | 1.6         | Văn bản nội dung chính                    |
| body-md     | 14px | 600    | 1.5         | Nội dung chữ trong Pill (`Trusted by...`) |
| label-md    | 13px | 500    | 1.4         | Nhãn form nhập liệu, Badge lớn            |
| label-sm    | 11px | 500    | 1.3         | Thẻ tag thông tin, phụ đề nhỏ             |
| mono-md     | 13px | 400    | 1.5         | Định danh, ID, Code khối dữ liệu          |

---

## 4. Spacing & Layout

##### Grid system

- Bố cục lưới phân bố nghiêm ngặt với các khoảng cách tiêu chuẩn hóa: `gap-4` cho cụm tính năng nhỏ và `gap-6` cho layout tổng quan.

##### Border radius

- Mọi Badge, Button, Input, Tag nhỏ: Bắt buộc bo tròn tối đa viên thuốc `rounded-full`.
- Các Khối lớn, Container lớn, Thẻ Dashboard: Bo góc rộng `rounded-3xl` hoặc `rounded-[24px]` để giữ tính nhất quán mềm mại.

---

## 5. Component Library

##### 5.1 Card — Glassmorphic Floating

- Nền kính mờ `bg-white/40`, lớp lọc nhòe phía sau `backdrop-blur-md`, viền sắc nét `border border-white/70`, góc bo `rounded-3xl`. Đổ bóng mờ nhẹ dưới đáy `shadow-sm shadow-slate-300/40`.

##### 5.2 Button

- Form dạng viên thuốc (`rounded-full`). Không sử dụng viền màu tối.
- **State:** Khi Hover, độ mờ nền giảm (`bg-white/70`) hoặc kích hoạt phủ màu accent `bg-accent-blue` kèm text trắng mịn.
- Icon Button: Phải đưa về định dạng tròn trịa `w-10 h-10 rounded-full`, không dùng hình vuông bo góc.

##### 5.3 Input

- Kiểu dáng viên thuốc thuôn dài (`rounded-full`), nền kính mờ dịu mắt, căn lề văn bản đối xứng tinh tế. Khi chọn (focus), bao phủ một lớp vòng viền mỏng màu xanh dương nhạt.

##### 5.4 Badge / Status Tag (Chuẩn mẫu thiết kế image_764e83.png)

- Thẻ kẹo viên thuốc (`rounded-full`), lớp nền kính bạc nhạt trong suốt `bg-white/60 backdrop-blur-sm`, viền trắng mảnh phản chiếu, tích hợp cụm Avatar chồng lớp.
- _Mẫu code Tailwind CSS chuẩn:_

````html
<div
  class="inline-flex items-center gap-3 bg-white/50 backdrop-blur-sm border border-white/80 px-5 py-2 rounded-full shadow-sm shadow-blue-900/5"
>
  <div class="flex -space-x-2">
    <img
      class="w-7 h-7 rounded-full ring-2 ring-white object-cover"
      src="..."
    />
    <img
      class="w-7 h-7 rounded-full ring-2 ring-white object-cover"
      src="..."
    />
    <img
      class="w-7 h-7 rounded-full ring-2 ring-white object-cover"
      src="..."
    />
  </div>
  <span class="text-[#1E293B] font-semibold text-xs tracking-wide"
    >Trusted by 12,000+ People</span
  >
</div>
``` ##### 5.5 Sidebar / Navigation * Thiết kế tối giản hóa. Phần tử đang được
chọn sẽ khoác lên mình khung kẹo viên thuốc (`rounded-full`) màu trắng kính
trong hoặc màu xanh nhạt hoàng gia `bg-blue-50/80` tinh tế. ##### 5.6 KPI / Stat
Card * Sử dụng cấu trúc `Glassmorphic Card`. Đi kèm các con số trực quan cỡ lớn
`display-2xl` và một tag mini báo chỉ số tăng trưởng dạng viên thuốc nằm gọn ở
góc phải. --- ## 6. Animation & Motion ##### Micro-interactions bắt buộc * Bổ
sung thuộc tính `transition-all duration-200 ease-out` trên tất cả các thành
phần tương tác clickable. ##### Quy tắc animation * Áp dụng hiệu ứng thu phóng
siêu nhỏ (`hover:scale-[1.015]`) kết hợp biến đổi nhẹ độ đục của bề mặt kính khi
rê chuột. Tránh các hiệu ứng chuyển động rung lắc dữ dội. --- ## 7. Layout
Patterns ##### Dashboard Layout chuẩn * Sử dụng hình nền tổng thể mang dải
chuyển màu xanh bạc mờ ảo. Các phân khu chức năng được bao bọc bởi các lớp kính
cường lực mờ rõ ràng, khoa học. ##### Bento Grid — cho dashboard overview * Mạng
lưới các ô vuông/chữ nhật sắp xếp linh hoạt. Đồng nhất sử dụng bo cong
`rounded-3xl` và có đường viền phản quang `border-white/60`. --- ## 8. Quy Tắc
Agent — Khi Viết UI Code ##### Bắt buộc * Phải phối kết hợp nhuần nhuyễn 3 yếu
tố: Bo tròn viên thuốc (`rounded-full`), Nền kính mờ (`backdrop-blur`), và Viền
trắng mảnh (`border-white/...`). * Bảo đảm độ hiển thị chữ rõ nét trên nền kính
thông qua mã màu `text-[#1E293B]`. ##### Nghiêm cấm * **Tuyệt đối nghiêm cấm**
việc lạm dụng hoặc cài cắm shadow dập nổi cũ của phong cách Neomorphism. * Cấm
sử dụng viền tối màu, viền đen, hoặc đổ bóng dầy đen đặc (`shadow-2xl`). #####
Pattern fallback khi không chắc * Nếu không rõ thông số, áp dụng ngay:
`bg-white/50 backdrop-blur-md border border-white/70 rounded-full`. --- ## 9.
Tailwind Config Reference ```javascript module.exports = { theme: { extend: {
colors: { baseBg: 'linear-gradient(135deg, #EBF2FA 0%, #DCE6F1 100%)',
glassSurface: 'rgba(255, 255, 255, 0.45)', accentBlue: '#1A73E8', textMain:
'#1E293B', textMuted: '#64748B' }, backdropBlur: { xs: '2px', } } } }
````
