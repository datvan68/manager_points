# DESIGN.md — Design System (Compact Glassmorphism · Rounded-xl)

Tài liệu này là **nguồn sự thật duy nhất** về thiết kế hệ thống giao diện. Agent bắt buộc phải đọc file này trước khi viết bất kỳ dòng UI nào. Mọi component, màu sắc, spacing, và hiệu ứng chuyển động đều phải tuân thủ nghiêm ngặt để đảm bảo tính đồng nhất.

---

## 1. Design Philosophy

Sự kết hợp tinh tế giữa **Chủ nghĩa tối giản mật độ cao (Compact Minimalism)** và **Hiệu ứng kính mờ (Glassmorphism)**:

- **Chất liệu kính xuyên thấu:** Sử dụng các lớp nền bán trong suốt (`backdrop-blur`) kết hợp viền trắng/bạc mảnh để giả lập các tấm kính mờ tinh khiết xếp chồng nhẹ trên nền gradient.
- **Cấu trúc hình học compact:** Ứng dụng bo góc vừa phải `rounded-xl` (12px) đồng nhất cho **toàn bộ** các thành phần — badge, button, input, card, container. Không dùng `rounded-full`.
- **Mật độ thông tin cao:** Padding nhỏ gọn, font size tiết kiệm không gian, khoảng cách nội tại tối ưu cho nhiều nội dung trên cùng màn hình.
- **Loại bỏ Neomorphism:** Tuyệt đối không dùng bóng đổ đôi dập nổi. Depth được tạo nên từ độ mờ của kính (`backdrop-blur-md`), viền phản chiếu ánh sáng và bóng đổ đáy cực mịn (`shadow-sm`).
- **Avatar Stacking:** Các phần tử ảnh tròn xếp chồng lấn nhẹ (`-space-x-2`) có viền trắng tinh tế — **chỉ avatar mới dùng `rounded-full`**, toàn bộ container bao ngoài theo `rounded-xl`.

---

## 2. Color System

Hệ màu công nghệ hiện đại dựa trên bộ ba **Xanh dương, Trắng, và Bạc**:

- `--color-base-bg`: `linear-gradient(135deg, #EBF2FA 0%, #DCE6F1 100%)` (Nền dốc nhẹ màu xanh dương sương mù pha bạc).
- `--color-glass-surface`: `rgba(255, 255, 255, 0.45)` (Nền bề mặt kính mờ màu trắng đục nhẹ).
- `--color-border-glow`: `rgba(255, 255, 255, 0.75)` (Đường viền trắng bạc mảnh mờ để giữ hiệu ứng khúc xạ ánh sáng cạnh kính).
- `--color-accent-blue`: `#1A73E8` (Xanh dương hoàng gia - chỉ dùng tương tác CTA chính, active state).
- `--color-text-main`: `#1E293B` (Xanh dương đen sẫm mang lại độ tương phản cao nhưng dịu mắt).
- `--color-text-muted`: `#64748B` (Màu xám bạc/slate phục vụ cho các thông tin phụ trợ).

- **Semantic State Colors (Hệ màu trạng thái - Dựa theo trang /grading/score)**:
  - **Active / Blue**: `bg-blue-500/10 text-[#1A73E8] border-blue-500/20` (Trạng thái hoạt động, tự chấm)
  - **Warning / Amber**: `bg-amber-500/10 text-amber-700 border-amber-500/20` (Cần xem xét, chờ duyệt)
  - **Info / Approved / Purple**: `bg-purple-500/10 text-purple-700 border-purple-500/20` (Đã duyệt, hoàn thành)
  - **Danger / Locked / Rose**: `bg-rose-500/10 text-rose-700 border-rose-500/20` (Khóa, dừng hoạt động)
  - **Draft / Muted / Slate**: `bg-slate-500/10 text-[#64748B] border-slate-500/20` (Bản nháp, mặc định)

---

## 3. Typography

##### Type Scale (Compact)

