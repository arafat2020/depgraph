import { COMPLEXITY_THRESHOLDS } from '../../constants';

// ─── helpers ─────────────────────────────────────────────

/**
 * Escapes special regex characters in a string.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitise Ruby method name suffixes (!, ?, =) the same way the Python
 * extractor does (`_ruby_sanitize_method_name` in extract.py, issue #3077).
 */
export function sanitizeMethodName(name: string): string {
  if (name.endsWith('!')) return `${name.slice(0, -1)}_bang`;
  if (name.endsWith('?')) return `${name.slice(0, -1)}_pred`;
  if (name.endsWith('=')) return `${name.slice(0, -1)}_eq`;
  return name;
}

/**
 * Estimates cyclomatic complexity of a Ruby method via indentation tracking.
 * Ruby methods don't use braces so we count branch keywords until `end`.
 */
export function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  // Match: def name or def self.name
  const defRegex = new RegExp(`^[ \\t]*def\\s+(?:self\\.)?${escapeRegex(name)}(?:[!?=])?\\s*(\\(|$)`, 'm');
  const defLineIdx = lines.findIndex(l => defRegex.test(l));
  if (defLineIdx === -1) return 'low';

  const bodyLines: string[] = [];
  let depth = 0;

  for (let i = defLineIdx; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Keywords that open a new `end` scope
    if (/\b(def|class|module|do\b|begin|if(?!.*\bend\b)|unless(?!.*\bend\b)|while(?!.*\bend\b)|until(?!.*\bend\b)|for\s|case\b)\b/.test(trimmed)) {
      depth++;
    }
    if (/\bend\b/.test(trimmed)) {
      depth--;
      if (depth <= 0) { bodyLines.push(line); break; }
    }
    bodyLines.push(line);
  }

  const body = bodyLines.join('\n');
  const branches = (
    body.match(/\b(if|elsif|else|unless|while|until|for|rescue|when|and|or|&&|\|\|)\b/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}
