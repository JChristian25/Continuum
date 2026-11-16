import { reasonLabel } from './serviceModel.js';

/**
 * Compiles a human-readable Markdown Continuity & Change Audit Report
 * strictly from the active workspace snapshot and retained comparison facts.
 */
export function buildAuditReportMarkdown(ctx) {
  const ws = ctx.workspace;
  if (!ws) return '';
  const snap = ws.snapshot;
  const rows = ctx.rows || [];
  const repo = ctx.state?.repositories?.find(r => r.id === ctx.selection?.repositoryId);
  const repoName = repo?.fullName || snap.selection?.repositoryId || 'Repository';
  const commit = snap.selection?.targetRevision?.commitId || '';
  const baseCommit = snap.selection?.baseRevision?.commitId || '';

  const counts = {
    total: rows.length,
    confirmed: rows.filter(r => r.projection.validity === 'confirmed').length,
    rejected: rows.filter(r => r.projection.validity === 'rejected').length,
    stale: rows.filter(r => r.projection.validity === 'stale').length,
    candidate: rows.filter(r => r.projection.validity === 'candidate').length,
    retired: rows.filter(r => r.projection.validity === 'retired').length,
    pending: snap.pendingReviewCount ?? rows.filter(r => r.projection.resolution === 'open').length,
    followUps: (ws.followUps || []).length,
  };

  const lines = [
    `# Software Knowledge Continuity Audit Report`,
    ``,
    `- **Repository:** ${repoName}`,
    `- **Selected Revision:** \`${commit}\`${baseCommit ? ` (compared against baseline \`${baseCommit}\`)` : ''}`,
    `- **Snapshot ID:** \`${snap.id}\` (version ${snap.snapshotVersion}, mode: ${ws.mode})`,
    `- **Completion Status:** ${ws.completion ? `Completed at ${ws.completion.recordedAt} by ${ws.completion.actorId}` : 'In progress (not yet marked complete)'}`,
    ``,
    `## Executive Summary`,
    ``,
    `| Metric | Count |`,
    `|---|---:|`,
    `| Captured artifacts in scope | ${(ws.artifacts || []).length} |`,
    `| Total tracked relationships | ${counts.total} |`,
    `| Confirmed relationships | ${counts.confirmed} |`,
    `| Rejected relationships | ${counts.rejected} |`,
    `| Stale (needs revalidation) | ${counts.stale} |`,
    `| Open candidates remaining | ${counts.candidate} |`,
    `| Retired relationships | ${counts.retired} |`,
    `| Open follow-up work items | ${snap.openFollowUpCount ?? 0} |`,
    ``,
  ];

  if (ws.comparison) {
    lines.push(
      `## Revision Comparison Scope`,
      ``,
      `- **Base commit:** \`${ws.comparison.baseRevision?.commitId || ''}\``,
      `- **Target commit:** \`${ws.comparison.targetRevision?.commitId || ''}\``,
      `- **Changed paths detected:** ${(ws.comparison.changes || []).length}`,
      `- **Directly impacted relationships queued:** ${(ws.comparison.impacts || []).length}`,
      ``,
    );
    if ((ws.comparison.changes || []).length) {
      lines.push(`### Changed Files`, ``);
      for (const ch of ws.comparison.changes) {
        lines.push(`- \`${ch.path}\` (${ch.kind})`);
      }
      lines.push(``);
    }
  }

  lines.push(`## Relationship Decisions & Evidence`, ``);
  if (!rows.length) {
    lines.push(`No relationships are recorded in this snapshot.`, ``);
  } else {
    for (const r of rows) {
      const src = r.sourceLabel || r.sourcePath;
      const tgt = r.targetLabel || r.targetPath;
      const evCount = r.assertion?.evidenceIds?.length || 0;
      const priorReason = r.priorDecision?.reason || r.projection?.reason;
      lines.push(
        `### ${src} — *${r.assertion.type}* → ${tgt}`,
        `- **Status:** \`${r.projection.validity}\` (${r.projection.resolution}) · **Method:** \`${r.assertion.methodId}\` · **Evidence anchors:** ${evCount}`,
        ...(priorReason ? [`- **Recorded rationale:** ${reasonLabel(priorReason)}`] : []),
        ``,
      );
    }
  }

  lines.push(`## Follow-Up Work Items`, ``);
  if (!(ws.followUps || []).length) {
    lines.push(`No follow-up tasks recorded in this snapshot.`, ``);
  } else {
    for (const w of ws.followUps) {
      lines.push(`- **${w.kind.replaceAll('_', ' ')}** (\`${w.status}\`) — Context \`${w.contextId}\``);
    }
    lines.push(``);
  }

  lines.push(`## Processing Coverage & Disclosed Limitations`, ``);
  for (const c of snap.coverage || []) {
    lines.push(`- **${c.function.replaceAll('_', ' ')}:** \`${c.status}\` (${c.processedCount}/${c.eligibleCount ?? 'unknown'})`);
  }
  lines.push(``);
  for (const lim of snap.limitations || []) {
    lines.push(`- ${lim}`);
  }
  lines.push(``);
  return lines.join('\n');
}
