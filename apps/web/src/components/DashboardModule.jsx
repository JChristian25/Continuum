import { useState } from 'react';
import { ArrowRight, ChevronDown, FileCode2, FolderGit2, RefreshCw, Infinity as InfinityIcon, Search } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getStatusInfo, getWorkInfo } from '../data/helpers.js';
import { Button } from './ui/index.js';

import { reviewItems, pendingItems, followUpItems } from '../data/workflow.js';

export default function DashboardModule({ ctx, onOpenImportModal }) {
  const { state, setState, showToast, selectArtifact, switchModule, openCommandPalette } = ctx;
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const activeRepo = state.repositories?.find(repo => repo.id === state.activeRepoId);
  const user = state.teamMembers?.find(member => member.id === state.activeUserId);
  const items = reviewItems(state);
  const outstanding = pendingItems(state);
  const openWork = followUpItems(state).filter(item => !item.followUpResolved);
  const reviewed = items.length - outstanding.length;
  const current = state.revisionMode === 'R1';
  const refresh = () => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setState(value => ({ ...value, pipelineLastRun: `Re-verified at ${timestamp} (Incoming Change · 8f3b21d)`, pipelineLimitsOpen: true }));
    showToast('Review context refreshed. One scanned PDF remains disclosed as coverage unknown.');
  };

  return (
    <div className="canvas-scroll home-workspace">
      <header className="workspace-topline">
        <span>Workspace <span className="topline-divider">/</span> {current ? 'Incoming change review' : 'Baseline context'}</span>
        <button className="text-link" onClick={onOpenImportModal}><FolderGit2 size={15} /> Change workspace</button>
      </header>
      <div className="home-content">
        <section className="home-welcome">
          <InfinityIcon size={42} strokeWidth={1.5} aria-hidden="true" />
          <h1>Let’s connect the context{user?.shortName ? `, ${user.shortName.split(' ')[0]}` : ''}.</h1>
          <p>A little clarity for your next review.</p>
        </section>

        <section className="focus-brief" aria-label="Current review brief">
          <div className="focus-brief__context"><FolderGit2 size={16} /><span>{activeRepo?.fullName || 'Repository workspace'}</span><span className="cycle-label">{current ? 'Incoming Change' : 'Baseline'}</span></div>
          <h2>{current ? (outstanding.length ? 'A return contract changed.' : 'Your review has a clear trail.') : 'Your historical baseline.'}</h2>
          <p>{current ? 'Follow the change in createRequest() through its caller, requirement, and documentation. Your judgment keeps the context connected.' : 'Explore the evidence and decisions recorded in the baseline. Switch to Incoming Change in the sidebar to assess the current update.'}</p>
          <div className="focus-brief__actions">
            <Button onClick={() => switchModule(current && !outstanding.length ? 'summary' : 'changes')}>{current ? (outstanding.length ? 'Continue review' : 'View review summary') : 'Compare revisions'}<ArrowRight size={16} /></Button>
            <button className="quiet-action" onClick={refresh}><RefreshCw size={14} />Refresh context</button>
          </div>
          <div className="focus-brief__summary"><span>{current ? `${outstanding.length} items need review` : 'Historical context'}</span><span>{openWork.length} open follow-ups</span><span>1 disclosed limit</span></div>
        </section>

        <div className="home-shortcuts" aria-label="Workspace shortcuts">
          <button onClick={openCommandPalette}><Search size={16} />Find a record</button>
          <button onClick={() => switchModule('chat')}><InfinityIcon size={18} />Ask Continuum</button>
          <button onClick={() => switchModule('explore')}><FolderGit2 size={16} />Explore context</button>
        </div>

        <section className="home-review-list" aria-labelledby="review-now-heading">
          <div className="section-heading"><h2 id="review-now-heading">{outstanding.length ? 'Pick up where the context changed' : 'All queued relationships reviewed'}</h2><button className="text-link" onClick={() => switchModule('changes')}>View queue <ArrowRight size={14} /></button></div>
          <div className="worklist__items">
            {!outstanding.length && <div className="queue-empty"><p>{reviewed} judgments recorded. Follow-up work and coverage limits remain visible in the review summary.</p><button className="text-link" onClick={() => switchModule('summary')}>Review the outcome <ArrowRight size={14} /></button></div>}
            {outstanding.map(item => {
              const status = getStatusInfo(item, state.revisionMode);
              const work = getWorkInfo(item, state.revisionMode);
              return <button key={item.id} className="review-item" onClick={() => selectArtifact(item.id)}>
                <span className="review-item__icon"><FileCode2 size={19} /></span>
                <span className="review-item__body"><strong>{item.shortName}</strong><small>{item.plainReason}</small></span>
                <span className="review-item__status"><span className={`status-pill status-pill--sm ${status.cls}`}><span className={`status-dot ${status.dot}`} />{status.text}</span><small>{work.text}</small></span>
                <ArrowRight size={16} />
              </button>;
            })}
          </div>
        </section>

        <div className="home-context">
          <section><h2>Behind this change</h2><p>{state.decisionHeadline.title}</p><button className="text-link" onClick={() => selectArtifact('DEC-04')}>Read decision DEC-04 <ArrowRight size={14} /></button></section>
          <section><h2>Your judgment matters</h2><p>Evidence suggests a relationship. A reviewer confirms it. Candidate links stay unconfirmed until you record a judgment.</p></section>
        </div>
        <section className="pipeline-disclosure">
          <button onClick={() => setPipelineOpen(value => !value)} aria-expanded={pipelineOpen} aria-controls="pipeline-detail"><span><RefreshCw size={14} />How this context was prepared</span><ChevronDown size={16} style={{ transform: pipelineOpen ? 'rotate(180deg)' : undefined }} /></button>
          <AnimatePresence initial={false}>{pipelineOpen && <motion.div id="pipeline-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} style={{ overflow: 'hidden' }}><div className="pipeline-disclosure__detail">
            <div><strong>Repository collector</strong><span>24 repository files indexed for the incoming change.</span></div>
            <div><strong>Coverage limit</strong><span>One scanned PDF remains coverage unknown.</span></div>
            <div><strong>Human review</strong><span>Semantic candidates require a reviewer’s decision. Baseline judgments remain separate from the incoming change.</span></div>
            <div><strong>Last prepared</strong><span>{state.pipelineLastRun || 'Incoming change demonstration context'}</span></div>
          </div></motion.div>}</AnimatePresence>
        </section>
        <section className="activity-strip" aria-label="Recent activity"><div className="section-heading"><h2>Recent context</h2></div><div className="activity-strip__list">{state.activityLog.slice(0, 3).map((entry, index) => <div className="activity-strip__item" key={`${entry.actor}-${index}`}><span className="activity-strip__dot" /><div className="activity-strip__text"><strong>{entry.actor}</strong><span>{entry.action}</span></div><small>{entry.time}</small></div>)}</div></section>
        <footer className="demo-footnote">Continuum · Synthetic workspace. Evidence supports decisions; it does not replace them.</footer>
      </div>
    </div>
  );
}

