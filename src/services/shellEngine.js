import { virtualFS } from './virtualFS.js';

const COMMANDS = ['help', 'ls', 'cd', 'pwd', 'mkdir', 'touch', 'cat', 'echo', 'rm', 'clear', 'neofetch', 'theme', 'ssh'];

export class ShellEngine {
  constructor() {
    this.sessionStartTime = Date.now();
  }

  // Phương thức chính để thực thi một dòng lệnh
  execute(currentPath, commandLine, activeTheme = 'Glass Aura') {
    const trimmed = (commandLine || '').trim();
    if (!trimmed) {
      return { stdout: '', stderr: '', newPath: currentPath };
    }

    // Xử lý chuyển hướng ghi đè tệp tin (>) hoặc ghi tiếp (>>)
    let redirectType = null; // 'write' hoặc 'append'
    let redirectFile = null;
    let cmdToExecute = trimmed;

    const appendIndex = trimmed.indexOf('>>');
    const writeIndex = trimmed.indexOf('>');

    if (appendIndex !== -1) {
      redirectType = 'append';
      const parts = trimmed.split('>>');
      cmdToExecute = parts[0].trim();
      redirectFile = parts[1].trim();
    } else if (writeIndex !== -1) {
      redirectType = 'write';
      const parts = trimmed.split('>');
      cmdToExecute = parts[0].trim();
      redirectFile = parts[1].trim();
    }

    // Phân tích lệnh và các đối số
    const args = this.parseArgs(cmdToExecute);
    if (args.length === 0) {
      return { stdout: '', stderr: '', newPath: currentPath };
    }

    const command = args[0].toLowerCase();
    const cmdArgs = args.slice(1);

    // Kiểm tra xem lệnh có hợp lệ không
    if (!COMMANDS.includes(command)) {
      return { 
        stdout: '', 
        stderr: `lastssh: ${command}: command not found. Type 'help' to see available commands.`, 
        newPath: currentPath 
      };
    }

    let result = { stdout: '', stderr: '', newPath: currentPath };

    // Thực thi các lệnh cụ thể
    switch (command) {
      case 'help':
        result = this.cmdHelp();
        break;
      case 'ls':
        result = this.cmdLs(currentPath, cmdArgs);
        break;
      case 'cd':
        result = this.cmdCd(currentPath, cmdArgs);
        break;
      case 'pwd':
        result = this.cmdPwd(currentPath);
        break;
      case 'mkdir':
        result = this.cmdMkdir(currentPath, cmdArgs);
        break;
      case 'touch':
        result = this.cmdTouch(currentPath, cmdArgs);
        break;
      case 'cat':
        result = this.cmdCat(currentPath, cmdArgs);
        break;
      case 'echo':
        result = this.cmdEcho(cmdArgs);
        break;
      case 'rm':
        result = this.cmdRm(currentPath, cmdArgs);
        break;
      case 'clear':
        result = { stdout: '', stderr: '', newPath: currentPath, clear: true };
        break;
      case 'neofetch':
        result = this.cmdNeofetch(activeTheme);
        break;
      case 'theme':
        result = this.cmdTheme(cmdArgs);
        break;
      case 'ssh':
        result = this.cmdSsh(cmdArgs);
        break;
    }

    // Nếu có chuyển hướng đầu ra (redirect > hoặc >>)
    if (redirectFile && !result.stderr && result.stdout) {
      try {
        let finalContent = result.stdout;
        if (redirectType === 'append') {
          let currentContent = '';
          try {
            currentContent = virtualFS.readFile(currentPath, redirectFile);
            if (currentContent && !currentContent.endsWith('\n')) {
              currentContent += '\n';
            }
          } catch (e) {
            // Tệp chưa tồn tại thì ghi mới
          }
          finalContent = currentContent + finalContent;
        }

        virtualFS.writeFile(currentPath, redirectFile, finalContent);
        return { stdout: '', stderr: '', newPath: result.newPath };
      } catch (err) {
        return { stdout: '', stderr: `echo: Không thể ghi vào tệp '${redirectFile}': ${err.message}`, newPath: currentPath };
      }
    }

    return result;
  }

