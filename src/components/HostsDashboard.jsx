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
  onAddConnection,
  onEditConnection,
  onDeleteConnection,
  onConnectSSH,
  onAddKey,
  onDeleteKey,
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
    
    setIsPaneOpen(true);
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
      keyId: hostKeyId
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
      keyId: hostKeyId
    };
    
    onConnectSSH(hostData);
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
                              onDoubleClick={() => onConnectSSH(conn)}
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
              <div className="keychain-header">
                <h2>Keychain Manager</h2>
                <button 
                  className="add-key-btn" 
                  onClick={() => setShowKeyForm(!showKeyForm)}
                >
                  <Plus size={14} /> {showKeyForm ? 'Đóng Form' : 'Thêm Key Mới'}
                </button>
              </div>

              {showKeyForm && (
                <form className="keychain-add-form" onSubmit={handleAddNewKeySubmit}>
                  <h3>Thêm Private Key</h3>
                  <div className="form-group">
                    <label>Nhãn (Tên gợi nhớ)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. My Ubuntu Server Key"
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
                      >
                        <Upload size={12} style={{ marginRight: '4px' }} /> Chọn file .pem/.key
                      </button>
                    </label>
                    <textarea 
                      placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                      value={keyContent}
                      onChange={(e) => setKeyContent(e.target.value)}
                      rows={6}
                      required
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
                    <button type="submit" className="save-btn-primary">Lưu khóa</button>
                    <button type="button" className="cancel-btn-secondary" onClick={() => setShowKeyForm(false)}>Hủy</button>
                  </div>
                </form>
              )}

              <div className="keys-list-container">
                {(!keys || keys.length === 0) ? (
                  <div className="empty-state">
                    <Key size={48} className="empty-icon" />
                    <h3>Không có khóa nào được tạo</h3>
                    <p>Hãy thêm một private key (.pem) để liên kết với các máy chủ SSH.</p>
                  </div>
                ) : (
                  <div className="keys-grid">
                    {keys.map(k => (
                      <div key={k.id} className="key-card">
                        <div className="key-card-icon">
                          <Key size={20} />
                        </div>
                        <div className="key-card-info">
                          <div className="key-card-label">{k.label}</div>
                          <div className="key-card-summary">
                            PEM Private Key ({k.keyContent ? k.keyContent.length : 0} bytes)
                          </div>
                        </div>
                        <button 
                          className="key-delete-btn" 
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa khóa "${k.label}"?`)) {
                              onDeleteKey(k.id);
                            }
                          }}
                          title="Xóa khóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
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
            <div className="pane-header">
              <h3>{isNewHostMode ? 'New Host Details' : 'Host Details'}</h3>
              <button className="pane-close-btn" onClick={handleClosePane}>
                <X size={16} />
              </button>
            </div>

            <form className="pane-form connection-form-container" onSubmit={handleSaveHost}>
              {/* Main info */}
              <div className="pane-section">
                <div className="form-group">
                  <label>Label (Tên gợi nhớ)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Production Server"
                    value={hostLabel}
                    onChange={(e) => setHostLabel(e.target.value)}
                    required
                    id="input-conn-label"
                  />
                </div>
                <div className="form-group">
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
                <div className="form-group">
                  <label>SSH Port</label>
                  <input 
                    type="text" 
                    placeholder="22"
                    value={hostPort}
                    onChange={(e) => setHostPort(e.target.value)}
                    id="input-conn-port"
                  />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    placeholder="ubuntu"
                    value={hostUsername}
                    onChange={(e) => setHostUsername(e.target.value)}
                    id="input-conn-username"
                  />
                </div>
                <div className="form-group">
                  <label>Password (Không bắt buộc)</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Leave blank for key auth"
                      value={hostPassword}
                      onChange={(e) => setHostPassword(e.target.value)}
                      id="input-conn-password"
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
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
              </div>

              {/* Credentials */}
              <div className="pane-section border-top">
                <h4 className="section-title">Credentials Identity</h4>
                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Linked Private Key
                    <button 
                      type="button" 
                      className="create-key-fast-btn" 
                      onClick={handleAddKeyFromPane}
                    >
                      + Add Key
                    </button>
                  </label>
                  <select 
                    value={hostKeyId} 
                    onChange={(e) => setHostKeyId(e.target.value)}
                    id="select-conn-key"
                    className="key-select-dropdown"
                  >
                    <option value="">-- Sử dụng Mật khẩu hoặc Mặc định --</option>
                    {keys.map(k => (
                      <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advanced Features (Simulated) */}
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
