import { describe, it, expect, beforeEach } from 'vitest';
import { sshSimulator } from '../services/sshSimulator.js';

describe('SSH & SFTP Simulator Service (sshSimulator)', () => {
  const tabId = 'test-ssh-tab';
  const profile = {
    id: 'server-1',
    label: 'Staging Server',
    host: '10.0.0.5',
    port: '22',
    username: 'deployer'
  };

  beforeEach(() => {
    sshSimulator.closeSession(tabId);
  });

  it('nên khởi tạo phiên kết nối SSH với cấu hình chính xác', () => {
    const session = sshSimulator.createSession(tabId, profile);
    
    expect(session).not.toBeNull();
    expect(session.host).toBe('10.0.0.5');
    expect(session.username).toBe('deployer');
    expect(session.currentPath).toBe('/home/deployer');
    expect(session.logs.length).toBeGreaterThan(5);
    expect(session.logs[0]).toContain('Connecting to deployer@10.0.0.5:22');
  });

  it('nên thực thi các lệnh dòng lệnh SSH từ xa chính xác (pwd, cd, mkdir, ls, cat)', () => {
    sshSimulator.createSession(tabId, profile);

    // pwd
    const resPwd = sshSimulator.executeCommand(tabId, 'pwd');
    expect(resPwd.stdout).toBe('/home/deployer');

    // mkdir & ls
    sshSimulator.executeCommand(tabId, 'mkdir builds');
    const resLs = sshSimulator.executeCommand(tabId, 'ls');
    expect(resLs.stdout).toContain('builds');

    // cd vào thư mục mới tạo
    const resCd = sshSimulator.executeCommand(tabId, 'cd builds');
    expect(resCd.newPath).toBe('/home/deployer/builds');
    expect(resCd.stderr).toBe('');

    // touch & cat
    sshSimulator.executeCommand(tabId, 'touch version.txt');
    // ghi nội dung file từ sftp simulator để test
    sshSimulator.sftpUpload(tabId, '/home/deployer/builds', 'version.txt', 'v1.0.0-rc1');

    const resCat = sshSimulator.executeCommand(tabId, 'cat version.txt');
    expect(resCat.stdout).toBe('v1.0.0-rc1');
  });

  it('nên xử lý các thao tác SFTP trực quan đồng bộ hoàn hảo với phiên SSH', () => {
    sshSimulator.createSession(tabId, profile);

    const remotePath = '/home/deployer';

    // Tạo thư mục qua SFTP
    const mkdirSuccess = sshSimulator.sftpMkdir(tabId, remotePath, 'static');
    expect(mkdirSuccess).toBe(true);

    // Kiểm tra ls terminal xem static có xuất hiện ko
    const lsRes = sshSimulator.executeCommand(tabId, 'ls');
    expect(lsRes.stdout).toContain('static');

    // Upload file giả lập qua SFTP
    const uploadSuccess = sshSimulator.sftpUpload(tabId, '/home/deployer/static', 'app.js', 'console.log("react")');
    expect(uploadSuccess).toBe(true);

    // Download tệp tin giả lập qua SFTP
    const content = sshSimulator.sftpDownload(tabId, '/home/deployer/static', 'app.js');
    expect(content).toBe('console.log("react")');

    // Xóa mục qua SFTP
    const rmSuccess = sshSimulator.sftpRm(tabId, '/home/deployer/static', 'app.js');
    expect(rmSuccess).toBe(true);

    // Kiểm tra danh sách SFTP lại
    const items = sshSimulator.sftpList(tabId, '/home/deployer/static');
    expect(items.length).toBe(0);
  });
});
