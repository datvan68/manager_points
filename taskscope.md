# Taskscope: Review infinite scroll `/grading` trên mobile/tablet

## 1. Kết luận review

Implementation hiện tại đã đi đúng hướng cho yêu cầu chuyển danh sách summaries của `/grading` sang infinite scroll trên mobile/tablet:

- Mobile/tablet không còn truyền pagination xuống UI, desktop vẫn dùng `CustomPagination`.
- API summaries đã dùng `page` và `limit` thật, không còn tải toàn bộ bằng `limit=9999`.
- Khi load thêm, dữ liệu mới được append và có lọc trùng theo `_id`.
- Card mobile đã thu gọn theo nhóm thông tin chính: họ tên, mã sinh viên, tổng điểm, xếp loại và hành động.
- Sentinel đã được đưa vào `ResponsiveDataView` qua `mobileFooter`, nằm trong vùng scroll card mobile.
- `IntersectionObserver` đã dùng `root: mobileScrollRootRef.current` và `rootMargin: '400px 0px'`, phù hợp hơn so với observer theo viewport.

Tuy nhiên chưa nên xem là hoàn tất tuyệt đối. Cần harden thêm để tránh load trùng, skip page, hoặc sai trạng thái khi đổi filter, resize desktop/mobile, restore session page cũ.

## 2. Review findings

### P1 - Cần chặn trigger trùng trong khoảng giữa observer callback và fetch effect

File: `frontend/src/app/grading/page.tsx`

Vị trí liên quan:

- `frontend/src/app/grading/page.tsx:729` tạo `IntersectionObserver`.
- `frontend/src/app/grading/page.tsx:731` kiểm tra `hasMore`, `isFetching`, `isLoadingMore` rồi `setCurrentPage(prev => prev + 1)`.
- `frontend/src/app/grading/page.tsx:661` `fetchSummaries` mới set `isLoadingMore(true)` sau khi effect fetch chạy.

Rủi ro: observer có thể fire nhiều lần trong cùng một khoảng ngắn khi sentinel vẫn intersecting, trong khi `isLoadingMore` chưa kịp chuyển sang `true`. Điều này có thể làm `currentPage` tăng nhiều lần, request trùng hoặc skip page.

Scope cần sửa:

- Thêm ref khóa request, ví dụ `loadingMoreRef` hoặc `requestedPageRef`.
- Set khóa ngay trong observer callback trước khi `setCurrentPage`.
- Release khóa trong `finally` của `fetchSummaries`.
- Có thể unobserve tạm sentinel khi bắt đầu load và observe lại sau khi load xong.

Gợi ý logic:

```tsx
const loadingMoreRef = React.useRef(false);

// Trong observer callback
if (!entry?.isIntersecting || !hasMore || isFetching || isLoadingMore || loadingMoreRef.current) return;
loadingMoreRef.current = true;
setCurrentPage(prev => prev + 1);

// Trong finally của fetchSummaries
loadingMoreRef.current = false;
```

Acceptance:

- Scroll nhanh gần cuối không tạo nhiều request cùng một page.
- Không bị nhảy từ page 1 sang page 3/4 khi sentinel vẫn nằm trong rootMargin.

### P1 - Cần verify lại khi filter mới nhưng `currentPage` đang lớn hơn 1

File: `frontend/src/app/grading/page.tsx`

Vị trí liên quan:

- `frontend/src/app/grading/page.tsx:757` restore `grading_page` từ sessionStorage.
- `frontend/src/app/grading/page.tsx:766` set `currentPage` theo page đã lưu.
- `frontend/src/app/grading/page.tsx:908` reset `currentPage(1)` khi xác nhận filter.
- `frontend/src/app/grading/page.tsx:913` đến `frontend/src/app/grading/page.tsx:915` apply semester/department/class.

Hiện tại khi user xác nhận filter mới thì đã reset về page 1, hướng này đúng. Nhưng cần kiểm tra kỹ case restore session trên mobile/tablet: nếu session lưu `currentPage = 3`, component có thể fetch page 3 như load more khi danh sách hiện tại chưa có page 1 và page 2.

Scope cần sửa:

- Trên mobile/tablet, khi khôi phục session hoặc khi chuyển từ desktop sang mobile, nên reset page về 1, hoặc load tuần tự từ page 1 đến page đã lưu nếu thật sự muốn restore vị trí cũ.
- Khuyến nghị đơn giản: mobile/tablet luôn bắt đầu từ page 1 sau refresh/restore, tránh danh sách bị thiếu đầu trang.

