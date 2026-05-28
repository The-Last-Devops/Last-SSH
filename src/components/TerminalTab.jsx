import { useState, useRef, useEffect } from 'react';
import { shellEngine } from '../services/shellEngine.js';
import { sshSimulator } from '../services/sshSimulator.js';
import './TerminalTab.css';

// Thư viện Terminal chuẩn cho SSH thật
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// Custom ANSI color parser (Dùng cho Simulated Engine)
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
  const isDesktop = typeof window !== 'undefined' && window.electronAPI !== undefined;

  // --------------------------------------------------------------------------
  // ENGINE 1: DUAL ENGINE DESKTOP APP (Xterm.js + Electron SSH2 thật)
  // --------------------------------------------------------------------------
  const xtermRef = useRef(null);
  const terminalInstanceRef = useRef(null);

  useEffect(() => {
    // Chỉ kích hoạt SSH thật nếu chạy trong Electron Desktop App và tab là SSH
    if (!isDesktop || !xtermRef.current || tab.type !== 'ssh') return;

    // Khởi tạo Xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: settings.fontFamily || 'Fira Code',
      fontSize: settings.fontSize || 14,
      cursorStyle: settings.cursorStyle || 'block',
      theme: {
        background: '#1a1e29', // Termius Dark theme màu nền
        foreground: '#e1e6eb',
        cursor: '#007eff',
        selectionBackground: 'rgba(0, 126, 255, 0.3)'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(xtermRef.current);
    fitAddon.fit();
    terminalInstanceRef.current = term;

    // Đăng ký luồng nhận dữ liệu từ Electron truyền lên
    const removeSSHListener = window.electronAPI.onSSHData((data) => {
      term.write(data);
    });

    // Lắng nghe đóng kết nối SSH
    const removeCloseListener = window.electronAPI.onSSHClose(() => {
      term.write('\r\n\x1b[1;31m[SSH] Kết nối bị đóng bởi server từ xa.\x1b[0m\r\n');
    });

    // Đăng ký luồng gõ phím từ Xterm gửi xuống Electron qua IPC
    const onDataDisposable = term.onData((data) => {
      window.electronAPI.writeSSHData(data);
    });

    // Kích hoạt bắt tay kết nối SSH thật
    // Lấy thông tin connection profile bao gồm cả nội dung Key nếu có
    window.electronAPI.connectSSH(tab.connectionProfile);

    // Xử lý co giãn terminal khi thay đổi kích thước cửa sổ
    const handleResize = () => {
      if (fitAddon) {
        try {
          fitAddon.fit();
        } catch (e) {
          console.error("Lỗi resize terminal:", e);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // Focus tự động vào Xterm
    term.focus();

    return () => {
      window.removeEventListener('resize', handleResize);
      onDataDisposable.dispose();
      removeSSHListener();
      removeCloseListener();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, isDesktop, tab.type]);

  // --------------------------------------------------------------------------
  // ENGINE 2: SIMULATED ENGINE (Dành cho Local Shell hoặc Web Browser thường / E2E Test)
  // --------------------------------------------------------------------------
  const [inputValue, setInputValue] = useState('');
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  const handleContainerClick = () => {
    if (isDesktop && tab.type === 'ssh') {
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.focus();
      }
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      return;
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    if (isDesktop && tab.type === 'ssh') return;
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab.history, inputValue, isDesktop, tab.type]);

  useEffect(() => {
    handleContainerClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id]);

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
    return (
      <span className="terminal-prompt">
        user@lastssh:{tab.currentPath} $
      </span>
    );
  };

  const handleKeyDown = async (e) => {
    const commandHistory = tab.commandHistory || [];
    
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = inputValue;
      setInputValue('');
      setHistoryPointer(-1);
      setAutocompleteSuggestions(null);

      if (!cmd.trim()) {
        const newHistory = [...tab.history, { type: 'input', text: '', prompt: renderPrompt() }];
        onUpdateTab(tab.id, { history: newHistory });
        return;
      }

      const newCmdHistory = [...commandHistory];
      if (newCmdHistory[newCmdHistory.length - 1] !== cmd) {
        newCmdHistory.push(cmd);
      }

      let newHistory = [...tab.history, { type: 'input', text: cmd, prompt: renderPrompt() }];

      if (tab.type === 'ssh') {
        const res = sshSimulator.executeCommand(tab.id, cmd);
        
        if (res.exit) {
          sshSimulator.closeSession(tab.id);
          newHistory.push({ type: 'system', text: '\r\n[SSH] Connection closed by remote host.' });
          
          onUpdateTab(tab.id, {
            type: 'local',
            title: `Local terminal`,
            currentPath: '/home/user',
            history: newHistory,
            commandHistory: newCmdHistory
          });
          onSwitchToSFTP(tab.id, false);
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
        const res = shellEngine.execute(tab.currentPath, cmd, settings.terminalTheme || settings.appTheme || 'Glass Aura');

        if (res.clear) {
          onUpdateTab(tab.id, {
            history: [],
            commandHistory: newCmdHistory
          });
          return;
        }

        if (res.stdout && res.stdout.startsWith('theme_change:')) {
          const themeName = res.stdout.split(':')[1];
          newHistory.push({ type: 'system', text: `Đã đổi theme sang '${themeName}'` });
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('change-theme-cmd', { detail: themeName }));
          }
        }
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
            commandHistory: newCmdHistory,
            connectionProfile: mockProfile
          });
          onSwitchToSFTP(tab.id, true);
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
    
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      const newPointer = historyPointer === -1 
        ? commandHistory.length - 1 
        : Math.max(0, historyPointer - 1);
      
      setHistoryPointer(newPointer);
      setInputValue(commandHistory[newPointer]);
    }
    
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
    
    else if (e.key === 'Tab') {
      e.preventDefault();
      let suggestions = shellEngine.autocomplete(tab.currentPath, inputValue);

      if (suggestions.completed) {
        const lastSpace = inputValue.lastIndexOf(' ');
        const completedText = lastSpace === -1 
          ? suggestions.completed 
          : inputValue.slice(0, lastSpace + 1) + suggestions.completed;
        
        setInputValue(completedText);
        setAutocompleteSuggestions(null);
      } else if (suggestions.matches.length > 1) {
        setAutocompleteSuggestions(suggestions.matches);
      }
    }
  };

  const getFontFamilyClass = () => {
    switch (settings.fontFamily) {
      case 'Fira Code': return 'font-firacode';
      case 'Source Code Pro': return 'font-sourcecode';
      default: return 'font-courier';
    }
  };

  const getCursorClass = () => {
    switch (settings.cursorStyle) {
      case 'underline': return 'cursor-blink-underline';
      case 'bar': return 'cursor-blink-bar';
      default: return 'cursor-blink-block';
    }
  };

  const terminalThemeClass = `theme-${(settings.terminalTheme || 'Glass Aura').toLowerCase().replace(/ /g, '-')}`;

  // --------------------------------------------------------------------------
  // RENDER DUAL ENGINES
  // --------------------------------------------------------------------------
  if (isDesktop && tab.type === 'ssh') {
    return (
      <div 
        ref={xtermRef} 
        className="xterm-terminal-container" 
        onClick={handleContainerClick}
        style={{
          width: '100%',
          height: '100%',
          padding: '10px',
          background: '#1a1e29',
          overflow: 'hidden'
        }}
      />
    );
  }

  return (
    <div 
      className={`terminal-container ${terminalThemeClass} ${settings.crtEnabled ? 'crt-effect crt-flicker' : ''} ${getFontFamilyClass()}`}
      onClick={handleContainerClick}
      ref={containerRef}
      style={{ fontSize: `${settings.fontSize || 14}px` }}
    >
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

      {autocompleteSuggestions && (
        <div className="terminal-line type-system" style={{ marginTop: '8px', opacity: 0.8 }}>
          Gợi ý: {autocompleteSuggestions.join('   ')}
        </div>
      )}

      <div className="terminal-input-row">
        {renderPrompt()}
        <span className="terminal-input-display">
          {inputValue}
          <span className={getCursorClass()} />
        </span>
      </div>

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
