import { describe, it, expect, beforeEach } from 'vitest';
import { shellEngine } from '../services/shellEngine.js';
import { virtualFS } from '../services/virtualFS.js';

describe('Shell Command Engine (shellEngine)', () => {
  beforeEach(() => {
    virtualFS.reset();
  });

  it('nên tách đối số hỗ trợ dấu ngoặc kép chính xác (parseArgs)', () => {
    const args1 = shellEngine.parseArgs('echo "hello world" test');
    expect(args1).toEqual(['echo', 'hello world', 'test']);

    const args2 = shellEngine.parseArgs("mkdir 'new folder'");
    expect(args2).toEqual(['mkdir', 'new folder']);
  });

  it('nên thực thi lệnh help và pwd chính xác', () => {
    const resHelp = shellEngine.execute('/home/user', 'help');
    expect(resHelp.stdout).toContain('Hệ thống Terminus Clone v1.0.0');
    expect(resHelp.stderr).toBe('');

    const resPwd = shellEngine.execute('/home/user/documents', 'pwd');
    expect(resPwd.stdout).toBe('/home/user/documents');
  });

  it('nên thực thi các lệnh tạo và hiển thị tệp chính xác (mkdir, touch, cat, ls)', () => {
    // mkdir
    shellEngine.execute('/home/user', 'mkdir temp');
    const items = virtualFS.list('/home/user');
    expect(items.map(i => i.name)).toContain('temp');

    // touch & ls
    shellEngine.execute('/home/user/temp', 'touch index.js');
    const lsRes = shellEngine.execute('/home/user/temp', 'ls');
    expect(lsRes.stdout).toContain('index.js');

    // ghi và hiển thị nội dung tệp bằng cat (echo + redirection)
    shellEngine.execute('/home/user/temp', 'echo "console.log(123)" > index.js');
    const catRes = shellEngine.execute('/home/user/temp', 'cat index.js');
    expect(catRes.stdout).toBe('console.log(123)'); // Đã bóc tách dấu ngoặc kép nhờ parseArgs
  });

  it('nên chuyển đổi thư mục chính xác (cd)', () => {
    const resCd1 = shellEngine.execute('/home/user', 'cd documents');
    expect(resCd1.newPath).toBe('/home/user/documents');
    expect(resCd1.stderr).toBe('');

    // cd lên trên (..)
    const resCd2 = shellEngine.execute('/home/user/documents', 'cd ..');
    expect(resCd2.newPath).toBe('/home/user');

    // cd lỗi
    const resCdFail = shellEngine.execute('/home/user', 'cd ghost');
    expect(resCdFail.newPath).toBe('/home/user');
    expect(resCdFail.stderr).toContain('no such file or directory');
  });

  it('nên tự động gợi ý lệnh hoặc tên tệp chính xác (autocomplete)', () => {
    // Autocomplete lệnh
    const autoCmd = shellEngine.autocomplete('/home/user', 'mk');
    expect(autoCmd.matches).toContain('mkdir');
    expect(autoCmd.completed).toBe('mkdir');

    // Autocomplete tệp tin (phải đi sau một lệnh, ví dụ 'cat wel')
    const autoFile = shellEngine.autocomplete('/home/user/documents', 'cat wel');
    expect(autoFile.matches).toContain('welcome.txt');
    expect(autoFile.completed).toBe('welcome.txt');
  });
});