Acceptance:

- Reload trang trên mobile không hiển thị danh sách bắt đầu từ page 2/3.
- Infinite scroll append đúng thứ tự từ page 1, 2, 3...

### P2 - Effect fetch đang bỏ dependency `isMobileOrTablet`

File: `frontend/src/app/grading/page.tsx`

Vị trí liên quan:

- `frontend/src/app/grading/page.tsx:714` effect fetch summaries.
- `frontend/src/app/grading/page.tsx:716` tính `isLoadMore = isMobileOrTablet && currentPage > 1`.
- `frontend/src/app/grading/page.tsx:719` disable exhaustive deps.
- Dependency array không có `isMobileOrTablet`.

Rủi ro: khi resize từ desktop sang tablet/mobile hoặc ngược lại, effect không fetch lại theo mode mới. Desktop đang ở page 3 rồi chuyển sang mobile có thể hiển thị một page đơn lẻ như danh sách infinite scroll.

Scope cần sửa:

- Thêm logic riêng khi breakpoint đổi:
  - Desktop -> mobile/tablet: reset `currentPage` về 1, clear list, `hasMore(true)`.
  - Mobile/tablet -> desktop: giữ hoặc reset page theo UX desktop, nhưng không append.
- Sau khi có effect riêng cho breakpoint, có thể giữ dependency fetch tối giản để tránh loop.

Acceptance:

- Resize giữa desktop và mobile không làm danh sách bị thiếu, bị duplicate hoặc dùng sai mode replace/append.

### P2 - `ResponsiveDataView` render `mobileFooter` cả khi loading/empty

File: `frontend/src/components/ui/ResponsiveDataView.tsx`

Vị trí liên quan:

- `frontend/src/components/ui/ResponsiveDataView.tsx:165` vùng scroll mobile.
- `frontend/src/components/ui/ResponsiveDataView.tsx:188` empty state.
- `frontend/src/components/ui/ResponsiveDataView.tsx:197` render `{mobileFooter}`.

Hiện tại footer vẫn render sau loading hoặc empty state nếu parent truyền vào. Với `/grading`, parent đang check `hasMore`, `appliedClass`; nhưng vẫn nên chặt hơn để tránh sentinel xuất hiện trong lúc skeleton/empty và tự trigger load không mong muốn.

Scope cần sửa:

- Parent chỉ truyền `mobileFooter` khi `!isInitialLoading && filteredStudents.length > 0 && hasMore`.
- Hoặc trong `ResponsiveDataView`, bổ sung prop rõ hơn như `mobileEndSlot` và render theo điều kiện data đã có.

Acceptance:

- Không trigger load more khi danh sách đang skeleton hoặc empty.

### P2 - Thiếu trạng thái lỗi/retry cho load thêm

File: `frontend/src/app/grading/page.tsx`

Vị trí liên quan:

- `frontend/src/app/grading/page.tsx:696` catch chỉ `console.error`.
- `frontend/src/app/grading/page.tsx:1427` footer chỉ hiện spinner khi `isLoadingMore`.

Rủi ro: nếu request load thêm fail, user không biết và không có nút thử lại. Sentinel có thể tiếp tục trigger lặp nếu vẫn intersecting.

Scope cần sửa:

- Thêm `loadMoreError` state.
- Khi load more fail, hiển thị message ngắn và nút `Thử lại` trong `mobileFooter`.
- Khi retry, gọi lại page hiện tại hoặc không tăng page trước khi request thành công.

Acceptance:

- Mất mạng/API lỗi khi load thêm có feedback rõ.
- User có thể retry mà không duplicate data.

## 3. Phạm vi sửa đề xuất

### 3.1. Giữ kiến trúc hiện tại

Tiếp tục dùng:

- `ResponsiveDataView` nhận `mobileScrollRef` để expose scroll container.
- `ResponsiveDataView` nhận `mobileFooter` để render sentinel trong đúng vùng scroll.
- `/grading/page.tsx` quản lý `IntersectionObserver`, paging state và append data.

Không cần đổi sang thư viện virtual/infinite list ở bước này, vì yêu cầu hiện tại là tối ưu load và mobile card. Nếu danh sách mỗi lớp rất lớn, cân nhắc virtualization sau.

### 3.2. Bổ sung request guard

Thêm:

