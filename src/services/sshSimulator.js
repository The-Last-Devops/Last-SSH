// sshSimulator.js - Trình giả lập phiên kết nối SSH và duyệt tệp SFTP từ xa

// Khởi tạo cây thư mục từ xa mặc định cho các server SSH
function createRemoteDefaultFS(username = 'ubuntu') {
  return {
    name: '/',
    type: 'dir',
    updatedAt: new Date().toISOString(),
    children: {
      'home': {
        name: 'home',
        type: 'dir',
        updatedAt: new Date().toISOString(),
        children: {
          [username]: {
            name: username,
            type: 'dir',
            updatedAt: new Date().toISOString(),
            children: {
              'var': {
                name: 'var',
                type: 'dir',
                updatedAt: new Date().toISOString(),
                children: {
                  'www': {
                    name: 'www',
                    type: 'dir',
                    updatedAt: new Date().toISOString(),
                    children: {
                      'index.html': {
                        name: 'index.html',
                        type: 'file',
                        updatedAt: new Date().toISOString(),
                        content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Remote Server</title>\n</head>\n<body>\n  <h1>Phiên kết nối SSH giả lập hoạt động hoàn hảo!</h1>\n</body>\n</html>'
                      }
                    }
                  }
                }
              },
              'db': {
                name: 'db',
                type: 'dir',
                updatedAt: new Date().toISOString(),
                children: {
                  'init.sql': {
                    name: 'init.sql',
                    type: 'file',
                    updatedAt: new Date().toISOString(),
                    content: 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  username VARCHAR(50) UNIQUE,\n  created_at TIMESTAMP DEFAULT NOW()\n);'
                  }
                }
              },
              'remote_readme.txt': {
                name: 'remote_readme.txt',
                type: 'file',
                updatedAt: new Date().toISOString(),
                content: 'Chào mừng bạn đến với Server SSH từ xa!\n\nĐây là hệ thống tệp tin ảo của server.\nBạn có thể sửa đổi bằng lệnh Terminal (touch, mkdir, rm) hoặc thao tác trực tiếp trên bảng điều khiển SFTP ở bên phải để thấy sự đồng bộ tuyệt vời!'
              }
            }
          }
        }
      },
      'etc': {
        name: 'etc',
        type: 'dir',
        updatedAt: new Date().toISOString(),
        children: {
          'nginx': {
            name: 'nginx',
            type: 'dir',
            updatedAt: new Date().toISOString(),
            children: {
              'nginx.conf': {
                name: 'nginx.conf',
                type: 'file',
                updatedAt: new Date().toISOString(),
                content: 'events {}\nhttp {\n  server {\n    listen 80;\n    server_name localhost;\n  }\n}'
              }
            }
          }
        }
      }
    }
  };
}

class SSHSimulator {
  constructor() {
    this.sessions = {}; // Lưu trữ trạng thái các phiên kết nối SSH: tabId -> SessionData
  }

  // Khởi tạo một phiên kết nối SSH mới
  createSession(tabId, connectionProfile, keysList = []) {
    const username = connectionProfile.username || 'ubuntu';
    const host = connectionProfile.host || '127.0.0.1';
    const port = connectionProfile.port || '22';

    // Sinh cấu trúc file riêng cho mỗi session
    const remoteFS = createRemoteDefaultFS(username);
    const defaultPath = `/home/${username}`;

    // Tìm kiếm xem có khóa riêng tư tương ứng được liên kết không
    const linkedKey = keysList.find(k => k.id === connectionProfile.keyId);

    const logs = [
      `\r\x1b[1;33mConnecting to ${username}@${host}:${port}...\x1b[0m`,
      `\r\x1b[1;30m[SSH] Exchanging key fingerprints...\x1b[0m`
    ];

    if (linkedKey) {
      logs.push(
        `\r\x1b[1;30m[SSH] Trying private key: ${linkedKey.label}...\x1b[0m`,
        `\r\x1b[1;30m[SSH] Authenticating with public key signature...\x1b[0m`,
        `\r\x1b[1;32m[SSH] Key authentication succeeded. Access granted.\x1b[0m`
      );
    } else {
      logs.push(
        `\r\x1b[1;30m[SSH] Sending password credentials...\x1b[0m`,
        `\r\x1b[1;32m[SSH] Connection established. Encryption AES-256-GCM. Ready.\x1b[0m`
      );
    }

    logs.push(
      `\r\nWelcome to Last SSH Simulated Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-generic)`,
      `\r * Documentation: https://help.ubuntu.com`,
      `\r * Management: https://landscape.canonical.com`,
      `\r * Support: https://ubuntu.com/advantage`,
      `\r\nLast login: ${new Date().toUTCString()} from local-proxy`,
      `\r${username}@${host}:${defaultPath} $ `
    );

    this.sessions[tabId] = {
      tabId,
      profile: connectionProfile,
      host,
      username,
      port,
      currentPath: defaultPath,
      fs: remoteFS,
      logs: logs
    };

    return this.sessions[tabId];
  }