  // Tách đối số hỗ trợ dấu ngoặc kép (ví dụ: echo "hello world")
  parseArgs(commandLine) {
    const args = [];
    let currentArg = '';
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < commandLine.length; i++) {
      const char = commandLine[i];

      if ((char === '"' || char === "'") && (i === 0 || commandLine[i - 1] !== '\\')) {
        if (inQuotes && char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (currentArg) {
          args.push(currentArg);
          currentArg = '';
        }
      } else {
        currentArg += char;
      }
    }

    if (currentArg) {
      args.push(currentArg);
    }

    return args;
  }

  // 1. Lệnh Help
  cmdHelp() {
    const list = [
      'Hệ thống Last SSH v1.0.0 - Các lệnh giả lập được hỗ trợ:',
      '------------------------------------------------------------------',
      '  help                     Hiển thị danh sách trợ giúp này',
      '  ls [đường_dẫn]           Liệt kê thư mục hiện tại hoặc đường dẫn',
      '  cd [thư_mục]             Thay đổi thư mục hiện tại (hỗ trợ .. và /)',
      '  pwd                      Hiển thị thư mục làm việc hiện tại',
      '  mkdir <tên_thư_mục>      Tạo thư mục mới',
      '  touch <tên_file>         Tạo tệp rỗng mới',
      '  cat <tên_file>           Hiển thị nội dung tệp tin',
      '  echo <văn_bản>           Hiển thị văn bản (hỗ trợ redirection: echo text > file)',
      '  rm <tên_mục>             Xóa tệp tin hoặc thư mục',
      '  clear                    Xóa sạch màn hình terminal',
      '  neofetch                 Hiển thị thông số cấu hình hệ thống giả lập',
      '  theme [tên_theme]        Xem các theme hiện có hoặc đổi nhanh theme',
      '  ssh <user>@<host>        Khởi chạy phiên kết nối SSH giả lập',
      '------------------------------------------------------------------'
    ];
    return { stdout: list.join('\n'), stderr: '', newPath: null };
  }

  // 2. Lệnh ls
  cmdLs(currentPath, args) {
    const targetPath = args[0] || '';
    try {
      let resolvedPath = currentPath;
      if (targetPath) {
        const { node, absolutePath } = virtualFS.resolvePath(currentPath, targetPath);
        if (!node) {
          return { stdout: '', stderr: `ls: cannot access '${targetPath}': No such file or directory`, newPath: currentPath };
        }
        if (node.type === 'file') {
          return { stdout: targetPath, stderr: '', newPath: currentPath };
        }
        resolvedPath = absolutePath;
      }

      const items = virtualFS.list(resolvedPath);
      if (items.length === 0) {
        return { stdout: '', stderr: '', newPath: currentPath };
      }

      // Định dạng hiển thị màu sắc: Thư mục có màu Cyan đậm, file có màu bình thường
      const formatted = items.map(item => {
        if (item.type === 'dir') {
          return `\x1b[1;36m${item.name}/\x1b[0m`; // Màu xanh cyan bold
        }
        return `${item.name} (${item.size} bytes)`;
      });

      return { stdout: formatted.join('   '), stderr: '', newPath: currentPath };
    } catch (e) {
      return { stdout: '', stderr: `ls: ${e.message}`, newPath: currentPath };
    }
  }

  // 3. Lệnh cd
  cmdCd(currentPath, args) {
    const targetPath = args[0] || '/home/user';
    try {
      const { node, absolutePath } = virtualFS.resolvePath(currentPath, targetPath);
      if (!node) {
        return { stdout: '', stderr: `cd: no such file or directory: ${targetPath}`, newPath: currentPath };
      }
      if (node.type !== 'dir') {
        return { stdout: '', stderr: `cd: not a directory: ${targetPath}`, newPath: currentPath };
      }
      return { stdout: '', stderr: '', newPath: absolutePath };
    } catch (e) {
      return { stdout: '', stderr: `cd: ${e.message}`, newPath: currentPath };
    }
  }

