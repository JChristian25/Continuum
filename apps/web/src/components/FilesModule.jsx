import { useState, useMemo, useRef, useEffect, startTransition } from 'react';
import {
  FolderGit2,
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  File,
  ChevronDown,
  ChevronRight,
  Search,
  Copy,
  Check,
  Code2,
  GitCommit,
  ListTree,
  WrapText,
  Sparkles,
  ArrowRight,
  History
} from 'lucide-react';
import Tooltip from './Tooltip.jsx';
import { REPO_FILES, getRepoTree } from '../data/repoFiles.js';
import { Button, Badge, Input, Tabs, TabsList, TabsTrigger } from './ui/index.js';

export default function FilesModule({ ctx }) {
  const { switchModule, showToast } = ctx;
  const [selectedFilePath, setSelectedFilePath] = useState('src/bbb.py');
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'diff' | 'blame'
  const [showSymbols, setShowSymbols] = useState(true);
  const [fileFilter, setFileFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [activeLine, setActiveLine] = useState(null);
  const [wrapLines, setWrapLines] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openFolders, setOpenFolders] = useState({ src: true, tests: true, docs: true, specs: true });

  const codeContainerRef = useRef(null);

  const fileData = REPO_FILES[selectedFilePath] || REPO_FILES['src/bbb.py'];
  const lines = useMemo(() => fileData.code.trim().split('\n'), [fileData]);
  const tree = useMemo(() => getRepoTree(), []);

  // Filtered symbols
  const filteredSymbols = useMemo(() => {
    const q = symbolFilter.trim().toLowerCase();
    if (!q) return fileData.symbols || [];
    return (fileData.symbols || []).filter(
      s => s.name.toLowerCase().includes(q) || (s.tag && s.tag.toLowerCase().includes(q))
    );
  }, [fileData.symbols, symbolFilter]);

  // Scroll to line
  const scrollToLine = (lineNum) => {
    setActiveLine(lineNum);
    const lineEl = document.getElementById(`editor-line-${lineNum}`);
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleFolder = (folderName) => {
    setOpenFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(fileData.code);
    setCopied(true);
    showToast(`Copied ${fileData.name} source code to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (file) => {
    if (file.lang === 'python') return <FileCode2 size={14} color="#38BDF8" />;
    if (file.lang === 'markdown') return <FileText size={14} color="#34D399" />;
    if (file.lang === 'pdf') return <File size={14} color="#F87171" />;
    if (file.lang === 'toml' || file.lang === 'yaml' || file.lang === 'env') return <FileCode2 size={14} color="#FBBF24" />;
    if (file.lang === 'dockerfile') return <FileCode2 size={14} color="#60A5FA" />;
    return <FileCode2 size={14} color="var(--ink-2)" />;
  };

  // Keyboard shortcut 'r' to toggle symbols
  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'r') {
        e.preventDefault();
        setShowSymbols(s => !s);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="files-workspace" style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* ═══════════════════════════════════════════════
          PANE 1: REPOSITORY TREE & FILE NAVIGATOR
      ═══════════════════════════════════════════════ */}
      <aside
        className="files-sidebar"
        style={{
          width: 280,
          flexShrink: 0,
          background: 'var(--ground-sunken)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {/* Explorer Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
              <FolderGit2 size={16} color="var(--accent)" />
              <span>Repository Files</span>
            </div>
            <Badge variant="neutral" size="xs" className="font-mono">
              {Object.keys(REPO_FILES).length} files
            </Badge>
          </div>

          {/* Search files input */}
          <Input
            icon={Search}
            placeholder="Search files..."
            value={fileFilter}
            onChange={(e) => setFileFilter(e.target.value)}
            className="h-8 text-[12px] bg-[var(--ground-card)]"
          />
        </div>

        {/* File Tree List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          
          {/* Folders */}
          {Object.keys(tree).filter(folderKey => folderKey !== 'root' && tree[folderKey]?.files?.length > 0).map(folderKey => {
            const folderObj = tree[folderKey];
            if (!folderObj) return null;
            const isOpen = openFolders[folderKey];

            const visibleFiles = folderObj.files.filter(f =>
              !fileFilter || f.path.toLowerCase().includes(fileFilter.toLowerCase())
            );

            if (visibleFiles.length === 0 && fileFilter) return null;

            return (
              <div key={folderKey} style={{ marginBottom: 6 }}>
                <Button variant="unstyled"
                  type="button"
                  onClick={() => toggleFolder(folderKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: 'var(--r-xs)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-2)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {isOpen ? <FolderOpen size={14} color="var(--accent)" /> : <Folder size={14} color="var(--accent)" />}
                  <span style={{ textTransform: 'lowercase' }}>{folderKey}/</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                    {visibleFiles.length}
                  </span>
                </Button>

                {isOpen && (
                  <div style={{ marginLeft: 16, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {visibleFiles.map(file => {
                      const isSelected = selectedFilePath === file.path;
                      return (
                        <Button variant="unstyled"
                          key={file.path}
                          type="button"
                          onClick={() => {
                            startTransition(() => {
                              setSelectedFilePath(file.path);
                              setActiveLine(null);
                            });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 'var(--r-sm)',
                            background: isSelected ? 'var(--accent-tint)' : 'transparent',
                            border: isSelected ? '1px solid var(--accent-border)' : '1px solid transparent',
                            color: isSelected ? 'var(--accent)' : 'var(--ink)',
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          {getFileIcon(file)}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                            {file.name}
                          </span>
                          {file.statusLabel && (
                            <span
                              className={`status-pill status-pill--xs ${file.statusBadgeCls || ''}`}
                              style={{ fontSize: 9.5, padding: '1px 5px' }}
                            >
                              {file.statusLabel}
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Root Files */}
          {tree.root.files
            .filter(f => !fileFilter || f.path.toLowerCase().includes(fileFilter.toLowerCase()))
            .map(file => {
              const isSelected = selectedFilePath === file.path;
              return (
                <Button variant="unstyled"
                  key={file.path}
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      setSelectedFilePath(file.path);
                      setActiveLine(null);
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 'var(--r-sm)',
                    background: isSelected ? 'var(--accent-tint)' : 'transparent',
                    border: isSelected ? '1px solid var(--accent-border)' : '1px solid transparent',
                    color: isSelected ? 'var(--accent)' : 'var(--ink)',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginTop: 2
                  }}
                >
                  {getFileIcon(file)}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                    {file.name}
                  </span>
                  <Badge variant="neutral" size="xs" className="font-mono text-[9px]">
                    root
                  </Badge>
                </Button>
              );
            })}
        </div>

        {/* Tree Footer Context */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--ground-card)', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
            <Sparkles size={12} color="var(--accent)" />
            <span>AST Parsed &amp; Continuous</span>
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: 10, marginTop: 2 }}>
            Tree-sitter Python/TS + Docling Markdown
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════
          PANE 2: SOURCE CODE / DIFF VIEWER CANVAS
      ═══════════════════════════════════════════════ */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--ground)', height: '100%', overflow: 'hidden' }}>
        
        {/* Top File Header & Breadcrumbs */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--ground-card)',
            flexShrink: 0,
            gap: 12
          }}
        >
          {/* Breadcrumb Path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Badge variant="neutral" size="xs" className="font-mono">
              core/checkout-service
            </Badge>
            <span style={{ color: 'var(--ink-3)' }}>/</span>
            <strong className="font-mono" style={{ fontSize: 13, color: 'var(--ink)' }}>
              {fileData.path}
            </strong>
            {fileData.statusLabel && (
              <span className={`status-pill status-pill--sm ${fileData.statusBadgeCls || ''}`}>
                {fileData.statusLabel}
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Tooltip title="AST Symbols Outline" content="Toggle AST symbols outline drawer (Shortcut: R)" shortcut="R" side="bottom">
              <Button
                variant={showSymbols ? 'default' : 'secondary'}
                size="xs"
                onClick={() => setShowSymbols(s => !s)}
                className="gap-1.5"
              >
                <ListTree size={13} />
                <span>Symbols</span>
                <kbd className="kbd font-mono" style={{ fontSize: 10, padding: '1px 4px' }}>R</kbd>
              </Button>
            </Tooltip>

            <Tooltip content={wrapLines ? 'Disable soft wrapping' : 'Enable soft line wrapping'} side="bottom">
              <Button
                variant={wrapLines ? 'default' : 'secondary'}
                size="xs"
                onClick={() => setWrapLines(w => !w)}
                aria-label="Toggle soft wrap"
              >
                <WrapText size={13} />
              </Button>
            </Tooltip>

            <Button
              variant="secondary"
              size="xs"
              onClick={handleCopyCode}
              className="gap-1.5"
            >
              {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            {/* Quick jump to review if file is related to bbb.py or aaa.py */}
            {(fileData.path.includes('bbb.py') || fileData.path.includes('aaa.py')) && (
              <Button
                variant="default"
                size="xs"
                onClick={() => switchModule('changes')}
                className="gap-1.5"
              >
                <span>Review queue</span>
                <ArrowRight size={13} />
              </Button>
            )}
          </div>
        </header>

        {/* Commit & Author Ribbon */}
        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 18px',
            background: 'var(--ground-sunken)',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            flexShrink: 0,
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#FFFFFF',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 10
              }}
            >
              {fileData.commit?.initials || 'JC'}
            </span>
            <strong style={{ color: 'var(--ink)' }}>{fileData.commit?.author}</strong>
            <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileData.commit?.msg}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, color: 'var(--ink-3)', fontSize: 11 }}>
            <Badge variant="neutral" size="xs" className="font-mono gap-1">
              <GitCommit size={12} />
              <span>{fileData.commit?.sha || '8f3b21d'}</span>
            </Badge>
            <span>{fileData.commit?.time || 'recently'}</span>
            <span className="font-mono">{fileData.loc} lines · {fileData.size}</span>
          </div>
        </section>

        {/* View Mode Tabs (Code vs Blame) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 18px',
            background: 'var(--ground-card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="code" className="gap-1.5">
                <Code2 size={13} />
                <span>Source Code</span>
              </TabsTrigger>
              <TabsTrigger value="blame" className="gap-1.5">
                <History size={13} />
                <span>Continuity Blame</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="status-dot dot--green" />
            <span>Parser AST Active</span>
          </div>
        </div>

        {/* Code Content Viewport */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          
          <div
            ref={codeContainerRef}
            className="gh-code-viewport"
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--ground-card)',
              padding: '8px 0',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {activeTab === 'blame' ? (
              /* Blame View */
              <div style={{ padding: '12px 18px' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
                  Continuity Revision Blame for {fileData.name}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(fileData.blame || []).map((b, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--r-sm)',
                        background: 'var(--ground-sunken)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Badge variant="neutral" size="xs" className="font-mono">
                            Lines {b.lines[0]}–{b.lines[1]}
                          </Badge>
                          <strong style={{ fontSize: 12, color: 'var(--ink)' }}>{b.author}</strong>
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>({b.sha})</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)' }}>{b.msg}</p>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{b.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Standard Code Lines Table */
              <div className={`gh-code-table ${wrapLines ? 'is-wrapped' : ''}`}>
                {lines.map((lineText, idx) => {
                  const lineNum = idx + 1;
                  const isHl = activeLine === lineNum;
                  const symbolOnLine = (fileData.symbols || []).find(s => s.line === lineNum);

                  return (
                    <div
                      key={lineNum}
                      id={`editor-line-${lineNum}`}
                      className={`gh-code-row ${isHl ? 'is-active-line' : ''}`}
                      onClick={() => setActiveLine(lineNum)}
                    >
                      <span className="gh-line-num font-mono" title={`Line ${lineNum}`}>
                        {lineNum}
                      </span>
                      <span className="gh-line-content font-mono">
                        {lineText || ' '}
                      </span>

                      {/* Inline Continuity Dot / Badge */}
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
            )}
          </div>

          {/* ═══════════════════════════════════════════════
              PANE 3: DOCKED AST SYMBOLS OUTLINE
          ═══════════════════════════════════════════════ */}
          {showSymbols && (
            <aside
              className="gh-symbols-drawer"
              style={{
                width: 290,
                flexShrink: 0,
                borderLeft: '1px solid var(--border)',
                background: 'var(--ground-sunken)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>AST Symbols Outline</strong>
                  <Badge variant="neutral" size="xs" className="font-mono">
                    {filteredSymbols.length} nodes
                  </Badge>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 8 }}>
                  Tree-sitter AST nodes &amp; Continuum traceability anchors.
                </p>

                {/* Filter symbols */}
                <Input
                  icon={Search}
                  placeholder="Filter symbols..."
                  value={symbolFilter}
                  onChange={(e) => setSymbolFilter(e.target.value)}
                  className="h-7 text-[11px] bg-[var(--ground-card)]"
                />
              </div>

              {/* Symbols List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {filteredSymbols.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-3)', fontSize: 11 }}>
                    No symbols matching &quot;{symbolFilter}&quot;
                  </div>
                ) : (
                  filteredSymbols.map(sym => {
                    const isSelected = activeLine === sym.line;
                    return (
                      <Button variant="unstyled"
                        key={sym.id}
                        type="button"
                        onClick={() => scrollToLine(sym.line)}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 'var(--r-sm)',
                          background: isSelected ? 'var(--accent-tint)' : 'var(--ground-card)',
                          border: isSelected ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                          marginBottom: 6,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          transition: 'all 0.12s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                          <span
                            className={`gh-symbol-kind gh-kind--${sym.kind}`}
                            style={{ fontSize: 9.5, padding: '1px 4px' }}
                          >
                            {sym.kind}
                          </span>
                          <strong className="font-mono" style={{ fontSize: 11.5, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sym.name}
                          </strong>
                          <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                            :{sym.line}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, fontSize: 10 }}>
                          <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sym.tag}
                          </span>
                          {sym.badge && (
                            <span className={`status-pill status-pill--xs ${sym.isSeed ? 'badge--seed' : sym.isCaller ? 'badge--caller' : 'badge--ok'}`}>
                              {sym.badge}
                            </span>
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

      </main>

    </div>
  );
}