| Token       | Size | Weight | Line-height | Dùng cho                                  |
| :---------- | :--- | :----- | :---------- | :---------------------------------------- |
| display-2xl | 40px | 600    | 1.1         | Chỉ số KPI, Hero number                   |
| display-xl  | 30px | 600    | 1.2         | Tiêu đề chính trang (Page title)          |
| display-lg  | 24px | 500    | 1.3         | Tiêu đề các phân vùng lớn                 |
| heading-md  | 18px | 600    | 1.4         | Tiêu đề thẻ (Card title)                  |
| heading-sm  | 15px | 600    | 1.4         | Tiêu đề khối chức năng con                |
| body-lg     | 14px | 400    | 1.5         | Văn bản nội dung chính                    |
| body-md     | 13px | 500    | 1.4         | Nội dung chữ trong Badge, Tag             |
| label-md    | 12px | 500    | 1.3         | Nhãn form nhập liệu, Badge lớn            |
| label-sm    | 11px | 500    | 1.2         | Thẻ tag thông tin, phụ đề nhỏ             |
| mono-md     | 12px | 400    | 1.4         | Định danh, ID, Code khối dữ liệu          |

---

## 4. Spacing & Layout

##### Grid system

- Bố cục lưới phân bố nghiêm ngặt với khoảng cách compact: `gap-3` cho cụm tính năng nhỏ và `gap-4` cho layout tổng quan (giảm từ `gap-4`/`gap-6` xuống một bậc).
- Padding nội tại chuẩn: `px-3 py-1.5` cho inline elements, `px-4 py-2` cho buttons, `p-4` cho cards nhỏ, `p-5` cho cards lớn.

##### Border Radius — Quy tắc đồng nhất `rounded-xl`

| Thành phần                          | Radius         |
| :---------------------------------- | :------------- |
| Badge, Button, Tag, Input, Select   | `rounded-xl`   |
| Card nhỏ, Dropdown item, Tooltip    | `rounded-xl`   |
| Card lớn, Container, Modal, Panel   | `rounded-2xl`  |
| Avatar / ảnh tròn (ngoại lệ duy nhất) | `rounded-full` |

---

## 5. Component Library

##### 5.1 Card — Glassmorphic Floating

- Nền kính mờ `bg-white/40`, lớp lọc nhòe phía sau `backdrop-blur-md`, viền sắc nét `border border-white/70`, góc bo `rounded-2xl`. Đổ bóng mờ nhẹ dưới đáy `shadow-sm shadow-slate-300/40`.
- Padding compact: `p-4` cho card thông thường, `p-5` cho card có nhiều nội dung.

##### 5.2 Button

- Form `rounded-xl`. Padding: `px-4 py-2` (standard) hoặc `px-3 py-1.5` (small).
- Không sử dụng viền màu tối.
- **State Hover:** Độ mờ nền giảm (`bg-white/70`) hoặc kích hoạt phủ màu accent `bg-[#1A73E8]` kèm text trắng.
- Icon Button: `w-8 h-8 rounded-xl flex items-center justify-center`.

##### 5.3 Input

- Kiểu dáng `rounded-xl`, nền kính mờ dịu mắt `bg-white/50 backdrop-blur-sm`, padding: `px-3 py-2`.
- Khi focus: viền mỏng màu xanh dương nhạt `ring-2 ring-[#1A73E8]/30`.

##### 5.4 Badge / Status Tag

- `rounded-xl`, lớp nền kính bạc nhạt `bg-white/60 backdrop-blur-sm`, viền trắng mảnh phản chiếu, tích hợp cụm Avatar chồng lớp.
- _Mẫu code Tailwind CSS chuẩn:_

