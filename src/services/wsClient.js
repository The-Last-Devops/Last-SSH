// wsClient.js — WebSocket client adapter cho web version
// Cung cấp cùng interface với window.electronAPI để các component không cần thay đổi logic.
// Tự động mount vào window.webAPI khi import.

function createWebAPI() {
  // Resolve WebSocket URL:
  // 1. VITE_WS_URL env var (Cloudflare Pages / tách frontend-backend)
  // 2. Same host fallback (Docker / Railway — frontend + backend cùng server)
  const wsUrl = import.meta.env.VITE_WS_URL || (() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  })();

  let ws = null;
  let pendingRequests = {}; // reqId -> { resolve, reject, timer }
  const listeners = {};     // event type -> Set<callback>
  let reqCounter = 0;
  let reconnectTimer = null;
  let connected = false;

  function genReqId() {
    return `r${++reqCounter}_${Date.now()}`;
  }

  function addListener(eventType, cb) {
    if (!listeners[eventType]) listeners[eventType] = new Set();
    listeners[eventType].add(cb);
    return () => listeners[eventType].delete(cb);
  }

  function emit(eventType, payload) {
    const cbs = listeners[eventType];
    if (cbs) cbs.forEach(cb => { try { cb(payload); } catch {} });
  }

  function sendRaw(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  // invoke — request/response (mirrors ipcRenderer.invoke)
  function invoke(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const reqId = genReqId();
      const timer = setTimeout(() => {
        delete pendingRequests[reqId];
        reject(new Error(`[wsClient] Request "${type}" timed out`));
      }, 30000);
      pendingRequests[reqId] = { resolve, reject, timer };
      if (!sendRaw({ type, reqId, ...payload })) {
        clearTimeout(timer);
        delete pendingRequests[reqId];
        reject(new Error('[wsClient] WebSocket not connected'));
      }
    });
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('[wsClient] Cannot create WebSocket:', e.message);
      reconnectTimer = setTimeout(connect, 3000);
      return;
    }

    ws.onopen = () => {
      connected = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      console.log('[wsClient] Connected to server');
      // Ping mỗi 30s để giữ connection — tránh bị nginx/Cloudflare cắt sau 60s idle
      const pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
      ws._pingInterval = pingInterval;
    };

    ws.onclose = () => {
      connected = false;
      if (ws?._pingInterval) clearInterval(ws._pingInterval);
      ws = null;
      // Reject tất cả pending requests
      Object.values(pendingRequests).forEach(({ reject: rej, timer }) => {
        clearTimeout(timer);
        rej(new Error('[wsClient] WebSocket disconnected'));
      });
      pendingRequests = {};
      // Reconnect sau 2s
      reconnectTimer = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      // onclose sẽ xử lý cleanup và reconnect
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      const { type } = msg;

      // Xử lý response cho invoke
      if (type === 'reply') {
        const pending = pendingRequests[msg.reqId];
        if (pending) {
          clearTimeout(pending.timer);
          delete pendingRequests[msg.reqId];
          if (msg.error) pending.reject(new Error(msg.error));
          else pending.resolve(msg.result);
        }
        return;
      }

      // Route event đến listeners
      if (type === 'ssh-data')    emit('ssh-data',    { tabId: msg.tabId, data: msg.data });
      else if (type === 'ssh-close')   emit('ssh-close',   msg.tabId);
      else if (type === 'local-data')  emit('local-data',  { tabId: msg.tabId, data: msg.data });
      else if (type === 'local-close') emit('local-close', msg.tabId);
      else if (type === 'sftp-ready')  emit('sftp-ready',  msg);
    };
  }

  connect();

  return {
    // ── SSH ──────────────────────────────────────────────────────────────────
    connectSSH:    (profile)              => sendRaw({ type: 'ssh-connect', profile }),
    onSSHData:     (cb)                   => addListener('ssh-data', cb),
    writeSSHData:  (tabId, data)          => sendRaw({ type: 'ssh-write', tabId, data }),
    resizeSSH:     ({ tabId, cols, rows }) => sendRaw({ type: 'ssh-resize', tabId, cols, rows }),
    onSSHClose:    (cb)                   => addListener('ssh-close', cb),

    // ── Local shell ──────────────────────────────────────────────────────────
    connectLocalShell: (payload)          => sendRaw({ type: 'local-shell-connect', ...payload }),
    onLocalData:       (cb)              => addListener('local-data', cb),
    writeLocalData:    (tabId, data)     => sendRaw({ type: 'local-write', tabId, data }),
    resizeLocal:       ({ tabId, cols, rows }) => sendRaw({ type: 'local-resize', tabId, cols, rows }),
    onLocalClose:      (cb)              => addListener('local-close', cb),

    // ── SFTP ─────────────────────────────────────────────────────────────────
    onSFTPReady:   (cb)                             => addListener('sftp-ready', cb),
    sftpStatus:    ()                               => invoke('sftp-status'),
    sftpList:      (remotePath)                     => invoke('sftp-list',     { remotePath }),
    sftpMkdir:     (remotePath, folderName)         => invoke('sftp-mkdir',    { remotePath, folderName }),
    sftpUpload:    (remotePath, fileName, content)  => invoke('sftp-upload',   { remotePath, fileName, content }),
    sftpDownload:  (remotePath, fileName)           => invoke('sftp-download', { remotePath, fileName }),
    sftpRm:        (remotePath, name)               => invoke('sftp-rm',       { remotePath, name }),

    // ── Known hosts ──────────────────────────────────────────────────────────
    getKnownHosts: ()           => invoke('ssh-get-known-hosts'),
    forgetHost:    (hostPort)   => invoke('ssh-forget-host', { hostPort }),

    // ── Storage (sync to server so data persists on backend) ─────────────────
    flushStorage: () => Promise.resolve(true),
    store: {
      getAll:  ()           => invoke('store-get-all'),
      set:     (key, value) => invoke('store-set', { key, value }),
      remove:  (key)        => invoke('store-remove', { key }),
      clear:   ()           => invoke('store-clear'),
    },

    // ── Utils ────────────────────────────────────────────────────────────────
    isConnected: () => connected,
  };
}

// Auto-mount: chỉ cài vào window.webAPI nếu KHÔNG có Electron
if (typeof window !== 'undefined' && !window.electronAPI) {
  window.webAPI = createWebAPI();
}