  // 4. Lệnh pwd
  cmdPwd(currentPath) {
    return { stdout: currentPath, stderr: '', newPath: currentPath };
  }

  // 5. Lệnh mkdir
  cmdMkdir(currentPath, args) {
    if (args.length === 0) {
      return { stdout: '', stderr: 'mkdir: missing operand', newPath: currentPath };
    }
    try {
      virtualFS.mkdir(currentPath, args[0]);
      return { stdout: '', stderr: '', newPath: currentPath };
    } catch (e) {
      return { stdout: '', stderr: `mkdir: ${e.message}`, newPath: currentPath };
    }
  }

  // 6. Lệnh touch
  cmdTouch(currentPath, args) {
    if (args.length === 0) {
      return { stdout: '', stderr: 'touch: missing file operand', newPath: currentPath };
    }
    try {
      virtualFS.writeFile(currentPath, args[0], '');
      return { stdout: '', stderr: '', newPath: currentPath };
    } catch (e) {
      return { stdout: '', stderr: `touch: ${e.message}`, newPath: currentPath };
    }
  }

  // 7. Lệnh cat
  cmdCat(currentPath, args) {
    if (args.length === 0) {
      return { stdout: '', stderr: 'cat: missing file operand', newPath: currentPath };
    }
    try {
      const content = virtualFS.readFile(currentPath, args[0]);
      return { stdout: content, stderr: '', newPath: currentPath };
    } catch (e) {
      return { stdout: '', stderr: `cat: ${e.message}`, newPath: currentPath };
    }
  }

  // 8. Lệnh echo
  cmdEcho(args) {
    return { stdout: args.join(' '), stderr: '', newPath: null };
  }

  // 9. Lệnh rm
  cmdRm(currentPath, args) {
    if (args.length === 0) {
      return { stdout: '', stderr: 'rm: missing operand', newPath: currentPath };
    }
    try {
      virtualFS.rm(currentPath, args[0]);
      return { stdout: '', stderr: '', newPath: currentPath };
    } catch (e) {
      return { stdout: '', stderr: `rm: ${e.message}`, newPath: currentPath };
    }
  }

