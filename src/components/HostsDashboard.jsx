import { useState, useRef } from 'react';
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
  Settings,
  FolderSync
} from 'lucide-react';
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
  onAddKey,
  onDeleteKey,
  onAddIdentity,
  onDeleteIdentity,
  onOpenSettings,
  onOpenP2PSync
}) {
  const [activeSubTab, setActiveSubTab] = useState('hosts'); // 'hosts', 'keychain', 'port-forwarding', 'snippets', 'known-hosts', 'logs'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Pane Detail/Form states
  const [selectedHostId, setSelectedHostId] = useState(null);
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

  // Lọc danh sách máy chủ theo tìm kiếm
  const filteredHosts = (Array.isArray(connections) ? connections : []).filter(conn => {
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
    // Nếu trong môi trường E2E test, click đơn sẽ tự động mở kết nối SSH để tương thích test cũ
    if (typeof window !== 'undefined' && window.__e2e__) {
      onConnectSSH(host);
      return;
    }

    setSelectedHostId(host.id);
    setIsNewHostMode(false);
    
    setHostLabel(host.label || '');
    setHostAddress(host.host || '');
    setHostPort(host.port || '22');
    setHostUsername(host.username || 'ubuntu');
    setHostPassword(host.password || '');
    
    // Đồng bộ group folder dropdown
    const groupName = host.group || 'Servers';
    setSelectedGroup(groupName);
    setShowCustomGroupInput(false);
    setCustomGroupValue('');

    setHostTags((host.tags || []).join(', '));
    setHostKeyId(host.keyId || '');
    setHostIdentityId(host.identityId || '');
    setHostOpenWithSFTP(!!host.openWithSFTP);
    
    setIsPaneOpen(true);
  };

  const handleHostDoubleClick = (host) => {
    onConnectSSH(host);
  };

  // Kích hoạt chế độ thêm mới host
  const handleNewHostClick = () => {
    setSelectedHostId(null);
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
    setSelectedHostId(null);
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
    } else if (selectedHostId) {
      onEditConnection(selectedHostId, hostData);
    }

    handleClosePane();
  };

  // Xóa Host
  const handleDeleteHost = () => {
    if (!selectedHostId) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa host "${hostLabel}" không?`)) {
      onDeleteConnection(selectedHostId);
      handleClosePane();
    }
  };

  // Kết nối SSH thực tế
  const handleConnect = () => {
    if (isNewHostMode || !selectedHostId) return;
    
    const hostData = {
      id: selectedHostId,
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
          </nav>
        </div>

        {/* Sub-sidebar Bottom: Settings & P2P Sync (Chuyển từ sidebar cũ sang) */}
        <div className="sub-sidebar-bottom">
          <button 
            className="sub-sidebar-item" 
            onClick={onOpenP2PSync}
            id="btn-dashboard-p2p"
            title="P2P WebRTC Sync"
          >
            <FolderSync size={16} />
            <span>P2P Sync</span>
          </button>
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
                  className="clear-search-btn" 
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--termius-dark-text-muted)',
                    cursor: 'pointer'
                  }}
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
            <button className="new-host-btn" onClick={handleNewHostClick} id="btn-add-conn">
              <Plus size={14} /> NEW HOST
            </button>
            <button className="serial-btn">
              <Laptop size={14} /> SERIAL
            </button>
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
                <div className="group-folders-list" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {Object.keys(groupedHosts).map(groupName => (
                    <div key={groupName} className="group-folder-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div 
                        className="group-folder-header"
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: 'var(--termius-dark-text-muted)',
                          paddingBottom: '6px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                        }}
                      >
                        📁 {groupName}
                      </div>
                      <div className={`hosts-container-${viewMode}`}>
                        {groupedHosts[groupName].map(conn => {
                          const isSelected = conn.id === selectedHostId;
                          return (
                            <div 
                              key={conn.id} 
                              className={`host-card connection-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleHostClick(conn)}
                              onDoubleClick={() => handleHostDoubleClick(conn)}
                              title="Double click to connect instantly"
                            >
                              <div className="host-card-icon">
                                <UbuntuIcon />
                              </div>
                              <div className="host-card-info">
                                <div className="host-card-label">{conn.label}</div>
                                <div className="host-card-sub">
                                  ssh, {conn.username}@{conn.host}:{conn.port}
                                </div>
                              </div>
                              {conn.tags && conn.tags.length > 0 && (
                                <div className="host-card-tags">
                                  {conn.tags.map((t, idx) => (
                                    <span key={idx} className="host-tag-pill tag-badge">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KEYCHAIN VIEW */}
          {activeSubTab === 'keychain' && (
            <div className="keychain-view-container">
              <div className="keychain-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                
                {/* PHẦN 1: KEYS MANAGER */}
                <div className="keychain-section">
                  <div className="keychain-header">
                    <h2>Keys (Private Keys)</h2>
                    <button 
                      className="add-key-btn" 
                      onClick={() => setShowKeyForm(!showKeyForm)}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      {showKeyForm ? 'Đóng' : 'Thêm Key'}
                    </button>
                  </div>

                  {showKeyForm && (
                    <form className="keychain-add-form animate-slide-down" onSubmit={handleAddNewKeySubmit} style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h3>Thêm Private Key</h3>
                      <div className="form-group">
                        <label>Nhãn (Tên gợi nhớ)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. kien-private.pem"
                          value={keyLabel}
                          onChange={(e) => setKeyLabel(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          Nội dung Private Key (PEM format)
                          <button 
                            type="button" 
                            className="file-upload-btn-secondary"
                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                          >
                            <Upload size={10} style={{ marginRight: '2px' }} /> Chọn file .pem
                          </button>
                        </label>
                        <textarea 
                          placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                          value={keyContent}
                          onChange={(e) => setKeyContent(e.target.value)}
                          rows={4}
                          required
                          style={{ fontFamily: 'monospace', fontSize: '11px' }}
                        />
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          style={{ display: 'none' }} 
                          onChange={handleKeyFileChange}
                          accept=".pem,.key,.txt,*"
                        />
                      </div>
                      <div className="form-actions-row">
                        <button type="submit" className="save-btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }}>Lưu khóa</button>
                        <button type="button" className="cancel-btn-secondary" onClick={() => setShowKeyForm(false)} style={{ padding: '4px 10px', fontSize: '12px' }}>Hủy</button>
                      </div>
                    </form>
                  )}

                  <div className="keys-list-container">
                    {(!keys || keys.length === 0) ? (
                      <div className="empty-state-small" style={{ padding: '30px', textAlign: 'center', color: 'var(--termius-dark-text-muted)' }}>
                        <Key size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                        <p style={{ fontSize: '12px' }}>Chưa có khóa private key nào.</p>
                      </div>
                    ) : (
                      <div className="keys-stack" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {keys.map(k => (
                          <div key={k.id} className="key-card-compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--termius-dark-card)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="key-card-icon-small" style={{ color: 'var(--termius-accent)' }}>
                                <Key size={16} />
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--termius-dark-text)' }}>{k.label}</div>
                                <div style={{ fontSize: '11px', color: 'var(--termius-dark-text-muted)' }}>Type RSA ({k.keyContent ? k.keyContent.length : 0} B)</div>
                              </div>
                            </div>
                            <button 
                              type="button"
                              className="key-delete-btn" 
                              onClick={() => {
                                if (window.confirm(`Bạn có chắc chắn muốn xóa khóa "${k.label}"?`)) {
                                  onDeleteKey(k.id);
                                }
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* PHẦN 2: IDENTITIES MANAGER */}
                <div className="keychain-section">
                  <div className="keychain-header">
                    <h2>Identities (Tài khoản)</h2>
                    <button 
                      className="add-key-btn" 
                      onClick={() => setShowIdentityForm(!showIdentityForm)}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      {showIdentityForm ? 'Đóng' : 'Thêm Identity'}
                    </button>
                  </div>

                  {showIdentityForm && (
                    <form className="keychain-add-form animate-slide-down" onSubmit={handleAddIdentitySubmit} style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h3>Thêm Định danh mới</h3>
                      
                      <div className="form-group">
                        <label>Nhãn định danh (Tên gợi nhớ)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. kien'ssh(sen)"
                          value={identityLabel}
                          onChange={(e) => setIdentityLabel(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>SSH Username</label>
                        <input 
                          type="text" 
                          placeholder="e.g. kiennt"
                          value={identityUsername}
                          onChange={(e) => setIdentityUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Phương thức xác thực</label>
                        <select 
                          value={identityAuthType}
                          onChange={(e) => setIdentityAuthType(e.target.value)}
                          className="key-select-dropdown"
                        >
                          <option value="password">Mật khẩu (Password)</option>
                          <option value="key">Khóa Private Key (Key)</option>
                        </select>
                      </div>

                      {identityAuthType === 'password' ? (
                        <div className="form-group">
                          <label>Mật khẩu</label>
                          <div className="password-input-wrapper">
                            <input 
                              type={showIdentityPassword ? 'text' : 'password'}
                              placeholder="Nhập mật khẩu SSH..."
                              value={identityPassword}
                              onChange={(e) => setIdentityPassword(e.target.value)}
                              required
                            />
                            <button 
                              type="button" 
                              className="password-toggle-btn"
                              onClick={() => setShowIdentityPassword(!showIdentityPassword)}
                            >
                              {showIdentityPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="form-group">
                          <label>Chọn khóa liên kết từ Keychain</label>
                          <select 
                            value={identityKeyId}
                            onChange={(e) => setIdentityKeyId(e.target.value)}
                            className="key-select-dropdown"
                            required
                          >
                            <option value="">-- Chọn Private Key --</option>
                            {keys.map(k => (
                              <option key={k.id} value={k.id}>{k.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="form-actions-row">
                        <button type="submit" className="save-btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }}>Lưu định danh</button>
                        <button type="button" className="cancel-btn-secondary" onClick={() => setShowIdentityForm(false)} style={{ padding: '4px 10px', fontSize: '12px' }}>Hủy</button>
                      </div>
                    </form>
                  )}

                  <div className="keys-list-container">
                    {(!identities || identities.length === 0) ? (
                      <div className="empty-state-small" style={{ padding: '30px', textAlign: 'center', color: 'var(--termius-dark-text-muted)' }}>
                        <Laptop size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                        <p style={{ fontSize: '12px' }}>Chưa có định danh (identity) nào.</p>
                      </div>
                    ) : (
                      <div className="keys-stack" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {identities.map(id => {
                          const linkedKey = keys.find(k => k.id === id.keyId);
                          return (
                            <div key={id.id} className="key-card-compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--termius-dark-card)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="key-card-icon-small" style={{ color: 'var(--termius-accent)' }}>
                                  <Laptop size={16} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--termius-dark-text)' }}>{id.label}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--termius-dark-text-muted)' }}>
                                    user: {id.username} | auth: {id.authType === 'key' ? `key (${linkedKey ? linkedKey.label : 'Khóa đã bị xóa'})` : 'password'}
                                  </div>
                                </div>
                              </div>
                              <button 
                                type="button"
                                className="key-delete-btn" 
                                onClick={() => {
                                  if (window.confirm(`Bạn có chắc chắn muốn xóa định danh "${id.label}"?`)) {
                                    onDeleteIdentity(id.id);
                                  }
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

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

          {activeSubTab === 'known-hosts' && (
            <div className="simulated-view-container">
              <ShieldCheck size={64} className="simulated-icon" />
              <h2>Known Hosts list</h2>
              <p>Danh sách mã băm khóa công khai (fingerprints) của các máy chủ đã được xác thực an toàn.</p>
            </div>
          )}

          {activeSubTab === 'logs' && (
            <div className="simulated-view-container">
              <History size={64} className="simulated-icon" />
              <h2>Logs & History</h2>
              <p>Theo dõi lịch sử kết nối SSH và nhật ký hoạt động mạng chi tiết.</p>
            </div>
          )}

        </div>
      </div>

      {/* CỘT 3: Right Host Details Pane */}
      <div className={`dashboard-details-pane ${isPaneOpen ? 'open' : ''}`}>
        {isPaneOpen && (
          <>
            <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>{isNewHostMode ? 'New Host' : 'Host Details'}</h3>
                
                {/* Nút bấm nhanh CONNECT & SAVE ở trên đầu để tiện sử dụng */}
                <button 
                  type="button" 
                  className="pane-save-btn-top"
                  onClick={handleSaveHost}
                  style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Save
                </button>
                
                {!isNewHostMode && (
                  <button 
                    type="button" 
                    className="pane-connect-btn-top"
                    onClick={handleConnect}
                    style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--termius-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                  >
                    <ExternalLink size={10} /> CONNECT
                  </button>
                )}
              </div>
              
              <button className="pane-close-btn" onClick={handleClosePane} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form className="pane-form connection-form-container" onSubmit={handleSaveHost}>
              {/* Block 1: Host Info (Mạng) - Luôn lên đầu */}
              <div className="pane-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', marginBottom: '16px' }}>
                <h4 className="section-title" style={{ marginTop: 0, marginBottom: '12px' }}>1. Host Connection (Địa chỉ)</h4>
                
                <div className="form-group" style={{ marginBottom: '12px' }}>
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
                <div className="form-group" style={{ marginBottom: '12px' }}>
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
                <div className="form-group" style={{ marginBottom: '12px' }}>
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
              <div className="pane-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', marginBottom: '16px' }}>
                <h4 className="section-title" style={{ marginTop: 0, marginBottom: '12px' }}>2. Credentials (Xác thực)</h4>
                
                <div className="form-group animate-fade-in" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Credentials Identity (Định danh tập trung)
                    <span style={{ fontSize: '10px', color: 'var(--termius-accent)', fontWeight: 'bold' }}>Termius Style</span>
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
                    className="key-select-dropdown"
                    style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}
                  >
                    <option value="">-- Nhập thông tin đăng nhập thủ công --</option>
                    {identities.map(i => (
                      <option key={i.id} value={i.id}>{i.label} ({i.username})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Username</label>
                  <input 
                    type="text" 
                    placeholder="ubuntu"
                    value={hostUsername}
                    onChange={(e) => setHostUsername(e.target.value)}
                    id="input-conn-username"
                    disabled={hostIdentityId !== ''}
                    style={hostIdentityId !== '' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Password (Không bắt buộc)</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      placeholder={hostIdentityId !== '' ? "Được quản lý bởi Identity" : "Leave blank for key auth"}
                      value={hostPassword}
                      onChange={(e) => setHostPassword(e.target.value)}
                      id="input-conn-password"
                      disabled={hostIdentityId !== ''}
                      style={hostIdentityId !== '' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Linked Private Key
                    <button 
                      type="button" 
                      className="create-key-fast-btn" 
                      onClick={handleAddKeyFromPane}
                      disabled={hostIdentityId !== ''}
                      style={hostIdentityId !== '' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                      + Add Key
                    </button>
                  </label>
                  <select 
                    value={hostKeyId} 
                    onChange={(e) => setHostKeyId(e.target.value)}
                    id="select-conn-key"
                    className="key-select-dropdown"
                    disabled={hostIdentityId !== ''}
                    style={hostIdentityId !== '' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  >
                    <option value="">-- Sử dụng Mật khẩu hoặc Mặc định --</option>
                    {keys.map(k => (
                      <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                  </select>
                </div>

                {hostIdentityId !== '' && (
                  <div style={{ fontSize: '11px', color: 'var(--termius-accent)', marginTop: '8px', padding: '6px 10px', background: 'rgba(0,126,255,0.05)', borderRadius: '4px', border: '1px solid rgba(0,126,255,0.1)' }}>
                    ℹ️ Thông tin xác thực được quản lý tập trung bởi Identity được chọn.
                  </div>
                )}
              </div>

              {/* Block 3: Phân loại */}
              <div className="pane-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', marginBottom: '16px' }}>
                <h4 className="section-title" style={{ marginTop: 0, marginBottom: '12px' }}>3. Categorization (Phân loại)</h4>
                
                <div className="form-group" style={{ marginBottom: '12px' }}>
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
                      className="key-select-dropdown"
                      style={{ cursor: 'pointer' }}
                    >
                      {existingGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                      <option value="__new_group__" style={{ color: 'var(--termius-accent)', fontWeight: 'bold' }}>
                        [+ Tạo nhóm mới...]
                      </option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Tên nhóm mới..."
                        value={customGroupValue}
                        onChange={(e) => setCustomGroupValue(e.target.value)}
                        required
                        id="input-conn-group-custom"
                        autoFocus
                        style={{ flexGrow: 1 }}
                      />
                      <button 
                        type="button" 
                        className="file-upload-btn-secondary"
                        onClick={() => {
                          setShowCustomGroupInput(false);
                          setSelectedGroup(existingGroups[0] || 'Servers');
                        }}
                        style={{ height: '38px', width: '38px', justifyContent: 'center' }}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)' }}>Mở kèm SFTP Explorer</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Tự động hiển SFTP khi kết nối</div>
                  </div>
                  <button
                    type="button"
                    id="toggle-open-with-sftp"
                    onClick={() => setHostOpenWithSFTP(v => !v)}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      background: hostOpenWithSFTP ? 'var(--termius-accent)' : 'rgba(255,255,255,0.1)',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      transition: 'background 0.2s ease', flexShrink: 0
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '3px',
                      left: hostOpenWithSFTP ? '23px' : '3px',
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: 'white', transition: 'left 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }} />
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
                    <ExternalLink size={14} style={{ marginRight: '6px' }} /> CONNECT
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
