// server.cjs — Last SSH Web Server
// WebSocket backend thay thế Electron IPC cho web version
// Protocol: client gửi { type, reqId?, ...payload }, server reply { type, reqId?, ...data }

'use strict';

const express = require('express');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '/tmp', '.last-ssh-web');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── File-based store (giống electron/main.cjs) ─────────────────────────────
const STORE_PATH = path.join(DATA_DIR, 'store.json');
let storeCache = null;

function loadStore() {
  if (storeCache) return storeCache;
  try {
    storeCache = fs.existsSync(STORE_PATH) ? JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) : {};
  } catch {
    storeCache = {};
  }
  return storeCache;
}

function flushStore() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(storeCache), 'utf8'); } catch (e) {
    console.error('[store] flush failed:', e.message);
  }
}

// ── Known hosts (TOFU) ──────────────────────────────────────────────────────
const KNOWN_HOSTS_PATH = path.join(DATA_DIR, 'known_hosts.json');
let knownHosts = {};

function loadKnownHosts() {
  try {
    if (fs.existsSync(KNOWN_HOSTS_PATH)) knownHosts = JSON.parse(fs.readFileSync(KNOWN_HOSTS_PATH, 'utf8'));
  } catch { knownHosts = {}; }
}

function saveKnownHosts() {
  try { fs.writeFileSync(KNOWN_HOSTS_PATH, JSON.stringify(knownHosts, null, 2)); } catch {}
}

loadStore();
loadKnownHosts();

