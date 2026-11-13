import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { useContinuum } from './context/ContinuumContext.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import WorkspaceSetup from './components/WorkspaceSetup.jsx';
import ReviewSummary from './components/ReviewSummary.jsx';
import AccountModule from './components/AccountModule.jsx';
import { REVIEW_IDS } from './data/workflow.js';
import Shell from './components/Shell.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Inspector from './components/Inspector.jsx';
import DashboardModule from './components/DashboardModule.jsx';
import ExploreModule from './components/ExploreModule.jsx';
import ChangesModule from './components/ChangesModule.jsx';
import CoverageModule from './components/CoverageModule.jsx';
import ChatbotModule from './components/ChatbotModule.jsx';
import ArchitectureModule from './components/ArchitectureModule.jsx';
import GovernanceModule from './components/GovernanceModule.jsx';
import RecordIntentModal from './components/RecordIntentModal.jsx';
import ImportRepoModal from './components/ImportRepoModal.jsx';
import FilesModule from './components/FilesModule.jsx';
import CodeExplorerModal from './components/CodeExplorerModal.jsx';

export default function DemoAppContent() {
  const ctx = useContinuum();
  const {
    state,
    setState,
    selectArtifact,
    closeInspector,
    closeReviewForm,
    saveJudgment,
    importModalOpen,
    openImportModal,
    closeImportModal,
    handleImportComplete,
    modalOpen,
    openModal,
    closeModal,
    handleRecordIntent,
    pendingCount,
    switchModule,
    toggleRevisionMode,
    switchActiveUser,
    theme,
    toggleTheme,
    triggerConfetti,
    showToast,
    handleSwitchRepo,
    getActiveUser,
    codeExplorerOpen,
    codeExplorerFile,
    closeCodeExplorer,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    closeCommandPalette
  } = ctx;

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase() || '';
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
      if (!ctx.session || !state.onboardingComplete) return;

      // Command palette shortcut (Cmd/Ctrl + K or / when not typing)
      if (((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') && !isTyping) {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }

      // Escape to close drawers and modals
      if (e.key === 'Escape') {
        if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
        if (codeExplorerOpen) { closeCodeExplorer(); return; }
        if (isCommandPaletteOpen) { closeCommandPalette(); return; }
        if (importModalOpen) { closeImportModal(); return; }
        if (modalOpen) { closeModal(); return; }
        if (state.reviewFormOpen) { closeReviewForm(); return; }
        if (state.inspectorOpen) { closeInspector(); return; }
      }

      // Quick judgment save shortcut (Cmd/Ctrl + Enter)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && state.reviewFormOpen) {
        e.preventDefault();
        saveJudgment();
        return;
      }

      // Arrow navigation in Changes review queue
      if (!isTyping && state.activeModule === 'changes' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const idx = REVIEW_IDS.indexOf(state.selectedArtifactId);
        const next = e.key === 'ArrowDown'
          ? (idx < REVIEW_IDS.length - 1 ? idx + 1 : 0)
          : (idx > 0 ? idx - 1 : REVIEW_IDS.length - 1);
        selectArtifact(REVIEW_IDS[next]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    ctx.session,
    state.onboardingComplete,
    codeExplorerOpen,
    closeCodeExplorer,
    importModalOpen,
    modalOpen,
    closeImportModal,
    closeModal,
    closeReviewForm,
    closeInspector,
    saveJudgment,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    closeCommandPalette,
    state.reviewFormOpen,
    state.inspectorOpen,
    state.activeModule,
    state.selectedArtifactId,
    selectArtifact
  ]);

  if (!ctx.session) return <AuthScreen onSignIn={ctx.signIn} />;
  if (!state.onboardingComplete) return <WorkspaceSetup onComplete={handleImportComplete} onCancel={ctx.signOut} />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Shell
        state={state}
        setState={setState}
        pendingCount={pendingCount}
        switchModule={switchModule}
        toggleRevisionMode={toggleRevisionMode}
        switchActiveUser={switchActiveUser}
        openModal={openModal}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenImportModal={openImportModal}
        onSwitchRepo={handleSwitchRepo}
      />

      <div className="workspace">
        <div className="workspace-body">
          <motion.main key={state.activeModule} initial={{ opacity: 0.6, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="canvas" id="main-content" tabIndex="-1">
            {(state.activeModule === 'dashboard' || state.activeModule === 'overview') && (
              <DashboardModule ctx={ctx} onOpenImportModal={openImportModal} />
            )}
            {state.activeModule === 'changes' && (
              <ChangesModule ctx={ctx} />
            )}
            {state.activeModule === 'files' && (
              <FilesModule ctx={ctx} />
            )}
            {state.activeModule === 'explore' && (
              <ExploreModule ctx={ctx} />
            )}
            {state.activeModule === 'coverage' && (
              <CoverageModule ctx={ctx} />
            )}
            {state.activeModule === 'chat' && (
              <ChatbotModule ctx={ctx} />
            )}
            {state.activeModule === 'architecture' && (
              <ArchitectureModule ctx={ctx} />
            )}
            {state.activeModule === 'summary' && <ReviewSummary ctx={ctx} />}
            {state.activeModule === 'account' && <AccountModule ctx={ctx} />}
            {state.activeModule === 'governance' && (
              <GovernanceModule ctx={ctx} showToast={showToast} />
            )}
          </motion.main>

          <AnimatePresence>
          {state.inspectorOpen && (
            <Inspector key="inspector" ctx={ctx} />
          )}
          </AnimatePresence>
        </div>
      </div>

      {modalOpen && (
        <RecordIntentModal
          state={state}
          getActiveUser={getActiveUser}
          onClose={closeModal}
          onSubmit={handleRecordIntent}
        />
      )}

      {importModalOpen && (
        <ImportRepoModal
          isOpen={importModalOpen}
          onClose={closeImportModal}
          onComplete={handleImportComplete}
          triggerConfetti={triggerConfetti}
          showToast={showToast}
          repositories={state.repositories}
        />
      )}

      {codeExplorerOpen && (
        <CodeExplorerModal
          isOpen={codeExplorerOpen}
          onClose={closeCodeExplorer}
          initialFile={codeExplorerFile}
        />
      )}

      {/* Sonner Toaster */}
      <Toaster
        position="bottom-right"
        theme={theme}
        closeButton
      />

      {/* Cmdk Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        ctx={ctx}
      />
    </div>
  );
}
