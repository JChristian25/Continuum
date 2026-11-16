/**
 * Compact line-level diff between two captured artifact versions.
 * Produces contextual hunks suitable for inline review without external dependencies.
 */

const CONTEXT_LINES = 3;

function splitLines(text) {
  if (typeof text !== 'string' || !text.length) return [];
  return text.replace(/\r\n/g, '\n').split('\n');
}

function lcsMatrix(a, b) {
  const m = a.length;
  const n = b.length;
  // Use flat Int32Array rows for fast LCS backtracking even on ~1k-line files.
  const dp = new Int32Array((m + 1) * (n + 1));
  const width = n + 1;
  for (let i = m - 1; i >= 0; i -= 1) {
    const rowOffset = i * width;
    const nextRowOffset = (i + 1) * width;
    const lineA = a[i];
    for (let j = n - 1; j >= 0; j -= 1) {
      if (lineA === b[j]) {
        dp[rowOffset + j] = 1 + dp[nextRowOffset + j + 1];
      } else {
        const down = dp[nextRowOffset + j];
        const right = dp[rowOffset + j + 1];
        dp[rowOffset + j] = down >= right ? down : right;
      }
    }
  }
  return dp;
}

export function computeLineDiff(beforeText, afterText) {
  const a = splitLines(beforeText);
  const b = splitLines(afterText);

  if (beforeText === afterText) {
    return { identical: true, added: 0, removed: 0, hunks: [] };
  }

  // Trim shared prefix/suffix before running DP to keep memory and runtime small.
  let prefix = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefix < minLen && a[prefix] === b[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const midA = a.slice(prefix, a.length - suffix);
  const midB = b.slice(prefix, b.length - suffix);
  const ops = [];

  for (let i = 0; i < prefix; i += 1) {
    ops.push({ type: 'context', oldLine: i + 1, newLine: i + 1, text: a[i] });
  }

  // Guard against extreme files: fall back to a full mid-block replacement if m*n > 2.5M cells.
  if (midA.length * midB.length > 2_500_000) {
    for (let i = 0; i < midA.length; i += 1) {
      ops.push({ type: 'del', oldLine: prefix + i + 1, newLine: null, text: midA[i] });
    }
    for (let j = 0; j < midB.length; j += 1) {
      ops.push({ type: 'add', oldLine: null, newLine: prefix + j + 1, text: midB[j] });
    }
  } else {
    const dp = lcsMatrix(midA, midB);
    const width = midB.length + 1;
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        ops.push({ type: 'context', oldLine: prefix + i + 1, newLine: prefix + j + 1, text: midA[i] });
        i += 1;
        j += 1;
      } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
        ops.push({ type: 'del', oldLine: prefix + i + 1, newLine: null, text: midA[i] });
        i += 1;
      } else {
        ops.push({ type: 'add', oldLine: null, newLine: prefix + j + 1, text: midB[j] });
        j += 1;
      }
    }
    while (i < midA.length) {
      ops.push({ type: 'del', oldLine: prefix + i + 1, newLine: null, text: midA[i] });
      i += 1;
    }
    while (j < midB.length) {
      ops.push({ type: 'add', oldLine: null, newLine: prefix + j + 1, text: midB[j] });
      j += 1;
    }
  }

  for (let s = 0; s < suffix; s += 1) {
    const idxA = a.length - suffix + s;
    const idxB = b.length - suffix + s;
    ops.push({ type: 'context', oldLine: idxA + 1, newLine: idxB + 1, text: a[idxA] });
  }

  let added = 0;
  let removed = 0;
  const changedIndices = [];
  for (let idx = 0; idx < ops.length; idx += 1) {
    if (ops[idx].type === 'add') {
      added += 1;
      changedIndices.push(idx);
    } else if (ops[idx].type === 'del') {
      removed += 1;
      changedIndices.push(idx);
    }
  }

  if (!changedIndices.length) {
    return { identical: true, added: 0, removed: 0, hunks: [] };
  }

  // Merge changed ranges expanded by CONTEXT_LINES into compact hunks.
  const ranges = [];
  for (const idx of changedIndices) {
    const start = Math.max(0, idx - CONTEXT_LINES);
    const end = Math.min(ops.length - 1, idx + CONTEXT_LINES);
    if (ranges.length && start <= ranges[ranges.length - 1][1] + 2) {
      ranges[ranges.length - 1][1] = end;
    } else {
      ranges.push([start, end]);
    }
  }

  const hunks = ranges.map(([start, end]) => {
    const slice = ops.slice(start, end + 1);
    const firstOld = slice.find(line => line.oldLine !== null)?.oldLine || 1;
    const firstNew = slice.find(line => line.newLine !== null)?.newLine || 1;
    return {
      header: `Lines ${firstOld} → ${firstNew}`,
      lines: slice,
    };
  });

  return { identical: false, added, removed, hunks };
}
