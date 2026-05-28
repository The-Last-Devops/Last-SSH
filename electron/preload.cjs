const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Lệnh SSH
  connectSSH: (profile) => ipcRenderer.send('ssh-connect', profile),
  onSSHData: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ssh-data', subscription);
    return () => ipcRenderer.removeListener('ssh-data', subscription);
  },
  writeSSHData: (data) => ipcRenderer.send('ssh-write', data),
  resizeSSH: (size) => ipcRenderer.send('ssh-resize', size),
  onSSHClose: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('ssh-close', subscription);
    return () => ipcRenderer.removeListener('ssh-close', subscription);
  },

  // Thông báo SFTP đã sẵn sàng
  onSFTPReady: (callback) => {
    const subscription = (event, result) => callback(result);
    ipcRenderer.on('sftp-ready', subscription);
    return () => ipcRenderer.removeListener('sftp-ready', subscription);
  },

  // Lệnh SFTP
  sftpList: (remotePath) => ipcRenderer.invoke('sftp-list', remotePath),
  sftpMkdir: (remotePath, folderName) => ipcRenderer.invoke('sftp-mkdir', remotePath, folderName),
  sftpUpload: (remotePath, fileName, content) => ipcRenderer.invoke('sftp-upload', remotePath, fileName, content),
  sftpDownload: (remotePath, fileName) => ipcRenderer.invoke('sftp-download', remotePath, fileName),
  sftpRm: (remotePath, name) => ipcRenderer.invoke('sftp-rm', remotePath, name)
});
