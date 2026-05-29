import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@fontsource-variable/fira-code'
import '@fontsource-variable/source-code-pro'
import './index.css'
import App from './App.jsx'

const loadTime = performance.now() - window.__APP_START_TIME__;
console.log(`🕒 [2/4] main.jsx: Đã import xong các module React và CSS. Mất: ${loadTime.toFixed(1)}ms`);
console.time('🕒 [3/4] React: Thời gian khởi tạo DOM (createRoot)');

// Không dùng StrictMode để tránh double-invoke useEffect
// (StrictMode gây connectSSH chạy 2 lần → kill connection đang bắt tay → ECONNRESET)
createRoot(document.getElementById('root')).render(
  <App />
)
