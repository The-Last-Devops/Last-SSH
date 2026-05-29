import { useState, useRef, useEffect } from 'react';
import { Terminal, Globe, Plus, X } from 'lucide-react';
import './TabsBar.css';

export default function TabsBar({
  tabs = [],
  activeTabId = '',
  onSelectTab,
  onCloseTab,
  onRenameTab,
  onReorderTabs,
  onNewTab
}) {
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragIndexRef = useRef(null);
  const inputRef = useRef(null);

  // Tập trung con trỏ vào input khi bắt đầu đổi tên
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = (tab) => {
    setEditingId(tab.id);
    setRenameValue(tab.title);
  };

  const handleRenameSubmit = (tabId) => {
    if (renameValue.trim()) {
      onRenameTab(tabId, renameValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e, tabId) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(tabId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // Base tab classes shared by all tabs
  const tabBase = [
    'group',
    'flex items-center',
    'h-[38px] px-3.5',
    'rounded-t-lg',
    'border border-border border-b-0',
    'cursor-grab active:cursor-grabbing',
    'flex-1 min-w-[90px] max-w-[220px]',
    'gap-2',
    'transition-all duration-200',
    'relative mt-2.5',
    'select-none',
    'hover:bg-white/[0.06] hover:border-border-highlight',
  ].join(' ');

  const tabActiveClasses = 'bg-[var(--terminal-bg)] border-border-highlight border-b-2 border-b-accent z-[2] shadow-[0_-4px_10px_rgba(0,0,0,0.3)]';
  const tabInactiveClasses = 'bg-white/[0.02]';

  const dragOverClasses = 'border-l-2 border-l-accent bg-accent/5';

  return (
    <div className="tabs-bar-container flex items-center flex-1 overflow-x-auto overflow-y-visible h-full pl-2 gap-1">
      {/* Tab cố định Hosts */}
      <div
        className={[
          tabBase,
          'shrink-0',
          activeTabId === 'hosts-dashboard' ? tabActiveClasses : tabInactiveClasses,
        ].join(' ')}
        onClick={() => onSelectTab('hosts-dashboard')}
        title="Hosts Dashboard"
        id="tab-static-hosts"
      >
        <span className="text-xs font-medium text-text-main whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1">
          🖥️ Hosts
        </span>
      </div>

      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isSSH = tab.type === 'ssh';
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={tab.id}
            className={[
              tabBase,
              isActive ? tabActiveClasses : tabInactiveClasses,
              isDragOver ? dragOverClasses : '',
            ].join(' ')}
            onClick={() => !editingId && onSelectTab(tab.id)}
            draggable
            onDragStart={() => { dragIndexRef.current = index; }}
            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
                onReorderTabs?.(dragIndexRef.current, index);
              }
              dragIndexRef.current = null;
              setDragOverIndex(null);
            }}
            onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
            title={
              tab.type === 'ssh' && tab.connectionProfile
                ? `${tab.title} — ${tab.connectionProfile.username || 'ubuntu'}@${tab.connectionProfile.host}:${tab.connectionProfile.port || 22}`
                : tab.title
            }
          >
            {/* Tab Icon based on Type */}
            {isSSH ? (
              <Globe size={14} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
            ) : (
              <Terminal size={14} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
            )}

            {/* Tab Title / Rename Input */}
            <div
              className="flex-1 min-w-0 flex items-center"
              onDoubleClick={() => handleDoubleClick(tab)}
            >
              {editingId === tab.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="tab-rename-input w-full bg-black/40 border border-accent rounded text-text-bright text-xs px-1.5 py-0.5 outline-none font-[inherit]"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameSubmit(tab.id)}
                  onKeyDown={(e) => handleKeyDown(e, tab.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className={`text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis ${isActive ? 'text-text-bright font-semibold' : 'text-text-main'}`}>
                  {tab.title}
                </span>
              )}
            </div>

            {/* Close Button */}
            <button
              className="opacity-50 group-hover:opacity-100 ml-1 flex items-center justify-center w-4 h-4 rounded text-text-muted hover:bg-[rgba(255,85,98,0.15)] hover:text-term-red transition-all shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Close Tab"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* Inline Add Button '+' */}
      <button
        className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.03] border border-border text-text-muted hover:bg-accent/15 hover:border-accent hover:text-text-bright transition-all shrink-0 mt-2.5 ml-2 cursor-pointer"
        onClick={onNewTab}
        title="Open New Local Terminal"
        id="btn-new-local"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
