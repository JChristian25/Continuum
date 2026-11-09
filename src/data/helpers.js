export function getStatusInfo(art, revisionMode) {
  if (revisionMode === 'R0') return { dot: 'dot--neutral', text: art.historyR0?.length ? 'Recorded in Baseline' : 'No baseline record', cls: 'status--neutral' };
  if (art.r1Status === 'reviewed') return { dot: 'dot--green', text: 'Reviewed with change', cls: 'status--green' };
  if (art.r1Status === 'candidate') return { dot: 'dot--indigo', text: 'Candidate link', cls: 'status--indigo' };
  if (art.r1Status === 'historical') return { dot: 'dot--neutral', text: 'Coverage unknown', cls: 'status--neutral' };
  return { dot: 'dot--amber', text: 'Needs review with change', cls: 'status--amber' };
}

export function getWorkInfo(art, revisionMode) {
  if (revisionMode === 'R0') return { dot: 'dot--neutral', text: 'Baseline', cls: 'status--neutral' };
  const w = art.followUpWork || 'No edit needed';
  if (w === 'Code update open') return { dot: 'dot--red', text: 'Code update open', cls: 'status--red' };
  if (w === 'Doc update deferred') return { dot: 'dot--amber', text: 'Doc update deferred', cls: 'status--amber' };
  return { dot: 'dot--green', text: 'No edit needed', cls: 'status--green' };
}

export function getCoverageInfo(art) {
  const c = art.coverageCondition;
  if (c === 'reviewed') return { dot: 'dot--green', text: 'Reviewed Support', cls: 'status--green' };
  if (c === 'attention') return { dot: 'dot--amber', text: 'Needs Attention', cls: 'status--amber' };
  if (c === 'candidate') return { dot: 'dot--indigo', text: 'Candidate Only', cls: 'status--indigo' };
  if (c === 'no_link') return { dot: 'dot--red', text: 'No Known Documentation', cls: 'status--red' };
  return { dot: 'dot--neutral', text: 'Coverage Unknown', cls: 'status--neutral' };
}
