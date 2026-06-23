# Taskscope - Điều chỉnh sticky student slider trang /grading/score

## 1. Bối cảnh

Trang `/grading/score` có thanh danh sách sinh viên chuyển sang trạng thái sticky khi cuộn xuống. Theo ảnh kiểm tra, các card sinh viên trong sticky bar đang bị cắt tên bằng dấu `...`, ví dụ `Nguyễn Hoàn...`, `Trần Nguyễn ...`, làm người dùng khó xác định đúng sinh viên khi chấm điểm.

Vùng sticky cũng đang có khoảng trống phía dưới hơi dày, đặc biệt khi thanh cuộn ngang xuất hiện gần đáy, khiến tổng chiều cao thanh nhìn chưa cân đối.

Khu vực code liên quan chính nằm trong:

- `frontend/src/app/grading/score/page.tsx`
- Component `StudentSliderCard`
- Block render `STUDENT HERO SLIDER`
- Cấu hình `studentVirtualizer`

## 2. Nguyên nhân quan sát được

Trong `StudentSliderCard`, trạng thái sticky đang giới hạn kích thước card và tên:

```tsx
isStudentSliderSticky
  ? "rounded-xl p-1.5 px-3 gap-2 h-9 w-max max-w-[200px]"
  : "rounded-2xl p-[13px] w-[256px] gap-[12px]"
```

Tên sinh viên ở sticky bị ép max width và truncate:

```tsx
isStudentSliderSticky ? "text-[13px] max-w-[120px]" : "text-[14.5px]"
```

Container sticky hiện có padding đáy và slider inner padding tương đối dày:

```tsx
"pt-2 px-6 md:px-8 pb-2 ... gap-2"
"flex gap-4 overflow-x-auto pl-1 pr-10 py-2.5 ..."
```

Virtualizer đang ước lượng item sticky là `200`, nên nếu tăng chiều rộng card để hiện đủ tên thì cần cập nhật estimate để scroll ngang và vị trí absolute không bị lệch:

```tsx
estimateSize: () => isStudentSliderSticky ? 200 : 272
```

## 3. Mục tiêu

Điều chỉnh sticky student slider để:

- Hiển thị đầy đủ tên sinh viên trong sticky bar, không tự cắt bằng `...`.
- Giữ thanh sticky gọn, dễ scan, không làm card quá cao.
- Giảm padding bottom để phần trên/dưới cân xứng hơn so với ảnh hiện tại.
- Không ảnh hưởng trạng thái expanded của student slider khi chưa sticky.
- Không thay đổi logic chấm điểm, load dữ liệu, filter, chọn lớp, chọn sinh viên.

## 4. Phạm vi xử lý đề xuất

### 4.1. Chỉnh card sticky hiển thị đầy đủ tên

File: `frontend/src/app/grading/score/page.tsx`

Trong `StudentSliderCard`, chỉ chỉnh nhánh `isStudentSliderSticky`:

- Bỏ `max-w-[200px]` ở card sticky hoặc tăng lên theo width phù hợp.
- Bỏ `max-w-[120px]` và `truncate` ở tên khi sticky.
- Dùng `whitespace-nowrap` để tên nằm một dòng và để card tự nở theo tên.
- Giữ `title={student.name}` như hiện tại để vẫn có tooltip native khi hover.

Gợi ý class:

```tsx
isStudentSliderSticky
  ? "rounded-xl p-1.5 px-3 gap-2 h-9 w-max min-w-[220px] max-w-none"
  : "rounded-2xl p-[13px] w-[256px] gap-[12px]"
```

Với `h4`:

```tsx
isStudentSliderSticky
  ? "text-[13px] whitespace-nowrap"
  : "text-[14.5px] truncate"
```

Lưu ý: Nếu muốn giữ card không quá dài với tên bất thường, có thể dùng `max-w-[280px]`, nhưng yêu cầu hiện tại là hiển thị đầy đủ tên nên ưu tiên không truncate.

