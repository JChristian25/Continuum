import { useEffect, useRef, useState } from 'react';
import {
  Infinity as InfinityIcon, PanelLeftClose, PanelLeftOpen, Bot, Check, ChevronDown, FileCode2, FolderGit2, GitCompare, GitCommit,
  LayoutDashboard, Moon, Network, Plus, Search, Server, Shield,
  ShieldCheck, Sun, Users, ClipboardCheck, Settings
} from 'lucide-react';
import { useContinuum } from '../context/ContinuumContext.jsx';
import Tooltip from './Tooltip.jsx';
import { Badge } from './ui/index.js';
import { motion } from 'motion/react';

const modules = [
  { id: 'dashboard', label: 'Workspace', helper: 'Overview & your next steps', icon: LayoutDashboard },
  { id: 'changes', label: 'Review changes', helper: 'Assess incoming contract impact & review queue', icon: GitCompare, review: true },
  { id: 'summary', label: 'Review summary', helper: 'Judgments, follow-up work, and review history', icon: ClipboardCheck },
  { id: 'files', label: 'Code explorer', helper: 'Browse repository tree, source code & AST symbols', icon: FileCode2 },
  { id: 'explore', label: 'Explore context', helper: 'Trace relationships & graph dependencies', icon: Network },
  { id: 'coverage', label: 'Coverage', helper: 'Find documentation & spec gaps', icon: ShieldCheck },
  { id: 'chat', label: 'Ask Continuum', helper: 'Graph RAG AI query assistant', icon: Bot },
  { id: 'architecture', label: 'System map', helper: 'View C4 system topology', icon: Server },
  { id: 'account', label: 'Account & demo settings', helper: 'Session, access, and sign out', icon: Settings },
  { id: 'governance', label: 'Team & governance', helper: 'Reviewer roles and continuity policies', icon: Users }
];

