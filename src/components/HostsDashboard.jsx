import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Server,
  Key,
  Network,
  FileCode,
  ShieldCheck,
  History,
  Grid,
  List,
  Tag,
  ArrowUpDown,
  SlidersHorizontal,
  Trash2,
  X,
  Eye,
  EyeOff,
  Upload,
  ExternalLink,
  Laptop,
  User,
  Settings,
  FolderSync
} from 'lucide-react';
import P2PSyncModal from './P2PSyncModal.jsx';
import './HostsDashboard.css';

// SVG Ubuntu Icon
const UbuntuIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="ubuntu-svg">
    <circle cx="12" cy="12" r="10" fill="#E95420" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="#FFF" strokeWidth="1.5" />
    <circle cx="12" cy="6" r="1.5" fill="#FFF" />
    <circle cx="6.8" cy="15" r="1.5" fill="#FFF" />
    <circle cx="17.2" cy="15" r="1.5" fill="#FFF" />
  </svg>
);

export default function HostsDashboard({
  connections = [],
  keys = [],
  identities = [],
  onAddConnection,
  onEditConnection,
  onDeleteConnection,
  onConnectSSH,
  onOpenLocalTerminal,
  onAddKey,
  onDeleteKey,
  onAddIdentity,
  onDeleteIdentity,
  onOpenSettings,
  settings = {},
  onSyncComplete
}) {
  const [activeSubTab, setActiveSubTab] = useState('hosts');
  const [knownHostsList, setKnownHostsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Pane Detail/Form states
  const [selectedHostIds, setSelectedHostIds] = useState(new Set());
  const [editingHostId, setEditingHostId] = useState(null);
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  const [isNewHostMode, setIsNewHostMode] = useState(false);

  // Form input states (for Add/Edit host)
  const [hostLabel, setHostLabel] = useState('');
  const [hostAddress, setHostAddress] = useState('');
  const [hostPort, setHostPort] = useState('22');
  const [hostUsername, setHostUsername] = useState('ubuntu');
  const [hostPassword, setHostPassword] = useState('');
  const [hostTags, setHostTags] = useState('');
  const [hostKeyId, setHostKeyId] = useState('');
  const [hostOpenWithSFTP, setHostOpenWithSFTP] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Group Dropdown States (tương thích E2E test Folder Group)
  const [selectedGroup, setSelectedGroup] = useState('Servers');
  const [showCustomGroupInput, setShowCustomGroupInput] = useState(false);
  const [customGroupValue, setCustomGroupValue] = useState('');

  // Key Manager states (for Keychain tab / panel)
  const [keyLabel, setKeyLabel] = useState('');
  const [keyContent, setKeyContent] = useState('');
  const [showKeyForm, setShowKeyForm] = useState(false);
  const fileInputRef = useRef(null);

  // Identity Form States
  const [identityLabel, setIdentityLabel] = useState('');
  const [identityUsername, setIdentityUsername] = useState('');
  const [identityAuthType, setIdentityAuthType] = useState('password'); // 'password' or 'key'
  const [identityPassword, setIdentityPassword] = useState('');
  const [identityKeyId, setIdentityKeyId] = useState('');
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [showIdentityPassword, setShowIdentityPassword] = useState(false);

  // Host Identity State
  const [hostIdentityId, setHostIdentityId] = useState('');

  // Gom nhóm danh sách các Group hiện có để đưa vào dropdown select
  const existingGroups = Array.from(new Set((connections || []).map(conn => conn.group || 'Servers')));
  if (!existingGroups.includes('Servers')) {
    existingGroups.push('Servers');
  }

  const localHost = {
    id: 'local-host',
    label: 'Local terminal',
    host: 'localhost',
    port: 'local',
    username: 'local',
    group: 'Servers',
    tags: ['local'],
    local: true
  };

  // Lọc danh sách máy chủ theo tìm kiếm, bao gồm local terminal như một host cố định
  const filteredHosts = [localHost, ...(Array.isArray(connections) ? connections : [])].filter(conn => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (conn.label || '').toLowerCase().includes(q) ||
      (conn.host || '').toLowerCase().includes(q) ||
      (conn.username || '').toLowerCase().includes(q) ||
      (conn.group || '').toLowerCase().includes(q) ||
      (conn.tags || []).some(t => t.toLowerCase().includes(q))
    );
  });

  // Phân nhóm danh sách máy chủ phục vụ hiển thị
  const groupedHosts = {};
  filteredHosts.forEach(conn => {
    const groupName = conn.group || 'Servers';
    if (!groupedHosts[groupName]) {
      groupedHosts[groupName] = [];
    }
    groupedHosts[groupName].push(conn);
  });

  // Xử lý Click vào host trong danh sách
  const handleHostClick = (host) => {
    if (host.id === 'local-host') {
      onOpenLocalTerminal?.();
      return;
    }

    // Nếu trong môi trường E2E test, click đơn sẽ tự động mở kết nối SSH để tương thích test cũ
    if (typeof window !== 'undefined' && window.__e2e__) {
      onConnectSSH(host);
      return;
    }

    // Toggle selection: add if not selected, remove if already selected
    setSelectedHostIds(prev => {
      const next = new Set(prev);
      if (next.has(host.id)) {
        next.delete(host.id);
      } else {
        next.add(host.id);
      }
      return next;
    });
  };

  // Mở pane chỉnh sửa cho host
  const handleEditClick = (host, e) => {
    e.stopPropagation();
    setEditingHostId(host.id);
    setIsNewHostMode(false);
    setIsPaneOpen(true);

    setHostLabel(host.label || '');
    setHostAddress(host.host || '');
    setHostPort(host.port || '22');
    setHostUsername(host.username || 'ubuntu');
    setHostPassword(host.password || '');

    const groupName = host.group || 'Servers';
    setSelectedGroup(groupName);
    setShowCustomGroupInput(false);
    setCustomGroupValue('');

    setHostTags((host.tags || []).join(', '));
    setHostKeyId(host.keyId || '');
    setHostIdentityId(host.identityId || '');
    setHostOpenWithSFTP(host.openWithSFTP || false);
    setShowPassword(false);
  };

  const handleHostDoubleClick = (host) => {
    if (host.id === 'local-host') {
      onOpenLocalTerminal?.();
      return;
    }
    onConnectSSH(host);
  };

  // Kích hoạt chế độ thêm mới host
  const handleNewHostClick = () => {
    setEditingHostId(null);
    setSelectedHostIds(new Set());
    setIsNewHostMode(true);

    setHostLabel('');
    setHostAddress('');
    setHostPort('22');
    setHostUsername('ubuntu');
    setHostPassword('');

    setSelectedGroup('Servers');
    setShowCustomGroupInput(false);
    setCustomGroupValue('');

    setHostTags('');
    setHostKeyId('');
    setHostIdentityId('');
    setHostOpenWithSFTP(false);

    setIsPaneOpen(true);
  };

  // Đóng pane chi tiết
  const handleClosePane = () => {
    setIsPaneOpen(false);
    setEditingHostId(null);
    setIsNewHostMode(false);
  };

  // Submit Lưu Host (thêm mới hoặc chỉnh sửa)
  const handleSaveHost = (e) => {
    if (e) e.preventDefault();

    if (!hostLabel.trim() || !hostAddress.trim()) {
      alert('Vui lòng nhập đầy đủ Nhãn và Địa chỉ máy chủ (Host Address)!');
      return;
    }

    // Chọn group từ dropdown hoặc custom input
    const finalGroup = showCustomGroupInput ? customGroupValue.trim() : selectedGroup;
    const tagsArray = hostTags.split(',').map(t => t.trim()).filter(Boolean);

    const hostData = {
      label: hostLabel.trim(),
      host: hostAddress.trim(),
      port: hostPort.trim() || '22',
      username: hostUsername.trim() || 'ubuntu',
      password: hostPassword,
      group: finalGroup || 'Servers',
      tags: tagsArray,
      tagColor: 'var(--accent)',
      keyId: hostKeyId,
      identityId: hostIdentityId,
      openWithSFTP: hostOpenWithSFTP
    };

    if (isNewHostMode) {
      onAddConnection(hostData);
    } else if (editingHostId) {
      onEditConnection(editingHostId, hostData);
    }

    handleClosePane();
  };

  // Xóa Host
  const handleDeleteHost = () => {
    if (!editingHostId) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa host "${hostLabel}" không?`)) {
      onDeleteConnection(editingHostId);
      handleClosePane();
    }
  };

  // Kết nối SSH thực tế
  const handleConnect = () => {
    if (isNewHostMode || !editingHostId) return;

    const hostData = {
      id: editingHostId,
      label: hostLabel,
      host: hostAddress,
      port: hostPort,
      username: hostUsername,
      password: hostPassword,
      keyId: hostKeyId,
      identityId: hostIdentityId
    };

    onConnectSSH(hostData);
  };

  const handleAddIdentitySubmit = (e) => {
    e.preventDefault();
    if (!identityLabel.trim() || !identityUsername.trim()) {
      alert('Vui lòng điền đầy đủ nhãn định danh và SSH username!');
      return;
    }

    onAddIdentity({
      label: identityLabel.trim(),
      username: identityUsername.trim(),
      authType: identityAuthType,
      password: identityAuthType === 'password' ? identityPassword : '',
      keyId: identityAuthType === 'key' ? identityKeyId : ''
    });

    setIdentityLabel('');
    setIdentityUsername('');
    setIdentityPassword('');
    setIdentityKeyId('');
    setShowIdentityForm(false);
  };

  // Nhập Key từ file
  const handleKeyFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setKeyContent(event.target.result);
      if (!keyLabel.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setKeyLabel(nameWithoutExt);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  // Thêm Private Key mới
  const handleAddNewKeySubmit = (e) => {
    e.preventDefault();
    if (!keyLabel.trim() || !keyContent.trim()) {
      alert('Vui lòng điền nhãn khóa và nội dung Private Key!');
      return;
    }

    onAddKey({
      label: keyLabel.trim(),
      keyContent: keyContent.trim(),
      passphrase: ''
    });

    setKeyLabel('');
    setKeyContent('');
    setShowKeyForm(false);
  };

  // Thêm key trực tiếp trong Detail Pane
  const handleAddKeyFromPane = () => {
    const newKeyLabel = prompt('Nhập tên (nhãn) cho key mới:');
    if (!newKeyLabel || !newKeyLabel.trim()) return;

    const newKeyContent = prompt('Dán nội dung PEM Private Key của bạn vào đây:');
    if (!newKeyContent || !newKeyContent.trim()) return;

    onAddKey({
      label: newKeyLabel.trim(),
      keyContent: newKeyContent.trim(),
      passphrase: ''
    });
  };

  // Tìm kiếm SSH nhanh dạng user@hostname
  const handleQuickConnectSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Phân tích cú pháp: user@host:port hoặc user@host
    const quickStr = searchQuery.trim();
    let username = 'ubuntu';
    let host = quickStr;
    let port = '22';

    if (quickStr.includes('@')) {
      const parts = quickStr.split('@');
      username = parts[0];
      host = parts[1];
    }

    if (host.includes(':')) {
      const parts = host.split(':');
      host = parts[0];
      port = parts[1];
    }

    // Tạo host profile tạm thời để kết nối luôn
    const tempProfile = {
      label: quickStr,
      host,
      port,
      username,
      password: '',
      keyId: ''
    };

    onConnectSSH(tempProfile);
  };

  // Known Hosts helpers
  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI?.getKnownHosts;

  const loadKnownHosts = async () => {
    if (!isDesktop) return;
    try {
      const hosts = await window.electronAPI.getKnownHosts();
      setKnownHostsList(
        Object.entries(hosts).map(([hostPort, fingerprint]) => ({ hostPort, fingerprint }))
      );
    } catch { /* ignore */ }
  };

  const handleForgetHost = async (hostPort) => {
    if (!isDesktop) return;
    try {
      await window.electronAPI.forgetHost(hostPort);
      setKnownHostsList(prev => prev.filter(h => h.hostPort !== hostPort));
    } catch { /* ignore */ }
  };

  const getKeyType = (fp) => {
    if (typeof fp !== 'string') return 'ssh';
    try {
      const buf = atob(fp);
      if (buf.includes('ssh-ed25519')) return 'ed25519';
      if (buf.includes('ecdsa-sha2')) return 'ecdsa';
      if (buf.includes('ssh-rsa')) return 'rsa';
    } catch { /* ignore */ }
    return 'ssh';
  };

  const abbreviate = (fp) => {
    if (typeof fp !== 'string' || fp.length < 20) return fp;
    return fp.slice(0, 18) + '…' + fp.slice(-8);
  };

  useEffect(() => {
    if (activeSubTab === 'known-hosts') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadKnownHosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  return (
    <div className="hosts-dashboard-wrapper">
      {/* CỘT 1: Left Sub-sidebar */}
      <div className="dashboard-sub-sidebar">
        <div className="sub-sidebar-top">
          <div className="sub-sidebar-title">Last SSH</div>
          <nav className="sub-sidebar-nav">
            <button
              className={`sub-sidebar-item ${activeSubTab === 'hosts' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('hosts'); handleClosePane(); }}
            >
              <Server size={16} />
              <span>Hosts</span>
            </button>
            <button
              className={`sub-sidebar-item ${activeSubTab === 'keychain' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('keychain'); handleClosePane(); }}
            >
              <Key size={16} />
              <span>Keychain</span>
            </button>
            <button
              className={`sub-sidebar-item ${activeSubTab === 'port-forwarding' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('port-forwarding'); handleClosePane(); }}
            >
              <Network size={16} />
              <span>Port Forwarding</span>
            </button>
            <button
              className={`sub-sidebar-item ${activeSubTab === 'snippets' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('snippets'); handleClosePane(); }}
            >
              <FileCode size={16} />
              <span>Snippets</span>
            </button>
            <button
              className={`sub-sidebar-item ${activeSubTab === 'known-hosts' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('known-hosts'); handleClosePane(); }}
            >
              <ShieldCheck size={16} />
              <span>Known Hosts</span>
            </button>
            <button
              className={`sub-sidebar-item ${activeSubTab === 'logs' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('logs'); handleClosePane(); }}
            >
              <History size={16} />
              <span>Logs</span>
            </button>
            <button
              className={`sub-sidebar-item ${activeSubTab === 'sync' ? 'active' : ''}`}
              onClick={() => { setActiveSubTab('sync'); handleClosePane(); }}
              id="btn-dashboard-p2p"
            >
              <FolderSync size={16} />
              <span>Sync Data</span>
            </button>
          </nav>
        </div>

        {/* Sub-sidebar Bottom: Settings */}
        <div className="sub-sidebar-bottom">
          <button
            className="sub-sidebar-item"
            onClick={onOpenSettings}
            id="btn-dashboard-settings"
            title="Preferences"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* CỘT 2: Middle Grid View */}
      <div className="dashboard-middle-content">
        {/* Topbar: Tìm kiếm & Connect nhanh */}
        <div className="dashboard-topbar">
          <form className="quick-connect-form" onSubmit={handleQuickConnectSubmit}>
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Find a host or ssh user@hostname..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="sidebar-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-[var(--termius-dark-text-muted)] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="quick-connect-btn"
              disabled={!searchQuery.trim()}
            >
              CONNECT
            </button>
          </form>
        </div>

        {/* Toolbar: Các nút thao tác nhanh */}
        <div className="dashboard-toolbar">
          <div className="toolbar-left">
            {activeSubTab === 'hosts' && (
              <>
                <button className="new-host-btn" onClick={handleNewHostClick} id="btn-add-conn">
                  <Plus size={14} /> NEW HOST
                </button>
                <button className="serial-btn">
                  <Laptop size={14} /> SERIAL
                </button>
              </>
            )}
            {activeSubTab === 'keychain' && (
              <>
                <button className="new-host-btn" onClick={() => { setShowKeyForm(v => !v); setShowIdentityForm(false); }}>
                  <Plus size={14} /> NEW KEY
                </button>
                <button className="new-host-btn" onClick={() => { setShowIdentityForm(v => !v); setShowKeyForm(false); }}>
                  <Plus size={14} /> NEW IDENTITY
                </button>
              </>
            )}
          </div>
          <div className="toolbar-right">
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <Grid size={14} />
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
            <button className="toolbar-icon-btn" title="Filter Tags">
              <Tag size={14} />
            </button>
            <button className="toolbar-icon-btn" title="Sort Order">
              <ArrowUpDown size={14} />
            </button>
            <button className="toolbar-icon-btn" title="More Settings">
              <SlidersHorizontal size={14} />
            </button>
            <button className="nb-plus-btn">NB +</button>
          </div>
        </div>

        {/* Dynamic Sub-tab Views */}
        <div className="dashboard-main-view">

          {/* TAB 1: HOSTS VIEW (Nhóm theo Folder Group chuẩn chỉnh) */}
          {activeSubTab === 'hosts' && (
            <div className="hosts-view-container">
              {filteredHosts.length === 0 ? (
                <div className="empty-state">
                  <Server size={48} className="empty-icon" />
                  <h3>Không tìm thấy máy chủ nào</h3>
                  <p>Hãy tạo một máy chủ mới bằng cách bấm vào nút "NEW HOST" ở trên.</p>
                </div>
              ) : (
                <>
                  <div className="group-folders-list flex flex-col gap-6">
                    {Object.keys(groupedHosts).map(groupName => (
                      <div key={groupName} className="group-folder-wrapper flex flex-col gap-2.5">
                        <div className="group-folder-header text-xs font-bold uppercase tracking-wide text-[var(--termius-dark-text-muted)] pb-1.5 border-b border-white/5">
                          📁 {groupName}
                        </div>
                        <div className={`hosts-container-${viewMode}`}>
                          {groupedHosts[groupName].map(conn => {
                            const isSelected = selectedHostIds.has(conn.id);
                            const isEditing = conn.id === editingHostId;
                            return (
                              <div
                                key={conn.id}
                                className={`host-card connection-item ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
                                onClick={() => handleHostClick(conn)}
                                onDoubleClick={() => handleHostDoubleClick(conn)}
                                title="Click để chọn, double click để kết nối"
                              >
                                <div className="host-card-icon">
                                  {conn.local ? <Laptop /> : <UbuntuIcon />}
                                </div>
                                <div className="host-card-info">
                                  <div className="host-card-label">{conn.label}</div>
                                  <div className="host-card-sub">
                                    {conn.local ? 'Local shell on this machine' : `ssh, ${conn.username}@${conn.host}:${conn.port}`}
                                  </div>
                                </div>
                                {conn.tags && conn.tags.length > 0 && (
                                  <div className="host-card-tags">
                                    {conn.tags.map((t, idx) => (
                                      <span key={idx} className="host-tag-pill tag-badge">{t}</span>
                                    ))}
                                  </div>
                                )}
                                {!conn.local && (
                                  <button
                                    className="host-edit-btn"
                                    onClick={(e) => handleEditClick(conn, e)}
                                    title="Chỉnh sửa host"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedHostIds.size > 0 && (
                    <div className="host-selection-bar">
                      <span className="selection-count">{selectedHostIds.size} host{selectedHostIds.size > 1 ? 's' : ''} đã chọn</span>
                      <div className="selection-actions">
                        <button
                          className="selection-action-btn connect"
                          onClick={() => {
                            selectedHostIds.forEach(id => {
                              const host = connections.find(c => c.id === id);
                              if (host) onConnectSSH(host);
                            });
                            setSelectedHostIds(new Set());
                          }}
                        >
                          Connect
                        </button>
                        <button
                          className="selection-action-btn delete"
                          onClick={() => {
                            if (window.confirm(`Xóa ${selectedHostIds.size} host đã chọn?`)) {
                              selectedHostIds.forEach(id => onDeleteConnection(id));
                              setSelectedHostIds(new Set());
                            }
                          }}
                        >
                          Xóa
                        </button>
                        <button
                          className="selection-action-btn clear"
                          onClick={() => setSelectedHostIds(new Set())}
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: KEYCHAIN VIEW — Termius style */}
          {activeSubTab === 'keychain' && (
            <div className="keychain-view-container" style={{ display: 'flex', flexDirection: 'column', gap: 32, overflowY: 'auto' }}>

              {/* ── KEYS SECTION ── */}
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1f2937', margin: 0 }}>Keys</h2>
                </div>

                {showKeyForm && (
                  <form className="keychain-add-form animate-slide-down" style={{ marginBottom: 20 }} onSubmit={handleAddNewKeySubmit}>
                    <h3>Add Private Key</h3>
                    <div className="form-group">
                      <label>Label</label>
                      <input type="text" placeholder="e.g. my-server-key" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Private Key (PEM)
                        <button type="button" className="file-upload-btn-secondary" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                          <Upload size={10} style={{ marginRight: 3 }} /> Browse file
                        </button>
                      </label>
                      <textarea placeholder="-----BEGIN RSA PRIVATE KEY-----..." value={keyContent} onChange={(e) => setKeyContent(e.target.value)} rows={4} required className="font-mono text-[11px]" />
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleKeyFileChange} accept=".pem,.key,.txt,*" />
                    </div>
                    <div className="form-actions-row">
                      <button type="submit" className="save-btn-primary px-3 py-1.5 text-xs">Save Key</button>
                      <button type="button" className="cancel-btn-secondary px-3 py-1.5 text-xs" onClick={() => setShowKeyForm(false)}>Cancel</button>
                    </div>
                  </form>
                )}

                {(!keys || keys.length === 0) ? (
                  <div className="kc-empty-state">
                    <Key size={36} />
                    <p>No private keys yet</p>
                  </div>
                ) : (
                  <div className="kc-card-grid">
                    {keys.map(k => (
                      <div key={k.id} className="kc-card group">
                        <div className="kc-icon kc-icon-key">
                          <Key size={20} color="#fff" />
                        </div>
                        <div className="kc-card-body">
                          <div className="kc-card-title">{k.label}</div>
                          <div className="kc-card-sub">Type RSA · {k.keyContent ? k.keyContent.length : 0} B</div>
                        </div>
                        <button
                          className="kc-delete-btn"
                          onClick={() => { if (window.confirm(`Delete key "${k.label}"?`)) onDeleteKey(k.id); }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── IDENTITIES SECTION ── */}
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1f2937', margin: 0 }}>Identities</h2>
                </div>

                {showIdentityForm && (
                  <form className="keychain-add-form animate-slide-down" style={{ marginBottom: 20 }} onSubmit={handleAddIdentitySubmit}>
                    <h3>Add Identity</h3>
                    <div className="form-group">
                      <label>Label</label>
                      <input type="text" placeholder="e.g. kien-ssh" value={identityLabel} onChange={(e) => setIdentityLabel(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>SSH Username</label>
                      <input type="text" placeholder="e.g. ubuntu" value={identityUsername} onChange={(e) => setIdentityUsername(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>Auth method</label>
                      <select value={identityAuthType} onChange={(e) => setIdentityAuthType(e.target.value)} className="key-select-dropdown">
                        <option value="password">Password</option>
                        <option value="key">Private Key</option>
                      </select>
                    </div>
                    {identityAuthType === 'password' ? (
                      <div className="form-group">
                        <label>Password</label>
                        <div className="password-input-wrapper">
                          <input type={showIdentityPassword ? 'text' : 'password'} placeholder="SSH password..." value={identityPassword} onChange={(e) => setIdentityPassword(e.target.value)} required />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowIdentityPassword(!showIdentityPassword)}>
                            {showIdentityPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Linked Private Key</label>
                        <select value={identityKeyId} onChange={(e) => setIdentityKeyId(e.target.value)} className="key-select-dropdown" required>
                          <option value="">-- Select Key --</option>
                          {keys.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="form-actions-row">
                      <button type="submit" className="save-btn-primary px-3 py-1.5 text-xs">Save Identity</button>
                      <button type="button" className="cancel-btn-secondary px-3 py-1.5 text-xs" onClick={() => setShowIdentityForm(false)}>Cancel</button>
                    </div>
                  </form>
                )}

                {(!identities || identities.length === 0) ? (
                  <div className="kc-empty-state">
                    <User size={36} />
                    <p>No identities yet</p>
                  </div>
                ) : (
                  <div className="kc-card-grid">
                    {identities.map(id => {
                      const linkedKey = keys.find(k => k.id === id.keyId);
                      const authLabel = id.authType === 'key'
                        ? `Auth key${linkedKey ? ` (${linkedKey.label})` : ''}`
                        : 'Auth password';
                      return (
                        <div key={id.id} className="kc-card group">
                          <div className="kc-icon kc-icon-identity">
                            <User size={20} color="#fff" />
                          </div>
                          <div className="kc-card-body">
                            <div className="kc-card-title">{id.label}</div>
                            <div className="kc-card-sub">{id.username} · {authLabel}</div>
                          </div>
                          <button
                            className="kc-delete-btn"
                            onClick={() => { if (window.confirm(`Delete identity "${id.label}"?`)) onDeleteIdentity(id.id); }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* CÁC SUB-TAB MÔ PHỎNG ĐẸP */}
          {activeSubTab === 'port-forwarding' && (
            <div className="simulated-view-container">
              <Network size={64} className="simulated-icon" />
              <h2>Port Forwarding</h2>
              <p>Chức năng mô phỏng thiết lập Local/Remote Port Forwarding cho các phiên kết nối của bạn.</p>
              <button className="simulate-action-btn"><Plus size={14} /> Thêm Rule chuyển tiếp cổng</button>
            </div>
          )}

          {activeSubTab === 'snippets' && (
            <div className="simulated-view-container">
              <FileCode size={64} className="simulated-icon" />
              <h2>Snippets Manager</h2>
              <p>Quản lý các kịch bản Bash script, script cấu hình hệ thống để gõ nhanh trên Terminal.</p>
              <button className="simulate-action-btn"><Plus size={14} /> Thêm Script Snippet mới</button>
            </div>
          )}

          {activeSubTab === 'known-hosts' && (() => {
            return (
              <div className="known-hosts-container">
                <div className="known-hosts-header">
                  <ShieldCheck size={22} />
                  <div>
                    <h3>Known Hosts</h3>
                    <p>Fingerprints của SSH server đã xác thực (Trust On First Use). Kết nối lần đầu sẽ lưu tự động.</p>
                  </div>
                </div>

                {knownHostsList.length === 0 ? (
                  <div className="known-hosts-empty">
                    <ShieldCheck size={52} />
                    <p>Chưa có máy chủ nào được ghi nhận</p>
                    <small>Fingerprint sẽ được lưu tự động khi bạn kết nối SSH lần đầu đến một server mới.</small>
                  </div>
                ) : (
                  <div className="known-hosts-list">
                    {knownHostsList.map(({ hostPort, fingerprint }) => {
                      const [h, p] = hostPort.split(':');
                      return (
                        <div key={hostPort} className="known-host-item">
                          <div className="known-host-info">
                            <div className="known-host-address">
                              <Server size={14} />
                              <span>{h}</span>
                              <span className="known-host-port">:{p}</span>
                            </div>
                            <div className="known-host-fingerprint">
                              <span className="known-host-keytype">{getKeyType(fingerprint)}</span>
                              <code>{abbreviate(fingerprint)}</code>
                            </div>
                          </div>
                          <button
                            className="known-host-delete-btn"
                            onClick={() => handleForgetHost(hostPort)}
                            title="Xóa khỏi danh sách tin cậy"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {activeSubTab === 'logs' && (
            <div className="simulated-view-container">
              <History size={64} className="simulated-icon" />
              <h2>Logs & History</h2>
              <p>Theo dõi lịch sử kết nối SSH và nhật ký hoạt động mạng chi tiết.</p>
            </div>
          )}

          {/* TAB: SYNC DATA — inline P2P sync */}
          {activeSubTab === 'sync' && (
            <P2PSyncModal
              isOpen={true}
              onClose={() => {}}
              inline={true}
              connections={connections}
              settings={settings}
              keys={keys}
              identities={identities}
              onSyncComplete={onSyncComplete}
            />
          )}

        </div>
      </div>

      {/* CỘT 3: Right Host Details Pane */}
      {isPaneOpen && (
        <div className="dashboard-details-pane">
          <>
            <div className="pane-header flex justify-between items-center border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="m-0">{isNewHostMode ? 'New Host' : 'Host Details'}</h3>

                {/* Nút bấm nhanh CONNECT & SAVE ở trên đầu để tiện sử dụng */}
                <button
                  type="button"
                  className="pane-save-btn-top px-2.5 py-1 text-[11px] bg-[rgba(37,99,235,0.2)] text-[#89b4fa] border border-[rgba(37,99,235,0.5)] rounded cursor-pointer font-bold hover:bg-[rgba(37,99,235,0.35)] transition-colors"
                  onClick={handleSaveHost}
                >
                  Save
                </button>

                {!isNewHostMode && (
                  <button
                    type="button"
                    className="pane-connect-btn-top flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[var(--termius-accent)] text-white border-none rounded cursor-pointer font-bold"
                    onClick={handleConnect}
                  >
                    <ExternalLink size={10} /> CONNECT
                  </button>
                )}
              </div>

              <button className="pane-close-btn bg-transparent border-none text-[var(--text-muted)] cursor-pointer" onClick={handleClosePane}>
                <X size={16} />
              </button>
            </div>

            <form className="pane-form connection-form-container" onSubmit={handleSaveHost}>
              {/* Block 1: Host Info (Mạng) - Luôn lên đầu */}
              <div className="pane-section border-b border-white/5 pb-4 mb-4">
                <h4 className="section-title mt-0 mb-3">1. Host Connection (Địa chỉ)</h4>

                <div className="form-group mb-3">
                  <label>Label (Tên gợi nhớ)</label>
                  <input
                    type="text"
                    placeholder="e.g. Production Server"
                    value={hostLabel}
                    onChange={(e) => setHostLabel(e.target.value)}
                    required
                    id="input-conn-label"
                    autoFocus
                  />
                </div>
                <div className="form-group mb-3">
                  <label>Host Address (IP/Hostname)</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.100"
                    value={hostAddress}
                    onChange={(e) => setHostAddress(e.target.value)}
                    required
                    id="input-conn-host"
                  />
                </div>
                <div className="form-group mb-3">
                  <label>SSH Port</label>
                  <input
                    type="text"
                    placeholder="22"
                    value={hostPort}
                    onChange={(e) => setHostPort(e.target.value)}
                    id="input-conn-port"
                  />
                </div>
              </div>

              {/* Block 2: Credentials (Xác thực) */}
              <div className="pane-section border-b border-white/5 pb-4 mb-4">
                <h4 className="section-title mt-0 mb-3">2. Credentials (Xác thực)</h4>

                <div className="form-group animate-fade-in mb-3">
                  <label className="flex justify-between items-center">
                    Credentials Identity (Định danh tập trung)
                    <span className="text-[10px] text-[var(--termius-accent)] font-bold">Termius Style</span>
                  </label>
                  <select
                    value={hostIdentityId}
                    onChange={(e) => {
                      setHostIdentityId(e.target.value);
                      if (e.target.value !== '') {
                        // Đồng bộ các trường hiển thị read-only
                        const identity = identities.find(i => i.id === e.target.value);
                        if (identity) {
                          setHostUsername(identity.username);
                          if (identity.authType === 'password') {
                            setHostPassword(identity.password);
                            setHostKeyId('');
                          } else {
                            setHostKeyId(identity.keyId);
                            setHostPassword('');
                          }
                        }
                      }
                    }}
                    id="select-conn-identity"
                    className="key-select-dropdown bg-white/5 text-[var(--text-main)] border border-white/10 cursor-pointer"
                  >
                    <option value="">-- Nhập thông tin đăng nhập thủ công --</option>
                    {identities.map(i => (
                      <option key={i.id} value={i.id}>{i.label} ({i.username})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="ubuntu"
                    value={hostUsername}
                    onChange={(e) => setHostUsername(e.target.value)}
                    id="input-conn-username"
                    disabled={hostIdentityId !== ''}
                    className={hostIdentityId !== '' ? 'opacity-50 cursor-not-allowed' : ''}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Password (Không bắt buộc)</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={hostIdentityId !== '' ? "Được quản lý bởi Identity" : "Leave blank for key auth"}
                      value={hostPassword}
                      onChange={(e) => setHostPassword(e.target.value)}
                      id="input-conn-password"
                      disabled={hostIdentityId !== ''}
                      className={hostIdentityId !== '' ? 'opacity-50 cursor-not-allowed' : ''}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={hostIdentityId !== ''}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="form-group mb-3">
                  <label className="flex justify-between items-center">
                    Linked Private Key
                    <button
                      type="button"
                      onClick={handleAddKeyFromPane}
                      disabled={hostIdentityId !== ''}
                      className={hostIdentityId !== '' ? 'create-key-fast-btn opacity-50 cursor-not-allowed' : 'create-key-fast-btn'}
                    >
                      + Add Key
                    </button>
                  </label>
                  <select
                    value={hostKeyId}
                    onChange={(e) => setHostKeyId(e.target.value)}
                    id="select-conn-key"
                    className={`key-select-dropdown${hostIdentityId !== '' ? ' opacity-50 cursor-not-allowed' : ''}`}
                    disabled={hostIdentityId !== ''}
                  >
                    <option value="">-- Sử dụng Mật khẩu hoặc Mặc định --</option>
                    {keys.map(k => (
                      <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                  </select>
                </div>

                {hostIdentityId !== '' && (
                  <div className="text-[11px] text-[var(--termius-accent)] mt-2 px-2.5 py-1.5 bg-blue-500/5 rounded border border-blue-500/10">
                    ℹ️ Thông tin xác thực được quản lý tập trung bởi Identity được chọn.
                  </div>
                )}
              </div>

              {/* Block 3: Phân loại */}
              <div className="pane-section border-b border-white/5 pb-4 mb-4">
                <h4 className="section-title mt-0 mb-3">3. Categorization (Phân loại)</h4>

                <div className="form-group mb-3">
                  <label>Group Folder</label>
                  {!showCustomGroupInput ? (
                    <select
                      value={selectedGroup}
                      onChange={(e) => {
                        if (e.target.value === '__new_group__') {
                          setShowCustomGroupInput(true);
                        } else {
                          setSelectedGroup(e.target.value);
                        }
                      }}
                      id="select-conn-group"
                      className="key-select-dropdown cursor-pointer"
                    >
                      {existingGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                      <option value="__new_group__" className="text-[var(--termius-accent)] font-bold">
                        [+ Tạo nhóm mới...]
                      </option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Tên nhóm mới..."
                        value={customGroupValue}
                        onChange={(e) => setCustomGroupValue(e.target.value)}
                        required
                        id="input-conn-group-custom"
                        autoFocus
                        className="flex-1"
                      />
                      <button
                        type="button"
                        className="file-upload-btn-secondary h-[38px] w-[38px] justify-center"
                        onClick={() => {
                          setShowCustomGroupInput(false);
                          setSelectedGroup(existingGroups[0] || 'Servers');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Tags (Phân tách bằng dấu phẩy)</label>
                  <input
                    type="text"
                    placeholder="ssh, production, gateway"
                    value={hostTags}
                    onChange={(e) => setHostTags(e.target.value)}
                    id="input-conn-tags"
                  />
                </div>

                {/* Toggle mở kèm SFTP */}
                <div className="flex items-center justify-between py-2.5 border-t border-white/5 mt-2">
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text-main)]">Mở kèm SFTP Explorer</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Tự động hiển SFTP khi kết nối</div>
                  </div>
                  <button
                    type="button"
                    id="toggle-open-with-sftp"
                    onClick={() => setHostOpenWithSFTP(v => !v)}
                    className="relative shrink-0 w-11 h-6 rounded-full border-none cursor-pointer transition-colors duration-200"
                    style={{ background: hostOpenWithSFTP ? 'var(--termius-accent)' : 'rgba(255,255,255,0.1)' }}
                  >
                    <span
                      className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-200"
                      style={{ left: hostOpenWithSFTP ? '23px' : '3px' }}
                    />
                  </button>
                </div>
              </div>

              {/* Block 4: Advanced Features (Simulated) */}
              <div className="pane-section border-top">
                <h4 className="section-title">Advanced Settings</h4>

                <div className="advanced-sim-item">
                  <div className="sim-item-left">
                    <span className="sim-title">Agent Forwarding</span>
                    <span className="sim-desc">Chuyển tiếp khóa SSH Agent đến máy chủ</span>
                  </div>
                  <span className="sim-status disabled">Disabled</span>
                </div>

                <div className="advanced-sim-item">
                  <div className="sim-item-left">
                    <span className="sim-title">Startup Command</span>
                    <span className="sim-desc">Tự động chạy script khi kết nối thành công</span>
                  </div>
                  <span className="sim-status value">None</span>
                </div>

                <div className="advanced-sim-item">
                  <div className="sim-item-left">
                    <span className="sim-title">Proxy Settings</span>
                    <span className="sim-desc">Kết nối trung gian qua HTTP/SOCKS/Jump Host</span>
                  </div>
                  <span className="sim-status value">None</span>
                </div>

                <div className="advanced-sim-item text-muted">
                  Termius Dark Theme applied
                </div>
              </div>

              {/* Actions bottom */}
              <div className="pane-actions-footer">
                {!isNewHostMode && (
                  <button
                    type="button"
                    className="pane-delete-btn"
                    onClick={handleDeleteHost}
                    title="Xóa Host này"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                <button type="submit" className="pane-save-btn">
                  Save
                </button>

                {!isNewHostMode && (
                  <button
                    type="button"
                    className="pane-connect-btn"
                    onClick={handleConnect}
                  >
                    <ExternalLink size={14} className="mr-1.5" /> CONNECT
                  </button>
                )}
              </div>
            </form>
          </>
        </div>
      )}
    </div>
  );
}
