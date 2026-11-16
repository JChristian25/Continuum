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
