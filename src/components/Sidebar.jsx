import { useState } from 'react';
import { 
  Terminal, 
  Plus, 
  Settings, 
  Server, 
  Edit, 
  Trash2, 
  X, 
  FolderSync,
  Folder,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Upload
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({
  connections = [],
  keys = [],
  onAddConnection,
  onEditConnection,
  onDeleteConnection,
  onConnectSSH,
  onNewLocalTab,
  onOpenSettings,
  onOpenP2PSync,
  isCollapsed = false,
  onToggleCollapse,
  onAddKey,
  onDeleteKey
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [label, setLabel] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('ubuntu');
  const [password, setPassword] = useState('');
  const [tags, setTags] = useState('');
  const [tagColor, setTagColor] = useState('var(--accent)');
  const [keyId, setKeyId] = useState('');

  // Dropdown & Custom Group States [NEW]
  const [selectedGroup, setSelectedGroup] = useState('Servers');
  const [showCustomGroupInput, setShowCustomGroupInput] = useState(false);
  const [customGroupValue, setCustomGroupValue] = useState('');

  // Quick Private Key Manager States [NEW]
  const [showQuickKeyManager, setShowQuickKeyManager] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyContent, setNewKeyContent] = useState('');

  // Live Search & Expandable Folder Groups State
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Kích hoạt chế độ thêm mới
  const handleNewClick = () => {
    setEditingId(null);
    setLabel('');
    setHost('');
    setPort('22');
    setUsername('ubuntu');
    setPassword('');
    
    // Reset Group dropdown
    setSelectedGroup('Servers');
    setShowCustomGroupInput(false);
    setCustomGroupValue('');

    setTags('');
    setTagColor('var(--accent)');
    setKeyId('');
    setShowForm(true);
    setShowQuickKeyManager(false);
  };

  // Kích hoạt chế độ chỉnh sửa
  const handleEditClick = (e, conn) => {
    e.stopPropagation(); // Ngăn sự kiện click lan truyền làm kết nối SSH
    setEditingId(conn.id);
    setLabel(conn.label);
    setHost(conn.host);
    setPort(conn.port || '22');
    setUsername(conn.username || 'ubuntu');
    setPassword(conn.password || '');
    
    // Đồng bộ Folder Group dropdown
    const groupName = conn.group || 'Servers';
    setSelectedGroup(groupName);
    setShowCustomGroupInput(false);
    setCustomGroupValue('');

    setTags((conn.tags || []).join(', '));
    setTagColor(conn.tagColor || 'var(--accent)');
    setKeyId(conn.keyId || '');
    setShowForm(true);
    setShowQuickKeyManager(false);
  };

  // Hủy form
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setShowQuickKeyManager(false);
  };

  // Thêm Private Key nhanh ngay tại Form [NEW]
  const handleQuickAddKey = () => {
    if (!newKeyLabel.trim() || !newKeyContent.trim()) {
      alert('Vui lòng điền đầy đủ nhãn khóa và nội dung Private Key Pem!');
      return;
    }
    
    onAddKey({
      label: newKeyLabel.trim(),
      keyContent: newKeyContent.trim(),
      passphrase: ''
    });

    setNewKeyLabel('');
    setNewKeyContent('');
  };

  // Đọc file Private Key nhanh từ máy tính [NEW]
  const handleQuickKeyFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setNewKeyContent(content);
      
      // Nếu nhãn khóa chưa được đặt, tự động lấy tên tệp bỏ đuôi mở rộng
      if (!newKeyLabel.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setNewKeyLabel(nameWithoutExt);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  // Submit form
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!label || !host) {
      alert('Vui lòng điền nhãn và tên máy chủ (host)');
      return;
    }

    // Chọn group từ dropdown hoặc Custom
    const finalGroup = showCustomGroupInput ? customGroupValue.trim() : selectedGroup;

    const profileData = {
      label,
      host,
      port: port || '22',
      username: username || 'ubuntu',
      password,
      group: finalGroup || 'Servers',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      tagColor,
      keyId
    };

    if (editingId) {
      onEditConnection(editingId, profileData);
    } else {
      onAddConnection(profileData);
    }

    setShowForm(false);
    setEditingId(null);
    setShowQuickKeyManager(false);
  };

  // 1. Gom nhóm danh sách các Group hiện có để đưa vào dropdown select
  const existingGroups = Array.from(new Set(connections.map(conn => conn.group || 'Servers')));
  if (!existingGroups.includes('Servers')) {
    existingGroups.push('Servers');
  }

  // 2. Lọc danh sách máy chủ theo Live Search Query
  const filteredConnections = connections.filter(conn => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    return (
      (conn.label || '').toLowerCase().includes(query) ||
      (conn.host || '').toLowerCase().includes(query) ||
      (conn.group || '').toLowerCase().includes(query) ||
      (conn.tags || []).some(t => t.toLowerCase().includes(query))
    );
  });

  // 2. Phân loại danh sách máy chủ theo Nhóm (Group)
  const groupedConnections = {};
  filteredConnections.forEach(conn => {
    const groupName = conn.group || 'Servers';
    if (!groupedConnections[groupName]) {
      groupedConnections[groupName] = [];
    }
    groupedConnections[groupName].push(conn);
  });

  // Toggle thu gọn/mở rộng thư mục
  const toggleGroupCollapse = (groupName) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  if (isCollapsed) {
    return (
      <div className="sidebar-container collapsed" id="sidebar-collapsed">
        {/* Brand Header collapsed */}
        <div className="sidebar-header collapsed-header">
          <div className="sidebar-logo" title="Last SSH">
            <Terminal size={18} />
          </div>
        </div>

        {/* Sidebar Content (Scrollable) */}
        <div className="sidebar-content collapsed-content">
          {/* Quick Launch Local collapsed */}
          <div className="mini-btn-wrapper">
            <button 
              className="glass-button mini-circle-btn"
              onClick={onNewLocalTab}
              id="btn-new-local-mini"
              title="New Local Terminal"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Connections List collapsed */}
          <div className="mini-connections-list">
            {connections.map(conn => {
              return (
                <div 
                  key={conn.id} 
                  className="connection-item-mini"
                  style={{ borderColor: conn.tagColor || 'var(--accent)' }}
                  onClick={() => onConnectSSH(conn)}
                  id={`conn-item-mini-${conn.id}`}
                >
                  <Server size={18} style={{ color: conn.tagColor || 'var(--accent)' }} />
                  
                  {/* Tooltip khi hover */}
                  <div className="mini-tooltip">
                    <div className="mini-tooltip-label">{conn.label}</div>
                    <div className="mini-tooltip-host">{conn.username}@{conn.host}:{conn.port}</div>
                    {conn.group && <div className="mini-tooltip-group">Group: {conn.group}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer Controls collapsed */}
        <div className="sidebar-footer collapsed-footer">
          <button 
            className="glass-button mini-circle-btn" 
            onClick={onOpenP2PSync}
            title="Sync P2P"
            id="btn-p2p-mini"
          >
            <FolderSync size={16} />
          </button>
          
          <button 
            className="glass-button mini-circle-btn" 
            onClick={onOpenSettings}
            title="Settings"
            id="btn-settings-mini"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Collapse Toggle Button */}
        <button 
          className="sidebar-collapse-toggle" 
          onClick={onToggleCollapse}
          title="Expand Sidebar"
          id="btn-sidebar-expand"
        >
          <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-container">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Terminal size={18} />
        </div>
        <span className="sidebar-title">Last SSH</span>
      </div>

      {/* Sidebar Content (Scrollable) */}
      <div className="sidebar-content">
        {/* Quick Launch Local */}
        <div>
          <button 
            className="glass-button sidebar-wide-btn active"
            onClick={onNewLocalTab}
            id="btn-new-local"
          >
            <Plus size={16} />
            New Local Terminal
          </button>
        </div>

        {/* Connections List */}
        <div>
          <div className="section-title">
            <span>SAVED HOSTS ({connections.length})</span>
            <button 
              className="add-connection-inline-btn"
              onClick={handleNewClick}
              title="Add SSH Connection"
              id="btn-add-conn"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Thanh tìm kiếm Live Search */}
          {!showForm && connections.length > 0 && (
            <div className="search-bar-container">
              <Search size={13} className="search-icon" />
              <input 
                type="text" 
                className="glass-input search-input" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search server, group, tags..."
                id="sidebar-search-input"
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Form inline thêm / sửa */}
          {showForm && (
            <form onSubmit={handleSubmit} className="connection-form-container">
              <div className="form-title">
                {editingId ? 'Edit SSH Connection' : 'New SSH Connection'}
              </div>
              
              <div className="form-group">
                <label className="form-label">LABEL</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Production Server"
                  required
                  id="input-conn-label"
                />
              </div>

              <div className="form-group">
                <label className="form-label">HOST / IP ADDRESS</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="e.g. 192.168.1.100"
                  required
                  id="input-conn-host"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">PORT</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="22"
                    id="input-conn-port"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">USERNAME</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ubuntu"
                    id="input-conn-username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">PASSWORD / PHRASE</label>
                <input 
                  type="password" 
                  className="glass-input" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for key auth"
                  id="input-conn-password"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">FOLDER GROUP</label>
                  {!showCustomGroupInput ? (
                    <select 
                      className="glass-input" 
                      value={selectedGroup}
                      onChange={(e) => {
                        if (e.target.value === '__new_group__') {
                          setShowCustomGroupInput(true);
                        } else {
                          setSelectedGroup(e.target.value);
                        }
                      }}
                      id="select-conn-group"
                      style={{ cursor: 'pointer' }}
                    >
                      {existingGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                      <option value="__new_group__" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
                        [+ Tạo nhóm mới...]
                      </option>
                    </select>
                  ) : (
                    <div className="form-group-with-action">
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={customGroupValue}
                        onChange={(e) => setCustomGroupValue(e.target.value)}
                        placeholder="Tên nhóm mới..."
                        required
                        id="input-conn-group-custom"
                        autoFocus
                      />
                      <button 
                        type="button" 
                        className="glass-button inline-group-back-btn"
                        onClick={() => {
                          setShowCustomGroupInput(false);
                          setSelectedGroup(existingGroups[0] || 'Servers');
                        }}
                        title="Quay lại chọn danh sách"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">TAGS (COMMA SEP)</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g. web, aws"
                    id="input-conn-tags"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">LINKED PRIVATE KEY</label>
                <div className="form-group-with-action">
                  <select 
                    className="glass-input select-key-input"
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    id="select-conn-key"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Use Password instead (No Key)</option>
                    {keys.map(k => (
                      <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    className="glass-button inline-key-manage-btn"
                    onClick={() => setShowQuickKeyManager(!showQuickKeyManager)}
                    title="Quản lý SSH Private Keys"
                    id="btn-manage-keys-quick"
                  >
                    🔑
                  </button>
                </div>
              </div>

              {/* Quick Key Manager Inline Panel */}
              {showQuickKeyManager && (
                <div className="quick-key-manager-panel animate-slide-down">
                  <div className="quick-key-panel-title">Quản lý Keys</div>
                  
                  {/* Danh sách Keys hiện có để xóa */}
                  <div className="quick-key-list">
                    {keys.length === 0 ? (
                      <div className="quick-key-empty">Chưa có khóa private key nào</div>
                    ) : (
                      keys.map(k => (
                        <div key={k.id} className="quick-key-item">
                          <span className="quick-key-item-label">🔑 {k.label}</span>
                          <button 
                            type="button"
                            className="quick-key-delete-btn"
                            onClick={() => {
                              if (confirm(`Bạn chắc chắn muốn xóa khóa '${k.label}'?`)) {
                                onDeleteKey(k.id);
                              }
                            }}
                            title="Xóa khóa"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Form thêm nhanh Key */}
                  <div className="quick-key-add-form">
                    <input 
                      type="text"
                      className="glass-input quick-key-input-field"
                      placeholder="Nhãn khóa (AWS Production, ...)"
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>KEY PEM CONTENT</span>
                      <div>
                        <input 
                          type="file"
                          id="quick-key-file-upload"
                          style={{ display: 'none' }}
                          onChange={handleQuickKeyFileChange}
                          accept=".pem,.key,id_rsa,id_dsa,id_ecdsa,id_ed25519,.*"
                        />
                        <button
                          type="button"
                          className="glass-button"
                          style={{ padding: '2px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => document.getElementById('quick-key-file-upload').click()}
                          title="Chọn file Private Key từ máy tính của bạn"
                        >
                          <Upload size={10} />
                          Chọn File Khóa (.pem)
                        </button>
                      </div>
                    </div>
                    <textarea 
                      className="glass-input quick-key-input-field textarea-key"
                      placeholder="-----BEGIN RSA PRIVATE KEY----- ..."
                      value={newKeyContent}
                      onChange={(e) => setNewKeyContent(e.target.value)}
                      rows={2}
                    />
                    <button 
                      type="button" 
                      className="glass-button quick-key-save-btn active"
                      onClick={handleQuickAddKey}
                    >
                      Thêm khóa nhanh
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">TAG COLOR</label>
                <div className="tag-color-picker">
                  {[
                    'var(--accent)',
                    'var(--term-red)',
                    'var(--term-yellow)',
                    'var(--term-green)',
                    'var(--term-blue)',
                    'var(--term-magenta)'
                  ].map(color => (
                    <div 
                      key={color}
                      className={`color-preset-dot ${tagColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setTagColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="glass-button" 
                  onClick={handleCancel}
                  id="btn-conn-cancel"
                >
                  <X size={14} />
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="glass-button active"
                  id="btn-conn-save"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* List item kết nối */}
          {!showForm && (
            <div className="connections-list">
              {connections.length === 0 ? (
                <div className="sidebar-empty-state">
                  No saved servers. Click '+' to add one.
                </div>
              ) : Object.keys(groupedConnections).length === 0 ? (
                <div className="sidebar-empty-state">
                  No matching servers found.
                </div>
              ) : (
                Object.keys(groupedConnections).map(groupName => {
                  const isCollapsed = collapsedGroups[groupName];
                  const groupItems = groupedConnections[groupName];
                  
                  return (
                    <div key={groupName} className="connection-group-wrapper">
                      {/* Tiêu đề Folder Group */}
                      <div 
                        className="group-folder-header"
                        onClick={() => toggleGroupCollapse(groupName)}
                        style={{ cursor: 'pointer' }}
                        id={`group-folder-${groupName.replace(/\s+/g, '-')}`}
                      >
                        <div className="group-folder-info">
                          {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                          <Folder size={13} className="group-folder-icon" />
                          <span className="group-folder-name">{groupName}</span>
                        </div>
                        <span className="group-items-badge">{groupItems.length}</span>
                      </div>

                      {/* Danh sách các Server trong Group */}
                      {!isCollapsed && (
                        <div className="group-items-list animate-slide-down">
                          {groupItems.map(conn => {
                            const linkedKey = keys.find(k => k.id === conn.keyId);
                            
                            return (
                              <div 
                                key={conn.id} 
                                className="connection-item"
                                style={{ borderLeft: `3px solid ${conn.tagColor || 'var(--accent)'}` }}
                                onClick={() => onConnectSSH(conn)}
                                id={`conn-item-${conn.id}`}
                              >
                                <div className="connection-info">
                                  <Server size={14} className="connection-icon" style={{ color: conn.tagColor || 'var(--accent)' }} />
                                  <div className="connection-details">
                                    <span className="connection-label">{conn.label}</span>
                                    <span className="connection-host">{conn.username}@{conn.host}:{conn.port}</span>
                                    
                                    {/* Render Tags Badges & Key Badge */}
                                    <div className="badges-row">
                                      {linkedKey && (
                                        <span className="key-badge" title="SSH Key Authentication">
                                          🔑 {linkedKey.label}
                                        </span>
                                      )}
                                      {(conn.tags || []).map((t, idx) => (
                                        <span 
                                          key={idx} 
                                          className="tag-badge"
                                          style={{ borderColor: conn.tagColor || 'var(--accent)', color: conn.tagColor || 'var(--accent)' }}
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Hover actions */}
                                <div className="connection-actions">
                                  <button 
                                    className="action-btn edit-btn" 
                                    onClick={(e) => handleEditClick(e, conn)}
                                    title="Edit Connection"
                                    id={`btn-edit-conn-${conn.id}`}
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button 
                                    className="action-btn delete-btn" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Bạn chắc chắn muốn xóa kết nối '${conn.label}'?`)) {
                                        onDeleteConnection(conn.id);
                                      }
                                    }}
                                    title="Delete Connection"
                                    id={`btn-delete-conn-${conn.id}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer Controls */}
      <div className="sidebar-footer">
        <div className="sidebar-action-row">
          <button 
            className="glass-button" 
            onClick={onOpenP2PSync}
            title="P2P Synchronization via QR Code"
            id="btn-p2p"
          >
            <FolderSync size={16} />
            Sync P2P
          </button>
          
          <button 
            className="glass-button" 
            onClick={onOpenSettings}
            title="App Customization & Themes"
            id="btn-settings"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>
      {/* Collapse Toggle Button */}
      <button 
        className="sidebar-collapse-toggle" 
        onClick={onToggleCollapse}
        title="Collapse Sidebar"
        id="btn-sidebar-collapse"
      >
        <ChevronLeft size={12} />
      </button>
    </div>
  );
}