  // Lấy thông tin session SSH theo Tab ID
  getSession(tabId) {
    return this.sessions[tabId] || null;
  }

  // Xóa phiên kết nối SSH khi đóng tab
  closeSession(tabId) {
    if (this.sessions[tabId]) {
      delete this.sessions[tabId];
      return true;
    }
    return false;
  }

  // Duyệt đường dẫn trên Server từ xa (tương tự virtualFS nhưng chạy trên cây tệp ảo của SSH Session)
  resolveRemotePath(session, targetPath = '') {
    let current = session.currentPath;
    let parts = [];
    let node = session.fs;

    if (targetPath.startsWith('/')) {
      parts = targetPath.split('/').filter(Boolean);
    } else {
      const currentParts = current.split('/').filter(Boolean);
      const targetParts = targetPath.split('/').filter(Boolean);
      parts = [...currentParts, ...targetParts];
    }

    const resolvedParts = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (resolvedParts.length > 0) resolvedParts.pop();
        continue;
      }
      resolvedParts.push(part);
    }

    for (const part of resolvedParts) {
      if (node.type !== 'dir' || !node.children || !node.children[part]) {
        return { node: null, absolutePath: null };
      }
      node = node.children[part];
    }

    const absolutePath = '/' + resolvedParts.join('/');
    return { node, absolutePath };
  }

  // Thực thi lệnh dòng lệnh trong phiên SSH
  executeCommand(tabId, commandLine) {
    const session = this.getSession(tabId);
    if (!session) {
      return { stdout: '', stderr: 'ssh: No active session' };
    }

    const trimmed = (commandLine || '').trim();
    if (!trimmed) {
      return { stdout: '', stderr: '', newPath: session.currentPath };
    }

    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    let stdout = '';
    let stderr = '';

    switch (command) {
      case 'help':
        stdout = 'SSH Remote Shell Lệnh khả dụng: help, ls, cd, pwd, touch, mkdir, rm, cat, exit';
        break;
      
      case 'pwd':
        stdout = session.currentPath;
        break;

      case 'cd': {
        const target = args[0] || `/home/${session.username}`;
        const { node, absolutePath } = this.resolveRemotePath(session, target);
        if (!node) {
          stderr = `cd: no such file or directory: ${target}`;
        } else if (node.type !== 'dir') {
          stderr = `cd: not a directory: ${target}`;
        } else {
          session.currentPath = absolutePath;
        }
        break;
      }

      case 'ls': {
        const target = args[0] || '';
        let searchPath = session.currentPath;
        if (target) {
          const { node, absolutePath } = this.resolveRemotePath(session, target);
          if (!node) {
            stderr = `ls: cannot access '${target}': No such file or directory`;
            break;
          }
          if (node.type === 'file') {
            stdout = target;
            break;
          }
          searchPath = absolutePath;
        }
        
        const { node } = this.resolveRemotePath(session, searchPath);
        const children = node.children || {};
        const items = Object.keys(children).map(name => {
          const child = children[name];
          if (child.type === 'dir') {
            return `\x1b[1;36m${name}/\x1b[0m`;
          }
          return name;
        });
        stdout = items.join('   ');
        break;
      }

      case 'mkdir': {
        const folderName = args[0];
        if (!folderName) {
          stderr = 'mkdir: missing operand';
          break;
        }
        const { node } = this.resolveRemotePath(session, session.currentPath);
        if (node.children[folderName]) {
          stderr = `mkdir: cannot create directory '${folderName}': File exists`;
        } else {
          node.children[folderName] = {
            name: folderName,
            type: 'dir',
            updatedAt: new Date().toISOString(),
            children: {}
          };
        }
        break;
      }

      case 'touch': {
        const fileName = args[0];
        if (!fileName) {
          stderr = 'touch: missing file operand';
          break;
        }
        const { node } = this.resolveRemotePath(session, session.currentPath);
        if (!node.children[fileName]) {
          node.children[fileName] = {
            name: fileName,
            type: 'file',
            updatedAt: new Date().toISOString(),
            content: ''
          };
        }
        break;
      }

      case 'cat': {
        const fileName = args[0];
        if (!fileName) {
          stderr = 'cat: missing file operand';
          break;
        }
        const { node } = this.resolveRemotePath(session, session.currentPath + '/' + fileName);
        if (!node) {
          stderr = `cat: ${fileName}: No such file or directory`;
        } else if (node.type === 'dir') {
          stderr = `cat: ${fileName}: Is a directory`;
        } else {
          stdout = node.content;
        }
        break;
      }

      case 'rm': {
        const name = args[0];
        if (!name) {
          stderr = 'rm: missing operand';
          break;
        }
        const { node } = this.resolveRemotePath(session, session.currentPath);
        if (!node.children[name]) {
          stderr = `rm: cannot remove '${name}': No such file or directory`;
        } else {
          delete node.children[name];
        }
        break;
      }

      case 'exit':
        stdout = 'Session closed by user';
        return { stdout, stderr, exit: true };

      default:
        stderr = `bash: ${command}: command not found`;
    }

    return { stdout, stderr, newPath: session.currentPath };
  }

  // -------------------------------------------------------------
  // TRÌNH SFTP TRỰC QUAN (SFTP Visual Operations)
  // -------------------------------------------------------------

  // Danh sách tệp visual cho bảng SFTP
  sftpList(tabId, remotePath) {
    const session = this.getSession(tabId);
    if (!session) return [];

    const { node } = this.resolveRemotePath(session, remotePath);
    if (!node || node.type !== 'dir') return [];

    return Object.keys(node.children).map(name => {
      const child = node.children[name];
      return {
        name,
        type: child.type,
        updatedAt: child.updatedAt,
        size: child.type === 'file' ? (child.content || '').length : 0
      };
    });
  }

  // SFTP: Tạo thư mục mới trực quan
  sftpMkdir(tabId, remotePath, folderName) {
    const session = this.getSession(tabId);
    if (!session) return false;

    const { node } = this.resolveRemotePath(session, remotePath);
    if (!node || node.type !== 'dir' || node.children[folderName]) return false;

    node.children[folderName] = {
      name: folderName,
      type: 'dir',
      updatedAt: new Date().toISOString(),
      children: {}
    };
    return true;
  }

  // SFTP: Tạo/Ghi file mới trực quan (Giả lập upload)
  sftpUpload(tabId, remotePath, fileName, fileContent = '') {
    const session = this.getSession(tabId);
    if (!session) return false;

    const { node } = this.resolveRemotePath(session, remotePath);
    if (!node || node.type !== 'dir') return false;

    node.children[fileName] = {
      name: fileName,
      type: 'file',
      updatedAt: new Date().toISOString(),
      content: fileContent
    };
    return true;
  }

  // SFTP: Đọc nội dung tệp trực quan (Giả lập download)
  sftpDownload(tabId, remotePath, fileName) {
    const session = this.getSession(tabId);
    if (!session) return null;

    const { node } = this.resolveRemotePath(session, remotePath + '/' + fileName);
    if (!node || node.type !== 'file') return null;

    return node.content;
  }

  // SFTP: Xóa tệp/thư mục trực quan
  sftpRm(tabId, remotePath, name) {
    const session = this.getSession(tabId);
    if (!session) return false;

    const { node } = this.resolveRemotePath(session, remotePath);
    if (!node || !node.children[name]) return false;

    delete node.children[name];
    return true;
  }
}

export const sshSimulator = new SSHSimulator();
