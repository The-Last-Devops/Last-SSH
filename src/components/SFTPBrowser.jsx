import { useState, useEffect, useCallback } from 'react';
import { 
  Folder, 
  File, 
  FileText, 
  FileCode, 
  ArrowLeft, 
  Upload, 
  FolderPlus, 
  Trash2, 
  Network 
} from 'lucide-react';
import { sshSimulator } from '../services/sshSimulator.js';
import './SFTPBrowser.css';

export default function SFTPBrowser({
  tabId,
  currentPath = '',
  onNavigate,
  onTerminalLog // Callback để in log ra terminal khi người dùng thực hiện thao tác visual
}) {
  const [items, setItems] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const isDesktop = typeof window !== 'undefined' && window.electronAPI !== undefined;

  // Load tệp tin từ SSH session mỗi khi thay đổi path hoặc tabId
  const loadFiles = useCallback(async () => {
    if (!tabId || !currentPath) return;
    if (isDesktop) {
      try {
        const fileList = await window.electronAPI.sftpList(currentPath);
        setItems(fileList);
      } catch (err) {
        console.error("Lỗi sftpList:", err);
        if (onTerminalLog) {
          onTerminalLog(`\r\nsftp error: Không thể liệt kê thư mục: ${err.message}`);
        }
      }
    } else {
      const fileList = sshSimulator.sftpList(tabId, currentPath);
      setItems(fileList);
    }
  }, [tabId, currentPath, isDesktop, onTerminalLog]);

  useEffect(() => {
    const initLoad = async () => {
      loadFiles();
    };
    initLoad();
  }, [loadFiles]);

  // Click vào mục (thư mục thì cd, file thì download)
  const handleItemClick = (item) => {
    if (item.type === 'dir') {
      const nextPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      onNavigate(nextPath);
      if (onTerminalLog) {
        onTerminalLog(`\r\nsftp: Visual navigate to ${nextPath}`);
      }
    } else {
      handleDownload(item.name);
    }
  };

  // Trở lại thư mục cha (cd ..)
  const handleBackClick = () => {
    if (currentPath === '/' || !currentPath) return;
    const lastSlash = currentPath.lastIndexOf('/');
    const nextPath = currentPath.slice(0, lastSlash) || '/';
    onNavigate(nextPath);
    if (onTerminalLog) {
      onTerminalLog(`\r\nsftp: Visual navigate back to ${nextPath}`);
    }
  };

  // Tạo thư mục mới trực quan
  const handleMkdir = async () => {
    const name = prompt('Nhập tên thư mục mới trên server:');
    if (!name || name.trim() === '') return;

    if (isDesktop) {
      try {
        const success = await window.electronAPI.sftpMkdir(currentPath, name.trim());
        if (success) {
          loadFiles();
          if (onTerminalLog) {
            onTerminalLog(`\r\nsftp: Created remote directory '${name.trim()}' visually.`);
          }
        }
      } catch (err) {
        alert('Không thể tạo thư mục: ' + err.message);
      }
    } else {
      const success = sshSimulator.sftpMkdir(tabId, currentPath, name.trim());
      if (success) {
        loadFiles();
        if (onTerminalLog) {
          onTerminalLog(`\r\nsftp: Created remote directory '${name.trim()}' visually.`);
        }
      } else {
        alert('Không thể tạo thư mục (trùng tên hoặc lỗi)');
      }
    }
  };

  // Tải file (Download)
  const handleDownload = async (fileName) => {
    if (isDesktop) {
      try {
        const content = await window.electronAPI.sftpDownload(currentPath, fileName);
        if (content === null) return;

        // Tạo blob tải file thật về máy người dùng
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (onTerminalLog) {
          onTerminalLog(`\r\nsftp: Downloaded remote file '${fileName}' (size: ${content.length} bytes).`);
        }
      } catch (err) {
        alert('Không thể tải xuống file: ' + err.message);
      }
    } else {
      const content = sshSimulator.sftpDownload(tabId, currentPath, fileName);
      if (content === null) return;

      // Tạo blob tải file thật về máy người dùng
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (onTerminalLog) {
        onTerminalLog(`\r\nsftp: Downloaded remote file '${fileName}' (size: ${content.length} bytes).`);
      }
    }
  };

  // Upload (tạo file nhập tay)
  const handleUploadClick = async () => {
    const name = prompt('Nhập tên file mới để upload:');
    if (!name || name.trim() === '') return;
    const content = prompt('Nhập nội dung tệp tin:');
    
    if (isDesktop) {
      try {
        const success = await window.electronAPI.sftpUpload(currentPath, name.trim(), content || '');
        if (success) {
          loadFiles();
          if (onTerminalLog) {
            onTerminalLog(`\r\nsftp: Uploaded file '${name.trim()}' visually.`);
          }
        }
      } catch (err) {
        alert('Không thể upload file: ' + err.message);
      }
    } else {
      const success = sshSimulator.sftpUpload(tabId, currentPath, name.trim(), content || '');
      if (success) {
        loadFiles();
        if (onTerminalLog) {
          onTerminalLog(`\r\nsftp: Uploaded file '${name.trim()}' visually.`);
        }
      }
    }
  };

  // Xóa file/folder visual
  const handleDelete = async (e, name) => {
    e.stopPropagation();
    if (confirm(`Bạn chắc chắn muốn xóa mục '${name}' trên remote server?`)) {
      if (isDesktop) {
        try {
          const success = await window.electronAPI.sftpRm(currentPath, name);
          if (success) {
            loadFiles();
            if (onTerminalLog) {
              onTerminalLog(`\r\nsftp: Removed remote item '${name}' visually.`);
            }
          }
        } catch (err) {
          alert('Không thể xóa mục: ' + err.message);
        }
      } else {
        const success = sshSimulator.sftpRm(tabId, currentPath, name);
        if (success) {
          loadFiles();
          if (onTerminalLog) {
            onTerminalLog(`\r\nsftp: Removed remote item '${name}' visually.`);
          }
        }
      }
    }
  };

  // -------------------------------------------------------------
  // KÉO THẢ TỆP TIN THẬT (REAL DRAG & DROP FILE READER)
  // -------------------------------------------------------------
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      
      for (const file of files) {
        try {
          const content = await readFileContent(file);
          if (isDesktop) {
            await window.electronAPI.sftpUpload(currentPath, file.name, content);
            if (onTerminalLog) {
              onTerminalLog(`\r\nsftp: Dropped & Uploaded file '${file.name}' (${file.size} bytes) from your device successfully!`);
            }
          } else {
            sshSimulator.sftpUpload(tabId, currentPath, file.name, content);
            if (onTerminalLog) {
              onTerminalLog(`\r\nsftp: Dropped & Uploaded file '${file.name}' (${file.size} bytes) from your device successfully!`);
            }
          }
        } catch (err) {
          console.error('Không thể đọc hoặc upload file:', err);
          if (onTerminalLog) {
            onTerminalLog(`\r\nsftp error: Lỗi tải lên file thả vào: ${err.message}`);
          }
        }
      }
      loadFiles();
    }
  };

  // Đọc nội dung tệp tin cục bộ từ drag-drop
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      // Đọc dạng text (nếu file nhị phân sẽ mô phỏng chuỗi raw)
      reader.readAsText(file);
    });
  };

  // Xác định icon tệp tin
  const getItemIcon = (item) => {
    if (item.type === 'dir') return <Folder size={16} className="sftp-item-icon" style={{ color: 'var(--term-blue)' }} />;
    
    const ext = item.name.split('.').pop().toLowerCase();
    if (['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'sql'].includes(ext)) {
      return <FileCode size={16} className="sftp-item-icon" style={{ color: 'var(--term-green)' }} />;
    }
    if (['txt', 'md', 'log'].includes(ext)) {
      return <FileText size={16} className="sftp-item-icon" style={{ color: 'var(--text-main)' }} />;
    }
    return <File size={16} className="sftp-item-icon" />;
  };

  return (
    <div className="sftp-container">
      {/* SFTP Header */}
      <div className="sftp-header">
        <div className="sftp-title-row">
          <span className="sftp-title-text">
            <Network size={14} style={{ color: 'var(--accent)' }} />
            SFTP FILE EXPLORER
          </span>
          <div className="sftp-controls">
            <button 
              className="glass-button" 
              onClick={handleMkdir} 
              title="Create Folder"
              style={{ padding: '4px 8px' }}
            >
              <FolderPlus size={14} />
            </button>
            <button 
              className="glass-button" 
              onClick={handleUploadClick} 
              title="Upload File"
              style={{ padding: '4px 8px' }}
            >
              <Upload size={14} />
            </button>
          </div>
        </div>

        {/* Current Path with Back Button */}
        <div className="sftp-path-row">
          <button 
            className="sftp-back-btn" 
            onClick={handleBackClick}
            disabled={currentPath === '/' || !currentPath}
            title="Go to parent directory"
          >
            <ArrowLeft size={12} />
          </button>
          <span className="sftp-path-text">{currentPath}</span>
        </div>
      </div>

      {/* Visual File Area */}
      <div className="sftp-file-area">
        {items.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', padding: '24px', textAlign: 'center' }}>
            Empty directory
          </div>
        ) : (
          items.map(item => (
            <div 
              key={item.name} 
              className="sftp-item-row"
              onClick={() => handleItemClick(item)}
            >
              <div className="sftp-item-left">
                {getItemIcon(item)}
                <span className="sftp-item-name">{item.name}</span>
              </div>
              <div className="sftp-item-right">
                {item.type === 'file' && (
                  <span className="sftp-item-size">{item.size} B</span>
                )}
                <button 
                  className="sftp-delete-btn"
                  onClick={(e) => handleDelete(e, item.name)}
                  title={`Delete remote ${item.type}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Drag & Drop File Upload Area */}
      <div 
        className={`sftp-dropzone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <Upload size={18} className="sftp-dropzone-icon" />
        <span>Kéo thả file thật từ máy tính của bạn vào đây để Upload trực tiếp</span>
      </div>
    </div>
  );
}
