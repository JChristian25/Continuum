import { useEffect } from 'react';
import {
  FileCode,
  X,
  Eye,
  History,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Copy,
  RotateCcw,
  Shield,
  ShieldAlert,
  Bookmark,
  Layers,
  Code2
} from 'lucide-react';
import { motion } from 'motion/react';
import { REVIEW_IDS, pendingItems } from '../data/workflow.js';
import { getStatusInfo, getWorkInfo } from '../data/helpers.js';
import Tooltip from './Tooltip.jsx';
import { Button, Badge, Textarea, Tabs, TabsList, TabsTrigger } from './ui/index.js';

export default function Inspector({ ctx }) {
  const {
    state,
    closeInspector,
    switchInspectorTab,
    openReviewForm,
    closeReviewForm,
    setFormJudgmentChoice,
    setFormFollowUpWork,
    handleRationaleInput,
    reuseDec04Rationale,
    suggestAiDraft,
    confirmAiDraft,
    saveJudgment,
    undoReview,
    getActiveUser,
    isAuthorized,
    toggleRevisionMode,
    selectArtifact,
    openCodeExplorer
  } = ctx;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeInspector();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeInspector]);

  const art = state.artifacts[state.selectedArtifactId] || state.artifacts['aaa.py::submitUserOrder'];
  if (!art) return null;

  const statusInfo = getStatusInfo(art, state.revisionMode);
  const workInfo = getWorkInfo(art, state.revisionMode);
  const user = getActiveUser();
  const authorized = isAuthorized();
  const inQueue = REVIEW_IDS.includes(art.id);
  const pending = pendingItems(state);
  const saveNotice = state.lastSavedReview?.artifactId === art.id;

  const excerptLines = state.revisionMode === 'R0' ? art.codeExcerptR0 : art.codeExcerptR1;

  const judgments = [
    { title: 'Confirm valid with change', icon: CheckCircle2, cls: 'status--green' },
    { title: 'Keep link · Flag content issue', icon: AlertCircle, cls: 'status--amber' },
    { title: 'Reject candidate', icon: X, cls: 'status--red' },
    { title: 'Retire relationship', icon: RotateCcw, cls: 'status--neutral' }
  ];

  const dispositions = [
    'No edit needed',
    'Code update open',
    'Doc update deferred'
  ];

  const historyCount = (art.historyR0 ? art.historyR0.length : 0) + (art.r1Status === 'reviewed' ? 1 : 0);

  return (
    <motion.aside
      className="inspector"
      aria-label="Artifact Context Inspector"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
    >
      {/* Header */}
      <div className="inspector__header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge variant="neutral" size="xs" className="font-mono">{art.category}</Badge>
            <Badge variant="accent" size="xs" className="font-mono">
              {state.revisionMode === 'R0' ? 'Baseline · a41c90e' : 'Incoming Change · 8f3b21d'}
            </Badge>
          </div>
          <button
            type="button"
            className="inspector__close"
            onClick={closeInspector}
            aria-label="Close inspector drawer (Escape)"
            title="Close inspector (Escape)"
          >
            <X size={15} />
          </button>
        </div>

        <h2 className="inspector__title">{art.name}</h2>
        <div className="inspector__meta font-mono" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileCode size={13} color="var(--ink-3)" />
          <span>{art.file}</span>
        </div>

        {/* Tab switch */}
        <div className="mt-3">
          <Tabs value={state.inspectorTab} onValueChange={switchInspectorTab}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="reading" className="gap-1.5 text-[11.5px]">
                <Eye size={13} />
                <span>Evidence &amp; Context</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-[11.5px]">
                <History size={13} />
                <span>Revision History ({historyCount})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Body */}
      <div className="inspector__body">
        {state.inspectorTab === 'reading' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status and Disposition Pills */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span className={`status-pill ${statusInfo.cls}`}>
                <span className={`status-dot ${statusInfo.dot}`} />
                <span>{statusInfo.text}</span>
              </span>
              <span className={`status-pill ${workInfo.cls}`}>
                <span className={`status-dot ${workInfo.dot}`} />
                <span>{workInfo.text}</span>
              </span>
            </div>

            {/* Why connected explanation */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Why this is connected ({art.relLabel})
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, margin: 0 }}>
                {art.plainReason}
              </p>
            </div>

            {/* Source / Doc excerpt */}
              <div className="code-box">
                <div className="code-box__header">
                  <span className="font-mono">{art.file}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {openCodeExplorer && (
                      <Tooltip title="GitHub File & Symbols Viewer" content="Open source file with live Tree-sitter symbols drawer" shortcut="R" side="top">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            const target = art.file?.includes('/') ? art.file : (art.file === 'aaa.md' ? 'docs/aaa.md' : `src/${art.file || 'bbb.py'}`);
                            openCodeExplorer(target);
                          }}
                          className="h-6 gap-1 px-2 text-[11px]"
                        >
                          <Code2 size={12} />
                          <span>Full File &amp; Symbols</span>
                        </Button>
                      </Tooltip>
                    )}
                    <span className="font-mono">{state.revisionMode === 'R0' ? 'Baseline · a41c90e' : 'Incoming Change · 8f3b21d'}</span>
                  </div>
                </div>
              <div className="code-box__body">
                {excerptLines?.map((line, idx) => (
                  <div key={idx} className={`code-line ${line.hl ? 'code-line--hl' : ''}`}>
                    <span className="code-line__num">{line.ln}</span>
                    <span className="code-line__text font-mono">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Design Intent card */}
            <div className="card card--p-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--ground-sunken)' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Bookmark size={11} color="var(--accent)" />
                  <span>Linked Design Intent</span>
                </span>
                <strong style={{ fontSize: 12, color: 'var(--ink)', display: 'block', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {art.linkedIntentTitle}
                </strong>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => selectArtifact(art.linkedIntentId)}
                className="shrink-0 gap-1"
              >
                <span>Inspect</span>
                <ArrowRight size={11} />
              </Button>
            </div>

            {/* Provenance details (collapsible) */}
            <details style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--ground-sunken)', padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} color="var(--accent)" />
                  <span>Provenance &amp; Analysis Details</span>
                </div>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  AST &amp; Similarity
                </span>
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div>
                  <strong style={{ color: 'var(--ink)' }}>Discovery method: </strong>
                  <span style={{ color: 'var(--ink-2)' }}>{art.provenanceMethod}</span>
                </div>
                <div>
                  <strong style={{ color: 'var(--ink)' }}>Evidence anchor: </strong>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', background: 'var(--ground-card)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                    {art.provenanceAnchor}
                  </code>
                </div>
                <div>
                  <strong style={{ color: 'var(--ink)' }}>Signal / score: </strong>
                  <span style={{ color: 'var(--ink-2)' }}>{art.provenanceScore}</span>
                </div>
                <div>
                  <strong style={{ color: 'var(--ink)' }}>Analysis boundary: </strong>
                  <span style={{ color: 'var(--ink-2)' }}>{art.provenanceNote}</span>
                </div>
              </div>
            </details>

            {/* Action Area */}
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              {!inQueue ? (<div className="inline-notice"><p>This record provides context. Relationship judgments are recorded on items in the review queue.</p></div>) : state.revisionMode === 'R0' ? (
                <div className="card card--p-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--ground-sunken)' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    Viewing historical <strong>Baseline</strong>. Switch to Incoming Change to record judgments.
                  </span>
                  <Button variant="secondary" size="sm" onClick={toggleRevisionMode}>
                    Switch to Incoming Change
                  </Button>
                </div>
              ) : art.r1Status === 'reviewed' && !state.reviewFormOpen ? (
                <div style={{ padding: 14, borderRadius: 'var(--r-md)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={14} />
                      <span>Reviewed with change (8f3b21d)</span>
                    </span>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {art.r1Reviewer || 'JC Linaban'} · {art.r1ReviewedAt || 'Today'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)' }}>
                    Judgment: <strong style={{ color: 'var(--green)' }}>{art.judgmentChoice}</strong>
                    <span style={{ margin: '0 6px', color: 'var(--ink-3)' }}>·</span>
                    Work: <strong>{art.followUpWork}</strong>
                  </div>
                  <blockquote style={{ margin: 0, paddingLeft: 10, borderLeft: '1px solid var(--green)', fontSize: 12, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{art.savedRationale}"
                  </blockquote>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6 }}>
                    <Button disabled={!authorized} variant="secondary" size="xs" onClick={openReviewForm}>
                      Edit judgment…
                    </Button>
                    <Button disabled={!authorized} variant="subtle" size="xs" onClick={() => undoReview(art.id)} className="text-[var(--amber)]">
                      Undo review
                    </Button>
                  </div>
                </div>
              ) : !state.reviewFormOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    {authorized ? 'Ready to record an accountable review judgment?' : 'Read-only access. You can inspect evidence and history.'}
                  </span>
                  <Button disabled={!authorized} variant="default" size="sm" onClick={openReviewForm} className="gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Record judgment…</span>
                  </Button>
                </div>
              ) : (
                <div style={{ padding: 14, borderRadius: 'var(--r-md)', background: 'var(--ground-sunken)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={14} color="var(--accent)" />
                      <span>Human Review &amp; Governance Form</span>
                    </span>
                    <Button variant="subtle" size="xs" onClick={closeReviewForm}>
                      Collapse
                    </Button>
                  </div>

                  {!authorized && (
                    <div style={{ padding: 10, borderRadius: 'var(--r-sm)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldAlert size={15} className="shrink-0" />
                      <span>Active persona <strong>{user?.name} ({user?.roleTitle})</strong> has <strong>Read-Only</strong> authority. Switch personas to save.</span>
                    </div>
                  )}

                  {/* 1. Judgment Choice */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>
                      1. Relationship Judgment (Incoming Change · 8f3b21d)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                      {judgments.map(j => {
                        const active = art.judgmentChoice === j.title;
                        const Icon = j.icon;
                        const tooltipsMap = {
                          'Confirm valid with change': 'Confirm candidate relationship remains valid under the incoming change',
                          'Keep link · Flag content issue': 'Maintain relationship link in graph but flag downstream update needed',
                          'Reject candidate': 'Mark relationship invalid or incompatible with the incoming change',
                          'Retire relationship': 'Permanently deprecate obsolete relationship'
                        };
                        return (
                          <Tooltip key={j.title} title={j.title} content={tooltipsMap[j.title] || ''} side="top">
                            <Button
                              type="button"
                              disabled={!authorized}
                              variant={active ? 'default' : 'secondary'}
                              size="xs"
                              onClick={() => setFormJudgmentChoice(j.title)}
                              className="justify-start gap-1.5 text-[11px] h-8 px-2.5"
                            >
                              <Icon size={12} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</span>
                            </Button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Follow-Up Work Disposition */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>
                      2. Independent Follow-Up Work Disposition
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {dispositions.map(d => {
                        const active = art.followUpWork === d;
                        const dispTooltips = {
                          'No edit needed': 'No downstream modifications required',
                          'Code update open': 'Requires updating caller implementation',
                          'Doc update deferred': 'Postponed documentation update task'
                        };
                        return (
                          <Tooltip key={d} title={d} content={dispTooltips[d] || ''} side="top">
                            <Button
                              type="button"
                              disabled={!authorized}
                              variant={active ? 'default' : 'secondary'}
                              size="xs"
                              onClick={() => setFormFollowUpWork(d)}
                              className="text-[11px] h-8 px-2"
                            >
                              {d}
                            </Button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Recorded Rationale */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                      <label htmlFor="insp-rationale" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>
                        3. Recorded Rationale {state.policies?.requireRationale ? <span style={{ color: 'var(--amber)' }}>(required)</span> : '(optional)'}
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Tooltip title="Reuse DEC-04 Rationale" content="Populate with context from approved Decision DEC-04" side="top">
                          <Button
                            type="button"
                            disabled={!authorized}
                            variant="subtle"
                            size="xs"
                            onClick={reuseDec04Rationale}
                            className="h-6 gap-1 px-1.5 text-[11px] text-[var(--accent)]"
                          >
                            <Copy size={11} />
                            <span>+ Reuse DEC-04</span>
                          </Button>
                        </Tooltip>
                        {state.policies?.allowAiDrafts && (
                          <Tooltip title="AI Rationale Draft" content="Synthesize candidate rationale from AST contract diff" side="top">
                            <Button
                              type="button"
                              disabled={!authorized}
                              variant="subtle"
                              size="xs"
                              onClick={suggestAiDraft}
                              className="h-6 gap-1 px-1.5 text-[11px] text-[var(--ink-2)]"
                            >
                              <Sparkles size={11} />
                              <span>Suggest draft</span>
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {art.draftIsAi && (
                      <div style={{ padding: 8, borderRadius: 'var(--r-sm)', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--amber)', marginBottom: 6 }}>
                        <span><strong>AI Draft Inserted</strong> — Confirm or edit before saving.</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={confirmAiDraft}
                          className="h-6 px-2 text-[11px]"
                        >
                          Confirm draft
                        </Button>
                      </div>
                    )}

                    <Textarea
                      id="insp-rationale"
                      rows={3}
                      disabled={!authorized}
                      placeholder="Explain why this relationship is valid, needs follow-up work, or should be rejected…"
                      value={art.draftRationale ?? art.savedRationale ?? ''}
                      onChange={(e) => handleRationaleInput(e.target.value)}
                    />
                  </div>

                  {state.reviewError && <div className="form-error" role="alert">{state.reviewError}{state.simulateSaveError && <button className="text-link" onClick={() => ctx.setState(s => ({ ...s, simulateSaveError: false, reviewError: '' }))}>Turn off demo error and retry</button>}</div>}
                  {/* Footer buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      Reviewer: <strong>{user?.shortName || 'Reviewer'}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                        Cmd+Enter to save
                      </span>
                      <Button type="button" variant="secondary" size="xs" onClick={closeReviewForm}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={!authorized || art.draftIsAi || !(art.draftRationale ?? art.savedRationale ?? '').trim()}
                        onClick={saveJudgment}
                      >
                        Save review judgment
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {inQueue && art.r1Status === 'reviewed' && !state.reviewFormOpen && state.revisionMode === 'R1' && <div className="saved-review-actions" role={saveNotice ? 'status' : undefined}><button className="btn btn--accent" onClick={ctx.reviewNext}>{pending.length ? `Next review (${pending.length} remaining)` : 'View review summary'}<ArrowRight size={15} /></button><button className="btn btn--secondary" onClick={closeInspector}>Back to queue</button></div>}
            </div>
          </div>
        ) : (
          /* Tab 2: Revision History */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              Revision-aware audit trail for <strong>{art.shortName}</strong> across repository releases.
            </div>

            {art.r1Status === 'reviewed' && (
              <div className="card card--p-sm" style={{ background: 'var(--ground-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
                  <Badge variant="success" size="xs" className="font-mono">Incoming Change · 8f3b21d</Badge>
                  <span>{art.r1ReviewedAt || 'Just now'}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink)', marginBottom: 4 }}>
                  Reviewed by {art.r1Reviewer || 'JC Linaban'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                  Judgment: <strong>{art.judgmentChoice}</strong> · Follow-up: <strong>{art.followUpWork}</strong>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink)', fontStyle: 'italic', marginTop: 4 }}>
                  "{art.savedRationale}"
                </div>
              </div>
            )}

            {art.reviewHistory?.slice(1).map(record => <div key={record.id} className="card card--p-sm"><strong>{record.actor} · Incoming Change</strong><p>{record.time}</p><p>{record.detail}</p><p>{record.rationale}</p></div>)}
            {!art.historyR0?.length && !art.reviewHistory?.length && art.r1Status !== 'reviewed' && <p>No recorded review history for this artifact yet.</p>}
            {art.historyR0?.map((h, idx) => (
              <div key={idx} className="card card--p-sm" style={{ background: 'var(--ground-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
                  <Badge variant="neutral" size="xs" className="font-mono">{h.rev}</Badge>
                  <span>{h.time}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink)', marginBottom: 4 }}>
                  {h.action} by {h.actor}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                  {h.detail}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
