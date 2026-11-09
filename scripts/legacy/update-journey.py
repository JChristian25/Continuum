from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
p=(PROJECT_ROOT / 'apps/web/src/App.jsx'); s=p.read_text(encoding='utf-8-sig')
s=s.replace("import Shell from", "import AuthScreen from './components/AuthScreen.jsx';\nimport WorkspaceSetup from './components/WorkspaceSetup.jsx';\nimport ReviewSummary from './components/ReviewSummary.jsx';\nimport AccountModule from './components/AccountModule.jsx';\nimport { REVIEW_IDS } from './data/workflow.js';\nimport Shell from")
s=s.replace("import { CHANGE_NEIGHBOR_IDS } from './data/state.js';\n", '')
s=s.replace('CHANGE_NEIGHBOR_IDS', 'REVIEW_IDS')
s=s.replace("const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';", "const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;\n      if (!ctx.session || !state.onboardingComplete) return;")
s=s.replace('    codeExplorerOpen,\n    closeCodeExplorer,\n    importModalOpen,', '    ctx.session,\n    state.onboardingComplete,\n    codeExplorerOpen,\n    closeCodeExplorer,\n    importModalOpen,')
s=s.replace('  return (\n    <div style=', "  if (!ctx.session) return <AuthScreen onSignIn={ctx.signIn} />;\n  if (!state.onboardingComplete) return <WorkspaceSetup onComplete={handleImportComplete} onCancel={ctx.signOut} />;\n\n  return (\n    <div style=", 1)
s=s.replace("{state.activeModule === 'governance' && (", "{state.activeModule === 'summary' && <ReviewSummary ctx={ctx} />}\n            {state.activeModule === 'account' && <AccountModule ctx={ctx} />}\n            {state.activeModule === 'governance' && (")
# one toast system rather than duplicate overlay + sonner
start=s.index('      {toast && ('); end=s.index('      <div className="workspace">', start); s=s[:start]+s[end:]
s=s.replace("import Toast from './components/Toast.jsx';\n", '').replace('    toast,\n    hideToast,\n', '')
p.write_text(s, encoding='utf-8')
p=(PROJECT_ROOT / 'apps/web/src/components/Shell.jsx'); s=p.read_text(encoding='utf-8-sig')
s=s.replace('ShieldCheck, Sun, Users', 'ShieldCheck, Sun, Users, ClipboardCheck, Settings')
s=s.replace("  { id: 'files',", "  { id: 'summary', label: 'Review summary', helper: 'Judgments, follow-up work, and review history', icon: ClipboardCheck },\n  { id: 'files',")
s=s.replace("  { id: 'governance', label:", "  { id: 'account', label: 'Account & demo settings', helper: 'Session, access, and sign out', icon: Settings },\n  { id: 'governance', label:")
s=s.replace("disabled={repoOpen}", "disabled={repoOpen}")
s=s.replace('className={`rail-popover__item ${isCurrent ? \'is-current\' : \'\'}`}\n                    onClick={() => { onSwitchRepo', 'className={`rail-popover__item ${isCurrent ? \'is-current\' : \'\'}`}\n                    disabled={repo.id !== \'repo-checkout\'}\n                    onClick={() => { onSwitchRepo')
s=s.replace('{repo.stats?.nodes || 0} nodes · {repo.branch}', "{repo.id === 'repo-checkout' ? `${repo.stats?.nodes || 0} nodes · ${repo.branch}` : 'Preview only · no review dataset'}")
p.write_text(s, encoding='utf-8')
p=(PROJECT_ROOT / 'apps/web/src/context/ContinuumContext.jsx'); s=p.read_text().replace("'user-sam'", "'user-sr'"); p.write_text(s,encoding='utf-8')
