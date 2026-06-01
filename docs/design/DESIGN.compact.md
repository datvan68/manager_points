---

### ## 2. Nội dung file `DESIGN.compact.md` mới

```markdown
# DESIGN [COMPACT] — Minimalist Glassmorphism · Blue & Silver · Tailwind

## Base Tokens

- **Page Background:** `linear-gradient(135deg, #EBF2FA, #DCE6F1)` (Xanh dương bạc nhạt)
- **Glass Surface BG:** `bg-white/45 backdrop-blur-md` (Kính mờ tối giản)
- **Crisp Border:** `border border-white/75` (Viền phản quang mảnh ánh bạc)
- **Text Color System:** Main: `#1E293B` (Xanh đen sẫm) | Muted: `#64748B` (Xám bạc)
- **Accent Primary:** `#1A73E8` (Xanh dương hoàng gia cho các điểm chạm điều hướng)
- **Soft Shadow:** `shadow-sm shadow-slate-300/40` (Bóng đáy siêu mịn, không đổ bóng đôi)

## Radius Rule

- **Badges / Buttons / Tags / Form Inputs:** `rounded-full` (Cấu trúc viên thuốc tuyệt đối dựa theo image_764e83.png)
- **Main Containers / Dashboard Cards:** `rounded-3xl` / `rounded-[24px]` (Bo góc lớn sang trọng)

## Component Quick-Ref

- **Trust Badge Component (Mẫu chuẩn ảnh):**
  `flex items-center gap-3 bg-white/50 backdrop-blur-sm border border-white/80 rounded-full px-5 py-2 shadow-sm`
- **Avatar Stack Layout:**
  `flex -space-x-2` -> Bên trong chứa các thẻ img: `w-7 h-7 rounded-full ring-2 ring-white`
- **Pill Text Style:**
  `text-xs font-semibold text-[#1E293B] tracking-wide`
- **Interactive Button:**
  `rounded-full border border-white/70 bg-white/40 px-5 py-2.5 transition-all duration-200 hover:bg-white/70`

## Motion

- Thêm hiệu ứng mượt: `transition-all duration-200 ease-out`
- Trạng thái Hover: `hover:scale-[1.015] hover:shadow-md`

## Hard Rules

1. **Xóa sổ hoàn toàn tư duy cũ:** Không ứng dụng phong cách Neomorphism dưới mọi hình thức (Không tạo bóng lồi/lõm 2 góc chéo).
2. **Quy tắc vật liệu:** Bắt buộc áp dụng nền trong suốt mờ + Viền trắng mảnh phản quang để tạo ra chất liệu Glassmorphism sang trọng.
3. **Giới hạn hình học:** Tuyệt đối không dùng các góc vuông sắc nhọn hoặc bo góc nhỏ (`rounded-sm`, `rounded-md`) cho các thành phần hạt nhân tương tác.
```
