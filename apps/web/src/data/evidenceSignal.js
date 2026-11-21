/**
 * Ranks and annotates recorded evidence anchors for faster human triage
 * without altering the underlying frozen discovery output.
 */

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'your', 'into',
  'return', 'returns', 'true', 'false', 'none', 'code', 'file',
]);

export function tokenizeLexical(text) {
  if (typeof text !== 'string' || !text) return [];
  const split = text
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const matches = split.match(/[A-Za-z0-9]+/g) || [];
  const seen = new Set();
  const out = [];
  for (const part of matches) {
    const lower = part.toLowerCase();
    if (lower.length >= 4 && !STOP_WORDS.has(lower) && !seen.has(lower)) {
      seen.add(lower);
      out.push(lower);
    }
  }
  return out;
}

function buildTargetVocabulary(sources) {
  const vocabByVersion = new Map();
  const pathByVersion = new Map();
  for (const src of sources || []) {
    const path = src.identity?.path || src.identity?.title || '';
    pathByVersion.set(src.id, path);
    if (typeof src.content === 'string') {
      const tokens = new Set(tokenizeLexical(src.content));
      const stem = path.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
      for (const t of tokenizeLexical(stem)) tokens.add(t);
      vocabByVersion.set(src.id, tokens);
    }
  }
  return { vocabByVersion, pathByVersion };
}

/**
 * Computes human-readable signal annotations and ranks evidence items so
 * direct file references and unique identifier overlaps appear first.
 */
export function rankEvidenceItems(evidence, sources, sourceArt, targetArt) {
  if (!Array.isArray(evidence) || !evidence.length) {
    return { items: [], summary: 'No recorded anchors.', directCount: 0, tokenHistogram: [] };
  }

  const { vocabByVersion } = buildTargetVocabulary(sources);
  const sourceVersionId = sources?.[0]?.id;
  const targetVersionId = sources?.[1]?.id;
  const targetPath = targetArt?.path || '';
  const targetBase = targetPath.split('/').pop() || '';
  const sourcePath = sourceArt?.path || '';
  const sourceBase = sourcePath.split('/').pop() || '';

  // Cross-side vocabulary: tokens present in the *other* artifact.
  const otherSideTokens = new Map();
  if (sourceVersionId && targetVersionId) {
    otherSideTokens.set(sourceVersionId, vocabByVersion.get(targetVersionId) || new Set());
    otherSideTokens.set(targetVersionId, vocabByVersion.get(sourceVersionId) || new Set());
  } else {
    const union = new Set();
    for (const set of vocabByVersion.values()) {
      for (const tok of set) union.add(tok);
    }
    for (const s of sources || []) otherSideTokens.set(s.id, union);
  }

  const tokenCounts = new Map();
  const annotated = evidence.map((item, originalIndex) => {
    const excerpt = item.excerpt || '';
    const lineTokens = tokenizeLexical(excerpt);
    const counterpartVocab = otherSideTokens.get(item.artifactVersionId);
    const sharedTokens = counterpartVocab
      ? lineTokens.filter(tok => counterpartVocab.has(tok))
      : lineTokens;
    for (const tok of sharedTokens) {
      tokenCounts.set(tok, (tokenCounts.get(tok) || 0) + 1);
    }

    const lowerExcerpt = excerpt.toLowerCase();
    const mentionsTargetPath =
      (targetPath && lowerExcerpt.includes(targetPath.toLowerCase())) ||
      (targetBase && lowerExcerpt.includes(targetBase.toLowerCase()));
    const mentionsSourcePath =
      (sourcePath && lowerExcerpt.includes(sourcePath.toLowerCase())) ||
      (sourceBase && lowerExcerpt.includes(sourceBase.toLowerCase()));
    const isFieldPath = item.locator?.kind === 'field';
    const isDirect = mentionsTargetPath || mentionsSourcePath || isFieldPath;

    let signalTier = 3;
    let signalLabel = 'Lexical overlap';
    if (isDirect) {
      signalTier = 1;
      signalLabel = isFieldPath ? 'Filename match' : 'Direct file mention';
    } else if (sharedTokens.length >= 2) {
      signalTier = 2;
      signalLabel = `${sharedTokens.length} shared terms`;
    } else if (sharedTokens.length === 1) {
      signalTier = 2;
      signalLabel = `Matched term: ${sharedTokens[0]}`;
    }

    const hasSnakeOrCamel = sharedTokens.some(tok => excerpt.includes(`${tok}_`) || excerpt.includes(`_${tok}`));
    const specificityBoost = (sharedTokens.length * 4) + (hasSnakeOrCamel ? 3 : 0) + (item.availability === 'available' ? 2 : 0);

    return {
      ...item,
      signalTier,
      signalLabel,
      sharedTokens: sharedTokens.slice(0, 6),
      isDirect,
      _score: (4 - signalTier) * 100 + specificityBoost,
      _idx: originalIndex,
    };
  });

  annotated.sort((a, b) => (b._score - a._score) || (a._idx - b._idx));

  const directCount = annotated.filter(i => i.isDirect).length;
  const topTokens = [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([token, count]) => ({ token, count }));

  const parts = [];
  if (directCount > 0) parts.push(`${directCount} direct path/filename ${directCount === 1 ? 'mention' : 'mentions'}`);
  if (topTokens.length > 0) parts.push(`top shared terms: ${topTokens.slice(0, 4).map(t => t.token).join(', ')}`);
  const summary = parts.length
    ? `Ranked by signal: ${parts.join(' · ')}.`
    : 'Ranked by recorded locator and excerpt availability.';

  return { items: annotated, summary, directCount, tokenHistogram: topTokens };
}

