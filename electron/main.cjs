const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client } = require('ssh2');
const pty = require('node-pty');

let mainWindow = null;

// Hỗ trợ nhiều SSH session song song theo tabId
const sshSessions = {}; // tabId -> { client, stream, sftp }
const localSessions = {}; // tabId -> pty process

// Legacy globals để tương thích với SFTP operations cũ (sẽ dùng session mới nhất)
let activeSSHClient = null;
let activeShellStream = null;
let activeSFTP = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Last SSH Desktop Client",
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Môi trường phát triển: load Vite dev server
  // Môi trường đóng gói: load file index.html từ dist
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools(); // Tắt tự động mở console
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupSSH();
  });
}

function cleanupSession(tabId) {
  const session = sshSessions[tabId];
  if (!session) return;

  try {
    if (session.stream) {
      session.stream.end();
    }
  } catch (_e) { /* ignore */ }

  try {
    if (session.client) {
      session.client.end();
    }
  } catch (_e) { /* ignore */ }

  delete sshSessions[tabId];

  // Cập nhật legacy globals
  const remaining = Object.values(sshSessions);
  if (remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    activeSSHClient = last.client;
    activeShellStream = last.stream;
    activeSFTP = last.sftp;
  } else {
    activeSSHClient = null;
    activeShellStream = null;
    activeSFTP = null;
  }
}

function cleanupLocalSession(tabId) {
  const session = localSessions[tabId];
  if (!session) return;

  try {
    session.kill();
  } catch (_e) { /* ignore */ }

  delete localSessions[tabId];
}

function cleanupSSH() {
  // Cleanup toàn bộ sessions
  Object.keys(sshSessions).forEach(tabId => cleanupSession(tabId));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --------------------------------------------------------------------------
// IPC SSH CONNECTION CHANNELS
// --------------------------------------------------------------------------

ipcMain.on('ssh-connect', (event, profile) => {
  const tabId = profile.tabId || 'default';

  // Dọn dẹp session cũ của cùng tabId nếu có
  if (sshSessions[tabId]) {
    cleanupSession(tabId);
  }

  const client = new Client();
  sshSessions[tabId] = { client, stream: null, sftp: null };

  // Cập nhật legacy global cho SFTP operations
  activeSSHClient = client;

  const host = (profile.host || '').trim();
  const port = parseInt(profile.port, 10);
  const username = (profile.username || 'ubuntu').trim();

  if (!host) {
    event.reply('ssh-data', `\r\n\x1b[1;31m[Electron SSH Error] Địa chỉ host không được để trống!\x1b[0m\r\n`);
    return;
  }

  const connSettings = {
    host,
    port: isNaN(port) ? 22 : port,
    username,
    readyTimeout: 20000,           // Chờ tối đa 20 giây để kết nối
    keepaliveInterval: 10000,      // Gửi keepalive mỗi 10 giây
    keepaliveCountMax: 5,          // Cho phép tối đa 5 lần keepalive fail
    hostVerifier: () => true       // Chấp nhận mọi host fingerprint (giống PuTTY mặc định)
  };

  // Xác thực bằng Private Key hoặc Password
  if (profile.keyContent) {
    connSettings.privateKey = profile.keyContent;
    if (profile.passphrase) {
      connSettings.passphrase = profile.passphrase;
    }
  } else if (profile.password) {
    connSettings.password = profile.password;
  } else {
    // Không có key cũng không có password - thử kết nối không xác thực
    // (sẽ bị từ chối bởi server, nhưng hiển thị thông báo rõ ràng hơn)
  }

  const portDisplay = isNaN(port) ? 22 : port;
  event.reply('ssh-data', `\r\n\x1b[1;33m[Electron SSH] Đang kết nối đến máy chủ thực ${username}@${host}:${portDisplay}...\x1b[0m\r\n`);

  client.on('ready', () => {
    event.reply('ssh-data', `\x1b[1;32m[Electron SSH] Xác thực thành công! Đang thiết lập terminal shell...\x1b[0m\r\n`);

    // Mở shell tương tác (dùng kích thước nhỏ mặc định, renderer sẽ gửi resize thật ngay sau)
    client.shell({ term: 'xterm-256color', rows: 24, cols: 80 }, (err, stream) => {
      if (err) {
        event.reply('ssh-data', `\r\n\x1b[1;31m[Electron SSH Error] Không thể mở shell: ${err.message}\x1b[0m\r\n`);
        cleanupSession(tabId);
        return;
      }

      sshSessions[tabId].stream = stream;
      activeShellStream = stream;

      // Pipe luồng nhận dữ liệu từ shell gửi lên React
      stream.on('data', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', data.toString());
        }
      });

      stream.stderr.on('data', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', data.toString());
        }
      });

      stream.on('close', () => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', `\r\n\x1b[1;30m[Electron SSH] Kết nối đã bị đóng bởi máy chủ.\x1b[0m\r\n`);
          mainWindow.webContents.send('ssh-close');
        }
        cleanupSession(tabId);
      });
    });

    // Mở SFTP session song song
    client.sftp((err, sftp) => {
      if (err) {
        console.error("Không thể mở phiên SFTP thực:", err.message);
        // Vẫn thông báo sftp-ready với trạng thái false để SFTPBrowser không bị treo
        if (mainWindow) {
          mainWindow.webContents.send('sftp-ready', { success: false, error: err.message });
        }
        return;
      }
      if (sshSessions[tabId]) {
        sshSessions[tabId].sftp = sftp;
      }
      activeSFTP = sftp;
      // Thông báo cho renderer biết SFTP đã sẵn sàng
      if (mainWindow) {
        mainWindow.webContents.send('sftp-ready', { success: true });
      }
    });
  });

  client.on('error', (err) => {
    const errorMsg = err.message || String(err);
    let hint = '';
    if (errorMsg.includes('ECONNRESET')) {
      hint = ' (Máy chủ từ chối kết nối - Kiểm tra xem port SSH có đúng không?)';
    } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED')) {
      hint = ' (Không tìm thấy máy chủ - Kiểm tra lại địa chỉ Host/IP)';
    } else if (errorMsg.includes('authentication')) {
      hint = ' (Xác thực thất bại - Kiểm tra username/password/key)';
    } else if (errorMsg.includes('ETIMEDOUT')) {
      hint = ' (Kết nối timeout - Kiểm tra firewall hoặc địa chỉ IP)';
    }

    if (mainWindow) {
      mainWindow.webContents.send('ssh-data', `\r\n\x1b[1;31m[Electron SSH Connection Error] ${errorMsg}${hint}\x1b[0m\r\n`);
    } else {
      event.reply('ssh-data', `\r\n\x1b[1;31m[Electron SSH Connection Error] ${errorMsg}${hint}\x1b[0m\r\n`);
    }
    cleanupSession(tabId);
  });

  client.on('close', () => {
    cleanupSession(tabId);
  });

  client.connect(connSettings);
});

