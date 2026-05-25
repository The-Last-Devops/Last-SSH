import { describe, it, expect, beforeEach, vi } from 'vitest';
import { p2pService } from '../services/p2pService.js';
import { virtualFS } from '../services/virtualFS.js';
import { securityService } from '../services/securityService.js';

describe('P2P PeerJS WebRTC Sync Service (p2pService)', () => {
  beforeEach(() => {
    virtualFS.reset();
    securityService.resetSecurity();
    p2pService.disconnect();
  });

  it('nên khởi tạo Peer ID thành công (Mock Mode)', async () => {
    const onIdReadyMock = vi.fn();
    p2pService.onIdReady = onIdReadyMock;

    const peerId = await p2pService.initPeer('test-peer-123');
    
    // Peer ID trả về phải đúng định dạng
    expect(peerId).toBe('test-peer-123');
    expect(p2pService.isMock).toBe(true);

    // Chờ callback gọi
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(onIdReadyMock).toHaveBeenCalledWith('test-peer-123');
  });

  it('nên kết nối thành công và truyền nhận gói dữ liệu P2P đã mã hóa an toàn', async () => {
    const onConnectedMock = vi.fn();
    const onDataReceivedMock = vi.fn();

    p2pService.onConnected = onConnectedMock;
    p2pService.onDataReceived = onDataReceivedMock;

    // Khởi tạo và Kết nối (Mock Mode)
    await p2pService.initPeer();
    await p2pService.connectToPeer('target-peer-xyz');

    // Chờ kết nối hoàn thành
    await new Promise(resolve => setTimeout(resolve, 110));
    expect(onConnectedMock).toHaveBeenCalled();

    // Chuẩn bị dữ liệu gửi đi
    const mockConnections = [{ id: '1', label: 'Dev Server', host: '192.168.1.100' }];
    const mockSettings = { theme: 'Cyberpunk Neon', fontSize: 16 };
    const syncPin = '1234';

    // Gửi tệp cấu hình mã hóa P2P
    const sendSuccess = await p2pService.sendPayload(mockConnections, mockSettings, syncPin);
    expect(sendSuccess).toBe(true);

    // Chờ nhận dữ liệu
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(onDataReceivedMock).toHaveBeenCalled();

    // Lấy gói dữ liệu nhận được trong callback
    const receivedArg = onDataReceivedMock.mock.calls[0][0];
    expect(receivedArg.hasPinProtection).toBe(true);
    expect(receivedArg.encryptedPayload).toBeTypeOf('string');

    // Giải mã gói tin nhận được bằng mã PIN hợp lệ
    const importData = await p2pService.decryptAndImportPayload(receivedArg.encryptedPayload, syncPin);
    expect(importData.connections).toEqual(mockConnections);
    expect(importData.settings).toEqual(mockSettings);

    // Đảm bảo sai PIN sẽ giải mã lỗi
    await expect(p2pService.decryptAndImportPayload(receivedArg.encryptedPayload, '0000')).rejects.toThrow();
  });
});
