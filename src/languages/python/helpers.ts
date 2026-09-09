import { COMPLEXITY_THRESHOLDS } from '../../constants';

// ─── helpers ─────────────────────────────────────────────

/**
 * Escapes special regex characters in a string.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimates the cyclomatic complexity rating of a Python function based on
 * decision/branching keywords.
 * @param code The clean source code of the file.
 * @param name The name of the function to estimate complexity for.
 * @returns A string representing the complexity level ('low', 'medium', or 'high').
 */
export function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const defRegex = new RegExp(`^[ \\t]*(?:async\\s+)?def\\s+${escapeRegex(name)}\\s*\\(`, 'm');
  const defLine = lines.findIndex(l => defRegex.test(l));
  if (defLine === -1) return 'low';

  // Find where the def statement ends (colon ':') to locate the body
  let bodyStart = defLine;
  while (bodyStart < lines.length && !lines[bodyStart].includes(':')) {
    bodyStart++;
  }
  bodyStart++;

  const bodyLines: string[] = [];
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    // Body ends when indentation returns to top-level or unindented relative to def
    if (!line.match(/^\s+/)) break;
    bodyLines.push(line);
  }

  const branches = (bodyLines.join('\n').match(/\b(if|elif|else|for|while|except|and|or|match|case)\b/g) || []).length;
  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}
