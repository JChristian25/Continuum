import { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileCode2,
  GitCommit,
  GitBranch,
  Copy,
  Check,
  ChevronDown,
  X,
  Search,
  Code2,
  History,
  Sparkles,
  WrapText,
  ListTree
} from 'lucide-react';
import { Menu } from '@base-ui/react/menu';
import Tooltip from './Tooltip.jsx';
import { REPO_FILES } from '../data/repoFiles.js';
import { Button, Input, Tabs, TabsList, TabsTrigger, Dialog, DialogContent } from './ui/index.js';

export default function CodeExplorerModal({ isOpen, onClose, initialFile = 'src/bbb.py' }) {
  const [userSelectedFile, setUserSelectedFile] = useState(null);
  const selectedFile = (userSelectedFile && REPO_FILES[userSelectedFile])
    ? userSelectedFile
    : (initialFile && REPO_FILES[initialFile] ? initialFile : 'src/bbb.py');

  const [showSymbols, setShowSymbols] = useState(true);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'blame'
  const [activeLine, setActiveLine] = useState(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);

  const fileData = REPO_FILES[selectedFile] || REPO_FILES['src/bbb.py'];
  const lines = useMemo(() => fileData.code.trim().split('\n'), [fileData]);
  const codeContainerRef = useRef(null);

  // Keyboard shortcut: 'r' to toggle/focus symbols
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'r' && !['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) {
        e.preventDefault();
        setShowSymbols(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const filteredSymbols = useMemo(() => {
    const q = symbolFilter.trim().toLowerCase();
    if (!q) return fileData.symbols;
    return fileData.symbols.filter(s => s.name.toLowerCase().includes(q) || s.tag.toLowerCase().includes(q));
  }, [fileData.symbols, symbolFilter]);

  const scrollToLine = (lineNum) => {
    setActiveLine(lineNum);
    const lineEl = document.getElementById(`github-line-${lineNum}`);
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(fileData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="gh-modal-window library-code-dialog" padded={false} showClose={false} aria-label="GitHub-Style Code & Symbols Explorer">
        
        {/* Top GitHub Navigation Bar */}
        <header className="gh-top-bar">
          <div className="gh-top-left">
            <div className="gh-branch-badge">
              <GitBranch size={13} />
              <span>R1 (8f3b21d)</span>
              <ChevronDown size={12} />
            </div>

            <nav className="gh-breadcrumbs" aria-label="File Breadcrumb">
              <span className="gh-breadcrumb-segment">core/checkout-service</span>
              <span className="gh-breadcrumb-sep">/</span>
              {fileData.path.split('/').slice(0, -1).map((part, i) => (
                <span key={i} className="gh-breadcrumb-segment">
                  {part}
                  <span className="gh-breadcrumb-sep">/</span>
                </span>
              ))}

              <Menu.Root open={fileMenuOpen} onOpenChange={setFileMenuOpen}><div className="gh-file-picker-wrap">
                <Menu.Trigger render={<Button variant="unstyled" />}
                  type="button"
                  className="gh-breadcrumb-file"
                  aria-expanded={fileMenuOpen}
                >
                  <strong>{fileData.name}</strong>
                  <ChevronDown size={13} />
                </Menu.Trigger>

                <Menu.Portal><Menu.Positioner sideOffset={4} className="library-menu-positioner">
                  <Menu.Popup className="gh-file-dropdown library-menu-popup">
                    <p>Switch Repository File</p>
                    {Object.keys(REPO_FILES).map((path) => (
                      <Menu.Item nativeButton render={<Button variant="unstyled" />}
                        key={path}
                        type="button"
                        className={path === selectedFile ? 'is-active' : ''}
                        onClick={() => {
                          setUserSelectedFile(path);
                          setFileMenuOpen(false);
                          setActiveLine(null);
                          setSymbolFilter('');
                        }}
                      >
                        <FileCode2 size={13} />
                        <span>{path}</span>
                      </Menu.Item>
                    ))}
                  </Menu.Popup></Menu.Positioner></Menu.Portal>
              </div></Menu.Root>
            </nav>
          </div>

          <div className="gh-top-right">
            <span className="gh-meta-pill">
              <Sparkles size={12} color="var(--accent)" />
              <span>Tree-sitter AST &amp; Docling Connected</span>
            </span>
            <Tooltip title="Close File Viewer" shortcut="Esc" side="bottom">
              <Button variant="unstyled"
                type="button"
                className="gh-icon-btn"
                onClick={onClose}
                aria-label="Close File Viewer"
              >
                <X size={16} />
              </Button>
            </Tooltip>
          </div>
        </header>

        {/* Commit & Author Banner */}
        <section className="gh-commit-banner">
          <div className="gh-commit-author">
            <span className="gh-author-avatar">{fileData.commit.initials}</span>
            <strong className="gh-author-name">{fileData.commit.author}</strong>
            <span className="gh-commit-msg">{fileData.commit.msg}</span>
          </div>
          <div className="gh-commit-meta">
            <span className="gh-commit-sha font-mono">{fileData.commit.sha}</span>
            <span className="gh-commit-dot">·</span>
            <span className="gh-commit-time">{fileData.commit.time}</span>
            <span className="gh-history-link">
              <History size={13} />
              <span>History</span>
            </span>
          </div>
        </section>

        {/* File Actions & Metrics Bar */}
        <div className="gh-file-toolbar">
          <div className="gh-toolbar-left">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="code" className="gap-1.5 text-[11px] h-7 px-2.5">
                  <Code2 size={13} />
                  <span>Code</span>
                </TabsTrigger>
                <TabsTrigger value="blame" className="gap-1.5 text-[11px] h-7 px-2.5">
                  <GitCommit size={13} />
                  <span>Continuity Blame</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="gh-file-stats font-mono">
              {fileData.loc} lines · {fileData.size}
            </span>
          </div>

          <div className="gh-toolbar-right flex items-center gap-1.5">
            <Tooltip title="AST Symbols Outline" content="Toggle right-docked Tree-sitter symbols drawer" shortcut="R" side="bottom">
              <Button
                type="button"
                variant={showSymbols ? 'default' : 'secondary'}
                size="xs"
                onClick={() => setShowSymbols(s => !s)}
                className="h-7 gap-1.5"
              >
                <ListTree size={13} />
                <span>Symbols</span>
                <kbd className="kbd font-mono text-[10px] px-1">R</kbd>
              </Button>
            </Tooltip>

            <Tooltip content={wrapLines ? 'Disable soft wrapping' : 'Enable soft line wrapping'} side="bottom">
              <Button
                type="button"
                variant={wrapLines ? 'default' : 'secondary'}
                size="xs"
                onClick={() => setWrapLines(w => !w)}
                aria-label="Toggle Soft Wrap"
                className="h-7 w-7 p-0"
              >
                <WrapText size={13} />
              </Button>
            </Tooltip>

            <Tooltip content="Copy raw source code to clipboard" side="bottom">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={copyCode}
                aria-label="Copy Raw Contents"
                className="h-7 gap-1.5"
              >
                {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Main Workspace: Code Area + Docked Symbols Drawer */}
        <div className="gh-editor-layout">
          {/* Code Viewer Viewport */}
          <div className="gh-code-viewport" ref={codeContainerRef}>
            <div className={`gh-code-table ${wrapLines ? 'is-wrapped' : ''}`}>
              {lines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const isHl = activeLine === lineNum;
                const symbolOnLine = fileData.symbols.find(s => s.line === lineNum);

                return (
                  <div
                    key={lineNum}
                    id={`github-line-${lineNum}`}
                    className={`gh-code-row ${isHl ? 'is-active-line' : ''}`}
                    onClick={() => setActiveLine(lineNum)}
                  >
                    <span className="gh-line-num font-mono" title={`Line ${lineNum}`}>
                      {lineNum}
                    </span>
                    <span className="gh-line-content font-mono">
                      {lineText || ' '}
                    </span>

                    {/* Continuum Inline Anchor Dot */}
                    {symbolOnLine && (
                      <span
                        className="gh-symbol-dot-anchor"
                        title={`${symbolOnLine.kind} ${symbolOnLine.name} (${symbolOnLine.tag})`}
                      >
                        <span className={`status-dot ${symbolOnLine.isSeed ? 'dot--amber' : symbolOnLine.isCaller ? 'dot--red' : 'dot--green'}`} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right-Docked Symbols Panel (matching GitHub 1:1) */}
          {showSymbols && (
            <aside className="gh-symbols-drawer" aria-label="Symbols Outline">
              <div className="gh-symbols-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <strong className="gh-symbols-title">Symbols</strong>
                  <Button variant="unstyled"
                    type="button"
                    className="gh-icon-btn"
                    onClick={() => setShowSymbols(false)}
                    title="Close Symbols Panel"
                  >
                    <X size={14} />
                  </Button>
                </div>
                <p className="gh-symbols-desc">
                  Find definitions, Tree-sitter AST nodes, and Continuum trace links in this file.
                </p>

                <div className="relative flex items-center">
                  <Input
                    icon={Search}
                    placeholder="Filter symbols"
                    value={symbolFilter}
                    onChange={(e) => setSymbolFilter(e.target.value)}
                    aria-label="Filter symbols"
                    className="h-8 text-[12px] bg-[var(--ground-card)] pr-8"
                  />
                  <kbd className="kbd font-mono text-[10px] px-1 absolute right-2.5 pointer-events-none text-[var(--ink-3)]">R</kbd>
                </div>
              </div>

              <div className="gh-symbols-list">
                {filteredSymbols.length === 0 ? (
                  <div className="gh-symbols-empty">
                    <span>No symbols matching &quot;{symbolFilter}&quot;</span>
                  </div>
                ) : (
                  filteredSymbols.map(sym => {
                    const isSelected = activeLine === sym.line;
                    return (
                      <Button variant="unstyled"
                        key={sym.id}
                        type="button"
                        className={`gh-symbol-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => scrollToLine(sym.line)}
                      >
                        <div className="gh-symbol-top">
                          <Tooltip title={`${sym.kind.toUpperCase()} Node`} content={`Extracted via Tree-sitter parser at line ${sym.line}`} side="left">
                            <span className={`gh-symbol-kind gh-kind--${sym.kind}`}>
                              {sym.kind}
                            </span>
                          </Tooltip>
                          <span className="gh-symbol-name font-mono">
                            {sym.name}
                          </span>
                          <span className="gh-symbol-line font-mono">
                            :{sym.line}
                          </span>
                        </div>

                        {/* Continuum Knowledge Trace Annotations */}
                        <div className="gh-symbol-trace">
                          <span className="gh-trace-tag">{sym.tag}</span>
                          {sym.badge && (
                            <Tooltip title="Continuum Continuity Flag" content={sym.tag} side="left">
                              <span className={`gh-trace-badge ${sym.isSeed ? 'badge--seed' : sym.isCaller ? 'badge--caller' : 'badge--ok'}`}>
                                {sym.badge}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </Button>
                    );
                  })
                )}
              </div>
            </aside>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
