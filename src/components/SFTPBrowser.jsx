import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FolderPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { sshSimulator } from '../services/sshSimulator.js';
import './SFTPBrowser.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getKind(item) {
  if (item.type === 'dir') return 'folder';
  const ext = item.name.split('.').pop().toLowerCase();
  return ext || 'file';
}

// Blue macOS-style folder SVG
function FolderIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
      <path d="M0 3C0 1.9 0.9 1 2 1H7.17C7.70 1 8.21 1.21 8.59 1.59L9.41 2.41C9.79 2.79 10.30 3 10.83 3H18C19.1 3 20 3.9 20 5V15C20 16.1 19.1 17 18 17H2C0.9 17 0 16.1 0 15V3Z" fill="#1d4ed8"/>
      <path d="M0 5C0 3.9 0.9 3 2 3H18C19.1 3 20 3.9 20 5V15C20 16.1 19.1 17 18 17H2C0.9 17 0 16.1 0 15V5Z" fill="#3b82f6"/>
    </svg>
  );
}

// Plain file SVG
function FileIcon() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
      <path d="M2 0H10L16 6V18C16 19.1 15.1 20 14 20H2C0.9 20 0 19.1 0 18V2C0 0.9 0.9 0 2 0Z" fill="#E8E8E8" stroke="#C8C8C8" strokeWidth="0.5"/>
      <path d="M10 0L16 6H12C10.9 6 10 5.1 10 4V0Z" fill="#C8C8C8"/>
    </svg>
  );
}

