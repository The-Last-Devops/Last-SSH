import { spawn } from 'child_process';
import path from 'path';

// Khởi chạy Vite
const vite = spawn('npm', ['run', 'dev'], { 
  stdio: 'inherit',
  shell: true 
});

let electron = null;

// Đợi Vite khởi động (1 giây) rồi chạy Electron
setTimeout(() => {
  const electronPath = path.join(process.cwd(), 'node_modules', '.bin', 'electron');
  electron = spawn(electronPath, ['.'], {
    stdio: 'inherit'
  });

  electron.on('exit', () => {
    vite.kill();
    process.exit(0);
  });
}, 1000);

// Bắt tín hiệu Ctrl+C từ terminal
let isShuttingDown = false;
const handleQuit = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[Dev] Đang đóng ứng dụng an toàn và lưu dữ liệu...');
  
  if (electron) {
    // Gửi SIGTERM thay vì SIGINT để Electron có thể bắt và chạy app.quit()
    electron.kill('SIGTERM');
    
    // Ép thoát nếu Electron bị treo sau 5 giây
    setTimeout(() => {
      vite.kill();
      process.exit(0);
    }, 5000);
  } else {
    vite.kill();
    process.exit(0);
  }
};

process.on('SIGINT', handleQuit);
process.on('SIGTERM', handleQuit);