export default function Shell({
  state,
  pendingCount,
  switchModule,
  toggleRevisionMode,
  switchActiveUser,
  openModal,
  theme,
  toggleTheme,
  onOpenImportModal,
  onSwitchRepo
}) {
  const { openCommandPalette } = useContinuum();
  const [personaOpen, setPersonaOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    return () => { delete document.documentElement.dataset.sidebar; };
  }, [collapsed]);
  const personaRef = useRef(null);
  const repoRef = useRef(null);

  const isMac = typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform || '');
  const activeUser = state.teamMembers?.find((member) => member.id === state.activeUserId) || state.teamMembers?.[0];
  const activeRepo = state.repositories?.find((repo) => repo.id === state.activeRepoId) || state.repositories?.[0];
  const isAuthorized = activeUser?.authority === 'Authorized Reviewer';

  useEffect(() => {
    const closeMenus = (event) => {
      if (personaRef.current && !personaRef.current.contains(event.target)) setPersonaOpen(false);
      if (repoRef.current && !repoRef.current.contains(event.target)) setRepoOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPersonaOpen(false);
        setRepoOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenus);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', closeMenus);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <aside className={`app-rail ${collapsed ? 'is-collapsed' : ''}`} aria-label="Continuum navigation">
      <button className="sidebar-toggle" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
        {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>
      {/* 1. BRAND HEADER & THEME TOGGLE */}
      <div className="app-rail__header">
        <button
          type="button"
          className="app-rail__brand"
          onClick={() => switchModule('dashboard')}
          aria-label="Continuum Knowledge continuity - go to dashboard"
        >
          <span className="app-rail__mark">
            <InfinityIcon size={27} strokeWidth={1.7} />
          </span>
          <div className="app-rail__brand-text">
            <strong>Continuum</strong>
            <small>Knowledge continuity</small>
          </div>
        </button>

        <Tooltip content={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'} side="bottom">
          <button
            className="rail-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Toggle color theme (currently ${theme})`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </Tooltip>
      </div>

      {/* 2. WORKSPACE & REVISION CYCLE SECTION */}
      <div className="app-rail__workspace-group" ref={repoRef}>
        <div className="app-rail__section-header">
          <span className="app-rail__label">Workspace</span>
        </div>

        {/* Repository Selector */}
        <Tooltip title="Workspace Scope" content="Switch active repository or import external codebase" side="right" disabled={repoOpen}>
          <button
            className={`scope-selector ${repoOpen ? 'is-open' : ''}`}
            type="button"
            onClick={() => { setRepoOpen(open => !open); setPersonaOpen(false); }}
            aria-expanded={repoOpen}
            aria-haspopup="menu"
          >
            <FolderGit2 size={15} className="scope-selector__icon" />
            <div className="scope-selector__text">
              <strong title={activeRepo?.fullName}>{activeRepo?.fullName || 'No repository selected'}</strong>
              <small>{activeRepo?.language || 'Repository'}</small>
            </div>
            <ChevronDown size={14} className="scope-selector__chevron" />
          </button>
        </Tooltip>

        {/* Revision Cycle Segmented Toggle */}
        <Tooltip
          title="Review Cycle Context"
          content={state.revisionMode === 'R1'
            ? 'Incoming Change (8f3b21d). Click to compare historical baseline.'
            : 'Baseline (a41c90e). Click to switch to incoming change.'}
          side="right"
        >
          <button
            type="button"
            className={`revision-switch revision-switch--${state.revisionMode === 'R1' ? 'r1' : 'r0'}`}
            onClick={toggleRevisionMode}
            aria-label={`Current review cycle: ${state.revisionMode === 'R1' ? 'Incoming Change' : 'Baseline'}. Click to toggle.`}
          >
            <GitCommit size={14} className="revision-switch__icon" />
            <div className="revision-switch__text">
              <small>Review Context</small>
              <strong>{state.revisionMode === 'R1' ? 'Incoming Change' : 'Baseline'}</strong>
            </div>
            <span className={`status-dot ${state.revisionMode === 'R1' ? 'dot--green' : 'dot--neutral'}`} />
          </button>
        </Tooltip>

        {/* Floating Workspace Popover (Flies out to the right) */}
        {repoOpen && (
          <div className="rail-popover rail-popover--scope" role="menu" aria-label="Switch workspace">
            <div className="rail-popover__header">
              <span className="rail-popover__label">Switch Workspace</span>
              <span className="rail-popover__count">{state.repositories?.length || 0} repositories</span>
            </div>
            <div className="rail-popover__list">
              {state.repositories?.map((repo) => {
                const isCurrent = repo.id === activeRepo?.id;
                return (
                  <button
                    key={repo.id}
                    type="button"
                    role="menuitem"
                    className={`rail-popover__item ${isCurrent ? 'is-current' : ''}`}
                    disabled={repo.id !== 'repo-checkout'}
                    onClick={() => { onSwitchRepo?.(repo.id); setRepoOpen(false); }}
                  >
                    <div className="rail-popover__item-text">
                      <span className="rail-popover__item-title" title={repo.fullName}>{repo.fullName}</span>
                      <span className="rail-popover__item-meta">
                        <span className="rail-popover__badge" title={repo.language}>{repo.language}</span>
                        <span className="rail-popover__nodes-count">{repo.id === 'repo-checkout' ? `${repo.stats?.nodes || 0} nodes · ${repo.branch}` : 'Preview only · no review dataset'}</span>
                      </span>
                    </div>
                    {isCurrent && <Check size={14} className="rail-popover__check" />}
                  </button>
                );
              })}
            </div>
            <div className="rail-popover__footer">
              <button
                type="button"
                className="rail-popover__action"
                onClick={() => { setRepoOpen(false); onOpenImportModal?.(); }}
              >
                <Plus size={14} /> Import repository
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. PRIMARY ACTION & SEARCH GROUP */}
      <div className="app-rail__quick-actions">
        {/* Prominent "+ Record Intent" Button */}
        <Tooltip title="Record Design Intent" content="Capture an architectural decision and link it to code or docs" side="right">
          <button className="rail-primary-action" type="button" onClick={openModal}>
            <Plus size={15} strokeWidth={2.5} />
            <span>Record intent</span>
          </button>
        </Tooltip>

        {/* Global Search / Omnibar Trigger */}
        <div
          className="rail-search"
          onClick={openCommandPalette}
          role="button"
          tabIndex="0"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCommandPalette(); } }}
          aria-label={`Open Command Palette (${isMac ? '⌘K' : 'Ctrl+K'} or /)`}
          title={`Open Command Palette (${isMac ? '⌘K' : 'Ctrl+K'} or /)`}
        >
          <Search size={14} />
          <span className="rail-search__label">Search records…</span>
          <kbd className="cmdk-shortcut-chip">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </div>
      </div>

      {/* 4. NAVIGATION LINKS */}
      <nav className="app-rail__nav" aria-label="Continuum navigation">
        <span className="app-rail__label">Navigate</span>
        {modules.map((module) => {
          const Icon = module.icon;
          const active = state.activeModule === module.id || (module.id === 'dashboard' && state.activeModule === 'overview');
          const showBadge = module.review && pendingCount > 0;
          return (
            <Tooltip key={module.id} content={module.helper} side="right">
              <button
                type="button"
                className={`rail-nav-item ${active ? 'is-active' : ''}`}
                onClick={() => switchModule(module.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={module.label}
              >
                {active && <motion.span className="nav-active-surface" layoutId="active-navigation" transition={{ type: 'spring', stiffness: 420, damping: 38 }} />}
                <Icon size={16} />
                <span className="rail-nav-item__label">{module.label}</span>
                {showBadge && <Badge variant="accent" size="xs" className="ml-auto font-mono text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">{pendingCount}</Badge>}
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* 5. FOOTER: USER PERSONA SWITCHER */}
      <div className="app-rail__account" ref={personaRef}>
        <span className="app-rail__label">Review persona</span>
        <Tooltip
          title="Active Review Persona"
          content={`${activeUser?.name} (${isAuthorized ? 'Authorized Reviewer · Can record & approve judgments' : 'Read-Only Viewer · Can inspect context'})`}
          side="right"
          disabled={personaOpen}
        >
          <button
            className={`account-button ${personaOpen ? 'is-open' : ''}`}
            type="button"
            onClick={() => { setPersonaOpen(open => !open); setRepoOpen(false); }}
            aria-expanded={personaOpen}
            aria-haspopup="menu"
          >
            <span className="account-avatar">{activeUser?.initials || 'JC'}</span>
            <div className="account-button__text">
              <strong title={activeUser?.name}>{activeUser?.shortName || 'JC Linaban'}</strong>
              <small>{isAuthorized ? 'Authorized Reviewer' : 'Read-Only Viewer'}</small>
            </div>
            <ChevronDown size={14} className="account-button__chevron" />
          </button>
        </Tooltip>

        {/* Floating Persona Popover (Flies out to the right) */}
        {personaOpen && (
          <div className="rail-popover rail-popover--account" role="menu" aria-label="Review as">
            <div className="rail-popover__header">
              <span className="rail-popover__label">Review As Persona</span>
              <span className="rail-popover__count">Switch Identity</span>
            </div>
            <div className="rail-popover__list">
              {state.teamMembers?.map((member) => {
                const isCurrent = member.id === activeUser?.id;
                const isAuth = member.authority === 'Authorized Reviewer';
                return (
                  <button
                    key={member.id}
                    type="button"
                    role="menuitem"
                    className={`rail-popover__item ${isCurrent ? 'is-current' : ''}`}
                    onClick={() => { switchActiveUser(member.id); setPersonaOpen(false); }}
                  >
                    <span className="account-avatar account-avatar--sm">
                      {member.initials}
                    </span>
                    <div className="rail-popover__item-text">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="rail-popover__item-title">{member.name}</span>
                        {isAuth && <Shield size={12} className="rail-popover__shield" />}
                      </div>
                      <span className="rail-popover__item-meta">
                        {isAuth ? 'Authorized Reviewer' : 'Read-Only Viewer'} · {member.roleTitle}
                      </span>
                    </div>
                    {isCurrent && <Check size={14} className="rail-popover__check" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}