/**
 * Finds the narrowest structural symbol or Markdown section containing an evidence locator.
 */
export function findEnclosingStructureItem(structureItems, locator) {
  if (!Array.isArray(structureItems) || !structureItems.length || locator?.kind !== 'lines') {
    return null;
  }
  const start = Number(locator.startLine || 0);
  if (!start) return null;
  const matches = structureItems.filter(
    item => Number(item.startLine) <= start && start <= Number(item.endLine)
  );
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const spanA = (Number(a.endLine) - Number(a.startLine));
    const spanB = (Number(b.endLine) - Number(b.startLine));
    if (spanA !== spanB) return spanA - spanB;
    return (Number(b.level || 0) - Number(a.level || 0));
  });
  const best = matches[0];
  if (best.kind === 'section') {
    return { ...best, label: `§ ${best.name}` };
  }
  if (best.kind === 'code_block') {
    return { ...best, label: `in \`\`\`${best.name}` };
  }
  return { ...best, label: `in ${best.qualifiedName || best.name}()` };
}

/**
 * Resolves the structural symbol/section label for an evidence anchor.
 * When evidence is unresolved after a change, attributes lines to the prior
 * version's AST/Markdown structure instead of misattributing to shifted target lines.
 */
export function resolveEvidenceEnclosingLabel(evidenceItem, sourceObjById, priorVersionByCurrentId) {
  if (!evidenceItem) return null;
  if (evidenceItem.availability === 'available') {
    const current = sourceObjById?.get(evidenceItem.artifactVersionId);
    const hit = findEnclosingStructureItem(current?.structure?.items, evidenceItem.locator);
    return hit ? { ...hit, isUnresolved: false } : null;
  }
  const priorVersionId = priorVersionByCurrentId?.get(evidenceItem.artifactVersionId);
  if (!priorVersionId) return null;
  const prior = sourceObjById?.get(priorVersionId);
  const hit = findEnclosingStructureItem(prior?.structure?.items, evidenceItem.locator);
  return hit ? { ...hit, label: `Prior: ${hit.label}`, isUnresolved: true } : null;
}

/**
 * Classifies a relationship candidate into high, moderate, or low signal tiers
 * without suppressing or rewriting underlying discovery records.
 */
