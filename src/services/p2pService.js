// p2pService.js - Dịch vụ đồng bộ dữ liệu ngang hàng P2P sử dụng WebRTC (PeerJS)

import { virtualFS } from './virtualFS.js';
import { securityService } from './securityService.js';

class P2PService {
  constructor() {
    this.peer = null;
    this.connection = null;
    this.peerId = '';
    this.isConnecting = false;
    this.isMock = false;
    this.mockChannel = null;
    this.targetPeerId = ''; // Lưu trữ đối tác trong chế độ mock

    // Callbacks
    this.onIdReady = null;
    this.onConnected = null;
    this.onDataReceived = null;
    this.onError = null;
    this.onDisconnected = null;
  }

  // Khởi tạo Peer Connection
  async initPeer(customId = '') {
    this.disconnect();

    // Kiểm tra môi trường chạy (Thêm window.__e2e__ cho E2E Testing)
    if (typeof window === 'undefined' || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test') || (typeof window !== 'undefined' && window.__e2e__)) {
      this.isMock = true;
      this.peerId = customId || 'mock-peer-' + Math.floor(1000 + Math.random() * 9000);
      
      // Sử dụng BroadcastChannel để giao tiếp chéo tab/context trong E2E testing
      if (typeof window !== 'undefined' && window.__e2e__ && window.BroadcastChannel) {
        try {
          this.mockChannel = new BroadcastChannel('terminus-mock-p2p');
          this.mockChannel.onmessage = (event) => {
            const msg = event.data;
            if (!msg) return;

            if (msg.type === 'CONNECT_REQUEST' && msg.target === this.peerId) {
              this.targetPeerId = msg.sender;
              this.isConnecting = false;
              
              // Trả lời xác nhận kết nối
              this.mockChannel.postMessage({
                type: 'CONNECT_ACCEPT',
                sender: this.peerId,
                target: msg.sender
              });
              
              if (this.onConnected) this.onConnected(msg.sender);
            } 
            else if (msg.type === 'CONNECT_ACCEPT' && msg.target === this.peerId) {
              this.targetPeerId = msg.sender;
              this.isConnecting = false;
              if (this.onConnected) this.onConnected(msg.sender);
            } 
            else if (msg.type === 'DATA_SEND' && msg.target === this.peerId) {
              this.handleReceivedData(msg.packet);
            } 
            else if (msg.type === 'DISCONNECT' && msg.target === this.peerId) {
              this.targetPeerId = '';
              if (this.onDisconnected) this.onDisconnected();
            }
          };
        } catch (e) {
          console.warn('Lỗi khởi tạo BroadcastChannel mock P2P:', e);
        }
      }

      setTimeout(() => {
        if (this.onIdReady) this.onIdReady(this.peerId);
      }, 50);
      return this.peerId;
    }

    try {
      // Import động PeerJS để tránh lỗi import trong Node.js testing
      const { Peer } = await import('peerjs');
      
      const peerOptions = {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 1 // Chỉ hiện thị lỗi nghiêm trọng
      };

      this.peer = customId ? new Peer(customId, peerOptions) : new Peer(peerOptions);

      this.peer.on('open', (id) => {
        this.peerId = id;
        this.isConnecting = false;
        if (this.onIdReady) this.onIdReady(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Lỗi PeerJS:', err);
        if (this.onError) this.onError(err.message || 'Lỗi kết nối PeerJS');
      });

      this.peer.on('disconnected', () => {
        if (this.onDisconnected) this.onDisconnected();
      });

    } catch (e) {
      console.warn('Không thể khởi tạo PeerJS thật, chuyển sang chế độ Mock:', e);
      this.isMock = true;
      this.peerId = 'mock-peer-' + Math.floor(1000 + Math.random() * 9000);
      if (this.onIdReady) this.onIdReady(this.peerId);
    }

    return this.peerId;
  }

  // Kết nối đến một Peer khác (Thiết bị A kết nối đến Thiết bị B)
  async connectToPeer(targetPeerId) {
    if (!targetPeerId) return false;
    this.isConnecting = true;
    this.targetPeerId = targetPeerId;

    if (this.isMock) {
      if (this.mockChannel) {
        // Gửi kết nối qua BroadcastChannel
        this.mockChannel.postMessage({
          type: 'CONNECT_REQUEST',
          sender: this.peerId,
          target: targetPeerId
        });
      } else {
        // Chạy unit test đơn lẻ
        setTimeout(() => {
          this.isConnecting = false;
          if (this.onConnected) this.onConnected('mock-connection-id');
        }, 50);
      }
      return true;
    }

    if (!this.peer) {
      await this.initPeer();
    }

    try {
      const conn = this.peer.connect(targetPeerId, {
        reliable: true
      });
      this.setupConnectionEvents(conn);
      return true;
    } catch (e) {
      this.isConnecting = false;
      if (this.onError) this.onError('Không thể kết nối: ' + e.message);
      return false;
    }
  }

  // Xử lý khi có kết nối đi vào (Incoming Connection)
  handleIncomingConnection(conn) {
    this.setupConnectionEvents(conn);
  }

  // Cấu hình các sự kiện cho DataChannel
  setupConnectionEvents(conn) {
    this.connection = conn;

    conn.on('open', () => {
      this.isConnecting = false;
      this.targetPeerId = conn.peer;
      if (this.onConnected) this.onConnected(conn.peer);
    });

    conn.on('data', (data) => {
      this.handleReceivedData(data);
    });

    conn.on('close', () => {
      this.connection = null;
      if (this.onDisconnected) this.onDisconnected();
    });

    conn.on('error', (err) => {
      if (this.onError) this.onError('Lỗi đường truyền: ' + err.message);
    });
  }

  // Đóng kết nối hiện tại
  disconnect() {
    if (this.isMock && this.mockChannel && this.targetPeerId) {
      try {
        this.mockChannel.postMessage({
          type: 'DISCONNECT',
          sender: this.peerId,
          target: this.targetPeerId
        });
      } catch { /* ignore */ }
    }

    if (this.connection) {
      try { this.connection.close(); } catch { /* ignore */ }
      this.connection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* ignore */ }
      this.peer = null;
    }

    if (this.mockChannel) {
      try { this.mockChannel.close(); } catch { /* ignore */ }
      this.mockChannel = null;
    }

    this.peerId = '';
    this.targetPeerId = '';
    this.isConnecting = false;
  }

