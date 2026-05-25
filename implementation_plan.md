# Kế hoạch tích hợp E2E Browser Testing bằng Playwright (Kiểm thử Trình duyệt tự động)

Để đáp ứng yêu cầu cực kỳ thiết thực của bạn - xây dựng một quy trình kiểm thử trình duyệt thực tế tự động mô phỏng 100% hành vi của người dùng (giúp phát hiện lỗi UI, lỗi luồng hoạt động ngay lập tức khi cập nhật code mà không cần test thủ công) - chúng ta sẽ tích hợp **Playwright** vào dự án Terminus Clone.

---

## 1. Công nghệ Lựa chọn: Playwright

**Playwright (của Microsoft)** là công cụ kiểm thử E2E (End-to-End) mạnh mẽ và hiện đại nhất hiện nay dành cho ứng dụng Web nhờ các ưu điểm vượt trội:
* **Chạy trình duyệt thật:** Khởi chạy một trình duyệt Chromium thật, mô phỏng chính xác các sự kiện bấm phím, click chuột, kéo thả file của người dùng thật.
* **Tự động chờ đợi (Auto-wait):** Tự động chờ các phần tử UI render xong hoặc hiệu ứng chuyển động hoàn tất trước khi tương tác, giúp loại bỏ các test case bị lỗi do bất đồng bộ (flaky tests).
* **Kiểm thử đa thiết bị/đa trang (Multi-page contexts):** Có thể mở đồng thời 2 trình duyệt độc lập để kiểm thử **Đồng bộ hóa P2P WebRTC** giữa hai máy tính/thiết bị khác nhau (Thiết bị A gửi cấu hình - Thiết bị B nhận cấu hình)! Đây là đỉnh cao của kiểm thử E2E mà không công cụ nào khác làm được dễ dàng như Playwright.

---

## 2. Các kịch bản Kiểm thử Trình duyệt tự động sẽ xây dựng

Chúng ta sẽ viết kịch bản kiểm thử E2E tại tệp `e2e/terminus.spec.js` bao quát toàn bộ các luồng sử dụng thực tế của người dùng:

### Kịch bản 1: Mở ứng dụng & Khởi tạo Terminal
* Trình duyệt truy cập `http://localhost:5173`.
* Kiểm tra Sidebar và Tabbar hiển thị đầy đủ.
* Mô phỏng người dùng click nút `+ New Local Terminal` ở sidebar -> Đảm bảo một tab mới được tạo.
* Mô phỏng người dùng click vào màn hình Terminal, gõ chuỗi lệnh `mkdir e2e_test` và nhấn `Enter`.
* Gõ tiếp lệnh `ls` -> Xác minh trên màn hình Terminal hiển thị chính xác thư mục `e2e_test/` với phong cách màu xanh cyan đậm.

### Kịch bản 2: Luồng Bảo mật PIN & LockScreen
* Người dùng mở Modal Settings -> Tab Security -> Đăng ký mã PIN bảo mật `2026` và kích hoạt.
* Trình duyệt thực hiện tải lại trang (F5) -> Đảm bảo giao diện làm việc chính bị chặn hoàn toàn, màn hình `LockScreen` kính mờ hiển thị ở vị trí trung tâm.
* Trình duyệt gõ thử mã PIN sai `1111` -> Xác nhận thông báo lỗi hiển thị đỏ và thẻ màn hình khóa rung chấn.
* Trình duyệt gõ mã PIN đúng `2026` -> Xác nhận màn hình khóa biến mất và khôi phục môi trường Terminal làm việc hoàn hảo.

### Kịch bản 3: Tương tác SSH & Đồng bộ SFTP trực quan
* Người dùng click kết nối SSH ở Sidebar -> Tab SSH mới được tạo, bảng duyệt tệp SFTP visual tự động mở ra ở bên phải.
* Trình duyệt click nút `New Folder` ở bảng SFTP visual -> Tạo thư mục tên `remote_visual_folder`.
* Trình duyệt chuyển sang gõ lệnh `ls` ở Terminal SSH -> Xác nhận thư mục `remote_visual_folder/` tự động hiển thị trong Terminal remote (Đồng bộ hóa Visual -> Terminal).

### Kịch bản 4: Đồng bộ hóa P2P WebRTC song song giữa 2 thiết bị (Đặc biệt)
* Khởi chạy **2 Browser Contexts độc lập** (Page A đóng vai trò Máy gửi, Page B đóng vai trò Máy nhận).
* **Page A:** Tạo 1 connection SSH ảo lưu trữ, mở `P2PSyncModal` để xem Mã QR Code và Peer ID.
* **Page B:** Mở `P2PSyncModal`, điền mã Peer ID của Page A và nhấn Connect.
* Xác nhận hai trang thiết lập kết nối WebRTC trực tiếp thành công.
* **Page A:** Nhập mã PIN và nhấn gửi cấu hình.
* **Page B:** Nhận gói tin mã hóa, nhập PIN giải mã -> Xác nhận danh sách SSH connections của Page B được cập nhật đồng bộ giống hệt Page A tức thì mà không cần reload trang.

---

## 3. Cấu trúc thư mục tích hợp Playwright

Chúng ta sẽ thiết lập cấu trúc tệp tin kiểm thử E2E cực kỳ gọn gàng:

```
terminus-clone/
│
├── playwright.config.js        # Cấu hình Playwright (cổng 5173, chạy song song)
├── package.json                # Bổ sung lệnh "test:e2e" chạy Playwright
│
└── e2e/                        # Thư mục chứa kịch bản E2E
    └── terminus.spec.js        # File kịch bản kiểm thử E2E tự động trình duyệt
```

---

## 4. Kế hoạch Thực hiện

1. **Cài đặt thư viện:** Chạy lệnh cài đặt `@playwright/test` và tải các trình duyệt headless Chromium.
2. **Cấu hình:** Tạo tệp `playwright.config.js` liên kết với cổng chạy dev server của Vite (`http://localhost:5173`).
3. **Viết kịch bản:** Viết file `e2e/terminus.spec.js` với 4 kịch bản E2E đỉnh cao ở trên.
4. **Xác minh chạy thử:** Khởi chạy kiểm thử tự động `npm run test:e2e` và quan sát Playwright tự động hóa 100% quy trình.
