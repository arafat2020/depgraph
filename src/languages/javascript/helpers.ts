import { COMPLEXITY_THRESHOLDS } from '../../constants';

// ─── complexity estimation ────────────────────────────────

/**
 * Estimates the cyclomatic complexity rating of a JavaScript/TypeScript function
 * based on the count of decision/branching keywords.
 * @param code The clean source code of the file.
 * @param name The name of the function to estimate complexity for.
 * @returns A string representing the complexity level ('low', 'medium', or 'high').
 */
export function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const nameRegex = new RegExp(
    `(?:(?:async\\s+)?function(?:\\s*\\*|\\s+)|(?:const|let|var)\\s+)${name}\\b|\\b${name}\\s*(?:<[^>]*>)?\\s*\\(`,
    'm'
  );
  const defLineIdx = lines.findIndex(l => nameRegex.test(l));
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
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
      }
    }
    bodyLines.push(line);
    if (started && braceCount <= 0) {
      break;
    }
  }

  const body = bodyLines.join('\n');
  const branches = (body.match(/\b(if|else\s+if|for|while|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}
