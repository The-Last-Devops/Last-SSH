# Kế hoạch nâng cấp Terminus Clone: Quản lý SSH Keys, Nhóm Server & Phân loại Thẻ (Host Groups & Tags)

Để đưa ứng dụng **Terminus Clone** tiệm cận 100% với ứng dụng gốc **Terminus/Tabby** về cả tính năng lẫn trải nghiệm quản trị hệ thống chuyên nghiệp, chúng ta sẽ tiến hành nâng cấp các mảng quản lý quan trọng sau:

---

## Các tính năng đề xuất nâng cấp

### 1. Quản lý SSH Private Keys (Key Management)
* **Tính năng gốc:** Trong Terminus, người dùng không cần gõ mật khẩu trực tiếp cho từng server mà có thể quản lý tập trung các SSH Private Keys (`id_rsa`, `id_ed25519`).
* **Giải pháp triển khai:**
  * **SSH Keys Manager Tab:** Thêm một tab quản lý SSH Private Keys trong **SettingsModal**.
  * Cho phép người dùng tạo hoặc dán các SSH Keys ảo (tên Key, loại Key: RSA hoặc Ed25519, Nội dung Key, Mật khẩu giải mã passphrase nếu có).
  * Các Private Keys này sẽ được mã hóa an toàn qua **AES-GCM** và lưu trữ bảo mật bằng Master PIN cùng với danh sách server.
  * **Liên kết Key:** Khi thêm/sửa Connection SSH ở Sidebar, người dùng sẽ có một ô lựa chọn: *Xác thực bằng Mật khẩu* hoặc *Chọn một SSH Private Key đã lưu* từ danh sách dropdown.

### 2. Quản lý Nhóm Server & Phân loại Thẻ (Host Groups & Tags)
* **Tính năng gốc:** Người dùng có hàng trăm server, cần gom nhóm chúng vào các thư mục (Groups) và gắn Thẻ (Tags) môi trường (ví dụ: Production, Staging, Dev) để thao tác nhanh.
* **Giải pháp triển khai:**
  * **Cấu hình Group & Tags:** Bổ sung trường `group` (nhóm máy chủ) và `tags` (mảng các thẻ tag, ngăn cách bằng dấu phẩy) vào Form tạo/sửa Connection.
  * **Giao diện Gom nhóm Expandable (Sidebar Folders):**
    * Thay vì hiển thị danh sách phẳng, Sidebar sẽ tự động phân loại và gom nhóm các máy chủ theo `group`.
    * Mỗi Group sẽ hiển thị dưới dạng một thư mục (Folder) Glassmorphism sang đẹp, có nút Toggle đóng/mở (Expand/Collapse) kèm hiệu ứng chuyển động mượt mà.
    * Các máy chủ không có group sẽ nằm ở mục chung "Ungrouped".
  * **Gắn Thẻ Tags màu sắc:** Mỗi Host Card sẽ hiển thị các badge màu sắc (đỏ cho `prod`, vàng cho `staging`, xanh cho `dev`) cực kỳ bắt mắt.

### 3. Thanh tìm kiếm nhanh (Sidebar Live Search)
* Bổ sung một ô tìm kiếm Glassmorphism bóng bẩy ở đầu danh sách máy chủ trong Sidebar.
* Cho phép tìm kiếm và lọc thời gian thực danh sách máy chủ theo: Tên (Label), Địa chỉ IP/Host, Username, Tên Nhóm (Group) hoặc các Thẻ Tag.

### 4. Tinh chỉnh màu sắc & Giao diện chuẩn Terminus
* Cập nhật hệ thống màu sắc HSL trong `src/index.css` để các thẻ tag, các folder group và bảng kết nối có màu đặc trưng chuẩn Terminus (slate-grey, neon-accent, border-transparency).

---

## Đề xuất sửa đổi mã nguồn (Proposed File Changes)

Để thực hiện nâng cấp này, chúng ta cần chỉnh sửa các tệp tin sau:

### 1. [MODIFY] [App.jsx](file:///Users/KienNT/Code/kien/terminus-clone/src/App.jsx)
* Khởi tạo thêm State `sshKeys` (danh sách các SSH private keys).
* Đồng bộ hóa cơ chế mã hóa lưu trữ: Lưu cả `connections`, `settings`, và `sshKeys` chung vào payload mã hóa LocalStorage khi có thay đổi.
* Truyền danh sách `sshKeys` vào `Sidebar` và `SettingsModal`.

### 2. [MODIFY] [Sidebar.jsx](file:///Users/KienNT/Code/kien/terminus-clone/src/components/Sidebar.jsx) & [Sidebar.css](file:///Users/KienNT/Code/kien/terminus-clone/src/components/Sidebar.css)
* Thêm ô tìm kiếm `Live Search` ở trên danh sách host.
* Bổ sung trường `group` (textbox), `tags` (textbox phẩy), và `keyId` (select dropdown lấy từ `sshKeys`) vào Form thêm/sửa connection.
* Viết logic gom nhóm danh sách máy chủ theo `group` và hiển thị giao diện folder đóng mở.
* Kết xuất các badge Tag nhiều màu sắc cho mỗi máy chủ.

### 3. [MODIFY] [SettingsModal.jsx](file:///Users/KienNT/Code/kien/terminus-clone/src/components/SettingsModal.jsx) & [SettingsModal.css](file:///Users/KienNT/Code/kien/terminus-clone/src/components/SettingsModal.css)
* Bổ sung Tab **"SSH Private Keys"** bên trong Modal.
* Xây dựng giao diện danh sách Key đã lưu, cho phép thêm Key mới (pasted RSA/Ed25519) và xóa Key.

### 4. [MODIFY] [sshSimulator.js](file:///Users/KienNT/Code/kien/terminus-clone/src/services/sshSimulator.js)
* Cập nhật simulator: Khi kết nối SSH, hiển thị dòng log xác thực Key tương ứng nếu server cấu hình dùng Key thay vì mật khẩu (e.g. `[SSH] Authenticating with private key: id_rsa... Access granted`).

---

## Kế hoạch Kiểm thử nâng cấp (Verification Plan)

### 1. Kiểm thử Tự động bổ sung (Vitest):
* Viết tệp kiểm thử mới `src/__tests__/sshKeys.test.js` để đảm bảo lưu trữ, liên kết Key hoạt động chính xác.
* Chạy lại toàn bộ bộ 23 tests cũ để đảm bảo không phát sinh lỗi phá vỡ hệ thống cũ.

### 2. Kiểm thử thủ công:
1. **Quản lý Key:** Vào Settings -> SSH Private Keys -> Thêm 1 key mới đặt tên là `deploy_key`.
2. **Tạo Server dùng Key & Group/Tags:** Tạo một server mới:
   - Label: `KienNT Prod API`
   - Group: `Production`
   - Tags: `prod, api, gateway`
   - Authentication: Chọn `deploy_key` làm phương thức xác thực.
3. **Sidebar Folder & Filter:**
   - Đảm bảo ở Sidebar xuất hiện thư mục "PRODUCTION" chứa server vừa tạo. Bấm đóng mở thư mục mượt mà.
   - Thử gõ `gateway` vào ô Tìm kiếm xem danh sách có lọc chính xác server đó không.
4. **Mô phỏng SSH:** Bấm Connect server đó -> Đảm bảo terminal in ra dòng chữ xác thực bằng Key: `[SSH] Authenticating with private key: deploy_key...`.