- `const loadingMoreRef = React.useRef(false);`
- `const lastRequestedPageRef = React.useRef(1);` nếu cần chống request lặp cùng page.
- Reset các ref này khi đổi filter hoặc reset về page 1.

### 3.3. Chuẩn hóa reset state khi đổi filter

Khi confirm filter:

- Clear danh sách cũ trước khi apply filter mới.
- Reset `currentPage` về 1.
- Reset `hasMore` về `true`.
- Reset `isLoadingMore` về `false`.
- Reset `loadMoreError` nếu có.
- Reset `loadingMoreRef.current = false`.
- Reset cache pre-count nếu cache chỉ thuộc page/list hiện tại.

### 3.4. Xử lý breakpoint desktop/mobile

Thêm effect theo `isMobileOrTablet`:

- Nếu vào mobile/tablet: reset `currentPage` về 1 và reload page 1 để đảm bảo list infinite bắt đầu đúng.
- Nếu về desktop: dùng pagination desktop, không append, không render sentinel.

### 3.5. Tối ưu observer

Observer nên có guard đủ điều kiện:

```tsx
useEffect(() => {
  if (!isMobileOrTablet || !appliedClass || !appliedSemester || !hasMore) return;
  if (isFetching || isLoadingMore) return;

  const target = observerTarget.current;
  const root = mobileScrollRootRef.current;
  if (!target || !root) return;

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return;
    if (loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setCurrentPage(prev => prev + 1);
  }, {
    root,
    rootMargin: '400px 0px',
    threshold: 0,
  });

  observer.observe(target);
  return () => observer.disconnect();
}, [isMobileOrTablet, appliedClass, appliedSemester, hasMore, isFetching, isLoadingMore]);
```

## 4. Acceptance criteria cập nhật

- Trên desktop: `/grading` vẫn dùng pagination, đổi page/page size hoạt động như cũ.
- Trên mobile/tablet: chỉ tải page đầu tiên ban đầu, sau đó tự load thêm khi scroll gần cuối.
- `rootMargin` khoảng `300px` đến `500px`; hiện tại `400px 0px` là hợp lý.
- Scroll nhanh không tạo request trùng, không skip page.
- Đổi lớp/học kỳ/khoa reset về page 1 và không append dữ liệu của filter cũ.
- Reload trang trên mobile không bắt đầu từ page đã restore ở desktop nếu trước đó lưu page lớn hơn 1.
- Khi hết dữ liệu, sentinel không tiếp tục gọi API.
- Khi API load thêm lỗi, có feedback và retry.
- Card mobile/tablet tiếp tục chỉ tập trung vào: họ tên, điểm, xếp loại, hành động admin; không đưa lại các cột desktop không cần thiết.

## 5. Test plan

### Manual desktop

1. Mở `/grading` ở viewport >= 1024px.
2. Chọn khoa, lớp, học kỳ và xác nhận.
3. Kiểm tra request summaries dùng `page=currentPage`, `limit=pageSize`.
4. Đổi page và page size, xác nhận table replace data, không append.

### Manual mobile/tablet

1. Mở `/grading` ở viewport < 1024px.
2. Xác nhận request đầu tiên là `page=1`, `limit=pageSize`.
3. Scroll gần cuối danh sách, trước khi chạm đáy phải tự gọi page tiếp theo.
4. Scroll nhanh nhiều lần, xác nhận không có request trùng/skip page.
5. Đổi filter, xác nhận danh sách cũ bị clear và page mới bắt đầu từ 1.
6. Reload trang sau khi đã load tới page 3, xác nhận mobile không bắt đầu bằng page 3 đơn lẻ.
7. Giả lập API load more lỗi, xác nhận có thông báo và retry được.

### Code checks

- Chạy lint/typecheck frontend nếu project có script tương ứng.
- Chạy test liên quan nếu có.
- Kiểm tra Network tab để xác nhận số request và thứ tự page.

## 6. Trạng thái hiện tại

Đã đúng phần cốt lõi:

- Sentinel đã nằm trong scroll container mobile.
- Observer đã dùng root là scroll container thay vì viewport.
- API đã chuyển về phân trang thật.
- Mobile card đã gọn hơn.

Cần bổ sung trước khi chốt production:

1. Request guard bằng ref để chống trigger trùng.
2. Reset/restore page riêng cho mobile infinite scroll.
3. Xử lý breakpoint desktop/mobile rõ ràng.
4. Không render sentinel khi loading/empty.
5. Error/retry state cho load more.