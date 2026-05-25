import { describe, it, expect, beforeEach } from 'vitest';
import { virtualFS } from '../services/virtualFS.js';

describe('Virtual File System (virtualFS)', () => {
  beforeEach(() => {
    // Reset hệ thống tệp về mặc định trước mỗi test case
    virtualFS.reset();
  });

  it('nên khởi tạo cấu trúc thư mục mặc định chính xác', () => {
    const rootContents = virtualFS.list('/');
    const names = rootContents.map(c => c.name);
    expect(names).toContain('home');
    expect(names).toContain('var');
    expect(names).toContain('etc');

    const homeContents = virtualFS.list('/home/user/documents');
    const docNames = homeContents.map(c => c.name);
    expect(docNames).toContain('welcome.txt');
    expect(docNames).toContain('todo.txt');
  });

  it('nên phân giải đường dẫn tuyệt đối và tương đối chính xác (resolvePath)', () => {
    // Phân giải tương đối
    const res1 = virtualFS.resolvePath('/home/user', 'documents');
    expect(res1.absolutePath).toBe('/home/user/documents');
    expect(res1.node.type).toBe('dir');

    // Phân giải đi ngược lên (..)
    const res2 = virtualFS.resolvePath('/home/user/documents', '..');
    expect(res2.absolutePath).toBe('/home/user');
    expect(res2.node.type).toBe('dir');

    // Phân giải đi ngược lên 3 lần (../../../var)
    const res3 = virtualFS.resolvePath('/home/user/documents', '../../../var');
    expect(res3.absolutePath).toBe('/var');
    expect(res3.node.name).toBe('var');

    // Phân giải tuyệt đối
    const res4 = virtualFS.resolvePath('/home/user', '/etc');
    expect(res4.absolutePath).toBe('/etc');
    expect(res4.node.name).toBe('etc');

    // Đường dẫn không tồn tại
    const res5 = virtualFS.resolvePath('/home/user', 'nonexistent');
    expect(res5.node).toBeNull();
    expect(res5.absolutePath).toBeNull();
  });

  it('nên tạo được thư mục mới (mkdir)', () => {
    const success = virtualFS.mkdir('/home/user', 'projects');
    expect(success).toBe(true);

    const contents = virtualFS.list('/home/user');
    const names = contents.map(c => c.name);
    expect(names).toContain('projects');

    // Không được tạo trùng tên
    expect(() => {
      virtualFS.mkdir('/home/user', 'projects');
    }).toThrow();

    // Không được tạo với ký tự không hợp lệ
    expect(() => {
      virtualFS.mkdir('/home/user', 'invalid/name');
    }).toThrow();
  });

  it('nên ghi và đọc nội dung tệp chính xác (writeFile & readFile)', () => {
    // Ghi file mới
    const writeSuccess = virtualFS.writeFile('/home/user', 'notes.txt', 'Học React rất vui!');
    expect(writeSuccess).toBe(true);

    // Đọc file
    const content = virtualFS.readFile('/home/user', 'notes.txt');
    expect(content).toBe('Học React rất vui!');

    // Ghi đè file cũ
    virtualFS.writeFile('/home/user', 'notes.txt', 'Nội dung mới');
    const updatedContent = virtualFS.readFile('/home/user', 'notes.txt');
    expect(updatedContent).toBe('Nội dung mới');

    // Lỗi khi đọc file ko tồn tại
    expect(() => {
      virtualFS.readFile('/home/user', 'ghost.txt');
    }).toThrow();

    // Lỗi khi ghi tệp trùng tên với thư mục sẵn có
    expect(() => {
      virtualFS.writeFile('/home', 'user', 'nội dung');
    }).toThrow();
  });

  it('nên xóa được tệp hoặc thư mục chính xác (rm)', () => {
    // Xóa tệp
    const rmFileSuccess = virtualFS.rm('/home/user/documents', 'welcome.txt');
    expect(rmFileSuccess).toBe(true);
    
    const docs = virtualFS.list('/home/user/documents');
    const docNames = docs.map(c => c.name);
    expect(docNames).not.toContain('welcome.txt');

    // Xóa thư mục
    const rmDirSuccess = virtualFS.rm('/home', 'user');
    expect(rmDirSuccess).toBe(true);

    const home = virtualFS.list('/home');
    const homeNames = home.map(c => c.name);
    expect(homeNames).not.toContain('user');

    // Thử xóa mục không tồn tại
    expect(() => {
      virtualFS.rm('/home', 'ghost');
    }).toThrow();
  });
});
