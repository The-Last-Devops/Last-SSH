import { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  FolderSync,
  CheckCircle,
  AlertTriangle,
  X,
  Copy,
  Check,
  ArrowRight,
  Upload,
  Download
} from 'lucide-react';
import { p2pService } from '../services/p2pService.js';
import './P2PSyncModal.css';

// Sinh enc key ngẫu nhiên 12 ký tự alphanumeric
function genEncKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function P2PSyncModal({
  isOpen, onClose,
  connections = [], settings = {}, keys = [], identities = [],
  onSyncComplete,
  inline = false  // true = render không có modal overlay (nhúng thẳng vào page)
}) {
  // step: 'pick' → 'share' | 'receive' → connected
  const [step, setStep]             = useState('pick');
  const [peerId, setPeerId]         = useState('');
  const [encKey, setEncKey]         = useState('');
  const [timeLeft, setTimeLeft]     = useState(120);
  const [syncKey, setSyncKey]       = useState('');
  const [inputKey, setInputKey]     = useState('');
  const [status, setStatus]         = useState('initializing');
  const [errorMsg, setErrorMsg]     = useState('');
  const [copied, setCopied]         = useState(false);
  const [sentOk, setSentOk]         = useState(false);
  const [receivedData, setReceivedData] = useState(null);
  const [autoImporting, setAutoImporting] = useState(false);
  const [isJoiner, setIsJoiner] = useState(false);
  const [pendingImport, setPendingImport] = useState(null); // data chờ user chọn merge/replace

  const encKeyRef    = useRef(encKey);
  const peerIdRef    = useRef(peerId);
  const timerRef     = useRef(null);
  const isJoinerRef  = useRef(false);
  const syncDataRef  = useRef({ connections, settings, keys, identities });

  // Cập nhật ref khi state đổi
  useEffect(() => { encKeyRef.current = encKey; }, [encKey]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { syncDataRef.current = { connections, settings, keys, identities }; }, [connections, settings, keys, identities]);

  const rotateKey = () => {
    const newKey = genEncKey();
    setEncKey(newKey);
    encKeyRef.current = newKey;
    setTimeLeft(120);
    if (peerIdRef.current) {
      setSyncKey(`LSSH::${peerIdRef.current}::${newKey}`);
    }
  };

  // Khởi tạo peer
  const startPeer = async () => {
    setStatus('initializing');
    setErrorMsg('');
    setSentOk(false);
    setReceivedData(null);
    isJoinerRef.current = false; setIsJoiner(false);

    const initialKey = genEncKey();
    setEncKey(initialKey);
    encKeyRef.current = initialKey;
    setTimeLeft(120);

    p2pService.sessionEncKey = '';

    p2pService.onIdReady = (id) => {
      setPeerId(id);
      peerIdRef.current = id;
      setSyncKey(`LSSH::${id}::${initialKey}`);
      setStatus('idle');
    };

    p2pService.onConnected = () => {
      setStatus('connected');
      // Nếu là joiner, gửi enc key sang host ngay
      if (isJoinerRef.current) {
        p2pService.sendKeyExchange(encKeyRef.current);
      }
    };

    // Host nhận enc key từ joiner → lưu và tự động gửi dữ liệu ngay
    p2pService.onKeyExchanged = async (k) => {
      p2pService.sessionEncKey = k;
      if (!isJoinerRef.current) {
        try {
          const { connections: c, settings: s, keys: ks, identities: ids } = syncDataRef.current;
          await p2pService.sendPayload(c, s, ks, ids);
          setSentOk(true);
        } catch (e) {
          setErrorMsg('Không thể gửi: ' + e.message);
        }
      }
    };

    p2pService.onDataReceived = async (data) => {
      if (data?.encryptedPayload && data?.encKey) {
        setAutoImporting(true);
        try {
          const imported = await p2pService.decryptAndImportPayload(data.encryptedPayload, data.encKey);
          // Dừng lại, hỏi user muốn merge hay replace
          setPendingImport(imported);
        } catch (err) {
          setErrorMsg('Giải mã thất bại: ' + err.message);
        } finally {
          setAutoImporting(false);
        }
      }
    };

    p2pService.onDisconnected = () => setStatus('disconnected');
    p2pService.onError        = (err) => { setErrorMsg(err); setStatus('idle'); };

    await p2pService.initPeer();

    // Bắt đầu countdown rotation
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          rotateKey();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startPeer();
    } else {
      clearInterval(timerRef.current);
      p2pService.disconnect();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeerId(''); setEncKey(''); setSyncKey(''); setInputKey('');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('initializing'); setErrorMsg(''); setSentOk(false); setReceivedData(null); setStep('pick'); setPendingImport(null);
    }
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Thiết bị B: kết nối bằng sync key
  const handleJoin = async (e) => {
    e.preventDefault();
    const parsed = p2pService.constructor.parseSyncKey(inputKey.trim());
    if (!parsed) {
      setErrorMsg('Sync key không hợp lệ. Định dạng: LSSH::<peerId>::<encKey>');
      return;
    }
    clearInterval(timerRef.current); // dừng rotation khi đã join
    isJoinerRef.current = true; setIsJoiner(true);
    // Lưu enc key từ sync key để dùng khi nhận data
    setEncKey(parsed.encKey);
    encKeyRef.current = parsed.encKey;
    p2pService.sessionEncKey = parsed.encKey;

    setStatus('connecting');
    setErrorMsg('');
    const ok = await p2pService.connectToPeer(parsed.peerId);
    if (!ok) setStatus('idle');
  };

  // Thiết bị A: gửi dữ liệu (host side)
  const handleSend = async () => {
    try {
      setSentOk(false);
      await p2pService.sendPayload(connections, settings, keys, identities);
      setSentOk(true);
    } catch (e) {
      setErrorMsg('Không thể gửi: ' + e.message);
    }
  };

  // Merge: dữ liệu thiết bị kia + dữ liệu local, trùng ID thì giữ bên gửi (mới hơn)
  const handleMerge = () => {
    if (!pendingImport) return;
    const local = syncDataRef.current;
    const mergeById = (incoming = [], existing = []) => {
      const map = new Map(existing.map(item => [item.id, item]));
      incoming.forEach(item => map.set(item.id, item)); // incoming thắng khi trùng id
      return Array.from(map.values());
    };
    const merged = {
      connections: mergeById(pendingImport.connections, local.connections),
      keys:        mergeById(pendingImport.keys,        local.keys),
      identities:  mergeById(pendingImport.identities,  local.identities),
      settings:    pendingImport.settings, // settings dùng của bên gửi
    };
    onSyncComplete(merged);
    setPendingImport(null);
    setReceivedData('ok');
  };

  // Replace: thay hoàn toàn bằng dữ liệu bên gửi
  const handleReplace = () => {
    if (!pendingImport) return;
    onSyncComplete(pendingImport);
    setPendingImport(null);
    setReceivedData('ok');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(syncKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  const statusColor = {
    initializing: '#9ca3af',
    idle:         '#f59e0b',
    connecting:   '#60a5fa',
    connected:    '#4ade80',
    disconnected: '#f87171',
  }[status] || '#9ca3af';

  const statusLabel = {
    initializing: 'Connecting to signaling server...',
    idle:         'Ready to pair',
    connecting:   'Connecting...',
    connected:    'Connected!',
    disconnected: 'Disconnected',
  }[status] || status;

  const content = (
    <>
      <div className="modal-body p2p-flex-layout">

        {/* ── STEP 1: PICK MODE ── */}
        {step === 'pick' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              What would you like to do?
            </p>
            <div style={{ display: 'flex', gap: 16, width: '100%' }}>
              <button
                onClick={() => setStep('share')}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '24px 16px', borderRadius: 14, cursor: 'pointer',
                  background: 'rgba(37,99,235,0.06)', border: '1.5px solid rgba(37,99,235,0.25)',
                  color: 'var(--text-bright)', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.12)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.06)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.25)'; }}
              >
                <Upload size={32} style={{ color: '#3b82f6' }} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>Send Data</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Generate a key and send your data to another device
                </div>
              </button>
              <button
                onClick={() => setStep('receive')}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '24px 16px', borderRadius: 14, cursor: 'pointer',
                  background: 'rgba(72,218,147,0.06)', border: '1.5px solid rgba(72,218,147,0.25)',
                  color: 'var(--text-bright)', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(72,218,147,0.12)'; e.currentTarget.style.borderColor = 'rgba(72,218,147,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(72,218,147,0.06)'; e.currentTarget.style.borderColor = 'rgba(72,218,147,0.25)'; }}
              >
                <Download size={32} style={{ color: '#4ade80' }} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>Receive Data</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Paste a Sync Key to receive data from another device
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2A: SHARE ── */}
        {step === 'share' && status !== 'connected' && (
          <div className="p2p-flex-layout">
            <div className="p2p-status-indicator" style={{ borderColor: statusColor + '44' }}>
              {status === 'initializing'
                ? <RefreshCw size={13} className="animate-spin" style={{ color: statusColor }} />
                : <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              }
              <span style={{ color: statusColor, fontSize: 12 }}>{statusLabel}</span>
            </div>

            {errorMsg && (
              <div className="flex flex-col items-center gap-2">
                <div className="text-term-red text-xs flex items-center gap-1.5 justify-center bg-[rgba(255,85,98,0.05)] p-2.5 rounded-lg border border-dashed border-[rgba(255,85,98,0.2)] w-full">
                  <AlertTriangle size={13} /> {errorMsg}
                </div>
                <button className="glass-button text-xs px-3 py-1 flex items-center gap-1" onClick={startPeer}>
                  <RefreshCw size={11} /> Retry
                </button>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Share this key with the other device. It refreshes every 2 minutes for security.
            </p>

            {peerId ? (
              <div style={{
                width: '100%', borderRadius: 14, padding: '24px 20px',
                background: 'rgba(37,99,235,0.06)', border: '1.5px solid rgba(37,99,235,0.2)',
                textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12
              }}>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Sync Key</div>
                <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: 2, color: 'var(--text-bright)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {syncKey.slice(0, 10)}
                  <span style={{ color: '#9ca3af', letterSpacing: 1 }}>{'*'.repeat(Math.max(0, syncKey.length - 18))}</span>
                  {syncKey.slice(-8)}
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
                  <div style={{ height: '100%', borderRadius: 99, transition: 'width 1s linear, background 1s', background: timeLeft <= 15 ? '#f87171' : '#3b82f6', width: `${(timeLeft / 120) * 100}%` }} />
                </div>
                <div style={{ fontSize: 11, color: timeLeft <= 15 ? '#f87171' : '#9ca3af' }}>
                  Expires in {timeLeft}s
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '16px 0' }}>
                <RefreshCw size={20} className="animate-spin text-text-muted" />
                <span style={{ fontSize: 12, color: '#6b7280' }}>Initializing...</span>
              </div>
            )}

            <button onClick={handleCopy} className="glass-button active w-full flex items-center justify-center gap-2" style={{ height: 42, fontSize: 13, fontWeight: 600 }}>
              {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Sync Key</>}
            </button>
            <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>← Back</button>
          </div>
        )}

        {/* ── STEP 2B: RECEIVE ── */}
        {step === 'receive' && status !== 'connected' && (
          <div className="p2p-flex-layout">
            <div className="p2p-status-indicator" style={{ borderColor: statusColor + '44' }}>
              {status === 'initializing' || status === 'connecting'
                ? <RefreshCw size={13} className="animate-spin" style={{ color: statusColor }} />
                : <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              }
              <span style={{ color: statusColor, fontSize: 12 }}>{statusLabel}</span>
            </div>

            {errorMsg && (
              <div className="text-term-red text-xs flex items-center gap-1.5 justify-center bg-[rgba(255,85,98,0.05)] p-2.5 rounded-lg border border-dashed border-[rgba(255,85,98,0.2)] w-full">
                <AlertTriangle size={13} /> {errorMsg}
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Paste the Sync Key copied from the other device.
            </p>

            <form onSubmit={handleJoin} className="w-full flex flex-col gap-3">
              <textarea
                className="glass-input font-mono text-[13px] leading-relaxed"
                style={{ minHeight: 100, resize: 'none', wordBreak: 'break-all' }}
                value={inputKey}
                onChange={e => setInputKey(e.target.value)}
                placeholder="Paste Sync Key here..."
                autoFocus
                required
              />
              <button type="submit" className="glass-button active w-full flex items-center justify-center gap-2" style={{ height: 42, fontSize: 13, fontWeight: 600 }} disabled={status === 'connecting'}>
                {status === 'connecting' ? <><RefreshCw size={14} className="animate-spin" /> Connecting...</> : <><ArrowRight size={14} /> Connect & Sync</>}
              </button>
            </form>
            <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>← Back</button>
          </div>
        )}

        {/* ── CONNECTED ── */}
        {status === 'connected' && (
          <div className="p2p-action-center">
            {!isJoiner && !receivedData && (
              <>
                <span className="p2p-action-title">PAIRED — READY TO SEND</span>
                <p className="text-xs text-text-muted text-center">The other device connected. Click to send all your data.</p>
                <button className="glass-button active w-full max-w-[320px] flex items-center justify-center gap-2" onClick={handleSend}>
                  <FolderSync size={14} /> Send Data
                </button>
                {sentOk && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-term-green text-xs flex items-center gap-1.5"><CheckCircle size={13} /> Sent successfully!</div>
                    <button onClick={() => { setStep('pick'); setSentOk(false); p2pService.disconnect(); setStatus('initializing'); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>← Back to menu</button>
                  </div>
                )}
              </>
            )}
            {isJoiner && receivedData !== 'ok' && (
              <>
                {pendingImport ? (
                  /* ── Dialog chọn Merge / Replace ── */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
                    <span className="p2p-action-title">DATA RECEIVED</span>
                    <p className="text-xs text-text-muted text-center">
                      Received <b>{pendingImport.connections?.length ?? 0}</b> hosts,{' '}
                      <b>{pendingImport.keys?.length ?? 0}</b> keys,{' '}
                      <b>{pendingImport.identities?.length ?? 0}</b> identities.
                      <br />How do you want to apply this data?
                    </p>
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                      <button
                        className="glass-button w-full flex flex-col items-center gap-1"
                        style={{ padding: '14px 10px', borderRadius: 12 }}
                        onClick={handleMerge}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Merge</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                          Combine with your existing data.<br />Duplicates use incoming version.
                        </span>
                      </button>
                      <button
                        className="glass-button active w-full flex flex-col items-center gap-1"
                        style={{ padding: '14px 10px', borderRadius: 12 }}
                        onClick={handleReplace}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Replace</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                          Overwrite all your data<br />with incoming data.
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="p2p-action-title">WAITING FOR DATA</span>
                    {autoImporting
                      ? <><RefreshCw size={18} className="animate-spin text-accent" /><p className="text-xs text-text-muted">Decrypting...</p></>
                      : <p className="text-xs text-text-muted text-center">Waiting for the other device to send data...</p>
                    }
                  </>
                )}
              </>
            )}
            {receivedData === 'ok' && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle size={36} className="text-term-green" />
                <span className="text-term-green font-semibold">Sync successful!</span>
                <p className="text-xs text-text-muted text-center">All data has been applied.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );

  if (inline) {
    return <div style={{ padding: '16px 24px', overflowY: 'auto', height: '100%' }}>{content}</div>;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <span className="modal-title flex items-center gap-2">
            <FolderSync size={18} className="text-accent" />
            Device Sync (P2P)
          </span>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        {content}
        <div className="modal-footer">
          <button className="glass-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
