
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LockScreen from '../components/LockScreen.jsx';
import { securityService } from '../services/securityService.js';

// Mock securityService
vi.mock('../services/securityService.js', () => {
  return {
    securityService: {
      hasPIN: vi.fn(() => true),
      unlockWithPIN: vi.fn((pin) => {
        if (pin === '2026') {
          return Promise.resolve({ connections: [], settings: {} });
        }
        return Promise.reject(new Error('Sai PIN'));
      }),
      isBiometricsSupported: vi.fn(() => Promise.resolve(false))
    }
  };
});

describe('LockScreen Component (Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nên kết xuất màn hình khóa LockScreen với đầy đủ keypad và nhãn tiêu đề', () => {
    render(<LockScreen onUnlockSuccess={() => {}} />);
    
    // Kiểm tra tiêu đề chính
    expect(screen.getByText('Last SSH')).toBeInTheDocument();
    expect(screen.getByText('Ứng dụng đã được mã hóa an toàn')).toBeInTheDocument();
    
    // Kiểm tra keypad từ 0-9
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByText(i.toString())).toBeInTheDocument();
    }
  });

  it('nên xử lý sự kiện gõ mã PIN và mở khóa thành công khi nhập đúng PIN', async () => {
    const onUnlockSuccessMock = vi.fn();
    render(<LockScreen onUnlockSuccess={onUnlockSuccessMock} />);

    // Gõ mã PIN đúng: '2026'
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('6'));

    // Chờ securityService.unlockWithPIN được gọi
    await waitFor(() => {
      expect(securityService.unlockWithPIN).toHaveBeenCalledWith('2026');
    });

    // Chờ onUnlockSuccessMock được gọi sau hoạt ảnh mở khóa
    await waitFor(() => {
      expect(onUnlockSuccessMock).toHaveBeenCalledWith({ connections: [], settings: {} });
    }, { timeout: 1000 });
  });

  it('nên rung lắc thông báo lỗi và xóa PIN dots khi nhập sai PIN', async () => {
    render(<LockScreen onUnlockSuccess={() => {}} />);

    // Gõ mã PIN sai: '1111'
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('1'));

    // Chờ xác thực thất bại
    await waitFor(() => {
      expect(securityService.unlockWithPIN).toHaveBeenCalledWith('1111');
    });

    // Hiển thị nhãn báo lỗi
    await waitFor(() => {
      expect(screen.getByText('Mã PIN không chính xác! Vui lòng thử lại.')).toBeInTheDocument();
    });
  });
});