export function classifyCandidateSignal(row, allRows = []) {
  if (!row?.assertion) {
    return { tier: 'moderate', label: 'Moderate', reason: 'Standard relationship context', topTokens: [] };
  }
  const type = row.assertion.type;
  const methodId = row.assertion.methodId;
  const validity = row.projection?.validity;
  const meta = row.signalMeta || null;
  const topTokens = Array.isArray(meta?.topTokens) ? meta.topTokens : [];
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  const evCount = evidence.length;
  const hasField = evidence.some(e => e.locator?.kind === 'field');

  if (type !== 'documents') {
    return { tier: 'high', label: 'High signal', reason: `Typed authored ${type} link`, topTokens };
  }
  if (methodId && methodId !== 'lexical-file-v1') {
    return { tier: 'high', label: 'High signal', reason: 'Manual or comparison-verified anchor', topTokens };
  }
  if (validity === 'confirmed' || validity === 'stale') {
    return { tier: 'high', label: 'High signal', reason: 'Confirmed or impacted by revision change', topTokens };
  }
  if (meta?.hasExplicitPath || hasField) {
    return { tier: 'high', label: 'High signal', reason: 'Explicit file path or filename anchor', topTokens };
  }

  if (meta && typeof meta.uniqueTokenCount === 'number') {
    const unique = meta.uniqueTokenCount;
    const rare = Number(meta.rareTokenCount || 0);
    const stem = Boolean(meta.stemOverlap);
    if ((unique >= 12 && rare >= 4) || (stem && unique >= 6)) {
      return {
        tier: 'high',
        label: 'High signal',
        reason: stem ? `Filename & ${unique} shared terms` : `${rare} specific shared terms`,
        topTokens,
      };
    }
    if ((unique >= 5 && evCount >= 8 && rare >= 2) || (unique >= 3 && allRows.length <= 6 && rare >= 1)) {
      return {
        tier: 'moderate',
        label: 'Moderate',
        reason: `${unique} shared terms (${evCount} anchors)`,
        topTokens,
      };
    }
    return {
      tier: 'low',
      label: 'Low signal',
      reason: unique <= 2
        ? `Only ${unique} generic token${unique === 1 ? '' : 's'}`
        : `Weak lexical overlap (${evCount} anchors)`,
      topTokens,
    };
  }

  if (evCount >= 40) {
    return { tier: 'high', label: 'High signal', reason: `${evCount} lexical anchors`, topTokens };
  }
  if (evCount >= 12) {
    return { tier: 'moderate', label: 'Moderate', reason: `${evCount} lexical anchors`, topTokens };
  }
  return { tier: 'low', label: 'Low signal', reason: `Weak lexical overlap (${evCount} anchors)`, topTokens };
}

const DEPENDENCY_MANIFEST_NAMES = new Set([
  'requirements.txt',
  'requirements-dev.txt',
  'requirements-test.txt',
  'requirements-prod.txt',
  'constraints.txt',
  'pipfile',
  'pipfile.lock',
  'pyproject.toml',
  'poetry.lock',
  'setup.cfg',
  'setup.py',
  'package.json',
  'package-lock.json',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
]);

export function isDependencyManifestPath(path) {
  if (typeof path !== 'string' || !path) return false;
  const base = path.split('/').pop()?.toLowerCase() || '';
  if (DEPENDENCY_MANIFEST_NAMES.has(base)) return true;
  if (base.startsWith('requirements') && (base.endsWith('.txt') || base.endsWith('.in'))) return true;
  if (base.startsWith('constraints') && base.endsWith('.txt')) return true;
  return false;
}

const MEANING_SPECS = {
  documents: {
    label: 'documents',
    title: 'Prose documentation (documents)',
    verb: 'document',
    summary: 'Source prose explains, specifies, or illustrates behavior implemented in target code.',
  },
  depends_on: {
    label: 'depends_on',
    title: 'Package or configuration dependency (depends_on)',
    verb: 'declare a dependency used by',
    summary: 'Source manifest or module declares a package, runtime, or configuration dependency required by target code.',
  },
  implements: {
    label: 'implements',
    title: 'Requirement implementation (implements)',
    verb: 'implement',
    summary: 'Source code realizes the behavior specified in the target requirement record.',
  },
  motivates: {
    label: 'motivates',
    title: 'Architectural motivation (motivates)',
    verb: 'motivate',
    summary: 'Source architectural decision justifies the design or implementation in target code.',
  },
};

/**
 * Separates (1) observed lexical/anchor evidence from (2) the semantic meaning
 * claimed by the relationship type and (3) the human review judgment, and detects
 * semantic mismatches (such as a dependency manifest labeled `documents`).
 */
