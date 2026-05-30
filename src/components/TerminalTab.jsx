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
  // api: Electron IPC hoặc WebSocket adapter — cả hai đều có cùng interface
  const api = (typeof window !== 'undefined') ? (window.electronAPI ?? window.webAPI ?? null) : null;
  const isDesktop = !!api;

  // --------------------------------------------------------------------------
  // ENGINE 1: DUAL ENGINE DESKTOP APP (Xterm.js + Electron SSH2 thật)
  // --------------------------------------------------------------------------
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const connectionActiveRef = useRef(false); // Guard chống double-connect
  const resizeObserverRef = useRef(null);

  // Map settings.terminalTheme → xterm color palette
  const getXtermTheme = (themeName) => {
    if (themeName === 'Light') {
      return {
        background: '#fafafa',
        foreground: '#383a42',
        cursor: '#383a42',
        cursorAccent: '#fafafa',
        selectionBackground: 'rgba(56, 58, 66, 0.15)',
        black: '#383a42', red: '#e45649', green: '#50a14f',
        yellow: '#c18401', blue: '#4078f2', magenta: '#a626a4',
        cyan: '#0184bc', white: '#a0a1a7',
        brightBlack: '#696c77', brightRed: '#e45649', brightGreen: '#50a14f',
        brightYellow: '#986801', brightBlue: '#4078f2', brightMagenta: '#a626a4',
        brightCyan: '#0184bc', brightWhite: '#383a42'
      };
    }
    // Default: neutral dark (Dark theme)
    return {
      background: '#1c1c1c',
      foreground: '#e8e8e8',
      cursor: '#e8e8e8',
      cursorAccent: '#1c1c1c',
      selectionBackground: 'rgba(100, 120, 200, 0.35)',
      black: '#1c1c1c', red: '#ff5c57', green: '#5af78e',
      yellow: '#f3f99d', blue: '#57c7ff', magenta: '#ff6ac1',
      cyan: '#9aedfe', white: '#f1f1f0',
      brightBlack: '#686868', brightRed: '#ff6e67', brightGreen: '#5af78e',
      brightYellow: '#f4f99d', brightBlue: '#6fc5ff', brightMagenta: '#ff92d0',
      brightCyan: '#9aedfe', brightWhite: '#ffffff'
    };
  };

  // Cập nhật màu terminal khi settings.terminalTheme thay đổi
  useEffect(() => {
    const term = terminalInstanceRef.current;
    if (!term) return;
    term.options.theme = getXtermTheme(settings.terminalTheme);
  }, [settings.terminalTheme]);

  useEffect(() => {
    // Chỉ kích hoạt terminal thật nếu chạy trong Electron Desktop App và tab là SSH hoặc LOCAL
    if (!isDesktop || !xtermRef.current || (tab.type !== 'ssh' && tab.type !== 'local')) return;
    // Guard: tránh double-connect do React StrictMode hoặc re-render
    if (connectionActiveRef.current) return;
    connectionActiveRef.current = true;

    // Khởi tạo Xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Menlo", "Fira Code", "Cascadia Code", "Courier New", monospace',
      fontSize: settings.fontSize || 13,
      fontWeight: 'normal',
      lineHeight: 1.3,
      letterSpacing: 0,
      cursorStyle: settings.cursorStyle || 'block',
      theme: getXtermTheme(settings.terminalTheme)
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(xtermRef.current);
    terminalInstanceRef.current = term;

    // Delay fit để đợi DOM render xong kích thước thật
    const fitSafely = () => {
      try {
        if (xtermRef.current && xtermRef.current.offsetWidth > 0 && xtermRef.current.offsetHeight > 0) {
          fitAddon.fit();
          // Sau khi fit, notify server về kích thước thật để top/vim hiển đúng
          const { cols, rows } = term;
          if (cols > 0 && rows > 0) {
            if (tab.type === 'ssh') {
              api.resizeSSH({ tabId: tab.id, cols, rows });
            } else if (tab.type === 'local') {
              api.resizeLocal({ tabId: tab.id, cols, rows });
            }
          }
        }
      } catch {
        // ignore - có thể xảy ra khi component unmount giữa chừng
      }
    };

    // ResizeObserver để xử lý khi pane nội dung thay đổi kích thước (ví dụ: mở/đóng SFTP)
    const resizeObserver = new ResizeObserver(() => {
      fitSafely();
    });
    resizeObserver.observe(xtermRef.current);
    resizeObserverRef.current = resizeObserver;

    let fitTimeout1 = null;
    let fitTimeout2 = null;
    const scheduleFit = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitSafely();
        });
      });
      fitTimeout1 = window.setTimeout(fitSafely, 120);
      fitTimeout2 = window.setTimeout(fitSafely, 320);
    };

    scheduleFit();

    let removeDataListener = () => {};
    let removeCloseListener = () => {};

    // Đăng ký luồng nhận dữ liệu từ Electron truyền lên
    if (tab.type === 'ssh') {
      let shellSizeConfirmed = false;
      removeDataListener = api.onSSHData((payload) => {
        if (payload.tabId === tab.id) {
          term.write(payload.data);
          // Khi nhận data đầu tiên, shell đã sẵn sàng — gửi lại kích thước thực tế
          if (!shellSizeConfirmed) {
            shellSizeConfirmed = true;
            const { cols, rows } = term;
            if (cols > 0 && rows > 0) {
              api.resizeSSH({ tabId: tab.id, cols, rows });
            }
          }
        }
      });

      // Lắng nghe đóng kết nối SSH
      removeCloseListener = api.onSSHClose((closedTabId) => {
        if (closedTabId === tab.id) {
          term.write('\r\n\x1b[1;31m[SSH] Kết nối bị đóng bởi server từ xa.\x1b[0m\r\n');
        }
      });
    } else if (tab.type === 'local') {
      removeDataListener = api.onLocalData((payload) => {
        if (payload.tabId === tab.id) {
          term.write(payload.data);
        }
      });

      removeCloseListener = api.onLocalClose((closedTabId) => {
        if (closedTabId === tab.id) {
          term.write('\r\n\x1b[1;31m[Local shell đã đóng]\x1b[0m\r\n');
        }
      });
    }

    // Đăng ký luồng gõ phím từ Xterm gửi xuống Electron qua IPC
    const onDataDisposable = term.onData((data) => {
      if (tab.type === 'ssh') {
        api.writeSSHData(tab.id, data);
      } else if (tab.type === 'local') {
        api.writeLocalData(tab.id, data);
      }
    });

    // Kết nối đến SSH hoặc Local shell thật
    if (tab.type === 'ssh') {
      api.connectSSH(tab.connectionProfile);
    } else if (tab.type === 'local') {
      api.connectLocalShell({ tabId: tab.id });
    }

    // Xử lý co giãn terminal khi thay đổi kích thước cửa sổ
    const handleResize = () => {
      fitSafely();
    };
    window.addEventListener('resize', handleResize);

    // Focus tự động vào Xterm
    term.focus();

    return () => {
      connectionActiveRef.current = false; // Reset guard khi unmount
      window.removeEventListener('resize', handleResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (fitTimeout1) {
        window.clearTimeout(fitTimeout1);
      }
      if (fitTimeout2) {
        window.clearTimeout(fitTimeout2);
      }
      onDataDisposable.dispose();
      removeDataListener();
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
    if (isDesktop && (tab.type === 'ssh' || tab.type === 'local')) {
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
    if (isDesktop && (tab.type === 'ssh' || tab.type === 'local')) return;
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
  if (isDesktop && (tab.type === 'ssh' || tab.type === 'local')) {
    return (
      <div
        ref={xtermRef}
        className="xterm-terminal-container"
        onClick={handleContainerClick}
        style={{ background: getXtermTheme(settings.terminalTheme).background }}
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
        <div className="terminal-line type-system mt-2 opacity-80">
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
