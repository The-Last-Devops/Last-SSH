import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Globe, Plus, X } from 'lucide-react';
import './TabsBar.css';

export default function TabsBar({
  tabs = [],
  activeTabId = '',
  onSelectTab,
  onCloseTab,
  onRenameTab,
  onNewTab
}) {
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
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

  return (
    <div className="tabs-bar-container">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const isSSH = tab.type === 'ssh';

        return (
          <div 
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => !editingId && onSelectTab(tab.id)}
            title="Double click to rename"
          >
            {/* Tab Icon based on Type */}
            {isSSH ? (
              <Globe size={14} className="tab-icon" />
            ) : (
              <Terminal size={14} className="tab-icon" />
            )}

            {/* Tab Title / Rename Input */}
            <div 
              className="tab-title-wrapper"
              onDoubleClick={() => handleDoubleClick(tab)}
            >
              {editingId === tab.id ? (
                <input 
                  ref={inputRef}
                  type="text"
                  className="tab-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameSubmit(tab.id)}
                  onKeyDown={(e) => handleKeyDown(e, tab.id)}
                  onClick={(e) => e.stopPropagation()} // Không kích hoạt chọn tab
                />
              ) : (
                <span className="tab-title-text">{tab.title}</span>
              )}
            </div>

            {/* Close Button */}
            <button 
              className="tab-close-btn"
              onClick={(e) => {
                e.stopPropagation(); // Không kích hoạt chọn tab khi bấm đóng
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
        className="tab-add-btn"
        onClick={onNewTab}
        title="Open New Local Terminal"
        id="btn-add-tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