  // Gửi dữ liệu cấu hình đã mã hóa sang peer bên kia
  async sendPayload(connectionsList = [], settingsState = {}, pin = '', keysList = [], identitiesList = []) {
    if (!this.connection && !this.isMock) {
      throw new Error('Chưa thiết lập kết nối P2P đến thiết bị nào');
    }

    try {
      const payload = {
        virtualFS: virtualFS.exportFS(),
        connections: connectionsList,
        settings: settingsState,
        keys: Array.isArray(keysList) ? keysList : [],
        identities: Array.isArray(identitiesList) ? identitiesList : [],
        sentAt: new Date().toISOString()
      };

      // 2. Mã hóa dữ liệu bằng AES-GCM với mã PIN
      const encryptionPassword = pin || 'terminus_temp_sync_key';
      const encryptedString = await securityService.encrypt(JSON.stringify(payload), encryptionPassword);

      const packet = {
        type: 'TERMINUS_SYNC_PAYLOAD',
        payload: encryptedString,
        hasPinProtection: !!pin
      };

      // 3. Gửi gói tin
      if (this.isMock) {
        if (this.mockChannel) {
          this.mockChannel.postMessage({
            type: 'DATA_SEND',
            sender: this.peerId,
            target: this.targetPeerId,
            packet: packet
          });
        } else {
          // Unit test đơn lẻ
          setTimeout(() => {
            this.handleReceivedData(packet);
          }, 50);
        }
      } else {
        this.connection.send(packet);
      }

      return true;
    } catch (e) {
      console.error('Lỗi khi gửi payload P2P:', e);
      throw new Error('Không thể mã hóa hoặc gửi dữ liệu: ' + e.message, { cause: e });
    }
  }

  // Xử lý dữ liệu nhận được
  handleReceivedData(data) {
    if (data && data.type === 'TERMINUS_SYNC_PAYLOAD') {
      if (this.onDataReceived) {
        // Trả ra gói tin mã hóa kèm cờ bảo vệ PIN cho UI xử lý
        this.onDataReceived({
          encryptedPayload: data.payload,
          hasPinProtection: data.hasPinProtection
        });
      }
    }
  }

  // Giải mã và nhập khẩu (Import) dữ liệu đồng bộ nhận được
  async decryptAndImportPayload(encryptedPayload, password) {
    try {
      // Giải mã dữ liệu
      const decryptedString = await securityService.decrypt(encryptedPayload, password);
      const data = JSON.parse(decryptedString);

      if (!data.virtualFS || !Array.isArray(data.connections)) {
        throw new Error('Cấu trúc tệp dữ liệu không hợp lệ');
      }

      // 1. Nhập khẩu Hệ thống tệp ảo
      const fsSuccess = virtualFS.importFS(data.virtualFS);
      if (!fsSuccess) {
        throw new Error('Không thể nạp Hệ thống tệp tin ảo nhận được');
      }

      return {
        connections: data.connections,
        settings: data.settings || {},
        keys: Array.isArray(data.keys) ? data.keys : [],
        identities: Array.isArray(data.identities) ? data.identities : []
      };
    } catch (e) {
      throw new Error('Giải mã dữ liệu đồng bộ thất bại. Mã PIN không khớp!', { cause: e });
    }
  }
}

export const p2pService = new P2PService();
