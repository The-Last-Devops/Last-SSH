const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client } = require('ssh2');

let mainWindow = null;
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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupSSH();
  });
}

function cleanupSSH() {
  if (activeShellStream) {
    activeShellStream.end();
    activeShellStream = null;
  }
  if (activeSFTP) {
    activeSFTP = null;
  }
  if (activeSSHClient) {
    activeSSHClient.end();
    activeSSHClient = null;
  }
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
  cleanupSSH();

  activeSSHClient = new Client();

  const connSettings = {
    host: profile.host,
    port: parseInt(profile.port, 10) || 22,
    username: profile.username || 'ubuntu'
  };

  // Xác thực bằng Private Key hoặc Password
  if (profile.keyContent) {
    connSettings.privateKey = profile.keyContent;
    if (profile.passphrase) {
      connSettings.passphrase = profile.passphrase;
    }
  } else if (profile.password) {
    connSettings.password = profile.password;
  }

  event.reply('ssh-data', `\r\n\x1b[1;33m[Electron SSH] Đang kết nối đến máy chủ thực ${profile.username}@${profile.host}:${profile.port}...\x1b[0m\r\n`);

  activeSSHClient.on('ready', () => {
    event.reply('ssh-data', `\x1b[1;32m[Electron SSH] Xác thực thành công! Đang thiết lập terminal shell...\x1b[0m\r\n`);

    // Mở shell tương tác
    activeSSHClient.shell({ term: 'xterm-color' }, (err, stream) => {
      if (err) {
        event.reply('ssh-data', `\r\n\x1b[1;31m[Electron SSH Error] Không thể mở shell: ${err.message}\x1b[0m\r\n`);
        cleanupSSH();
        return;
      }

      activeShellStream = stream;

      // Pipe luồng nhận dữ liệu từ shell gửi lên React
      stream.on('data', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', data.toString());
        }
      });

      stream.on('close', () => {
        if (mainWindow) {
          mainWindow.webContents.send('ssh-data', `\r\n\x1b[1;30m[Electron SSH] Kết nối đã bị đóng bởi máy chủ.\x1b[0m\r\n`);
          mainWindow.webContents.send('ssh-close');
        }
        cleanupSSH();
      });
    });

    // Mở SFTP session song song
    activeSSHClient.sftp((err, sftp) => {
      if (err) {
        console.error("Không thể mở phiên SFTP thực:", err.message);
        return;
      }
      activeSFTP = sftp;
    });
  });

  activeSSHClient.on('error', (err) => {
    event.reply('ssh-data', `\r\n\x1b[1;31m[Electron SSH Connection Error] ${err.message}\x1b[0m\r\n`);
    cleanupSSH();
  });

  activeSSHClient.on('close', () => {
    cleanupSSH();
  });

  activeSSHClient.connect(connSettings);
});

// Ghi dữ liệu gõ phím xuống Shell
ipcMain.on('ssh-write', (event, data) => {
  if (activeShellStream) {
    activeShellStream.write(data);
  }
});

// --------------------------------------------------------------------------
// IPC SFTP FILE OPERATIONS CHANNELS (Thao tác tệp SFTP thật 100%)
// --------------------------------------------------------------------------

// 1. Duyệt tệp SFTP
ipcMain.handle('sftp-list', async (event, remotePath) => {
  return new Promise((resolve, reject) => {
    if (!activeSFTP) {
      return reject(new Error("SFTP session is not active"));
    }

    activeSFTP.readdir(remotePath, (err, list) => {
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
    if (!activeSFTP) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, folderName);

    activeSFTP.mkdir(fullPath, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
});

// 3. Tạo/Ghi file mới (Tải lên file)
ipcMain.handle('sftp-upload', async (event, remotePath, fileName, content) => {
  return new Promise((resolve, reject) => {
    if (!activeSFTP) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, fileName);

    activeSFTP.writeFile(fullPath, content, 'utf8', (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
});

// 4. Đọc file (Tải xuống file)
ipcMain.handle('sftp-download', async (event, remotePath, fileName) => {
  return new Promise((resolve, reject) => {
    if (!activeSFTP) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, fileName);

    activeSFTP.readFile(fullPath, 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
});

// 5. Xóa file hoặc thư mục
ipcMain.handle('sftp-rm', async (event, remotePath, name) => {
  return new Promise((resolve, reject) => {
    if (!activeSFTP) return reject(new Error("SFTP session is not active"));
    const fullPath = path.posix.join(remotePath, name);

    // Thử xóa file, nếu thất bại thử xóa thư mục
    activeSFTP.unlink(fullPath, (err) => {
      if (!err) return resolve(true);

      // Thất bại -> Thử xóa thư mục
      activeSFTP.rmdir(fullPath, (errDir) => {
        if (errDir) return reject(errDir);
        resolve(true);
      });
    });
  });
});
