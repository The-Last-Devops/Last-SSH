import { useState, useRef, useEffect } from 'react';
import { Terminal, Globe, Plus, X, Copy, Pencil } from 'lucide-react';
import './TabsBar.css';

export default function TabsBar({
  tabs = [],
  activeTabId = '',
  onSelectTab,
  onCloseTab,
  onRenameTab,
  onReorderTabs,
  onNewTab,
  onDuplicateTab,
}) {
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const dragIndexRef = useRef(null);
  const inputRef = useRef(null);
  const contextMenuRef = useRef(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  const handleRenameSubmit = (tabId) => {
    if (renameValue.trim()) onRenameTab(tabId, renameValue.trim());
    setEditingId(null);
  };

  const handleKeyDown = (e, tabId) => {
    if (e.key === 'Enter') handleRenameSubmit(tabId);
    else if (e.key === 'Escape') setEditingId(null);
  };

  const handleContextMenu = (e, tab) => {
    e.preventDefault();
    setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY, tab });
  };

  return (
    // Chrome-like tabstrip: h=36px, tabs sit at bottom (h=28px, mt=4px)
    <div className="chrome-tabstrip">

      {/* ── Tab Home ── */}
      <div
        className={`chrome-tab${activeTabId === 'hosts-dashboard' ? ' chrome-tab--active' : ''}`}
        onClick={() => onSelectTab('hosts-dashboard')}
        id="tab-static-hosts"
        title="Home"
      >
        <span className="chrome-tab__icon">🏠</span>
        <span className="chrome-tab__title">Home</span>
      </div>

      {/* ── SSH / Local tabs ── */}
      {tabs.map((tab, index) => {
        const isActive   = tab.id === activeTabId;
        const isSSH      = tab.type === 'ssh';
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={tab.id}
            className={[
              'chrome-tab',
              isActive   ? 'chrome-tab--active'   : '',
              isDragOver ? 'chrome-tab--dragover'  : '',
            ].join(' ')}
            onClick={() => !editingId && onSelectTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab)}
            onDoubleClick={() => { setEditingId(tab.id); setRenameValue(tab.title); }}
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
              isSSH && tab.connectionProfile
                ? `${tab.title} — ${tab.connectionProfile.username || 'ubuntu'}@${tab.connectionProfile.host}:${tab.connectionProfile.port || 22}`
                : tab.title
            }
          >
            {/* Icon */}
            <span className="chrome-tab__icon">
              {isSSH
                ? <Globe    size={13} />
                : <Terminal size={13} />
              }
            </span>

            {/* Title / Rename input */}
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                className="chrome-tab__rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameSubmit(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="chrome-tab__title">{tab.title}</span>
            )}

            {/* Close button */}
            <button
              className="chrome-tab__close"
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
              title="Close"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}

      {/* ── New Tab button ── */}
      <button className="chrome-new-tab" onClick={onNewTab} title="New tab">
        <Plus size={15} strokeWidth={2} />
      </button>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="chrome-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.tab?.type === 'ssh' && contextMenu.tab?.connectionProfile && (
            <button
              className="chrome-context-menu__item"
              onClick={() => { onDuplicateTab?.(contextMenu.tabId); setContextMenu(null); }}
            >
              <Copy size={14} />
              Duplicate
            </button>
          )}
          <button
            className="chrome-context-menu__item"
            onClick={() => {
              const tab = contextMenu.tab;
              if (tab) { setEditingId(tab.id); setRenameValue(tab.title); onSelectTab(tab.id); }
              setContextMenu(null);
            }}
          >
            <Pencil size={14} />
            Rename
          </button>
          <div className="chrome-context-menu__sep" />
          <button
            className="chrome-context-menu__item chrome-context-menu__item--danger"
            onClick={() => { onCloseTab(contextMenu.tabId); setContextMenu(null); }}
          >
            <X size={14} />
            Close
          </button>
        </div>
      )}
    </div>
  );
}
