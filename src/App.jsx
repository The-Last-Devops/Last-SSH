import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import TabsBar from './components/TabsBar.jsx';
import TerminalTab from './components/TerminalTab.jsx';
import SFTPBrowser from './components/SFTPBrowser.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import LockScreen from './components/LockScreen.jsx';
import P2PSyncModal from './components/P2PSyncModal.jsx';

import { securityService } from './services/securityService.js';
import { virtualFS } from './services/virtualFS.js';
import { sshSimulator } from './services/sshSimulator.js';

import './App.css';

const DEFAULT_SETTINGS = {
  appTheme: 'Glass Aura',
  terminalTheme: 'Glass Aura',
  fontFamily: 'Fira Code',
  fontSize: 14,
  cursorStyle: 'block',
  crtEnabled: true
};

const STORAGE_KEYS = {
  SETTINGS: 'terminus_settings',
  CONNECTIONS_PLAIN: 'terminus_connections_plain',
  KEYS_PLAIN: 'terminus_keys_plain'
};

const generateUniqueId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

export default function App() {
  // 1. Trạng thái Khóa bảo mật (Security State)
  const [isLocked, setIsLocked] = useState(false);

  // 2. Cài đặt, Kết nối và Khóa Private Keys (App Global States)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [connections, setConnections] = useState([]);
  const [keys, setKeys] = useState([]);

  // 3. Quản lý Đa Tab (Tab Management)
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState('');

  // 4. Trạng thái các Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isP2PSyncOpen, setIsP2PSyncOpen] = useState(false);
  const [isSftpOpenMap, setIsSftpOpenMap] = useState({}); // tabId -> boolean



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
    const tabId = generateUniqueId('tab-local');
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

  const handleSelectTab = (tabId) => {
    setActiveTabId(tabId);
  };

  const handleCloseTab = (tabId) => {
    const remainingTabs = tabs.filter(t => t.id !== tabId);
    
    // Nếu đóng phiên SSH, dọn dẹp bộ nhớ SSH session
    sshSimulator.closeSession(tabId);

    if (remainingTabs.length === 0) {
      // Nếu đóng hết tab, tự tạo 1 tab local mới
      openNewLocalTab();
      return;
    }

    setTabs(remainingTabs);

    // Nếu đóng tab đang active -> Chuyển active sang tab cuối cùng
    if (activeTabId === tabId) {
      setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
    }
  };

  const handleRenameTab = (tabId, newTitle) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: newTitle } : t));
  };

  const handleUpdateTab = (tabId, updatedFields) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updatedFields } : t));
  };

  // -------------------------------------------------------------
  // TÁC VỤ KẾT NỐI SSH & ĐỒNG BỘ SFTP (SSH & SFTP INTERACTION)
  // -------------------------------------------------------------
  const handleConnectSSH = (profile) => {
    const tabId = generateUniqueId('tab-ssh');
    
    // Tạo phiên SSH mô phỏng
    const session = sshSimulator.createSession(tabId, profile, keys);

    const initialHistory = [
      { type: 'system', text: `\r\nStarting SSH connection to ${profile.label}...` }
    ];
    session.logs.forEach(log => {
      initialHistory.push({ type: 'output', text: log });
    });

    const newTab = {
      id: tabId,
      title: `ssh: ${profile.host}`,
      type: 'ssh',
      currentPath: `/home/${profile.username}`,
      history: initialHistory,
      commandHistory: [],
      connectionProfile: profile
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    
    // Mặc định mở visual SFTP cho phiên SSH mới
    setIsSftpOpenMap(prev => ({ ...prev, [tabId]: true }));
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
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

    // Nếu đã bật PIN, tự động mã hóa lưu settings
    if (securityService.hasPIN() && securityService.isUnlocked) {
      securityService.saveSecureData({
        connections: connections,
        settings: updated,
        keys: keys
      }).catch(e => console.error('Lỗi đồng bộ mã hóa settings:', e));
    }
  };

  // Thêm kết nối SSH mới
  const handleAddConnection = async (newProfile) => {
    const profile = { ...newProfile, id: generateUniqueId('conn') };
    const updated = [...connections, profile];
    setConnections(updated);

    await saveConnectionsState(updated);
  };

  // Sửa kết nối SSH
  const handleEditConnection = async (id, updatedProfile) => {
    const updated = connections.map(c => c.id === id ? { ...c, ...updatedProfile } : c);
    setConnections(updated);

    await saveConnectionsState(updated);
  };

  // Xóa kết nối SSH
  const handleDeleteConnection = async (id) => {
    const updated = connections.filter(c => c.id !== id);
    setConnections(updated);

    await saveConnectionsState(updated);
  };

  // Ghi tệp lưu trữ kết nối SSH (Tự động lựa chọn Plain hoặc Encrypted)
  const saveConnectionsState = async (connectionsList) => {
    if (securityService.hasPIN()) {
      if (securityService.isUnlocked) {
        try {
          await securityService.saveSecureData({
            connections: connectionsList,
            settings: settings,
            keys: keys
          });
        } catch (e) {
          console.error('Không thể đồng bộ mã hóa connections:', e);
        }
      }
    } else {
      localStorage.setItem(STORAGE_KEYS.CONNECTIONS_PLAIN, JSON.stringify(connectionsList));
    }
  };

  // -------------------------------------------------------------
  // TÁC VỤ QUẢN LÝ SSH PRIVATE KEYS (SSH PRIVATE KEYS WORKFLOW)
  // -------------------------------------------------------------
  const handleAddKey = async (newKey) => {
    const keyProfile = { ...newKey, id: generateUniqueId('key') };
    const updated = [...keys, keyProfile];
    setKeys(updated);
    await saveKeysState(updated);
  };

  const handleEditKey = async (id, updatedKey) => {
    const updated = keys.map(k => k.id === id ? { ...k, ...updatedKey } : k);
    setKeys(updated);
    await saveKeysState(updated);
  };

  const handleDeleteKey = async (id) => {
    // Xóa liên kết khóa ở các connection profile
    const updatedConns = connections.map(c => c.keyId === id ? { ...c, keyId: '' } : c);
    if (JSON.stringify(updatedConns) !== JSON.stringify(connections)) {
      setConnections(updatedConns);
      await saveConnectionsState(updatedConns);
    }

    const updated = keys.filter(k => k.id !== id);
    setKeys(updated);
    await saveKeysState(updated);
  };

  const saveKeysState = async (keysList) => {
    if (securityService.hasPIN()) {
      if (securityService.isUnlocked) {
        try {
          await securityService.saveSecureData({
            connections: connections,
            settings: settings,
            keys: keysList
          });
        } catch (e) {
          console.error('Không thể đồng bộ mã hóa keys:', e);
        }
      }
    } else {
      localStorage.setItem(STORAGE_KEYS.KEYS_PLAIN, JSON.stringify(keysList));
    }
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
      setKeys(decryptedPayload.keys);
    }
  };

  // Khôi phục dữ liệu từ Import JSON hoặc P2P Sync
  const handleImportRestore = (importedData) => {
    // 1. Cập nhật Virtual FS (Đã được thực hiện trực tiếp trong service)
    // 2. Cập nhật Connections
    if (importedData.connections) {
      setConnections(importedData.connections);
      if (!securityService.hasPIN()) {
        localStorage.setItem(STORAGE_KEYS.CONNECTIONS_PLAIN, JSON.stringify(importedData.connections));
      }
    }
    // 3. Cập nhật Settings
    if (importedData.settings) {
      setSettings(prev => ({ ...prev, ...importedData.settings }));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(importedData.settings));
    }
    // 4. Cập nhật Keys
    if (importedData.keys) {
      setKeys(importedData.keys);
      if (!securityService.hasPIN()) {
        localStorage.setItem(STORAGE_KEYS.KEYS_PLAIN, JSON.stringify(importedData.keys));
      }
    }

    // Nếu đã kích hoạt PIN, mã hóa ghi đè toàn bộ dữ liệu mới nhận
    if (securityService.hasPIN() && securityService.isUnlocked) {
      securityService.saveSecureData({
        connections: importedData.connections || connections,
        settings: importedData.settings || settings,
        keys: importedData.keys || keys
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
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.CONNECTIONS_PLAIN);
    localStorage.removeItem(STORAGE_KEYS.KEYS_PLAIN);
    // 3. Reset security
    securityService.resetSecurity();

    // 4. Reset React State
    setSettings(DEFAULT_SETTINGS);
    setConnections([]);
    setKeys([]);
    setIsLocked(false);
    setIsSftpOpenMap({});
    
    // Đóng toàn bộ tab và mở lại tab local rỗng
    setTabs([]);
    openNewLocalTab();
  };

  // -------------------------------------------------------------
  // BOOTSTRAP INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    const bootstrap = async () => {
      // Kiểm tra xem ứng dụng có bị khóa mã PIN không
      const pinEnabled = securityService.hasPIN();
      setIsLocked(pinEnabled);

      // Tải cấu hình App (Settings)
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          // Tương thích ngược: Nếu có settings.theme cũ, gán sang appTheme và terminalTheme
          if (parsed.theme && !parsed.appTheme) {
            parsed.appTheme = parsed.theme;
            parsed.terminalTheme = parsed.theme;
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
            setKeys(JSON.parse(storedKeys));
          } catch (e) {
            console.error('Lỗi đọc keys plain:', e);
          }
        }
      }

      // Khởi tạo Tab Local đầu tiên
      openNewLocalTab();
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
        <div className="app-container">
          {/* Thanh bên trái: Sidebar - Connection Manager */}
          <Sidebar 
            connections={connections}
            keys={keys}
            onAddConnection={handleAddConnection}
            onEditConnection={handleEditConnection}
            onDeleteConnection={handleDeleteConnection}
            onConnectSSH={handleConnectSSH}
            onNewLocalTab={openNewLocalTab}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenP2PSync={() => setIsP2PSyncOpen(true)}
          />

          {/* Khung chính bên phải: MainContent */}
          <div className="main-content">
            
            {/* Header: chứa TabsBar quản lý tab */}
            <div className="header-bar">
              <TabsBar 
                tabs={tabs}
                activeTabId={activeTabId}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
                onRenameTab={handleRenameTab}
                onNewTab={openNewLocalTab}
              />
            </div>

            {/* Content: Hiển thị Terminal và SFTP Browser Split Pane */}
            <div className="content-frame">
              {activeTab && (
                <div className="split-pane">
                  
                  {/* Cửa sổ Terminal Tab */}
                  <div className="terminal-pane">
                    <TerminalTab 
                      tab={activeTab}
                      settings={settings}
                      onUpdateTab={handleUpdateTab}
                      onCloseTab={handleCloseTab}
                      onSwitchToSFTP={handleSwitchToSFTP}
                    />
                  </div>

                  {/* Cửa sổ visual SFTP (Chỉ hiện khi ở kết nối SSH và toggle bật) */}
                  {isSftpOpen && (
                    <div className="sftp-pane">
                      <SFTPBrowser 
                        tabId={activeTab.id}
                        currentPath={activeTab.currentPath}
                        onNavigate={(newPath) => {
                          // Điều hướng SFTP visual đồng bộ cập nhật path trong tab state
                          handleUpdateTab(activeTab.id, { currentPath: newPath });
                        }}
                        onTerminalLog={(msg) => handleSFTPTerminalLog(activeTab.id, msg)}
                      />
                    </div>
                  )}

                </div>
              )}
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

      {/* 4. Modal đồng bộ dữ liệu P2P WebRTC */}
      <P2PSyncModal 
        isOpen={isP2PSyncOpen}
        onClose={() => setIsP2PSyncOpen(false)}
        connections={connections}
        settings={settings}
        onSyncComplete={handleImportRestore}
      />
    </div>
  );
}
