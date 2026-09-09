import { COMPLEXITY_THRESHOLDS } from '../../constants';

// ─── helpers ─────────────────────────────────────────────

/**
 * Escapes special regex characters in a string.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimates cyclomatic complexity of a Swift function/method via brace-depth tracking.
 */
export function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  // Match: func name(  or  init(  or  deinit  or  subscript
  const defRegex = new RegExp(
    `(?:^|\\s)(?:func\\s+${escapeRegex(name)}|init|deinit|subscript)\\s*(?:<[^>]*>)?\\s*\\(`, 'm'
  );
  const defLineIdx = lines.findIndex(l => defRegex.test(l));
  if (defLineIdx === -1) return 'low';

  let startLine = defLineIdx;
  while (startLine < lines.length && !lines[startLine].includes('{')) {
    startLine++;
  }
  if (startLine >= lines.length) return 'low';

  let braceCount = 0;
  let started = false;
  const bodyLines: string[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { braceCount++; started = true; }
      else if (ch === '}') { braceCount--; }
    }
    bodyLines.push(line);
    if (started && braceCount <= 0) break;
  }

  const body = bodyLines.join('\n');
  const branches = (
    body.match(/\b(if|else\s+if|else|for\s|while|repeat|switch|case|catch|guard|&&|\|\|)\b/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}
