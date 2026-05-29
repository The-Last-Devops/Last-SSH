import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Network, 
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
  keys = [],
  identities = [],
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

  useEffect(() => {
    const init = async () => {
      if (isOpen) {
        await startPeer();
      } else {
        p2pService.disconnect();
        resetStates();
      }
    };
    init();
  }, [isOpen]);

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
      await p2pService.sendPayload(connections, settings, syncPin, keys, identities);
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
      console.error(err);
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
            <span>Đang kết nối đến máy chủ tín hiệu P2P... (tối đa 12s)</span>
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
          <div className="p2p-status-indicator border-[rgba(72,218,147,0.3)]">
            <span className="p2p-status-dot active" />
            <span className="text-term-green font-semibold">Đã kết nối P2P thành công!</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="p2p-status-indicator border-[rgba(255,85,98,0.3)]">
            <span className="p2p-status-dot bg-[var(--term-red)]" />
            <span className="text-term-red">Đã ngắt kết nối.</span>
          </div>
        );
      default:
        return (
          <div className="p2p-status-indicator">
            <span className="p2p-status-dot bg-[var(--term-yellow)]" />
            <span>Sẵn sàng ghép đôi</span>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-[640px]">
        
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title flex items-center gap-2">
            <FolderSync size={18} className="text-accent" />
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
          <div className="flex justify-center">
            {renderStatus()}
          </div>

          {errorMsg && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-term-red text-xs flex items-center gap-1.5 justify-center bg-[rgba(255,85,98,0.05)] p-[10px] rounded-lg border border-dashed border-[rgba(255,85,98,0.2)] w-full">
                <AlertTriangle size={14} />
                {errorMsg}
              </div>
              <button
                className="glass-button text-xs px-4 py-1.5 flex items-center gap-1.5"
                onClick={startPeer}
              >
                <RefreshCw size={12} /> Thử lại kết nối
              </button>
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
                    <span className="text-[11px] text-text-muted">Mã kết nối của bạn:</span>
                    <span className="p2p-peer-id-badge">{peerId}</span>
                  </>
                ) : (
                  <RefreshCw size={24} className="animate-spin" />
                )}
              </div>

              {/* Cột B: Thiết bị kết nối (Nhập Code) */}
              <div className="p2p-card">
                <span className="p2p-card-title">THIẾT BỊ 2 (NHẬP MÃ GHÉP ĐÔI)</span>
                <form onSubmit={handleConnect} className="w-full flex flex-col gap-[14px]">
                  <p className="text-[11.5px] text-text-muted text-center">
                    Nhập mã ghép đôi của thiết bị kia (hoặc dùng điện thoại quét mã QR để điền mã) để kết nối trực tiếp.
                  </p>
                  <div className="form-group">
                    <input 
                      type="text" 
                      className="glass-input text-center font-mono tracking-[0.5px]"
                      value={targetPeerId}
                      onChange={(e) => setTargetPeerId(e.target.value)}
                      placeholder="e.g. mock-peer-5678"
                      required
                    />
                  </div>
                  <button type="submit" className="glass-button active w-full">
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
                <div className="flex flex-col gap-[10px] w-full max-w-[380px]">
                  <div className="form-group">
                    <label className="form-label text-center">Mật mã PIN Bảo mật gói dữ liệu (Tùy chọn)</label>
                    <input
                      type="password"
                      className="glass-input text-center"
                      value={syncPin}
                      maxLength="6"
                      onChange={(e) => setSyncPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Thiết lập PIN 4-6 số để bên nhận giải mã"
                    />
                  </div>
                  <button className="glass-button active w-full" onClick={handleSendData}>
                    <FolderSync size={14} />
                    Mã hóa & Gửi toàn bộ cấu hình
                  </button>
                </div>
                {sentSuccess && (
                  <div className="text-term-green text-xs flex items-center gap-1.5">
                    <CheckCircle size={14} />
                    Đã gửi dữ liệu mã hóa thành công sang thiết bị bên kia!
                  </div>
                )}
              </div>

              {/* Lắng nghe Nhận dữ liệu */}
              {receivedData && (
                <form onSubmit={handleImportSyncData} className="p2p-action-center border border-[var(--term-yellow)] bg-[rgba(241,196,15,0.05)]">
                  <span className="p2p-action-title text-[var(--term-yellow)]">NHẬN DỮ LIỆU ĐỒNG BỘ MỚI</span>
                  <p className="text-xs text-text-main text-center">
                    Thiết bị đối tác vừa gửi cho bạn một gói cấu hình Last SSH!
                  </p>
                  
                  {receivedData.hasPinProtection ? (
                    <div className="flex flex-col gap-[10px] w-full max-w-[380px]">
                      <div className="form-group">
                        <label className="form-label text-center">Gói tin có mã khóa. Nhập PIN giải mã của Thiết bị Gửi:</label>
                        <input
                          type="password"
                          className="glass-input text-center"
                          value={decryptPin}
                          maxLength="6"
                          onChange={(e) => setDecryptPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Nhập PIN giải mã"
                          required
                        />
                      </div>
                      <button type="submit" className="glass-button active w-full bg-[rgba(241,196,15,0.2)] border-[var(--term-yellow)] text-[var(--term-yellow)]">
                        <Lock size={14} />
                        Giải mã & Áp dụng ngay
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[10px] w-full max-w-[380px]">
                      <p className="text-[11px] text-text-muted text-center">Gói tin không có mật khẩu bảo vệ.</p>
                      <button type="submit" className="glass-button active w-full">
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