// Ghi dữ liệu gõ phím xuống Shell (dùng stream mới nhất)
ipcMain.on('ssh-write', (event, data) => {
  if (activeShellStream) {
    try {
      activeShellStream.write(data);
    } catch (_e) {
      console.error('Lỗi ghi dữ liệu SSH:', _e.message);
    }
  }
});

// Ngắt kết nối SSH theo tabId
ipcMain.on('ssh-disconnect', (event, tabId) => {
  cleanupSession(tabId || 'default');
});

ipcMain.on('local-shell-connect', (event, { tabId, cwd, shell }) => {
  const sessionTabId = tabId || 'local-default';

  if (localSessions[sessionTabId]) {
    cleanupLocalSession(sessionTabId);
  }

  const shellCandidates = [];
  if (shell) shellCandidates.push(shell);
  if (process.env.SHELL) shellCandidates.push(process.env.SHELL);
  if (process.platform === 'win32') {
    shellCandidates.push('powershell.exe', 'cmd.exe');
  } else {
    shellCandidates.push('/bin/zsh', '/bin/bash', '/bin/sh');
  }

  const userShell = shellCandidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch (_e) {
      return false;
    }
  }) || shellCandidates[shellCandidates.length - 1];

  const cwdPath = cwd || process.env.HOME || process.cwd();
  const shellEnv = {
    ...process.env,
    TERM: process.env.TERM || 'xterm-256color',
    COLORTERM: process.env.COLORTERM || 'truecolor'
  };

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(userShell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwdPath,
      env: shellEnv
    });
  } catch (err) {
    const message = String(err.message || err);
    if (mainWindow) {
      mainWindow.webContents.send('local-data', { tabId: sessionTabId, data: `\r\n\x1b[1;31m[Local shell failed to start: ${message}]\x1b[0m\r\n` });
    }
    return;
  }

  localSessions[sessionTabId] = ptyProcess;

  ptyProcess.on('data', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('local-data', { tabId: sessionTabId, data });
    }
  });

  ptyProcess.on('exit', (exitCode) => {
    if (mainWindow) {
      mainWindow.webContents.send('local-data', { tabId: sessionTabId, data: `\r\n\x1b[1;30m[Local shell exited with code ${exitCode}]\x1b[0m\r\n` });
      mainWindow.webContents.send('local-close', sessionTabId);
    }
    cleanupLocalSession(sessionTabId);
  });
});

