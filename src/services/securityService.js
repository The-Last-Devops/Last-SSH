// securityService.js - Quản lý mã hóa dữ liệu AES-GCM và sinh trắc học WebAuthn

const PIN_STORE_KEY = 'terminus_master_pin_exists';
const ENCRYPTED_DATA_KEY = 'terminus_encrypted_payload';

// Helper: Chuyển đổi ArrayBuffer sang Base64
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

// Helper: Chuyển đổi Base64 sang ArrayBuffer
function base64ToBuffer(base64) {
  const binary = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

class SecurityService {
  constructor() {
    this.isUnlocked = true;
    this.activeKey = null; // Khóa giải mã đang hoạt động trong phiên
  }

  // Kiểm tra xem người dùng đã thiết lập mã PIN chưa
  hasPIN() {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(PIN_STORE_KEY) === 'true';
    }
    return false;
  }

  // Khóa ứng dụng
  lock() {
    this.isUnlocked = false;
    this.activeKey = null;
  }

  // Thiết lập mã PIN mới và mã hóa dữ liệu ban đầu
  async setupPIN(pin, initialData = {}) {
    if (!pin || pin.length < 4) {
      throw new Error('Mã PIN phải có ít nhất 4 ký tự');
    }

    try {
      const dataString = JSON.stringify(initialData);
      const encrypted = await this.encrypt(dataString, pin);

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PIN_STORE_KEY, 'true');
        window.localStorage.setItem(ENCRYPTED_DATA_KEY, encrypted);
      }
      this.isUnlocked = true;
      return true;
    } catch (e) {
      console.error('Lỗi khi thiết lập PIN:', e);
      throw new Error('Không thể thiết lập mã PIN bảo mật: ' + e.message);
    }
  }

  // Đăng nhập bằng mã PIN
  async unlockWithPIN(pin) {
    if (!this.hasPIN()) {
      throw new Error('Ứng dụng chưa được thiết lập mã PIN');
    }

    try {
      let encrypted = '';
      if (typeof window !== 'undefined' && window.localStorage) {
        encrypted = window.localStorage.getItem(ENCRYPTED_DATA_KEY) || '';
      }

      if (!encrypted) {
        // Nếu không có payload, coi như mở khóa thành công dữ liệu trống
        this.isUnlocked = true;
        return {};
      }

      const decryptedString = await this.decrypt(encrypted, pin);
      const decryptedData = JSON.parse(decryptedString);

      this.isUnlocked = true;
      return decryptedData;
    } catch (e) {
      throw new Error('Mã PIN không chính xác hoặc dữ liệu bị hỏng');
    }
  }

  // Cập nhật/lưu dữ liệu đã mã hóa
  async saveSecureData(data) {
    if (!this.isUnlocked) {
      throw new Error('Ứng dụng đang bị khóa, không thể ghi dữ liệu');
    }
    if (!this.hasPIN()) {
      // Nếu chưa thiết lập PIN, ghi thẳng dạng plain (ở ngoài App sẽ handle)
      return false;
    }

    // Do mã hóa cần pin, chúng ta cần lưu trữ khóa đối xứng activeKey trong bộ nhớ phiên.
    // Nếu activeKey bị trống (ví dụ F5), app sẽ bắt đăng nhập lại từ LockScreen.
    if (!this.activeKey) {
      throw new Error('Phiên làm việc hết hạn, vui lòng xác thực lại');
    }

    try {
      const dataString = JSON.stringify(data);
      const encrypted = await this.encryptWithDerivedKey(dataString, this.activeKey);
      
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ENCRYPTED_DATA_KEY, encrypted);
      }
      return true;
    } catch (e) {
      console.error('Lỗi khi lưu dữ liệu mã hóa:', e);
      throw new Error('Lỗi bảo mật khi lưu dữ liệu: ' + e.message);
    }
  }

  // Xóa sạch thông tin bảo mật (Factory Reset)
  resetSecurity() {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(PIN_STORE_KEY);
      window.localStorage.removeItem(ENCRYPTED_DATA_KEY);
      window.localStorage.removeItem('terminus_biometrics_credentials');
    }
    this.isUnlocked = true;
    this.activeKey = null;
  }

  // -------------------------------------------------------------
  // MÃ HÓA CỐT LÕI (AES-GCM + PBKDF2)
  // -------------------------------------------------------------

  // Tạo Key từ mật khẩu (PBKDF2)
  async deriveKey(password, salt) {
    const crypto = globalThis.crypto;
    const encoder = new TextEncoder();
    
    // 1. Nhập password dạng raw key
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey', 'deriveBits']
    );

    // 2. Tạo khóa đối xứng AES-GCM 256 từ PBKDF2
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true, // Có thể export được để lưu activeKey
      ['encrypt', 'decrypt']
    );
  }

  // Mã hóa chuỗi plaintext bằng password
  async encrypt(plaintext, password) {
    const crypto = globalThis.crypto;
    const encoder = new TextEncoder();
    
    // 1. Sinh ngẫu nhiên salt (16 bytes) và IV (12 bytes)
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 2. Tạo khóa mã hóa
    const key = await this.deriveKey(password, salt);
    this.activeKey = key; // Lưu lại trong phiên hiện tại

    // 3. Tiến hành mã hóa AES-GCM
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(plaintext)
    );

    // 4. Đóng gói kết quả dạng salt.iv.ciphertext (Base64)
    return `${bufferToBase64(salt)}.${bufferToBase64(iv)}.${bufferToBase64(ciphertext)}`;
  }

  // Mã hóa nhanh bằng khóa đã có sẵn
  async encryptWithDerivedKey(plaintext, key) {
    const crypto = globalThis.crypto;
    const encoder = new TextEncoder();
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(plaintext)
    );

    // Lưu trữ không cần salt mới vì khóa không đổi, ta truyền một dummy salt rỗng
    const dummySalt = new Uint8Array(16);
    return `${bufferToBase64(dummySalt)}.${bufferToBase64(iv)}.${bufferToBase64(ciphertext)}`;
  }

  // Giải mã chuỗi mã hóa bằng password
  async decrypt(encryptedString, password) {
    const crypto = globalThis.crypto;
    const decoder = new TextDecoder();
    
    const parts = encryptedString.split('.');
    if (parts.length !== 3) {
      throw new Error('Định dạng chuỗi mã hóa không hợp lệ');
    }

    const salt = new Uint8Array(base64ToBuffer(parts[0]));
    const iv = new Uint8Array(base64ToBuffer(parts[1]));
    const ciphertext = base64ToBuffer(parts[2]);

    // Tạo khóa giải mã từ password và salt ban đầu
    const key = await this.deriveKey(password, salt);
    this.activeKey = key; // Lưu lại trong phiên hiện tại

    // Tiến hành giải mã
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    return decoder.decode(decryptedBuffer);
  }

  // -------------------------------------------------------------
  // TÍCH HỢP SINH TRẮC HỌC (WEBAUTHN - TOUCH ID / WINDOWS HELLO)
  // -------------------------------------------------------------

  // Kiểm tra thiết bị có hỗ trợ sinh trắc học hệ điều hành không
  async isBiometricsSupported() {
    if (typeof window === 'undefined') return false;
    
    const hasWebAuthn = !!window.PublicKeyCredential;
    if (!hasWebAuthn) return false;

    try {
      // Kiểm tra xem thiết bị có hỗ trợ Touch ID/Windows Hello (Platform Authenticator) không
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      return false;
    }
  }

  // Đăng ký liên kết Vân tay (WebAuthn)
  async registerBiometrics(pin) {
    if (!this.hasPIN()) {
      throw new Error('Vui lòng thiết lập mã PIN trước khi liên kết vân tay');
    }
    const supported = await this.isBiometricsSupported();
    if (!supported) {
      throw new Error('Thiết bị của bạn không hỗ trợ sinh trắc học hoặc tính năng này chưa được kích hoạt');
    }

    try {
      const crypto = globalThis.crypto;
      // Sinh challenge ngẫu nhiên
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));

      // Định cấu hình đăng ký WebAuthn cho Touch ID/Windows Hello
      const options = {
        publicKey: {
          challenge: challenge,
          rp: { name: 'Terminus Clone Web' },
          user: {
            id: userId,
            name: 'user@terminus-clone',
            displayName: 'User Terminus'
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }], // ES256 & RS256
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Bắt buộc là Touch ID / Windows Hello của máy
            userVerification: 'required' // Bắt buộc phải xác minh vân tay/PIN máy tính
          },
          timeout: 60000
        }
      };

      const credential = await navigator.credentials.create(options);
      
      // Lưu trữ thông tin định danh Credential ID của vân tay để xác thực sau này
      const credentialIdBase64 = bufferToBase64(credential.rawId);
      
      // Mã hóa mã PIN của ứng dụng bằng một khóa tĩnh ngẫu nhiên chỉ thiết bị này biết,
      // bảo vệ mã PIN bằng thông tin vân tay (simulated client-side key storage).
      const secureStore = {
        credentialId: credentialIdBase64,
        // Chúng ta mã hóa mã PIN để lưu lại an toàn
        encryptedPin: await this.encrypt(pin, credentialIdBase64)
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('terminus_biometrics_credentials', JSON.stringify(secureStore));
      }

      return true;
    } catch (e) {
      console.error('Lỗi đăng ký vân tay:', e);
      throw new Error('Quá trình quét vân tay bị hủy hoặc lỗi: ' + e.message);
    }
  }

  // Xác thực mở khóa bằng Vân tay (Touch ID / Windows Hello)
  async unlockWithBiometrics() {
    const supported = await this.isBiometricsSupported();
    if (!supported) {
      throw new Error('Sinh trắc học không được hỗ trợ');
    }

    let storedCreds = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('terminus_biometrics_credentials');
      if (raw) storedCreds = JSON.parse(raw);
    }

    if (!storedCreds) {
      throw new Error('Vân tay chưa được đăng ký trong ứng dụng này');
    }

    try {
      const crypto = globalThis.crypto;
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credentialIdBuffer = base64ToBuffer(storedCreds.credentialId);

      // Cấu hình yêu cầu xác thực WebAuthn
      const options = {
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: credentialIdBuffer,
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000
        }
      };

      const assertion = await navigator.credentials.get(options);
      if (!assertion) {
        throw new Error('Xác thực thất bại');
      }

      // Vân tay đúng! Chúng ta tiến hành giải mã mã PIN đã lưu bằng Credential ID
      const decryptedPin = await this.decrypt(storedCreds.encryptedPin, storedCreds.credentialId);
      
      // Sau khi giải mã ra PIN, dùng PIN để mở khóa toàn bộ ứng dụng như bình thường
      return await this.unlockWithPIN(decryptedPin);
    } catch (e) {
      console.error('Lỗi xác thực vân tay:', e);
      throw new Error('Xác thực vân tay thất bại: ' + e.message);
    }
  }
}

export const securityService = new SecurityService();
