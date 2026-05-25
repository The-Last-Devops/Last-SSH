import { useState, useEffect } from 'react';
import { 
  Palette, 
  ShieldAlert, 
  Database, 
  Fingerprint, 
  X, 
  Download, 
  Upload, 
  Trash2,
  Lock,
  Unlock,
  Key,
  Plus
} from 'lucide-react';
import { securityService } from '../services/securityService.js';
import { virtualFS } from '../services/virtualFS.js';
import './SettingsModal.css';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  connections = [],
  keys = [],
  onAddKey,
  onDeleteKey,
  onImportData,
  onResetData
}) {
  const [activeTab, setActiveTab] = useState('appearance');
  const [hasPin, setHasPin] = useState(false);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);

  // Form states cho PIN
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Form states cho Private Key
  const [keyLabel, setKeyLabel] = useState('');
  const [keyContent, setKeyContent] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');

  useEffect(() => {
    if (isOpen) {
      const initSecurity = async () => {
        const pinActive = securityService.hasPIN();
        const supported = await securityService.isBiometricsSupported();
        setHasPin(pinActive);
        setIsBiometricsAvailable(supported);
      };
      initSecurity();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Lưu thiết lập mã PIN mới
  const handleSetupPin = async (e) => {
    e.preventDefault();
    if (newPin.length < 4) {
      alert('Mã PIN phải chứa ít nhất 4 ký tự!');
      return;
    }
    if (newPin !== confirmPin) {
      alert('Xác nhận mã PIN không khớp!');
      return;
    }

    try {
      // Đóng gói cấu trúc lưu trữ hiện tại dạng plain text vào payload ban đầu
      const initialPayload = {
        connections: connections,
        settings: settings,
        keys: keys
      };
      
      await securityService.setupPIN(newPin, initialPayload);
      setHasPin(true);
      setNewPin('');
      setConfirmPin('');
      alert('Đã thiết lập mã PIN bảo mật thành công! Ứng dụng sẽ yêu cầu PIN khi khởi chạy.');
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  // 2. Tắt bảo mật mã PIN (Factory Reset bảo mật)
  const handleDisablePin = () => {
    if (confirm('Bạn chắc chắn muốn tắt bảo mật PIN? Toàn bộ khóa bảo mật lưu trữ sẽ được đưa về dạng plain text.')) {
      securityService.resetSecurity();
      setHasPin(false);
      alert('Đã tắt bảo mật mã PIN.');
    }
  };

  // 3. Liên kết Vân tay Touch ID / Windows Hello
  const handleLinkBiometrics = async () => {
    const pin = prompt('Vui lòng nhập mã PIN hiện tại của ứng dụng để xác thực liên kết:');
    if (!pin) return;

    try {
      // Xác thực mã PIN trước để đảm bảo chính chủ
      await securityService.unlockWithPIN(pin);
      
      // Tiến hành đăng ký vân tay
      await securityService.registerBiometrics(pin);
      alert('Đã liên kết sinh trắc học vân tay hệ điều hành thành công! Bạn có thể quét vân tay để mở khóa Last SSH.');
    } catch (err) {
      alert('Không thể liên kết sinh trắc học: ' + err.message);
    }
  };

  // 4. Xuất khẩu cấu hình (Export Data JSON)
  const handleExportData = () => {
    try {
      const backupPayload = {
        virtualFS: virtualFS.exportFS(),
        connections: connections,
        settings: settings,
        keys: keys,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `last-ssh-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Lỗi xuất khẩu tệp: ' + e.message);
    }
  };

  // 5. Nhập khẩu cấu hình (Import Data JSON)
  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if (!importedData.virtualFS || !Array.isArray(importedData.connections)) {
          alert('Tệp tin khôi phục không đúng định dạng!');
          return;
        }

        // Nhập khẩu tệp
        onImportData(importedData);
        alert('Khôi phục cấu hình ứng dụng thành công!');
        onClose();
      } catch (err) {
        alert('Không thể đọc tệp sao lưu: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // 6. Factory Reset ứng dụng
  const handleFactoryReset = () => {
    if (confirm('CẢNH BÁO NGUY HIỂM:\nHành động này sẽ XÓA SẠCH toàn bộ kết nối SSH đã lưu, các cài đặt cá nhân, mật khẩu, và Hệ thống tệp tin ảo trong LocalStorage. Bạn có chắc chắn muốn reset toàn bộ không?')) {
      onResetData();
      alert('Ứng dụng đã được đưa về trạng thái xuất xưởng ban đầu!');
      onClose();
    }
  };

  // 7. Thêm mới Key
  const handleKeySubmit = (e) => {
    e.preventDefault();
    if (!keyLabel.trim() || !keyContent.trim()) {
      alert('Vui lòng điền nhãn và nội dung Private Key PEM!');
      return;
    }

    onAddKey({
      label: keyLabel.trim(),
      keyContent: keyContent.trim(),
      passphrase: keyPassphrase
    });

    setKeyLabel('');
    setKeyContent('');
    setKeyPassphrase('');
    alert('Đã thêm SSH Private Key mới thành công!');
  };

  // Danh sách themes hỗ trợ
  const themeList = [
    { name: 'Glass Aura', color: '#aa3bff', desc: 'Glassmorphism' },
    { name: 'Cyberpunk Neon', color: '#ff007f', desc: 'Neon Cyberpunk' },
    { name: 'One Dark Pro', color: '#61afef', desc: 'Professional' },
    { name: 'Dracula', color: '#bd93f9', desc: 'Huyền bí dark' },
    { name: 'Retro Amber', color: '#ffb000', desc: 'CRT Hoài cổ' },
    { name: 'Light Terminus', color: '#ff5722', desc: 'Theme sáng Terminus' }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">Last SSH PREFERENCES</span>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="settings-tabs">
          <button 
            className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
            id="tab-settings-appearance"
          >
            <Palette size={14} />
            Appearance
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
            id="tab-settings-keys"
          >
            <Key size={14} />
            Private Keys
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            id="tab-settings-security"
          >
            <Lock size={14} />
            Security
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
            id="tab-settings-data"
          >
            <Database size={14} />
            Backup & Data
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          
          {/* TAB 1: Appearance */}
          {activeTab === 'appearance' && (
            <div className="settings-section">
              {/* Tách biệt Theme Pickers */}
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--accent)', fontWeight: 600 }}>APPLICATION THEME</label>
                <div className="theme-grid">
                  {themeList.map(t => (
                    <div 
                      key={`app-${t.name}`}
                      className={`theme-card ${settings.appTheme === t.name ? 'active' : ''}`}
                      onClick={() => onUpdateSettings({ appTheme: t.name })}
                      style={{ padding: '8px 10px', minHeight: '75px', justifyContent: 'center' }}
                    >
                      <div className="theme-color-preview" style={{ backgroundColor: t.color, width: '14px', height: '14px' }} />
                      <span className="theme-card-title" style={{ fontSize: '10.5px' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" style={{ color: 'var(--accent)', fontWeight: 600 }}>TERMINAL WORKSPACE THEME</label>
                <div className="theme-grid">
                  {themeList.map(t => (
                    <div 
                      key={`term-${t.name}`}
                      className={`theme-card ${settings.terminalTheme === t.name ? 'active' : ''}`}
                      onClick={() => onUpdateSettings({ terminalTheme: t.name })}
                      style={{ padding: '8px 10px', minHeight: '75px', justifyContent: 'center' }}
                    >
                      <div className="theme-color-preview" style={{ backgroundColor: t.color, width: '14px', height: '14px' }} />
                      <span className="theme-card-title" style={{ fontSize: '10.5px' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Font Family Selection */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Font Family</label>
                  <select 
                    className="glass-input"
                    value={settings.fontFamily}
                    onChange={(e) => onUpdateSettings({ fontFamily: e.target.value })}
                  >
                    <option value="Fira Code">Fira Code (Ligatures)</option>
                    <option value="Source Code Pro">Source Code Pro</option>
                    <option value="Courier New">Courier New (Standard)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cursor Style</label>
                  <select 
                    className="glass-input"
                    value={settings.cursorStyle}
                    onChange={(e) => onUpdateSettings({ cursorStyle: e.target.value })}
                  >
                    <option value="block">█ Block Cursor</option>
                    <option value="underline">_ Underline</option>
                    <option value="bar">| Vertical Bar</option>
                  </select>
                </div>
              </div>

              {/* Font Size Slider */}
              <div className="form-group">
                <label className="form-label">Font Size ({settings.fontSize}px)</label>
                <div className="slider-group">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>10px</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="24" 
                    className="glass-slider"
                    value={settings.fontSize}
                    onChange={(e) => onUpdateSettings({ fontSize: parseInt(e.target.value) })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>24px</span>
                </div>
              </div>

              {/* CRT Toggle */}
              <div className="settings-toggle-row">
                <div className="settings-toggle-label-group">
                  <span className="settings-toggle-title">Retro CRT Scanlines</span>
                  <span className="settings-toggle-desc">Mô phỏng sọc quét mờ và phồng nhẹ góc màn hình CRT hoài cổ</span>
                </div>
                <label className="switch-container">
                  <input 
                    type="checkbox"
                    checked={settings.crtEnabled}
                    onChange={(e) => onUpdateSettings({ crtEnabled: e.target.checked })}
                  />
                  <span className="switch-slider" />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: SSH Private Keys */}
          {activeTab === 'keys' && (
            <div className="settings-section">
              {/* Form thêm mới Key */}
              <form onSubmit={handleKeySubmit} className="key-setup-form">
                <span className="form-title" style={{ fontSize: '11.5px', color: 'var(--accent)', fontWeight: 600 }}>ADD NEW PRIVATE KEY</span>
                <div className="form-group">
                  <label className="form-label">Key Label / Name</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder="e.g. Production AWS Key"
                    required
                    id="input-key-label"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Private Key Content (PEM Format)</label>
                  <textarea 
                    className="glass-input key-textarea" 
                    value={keyContent}
                    onChange={(e) => setKeyContent(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEogIBAAKCAQEA0y6...&#10;-----END RSA PRIVATE KEY-----"
                    rows="4"
                    required
                    id="input-key-content"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Passphrase / Password (Optional)</label>
                    <input 
                      type="password" 
                      className="glass-input" 
                      value={keyPassphrase}
                      onChange={(e) => setKeyPassphrase(e.target.value)}
                      placeholder="Leave blank if none"
                      id="input-key-passphrase"
                    />
                  </div>
                </div>

                <button type="submit" className="glass-button active" style={{ display: 'flex', gap: '6px', width: 'max-content' }} id="btn-save-key">
                  <Plus size={14} />
                  Save Private Key
                </button>
              </form>

              {/* Danh sách các Key hiện có */}
              <div className="keys-list-container" style={{ marginTop: '10px' }}>
                <label className="form-label">SAVED KEYS ({keys.length})</label>
                {keys.length === 0 ? (
                  <div className="no-keys-placeholder">
                    No keys found. Add your first SSH private key using the form above.
                  </div>
                ) : (
                  <div className="keys-grid">
                    {keys.map(k => (
                      <div key={k.id} className="key-item-card">
                        <div className="key-item-info">
                          <Key size={15} className="key-item-icon" />
                          <div className="key-item-details">
                            <span className="key-item-label">{k.label}</span>
                            <span className="key-item-meta">PEM RSA Key ({(k.keyContent || '').length} chars)</span>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          className="action-btn delete-btn" 
                          onClick={() => {
                            if (confirm(`Bạn chắc chắn muốn xóa khóa '${k.label}'? Các server liên kết với khóa này sẽ chuyển sang dùng password.`)) {
                              onDeleteKey(k.id);
                            }
                          }}
                          title="Delete Key"
                          id={`btn-delete-key-${k.id}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Security */}
          {activeTab === 'security' && (
            <div className="settings-section">
              {hasPin ? (
                // Nếu đã bật PIN
                <div className="settings-section">
                  <div className="settings-toggle-row">
                    <div className="settings-toggle-label-group">
                      <span className="settings-toggle-title" style={{ color: 'var(--term-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Unlock size={14} />
                        Bảo mật mã PIN đang được kích hoạt
                      </span>
                      <span className="settings-toggle-desc">Toàn bộ mật khẩu, key máy chủ và hệ tệp tin ảo đã được mã hóa AES-GCM an toàn.</span>
                    </div>
                    <button className="glass-button" onClick={handleDisablePin} style={{ color: 'var(--term-red)', borderColor: 'rgba(255, 85, 98, 0.2)' }}>
                      Disable PIN
                    </button>
                  </div>

                  {/* Fingerprint WebAuthn Link */}
                  {isBiometricsAvailable && (
                    <div className="settings-toggle-row" style={{ marginTop: '8px' }}>
                      <div className="settings-toggle-label-group">
                        <span className="settings-toggle-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Fingerprint size={16} style={{ color: 'var(--accent)' }} />
                          Liên kết Sinh trắc học Hệ điều hành
                        </span>
                        <span className="settings-toggle-desc">Sử dụng cảm biến vân tay Touch ID hoặc Windows Hello để mở khóa nhanh không cần gõ PIN.</span>
                      </div>
                      <button className="glass-button active" onClick={handleLinkBiometrics}>
                        Link Vân Tay
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Nếu chưa cài PIN
                <form onSubmit={handleSetupPin} className="settings-section">
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', background: 'rgba(255, 85, 98, 0.05)', border: '1px dashed rgba(255, 85, 98, 0.2)', padding: '12px', borderRadius: '8px' }}>
                    <ShieldAlert size={14} style={{ color: 'var(--term-red)', marginRight: '6px', verticalAlign: 'middle' }} />
                    Dữ liệu lưu trữ cấu hình SSH của bạn hiện chưa được mã hóa. Hãy thiết lập một mã PIN để mã hóa an toàn.
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">New Master PIN (Min 4 chars)</label>
                      <input 
                        type="password"
                        maxLength="6"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        className="glass-input"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 1234"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm Master PIN</label>
                      <input 
                        type="password"
                        maxLength="6"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        className="glass-input"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="Confirm PIN"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-actions" style={{ marginTop: '8px' }}>
                    <button type="submit" className="glass-button active">
                      Enable Security PIN
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: Data Management */}
          {activeTab === 'data' && (
            <div className="settings-section">
              <div className="settings-toggle-row">
                <div className="settings-toggle-label-group">
                  <span className="settings-toggle-title">Sao lưu Cấu hình (Export Backup)</span>
                  <span className="settings-toggle-desc">Tải về toàn bộ máy chủ SSH, tệp tin ảo, theme dưới dạng file JSON (đã mã hóa an toàn nếu bạn có bật PIN).</span>
                </div>
                <button className="glass-button" onClick={handleExportData}>
                  <Download size={14} />
                  Export JSON
                </button>
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-label-group">
                  <span className="settings-toggle-title">Khôi phục Cấu hình (Import Backup)</span>
                  <span className="settings-toggle-desc">Tải lên file JSON đã sao lưu để khôi phục cấu hình ngay lập tức.</span>
                </div>
                <div className="import-btn-wrapper">
                  <button className="glass-button active">
                    <Upload size={14} />
                    Import JSON
                  </button>
                  <input type="file" accept=".json" onChange={handleImportData} />
                </div>
              </div>

              <div className="settings-toggle-row" style={{ border: '1px solid rgba(255, 85, 98, 0.2)', background: 'rgba(255, 85, 98, 0.05)' }}>
                <div className="settings-toggle-label-group">
                  <span className="settings-toggle-title" style={{ color: 'var(--term-red)' }}>Đưa về Trạng thái Xuất xưởng</span>
                  <span className="settings-toggle-desc">Xóa sạch toàn bộ cấu hình, hệ thống file ảo, SSH key, đưa app về trạng thái rỗng ban đầu.</span>
                </div>
                <button className="glass-button" onClick={handleFactoryReset} style={{ color: 'var(--term-red)', borderColor: 'rgba(255, 85, 98, 0.3)', background: 'rgba(255, 85, 98, 0.1)' }}>
                  <Trash2 size={14} />
                  Factory Reset
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="glass-button active" onClick={onClose}>
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