  // 10. Lệnh neofetch
  cmdNeofetch(activeTheme) {
    const uptimeSec = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    const min = Math.floor(uptimeSec / 60);
    const sec = uptimeSec % 60;
    const uptimeStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`;

    const logo = [
      '    \x1b[1;35m/\\_/\\  \x1b[0m    \x1b[1;36mKienNT@lastssh-web\x1b[0m',
      '   \x1b[1;35m( o.o ) \x1b[0m    -------------------',
      '    \x1b[1;35m> ^ <  \x1b[0m    \x1b[1;33mOS\x1b[0m: Last SSH Web OS v1.0',
      '   \x1b[1;34m/     \\ \x1b[0m    \x1b[1;33mHost\x1b[0m: Gemini-Agent Client v1',
      '  \x1b[1;34m(|     |)\x1b[0m    \x1b[1;33mKernel\x1b[0m: Web-HTML5/React Engine',
      '   \x1b[1;34m===   ===\x1b[0m   \x1b[1;33mUptime\x1b[0m: ${uptimeStr}',
      '  \x1b[1;31m(___)___)\x1b[0m    \x1b[1;33mShell\x1b[0m: LastSSHMockShell v1.0.0',
      '               \x1b[1;33mTheme\x1b[0m: ${activeTheme}',
      '               \x1b[1;33mFont\x1b[0m: Fira Code / Source Code Pro',
      '               \x1b[1;33mCPU\x1b[0m: Simulated Gemini CPU @ 3.5GHz',
      '               \x1b[1;33mMemory\x1b[0m: 4.8GB / 16.0GB (Simulated)'
    ];

    return { stdout: logo.join('\n'), stderr: '', newPath: null };
  }

  // 11. Lệnh theme
  cmdTheme(args) {
    const themes = ['Glass Aura', 'Cyberpunk Neon', 'One Dark Pro', 'Dracula', 'Retro Amber'];
    if (args.length === 0) {
      return { 
        stdout: `Theme hiện tại đang khả dụng:\n${themes.map(t => `  - ${t}`).join('\n')}\n\nGõ 'theme <tên_theme>' để đổi theme nhanh.`, 
        stderr: '', 
        newPath: null 
      };
    }

    const selected = args.join(' ');
    // Tìm kiếm tương đối không phân biệt hoa thường
    const matched = themes.find(t => t.toLowerCase() === selected.toLowerCase());
    if (!matched) {
      return { stdout: '', stderr: `theme: Không tìm thấy theme '${selected}'. Thử lại với: ${themes.join(', ')}`, newPath: null };
    }

    return { stdout: `theme_change:${matched}`, stderr: '', newPath: null };
  }

  // 12. Lệnh ssh
  cmdSsh(args) {
    if (args.length === 0) {
      return { stdout: '', stderr: 'ssh: destination required (e.g. ssh user@host)', newPath: null };
    }

    const dest = args[0];
    if (!dest.includes('@')) {
      return { stdout: '', stderr: 'ssh: invalid destination format. Use: ssh username@hostname', newPath: null };
    }

    return { stdout: `ssh_connect:${dest}`, stderr: '', newPath: null };
  }

  // Tính năng Tự động hoàn thành (Tab Completion)
  autocomplete(currentPath, inputLine) {
    const trimmed = inputLine || '';
    
    // Trường hợp 1: Nếu chưa gõ khoảng trắng nào -> Tìm tên Lệnh
    if (!trimmed.includes(' ')) {
      const partialCmd = trimmed.toLowerCase();
      const matches = COMMANDS.filter(cmd => cmd.startsWith(partialCmd));
      return {
        matches,
        prefix: partialCmd,
        completed: matches.length === 1 ? matches[0] : null
      };
    }

    // Trường hợp 2: Đang gõ lệnh + đối số tệp tin/thư mục
    const lastSpaceIndex = trimmed.lastIndexOf(' ');
    const commandPart = trimmed.slice(0, lastSpaceIndex).trim();
    const partialPath = trimmed.slice(lastSpaceIndex + 1);

    // Xác định thư mục cha của phần tệp đang tìm kiếm
    let searchDir = currentPath;
    let filePrefix = partialPath;

    if (partialPath.includes('/')) {
      const lastSlashIndex = partialPath.lastIndexOf('/');
      const dirPart = partialPath.slice(0, lastSlashIndex) || '/';
      filePrefix = partialPath.slice(lastSlashIndex + 1);

      const { node, absolutePath } = virtualFS.resolvePath(currentPath, dirPart);
      if (node && node.type === 'dir') {
        searchDir = absolutePath;
      } else {
        return { matches: [], prefix: filePrefix, completed: null };
      }
    }

    try {
      const items = virtualFS.list(searchDir);
      const matches = items
        .filter(item => item.name.startsWith(filePrefix))
        .map(item => {
          // Thêm dấu / nếu là thư mục để dễ phân biệt
          const pathSegment = partialPath.includes('/') 
            ? partialPath.slice(0, partialPath.lastIndexOf('/') + 1) + item.name
            : item.name;
          return item.type === 'dir' ? `${pathSegment}/` : pathSegment;
        });

      return {
        matches,
        prefix: partialPath,
        completed: matches.length === 1 ? matches[0] : null
      };
    } catch (e) {
      return { matches: [], prefix: filePrefix, completed: null };
    }
  }
}

export const shellEngine = new ShellEngine();
