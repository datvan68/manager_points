# DESIGN [COMPACT] — Compact Glassmorphism · Blue & Silver · Tailwind

## Base Tokens

- **Page Background:** `linear-gradient(135deg, #EBF2FA, #DCE6F1)` (Xanh dương bạc nhạt)
- **Glass Surface BG:** `bg-white/45 backdrop-blur-md` (Kính mờ tối giản)
- **Crisp Border:** `border border-white/75` (Viền phản quang mảnh ánh bạc)
- **Text Color System:** Main: `#1E293B` (Xanh đen sẫm) | Muted: `#64748B` (Xám bạc)
- **Accent Primary:** `#1A73E8` (Xanh dương hoàng gia cho các điểm chạm điều hướng)
- **Soft Shadow:** `shadow-sm shadow-slate-300/40` (Bóng đáy siêu mịn, không đổ bóng đôi)
- **Semantic States (Trạng thái - Từ /grading/score):**
  - Active: `bg-blue-500/10 text-[#1A73E8] border-blue-500/20`
  - Warning: `bg-amber-500/10 text-amber-700 border-amber-500/20`
  - Approved/Info: `bg-purple-500/10 text-purple-700 border-purple-500/20`
  - Locked/Danger: `bg-rose-500/10 text-rose-700 border-rose-500/20`
  - Draft/Muted: `bg-slate-500/10 text-[#64748B] border-slate-500/20`

## Radius Rule

- **Tất cả Components (Badge / Button / Tag / Input / Card nhỏ):** `rounded-xl` — chuẩn duy nhất
- **Main Containers / Dashboard Cards:** `rounded-2xl` (Bo góc lớn cho container bao ngoài)
- **Avatar / ảnh đại diện (ngoại lệ duy nhất):** `rounded-full`

## Spacing Compact

- Inline elements (badge, tag): `px-3 py-1.5`
- Buttons: `px-4 py-2` (standard) | `px-3 py-1.5` (small)
- Cards: `p-4` (small) | `p-5` (large)
- Gap layout: `gap-3` (tight) | `gap-4` (standard)

## Component Quick-Ref

- **Trust Badge Component:**
  `inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl px-3 py-1.5 shadow-sm`
- **Avatar Stack Layout:**
  `flex -space-x-2` → các thẻ img bên trong: `w-6 h-6 rounded-full ring-2 ring-white`
- **Badge Text Style:**
  `text-xs font-semibold text-[#1E293B] tracking-wide`
- **Interactive Button:**
  `rounded-xl border border-white/70 bg-white/40 px-4 py-2 transition-all duration-150 hover:bg-white/70`
- **Icon Button:**
  `w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70`
- **Input Field:**
  `rounded-xl bg-white/50 backdrop-blur-sm border border-white/70 px-3 py-2 focus:ring-2 focus:ring-[#1A73E8]/30`

## Motion

- Thêm hiệu ứng nhanh nhạy: `transition-all duration-150 ease-out`
- Trạng thái Hover: `hover:scale-[1.01] hover:shadow-md`

## Hard Rules

1. **Radius đồng nhất:** `rounded-xl` cho mọi component. `rounded-2xl` chỉ cho container/card lớn. `rounded-full` chỉ cho avatar.
2. **Cấm hoàn toàn:** `rounded-full` cho button/badge/input — đây là thay đổi cốt lõi so với phiên bản cũ.
3. **Cấm:** `rounded-sm`, `rounded-md`, `rounded-none`, `rounded-lg` — không dùng các bậc nhỏ hơn `rounded-xl`.
4. **Quy tắc vật liệu:** Bắt buộc áp dụng nền trong suốt mờ + Viền trắng mảnh phản quang (Glassmorphism).
5. **Nghiêm cấm Neomorphism:** Không tạo bóng lồi/lõm 2 góc chéo dưới bất kỳ hình thức nào.
6. **Fallback pattern:** Khi không chắc → `bg-white/50 backdrop-blur-md border border-white/70 rounded-xl px-3 py-1.5`