import { useEffect, useState } from 'react';
import {
  Infinity as InfinityIcon, PanelLeftClose, PanelLeftOpen, Bot, Check, ChevronDown, FileCode2, FolderGit2, GitCompare, GitCommit,
  LayoutDashboard, Moon, Network, Plus, Search, Server, Shield,
  ShieldCheck, Sun, Users, ClipboardCheck, Settings
} from 'lucide-react';
import { useContinuum } from '../context/ContinuumContext.jsx';
import Tooltip from './Tooltip.jsx';
import { Badge, Button, Select } from './ui/index.js';
import { Menu } from '@base-ui/react/menu';
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
  const ctx = useContinuum();
 const { openCommandPalette, serviceMode } = ctx;
  const [personaOpen, setPersonaOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    return () => { delete document.documentElement.dataset.sidebar; };
  }, [collapsed]);
  const AccountTrigger = serviceMode ? Button : Menu.Trigger;

  const isMac = typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform || '');
  const activeUser = state.teamMembers?.find((member) => member.id === state.activeUserId) || state.teamMembers?.[0];
  const activeRepo = state.repositories?.find((repo) => repo.id === state.activeRepoId) || state.repositories?.[0];
  const isAuthorized = serviceMode ? activeRepo?.role === 'reviewer' : activeUser?.authority === 'Authorized Reviewer';


  return (
    <aside className={`app-rail ${collapsed ? 'is-collapsed' : ''}`} aria-label="Continuum navigation">
      <Button variant="unstyled" className="sidebar-toggle" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
        {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </Button>
      {/* 1. BRAND HEADER & THEME TOGGLE */}
      <div className="app-rail__header">
        <Button variant="unstyled"
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
        </Button>

        <Tooltip content={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'} side="bottom">
          <Button variant="unstyled"
            className="rail-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Toggle color theme (currently ${theme})`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </Button>
        </Tooltip>
      </div>

      {/* 2. WORKSPACE & REVISION CYCLE SECTION */}
      <Menu.Root open={repoOpen} onOpenChange={setRepoOpen}><div className="app-rail__workspace-group">
        <div className="app-rail__section-header">
          <span className="app-rail__label">Workspace</span>
        </div>

        {/* Repository Selector */}
        <Tooltip title="Workspace Scope" content="Switch active repository or import external codebase" side="right" disabled={repoOpen}>
          <Menu.Trigger render={<Button variant="unstyled" />}
            className={`scope-selector ${repoOpen ? 'is-open' : ''}`}
            type="button"
            onClick={() => setPersonaOpen(false)}
            aria-expanded={repoOpen}
            aria-haspopup="menu"
          >
            <FolderGit2 size={15} className="scope-selector__icon" />
            <div className="scope-selector__text">
              <strong title={activeRepo?.fullName}>{activeRepo?.fullName || 'No repository selected'}</strong>
              <small>{activeRepo?.language || 'Repository'}</small>
            </div>
            <ChevronDown size={14} className="scope-selector__chevron" />
          </Menu.Trigger>
        </Tooltip>

        {serviceMode && ctx.selection && <label className="revision-switch"><span className="revision-switch__text"><small>Selected revision</small><Select aria-label="Selected revision" value={ctx.selection.targetRevision.commitId} disabled={ctx.busy} onChange={e => ctx.changeSelection({ ...ctx.selection, baseRevision: null, comparisonId: undefined, targetRevision: { objectAlgorithm: 'sha1', commitId: e.target.value } })}>{ctx.descriptor?.repositories.find(r => r.id === state.activeRepoId)?.inputs.find(i => i.id === ctx.selection.inventoryId)?.revisions.map(r => <option key={r.label} value={r.commitId}>{r.label} · {r.commitId.slice(0, 7)}</option>)}</Select></span></label>}
        {/* Revision Cycle Segmented Toggle */}
        {!serviceMode && <Tooltip
          title="Review Cycle Context"
          content={state.revisionMode === 'R1'
            ? 'Incoming Change (8f3b21d). Click to compare historical baseline.'
            : 'Baseline (a41c90e). Click to switch to incoming change.'}
          side="right"
        >
          <Button variant="unstyled"
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
          </Button>
        </Tooltip>

        }

        {/* Floating Workspace Popover (Flies out to the right) */}
        <Menu.Portal><Menu.Positioner side="right" align="start" sideOffset={8} className="library-menu-positioner">
          <Menu.Popup className="rail-popover rail-popover--scope library-menu-popup" aria-label="Switch workspace">
            <div className="rail-popover__header">
              <span className="rail-popover__label">Switch Workspace</span>
              <span className="rail-popover__count">{state.repositories?.length || 0} repositories</span>
            </div>
            <div className="rail-popover__list">
              {state.repositories?.map((repo) => {
                const isCurrent = repo.id === activeRepo?.id;
                return (
                  <Menu.Item nativeButton render={<Button variant="unstyled" />}
                    key={repo.id}
                    type="button"
                    role="menuitem"
                    className={`rail-popover__item ${isCurrent ? 'is-current' : ''}`}
                    disabled={!serviceMode && repo.id !== 'repo-checkout'}
                    onClick={() => { onSwitchRepo?.(repo.id); setRepoOpen(false); }}
                  >
                    <div className="rail-popover__item-text">
                      <span className="rail-popover__item-title" title={repo.fullName}>{repo.fullName}</span>
                      <span className="rail-popover__item-meta">
                        <span className="rail-popover__badge" title={repo.language}>{repo.language}</span>
                        <span className="rail-popover__nodes-count">{serviceMode ? `${repo.inputs?.[0]?.pathCount || 0} approved paths · ${repo.role}` : repo.id === 'repo-checkout' ? `${repo.stats?.nodes || 0} nodes · ${repo.branch}` : 'Preview only · no review dataset'}</span>
                      </span>
                    </div>
                    {isCurrent && <Check size={14} className="rail-popover__check" />}
                  </Menu.Item>
                );
              })}
            </div>
            <div className="rail-popover__footer">
              <Menu.Item nativeButton render={<Button variant="unstyled" />}
                type="button"
                className="rail-popover__action"
                onClick={() => { setRepoOpen(false); onOpenImportModal?.(); }}
              >
                <Plus size={14} /> {serviceMode ? 'Registered inputs' : 'Import repository'}
              </Menu.Item>
            </div>
          </Menu.Popup></Menu.Positioner></Menu.Portal>
      </div></Menu.Root>

      {/* 3. PRIMARY ACTION & SEARCH GROUP */}
      <div className="app-rail__quick-actions">
        {/* Prominent "+ Record Intent" Button */}
        <Tooltip title="Record Design Intent" content="Capture an architectural decision and link it to code or docs" side="right">
          <Button variant="unstyled" className="rail-primary-action" type="button" disabled={serviceMode && (!ctx.canWrite || ctx.busy)} onClick={openModal}>
            <Plus size={15} strokeWidth={2.5} />
            <span>Record intent</span>
          </Button>
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
        {modules.filter(module => !serviceMode || !['chat', 'architecture'].includes(module.id)).map((original) => {
 const module = serviceMode ? { ...original, label: ({ changes: 'Review relationships', account: 'Account' })[original.id] || original.label, helper: ({ changes: 'Review selected-revision relationships', files: 'Read captured files and authored records', explore: 'Inspect saved relationships' })[original.id] || original.helper } : original;
          const Icon = module.icon;
          const active = state.activeModule === module.id || (module.id === 'dashboard' && state.activeModule === 'overview');
          const showBadge = module.review && pendingCount > 0;
          return (
            <Tooltip key={module.id} content={module.helper} side="right">
              <Button variant="unstyled"
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
              </Button>
            </Tooltip>
          );
        })}
      </nav>

      {/* 5. FOOTER: USER PERSONA SWITCHER */}
      <Menu.Root open={personaOpen} onOpenChange={setPersonaOpen}><div className="app-rail__account">
        <span className="app-rail__label">{serviceMode ? 'Signed in' : 'Review persona'}</span>
        <Tooltip
          title="Active Review Persona"
          content={`${activeUser?.name} (${isAuthorized ? 'Authorized Reviewer · Can record & approve judgments' : 'Read-Only Viewer · Can inspect context'})`}
          side="right"
          disabled={personaOpen}
        >
          <AccountTrigger {...(serviceMode ? { variant: 'unstyled' } : { render: <Button variant="unstyled" /> })}
            className={`account-button ${personaOpen ? 'is-open' : ''}`}
            type="button"
            onClick={() => { if (serviceMode) switchModule('account'); setRepoOpen(false); }}
            aria-expanded={personaOpen}
            aria-haspopup="menu"
          >
            <span className="account-avatar">{activeUser?.initials || 'JC'}</span>
            <div className="account-button__text">
              <strong title={activeUser?.name}>{activeUser?.shortName || 'JC Linaban'}</strong>
              <small>{isAuthorized ? 'Authorized Reviewer' : 'Read-Only Viewer'}</small>
            </div>
            <ChevronDown size={14} className="account-button__chevron" />
          </AccountTrigger>
        </Tooltip>

        {/* Floating Persona Popover (Flies out to the right) */}
        {!serviceMode && <Menu.Portal><Menu.Positioner side="right" align="end" sideOffset={8} className="library-menu-positioner">
          <Menu.Popup className="rail-popover rail-popover--account library-menu-popup" aria-label="Review as">
            <div className="rail-popover__header">
              <span className="rail-popover__label">Review As Persona</span>
              <span className="rail-popover__count">Switch Identity</span>
            </div>
            <div className="rail-popover__list">
              {state.teamMembers?.map((member) => {
                const isCurrent = member.id === activeUser?.id;
                const isAuth = member.authority === 'Authorized Reviewer';
                return (
                  <Menu.Item nativeButton render={<Button variant="unstyled" />}
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
                  </Menu.Item>
                );
              })}
            </div>
          </Menu.Popup></Menu.Positioner></Menu.Portal>}
      </div></Menu.Root>
    </aside>
  );
}


