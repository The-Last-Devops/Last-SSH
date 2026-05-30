// storageService.js
// Drop-in wrapper cho localStorage.
// Electron: write vào file JSON qua IPC.
// Web: write qua WebSocket server (window.webAPI).
// Browser/test: chỉ dùng localStorage.

function getBackendStore() {
  if (typeof window === 'undefined') return null;
  return window.electronAPI?.store ?? window.webAPI?.store ?? null;
}

export const storageService = {
  async init() {
    const store = getBackendStore();
    if (!store) return;
    try {
      const all = await store.getAll();
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
    const store = getBackendStore();
    if (store) store.set(key, value).catch(console.error);
  },

  removeItem(key) {
    localStorage.removeItem(key);
    const store = getBackendStore();
    if (store) store.remove(key).catch(console.error);
  },

  getItem(key) {
    return localStorage.getItem(key);
  },
};