ipcMain.on('local-write', (event, { tabId, data }) => {
  const session = localSessions[tabId];
  if (session) {
    try {
      session.write(data);
    } catch (_e) {
      console.error('Lỗi ghi dữ liệu local shell:', _e.message);
    }
  }
});

ipcMain.on('local-resize', (event, { tabId, cols, rows }) => {
  const session = localSessions[tabId];
  if (session && cols > 0 && rows > 0) {
    try {
      session.resize(cols, rows);
    } catch (_e) {
      // Ignore resize errors
    }
  }
});

ipcMain.on('local-disconnect', (event, tabId) => {
  cleanupLocalSession(tabId);
});

// --------------------------------------------------------------------------
// IPC SFTP FILE OPERATIONS CHANNELS (Thao tác tệp SFTP thật 100%)
// --------------------------------------------------------------------------

// Helper: Lấy SFTP session đang hoạt động (ưu tiên session mới nhất)
function getActiveSFTP() {
  // Thử lấy từ sshSessions trước
  const sessionIds = Object.keys(sshSessions);
  for (let i = sessionIds.length - 1; i >= 0; i--) {
    const session = sshSessions[sessionIds[i]];
    if (session && session.sftp) {
      return session.sftp;
    }
  }
  // Fallback về activeSFTP global
  return activeSFTP;
}

// 1. Duyệt tệp SFTP
ipcMain.handle('sftp-list', async (event, remotePath) => {
  return new Promise((resolve, reject) => {
    const sftp = getActiveSFTP();
    if (!sftp) {
      return reject(new Error("SFTP session is not active"));
    }

    sftp.readdir(remotePath, (err, list) => {
      if (err) {
        return reject(err);
      }

      // Format dữ liệu tương thích với SFTPBrowser
      const formatted = list.map(item => {
        const isDir = item.longname.startsWith('d');
        return {
          name: item.filename,
          type: isDir ? 'dir' : 'file',
          size: item.attrs.size,
          updatedAt: new Date(item.attrs.mtime * 1000).toISOString()
        };
      });

      resolve(formatted);
    });
  });
});

// 2. Tạo thư mục mới
ipcMain.handle('sftp-mkdir', async (event, remotePath, folderName) => {
  return new Promise((resolve, reject) => {
    const sftp = getActiveSFTP();
    if (!sftp) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, folderName);

    sftp.mkdir(fullPath, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
});

// 3. Tạo/Ghi file mới (Tải lên file)
ipcMain.handle('sftp-upload', async (event, remotePath, fileName, content) => {
  return new Promise((resolve, reject) => {
    const sftp = getActiveSFTP();
    if (!sftp) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, fileName);

    sftp.writeFile(fullPath, content, 'utf8', (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
});

// 4. Đọc file (Tải xuống file)
ipcMain.handle('sftp-download', async (event, remotePath, fileName) => {
  return new Promise((resolve, reject) => {
    const sftp = getActiveSFTP();
    if (!sftp) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, fileName);

    sftp.readFile(fullPath, 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
});

// 5. Xóa file hoặc thư mục
ipcMain.handle('sftp-rm', async (event, remotePath, name) => {
  return new Promise((resolve, reject) => {
    const sftp = getActiveSFTP();
    if (!sftp) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, name);

    // Thử xóa file, nếu thất bại thử xóa thư mục
    sftp.unlink(fullPath, (err) => {
      if (!err) return resolve(true);

      // Thất bại -> Thử xóa thư mục
      sftp.rmdir(fullPath, (errDir) => {
        if (errDir) return reject(errDir);
        resolve(true);
      });
    });
  });
});

// 6. Kiểm tra trạng thái SFTP hiện tại
ipcMain.handle('sftp-status', async () => {
  const sftp = getActiveSFTP();
  return { ready: !!sftp };
});
