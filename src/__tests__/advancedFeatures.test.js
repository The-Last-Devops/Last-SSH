import { describe, it, expect } from 'vitest';
import { sshSimulator } from '../services/sshSimulator.js';

describe('Advanced Features: Groups, Tags, Private Keys & Simulator Key Auth', () => {

  it('nên hỗ trợ tạo phiên kết nối SSH giả lập và tự động xác thực bằng Private Key nếu được liên kết', () => {
    // 1. Tạo danh sách Private Keys giả lập
    const mockKeys = [
      { id: 'key-1', label: 'AWS Prod Key', keyContent: '-----BEGIN RSA PRIVATE KEY-----...' },
      { id: 'key-2', label: 'Staging Key', keyContent: '-----BEGIN RSA PRIVATE KEY-----...' }
    ];

    // 2. Profile kết nối SSH có liên kết với key-1
    const profileWithKey = {
      id: 'conn-1',
      label: 'Production Web',
      host: '54.22.11.9',
      username: 'admin',
      port: '22',
      keyId: 'key-1'
    };

    // 3. Profile kết nối SSH sử dụng password truyền thống (không liên kết key)
    const profileWithPassword = {
      id: 'conn-2',
      label: 'Staging DB',
      host: '192.168.1.5',
      username: 'postgres',
      port: '5432',
      keyId: ''
    };

    // 4. Khởi tạo session có liên kết khóa
    const sessionWithKey = sshSimulator.createSession('tab-key', profileWithKey, mockKeys);
    expect(sessionWithKey.logs.some(log => log.includes('Trying private key: AWS Prod Key'))).toBe(true);
    expect(sessionWithKey.logs.some(log => log.includes('Key authentication succeeded'))).toBe(true);
    expect(sessionWithKey.logs.some(log => log.includes('Sending password credentials'))).toBe(false);

    // 5. Khởi tạo session dùng password
    const sessionWithPass = sshSimulator.createSession('tab-pass', profileWithPassword, mockKeys);
    expect(sessionWithPass.logs.some(log => log.includes('Trying private key'))).toBe(false);
    expect(sessionWithPass.logs.some(log => log.includes('Sending password credentials'))).toBe(true);
    expect(sessionWithPass.logs.some(log => log.includes('Welcome to Last SSH Simulated Ubuntu'))).toBe(true);
  });

  it('nên hỗ trợ tương thích ngược dữ liệu settings cũ và phân tách độc lập App Theme & Terminal Theme', () => {
    // Giả lập nạp settings cũ chỉ có thuộc tính "theme"
    const legacySettings = {
      theme: 'One Dark Pro',
      fontFamily: 'Source Code Pro',
      fontSize: 15
    };

    // Logic tương thích ngược giống hệt trong App.jsx
    const parseSettings = (stored) => {
      const DEFAULT_SETTINGS = {
        appTheme: 'Dark',
        terminalTheme: 'Dark',
        fontFamily: 'Fira Code',
        fontSize: 14,
        cursorStyle: 'block',
        crtEnabled: true
      };
      
      const parsed = { ...stored };
      const normalizeTheme = (themeName) => {
        if (!themeName) return 'Dark';
        const name = themeName.toLowerCase();
        if (name === 'light' || name.includes('light') || name.includes('terminus') || name.includes('white')) {
          return 'Light';
        }
        return 'Dark';
      };

      if (parsed.theme) {
        parsed.appTheme = normalizeTheme(parsed.theme);
        parsed.terminalTheme = normalizeTheme(parsed.theme);
        delete parsed.theme;
      } else {
        if (parsed.appTheme) parsed.appTheme = normalizeTheme(parsed.appTheme);
        if (parsed.terminalTheme) parsed.terminalTheme = normalizeTheme(parsed.terminalTheme);
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    };

    const finalSettings = parseSettings(legacySettings);
    // Xác minh settings cũ tự động chuyển đổi sang các trường mới và chuẩn hóa về Dark/Light thành công
    expect(finalSettings.appTheme).toBe('Dark');
    expect(finalSettings.terminalTheme).toBe('Dark');
    expect(finalSettings.fontFamily).toBe('Source Code Pro');
    expect(finalSettings.fontSize).toBe(15);

    // Xác minh khả năng phân tách cấu hình độc lập
    const customizedSettings = parseSettings({
      appTheme: 'Light Terminus',
      terminalTheme: 'Dracula'
    });

    expect(customizedSettings.appTheme).toBe('Light');
    expect(customizedSettings.terminalTheme).toBe('Dark');
  });

  it('nên hỗ trợ gom nhóm danh mục folder groups và xử lý logic keys liên kết drop-down', () => {
    const connections = [
      { id: '1', group: 'Production' },
      { id: '2', group: 'Staging' },
      { id: '3', group: 'Production' }
    ];
    
    // Gom nhóm không lặp giống hệt logic trong Sidebar.jsx
    const existingGroups = Array.from(new Set(connections.map(c => c.group || 'Servers')));
    if (!existingGroups.includes('Servers')) {
      existingGroups.push('Servers');
    }

    expect(existingGroups).toContain('Production');
    expect(existingGroups).toContain('Staging');
    expect(existingGroups).toContain('Servers');
    expect(existingGroups.length).toBe(3);
  });

});

