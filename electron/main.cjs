const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client } = require('ssh2');
const pty = require('node-pty');

// Known hosts for TOFU verification
let knownHosts = {};

// Pending terminal resizes: tabId -> { cols, rows }
// Lưu resize gửi trước khi shell SSH được mở, apply ngay khi shell ready
const pendingResizes = {};

function getKnownHostsPath() {
  return path.join(app.getPath('userData'), 'known_hosts.json');
}

function loadKnownHosts() {
  try {
    const p = getKnownHostsPath();
    if (fs.existsSync(p)) {
      knownHosts = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (_e) {
    knownHosts = {};
  }
}

function saveKnownHosts() {
  try {
    fs.writeFileSync(getKnownHostsPath(), JSON.stringify(knownHosts, null, 2));
  } catch (_e) {}
}

// Set app name (fixes "Electron" label in dock during development)
app.name = 'Last SSH';
// Giữ nguyên userData path để không mất localStorage data cũ
app.setPath('userData', path.join(app.getPath('appData'), 'last-ssh'));

let mainWindow = null;

// Hỗ trợ nhiều SSH session song song theo tabId
const sshSessions = {}; // tabId -> { client, stream, sftp }
const localSessions = {}; // tabId -> pty process

// Legacy globals để tương thích với SFTP operations cũ (sẽ dùng session mới nhất)
let activeSSHClient = null;
let activeShellStream = null;
let activeSFTP = null;

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Last SSH',
    icon: iconPath,
    backgroundColor: '#16161e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  // Fallback: Nếu quá 3 giây mà chưa show thì ép show để không bị ẩn luôn
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3000);

  // Môi trường phát triển: load Vite dev server
  // Môi trường đóng gói: load file index.html từ dist
  const isDev = !app.isPackaged;
  if (isDev) {
    const loadVite = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(loadVite, 200); // Thử lại sau 200ms nếu Vite chưa khởi động xong
      });
    };
    loadVite();
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
  loadKnownHosts();
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
    event.reply('ssh-data', { tabId, data: `\r\n\x1b[1;31m[Electron SSH Error] Địa chỉ host không được để trống!\x1b[0m\r\n` });
    return;
  }

  const connSettings = {
    host,
    port: isNaN(port) ? 22 : port,
    username,
    readyTimeout: 20000,           // Chờ tối đa 20 giây để kết nối
    keepaliveInterval: 10000,      // Gửi keepalive mỗi 10 giây
    keepaliveCountMax: 5,          // Cho phép tối đa 5 lần keepalive fail
    hostVerifier: (fingerprint) => {
      const hostKey = `${host}:${connSettings.port}`;
      // Luôn convert sang base64 string để tránh lỗi Buffer vs Object sau JSON round-trip
      const fp = Buffer.isBuffer(fingerprint)
        ? fingerprint.toString('base64')
        : String(fingerprint);

      if (!knownHosts[hostKey]) {
        knownHosts[hostKey] = fp;
        saveKnownHosts();
        return true;
      }
      if (knownHosts[hostKey] !== fp) {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', { tabId, data: `\r\n\x1b[1;31m[SSH SECURITY WARNING] Fingerprint của ${host} đã thay đổi! Kết nối bị từ chối.\r\nNếu server key hợp lệ đã thay đổi, dùng lệnh: ssh-forget-host ${hostKey}\x1b[0m\r\n` });
        }
        return false;
      }
      return true;
    }
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
  event.reply('ssh-data', { tabId, data: `\r\n\x1b[1;33m[Electron SSH] Đang kết nối đến máy chủ thực ${username}@${host}:${portDisplay}...\x1b[0m\r\n` });

  client.on('ready', () => {
    event.reply('ssh-data', { tabId, data: `\x1b[1;32m[Electron SSH] Xác thực thành công! Đang thiết lập terminal shell...\x1b[0m\r\n` });

    // Mở shell tương tác (dùng kích thước nhỏ mặc định, renderer sẽ gửi resize thật ngay sau)
    client.shell({ term: 'xterm-256color', rows: 24, cols: 80 }, (err, stream) => {
      if (err) {
        event.reply('ssh-data', { tabId, data: `\r\n\x1b[1;31m[Electron SSH Error] Không thể mở shell: ${err.message}\x1b[0m\r\n` });
        cleanupSession(tabId);
        return;
      }

      sshSessions[tabId].stream = stream;
      activeShellStream = stream;

      // Apply pending resize nếu renderer đã gửi resize trước khi shell mở xong
      if (pendingResizes[tabId]) {
        const { cols, rows } = pendingResizes[tabId];
        delete pendingResizes[tabId];
        if (cols > 0 && rows > 0) {
          try { stream.setWindow(rows, cols, 0, 0); } catch (_e) {}
        }
      }

      // Pipe luồng nhận dữ liệu từ shell gửi lên React
      stream.on('data', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', { tabId, data: data.toString() });
        }
      });

      stream.stderr.on('data', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', { tabId, data: data.toString() });
        }
      });

      stream.on('close', () => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', { tabId, data: `\r\n\x1b[1;30m[Electron SSH] Kết nối đã bị đóng bởi máy chủ.\x1b[0m\r\n` });
          mainWindow.webContents.send('ssh-close', tabId);
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
      mainWindow.webContents.send('ssh-data', { tabId, data: `\r\n\x1b[1;31m[Electron SSH Connection Error] ${errorMsg}${hint}\x1b[0m\r\n` });
    } else {
      event.reply('ssh-data', { tabId, data: `\r\n\x1b[1;31m[Electron SSH Connection Error] ${errorMsg}${hint}\x1b[0m\r\n` });
    }
    cleanupSession(tabId);
  });

  client.on('close', () => {
    cleanupSession(tabId);
  });

  client.connect(connSettings);
});

// Ghi dữ liệu gõ phím xuống Shell (dùng đúng stream theo tabId)
ipcMain.on('ssh-write', (event, { tabId, data }) => {
  const session = sshSessions[tabId];
  if (session && session.stream) {
    try {
      session.stream.write(data);
    } catch (_e) {
      console.error('Lỗi ghi dữ liệu SSH:', _e.message);
    }
  }
});

// Ngắt kết nối SSH theo tabId
ipcMain.on('ssh-disconnect', (event, tabId) => {
  cleanupSession(tabId || 'default');
});

// Resize SSH PTY window theo tabId (cần cho htop/vim/top)
ipcMain.on('ssh-resize', (event, { tabId, cols, rows }) => {
  if (!tabId || cols <= 0 || rows <= 0) return;
  const session = sshSessions[tabId];
  const stream = session ? session.stream : null;
  if (stream) {
    try { stream.setWindow(rows, cols, 0, 0); } catch (_e) {}
  } else {
    // Shell chưa mở — lưu lại, sẽ apply ngay khi shell ready
    pendingResizes[tabId] = { cols, rows };
  }
});

// Xóa host khỏi known_hosts (cho phép kết nối lại sau khi server key hợp lệ thay đổi)
ipcMain.handle('ssh-forget-host', (event, hostPort) => {
  delete knownHosts[hostPort];
  saveKnownHosts();
  return true;
});

ipcMain.handle('ssh-get-known-hosts', () => {
  return { ...knownHosts };
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
