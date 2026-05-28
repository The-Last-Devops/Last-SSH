import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Không dùng StrictMode để tránh double-invoke useEffect
// (StrictMode gây connectSSH chạy 2 lần → kill connection đang bắt tay → ECONNRESET)
createRoot(document.getElementById('root')).render(
  <App />
)
