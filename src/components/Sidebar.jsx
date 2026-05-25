import React, { useState } from 'react';
import { 
  Terminal, 
  Plus, 
  Settings, 
  Wifi, 
  Server, 
  Edit, 
  Trash2, 
  Play, 
  X, 
  FolderSync
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({
  connections = [],
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

  // Kích hoạt chế độ thêm mới
  const handleNewClick = () => {
    setEditingId(null);
    setLabel('');
    setHost('');
    setPort('22');
    setUsername('ubuntu');
    setPassword('');
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
      password
    };

    if (editingId) {
      onEditConnection(editingId, profileData);
    } else {
      onAddConnection(profileData);
    }

    setShowForm(false);
    setEditingId(null);
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
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="glass-button" 
                  onClick={handleCancel}
                >
                  <X size={14} />
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="glass-button active"
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
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px', textAlign: 'center' }}>
                  No saved servers. Click '+' to add one.
                </div>
              ) : (
                connections.map(conn => (
                  <div 
                    key={conn.id} 
                    className="connection-item"
                    onClick={() => onConnectSSH(conn)}
                  >
                    <div className="connection-info">
                      <Server size={15} className="connection-icon" />
                      <div className="connection-details">
                        <span className="connection-label">{conn.label}</span>
                        <span className="connection-host">{conn.username}@{conn.host}:{conn.port}</span>
                      </div>
                    </div>
                    
                    {/* Hover actions */}
                    <div className="connection-actions">
                      <button 
                        className="action-btn edit-btn" 
                        onClick={(e) => handleEditClick(e, conn)}
                        title="Edit Connection"
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
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
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
