import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Last SSH Visual UI Tests & Screenshot Captures', () => {

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

  test('Chụp ảnh màn hình giao diện để phân tích tối ưu hóa thiết kế', async ({ page }) => {
    // Đảm bảo thư mục lưu ảnh chụp màn hình tồn tại
    const screenshotDir = path.resolve('./test-results/screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // 1. Chụp ảnh màn hình giao diện chính (Main Workspace) - Mặc định Glass Aura
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot_main_screen.png') });

    // 2. Mở Settings Modal và chụp tab Appearance
    const btnSettings = page.locator('#btn-settings');
    await btnSettings.click();
    await page.waitForSelector('.modal-content');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot_settings_appearance.png') });

    // Đổi App Theme và Terminal Theme sang Light mới để chụp ảnh giao diện sáng
    await page.locator('.theme-grid').first().locator('.theme-card:has-text("Light")').click();
    await page.locator('.theme-grid').last().locator('.theme-card:has-text("Light")').click();
    
    // Đóng settings để chụp màn hình chính theme sáng màu
    await page.locator('.modal-close-btn').click();
    await page.waitForTimeout(500); // Chờ hiệu ứng chuyển màu mượt mà
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot_light_theme_main.png') });

    // Mở lại Settings để các bước test tiếp theo (chụp tab keys và lockscreen) chạy trơn tru
    await btnSettings.click();
    await page.waitForSelector('.modal-content');

    // 3. Chuyển sang Tab Private Keys và chụp tab Private Keys
    const tabKeys = page.locator('#tab-settings-keys');
    await tabKeys.click();
    await page.waitForSelector('.key-setup-form');
    
    // Thêm thử một khóa giả lập để giao diện hiển thị phong phú hơn
    await page.locator('#input-key-label').fill('Visual Mock Key');
    await page.locator('#input-key-content').fill('-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEA0y6...\n-----END RSA PRIVATE KEY-----');
    
    // Đăng ký Dialog handler để tự động bấm OK khi thêm key thành công
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('#btn-save-key').click();

    // Chờ khóa hiển thị
    await page.waitForSelector('.key-item-card');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot_settings_keys.png') });

    // Tắt modal settings
    await page.locator('.modal-close-btn').click();

    // 4. Thiết lập khóa ứng dụng để chụp màn hình LockScreen kính mờ
    await btnSettings.click();
    await page.waitForSelector('.modal-content');
    
    const tabSecurity = page.locator('#tab-settings-security');
    await tabSecurity.click();
    
    const pinInputs = page.locator('input[type="password"]');
    await pinInputs.nth(0).fill('8888');
    await pinInputs.nth(1).fill('8888');
    
    // Đăng ký dialog handler đã thiết lập PIN thành công
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('button[type="submit"]:has-text("Enable Security PIN")').click();
    
    // Tắt settings modal và reload
    await page.locator('.modal-close-btn').click();
    await page.reload();

    // Chờ LockScreen hiển thị và chụp màn hình khóa
    await page.waitForSelector('.lockscreen-overlay');
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot_lock_screen.png') });
  });

});