export function analyzeRelationshipMeaning(detail, sourceArt, targetArt, ranked) {
  if (!detail?.assertion) return null;
  const type = detail.assertion.type || 'documents';
  const methodId = detail.assertion.methodId || 'lexical-file-v1';
  const validity = detail.projection?.validity || 'candidate';
  const spec = MEANING_SPECS[type] || {
    label: type,
    title: type,
    verb: type,
    summary: `Typed ${type} relationship between source and target artifacts.`,
  };

  const srcPath = sourceArt?.path || sourceArt?.identity?.title || detail.assertion.source?.artifactId || 'source';
  const tgtPath = targetArt?.path || targetArt?.identity?.title || detail.assertion.target?.artifactId || 'target';
  const srcShort = srcPath.split('/').pop() || srcPath;
  const tgtShort = tgtPath.split('/').pop() || tgtPath;
  const topTokens = (ranked?.tokenHistogram || []).slice(0, 4).map(t => t.token);

  const evidenceItems = Array.isArray(detail.evidence) ? detail.evidence : [];
  const hasPackagePinExcerpt = evidenceItems.some(e =>
    typeof e.excerpt === 'string' && /^[A-Za-z0-9_.-]+\s*(?:==|>=|<=|~=|!=|>|<)\s*[0-9A-Za-z_.*+-]+/m.test(e.excerpt.trim())
  );
  const hasImportExcerpt = evidenceItems.some(e =>
    typeof e.excerpt === 'string' && /^\s*(?:from\s+[A-Za-z0-9_.]+\s+import\s+|import\s+[A-Za-z0-9_.]+)/m.test(e.excerpt)
  );
  const manifestSource = isDependencyManifestPath(srcPath);

  let evidenceBasis;
  if (methodId === 'lexical-file-v1') {
    const tokenList = topTokens.length ? topTokens.join(', ') : 'shared identifiers';
    evidenceBasis = {
      kind: 'lexical',
      badge: 'Automated lexical evidence',
      summary: hasPackagePinExcerpt && hasImportExcerpt
        ? `Lexical match on "${tokenList}": ${srcShort} declares a package pin while ${tgtShort} imports that package. Lexical co-occurrence does not by itself verify a "${type}" meaning.`
        : `Automated token overlap (${tokenList}). Proves identifier co-occurrence across files only — human judgment is required to establish semantic meaning.`,
    };
  } else if (methodId === 'direct-path-comparison-v1') {
    evidenceBasis = {
      kind: 'comparison',
      badge: 'Revision comparison carry-over',
      summary: 'Carried forward from baseline snapshot; endpoint bytes changed in the target commit.',
    };
  } else {
    evidenceBasis = {
      kind: 'manual',
      badge: 'Reviewer-authored anchor',
      summary: `Explicitly anchored to selected lines by a reviewer (${methodId}).`,
    };
  }

  const effectiveEvent = (detail.history?.items || []).find(
    e => e.id === detail.projection?.effectiveJudgmentEventId
  ) || (detail.history?.items || []).find(e => e.type === 'judgment' && !e.reversedByEventId);
  const recordedReason = (effectiveEvent?.reason || detail.priorDecision?.reason || '').trim();
  const recordedActor = effectiveEvent?.actorId || detail.priorDecision?.actorDisplayName || detail.priorDecision?.actorId || 'reviewer';

  let judgmentStatus;
  if (validity === 'confirmed') {
    judgmentStatus = {
      hasRationale: Boolean(recordedReason),
      actor: recordedActor,
      reason: recordedReason,
      summary: recordedReason
        ? `Confirmed by ${recordedActor}: "${recordedReason}"`
        : `Marked confirmed by ${recordedActor} without a recorded written rationale.`,
    };
  } else if (validity === 'stale') {
    judgmentStatus = {
      hasRationale: Boolean(recordedReason),
      actor: recordedActor,
      reason: recordedReason,
      summary: 'Previously confirmed link flagged stale by an endpoint change; requires human revalidation.',
    };
  } else if (validity === 'candidate') {
    judgmentStatus = {
      hasRationale: false,
      actor: null,
      reason: '',
      summary: 'Unconfirmed candidate — awaiting human verification of both evidence and relationship meaning.',
    };
  } else {
    judgmentStatus = {
      hasRationale: Boolean(recordedReason),
      actor: recordedActor,
      reason: recordedReason,
      summary: `Marked ${validity}${recordedReason ? `: "${recordedReason}"` : '.'}`,
    };
  }

  let mismatchWarning = null;
  if (type === 'documents' && (manifestSource || (hasPackagePinExcerpt && hasImportExcerpt))) {
    const primaryTok = topTokens[0] || 'package';
    mismatchWarning = {
      suggestedType: 'depends_on',
      headline: validity === 'confirmed'
        ? 'Semantic meaning warning: confirmed as "documents", but evidence shows a package dependency'
        : 'Semantic meaning warning: proposed as "documents", but evidence shows a package dependency',
      explanation: `${srcShort} declares the "${primaryTok}" package dependency while ${tgtShort} imports it. That lexical match establishes a dependency relationship (depends_on), not prose documentation (documents).`,
      defaultReason: `${srcShort} declares package dependency (${primaryTok}) imported by ${tgtShort}; correcting relationship meaning from documents to depends_on.`,
    };
  }

  return {
    type,
    spec,
    srcShort,
    tgtShort,
    question: `Does ${srcShort} ${spec.verb} ${tgtShort}?`,
    evidenceBasis,
    judgmentStatus,
    mismatchWarning,
  };
}

