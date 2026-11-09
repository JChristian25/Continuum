from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
p=(PROJECT_ROOT / 'apps/web/src/components/ChangesModule.jsx'); s=p.read_text(encoding='utf-8-sig')
s=s.replace("import { CHANGE_NEIGHBOR_IDS } from '../data/state.js';", "import { REVIEW_IDS } from '../data/workflow.js';")
s=s.replace('CHANGE_NEIGHBOR_IDS', 'REVIEW_IDS')
s=s.replace('useState(true);', 'useState(false);',1)
s=s.replace("? neighbors.length\n    :", "? neighbors.filter(item => item.historyR0?.length).length\n    :")
s=s.replace("const progressPct = Math.round((reviewedCount / neighbors.length) * 100);", "const progressPct = neighbors.length ? Math.round((reviewedCount / neighbors.length) * 100) : 0;")
s=s.replace('      {/* Changed Provider Seed Box */}', '''      {state.revisionMode === 'R1' && <div className="review-loop-bar"><p><strong>{neighbors.length - reviewedCount} pending</strong> · Inspect the evidence, record your judgment, then continue to the next item.</p><div><button className="text-link" onClick={() => ctx.switchModule('summary')}>Review summary</button>{reviewedCount < neighbors.length && <button className="btn btn--accent" onClick={ctx.reviewNext}>Review next item <ChevronRight size={15} /></button>}</div></div>}

      {/* Changed Provider Seed Box */}''')
s=s.replace('All connected artifacts satisfied', "{filter === 'done' ? 'No judgments recorded yet' : 'Every queued item has a judgment'}")
s=s.replace('No remaining items in this review queue filter.', "{filter === 'done' ? 'Recorded judgments will appear here.' : 'Review completion is separate from follow-up work and unknown coverage.'}")
s=s.replace('No remaining items in this review queue filter.', '')
s=s.replace('Your recorded rationale is permanently preserved in the repository continuity audit log.', 'Your recorded rationale is saved locally in this demonstration workspace.')
s=s.replace('<strong style={{ fontSize: 14, color: \'var(--ink)\' }}>{filter', '<strong style={{ fontSize: 14, color: \'var(--ink)\' }}>{filter')
s=s.replace('              </div>\n            )}\n          </div>\n        </div>\n      </section>', '''                {filter !== 'done' && <button className="btn btn--accent" onClick={() => ctx.switchModule('summary')}>Continue to review summary <ChevronRight size={15} /></button>}
              </div>
            )}
          </div>
        </div>
      </section>''')
