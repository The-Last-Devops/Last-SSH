// storageService.js
// Drop-in wrapper cho localStorage.
// Trong Electron: mỗi write đồng thời ghi vào file JSON trên disk qua IPC (không phụ thuộc Chromium flush).
// Trong browser/test: dùng localStorage thuần.
// Reads vẫn dùng localStorage (sync) — init() seed dữ liệu từ file vào localStorage khi khởi động.

const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI?.store;

export const storageService = {
  async init() {
    if (!isElectron()) return;
    try {
      const all = await window.electronAPI.store.getAll();
      for (const [key, value] of Object.entries(all)) {
        if (value !== null && value !== undefined) {
          localStorage.setItem(key, value);
        }
      }
    } catch (e) {
      console.error('[storageService] init failed:', e);
    }
  },

  setItem(key, value) {
    localStorage.setItem(key, value);
    if (isElectron()) {
      window.electronAPI.store.set(key, value).catch(console.error);
    }
  },

  removeItem(key) {
    localStorage.removeItem(key);
    if (isElectron()) {
      window.electronAPI.store.remove(key).catch(console.error);
    }
  },

  getItem(key) {
    return localStorage.getItem(key);
  },
};
