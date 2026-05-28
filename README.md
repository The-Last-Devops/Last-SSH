# Last SSH (Terminus Clone)

Một ứng dụng Desktop quản lý máy chủ SSH và SFTP hiện đại, được xây dựng dựa trên Electron, ReactJS và Vite. Ứng dụng mang lại trải nghiệm giống Termius, cho phép bạn dễ dàng quản lý thông tin kết nối, keys bảo mật, đồng bộ P2P và sử dụng Terminal tích hợp sành điệu.

## 🚀 Tính năng nổi bật

- **Quản lý máy chủ thông minh**: Quản lý hàng loạt Server (Hosts) theo Group, giao diện thân thiện.
- **Terminal siêu mượt**: Sử dụng `xterm.js` mô phỏng giao diện dòng lệnh chân thực, hỗ trợ các phím tắt, đổi màu.
- **Quản lý khóa bảo mật (Keychain)**: Hỗ trợ tạo, lưu trữ và kết nối bằng Private Key an toàn.
- **Truyền tải file (SFTP Browser)**: Quản lý thư mục máy chủ, upload/download tệp tin dễ dàng.
- **Đồng bộ hóa an toàn (P2P)**: Cho phép đồng bộ cấu hình qua mạng ngang hàng WebRTC an toàn giữa các thiết bị mà không cần máy chủ trung gian.
- **Theme sáng/tối (Dark/Light mode)**: Tự động hoặc thiết lập thủ công phù hợp với môi trường làm việc.

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 19, Vite
- **UI/UX**: HTML/CSS thuần (Tailored HSL design)
- **Desktop Core**: Electron
- **SSH/Terminal**: `ssh2` (kết nối Node.js SSH), `xterm.js` (giao diện command line)
- **Networking**: `peerjs` (WebRTC)

## 📦 Hướng dẫn cài đặt và chạy môi trường lập trình

Yêu cầu: Đã cài đặt **Node.js** (khuyến nghị phiên bản 20+).

1. Clone repository này về máy.
2. Mở terminal và chạy cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```
3. Chạy ứng dụng trong môi trường Development (cả React và Electron sẽ khởi động đồng thời):
   ```bash
   npm run dev:desktop
   ```
> Ghi chú: Nếu cổng `5173` bị chiếm dụng, vui lòng sử dụng lệnh `lsof -ti:5173 | xargs kill -9` (trên MacOS/Linux) để tắt tiến trình bị kẹt trước khi chạy lại.

## 🔨 Hướng dẫn Build (Đóng gói ứng dụng)

Ứng dụng hỗ trợ đóng gói đa nền tảng nhờ thư viện `electron-builder`.

### Build thủ công trên máy tính

1. Đầu tiên, hãy build giao diện web tĩnh:
   ```bash
   npm run build
   ```
2. Sau đó, chạy lệnh đóng gói tùy theo hệ điều hành của bạn:
   - **MacOS**: `npm run build:mac`
   - **Windows**: `npx electron-builder --win`
   - **Linux**: `npx electron-builder --linux`

File cài đặt thành phẩm (như `.dmg`, `.exe`, `.AppImage`) sẽ được lưu vào thư mục `dist-electron`.

### Build tự động bằng GitHub Actions (CI/CD)

Dự án đã được tích hợp sẵn Workflow GitHub Actions. 
- Bất cứ khi nào bạn **push code** lên nhánh `main` hoặc tạo một **Pull Request**, GitHub Actions sẽ tự động thực hiện tiến trình build song song trên 3 hệ điều hành: Windows, macOS và Ubuntu.
- Mỗi lần build thành công trên nhánh `main`, workflow sẽ tự động tạo một GitHub Release với các file đã đóng gói.
- Người dùng có thể tải bản build mới nhất tại trang releases:
  `https://github.com/<owner>/<repo>/releases/latest`

> Thay `<owner>/<repo>` bằng đường dẫn repository thực tế của bạn.
