import { useState, useRef, useEffect } from 'react';
import { shellEngine } from '../services/shellEngine.js';
import { sshSimulator } from '../services/sshSimulator.js';
import './TerminalTab.css';

// Custom ANSI color parser
function parseAnsi(text) {
  if (typeof text !== 'string') return text;
  
  // eslint-disable-next-line no-control-regex
  const regex = /\x1b\[([0-9;]+)m/g;
  let match;
  let lastIndex = 0;
  const spans = [];
  let currentClass = '';

  while ((match = regex.exec(text)) !== null) {
    const rawText = text.slice(lastIndex, match.index);
    if (rawText) {
      spans.push(<span key={lastIndex} className={currentClass}>{rawText}</span>);
    }

    const code = match[1];
    if (code === '0') {
      currentClass = '';
    } else if (code === '1;36') {
      currentClass = 'ansi-bold ansi-cyan';
    } else if (code === '1;33') {
      currentClass = 'ansi-bold ansi-yellow';
    } else if (code === '1;32') {
      currentClass = 'ansi-bold ansi-green';
    } else if (code === '1;34') {
      currentClass = 'ansi-bold ansi-blue';
    } else if (code === '1;35') {
      currentClass = 'ansi-bold ansi-magenta';
    } else if (code === '1;31') {
      currentClass = 'ansi-bold ansi-red';
    } else if (code === '1;30') {
      currentClass = 'ansi-bold ansi-white';
    }
    lastIndex = regex.lastIndex;
  }

  const remainingText = text.slice(lastIndex);
  if (remainingText) {
    spans.push(<span key={lastIndex} className={currentClass}>{remainingText}</span>);
  }

  return spans.length > 0 ? spans : text;
}

export default function TerminalTab({
  tab,
  settings,
  onUpdateTab,
  onSwitchToSFTP
}) {
  const [inputValue, setInputValue] = useState('');
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  // Tập trung vào input khi click vào container
  const handleContainerClick = () => {
    // Nếu người dùng đang bôi đen (chọn text), giữ nguyên lựa chọn và không ép focus làm mất selection
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      return;
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Tự động cuộn xuống cuối khi có log mới hoặc thay đổi input
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab.history, inputValue]);

  // Luôn lấy focus khi chuyển tab
  useEffect(() => {
    handleContainerClick();
  }, [tab.id]);

  // Sinh prompt hiển thị dòng lệnh
  const renderPrompt = () => {
    if (tab.type === 'ssh') {
      const session = sshSimulator.getSession(tab.id);
      if (session) {
        return (
          <span className="terminal-prompt ssh-prompt">
            {session.username}@{session.host}:{session.currentPath} $
          </span>
        );
      }
    }
    
    // Mặc định là Local Shell
    return (
      <span className="terminal-prompt">
        user@lastssh:{tab.currentPath} $
      </span>
    );
  };

  // Xử lý phím đặc biệt (Enter, Up, Down, Tab)
  const handleKeyDown = async (e) => {
    const commandHistory = tab.commandHistory || [];
    
    // 1. Phím Enter - Thực thi lệnh
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = inputValue;
      setInputValue('');
      setHistoryPointer(-1);
      setAutocompleteSuggestions(null);

      if (!cmd.trim()) {
        // Gõ Enter trống -> chỉ xuống dòng
        const newHistory = [...tab.history, { type: 'input', text: '', prompt: renderPrompt() }];
        onUpdateTab(tab.id, { history: newHistory });
        return;
      }

      // Lưu lệnh vào lịch sử (không lưu trùng lệnh gần nhất)
      const newCmdHistory = [...commandHistory];
      if (newCmdHistory[newCmdHistory.length - 1] !== cmd) {
        newCmdHistory.push(cmd);
      }

      // Đẩy lệnh vừa gõ vào dòng hiển thị
      let newHistory = [...tab.history, { type: 'input', text: cmd, prompt: renderPrompt() }];

      // Thực thi lệnh dựa trên loại phiên tab (Local vs SSH)
      if (tab.type === 'ssh') {
        const res = sshSimulator.executeCommand(tab.id, cmd);
        
        if (res.exit) {
          // Thoát SSH
          sshSimulator.closeSession(tab.id);
          newHistory.push({ type: 'system', text: '\r\n[SSH] Connection closed by remote host.' });
          
          onUpdateTab(tab.id, {
            type: 'local',
            title: `Local terminal`,
            currentPath: '/home/user',
            history: newHistory,
            commandHistory: newCmdHistory
          });
          onSwitchToSFTP(tab.id, false); // Đóng bảng SFTP
          return;
        }

        if (res.stdout) newHistory.push({ type: 'output', text: res.stdout });
        if (res.stderr) newHistory.push({ type: 'error', text: res.stderr });

        onUpdateTab(tab.id, {
          history: newHistory,
          commandHistory: newCmdHistory,
          currentPath: res.newPath
        });

      } else {
        // Lệnh Local Shell
        const res = shellEngine.execute(tab.currentPath, cmd, settings.terminalTheme || settings.appTheme || 'Glass Aura');

        if (res.clear) {
          onUpdateTab(tab.id, {
            history: [],
            commandHistory: newCmdHistory
          });
          return;
        }

        // Xử lý đổi theme nhanh qua dòng lệnh 'theme <name>'
        if (res.stdout && res.stdout.startsWith('theme_change:')) {
          const themeName = res.stdout.split(':')[1];
          // Gọi cấu hình theme thông qua settings (ta giả lập bằng callback)
          newHistory.push({ type: 'system', text: `Đã đổi theme sang '${themeName}'` });
          // Cập nhật state ở App
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('change-theme-cmd', { detail: themeName }));
          }
        }
        // Xử lý lệnh 'ssh' kết nối SSH
        else if (res.stdout && res.stdout.startsWith('ssh_connect:')) {
          const dest = res.stdout.split(':')[1];
          const [username, host] = dest.split('@');
          
          const mockProfile = { label: host, host, username, port: '22' };
          const session = sshSimulator.createSession(tab.id, mockProfile);
          
          newHistory.push({ type: 'system', text: `\r\nStarting SSH connection...` });
          session.logs.forEach(log => {
            newHistory.push({ type: 'output', text: log });
          });

          onUpdateTab(tab.id, {
            type: 'ssh',
            title: `ssh: ${host}`,
            currentPath: `/home/${username}`,
            history: newHistory,
            commandHistory: newCmdHistory
          });
          onSwitchToSFTP(tab.id, true); // Mở bảng SFTP visual
          return;
        } else {
          if (res.stdout) newHistory.push({ type: 'output', text: res.stdout });
          if (res.stderr) newHistory.push({ type: 'error', text: res.stderr });
        }

        onUpdateTab(tab.id, {
          currentPath: res.newPath,
          history: newHistory,
          commandHistory: newCmdHistory
        });
      }
    }
    
    // 2. Phím Lên - Xem lệnh cũ hơn
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      const newPointer = historyPointer === -1 
        ? commandHistory.length - 1 
        : Math.max(0, historyPointer - 1);
      
      setHistoryPointer(newPointer);
      setInputValue(commandHistory[newPointer]);
    }
    
    // 3. Phím Xuống - Xem lệnh mới hơn
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0 || historyPointer === -1) return;

      if (historyPointer === commandHistory.length - 1) {
        setHistoryPointer(-1);
        setInputValue('');
      } else {
        const newPointer = historyPointer + 1;
        setHistoryPointer(newPointer);
        setInputValue(commandHistory[newPointer]);
      }
    }
    
    // 4. Phím Tab - Gợi ý/Tự động hoàn thành
    else if (e.key === 'Tab') {
      e.preventDefault();
      let suggestions;
      if (tab.type === 'ssh') {
        // Với SSH, chúng ta dùng bộ mock autocomplete đơn giản của shellEngine dựa trên currentPath ảo
        suggestions = shellEngine.autocomplete(tab.currentPath, inputValue);
      } else {
        suggestions = shellEngine.autocomplete(tab.currentPath, inputValue);
      }

      if (suggestions.completed) {
        // Có gợi ý duy nhất -> Tự hoàn thành luôn
        const lastSpace = inputValue.lastIndexOf(' ');
        const completedText = lastSpace === -1 
          ? suggestions.completed 
          : inputValue.slice(0, lastSpace + 1) + suggestions.completed;
        
        setInputValue(completedText);
        setAutocompleteSuggestions(null);
      } else if (suggestions.matches.length > 1) {
        // Nhiều gợi ý -> In ra danh sách để người dùng lựa chọn
        setAutocompleteSuggestions(suggestions.matches);
      }
    }
  };

  // Định cấu hình font chữ động
  const getFontFamilyClass = () => {
    switch (settings.fontFamily) {
      case 'Fira Code': return 'font-firacode';
      case 'Source Code Pro': return 'font-sourcecode';
      default: return 'font-courier';
    }
  };

  // Xác định Class cho Cursor nhấp nháy
  const getCursorClass = () => {
    switch (settings.cursorStyle) {
      case 'underline': return 'cursor-blink-underline';
      case 'bar': return 'cursor-blink-bar';
      default: return 'cursor-blink-block';
    }
  };

  const terminalThemeClass = `theme-${(settings.terminalTheme || 'Glass Aura').toLowerCase().replace(/ /g, '-')}`;

  return (
    <div 
      className={`terminal-container ${terminalThemeClass} ${settings.crtEnabled ? 'crt-effect crt-flicker' : ''} ${getFontFamilyClass()}`}
      onClick={handleContainerClick}
      ref={containerRef}
      style={{ fontSize: `${settings.fontSize || 14}px` }}
    >
      {/* Cây lịch sử dòng lệnh */}
      <div className="terminal-history">
        {tab.history.map((line, idx) => {
          if (line.type === 'input') {
            return (
              <div key={idx} className="terminal-line type-input">
                {line.prompt}
                <span>{line.text}</span>
              </div>
            );
          }
          return (
            <div 
              key={idx} 
              className={`terminal-line type-${line.type} selectable`}
            >
              {parseAnsi(line.text)}
            </div>
          );
        })}
      </div>

      {/* Dòng autocomplete nếu có nhiều gợi ý */}
      {autocompleteSuggestions && (
        <div className="terminal-line type-system" style={{ marginTop: '8px', opacity: 0.8 }}>
          Gợi ý: {autocompleteSuggestions.join('   ')}
        </div>
      )}

      {/* Dòng nhập liệu hiện tại */}
      <div className="terminal-input-row">
        {renderPrompt()}
        <span className="terminal-input-display">
          {inputValue}
          <span className={getCursorClass()} />
        </span>
      </div>

      {/* Hộp input ẩn để nhận sự kiện gõ bàn phím */}
      <input 
        ref={inputRef}
        type="text" 
        className="terminal-hidden-input"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setAutocompleteSuggestions(null);
        }}
        onKeyDown={handleKeyDown}
        autoFocus
      />

      <div ref={endRef} />
    </div>
  );
}