// ── HTTP + WebSocket Server ──────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Serve static frontend build (production)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Per-connection session handler ──────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[ws] Client connected: ${clientIp}`);

  const sshSessions = {};   // tabId -> { client, stream, sftp }
  const localSessions = {}; // tabId -> pty process
  const pendingResizes = {};

  // ── Helpers ──────────────────────────────────────────────────────────────
  function send(type, payload = {}) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  function reply(reqId, result, error) {
    if (!reqId) return;
    send('reply', { reqId, result: result ?? null, error: error ?? null });
  }

  function cleanupSession(tabId) {
    const session = sshSessions[tabId];
    if (!session) return;
    try { if (session.stream) session.stream.end(); } catch {}
    try { if (session.client) session.client.end(); } catch {}
    delete sshSessions[tabId];
  }

  function cleanupLocalSession(tabId) {
    const session = localSessions[tabId];
    if (!session) return;
    try { session.kill(); } catch {}
    delete localSessions[tabId];
  }

  function getActiveSFTP(preferTabId) {
    if (preferTabId && sshSessions[preferTabId]?.sftp) return sshSessions[preferTabId].sftp;
    const ids = Object.keys(sshSessions);
    for (let i = ids.length - 1; i >= 0; i--) {
      if (sshSessions[ids[i]]?.sftp) return sshSessions[ids[i]].sftp;
    }
    return null;
  }

  // ── Message router ────────────────────────────────────────────────────────
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, reqId } = msg;

    // ── SSH connect ────────────────────────────────────────────────────────
    if (type === 'ssh-connect') {
      const profile = msg.profile;
      const tabId = profile.tabId || 'default';
      cleanupSession(tabId);

      const client = new Client();
      sshSessions[tabId] = { client, stream: null, sftp: null };

      const host = (profile.host || '').trim();
      const port = parseInt(profile.port, 10);
      const username = (profile.username || 'ubuntu').trim();

      if (!host) {
        send('ssh-data', { tabId, data: `\r\n\x1b[1;31m[SSH Error] Host cannot be empty!\x1b[0m\r\n` });
        return;
      }

      const connPort = isNaN(port) ? 22 : port;

      const connSettings = {
        host,
        port: connPort,
        username,
        readyTimeout: 20000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 5,
        hostVerifier: (fingerprint) => {
          const hostKey = `${host}:${connPort}`;
          const fp = Buffer.isBuffer(fingerprint) ? fingerprint.toString('base64') : String(fingerprint);
          if (!knownHosts[hostKey]) {
            knownHosts[hostKey] = fp;
            saveKnownHosts();
            return true;
          }
          if (knownHosts[hostKey] !== fp) {
            send('ssh-data', { tabId, data: `\r\n\x1b[1;31m[SSH SECURITY WARNING] Fingerprint of ${host} has changed! Connection rejected.\r\nIf the server key legitimately changed, run: ssh-forget-host ${hostKey}\x1b[0m\r\n` });
            return false;
          }
          return true;
        }
      };

      if (profile.keyContent) {
        connSettings.privateKey = profile.keyContent;
        if (profile.passphrase) connSettings.passphrase = profile.passphrase;
      } else if (profile.password) {
        connSettings.password = profile.password;
      }

      send('ssh-data', { tabId, data: `\r\n\x1b[1;33m[SSH] Connecting to ${username}@${host}:${connPort}...\x1b[0m\r\n` });

      client.on('ready', () => {
        send('ssh-data', { tabId, data: `\x1b[1;32m[SSH] Authenticated! Opening shell...\x1b[0m\r\n` });

        client.shell({ term: 'xterm-256color', rows: 24, cols: 80 }, (err, stream) => {
          if (err) {
            send('ssh-data', { tabId, data: `\r\n\x1b[1;31m[SSH Error] Cannot open shell: ${err.message}\x1b[0m\r\n` });
            cleanupSession(tabId);
            return;
          }

          sshSessions[tabId].stream = stream;

          // Apply pending resize nếu renderer đã gửi trước khi shell mở
          if (pendingResizes[tabId]) {
            const { cols, rows } = pendingResizes[tabId];
            delete pendingResizes[tabId];
            if (cols > 0 && rows > 0) {
              try { stream.setWindow(rows, cols, 0, 0); } catch {}
            }
          }

          stream.on('data', (data) => send('ssh-data', { tabId, data: data.toString() }));
          stream.stderr.on('data', (data) => send('ssh-data', { tabId, data: data.toString() }));
          stream.on('close', () => {
            send('ssh-data', { tabId, data: `\r\n\x1b[1;30m[SSH] Connection closed by remote.\x1b[0m\r\n` });
            send('ssh-close', { tabId });
            cleanupSession(tabId);
          });
        });

        // SFTP session song song
        client.sftp((err, sftp) => {
          if (err) {
            console.error(`[sftp] Failed for tab ${tabId}:`, err.message);
            send('sftp-ready', { success: false, error: err.message });
            return;
          }
          if (sshSessions[tabId]) sshSessions[tabId].sftp = sftp;
          send('sftp-ready', { success: true });
        });
      });

      client.on('error', (err) => {
        const msg2 = err.message || String(err);
        let hint = '';
        if (msg2.includes('ECONNRESET'))            hint = ' (Server refused — check SSH port)';
        else if (msg2.includes('ENOTFOUND') || msg2.includes('ECONNREFUSED')) hint = ' (Host not found — check host/IP)';
        else if (msg2.includes('authentication'))   hint = ' (Auth failed — check username/password/key)';
        else if (msg2.includes('ETIMEDOUT'))        hint = ' (Timeout — check firewall/IP)';
        send('ssh-data', { tabId, data: `\r\n\x1b[1;31m[SSH Error] ${msg2}${hint}\x1b[0m\r\n` });
        cleanupSession(tabId);
      });

      client.on('close', () => cleanupSession(tabId));
      client.connect(connSettings);

    } else if (type === 'ssh-write') {
      const session = sshSessions[msg.tabId];
      if (session?.stream) { try { session.stream.write(msg.data); } catch {} }

    } else if (type === 'ssh-disconnect') {
      cleanupSession(msg.tabId || 'default');

    } else if (type === 'ssh-resize') {
      const { tabId, cols, rows } = msg;
      if (!tabId || cols <= 0 || rows <= 0) return;
      const stream = sshSessions[tabId]?.stream;
      if (stream) {
        try { stream.setWindow(rows, cols, 0, 0); } catch {}
      } else {
        pendingResizes[tabId] = { cols, rows };
      }

    } else if (type === 'ssh-get-known-hosts') {
      reply(reqId, { ...knownHosts });

    } else if (type === 'ssh-forget-host') {
      delete knownHosts[msg.hostPort];
      saveKnownHosts();
      reply(reqId, true);

    // ── Local shell ─────────────────────────────────────────────────────────
    } else if (type === 'local-shell-connect') {
      const { tabId, cwd, shell } = msg;
      const sessionTabId = tabId || 'local-default';
      cleanupLocalSession(sessionTabId);

      const candidates = [];
      if (shell) candidates.push(shell);
      if (process.env.SHELL) candidates.push(process.env.SHELL);
      if (process.platform === 'win32') {
        candidates.push('powershell.exe', 'cmd.exe');
      } else {
        candidates.push('/bin/zsh', '/bin/bash', '/bin/sh');
      }

      const userShell = candidates.find(c => { try { return fs.existsSync(c); } catch { return false; } })
        || candidates[candidates.length - 1];
      const cwdPath = cwd || process.env.HOME || process.cwd();

      let ptyProcess;
      try {
        ptyProcess = pty.spawn(userShell, [], {
          name: 'xterm-256color',
          cols: 80, rows: 24,
          cwd: cwdPath,
          env: { ...process.env, TERM: process.env.TERM || 'xterm-256color', COLORTERM: process.env.COLORTERM || 'truecolor' }
        });
      } catch (err) {
        send('local-data', { tabId: sessionTabId, data: `\r\n\x1b[1;31m[Local shell failed: ${err.message}]\x1b[0m\r\n` });
        return;
      }

      localSessions[sessionTabId] = ptyProcess;
      ptyProcess.on('data', (data) => send('local-data', { tabId: sessionTabId, data }));
      ptyProcess.on('exit', (code) => {
        send('local-data', { tabId: sessionTabId, data: `\r\n\x1b[1;30m[Local shell exited with code ${code}]\x1b[0m\r\n` });
        send('local-close', { tabId: sessionTabId });
        cleanupLocalSession(sessionTabId);
      });

    } else if (type === 'local-write') {
      const session = localSessions[msg.tabId];
      if (session) { try { session.write(msg.data); } catch {} }

    } else if (type === 'local-resize') {
      const { tabId, cols, rows } = msg;
      const session = localSessions[tabId];
      if (session && cols > 0 && rows > 0) { try { session.resize(cols, rows); } catch {} }

    } else if (type === 'local-disconnect') {
      cleanupLocalSession(msg.tabId);

    // ── SFTP ────────────────────────────────────────────────────────────────
    } else if (type === 'sftp-status') {
      reply(reqId, { ready: !!getActiveSFTP(msg.tabId) });

    } else if (type === 'sftp-list') {
      const sftp = getActiveSFTP(msg.tabId);
      if (!sftp) return reply(reqId, null, 'SFTP session is not active');
      sftp.readdir(msg.remotePath, (err, list) => {
        if (err) return reply(reqId, null, err.message);
        const formatted = list.map(item => {
          const isDir = item.longname.startsWith('d');
          return {
            name: item.filename,
            type: isDir ? 'dir' : 'file',
            size: item.attrs.size,
            updatedAt: new Date(item.attrs.mtime * 1000).toISOString(),
            permissions: item.longname.split(' ')[0] || '',
          };
        });
        formatted.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        reply(reqId, formatted);
      });

    } else if (type === 'sftp-mkdir') {
      const sftp = getActiveSFTP(msg.tabId);
      if (!sftp) return reply(reqId, null, 'SFTP session is not active');
      const fullPath = path.posix.join(msg.remotePath, msg.folderName);
      sftp.mkdir(fullPath, (err) => err ? reply(reqId, null, err.message) : reply(reqId, true));

    } else if (type === 'sftp-upload') {
      const sftp = getActiveSFTP(msg.tabId);
      if (!sftp) return reply(reqId, null, 'SFTP session is not active');
      const fullPath = path.posix.join(msg.remotePath, msg.fileName);
      sftp.writeFile(fullPath, msg.content, 'utf8', (err) => err ? reply(reqId, null, err.message) : reply(reqId, true));

    } else if (type === 'sftp-download') {
      const sftp = getActiveSFTP(msg.tabId);
      if (!sftp) return reply(reqId, null, 'SFTP session is not active');
      const fullPath = path.posix.join(msg.remotePath, msg.fileName);
      sftp.readFile(fullPath, 'utf8', (err, data) => err ? reply(reqId, null, err.message) : reply(reqId, data));

    } else if (type === 'sftp-rm') {
      const sftp = getActiveSFTP(msg.tabId);
      if (!sftp) return reply(reqId, null, 'SFTP session is not active');
      const fullPath = path.posix.join(msg.remotePath, msg.name);
      sftp.unlink(fullPath, (err) => {
        if (!err) return reply(reqId, true);
        sftp.rmdir(fullPath, (errDir) => errDir ? reply(reqId, null, errDir.message) : reply(reqId, true));
      });

    // ── Store ────────────────────────────────────────────────────────────────
    } else if (type === 'store-get-all') {
      reply(reqId, { ...loadStore() });

    } else if (type === 'store-set') {
      loadStore()[msg.key] = msg.value;
      flushStore();
      reply(reqId, true);

    } else if (type === 'store-remove') {
      delete loadStore()[msg.key];
      flushStore();
      reply(reqId, true);

    } else if (type === 'store-clear') {
      storeCache = {};
      flushStore();
      reply(reqId, true);

    } else if (type === 'flush-storage') {
      reply(reqId, true);

    } else if (type === 'ping') {
      // keepalive — không cần reply
    }
  });

  ws.on('close', () => {
    console.log(`[ws] Client disconnected: ${clientIp}`);
    Object.keys(sshSessions).forEach(id => cleanupSession(id));
    Object.keys(localSessions).forEach(id => cleanupLocalSession(id));
  });

  ws.on('error', (err) => {
    console.error(`[ws] Error for ${clientIp}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`Last SSH Web running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`Data directory: ${DATA_DIR}`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