```html
<div
  class="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/80 px-3 py-1.5 rounded-xl shadow-sm shadow-blue-900/5"
>
  <div class="flex -space-x-2">
    <img class="w-6 h-6 rounded-full ring-2 ring-white object-cover" src="..." />
    <img class="w-6 h-6 rounded-full ring-2 ring-white object-cover" src="..." />
    <img class="w-6 h-6 rounded-full ring-2 ring-white object-cover" src="..." />
  </div>
  <span class="text-[#1E293B] font-semibold text-xs tracking-wide">Trusted by 12,000+ People</span>
</div>
```

##### 5.5 Sidebar / Navigation

- Thiết kế compact. Phần tử đang được chọn sẽ hiển thị khung `rounded-xl` màu trắng kính trong hoặc `bg-blue-50/80`.
- Nav item height: `h-8` hoặc `py-1.5 px-3`.

##### 5.6 KPI / Stat Card

- Sử dụng cấu trúc `Glassmorphic Card` với `rounded-2xl`. Số liệu cỡ `display-2xl`, tag tăng trưởng mini dạng `rounded-xl` ở góc phải.

##### 5.7 Dropdown / Context Menu

- `rounded-xl`, `bg-white/80 backdrop-blur-md border border-white/70 shadow-md`.
- Item padding: `px-3 py-1.5`, item hover: `bg-white/60 rounded-lg`.

---

## 6. Animation & Motion

##### Micro-interactions bắt buộc

- Thêm `transition-all duration-150 ease-out` trên tất cả các thành phần tương tác (giảm từ `200ms` xuống `150ms` cho cảm giác nhanh nhạy, compact hơn).

##### Quy tắc animation

- Hover: `hover:scale-[1.01]` (giảm từ `1.015` — compact hơn, ít phô trương hơn) kết hợp biến đổi nhẹ độ đục.
- Tránh các hiệu ứng chuyển động rung lắc dữ dội.

---

## 7. Layout Patterns

##### Dashboard Layout chuẩn

- Hình nền tổng thể: `linear-gradient(135deg, #EBF2FA, #DCE6F1)`. Các phân khu được bao bọc bởi lớp kính `rounded-2xl`.

##### Bento Grid — cho dashboard overview

- Mạng lưới ô vuông/chữ nhật linh hoạt. Đồng nhất `rounded-2xl`, viền phản quang `border-white/60`, gap: `gap-3`.

---

## 8. Quy Tắc Agent — Khi Viết UI Code

##### Bắt buộc

- Phải phối kết hợp nhuần nhuyễn 3 yếu tố: Bo góc `rounded-xl` (hoặc `rounded-2xl` cho container lớn), Nền kính mờ (`backdrop-blur`), và Viền trắng mảnh (`border-white/...`).
- Bảo đảm độ hiển thị chữ rõ nét trên nền kính: `text-[#1E293B]`.
- Ưu tiên **compact density**: giảm padding, giảm font size 1 bậc so với default Tailwind.

##### Nghiêm cấm

- **Tuyệt đối nghiêm cấm** `rounded-full` cho bất kỳ thành phần nào ngoài avatar/ảnh tròn.
- Cấm `rounded-sm`, `rounded-md`, `rounded-none` — chỉ dùng `rounded-xl` và `rounded-2xl`.
- Cấm sử dụng viền tối màu, viền đen, hoặc đổ bóng dầy đen đặc (`shadow-2xl`).
- Cấm bóng đổ dập nổi kiểu Neomorphism.

##### Pattern fallback khi không chắc

- Nếu không rõ thông số, áp dụng ngay: `bg-white/50 backdrop-blur-md border border-white/70 rounded-xl px-3 py-1.5`.

---

## 9. Tailwind Config Reference

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        glassSurface: 'rgba(255, 255, 255, 0.45)',
        accentBlue: '#1A73E8',
        textMain: '#1E293B',
        textMuted: '#64748B'
      },
      borderRadius: {
        // rounded-xl (12px) là chuẩn mặc định cho toàn bộ components
        // rounded-2xl (16px) cho containers/cards lớn
        // rounded-full chỉ dùng cho avatar
      },
      backdropBlur: {
        xs: '2px',
      }
    }
  }
}
```