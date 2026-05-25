import { test, expect } from '@playwright/test';

test.describe('Last SSH E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Đăng ký script tiêm cờ __e2e__ vào window trước khi React tải
    await page.addInitScript(() => {
      window.__e2e__ = true;
    });
    // Truy cập ứng dụng trước mỗi test case
    await page.goto('/');
    // Đảm bảo phần tử chứa layout chính đã render
    await page.waitForSelector('.glass-container');
  });

  test('Kịch bản 1: Mở ứng dụng, tạo Terminal cục bộ và chạy lệnh ảo', async ({ page }) => {
    // 1. Kiểm tra sidebar và nút "New Local Terminal"
    const btnNewLocal = page.locator('#btn-new-local');
    await expect(btnNewLocal).toBeVisible();

    // 2. Click tạo thêm tab mới
    await btnNewLocal.click();

    // 3. Focus vào Terminal input ẩn và chạy thử lệnh mkdir
    const hiddenInput = page.locator('.terminal-hidden-input');
    await expect(hiddenInput).toBeFocused();

    // Nhập lệnh tạo thư mục ảo
    await hiddenInput.fill('mkdir e2e_test_folder');
    await page.keyboard.press('Enter');

    // Chạy lệnh ls để xem thư mục
    await hiddenInput.fill('ls');
    await page.keyboard.press('Enter');

    // Xác nhận kết quả hiển thị thư mục e2e_test_folder trong terminal history
    const terminalHistory = page.locator('.terminal-history');
    await expect(terminalHistory).toContainText('e2e_test_folder');

    // Chạy lệnh neofetch để xem thông tin hệ thống giả lập
    await hiddenInput.fill('neofetch');
    await page.keyboard.press('Enter');
    // Cập nhật string chính xác từ shellEngine
    await expect(terminalHistory).toContainText('OS: Last SSH Web OS v1.0');

    // Chạy lệnh clear để dọn sạch màn hình
    await hiddenInput.fill('clear');
    await page.keyboard.press('Enter');
    
    // Màn hình history phải rỗng sau lệnh clear
    await expect(terminalHistory).toBeEmpty();
  });

  test('Kịch bản 2: Đăng ký mã PIN bảo mật, reload trang và kiểm tra màn hình khóa LockScreen', async ({ page }) => {
    // 1. Đăng ký Dialog handler để tự động bấm OK khi hiện Alert đã cài PIN thành công
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('thiết lập mã PIN bảo mật thành công');
      await dialog.accept();
    });

    // 2. Mở Settings Modal
    const btnSettings = page.locator('#btn-settings');
    await btnSettings.click();
    await page.waitForSelector('.modal-content');

    // 3. Nhấp chọn Tab Security
    const tabSecurity = page.locator('.settings-tab-btn:has-text("Security")');
    await tabSecurity.click();

    // 4. Điền PIN mới để kích hoạt bảo mật
    const pinInputs = page.locator('input[type="password"]');
    await expect(pinInputs).toHaveCount(2);

    await pinInputs.nth(0).fill('2026');
    await pinInputs.nth(1).fill('2026');

    // Nhấn Submit
    await page.locator('button[type="submit"]:has-text("Enable Security PIN")').click();

    // Chờ Settings Modal được tắt (chúng ta click nút Done hoặc tắt modal)
    await page.locator('.modal-close-btn').click();

    // 5. Tải lại trang (Reload) để kích hoạt màn hình khóa
    await page.reload();
    
    // Đảm bảo màn hình LockScreen hiển thị chắn toàn bộ trang
    const lockScreen = page.locator('.lockscreen-overlay');
    await expect(lockScreen).toBeVisible();

    // 6. Thử nhập mã PIN sai: 1111 bằng cách click phím keypad
    const btnKeypad1 = page.getByRole('button', { name: '1', exact: true });
    await btnKeypad1.click();
    await btnKeypad1.click();
    await btnKeypad1.click();
    await btnKeypad1.click();

    // Chờ phản hồi lỗi
    const errorLabel = page.locator('.error-label');
    await expect(errorLabel).toContainText('Mã PIN không chính xác');

    // 7. Nhập mã PIN đúng: 2026
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '6', exact: true }).click();

    // Xác nhận màn hình khóa LockScreen biến mất hoàn toàn
    await expect(lockScreen).not.toBeVisible();
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('Kịch bản 3: Tương tác kết nối SSH giả lập và đồng bộ SFTP visual split-pane', async ({ page }) => {
    // 1. Nhấn nút tạo kết nối SSH mới trên Sidebar
    const btnAddConn = page.locator('#btn-add-conn');
    await btnAddConn.click();
    await page.waitForSelector('.connection-form-container');

    // 2. Điền form kết nối mới
    await page.locator('input[placeholder="e.g. Production Server"]').fill('E2E Test SSH');
    await page.locator('input[placeholder="e.g. 192.168.1.100"]').fill('10.0.0.1');
    await page.locator('input[placeholder="ubuntu"]').fill('testuser');
    await page.locator('input[placeholder="Leave blank for key auth"]').fill('securepwd');

    // Nhấn lưu kết nối
    await page.locator('button[type="submit"]:has-text("Save")').click();

    // Xác nhận kết nối SSH được hiển thị trong danh sách saved hosts
    const connItem = page.locator('.connection-item:has-text("E2E Test SSH")');
    await expect(connItem).toBeVisible();

    // 3. Click vào kết nối SSH này để mở phiên kết nối
    await connItem.click();

    // Xác nhận Tab SSH mới được mở và panel SFTP visual xuất hiện ở bên phải
    await page.waitForSelector('.sftp-pane');
    await expect(page.locator('.terminal-history')).toContainText('Starting SSH connection to E2E Test SSH');

    // 4. Bấm tạo thư mục trực quan từ bảng SFTP Browser
    const btnNewFolderSFTP = page.locator('button:has-text("New Folder")');
    if (await btnNewFolderSFTP.isVisible()) {
      // Mock prompt input của trình duyệt khi hỏi tên thư mục
      page.once('dialog', async dialog => {
        await dialog.accept('remote_visual_folder');
      });
      await btnNewFolderSFTP.click();
      
      // Chờ thư mục hiển thị trên bảng tệp tin SFTP
      await expect(page.locator('.sftp-grid')).toContainText('remote_visual_folder');

      // 5. Kiểm tra xem Terminal SSH đã được đồng bộ in ra log và prompt chưa
      const hiddenInput = page.locator('.terminal-hidden-input');
      await hiddenInput.fill('ls');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.terminal-history')).toContainText('remote_visual_folder');
    }
  });

  test('Kịch bản 4: Đồng bộ P2P WebRTC song song giữa 2 browser contexts', async ({ browser }) => {
    // Để BroadcastChannel hoạt động offline hoàn hảo và nhanh chóng chéo trang,
    // chúng ta sẽ chạy hai trang trong CÙNG MỘT browser context (tabs).
    const context = await browser.newContext();
    
    // Tự động tiêm cờ __e2e__ cho cả hai trang mới mở
    await context.addInitScript(() => {
      window.__e2e__ = true;
    });

    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Truy cập ứng dụng ở cả 2 trang
    await pageA.goto('/');
    await pageB.goto('/');

    await pageA.waitForSelector('.glass-container');
    await pageB.waitForSelector('.glass-container');

    // 2. Thiết bị A (Máy gửi): Thêm một server để gửi đi
    const btnAddConnA = pageA.locator('#btn-add-conn');
    await btnAddConnA.click();
    await pageA.locator('input[placeholder="e.g. Production Server"]').fill('P2P Server Source');
    await pageA.locator('input[placeholder="e.g. 192.168.1.100"]').fill('192.168.4.4');
    await pageA.locator('button[type="submit"]:has-text("Save")').click();

    // 3. Cả 2 thiết bị cùng mở Modal P2P Sync
    await pageA.locator('#btn-p2p').click();
    await pageB.locator('#btn-p2p').click();

    await pageA.waitForSelector('.modal-content');
    await pageB.waitForSelector('.modal-content');

    // 4. Lấy Peer ID từ thiết bị A
    const peerIdBadgeA = pageA.locator('.p2p-peer-id-badge');
    await expect(peerIdBadgeA).not.toBeEmpty();
    const peerIdA = (await peerIdBadgeA.innerText()).trim();

    // 5. Thiết bị B (Máy nhận): Nhập Peer ID của Thiết bị A vào và click Connect
    const inputPeerB = pageB.locator('input[placeholder="e.g. mock-peer-5678"]');
    await inputPeerB.fill(peerIdA);

    await pageB.locator('button:has-text("Ghép Đôi Thiết Bị")').click();

    // 6. Chờ trạng thái Đã kết nối xuất hiện ở cả hai thiết bị
    await pageA.waitForSelector('span:has-text("Đã kết nối P2P thành công!")');
    await pageB.waitForSelector('span:has-text("Đã kết nối P2P thành công!")');

    // 7. Thiết bị A: Điền mã PIN đồng bộ ảo
    await pageA.locator('input[placeholder="Thiết lập PIN 4-6 số để bên nhận giải mã"]').fill('7890');
    
    // Nhấp gửi cấu hình
    await pageA.locator('button:has-text("Mã hóa & Gửi toàn bộ cấu hình")').click();
    await expect(pageA.locator('text=Đã gửi dữ liệu mã hóa thành công')).toBeVisible();

    // 8. Thiết bị B: Phát hiện gói tin đã nhận. Nhập PIN 7890 để giải mã và áp dụng
    await pageB.waitForSelector('text=Thiết bị đối tác vừa gửi cho bạn một gói cấu hình Last SSH!');
    await pageB.locator('input[placeholder="Nhập PIN giải mã"]').fill('7890');

    // Bấm Giải mã và Áp dụng
    pageB.once('dialog', async dialog => {
      await dialog.accept(); // Chấp nhận alert đồng bộ hóa thành công
    });
    await pageB.locator('button:has-text("Giải mã & Áp dụng ngay")').click();

    // 9. Xác nhận kết nối SSH 'P2P Server Source' tự động xuất hiện ở Sidebar của Thiết bị B
    await expect(pageB.locator('.connection-item:has-text("P2P Server Source")')).toBeVisible();

    // Đóng context
    await context.close();
  });

});
