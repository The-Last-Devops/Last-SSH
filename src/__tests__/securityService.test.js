import { describe, it, expect, beforeEach } from 'vitest';
import { securityService } from '../services/securityService.js';

describe('Security & Encryption Service (securityService)', () => {
  beforeEach(() => {
    // Reset bộ nhớ bảo mật trước mỗi test case
    securityService.resetSecurity();
  });

  it('nên có trạng thái ban đầu là chưa thiết lập PIN', () => {
    expect(securityService.hasPIN()).toBe(false);
  });

  it('nên mã hóa và giải mã trực tiếp dữ liệu chính xác (encrypt & decrypt)', async () => {
    const plaintext = 'Dữ liệu tuyệt mật của KienNT!';
    const password = 'mySecretPin123';

    // Mã hóa
    const encrypted = await securityService.encrypt(plaintext, password);
    expect(encrypted).toContain('.'); // có định dạng salt.iv.ciphertext
    
    // Giải mã với mật khẩu đúng
    const decrypted = await securityService.decrypt(encrypted, password);
    expect(decrypted).toBe(plaintext);

    // Thử giải mã với mật khẩu sai -> Phải ném ra lỗi
    await expect(securityService.decrypt(encrypted, 'wrongPass')).rejects.toThrow();
  });

  it('nên thiết lập và đăng nhập bằng PIN thành công (setupPIN & unlockWithPIN)', async () => {
    const secretData = { sshKey: 'ssh-rsa AAAAB3Nza...', host: '192.168.1.1' };
    const pin = '2026';

    // Thiết lập PIN
    const setupSuccess = await securityService.setupPIN(pin, secretData);
    expect(setupSuccess).toBe(true);
    expect(securityService.hasPIN()).toBe(true);

    // Khóa ứng dụng
    securityService.lock();
    expect(securityService.isUnlocked).toBe(false);

    // Mở khóa với PIN đúng
    const unlockedData = await securityService.unlockWithPIN(pin);
    expect(securityService.isUnlocked).toBe(true);
    expect(unlockedData).toEqual(secretData);

    // Khóa lại và thử mở khóa với PIN sai
    securityService.lock();
    await expect(securityService.unlockWithPIN('1111')).rejects.toThrow();
    expect(securityService.isUnlocked).toBe(false);
  });

  it('nên ném lỗi khi cập nhật dữ liệu nếu phiên làm việc đang khóa hoặc hết hạn', async () => {
    const pin = '9999';
    await securityService.setupPIN(pin, { connections: [] });

    // Khóa app
    securityService.lock();
    await expect(securityService.saveSecureData({ connections: ['new'] })).rejects.toThrow();

    // Mở khóa bằng PIN đúng
    await securityService.unlockWithPIN(pin);
    
    // Lưu dữ liệu thành công sau khi mở khóa
    const saveSuccess = await securityService.saveSecureData({ connections: ['new_server'] });
    expect(saveSuccess).toBe(true);
  });
});
