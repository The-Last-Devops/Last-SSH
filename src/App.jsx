import { useState, useEffect, useRef, useCallback } from 'react';
import TabsBar from './components/TabsBar.jsx';
import TerminalTab from './components/TerminalTab.jsx';
import SFTPBrowser from './components/SFTPBrowser.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import LockScreen from './components/LockScreen.jsx';
import P2PSyncModal from './components/P2PSyncModal.jsx';
import HostsDashboard from './components/HostsDashboard.jsx';
import { Settings, HardDrive } from 'lucide-react';

import { securityService } from './services/securityService.js';
import { virtualFS } from './services/virtualFS.js';
import { sshSimulator } from './services/sshSimulator.js';
import { storageService } from './services/storageService.js';

import './App.css';

const DEFAULT_SETTINGS = {
  appTheme: 'Dark',
  terminalTheme: 'Dark',
  fontFamily: 'Fira Code',
  fontSize: 14,
  cursorStyle: 'block',
  crtEnabled: false
};

const STORAGE_KEYS = {
  SETTINGS: 'terminus_settings',
  CONNECTIONS_PLAIN: 'terminus_connections_plain',
  KEYS_PLAIN: 'terminus_keys_plain',
  IDENTITIES_PLAIN: 'terminus_identities_plain'
};


const savePlainAppState = ({ connections = [], keys = [], identities = [] }) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  storageService.setItem(STORAGE_KEYS.CONNECTIONS_PLAIN, JSON.stringify(connections));
  storageService.setItem(STORAGE_KEYS.KEYS_PLAIN, JSON.stringify(keys));
  storageService.setItem(STORAGE_KEYS.IDENTITIES_PLAIN, JSON.stringify(identities));
};

const saveEncryptedAppState = async (appState) => {
  if (!securityService.hasPIN() || !securityService.isUnlocked) return;

  try {
    await securityService.saveSecureData(appState);
  } catch (e) {
    console.error('Không thể đồng bộ mã hóa app state:', e);
  }
};

