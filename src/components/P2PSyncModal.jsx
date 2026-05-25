import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Network, 
  Smartphone, 
  Tv, 
  RefreshCw, 
  FolderSync, 
  CheckCircle, 
  AlertTriangle,
  X,
  Lock
} from 'lucide-react';
import { p2pService } from '../services/p2pService.js';
import './P2PSyncModal.css';

export default function P2PSyncModal({
  isOpen,
  onClose,
  connections = [],
  settings = {},
  onSyncComplete
}) {
  const [peerId, setPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [status, setStatus] = useState('initializing'); // initializing, idle, connecting, connected, disconnected
  const [errorMsg, setErrorMsg] = useState('');

  // Gửi và nhận tệp tin
  const [sentSuccess, setSentSuccess] = useState(false);
  const [receivedData, setReceivedData] = useState(null);
  
  // PIN bảo mật cho đồng bộ
  const [syncPin, setSyncPin] = useState('');
  const [decryptPin, setDecryptPin] = useState('');

  useEffect(() => {
    if (isOpen) {
      startPeer();
    } else {
      p2pService.disconnect();
      resetStates();
    }
  }, [isOpen]);

  const resetStates = () => {
    setPeerId('');
    setTargetPeerId('');
    setStatus('initializing');
    setErrorMsg('');
    setSentSuccess(false);
    setReceivedData(null);
    setSyncPin('');
    setDecryptPin('');
  };

  // Khởi động PeerJS
  const startPeer = async () => {
    setStatus('initializing');
    setErrorMsg('');
    
    // Cấu hình các callback lắng nghe sự kiện
    p2pService.onIdReady = (id) => {
      setPeerId(id);
      setStatus('idle');
    };

    p2pService.onConnected = () => {
      setStatus('connected');
    };

    p2pService.onDataReceived = (data) => {
      setReceivedData(data);
    };

    p2pService.onDisconnected = () => {
      setStatus('disconnected');
    };

    p2pService.onError = (err) => {
      setErrorMsg(err);
      setStatus('idle');
    };

    await p2pService.initPeer();
  };

  // Thiết lập kết nối
  const handleConnect = async (e) => {
    e.preventDefault();
    if (!targetPeerId.trim()) return;

    setStatus('connecting');
    setErrorMsg('');
    
    const success = await p2pService.connectToPeer(targetPeerId.trim());
    if (!success) {
      setStatus('idle');
    }
  };

  // Gửi dữ liệu mã hóa qua P2P
  const handleSendData = async () => {
    try {
      setSentSuccess(false);
      // Gửi toàn bộ Virtual FS, connections và settings đã mã hóa bằng syncPin
      await p2pService.sendPayload(connections, settings, syncPin);
      setSentSuccess(true);
    } catch (e) {
      alert('Không thể gửi dữ liệu: ' + e.message);
    }
  };

  // Giải mã và nạp dữ liệu nhận được
  const handleImportSyncData = async (e) => {
    e.preventDefault();
    if (!receivedData) return;

    try {
      const encryptionPassword = receivedData.hasPinProtection ? decryptPin : 'terminus_temp_sync_key';
      
      // Tiến hành giải mã và import virtualFS, connections, settings
      const imported = await p2pService.decryptAndImportPayload(receivedData.encryptedPayload, encryptionPassword);
      
      // Gọi callback để App cập nhật state React
      onSyncComplete(imported);
      
      alert('Đồng bộ hóa dữ liệu thành công! Ứng dụng của bạn đã được cập nhật.');
      onClose();
    } catch (err) {
      alert('Giải mã thất bại! Mã PIN không khớp, vui lòng thử lại.');
    }
  };

  if (!isOpen) return null;

  // Render chu kỳ trạng thái
  const renderStatus = () => {
    switch (status) {
      case 'initializing':
        return (
          <div className="p2p-status-indicator">
            <RefreshCw size={14} className="animate-spin" />
            <span>Đang khởi tạo máy chủ P2P...</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="p2p-status-indicator">
            <span className="p2p-status-dot connecting" />
            <span>Đang kết nối tới đối tác...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="p2p-status-indicator" style={{ borderColor: 'rgba(72, 218, 147, 0.3)' }}>
            <span className="p2p-status-dot active" />
            <span style={{ color: 'var(--term-green)', fontWeight: 600 }}>Đã kết nối P2P thành công!</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="p2p-status-indicator" style={{ borderColor: 'rgba(255, 85, 98, 0.3)' }}>
            <span className="p2p-status-dot" style={{ backgroundColor: 'var(--term-red)' }} />
            <span style={{ color: 'var(--term-red)' }}>Đã ngắt kết nối.</span>
          </div>
        );
      default:
        return (
          <div className="p2p-status-indicator">
            <span className="p2p-status-dot" style={{ backgroundColor: 'var(--term-yellow)' }} />
            <span>Sẵn sàng ghép đôi</span>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderSync size={18} style={{ color: 'var(--accent)' }} />
            P2P DEVICES SYNCHRONIZATION
          </span>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body p2p-flex-layout">
          
          <p className="p2p-description">
            Đồng bộ hóa dữ liệu trực tiếp ngang hàng (**Peer-to-Peer**) thông qua mạng internet an toàn WebRTC. 
            Không qua trung gian đám mây, dữ liệu được **mã hóa AES-GCM** cục bộ trước khi truyền.
          </p>

          {/* Dòng trạng thái kết nối */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {renderStatus()}
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--term-red)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', background: 'rgba(255, 85, 98, 0.05)', padding: '10px', borderRadius: '8px', border: '1px dashed rgba(255, 85, 98, 0.2)' }}>
              <AlertTriangle size={14} />
              {errorMsg}
            </div>
          )}

          {/* CHƯA KẾT NỐI: Hiện mã QR và Form nhập Code */}
          {status !== 'connected' && status !== 'connecting' && (
            <div className="p2p-grid">
              
              {/* Cột A: Thiết bị phát (Show QR) */}
              <div className="p2p-card">
                <span className="p2p-card-title">THIẾT BỊ 1 (QUÉT MÃ QR)</span>
                {peerId ? (
                  <>
                    <div className="p2p-qr-wrapper">
                      <QRCodeSVG value={peerId} size={130} level="M" />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mã kết nối của bạn:</span>
                    <span className="p2p-peer-id-badge">{peerId}</span>
                  </>
                ) : (
                  <RefreshCw size={24} className="animate-spin" />
                )}
              </div>

              {/* Cột B: Thiết bị kết nối (Nhập Code) */}
              <div className="p2p-card">
                <span className="p2p-card-title">THIẾT BỊ 2 (NHẬP MÃ GHÉP ĐÔI)</span>
                <form onSubmit={handleConnect} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Nhập mã ghép đôi của thiết bị kia (hoặc dùng điện thoại quét mã QR để điền mã) để kết nối trực tiếp.
                  </p>
                  <div className="form-group">
                    <input 
                      type="text" 
                      className="glass-input" 
                      style={{ textAlign: 'center', fontFamily: 'Fira Code, monospace', letterSpacing: '0.5px' }}
                      value={targetPeerId}
                      onChange={(e) => setTargetPeerId(e.target.value)}
                      placeholder="e.g. mock-peer-5678"
                      required
                    />
                  </div>
                  <button type="submit" className="glass-button active" style={{ width: '100%' }}>
                    <Network size={14} />
                    Ghép Đôi Thiết Bị
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* ĐÃ KẾT NỐI: Hiện bảng chuyển dữ liệu */}
          {status === 'connected' && (
            <div className="p2p-flex-layout">
              
              {/* Hành động Gửi dữ liệu */}
              <div className="p2p-action-center">
                <span className="p2p-action-title">GỬI DỮ LIỆU ĐẾN THIẾT BỊ ĐỐI TÁC</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '380px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'center' }}>Mật mã PIN Bảo mật gói dữ liệu (Tùy chọn)</label>
                    <input 
                      type="password" 
                      className="glass-input"
                      style={{ textAlign: 'center' }}
                      value={syncPin}
                      maxLength="6"
                      onChange={(e) => setSyncPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Thiết lập PIN 4-6 số để bên nhận giải mã"
                    />
                  </div>
                  <button className="glass-button active" onClick={handleSendData} style={{ width: '100%' }}>
                    <FolderSync size={14} />
                    Mã hóa & Gửi toàn bộ cấu hình
                  </button>
                </div>
                {sentSuccess && (
                  <div style={{ color: 'var(--term-green)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={14} />
                    Đã gửi dữ liệu mã hóa thành công sang thiết bị bên kia!
                  </div>
                )}
              </div>

              {/* Lắng nghe Nhận dữ liệu */}
              {receivedData && (
                <form onSubmit={handleImportSyncData} className="p2p-action-center" style={{ border: '1px solid var(--term-yellow)', background: 'rgba(241, 196, 15, 0.05)' }}>
                  <span className="p2p-action-title" style={{ color: 'var(--term-yellow)' }}>NHẬN DỮ LIỆU ĐỒNG BỘ MỚI</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-main)', textAlign: 'center' }}>
                    Thiết bị đối tác vừa gửi cho bạn một gói cấu hình Last SSH!
                  </p>
                  
                  {receivedData.hasPinProtection ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '380px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ textAlign: 'center' }}>Gói tin có mã khóa. Nhập PIN giải mã của Thiết bị Gửi:</label>
                        <input 
                          type="password" 
                          className="glass-input"
                          style={{ textAlign: 'center' }}
                          value={decryptPin}
                          maxLength="6"
                          onChange={(e) => setDecryptPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Nhập PIN giải mã"
                          required
                        />
                      </div>
                      <button type="submit" className="glass-button active" style={{ width: '100%', background: 'rgba(241, 196, 15, 0.2)', borderColor: 'var(--term-yellow)', color: 'var(--term-yellow)' }}>
                        <Lock size={14} />
                        Giải mã & Áp dụng ngay
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '380px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Gói tin không có mật khẩu bảo vệ.</p>
                      <button type="submit" className="glass-button active" style={{ width: '100%' }}>
                        Nhập khẩu cấu hình ngay
                      </button>
                    </div>
                  )}
                </form>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="glass-button" onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
