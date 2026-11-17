export function buildImpactGraphData(workspace, rows = []) {
  const comparison = workspace?.comparison;
  const artifacts = workspace?.artifacts || [];
  const changesByArtifactId = new Map();
  for (const change of comparison?.changes || []) {
    const match = artifacts.find(
      a => (change.targetVersionId && a.versionId === change.targetVersionId)
        || (change.baseVersionId && a.versionId === change.baseVersionId)
        || a.path === change.path
    );
    if (match) changesByArtifactId.set(match.artifactId, change.kind);
  }
  const impactedContextIds = new Set((comparison?.impacts || []).map(i => i.contextId));
  const countsByArtifact = new Map();
  const bump = (artifactId, field) => {
    if (!artifactId) return;
    const entry = countsByArtifact.get(artifactId) || { stale: 0, candidate: 0, confirmed: 0, impacted: 0 };
    entry[field] += 1;
    countsByArtifact.set(artifactId, entry);
  };
  const affectedIds = new Set(changesByArtifactId.keys());
  for (const r of rows) {
    const srcId = r.assertion?.source?.artifactId;
    const tgtId = r.assertion?.target?.artifactId;
    const validity = r.projection?.validity;
    const impacted = impactedContextIds.has(r.id) || validity === 'stale';
    if (validity === 'stale') { bump(srcId, 'stale'); bump(tgtId, 'stale'); }
    if (validity === 'candidate') { bump(srcId, 'candidate'); bump(tgtId, 'candidate'); }
    if (validity === 'confirmed') { bump(srcId, 'confirmed'); bump(tgtId, 'confirmed'); }
    if (impacted) {
      bump(srcId, 'impacted');
      bump(tgtId, 'impacted');
      if (srcId) affectedIds.add(srcId);
      if (tgtId) affectedIds.add(tgtId);
    }
  }
  const enrichNode = a => {
    const changeKind = changesByArtifactId.get(a.artifactId) || null;
    const counts = countsByArtifact.get(a.artifactId) || { stale: 0, candidate: 0, confirmed: 0, impacted: 0 };
    const impactRole = changeKind ? 'changed' : (affectedIds.has(a.artifactId) ? 'impacted' : 'normal');
    return {
      id: a.artifactId,
      title: a.identity?.title || a.path.split('/').at(-1),
      sub: a.identity?.kind === 'record'
        ? `${a.kind} record (v${a.identity.recordVersion || 1})`
        : a.path,
      category: a.kind,
      changeKind,
      impactRole,
      impactCount: counts.impacted,
      staleCount: counts.stale,
      candidateCount: counts.candidate,
      confirmedCount: counts.confirmed,
    };
  };
  return {
    changesByArtifactId,
    impactedContextIds,
    affectedIds,
    hasImpact: affectedIds.size > 0,
    enrichNode,
  };
}
