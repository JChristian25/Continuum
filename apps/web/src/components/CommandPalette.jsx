import { Command } from 'cmdk';
import {
  FileCode2,
  FileText,
  CheckCircle2,
  GitCommit,
  Layers,
  Bot,
  Activity,
  UserCheck,
  RotateCcw,
  Sun,
  Moon,
  Sparkles,
  GitBranch,
  Search,
  ExternalLink,
  ShieldCheck,
  FolderGit2
} from 'lucide-react';
import { CHANGE_NEIGHBOR_IDS } from '../data/state.js';
import { Badge, Button, Dialog, DialogContent } from './ui/index.js';

export default function CommandPalette({
  isOpen,
  onClose,
  ctx
}) {
  const {
    state,
    selectArtifact,
    switchModule,
    switchActiveUser,
    toggleTheme,
    theme,
    resetState,
    triggerConfetti,
    showToast,
    openImportModal,
    getActiveUser
  } = ctx;

  const activeUser = getActiveUser();
  const artifactsList = Object.values(state.artifacts || {});

  if (!isOpen) return null;

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'code': return <FileCode2 size={15} color="var(--accent)" />;
      case 'requirement': return <FileText size={15} color="var(--ink-2)" />;
      case 'decision': return <GitCommit size={15} color="var(--accent)" />;
      case 'test': return <CheckCircle2 size={15} color="var(--green)" />;
      default: return <FileText size={15} color="var(--ink-2)" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="cmdk-dialog-container library-command-dialog" padded={false} showClose={false} aria-label="Continuum Global Omnibar">
        <Command label="Continuum Global Omnibar" loop>
          <div className="cmdk-input-wrap">
            <Search size={16} color="var(--ink-3)" />
            <Command.Input
              placeholder="Type an artifact (FN-02, DEC-04), action, or module… (Esc to exit)"
              className="cmdk-input"
            />
            <Button variant="unstyled" type="button" className="cmdk-esc-badge" onClick={onClose} aria-label="Close command palette">ESC</Button>
          </div>

          <Command.List className="cmdk-list">
            <Command.Empty className="cmdk-empty">
              No matching artifacts, actions, or modules found.
            </Command.Empty>

            {/* KNOWLEDGE ARTIFACTS */}
            <Command.Group heading="Knowledge Graph Artifacts" className="cmdk-group">
              {artifactsList.map((art) => {
                const isCandidate = CHANGE_NEIGHBOR_IDS.includes(art.id);
                return (
                  <Command.Item
                    key={art.id}
                    value={`${art.id} ${art.shortName} ${art.title} ${art.category}`}
                    onSelect={() => {
                      selectArtifact(art.id);
                      onClose();
                    }}
                    className="cmdk-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {getCategoryIcon(art.category)}
                      <span className="font-mono" style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                        {art.id}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {art.shortName || art.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isCandidate && (
                        <Badge variant="warning" size="xs" className="text-[10px] px-1.5 py-0.5">
                          Candidate Impact
                        </Badge>
                      )}
                      <Badge variant="neutral" size="xs" className="font-mono text-[10px] uppercase">
                        {art.category}
                      </Badge>
                    </div>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* GITHUB CODE & SYMBOLS EXPLORER */}
            <Command.Group heading="GitHub Code & Symbols Viewer" className="cmdk-group">
              <Command.Item
                value="code bbb.py createRequest seed provider symbols viewer github"
                onSelect={() => { ctx.openCodeExplorer?.('src/bbb.py'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileCode2 size={15} color="#0969DA" />
                  <div>
                    <strong style={{ fontSize: 13, display: 'block' }}>src/bbb.py</strong>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Seed Provider · DEC-04 AST symbols</span>
                  </div>
                </div>
                <span className="cmdk-shortcut">R</span>
              </Command.Item>
              <Command.Item
                value="code aaa.py submitUserOrder caller symbols viewer github"
                onSelect={() => { ctx.openCodeExplorer?.('src/aaa.py'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileCode2 size={15} color="#E11D48" />
                  <div>
                    <strong style={{ fontSize: 13, display: 'block' }}>src/aaa.py</strong>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Downstream Caller · Slices createRequest()</span>
                  </div>
                </div>
                <span className="cmdk-shortcut">File</span>
              </Command.Item>
              <Command.Item
                value="code compat.py normalizeRequestResult adapter symbols viewer github"
                onSelect={() => { ctx.openCodeExplorer?.('src/compat.py'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileCode2 size={15} color="var(--accent)" />
                  <div>
                    <strong style={{ fontSize: 13, display: 'block' }}>src/compat.py</strong>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Compatibility Adapter · isinstance guard</span>
                  </div>
                </div>
                <span className="cmdk-shortcut">File</span>
              </Command.Item>
              <Command.Item
                value="docs aaa.md specification docling markdown symbols viewer github"
                onSelect={() => { ctx.openCodeExplorer?.('docs/aaa.md'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={15} color="var(--accent)" />
                  <div>
                    <strong style={{ fontSize: 13, display: 'block' }}>docs/aaa.md</strong>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Docling Specification · §2.1 Request API</span>
                  </div>
                </div>
                <span className="cmdk-shortcut">Doc</span>
              </Command.Item>
            </Command.Group>

            {/* NAVIGATION MODULES */}
            <Command.Group heading="Navigation" className="cmdk-group">
              <Command.Item
                value="dashboard overview home"
                onSelect={() => { switchModule('dashboard'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Layers size={15} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Workspace Dashboard</span>
                </div>
                <span className="cmdk-shortcut">Mod 1</span>
              </Command.Item>

              <Command.Item
                value="review changes pull request diff ast contract"
                onSelect={() => { switchModule('changes'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <GitBranch size={15} color="var(--amber)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Review Changes &amp; AST Diff</span>
                </div>
                <span className="cmdk-shortcut">Mod 2</span>
              </Command.Item>

              <Command.Item
                value="files file explorer code tree source repository browse ast"
                onSelect={() => { switchModule('files'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileCode2 size={15} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Code Explorer &amp; Repository Files</span>
                </div>
                <span className="cmdk-shortcut">Files</span>
              </Command.Item>

              <Command.Item
                value="explore context traceability graph neo4j"
                onSelect={() => { switchModule('explore'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ExternalLink size={15} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Explore Traceability Graph</span>
                </div>
                <span className="cmdk-shortcut">Mod 3</span>
              </Command.Item>

              <Command.Item
                value="coverage health truck factor bus factor"
                onSelect={() => { switchModule('coverage'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Activity size={15} color="var(--green)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Coverage &amp; Knowledge Health</span>
                </div>
                <span className="cmdk-shortcut">Mod 4</span>
              </Command.Item>

              <Command.Item
                value="ask continuum chatbot ai rag assistant"
                onSelect={() => { switchModule('chat'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bot size={15} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Ask Continuum (Graph AI)</span>
                </div>
                <span className="cmdk-shortcut">Mod 5</span>
              </Command.Item>

              <Command.Item
                value="system map architecture c4 topology containers"
                onSelect={() => { switchModule('architecture'); onClose(); }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Layers size={15} color="var(--ink-2)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>C4 System Map &amp; Topology</span>
                </div>
                <span className="cmdk-shortcut">Mod 6</span>
              </Command.Item>
            </Command.Group>

            {/* ACTIONS */}
            <Command.Group heading="Continuum Actions" className="cmdk-group">
              <Command.Item
                value="simulate git push webhook ingestion rq worker"
                onSelect={() => {
                  switchModule('architecture');
                  showToast('Simulating Git push webhook event across pipeline…');
                  onClose();
                }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkles size={15} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Simulate Git Push Webhook</span>
                </div>
              </Command.Item>

              <Command.Item
                value="import connect repository ingestion"
                onSelect={() => {
                  openImportModal();
                  onClose();
                }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FolderGit2 size={15} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Connect &amp; Ingest Repository…</span>
                </div>
              </Command.Item>

              <Command.Item
                value="toggle theme switch dark mode light mode"
                onSelect={() => {
                  toggleTheme();
                  showToast(`Theme switched to ${theme === 'dark' ? 'Light' : 'Dark'} mode`);
                  onClose();
                }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {theme === 'dark' ? <Sun size={15} color="var(--amber)" /> : <Moon size={15} color="var(--accent)" />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                  </span>
                </div>
              </Command.Item>

              <Command.Item
                value="reset state reseed prototype data"
                onSelect={() => {
                  resetState();
                  triggerConfetti();
                  showToast('State successfully reset to initial seed values.');
                  onClose();
                }}
                className="cmdk-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RotateCcw size={15} color="var(--red)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>
                    Reset State to Initial Seed
                  </span>
                </div>
              </Command.Item>
            </Command.Group>

            {/* TEAM PERSONAS */}
            <Command.Group heading="Team Personas" className="cmdk-group">
              {state.teamMembers?.map((member) => (
                <Command.Item
                  key={member.id}
                  value={`switch persona user ${member.name} ${member.role}`}
                  onSelect={() => {
                    switchActiveUser(member.id);
                    showToast(`Switched active persona to ${member.name}`);
                    onClose();
                  }}
                  className="cmdk-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserCheck size={15} color={member.id === activeUser?.id ? 'var(--accent)' : 'var(--ink-3)'} />
                    <span style={{ fontSize: 13, fontWeight: member.id === activeUser?.id ? 700 : 500 }}>
                      {member.name} ({member.role})
                    </span>
                  </div>
                  {member.authority === 'Authorized Reviewer' && (
                    <Badge variant="accent" size="xs" className="font-mono text-[10px] gap-1">
                      <ShieldCheck size={11} /> Authorized
                    </Badge>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