export default function SFTPBrowser({ tabId, currentPath = '', onNavigate, onTerminalLog }) {
  const isDesktop = typeof window !== 'undefined' && window.electronAPI !== undefined;
  const [items, setItems] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [isSftpReady, setIsSftpReady] = useState(!isDesktop);
  const [sftpError, setSftpError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMkdirInput, setShowMkdirInput] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [history, setHistory] = useState([]);
  const uploadInputRef = useRef(null);

  const loadFiles = useCallback(async () => {
    if (!tabId || !currentPath || !isSftpReady) return;
    setIsLoading(true);
    if (isDesktop) {
      try {
        const fileList = await window.electronAPI.sftpList(currentPath);
        setItems(fileList);
        setSftpError(null);
      } catch (err) {
        setSftpError(err.message);
        if (onTerminalLog) onTerminalLog(`\r\nsftp error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      setItems(sshSimulator.sftpList(tabId, currentPath));
      setIsLoading(false);
    }
  }, [tabId, currentPath, isDesktop, onTerminalLog, isSftpReady]);

  useEffect(() => {
    if (!isDesktop) {
      const run = async () => { await loadFiles(); };
      run();
      return;
    }
    let mounted = true;
    window.electronAPI.sftpStatus().then(s => {
      if (mounted && s?.ready) setIsSftpReady(true);
    }).catch(() => {});
    const handleSftpReady = (r) => {
      if (r?.success) { setIsSftpReady(true); setSftpError(null); }
      else { setSftpError(r?.error || 'SFTP unavailable'); setIsSftpReady(false); }
    };
    const unsub = window.electronAPI.onSFTPReady(handleSftpReady);
    return () => { mounted = false; unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, isDesktop]);

  useEffect(() => {
    if (!isSftpReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSftpReady, currentPath, tabId]);

  // Navigation helpers
  const navigate = (path) => {
    setHistory(h => [...h, currentPath]);
    onNavigate(path);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    onNavigate(prev);
  };

  const goUp = () => {
    if (currentPath === '/' || !currentPath) return;
    const lastSlash = currentPath.lastIndexOf('/');
    navigate(currentPath.slice(0, lastSlash) || '/');
  };

  const handleItemClick = (item) => {
    if (item.type === 'dir') {
      const next = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      navigate(next);
      if (onTerminalLog) onTerminalLog(`\r\nsftp: cd ${next}`);
    } else {
      handleDownload(item.name);
    }
  };

  const readFileContent = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.onerror = (e) => reject(e);
    r.readAsText(file);
  });

  const handleMkdirSubmit = async () => {
    const name = mkdirName.trim();
    if (!name) return;
    setShowMkdirInput(false); setMkdirName('');
    if (isDesktop) {
      try { await window.electronAPI.sftpMkdir(currentPath, name); loadFiles(); }
      catch (err) { alert('Cannot create folder: ' + err.message); }
    } else {
      sshSimulator.sftpMkdir(tabId, currentPath, name);
      loadFiles();
    }
    if (onTerminalLog) onTerminalLog(`\r\nsftp: mkdir ${name}`);
  };

  const handleUploadClick = () => uploadInputRef.current?.click();

  const handleUploadFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length, filename: file.name, done: false });
      try {
        const content = await readFileContent(file);
        if (isDesktop) await window.electronAPI.sftpUpload(currentPath, file.name, content);
        else sshSimulator.sftpUpload(tabId, currentPath, file.name, content);
        if (onTerminalLog) onTerminalLog(`\r\nsftp: uploaded '${file.name}' (${formatSize(file.size)})`);
      } catch (err) {
        setUploadProgress(null);
        alert(`Cannot upload '${file.name}': ` + err.message);
        return;
      }
    }
    setUploadProgress({ current: files.length, total: files.length, filename: '', done: true });
    setTimeout(() => setUploadProgress(null), 1800);
    loadFiles();
  };

  const handleDownload = async (fileName) => {
    try {
      const content = isDesktop
        ? await window.electronAPI.sftpDownload(currentPath, fileName)
        : sshSimulator.sftpDownload(tabId, currentPath, fileName);
      if (content === null) return;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      if (onTerminalLog) onTerminalLog(`\r\nsftp: downloaded '${fileName}'`);
    } catch (err) { alert('Cannot download: ' + err.message); }
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!confirm(`Delete '${item.name}' on remote server?`)) return;
    if (isDesktop) {
      try { await window.electronAPI.sftpRm(currentPath, item.name); loadFiles(); }
      catch (err) { alert('Cannot delete: ' + err.message); }
    } else {
      sshSimulator.sftpRm(tabId, currentPath, item.name);
      loadFiles();
    }
    if (onTerminalLog) onTerminalLog(`\r\nsftp: rm ${item.name}`);
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = async (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    for (const file of files) {
      try {
        const content = await readFileContent(file);
        if (isDesktop) await window.electronAPI.sftpUpload(currentPath, file.name, content);
        else sshSimulator.sftpUpload(tabId, currentPath, file.name, content);
        if (onTerminalLog) onTerminalLog(`\r\nsftp: dropped & uploaded '${file.name}'`);
      } catch (err) { if (onTerminalLog) onTerminalLog(`\r\nsftp error: ${err.message}`); }
    }
    loadFiles();
  };

  // Breadcrumb parts
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="sftp-container" onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}>
      <input ref={uploadInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleUploadFileChange} />

      {/* ── Toolbar ── */}
      <div className="sftp-toolbar">
        <div className="sftp-nav-btns">
          <button className="sftp-nav-btn" onClick={goBack} disabled={history.length === 0} title="Back">
            <ChevronLeft size={15} strokeWidth={2.5} />
          </button>
          <button className="sftp-nav-btn" onClick={goUp} disabled={currentPath === '/' || !currentPath} title="Up">
            <ChevronRight size={15} strokeWidth={2.5} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="sftp-breadcrumb">
          <button className="sftp-crumb" onClick={() => navigate('/')}>
            <FolderIcon /> <span>/</span>
          </button>
          {pathParts.map((part, i) => {
            const fullPath = '/' + pathParts.slice(0, i + 1).join('/');
            return (
              <span key={fullPath} className="sftp-crumb-row">
                <span className="sftp-crumb-sep">›</span>
                <button className="sftp-crumb" onClick={() => navigate(fullPath)}>
                  <FolderIcon /> <span>{part}</span>
                </button>
              </span>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="sftp-toolbar-actions">
          <button className="sftp-action-btn" onClick={() => { setShowMkdirInput(v => !v); setMkdirName(''); }} title="New Folder">
            <FolderPlus size={14} />
          </button>
          <button className="sftp-action-btn" onClick={handleUploadClick} title="Upload">
            <Upload size={14} />
          </button>
        </div>
      </div>

      {/* ── Mkdir inline ── */}
      {showMkdirInput && (
        <div className="sftp-mkdir-row">
          <input className="sftp-mkdir-input" placeholder="New folder name..." value={mkdirName}
            onChange={e => setMkdirName(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleMkdirSubmit(); if (e.key === 'Escape') { setShowMkdirInput(false); setMkdirName(''); } }}
          />
          <button className="sftp-mkdir-ok" onClick={handleMkdirSubmit}>Create</button>
          <button className="sftp-mkdir-cancel" onClick={() => { setShowMkdirInput(false); setMkdirName(''); }}>✕</button>
        </div>
      )}

      {/* ── Upload progress ── */}
      {uploadProgress && (
        <div className="sftp-upload-progress">
          <div className="sftp-upload-progress__bar-wrap">
            <div className="sftp-upload-progress__bar" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
          </div>
          <div className="sftp-upload-progress__label">
            {uploadProgress.done ? `✓ Uploaded ${uploadProgress.total} file(s)` : `Uploading ${uploadProgress.current}/${uploadProgress.total}: ${uploadProgress.filename}`}
          </div>
        </div>
      )}

      {/* ── Column headers ── */}
      <div className="sftp-col-header">
        <div className="sftp-col sftp-col--name">Name</div>
        <div className="sftp-col sftp-col--date">Date Modified</div>
        <div className="sftp-col sftp-col--size">Size</div>
        <div className="sftp-col sftp-col--kind">Kind</div>
      </div>

      {/* ── File list ── */}
      <div className="sftp-file-area">
        {/* Status: waiting */}
        {isDesktop && !isSftpReady && !sftpError && (
          <div className="sftp-status">⏳ Waiting for SFTP session...</div>
        )}
        {sftpError && (
          <div className="sftp-status sftp-status--error">⚠️ {sftpError}</div>
        )}
        {isLoading && (
          <div className="sftp-status">Loading...</div>
        )}

        {!isLoading && isSftpReady && !sftpError && (
          <>
            {/* Back row (..) */}
            {currentPath !== '/' && currentPath && (
              <div className="sftp-row" onClick={goUp}>
                <div className="sftp-col sftp-col--name">
                  <span className="sftp-row-icon"><FolderIcon /></span>
                  <span className="sftp-row-name">..</span>
                </div>
                <div className="sftp-col sftp-col--date" />
                <div className="sftp-col sftp-col--size">- -</div>
                <div className="sftp-col sftp-col--kind">folder</div>
              </div>
            )}

            {items.length === 0 && (
              <div className="sftp-status">Empty directory</div>
            )}

            {items.map(item => (
              <div key={item.name} className={`sftp-row${item.type === 'dir' ? ' sftp-row--dir' : ''}`} onClick={() => handleItemClick(item)}>
                <div className="sftp-col sftp-col--name">
                  <span className="sftp-row-icon" title={item.permissions || ''}>
                    {item.type === 'dir' ? <FolderIcon /> : <FileIcon />}
                  </span>
                  <div className="sftp-row-name-wrap">
                    <span className="sftp-row-name">{item.name}</span>
                  </div>
                </div>
                <div className="sftp-col sftp-col--date">{formatDate(item.updatedAt)}</div>
                <div className="sftp-col sftp-col--size">{item.type === 'dir' ? '- -' : formatSize(item.size)}</div>
                <div className="sftp-col sftp-col--kind">{getKind(item)}</div>
                <button className="sftp-row-delete" onClick={(e) => handleDelete(e, item)} title="Delete">✕</button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Drop zone ── */}
      <div className={`sftp-dropzone${dragActive ? ' drag-active' : ''}`}>
        <Upload size={16} className="sftp-dropzone-icon" />
        <span>Drop files here to upload</span>
      </div>
    </div>
  );
}
