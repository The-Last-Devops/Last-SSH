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
  Search
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
  onOpenP2PSync
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [label, setLabel] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('ubuntu');
  const [password, setPassword] = useState('');
  const [group, setGroup] = useState('');
  const [tags, setTags] = useState('');
  const [tagColor, setTagColor] = useState('var(--accent)');
  const [keyId, setKeyId] = useState('');

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
    setGroup('');
    setTags('');
    setTagColor('var(--accent)');
    setKeyId('');
    setShowForm(true);
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
    setGroup(conn.group || '');
    setTags((conn.tags || []).join(', '));
    setTagColor(conn.tagColor || 'var(--accent)');
    setKeyId(conn.keyId || '');
    setShowForm(true);
  };

  // Hủy form
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
  };

  // Submit form
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!label || !host) {
      alert('Vui lòng điền nhãn và tên máy chủ (host)');
      return;
    }

    const profileData = {
      label,
      host,
      port: port || '22',
      username: username || 'ubuntu',
      password,
      group: group.trim() || 'Servers', // Nhóm mặc định nếu bỏ trống
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
  };

  // 1. Lọc danh sách máy chủ theo Live Search Query
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
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder="e.g. Production"
                    id="input-conn-group"
                  />
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
                <select 
                  className="glass-input"
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
              </div>

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
    </div>
  );
}