### 4.2. Cập nhật virtualizer cho width mới

Trong cấu hình `studentVirtualizer`, cập nhật estimate của sticky item tương ứng với card mới:

```tsx
estimateSize: () => isStudentSliderSticky ? 240 : 272
```

Nếu chọn `min-w-[240px]` hoặc width khác, estimate nên khớp với tổng chiều rộng trung bình của card + spacing để tránh scrollToIndex lệch khi chuyển sticky.

Sau khi đổi width, kiểm tra lại:

- Auto scroll tới sinh viên active vẫn căn giữa hợp lý.
- Kéo ngang không bị giật.
- Không bị overlap giữa các card do virtual item absolute positioning.

### 4.3. Giảm padding bottom của sticky bar

Trong block `STUDENT HERO SLIDER`, chỉnh nhánh sticky của container:

```tsx
? "pt-2 px-6 md:px-8 pb-1 bg-sky-400/20 backdrop-blur-md border-b border-sky-400/50 gap-1 rounded-b-2xl shadow-sm"
```

Trong div `sliderRef`, giảm vertical padding khi sticky. Có thể tách class theo trạng thái thay vì dùng cố định `py-2.5`:

```tsx
className={`flex gap-4 overflow-x-auto pl-1 pr-10 custom-scrollbar scroll-smooth cursor-grab select-none ${
  isStudentSliderSticky ? "pt-1.5 pb-1" : "py-2.5"
}`}
```

Nếu sau khi giảm padding đáy thanh vẫn còn cao, giảm thêm virtual list height sticky:

```tsx
height: isStudentSliderSticky ? "40px" : "109px"
```

Đồng bộ skeleton sticky nếu cần:

```tsx
isStudentSliderSticky ? "min-w-[220px] h-9 rounded-xl p-1.5 px-3 gap-2" : ...
```

## 5. Ngoài phạm vi

- Không đổi API, schema, dữ liệu điểm, trạng thái chấm điểm.
- Không đổi logic `filteredStudentsForRoster`, `activeStudentId`, `studentSummaryMap`.
- Không redesign toàn bộ trang `/grading/score`.
- Không thay đổi layout expanded của slider khi chưa sticky, trừ khi cần đồng bộ class không ảnh hưởng visual.
- Không sửa các lỗi TypeScript/build khác nếu phát sinh ngoài khu vực sticky slider.

## 6. Test/Verify

Chạy kiểm tra frontend:

```bash
cd frontend
npm run build
```

Nếu build mất thời gian, có thể kiểm tra nhanh bằng:

```bash
cd frontend
npx tsc --noEmit
```

Kịch bản kiểm tra thủ công:

1. Mở `/grading/score` với tài khoản có quyền xem danh sách sinh viên.
2. Chọn lớp có nhiều sinh viên và tên dài như `Nguyễn Hoàn...`, `Trần Nguyễn...`.
3. Cuộn xuống để thanh sinh viên chuyển sang sticky.
4. Xác nhận tên sinh viên hiển thị đầy đủ, không còn `...`.
5. Kiểm tra sticky bar không quá cao, padding bottom cân với padding top.
6. Kéo ngang danh sách và chọn sinh viên bất kỳ, active state vẫn đúng.
7. Kiểm tra responsive ở desktop hẹp và mobile/tablet nếu trang hỗ trợ.

## 7. Tiêu chí hoàn thành

- Sticky bar trên `/grading/score` hiển thị đầy đủ tên sinh viên trong card.
- Không còn ellipsis ở tên sinh viên trong trạng thái sticky.
- Khoảng padding bottom của sticky bar được giảm và nhìn cân đối hơn ảnh hiện tại.
- Slider ngang vẫn scroll mượt, không overlap, không lệch vị trí khi active student thay đổi.
- Trạng thái expanded của student slider không bị ảnh hưởng.
- Build/type-check frontend không phát sinh lỗi do thay đổi class/render sticky slider.