export default function App() {
  // 1. Trạng thái Khóa bảo mật (Security State)
  const [isLocked, setIsLocked] = useState(false);

  // 2. Cài đặt, Kết nối và Khóa Private Keys (App Global States)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [connections, setConnections] = useState([]);
  const [keys, setKeys] = useState([]);
  const [identities, setIdentities] = useState([]);

  // 3. Quản lý Đa Tab (Tab Management)
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState('hosts-dashboard');

  // 4. Trạng thái các Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isP2PSyncOpen, setIsP2PSyncOpen] = useState(false);
  const [isSftpOpenMap, setIsSftpOpenMap] = useState({}); // tabId -> boolean
  const [hostPickerOpen, setHostPickerOpen] = useState(false);
  const [sftpWidth, setSftpWidth] = useState(340);
  const sftpResizing = useRef(false);
  const sftpContainerRef = useRef(null);

  const startSftpResize = useCallback((e) => {
    e.preventDefault();
    sftpResizing.current = true;
    const onMove = (mv) => {
      if (!sftpResizing.current || !sftpContainerRef.current) return;
      const containerW = sftpContainerRef.current.offsetWidth;
      const minW = Math.max(240, containerW * 0.25);
      const maxW = containerW * 0.5;
      // drag handle is on LEFT edge of SFTP panel → distance from right
      const newW = containerW - (mv.clientX - sftpContainerRef.current.getBoundingClientRect().left);
      setSftpWidth(Math.min(maxW, Math.max(minW, newW)));
    };
    const onUp = () => {
      sftpResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const persistAppState = async (appState) => {
    const nextState = {
      settings,
      connections,
      keys,
      identities,
      ...appState
    };

    if (securityService.hasPIN()) {
      await saveEncryptedAppState(nextState);
    } else {
      savePlainAppState(nextState);
    }
    
    // Proactively flush to disk immediately after saving
    const _api = (typeof window !== 'undefined') ? (window.electronAPI ?? window.webAPI ?? null) : null;
    if (_api?.flushStorage) _api.flushStorage().catch(() => {});
  };








  useEffect(() => {
    const themeClass = `theme-${(settings.appTheme || 'Glass Aura').toLowerCase().replace(/ /g, '-')}`;
    
    // Xóa tất cả các class theme cũ
    document.body.className = '';
    // Thêm theme class mới
    document.body.classList.add(themeClass);
  }, [settings.appTheme]);

  // -------------------------------------------------------------
  // TÁC VỤ QUẢN LÝ TAB (TAB SYSTEM WORKFLOW)
  // -------------------------------------------------------------
  const openNewLocalTab = () => {
    const tabId = crypto.randomUUID();
    const newTab = {
      id: tabId,
      title: 'Local terminal',
      type: 'local',
      currentPath: '/home/user',
      history: [
        { type: 'system', text: 'Welcome to Last SSH (React + Vite) v1.0.0.' },
        { type: 'system', text: "Type 'help' to see simulated commands, or 'neofetch' for system info." }
      ],
      commandHistory: []
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
  };

  const handleDuplicateTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !tab.connectionProfile) return;
    const baseName = tab.title.replace(/ \(\d+\)$/, '');
    const sameNameCount = tabs.filter(t => t.title === baseName || t.title.startsWith(baseName + ' (')).length;
    const newTitle = `${baseName} (${sameNameCount + 1})`;
    handleConnectSSH({ ...tab.connectionProfile, _overrideTitle: newTitle });
  };

  const handleSelectTab = (tabId) => {
    setActiveTabId(tabId);
  };

  const handleCloseTab = (tabId) => {
    const remainingTabs = tabs.filter(t => t.id !== tabId);
    
    // Nếu đóng phiên SSH, dọn dẹp bộ nhớ SSH session
    sshSimulator.closeSession(tabId);

    setTabs(remainingTabs);

    if (remainingTabs.length === 0) {
      setActiveTabId('hosts-dashboard');
      return;
    }

    // Nếu đóng tab đang active -> Chuyển active sang tab cuối cùng
    if (activeTabId === tabId) {
      setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
    }
  };

  const handleRenameTab = (tabId, newTitle) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: newTitle } : t));
  };

  const handleReorderTabs = (fromIndex, toIndex) => {
    setTabs(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  };

  const handleUpdateTab = (tabId, updatedFields) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updatedFields } : t));
  };

  // -------------------------------------------------------------
  // TÁC VỤ KẾT NỐI SSH & ĐỒNG BỘ SFTP (SSH & SFTP INTERACTION)
  // -------------------------------------------------------------
  const handleConnectSSH = (profile) => {
    // 1. Phân giải Identity credentials
    let resolvedProfile = { ...profile };
    if (profile.identityId) {
      const identity = (identities || []).find(i => i.id === profile.identityId);
      if (identity) {
        resolvedProfile.username = identity.username;
        if (identity.authType === 'password') {
          resolvedProfile.password = identity.password;
          resolvedProfile.keyId = '';
        } else if (identity.authType === 'key') {
          resolvedProfile.keyId = identity.keyId;
          resolvedProfile.password = '';
        }
      }
    }

    // 2. Phân giải Private Key content
    if (resolvedProfile.keyId) {
      const matchedKey = (keys || []).find(k => k.id === resolvedProfile.keyId);
      if (matchedKey) {
        resolvedProfile.keyContent = matchedKey.keyContent;
        if (matchedKey.passphrase) {
          resolvedProfile.passphrase = matchedKey.passphrase;
        }
      }
    }

    const tabId = crypto.randomUUID();
    resolvedProfile.tabId = tabId; // Truyền tabId để Electron quản lý session

    const isDesktop = typeof window !== 'undefined' && !!(window.electronAPI ?? window.webAPI);

    const initialHistory = [
      { type: 'system', text: `\r\nStarting SSH connection to ${resolvedProfile.label || resolvedProfile.host}...` }
    ];

    // Chỉ tạo session giả lập nếu KHÔNG chạy trong Electron Desktop
    if (!isDesktop) {
      const session = sshSimulator.createSession(tabId, resolvedProfile, keys);
      session.logs.forEach(log => {
        initialHistory.push({ type: 'output', text: log });
      });
    }

    const newTab = {
      id: tabId,
      title: resolvedProfile._overrideTitle || `ssh: ${resolvedProfile.label || resolvedProfile.host}`,
      type: 'ssh',
      currentPath: `/home/${resolvedProfile.username || 'ubuntu'}`,
      history: initialHistory,
      commandHistory: [],
      connectionProfile: resolvedProfile
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    
    // Chỉ mở SFTP nếu host có cấu hình openWithSFTP = true
    setIsSftpOpenMap(prev => ({ ...prev, [tabId]: !!resolvedProfile.openWithSFTP }));
  };

  const handleSwitchToSFTP = (tabId, isOpen) => {
    setIsSftpOpenMap(prev => ({ ...prev, [tabId]: isOpen }));
  };

  // In log ra Terminal khi thao tác trực quan ở SFTP browser
  const handleSFTPTerminalLog = (tabId, logMessage) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const newHistory = [...tab.history, { type: 'system', text: logMessage }];
    
    // In tiếp prompt
    const session = sshSimulator.getSession(tabId);
    const promptString = session 
      ? `\r${session.username}@${session.host}:${session.currentPath} $ `
      : `\ruser@lastssh:${tab.currentPath} $ `;
    
    newHistory.push({ type: 'output', text: promptString });

    handleUpdateTab(tabId, { history: newHistory });
  };

  // -------------------------------------------------------------
  // ĐỒNG BỘ HÓA MÃ HÓA & CẤU HÌNH (STATE SYNC & ENCRYPTION)
  // -------------------------------------------------------------
  
  // Cập nhật Cài đặt Preferences
  const handleUpdateSettings = (newSettingsFields) => {
    const updated = { ...settings, ...newSettingsFields };
    setSettings(updated);
    storageService.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

    if (securityService.hasPIN() && securityService.isUnlocked) {
      persistAppState({ settings: updated }).catch(e => console.error('Lỗi đồng bộ mã hóa settings:', e));
    } else {
      // Proactively flush if persistAppState wasn't called
      if (typeof window !== 'undefined' && window.electronAPI?.flushStorage) {
        window.electronAPI.flushStorage().catch(() => {});
      }
    }
  };

  // Thêm kết nối SSH mới
  const handleAddConnection = async (newProfile) => {
    const profile = { ...newProfile, id: crypto.randomUUID() };
    const updated = [...connections, profile];
    setConnections(updated);

    await persistAppState({ connections: updated });
  };

  // Sửa kết nối SSH
  const handleEditConnection = async (id, updatedProfile) => {
    const updated = connections.map(c => c.id === id ? { ...c, ...updatedProfile } : c);
    setConnections(updated);

    await persistAppState({ connections: updated });
  };

  // Xóa kết nối SSH
  const handleDeleteConnection = async (id) => {
    const updated = connections.filter(c => c.id !== id);
    setConnections(updated);

    await persistAppState({ connections: updated });
  };

  // -------------------------------------------------------------
  // TÁC VỤ QUẢN LÝ SSH PRIVATE KEYS (SSH PRIVATE KEYS WORKFLOW)
  // -------------------------------------------------------------
  const handleAddKey = async (newKey) => {
    const keyProfile = { ...newKey, id: crypto.randomUUID() };
    const currentKeys = Array.isArray(keys) ? keys : [];
    const updated = [...currentKeys, keyProfile];
    setKeys(updated);

    await persistAppState({ keys: updated });
  };

  const handleEditKey = async (id, updatedKey) => {
    const currentKeys = Array.isArray(keys) ? keys : [];
    const updated = currentKeys.map(k => k.id === id ? { ...k, ...updatedKey } : k);
    setKeys(updated);

    await persistAppState({ keys: updated });
  };

  const handleDeleteKey = async (id) => {
    const currentConns = Array.isArray(connections) ? connections : [];
    const updatedConns = currentConns.map(c => c.keyId === id ? { ...c, keyId: '' } : c);
    const connsChanged = updatedConns.some((c, i) => c !== currentConns[i]);

    if (connsChanged) setConnections(updatedConns);

    const currentKeys = Array.isArray(keys) ? keys : [];
    const updatedKeys = currentKeys.filter(k => k.id !== id);
    setKeys(updatedKeys);

    await persistAppState({
      connections: connsChanged ? updatedConns : currentConns,
      keys: updatedKeys
    });
  };

  // -------------------------------------------------------------
  // TÁC VỤ QUẢN LÝ SSH IDENTITIES (SSH IDENTITIES WORKFLOW)
  // -------------------------------------------------------------
  const handleAddIdentity = async (newIdentity) => {
    const identityProfile = { ...newIdentity, id: crypto.randomUUID() };
    const currentIdentities = Array.isArray(identities) ? identities : [];
    const updated = [...currentIdentities, identityProfile];
    setIdentities(updated);

    await persistAppState({ identities: updated });
  };

  const handleDeleteIdentity = async (id) => {
    const currentConns = Array.isArray(connections) ? connections : [];
    const updatedConns = currentConns.map(c => c.identityId === id ? { ...c, identityId: '' } : c);
    const connsChanged = updatedConns.some((c, i) => c !== currentConns[i]);

    if (connsChanged) setConnections(updatedConns);

    const currentIdentities = Array.isArray(identities) ? identities : [];
    const updatedIdentities = currentIdentities.filter(i => i.id !== id);
    setIdentities(updatedIdentities);

    await persistAppState({
      connections: connsChanged ? updatedConns : currentConns,
      identities: updatedIdentities
    });
  };

  // -------------------------------------------------------------
  // THỦ TỤC MỞ KHÓA & ĐỒNG BỘ DỮ LIỆU (LOCKSCREEN & SYNC HANDLERS)
  // -------------------------------------------------------------
  
  // Callback khi mở khóa PIN/Vân tay thành công từ LockScreen
  const handleUnlockSuccess = (decryptedPayload) => {
    setIsLocked(false);
    
    // Phục hồi dữ liệu giải mã được vào React State
    if (decryptedPayload.connections) {
      setConnections(decryptedPayload.connections);
    }
    if (decryptedPayload.settings) {
      setSettings(prev => ({ ...prev, ...decryptedPayload.settings }));
    }
    if (decryptedPayload.keys) {
      setKeys(Array.isArray(decryptedPayload.keys) ? decryptedPayload.keys : []);
    }
    if (decryptedPayload.identities) {
      setIdentities(Array.isArray(decryptedPayload.identities) ? decryptedPayload.identities : []);
    }
  };

  // Khôi phục dữ liệu từ Import JSON hoặc P2P Sync
  const handleImportRestore = (importedData) => {
    // 1. Cập nhật Virtual FS (Đã được thực hiện trực tiếp trong service)
    // 2. Cập nhật Connections
    if (importedData.connections) {
      setConnections(importedData.connections);
      if (!securityService.hasPIN()) {
        storageService.setItem(STORAGE_KEYS.CONNECTIONS_PLAIN, JSON.stringify(importedData.connections));
      }
    }
    // 3. Cập nhật Settings
    if (importedData.settings) {
      setSettings(prev => ({ ...prev, ...importedData.settings }));
      storageService.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(importedData.settings));
    }
    // 4. Cập nhật Keys
    if (importedData.keys) {
      const keysList = Array.isArray(importedData.keys) ? importedData.keys : [];
      setKeys(keysList);
      if (!securityService.hasPIN()) {
        storageService.setItem(STORAGE_KEYS.KEYS_PLAIN, JSON.stringify(keysList));
      }
    }
    // 5. Cập nhật Identities
    if (importedData.identities) {
      const identitiesList = Array.isArray(importedData.identities) ? importedData.identities : [];
      setIdentities(identitiesList);
      if (!securityService.hasPIN()) {
        storageService.setItem(STORAGE_KEYS.IDENTITIES_PLAIN, JSON.stringify(identitiesList));
      }
    }

    // Nếu đã kích hoạt PIN, mã hóa ghi đè toàn bộ dữ liệu mới nhận
    if (securityService.hasPIN() && securityService.isUnlocked) {
      securityService.saveSecureData({
        connections: importedData.connections || connections,
        settings: importedData.settings || settings,
        keys: importedData.keys || keys,
        identities: importedData.identities || identities
      }).catch(e => console.error('Lỗi mã hóa dữ liệu import:', e));
    }

    // Refresh lại Tab Terminal chính
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.type === 'local') {
      const refreshedHistory = [
        ...activeTab.history,
        { type: 'system', text: '\r\n[Hệ thống] Đồng bộ dữ liệu thành công! Khôi phục môi trường hoàn tất.' }
      ];
      handleUpdateTab(activeTabId, { history: refreshedHistory });
    }
  };

  // Factory Reset toàn bộ ứng dụng
  const handleFactoryResetData = () => {
    // 1. Reset Virtual FS
    virtualFS.reset();
    // 2. Xóa các lưu trữ cục bộ
    storageService.removeItem(STORAGE_KEYS.SETTINGS);
    storageService.removeItem(STORAGE_KEYS.CONNECTIONS_PLAIN);
    storageService.removeItem(STORAGE_KEYS.KEYS_PLAIN);
    storageService.removeItem(STORAGE_KEYS.IDENTITIES_PLAIN);
    // 3. Reset security
    securityService.resetSecurity();

    // 4. Reset React State
    setSettings(DEFAULT_SETTINGS);
    setConnections([]);
    setKeys([]);
    setIdentities([]);
    setIsLocked(false);
    setIsSftpOpenMap({});
    
    // Đóng toàn bộ tab, trở về Hosts Dashboard.
    setTabs([]);
    setActiveTabId('hosts-dashboard');
  };

  // -------------------------------------------------------------
  // BOOTSTRAP INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    console.timeEnd('🕒 [3/4] React: Thời gian khởi tạo DOM (createRoot)');
    console.time('🕒 [4/4] App: Thời gian xử lý Bootstrap (Storage, Crypto, Security)');
    
    const bootstrap = async () => {
      // Seed localStorage từ file store (Electron) trước khi đọc bất kỳ key nào
      await storageService.init();

      // Re-init virtualFS sau khi localStorage đã được seed từ file store
      // (virtualFS được khởi tạo lúc module load, trước khi storageService.init() chạy)
      virtualFS.init();

      // Kiểm tra xem ứng dụng có bị khóa mã PIN không
      const pinEnabled = securityService.hasPIN();
      setIsLocked(pinEnabled);

      // Tải cấu hình App (Settings)
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          
          // Tự động tắt CRT scanlines nếu phát hiện cấu hình cũ chưa được di chuyển
          if (!localStorage.getItem('lastssh_crt_fixed')) {
            parsed.crtEnabled = false;
            storageService.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed));
            storageService.setItem('lastssh_crt_fixed', 'true');
          }
          
          const normalizeTheme = (themeName) => {
            if (!themeName) return 'Dark';
            const name = themeName.toLowerCase();
            if (name === 'light' || name.includes('light') || name.includes('terminus') || name.includes('white')) {
              return 'Light';
            }
            return 'Dark';
          };

          if (parsed.theme) {
            parsed.appTheme = normalizeTheme(parsed.theme);
            parsed.terminalTheme = normalizeTheme(parsed.theme);
            delete parsed.theme;
          } else {
            if (parsed.appTheme) parsed.appTheme = normalizeTheme(parsed.appTheme);
            if (parsed.terminalTheme) parsed.terminalTheme = normalizeTheme(parsed.terminalTheme);
          }
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch (e) {
          console.error('Lỗi đọc settings:', e);
        }
      }

      if (!pinEnabled) {
        // Nếu KHÔNG có mã PIN -> Tải thẳng các connections từ plain storage
        const storedConns = localStorage.getItem(STORAGE_KEYS.CONNECTIONS_PLAIN);
        if (storedConns) {
          try {
            setConnections(JSON.parse(storedConns));
          } catch (e) {
            console.error('Lỗi đọc connections plain:', e);
          }
        }

        // Tải Private Keys plain
        const storedKeys = localStorage.getItem(STORAGE_KEYS.KEYS_PLAIN);
        if (storedKeys) {
          try {
            const parsed = JSON.parse(storedKeys);
            setKeys(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.error('Lỗi đọc keys plain:', e);
            setKeys([]);
          }
        }

        // Tải Identities plain
        const storedIdentities = localStorage.getItem(STORAGE_KEYS.IDENTITIES_PLAIN);
        if (storedIdentities) {
          try {
            const parsed = JSON.parse(storedIdentities);
            setIdentities(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.error('Lỗi đọc identities plain:', e);
            setIdentities([]);
          }
        }
      }

      // Khởi động ứng dụng với Hosts Dashboard hiển thị, local terminal mở khi người dùng cần.
      setTabs([]);
      setActiveTabId('hosts-dashboard');
      
      console.timeEnd('🕒 [4/4] App: Thời gian xử lý Bootstrap (Storage, Crypto, Security)');
      const totalTime = performance.now() - window.__APP_START_TIME__;
      console.log(`✅ [HOÀN TẤT] Tổng thời gian khởi động (Từ lúc HTML load xong đến khi sẵn sàng sử dụng): ${totalTime.toFixed(1)}ms`);
    };
    bootstrap();

    // Lắng nghe sự kiện đổi theme nhanh qua console 'theme <name>'
    const handleThemeCmd = (e) => {
      const themeName = e.detail;
      handleUpdateSettings({ appTheme: themeName, terminalTheme: themeName });
    };
    window.addEventListener('change-theme-cmd', handleThemeCmd);
    return () => {
      window.removeEventListener('change-theme-cmd', handleThemeCmd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isSftpOpen = activeTabId && isSftpOpenMap[activeTabId] && activeTab && activeTab.type === 'ssh';

  return (
    <div className="glass-container">
      {/* 1. Trình khóa an ninh màn hình LockScreen */}
      {isLocked && (
        <LockScreen onUnlockSuccess={handleUnlockSuccess} />
      )}

      {/* 2. Giao diện làm việc chính của ứng dụng */}
      {!isLocked && (
        <div
          className="flex w-full h-full overflow-hidden relative"
        >
          {/* Khung chính bên phải: MainContent */}
          <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden relative bg-black/5">

            {/* Title bar — kéo dài lên đỉnh window, tab nằm trong vùng traffic lights */}
            <div
              className="w-full border-b border-border flex items-center justify-between shrink-0"
              style={{ WebkitAppRegion: 'drag', height: 36 }}
            >
              {/* Khoảng trống cho traffic lights macOS — 80px để tránh đè lên ● ● ● */}
              <div style={{ width: 80, flexShrink: 0 }} />

              {/* Tabs — vùng trống giữa các tab vẫn drag được window */}
              <div className="flex-1 min-w-0">
                <TabsBar
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onSelectTab={handleSelectTab}
                  onCloseTab={handleCloseTab}
                  onRenameTab={handleRenameTab}
                  onReorderTabs={handleReorderTabs}
                  onNewTab={() => setHostPickerOpen(true)}
                  onDuplicateTab={handleDuplicateTab}
                />
              </div>

              {/* Action buttons bên phải — no-drag */}
              <div className="flex gap-1.5 pr-3 shrink-0" style={{ WebkitAppRegion: 'no-drag', alignSelf: 'flex-end', marginBottom: 2 }}>
                {activeTab && activeTab.type === 'ssh' && (
                  <button
                    id="btn-toggle-sftp"
                    onClick={() => setIsSftpOpenMap(prev => ({ ...prev, [activeTabId]: !prev[activeTabId] }))}
                    title={isSftpOpen ? 'Ẩn SFTP Explorer' : 'Mở SFTP Explorer'}
                    style={{
                      background: isSftpOpen ? 'rgba(0,126,255,0.12)' : 'transparent',
                      border: 'none', color: isSftpOpen ? '#2563eb' : '#9ca3af',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '30px', height: '30px', borderRadius: '8px', transition: 'all 0.15s'
                    }}
                  >
                    <HardDrive size={15} />
                  </button>
                )}
                <button
                  id="btn-settings"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Preferences"
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px' }}
                >
                  <Settings size={15} />
                </button>
              </div>
            </div>

            {/* Content: Hiển thị Terminal và SFTP Browser Split Pane HOẶC Hosts Dashboard */}
            <div className="min-h-0 min-w-0 flex-1 w-full flex overflow-hidden relative">
              {/* Hosts Dashboard — chỉ render khi active */}
              {activeTabId === 'hosts-dashboard' && (
                <HostsDashboard
                  connections={connections}
                  keys={keys}
                  identities={identities}
                  onAddConnection={handleAddConnection}
                  onEditConnection={handleEditConnection}
                  onDeleteConnection={handleDeleteConnection}
                  onConnectSSH={handleConnectSSH}
                  onOpenLocalTerminal={openNewLocalTab}
                  onAddKey={handleAddKey}
                  onDeleteKey={handleDeleteKey}
                  onAddIdentity={handleAddIdentity}
                  onDeleteIdentity={handleDeleteIdentity}
                  settings={settings}
                  onSyncComplete={handleImportRestore}
                />
              )}

              {/* Tất cả terminal tabs luôn mounted — chỉ ẩn/hiện bằng CSS
                  Tránh reconnect SSH khi switch tab */}
              {tabs.map(tab => {
                const isActive = tab.id === activeTabId;
                const isSftpTabOpen = isSftpOpenMap[tab.id] && tab.type === 'ssh';
                return (
                  <div
                    key={tab.id}
                    ref={isActive ? sftpContainerRef : null}
                    className="flex w-full h-full overflow-hidden min-h-0 min-w-0"
                    style={{ display: isActive ? 'flex' : 'none' }}
                  >
                    <div className="flex-1 min-h-0 min-w-0 h-full overflow-hidden relative">
                      <TerminalTab
                        tab={tab}
                        settings={settings}
                        onUpdateTab={handleUpdateTab}
                        onCloseTab={handleCloseTab}
                        onSwitchToSFTP={handleSwitchToSFTP}
                      />
                    </div>
                    {isSftpTabOpen && (
                      <>
                        {/* Drag handle */}
                        <div
                          style={{ width: 4, cursor: 'col-resize', flexShrink: 0, background: 'rgba(0,0,0,0.08)', transition: 'background 0.15s' }}
                          onMouseDown={startSftpResize}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,115,232,0.4)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
                          title="Drag to resize"
                        />
                        {/* SFTP panel */}
                        <div
                          className="min-h-0 h-full shrink-0 overflow-hidden border-l border-border"
                          style={{ width: sftpWidth }}
                        >
                          <SFTPBrowser
                            tabId={tab.id}
                            currentPath={tab.currentPath}
                            onNavigate={(newPath) => handleUpdateTab(tab.id, { currentPath: newPath })}
                            onTerminalLog={(msg) => handleSFTPTerminalLog(tab.id, msg)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* 3. Modal Preference Settings */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        connections={connections}
        keys={keys}
        onAddKey={handleAddKey}
        onEditKey={handleEditKey}
        onDeleteKey={handleDeleteKey}
        onImportData={handleImportRestore}
        onResetData={handleFactoryResetData}
      />

      {/* 4. Host Picker — mở khi bấm nút + tab mới */}
      {hostPickerOpen && (
        <div
          className="modal-overlay"
          onClick={() => setHostPickerOpen(false)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: 480, maxHeight: '70vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title">Open New Tab</span>
              <button className="modal-close-btn" onClick={() => setHostPickerOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '12px 0' }}>
              {/* Local Terminal */}
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                onClick={() => { openNewLocalTab(); setHostPickerOpen(false); }}
              >
                <span style={{ fontSize: 18 }}>💻</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Local Terminal</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Local shell on this machine</div>
                </div>
              </button>
              {/* SSH Connections */}
              {connections.length === 0 && (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Chưa có host nào. Thêm host từ màn hình Home.
                </div>
              )}
              {connections.map(conn => (
                <button
                  key={conn.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => { handleConnectSSH(conn); setHostPickerOpen(false); }}
                >
                  <span style={{ fontSize: 18 }}>🖥️</span>
                  <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conn.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{conn.username}@{conn.host}:{conn.port || 22}</div>
                  </div>
                  {conn.tags?.length > 0 && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(137,180,250,0.12)', color: '#89b4fa' }}>{conn.tags[0]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal đồng bộ dữ liệu P2P WebRTC */}
      <P2PSyncModal
        isOpen={isP2PSyncOpen}
        onClose={() => setIsP2PSyncOpen(false)}
        connections={connections}
        settings={settings}
        keys={keys}
        identities={identities}
        onSyncComplete={handleImportRestore}
      />
    </div>
  );
}