p.write_text(s,encoding='utf-8')
p=(PROJECT_ROOT / 'apps/web/src/components/DashboardModule.jsx'); s=p.read_text(encoding='utf-8-sig')
s=s.replace("const REVIEW_ITEMS = ['aaa.py::submitUserOrder', 'REQ-02', 'docs/onboarding_notes.md'];", "import { reviewItems, pendingItems, followUpItems } from '../data/workflow.js';")
s=s.replace('const outstanding = REVIEW_ITEMS.map(id => state.artifacts[id]).filter(Boolean);', 'const items = reviewItems(state);\n  const outstanding = pendingItems(state);\n  const openWork = followUpItems(state).filter(item => !item.followUpResolved);')
s=s.replace("const reviewed = outstanding.filter(item => item.r1Status === 'reviewed').length;", "const reviewed = items.length - outstanding.length;")
s=s.replace("current ? 'A return contract changed.'", "current ? (outstanding.length ? 'A return contract changed.' : 'Your review has a clear trail.')")
s=s.replace("onClick={() => switchModule('changes')}>{current ? 'Continue review' : 'Compare revisions'}", "onClick={() => switchModule(current && !outstanding.length ? 'summary' : 'changes')}>{current ? (outstanding.length ? 'Continue review' : 'View review summary') : 'Compare revisions'}")
s=s.replace('Math.max(outstanding.length - reviewed, 0)', 'outstanding.length')
s=s.replace('<span>1 deferred update</span>', '<span>{openWork.length} open follow-ups</span>')
s=s.replace('<h2 id="review-now-heading">Pick up where the context changed</h2>', '<h2 id="review-now-heading">{outstanding.length ? \'Pick up where the context changed\' : \'All queued relationships reviewed\'}</h2>')
s=s.replace('            {outstanding.map(item => {', "            {!outstanding.length && <div className=\"queue-empty\"><p>{reviewed} judgments recorded. Follow-up work and coverage limits remain visible in the review summary.</p><button className=\"text-link\" onClick={() => switchModule('summary')}>Review the outcome <ArrowRight size={14} /></button></div>}\n            {outstanding.map(item => {")
p.write_text(s,encoding='utf-8')
p=(PROJECT_ROOT / 'apps/web/src/components/Inspector.jsx'); s=p.read_text(encoding='utf-8-sig')
s=s.replace("import { getStatusInfo", "import { REVIEW_IDS, pendingItems } from '../data/workflow.js';\nimport { getStatusInfo",1)
s=s.replace("const authorized = isAuthorized();", "const authorized = isAuthorized();\n  const inQueue = REVIEW_IDS.includes(art.id);\n  const pending = pendingItems(state);\n  const saveNotice = state.lastSavedReview?.artifactId === art.id;")
s=s.replace("{state.revisionMode === 'R0' ? (", "{!inQueue ? (<div className=\"inline-notice\"><p>This record provides context. Relationship judgments are recorded on items in the review queue.</p></div>) : state.revisionMode === 'R0' ? (",1)
s=s.replace('                    <Button variant="secondary" size="xs" onClick={openReviewForm}>', '                    <Button disabled={!authorized} variant="secondary" size="xs" onClick={openReviewForm}>')
s=s.replace('                    <Button variant="subtle" size="xs" onClick={() => undoReview(art.id)}', '                    <Button disabled={!authorized} variant="subtle" size="xs" onClick={() => undoReview(art.id)}')
s=s.replace('                  <Button variant="default" size="sm" onClick={openReviewForm}', '                  <Button disabled={!authorized} variant="default" size="sm" onClick={openReviewForm}')
s=s.replace('Ready to record an accountable R1 judgment?', "{authorized ? 'Ready to record an accountable R1 judgment?' : 'Read-only access. You can inspect evidence and history.'}")
s=s.replace('                  {/* Footer buttons */}', '''                  {state.reviewError && <div className="form-error" role="alert">{state.reviewError}{state.simulateSaveError && <button className="text-link" onClick={() => ctx.setState(s => ({ ...s, simulateSaveError: false, reviewError: '' }))}>Turn off demo error and retry</button>}</div>}
                  {/* Footer buttons */}''')
s=s.replace('disabled={!authorized || art.draftIsAi}', 'disabled={!authorized || art.draftIsAi || !(art.draftRationale ?? art.savedRationale ?? \'\').trim()}')
# Insert continuation outside the judgment form condition, before action area closes.
s=s.replace('              )}\n            </div>\n          </div>\n        ) : (', '''              )}
              {inQueue && art.r1Status === 'reviewed' && !state.reviewFormOpen && state.revisionMode === 'R1' && <div className="saved-review-actions" role={saveNotice ? 'status' : undefined}><button className="btn btn--accent" onClick={ctx.reviewNext}>{pending.length ? `Next review (${pending.length} remaining)` : 'View review summary'}<ArrowRight size={15} /></button><button className="btn btn--secondary" onClick={closeInspector}>Back to queue</button></div>}
            </div>
          </div>
        ) : (''')
s=s.replace("style={{ borderLeft: '3px solid var(--green)', background: 'var(--ground-card)' }}", "style={{ background: 'var(--ground-card)' }}")
s=s.replace("style={{ borderLeft: '3px solid var(--border-vis)', background: 'var(--ground-card)' }}", "style={{ background: 'var(--ground-card)' }}")
s=s.replace("borderLeft: '2px solid var(--green)',", "borderLeft: '1px solid var(--green)',")
s=s.replace("            {art.historyR0?.map", '''            {art.reviewHistory?.slice(1).map(record => <div key={record.id} className="card card--p-sm"><strong>{record.actor} · R1</strong><p>{record.time}</p><p>{record.detail}</p><p>{record.rationale}</p></div>)}
            {!art.historyR0?.length && !art.reviewHistory?.length && art.r1Status !== 'reviewed' && <p>No recorded review history for this artifact yet.</p>}
            {art.historyR0?.map''')
p.write_text(s,encoding='utf-8')
p=(PROJECT_ROOT / 'apps/web/src/data/helpers.js'); s=p.read_text(encoding='utf-8-sig')
s=s.replace("if (revisionMode === 'R0') return { dot: 'dot--neutral', text: 'Accepted at R0', cls: 'status--neutral' };", "if (revisionMode === 'R0') return { dot: 'dot--neutral', text: art.historyR0?.length ? 'Recorded at R0' : 'No R0 judgment', cls: 'status--neutral' };")
p.write_text(s,encoding='utf-8')
