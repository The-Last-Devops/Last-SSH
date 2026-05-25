const DEFAULT_FS = {
  name: '/',
  type: 'dir',
  updatedAt: new Date().toISOString(),
  children: {
    'home': {
      name: 'home',
      type: 'dir',
      updatedAt: new Date().toISOString(),
      children: {
        'user': {
          name: 'user',
          type: 'dir',
          updatedAt: new Date().toISOString(),
          children: {
            'documents': {
              name: 'documents',
              type: 'dir',
              updatedAt: new Date().toISOString(),
              children: {
                'welcome.txt': {
                  name: 'welcome.txt',
                  type: 'file',
                  updatedAt: new Date().toISOString(),
                  content: 'Chào mừng bạn đến với Last SSH!\nĐây là hệ thống tệp tin giả lập trực tiếp trên trình duyệt của bạn.\nTất cả những chỉnh sửa của bạn ở đây sẽ được lưu trữ cục bộ (LocalStorage).\n\nChúc bạn có những trải nghiệm tuyệt vời!'
                },
                'todo.txt': {
                  name: 'todo.txt',
                  type: 'file',
                  updatedAt: new Date().toISOString(),
                  content: '- Thử các lệnh: ls, cd, cat, mkdir, rm, touch\n- Đổi theme trong mục Settings (Hyper Dark, Cyberpunk Neon)\n- Thiết lập mã khóa bảo mật hoặc liên kết sinh trắc học vân tay\n- Thử nghiệm đồng bộ hóa P2P bằng QR Code sang máy khác'
                }
              }
            },
            'downloads': {
              name: 'downloads',
              type: 'dir',
              updatedAt: new Date().toISOString(),
              children: {}
            }
          }
        }
      }
    },
    'var': {
      name: 'var',
      type: 'dir',
      updatedAt: new Date().toISOString(),
      children: {
        'log': {
          name: 'log',
          type: 'dir',
          updatedAt: new Date().toISOString(),
          children: {
            'auth.log': {
              name: 'auth.log',
              type: 'file',
              updatedAt: new Date().toISOString(),
              content: 'May 25 10:00:00 localhost systemd: Lock screen enabled.\nMay 25 10:02:15 localhost auth: Session initialized for user.'
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
        'hosts': {
          name: 'hosts',
          type: 'file',
          updatedAt: new Date().toISOString(),
          content: '127.0.0.1   localhost\n255.255.255.255 broadcasthost\n::1             localhost'
        }
      }
    }
  }
};

const STORAGE_KEY = 'terminus_virtual_fs';

class VirtualFS {
  constructor() {
    this.fs = null;
    this.isInMemory = false;
    this.init();
  }

  // Khởi tạo Virtual FS, tải từ LocalStorage hoặc in-memory nếu không có
  init() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.fs = JSON.parse(stored);
        } else {
          this.fs = JSON.parse(JSON.stringify(DEFAULT_FS));
          this.save();
        }
      } else {
        // Môi trường Node.js (Ví dụ: chạy kiểm thử Vitest)
        this.isInMemory = true;
        this.fs = JSON.parse(JSON.stringify(DEFAULT_FS));
      }
    } catch (e) {
      this.isInMemory = true;
      this.fs = JSON.parse(JSON.stringify(DEFAULT_FS));
    }
  }

  // Lưu trạng thái FS
  save() {
    if (this.isInMemory) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.fs));
      }
    } catch (e) {
      console.error('Không thể lưu Virtual FS vào LocalStorage:', e);
    }
  }

  // Reset hệ thống tệp
  reset() {
    this.fs = JSON.parse(JSON.stringify(DEFAULT_FS));
    this.save();
  }

  // Import toàn bộ FS từ ngoài vào
  importFS(importedFS) {
    if (importedFS && importedFS.type === 'dir' && importedFS.name === '/') {
      this.fs = importedFS;
      this.save();
      return true;
    }
    return false;
  }

  // Trả về toàn bộ cây FS để phục vụ Export
  exportFS() {
    return this.fs;
  }

  // Chuyển đổi một đường dẫn (cd /home/user, cd .., cd ./documents) thành node và đường dẫn tuyệt đối
  resolvePath(currentPath = '/home/user', targetPath = '') {
    // Chuẩn hóa đường dẫn hiện tại
    let current = currentPath.startsWith('/') ? currentPath : '/' + currentPath;
    if (current.endsWith('/') && current !== '/') current = current.slice(0, -1);

    // Xác định điểm xuất phát: nếu targetPath bắt đầu bằng '/' thì đi từ root, ngược lại đi từ current
    let parts = [];
    let node = this.fs;

    if (targetPath.startsWith('/')) {
      parts = targetPath.split('/').filter(Boolean);
    } else {
      const currentParts = current.split('/').filter(Boolean);
      const targetParts = targetPath.split('/').filter(Boolean);
      parts = [...currentParts, ...targetParts];
    }

    // Xử lý các phân đoạn đường dẫn để tìm node đích và tính toán đường dẫn tuyệt đối cuối cùng
    const resolvedParts = [];
    for (const part of parts) {
      if (part === '.') {
        continue;
      }
      if (part === '..') {
        if (resolvedParts.length > 0) {
          resolvedParts.pop();
        }
        continue;
      }
      resolvedParts.push(part);
    }

    // Duyệt qua cây thư mục
    for (const part of resolvedParts) {
      if (node.type !== 'dir' || !node.children || !node.children[part]) {
        return { node: null, absolutePath: null }; // Không tồn tại
      }
      node = node.children[part];
    }

    const absolutePath = '/' + resolvedParts.join('/');
    return { node, absolutePath };
  }

  // Lấy danh sách tệp/thư mục trong thư mục hiện tại
  list(currentPath) {
    const { node } = this.resolvePath(currentPath);
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

  // Tạo thư mục mới
  mkdir(currentPath, folderName) {
    if (!folderName || folderName.includes('/') || folderName === '.' || folderName === '..') {
      throw new Error('Tên thư mục không hợp lệ');
    }

    const { node } = this.resolvePath(currentPath);
    if (!node || node.type !== 'dir') {
      throw new Error('Thư mục hiện tại không tồn tại');
    }

    if (node.children[folderName]) {
      throw new Error(`Thư mục hoặc tệp '${folderName}' đã tồn tại`);
    }

    node.children[folderName] = {
      name: folderName,
      type: 'dir',
      updatedAt: new Date().toISOString(),
      children: {}
    };

    this.save();
    return true;
  }

  // Tạo tệp trống hoặc ghi đè nội dung tệp
  writeFile(currentPath, fileName, content = '') {
    if (!fileName || fileName.includes('/') || fileName === '.' || fileName === '..') {
      throw new Error('Tên tệp không hợp lệ');
    }

    const { node } = this.resolvePath(currentPath);
    if (!node || node.type !== 'dir') {
      throw new Error('Thư mục hiện tại không tồn tại');
    }

    const targetNode = node.children[fileName];
    if (targetNode && targetNode.type === 'dir') {
      throw new Error(`'${fileName}' là một thư mục, không thể ghi đè làm tệp`);
    }

    node.children[fileName] = {
      name: fileName,
      type: 'file',
      updatedAt: new Date().toISOString(),
      content: content
    };

    this.save();
    return true;
  }

  // Đọc nội dung tệp
  readFile(currentPath, fileName) {
    const { node } = this.resolvePath(currentPath);
    if (!node || node.type !== 'dir') {
      throw new Error('Thư mục hiện tại không tồn tại');
    }

    const targetNode = node.children[fileName];
    if (!targetNode) {
      throw new Error(`Không tìm thấy tệp '${fileName}'`);
    }

    if (targetNode.type !== 'file') {
      throw new Error(`'${fileName}' là một thư mục, không phải tệp tin`);
    }

    return targetNode.content;
  }

  // Xóa tệp hoặc thư mục
  rm(currentPath, name) {
    if (!name || name === '.' || name === '..') {
      throw new Error('Không thể xóa thư mục này');
    }

    const { node } = this.resolvePath(currentPath);
    if (!node || node.type !== 'dir') {
      throw new Error('Thư mục hiện tại không tồn tại');
    }

    if (!node.children[name]) {
      throw new Error(`Không tìm thấy tệp hoặc thư mục '${name}'`);
    }

    delete node.children[name];
    this.save();
    return true;
  }
}

export const virtualFS = new VirtualFS();
