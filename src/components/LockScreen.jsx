import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Fingerprint, Delete } from 'lucide-react';
import { securityService } from '../services/securityService.js';
import './LockScreen.css';

export default function LockScreen({ onUnlockSuccess }) {
  const [pin, setPin] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Animation classes
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Kiểm tra xem vân tay đã được liên kết chưa
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('terminus_biometrics_credentials');
      setHasBiometrics(!!raw);
    }

    // Tự động kích hoạt quét vân tay Touch ID khi mount nếu có hỗ trợ
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('terminus_biometrics_credentials');
      if (raw) {
        setTimeout(() => {
          handleBiometricUnlock();
        }, 300);
      }
    }
  }, []);

  // Xử lý khi nhấn nút số trên Keypad
  const handleNumberClick = (num) => {
    if (pin.length >= 4 || success) return;
    setErrorMsg('');
    
    const nextPin = pin + num;
    setPin(nextPin);

    // Khi gõ đủ 4 số -> Xác thực ngay
    if (nextPin.length === 4) {
      setTimeout(() => {
        verifyPin(nextPin);
      }, 150);
    }
  };

  // Xử lý nút xóa một ký tự
  const handleDeleteClick = () => {
    if (pin.length > 0 && !success) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  // Xác thực mã PIN
  const verifyPin = async (inputPin) => {
    try {
      const decryptedData = await securityService.unlockWithPIN(inputPin);
      
      // Thành công!
      setSuccess(true);
      setErrorMsg('');
      setTimeout(() => {
        onUnlockSuccess(decryptedData);
      }, 500);
    } catch (err) {
      // Thất bại -> Rung màn hình và reset PIN
      setShake(true);
      setErrorMsg('Mã PIN không chính xác! Vui lòng thử lại.');
      setPin('');
      setTimeout(() => setShake(false), 300);
    }
  };

  // Xác thực mở khóa bằng sinh trắc học Touch ID/Windows Hello
  const handleBiometricUnlock = async () => {
    setErrorMsg('');
    try {
      const decryptedData = await securityService.unlockWithBiometrics();
      
      setSuccess(true);
      setTimeout(() => {
        onUnlockSuccess(decryptedData);
      }, 500);
    } catch (err) {
      // Chỉ hiện lỗi khi người dùng chủ động nhấn hoặc quét thất bại thực sự
      console.warn('Lỗi sinh trắc học:', err);
      if (err.message && !err.message.includes('cancel') && !err.message.includes('abort')) {
        setErrorMsg(err.message);
        setShake(true);
        setTimeout(() => setShake(false), 300);
      }
    }
  };

  return (
    <div className="lockscreen-overlay">
      <div className={`lockscreen-card ${shake ? 'shake-animation' : ''} ${success ? 'auth-success' : errorMsg ? 'auth-error' : ''}`}>
        
        {/* Glowing lock logo */}
        <div className="lock-logo-wrapper">
          {success ? <Unlock size={32} className="fade-in" /> : <Lock size={32} />}
        </div>

        {/* Title */}
        <div>
          <h2 className="lockscreen-title">TERMINUS CLONE</h2>
          <span className="lockscreen-subtitle">Ứng dụng đã được mã hóa an toàn</span>
        </div>

        {/* PIN dots display */}
        <div className="pin-input-group">
          <div className="pin-display-wrapper">
            <div className={`pin-dot ${pin.length >= 1 ? 'filled' : ''}`} />
            <div className={`pin-dot ${pin.length >= 2 ? 'filled' : ''}`} />
            <div className={`pin-dot ${pin.length >= 3 ? 'filled' : ''}`} />
            <div className={`pin-dot ${pin.length >= 4 ? 'filled' : ''}`} />
          </div>
          <div className="error-label">{errorMsg}</div>
        </div>

        {/* Keypad */}
        <div className="keypad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button 
              key={num} 
              className="keypad-btn"
              onClick={() => handleNumberClick(num.toString())}
            >
              {num}
            </button>
          ))}
          
          {/* Biometrics finger shortcut (if linked) */}
          {hasBiometrics ? (
            <button className="keypad-btn" onClick={handleBiometricUnlock} title="Unlock with Fingerprint">
              <Fingerprint size={20} style={{ color: 'var(--accent)' }} />
            </button>
          ) : (
            <div />
          )}

          <button 
            className="keypad-btn"
            onClick={() => handleNumberClick('0')}
          >
            0
          </button>

          <button 
            className="keypad-btn"
            onClick={handleDeleteClick}
            title="Delete last digit"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Direct Biometric Scanner Button below Keypad */}
        {hasBiometrics && (
          <button className="biometric-scanner-btn" onClick={handleBiometricUnlock}>
            <div className="biometric-scanner-icon">
              <Fingerprint size={24} />
            </div>
            <span style={{ fontSize: '11px' }}>Unlock with Biometrics</span>
          </button>
        )}

      </div>
    </div>
  );
}
