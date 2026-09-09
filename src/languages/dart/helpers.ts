import path from 'path';
import { COMPLEXITY_THRESHOLDS } from '../../constants';

// ─── helpers ────────────────────────────────────────────

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove inline and multi-line comments while leaving string literals untouched.
 * Comments are replaced with the same number of newlines they spanned so that line numbers
 * match the original file offsets.
 */
export function cleanDartComments(src: string): string {
  const commentStringPattern = /r?"""(?:\\.|[\s\S])*?"""|r?'''(?:\\.|[\s\S])*?'''|r?"(?:\\.|[^"\\])*"|r?'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  return src.replace(commentStringPattern, (token) => {
    if (token.startsWith('/')) {
      const newlineCount = (token.match(/\n/g) || []).length;
      return '\n'.repeat(newlineCount);
    }
    return token;
  });
}

export function _fileStem(filePath: string): string {
  const base = path.basename(filePath);
  const ext = path.extname(base);
  return ext ? base.slice(0, -ext.length) : base;
}

export function _makeId(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map(p => p.trim().replace(/[^a-zA-Z0-9_.-]/g, '_'))
    .join('__');
}

export function _splitTypes(text: string): string[] {
  const parts: string[] = [];
  const current: string[] = [];
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '<') {
      depth++;
      current.push(char);
    } else if (char === '>') {
      depth--;
      current.push(char);
    } else if (char === ',' && depth === 0) {
      const trimmed = current.join('').trim();
      if (trimmed) parts.push(trimmed);
      current.length = 0;
    } else {
      current.push(char);
    }
  }

  if (current.length > 0) {
    const trimmed = current.join('').trim();
    if (trimmed) parts.push(trimmed);
  }

  return parts;
}

export function _findMatchingBrace(text: string, startPos: number): number {
  let braceCount = 0;
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let escape = false;

  const firstBrace = text.indexOf('{', startPos);
  if (firstBrace === -1) return text.length;

  braceCount = 1;
  let i = firstBrace + 1;
  const n = text.length;

  while (i < n) {
    const char = text[i];
    if (escape) {
      escape = false;
      i++;
      continue;
    }
    if (char === '\\') {
      escape = true;
      i++;
      continue;
    }
    if (text.slice(i, i + 3) === '"""' && !inSingleQuote) {
      i += 3;
      const end = text.indexOf('"""', i);
      i = end !== -1 ? end + 3 : n;
      continue;
    }
    if (text.slice(i, i + 3) === "'''" && !inDoubleQuote) {
      i += 3;
      const end = text.indexOf("'''", i);
      i = end !== -1 ? end + 3 : n;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (!inDoubleQuote && !inSingleQuote) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return i + 1;
        }
      }
    }
    i++;
  }

  return text.length;
}

/**
 * Estimates cyclomatic complexity of a Dart function/method via brace-depth tracking
 * and decision keyword counting.
 */
export function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const defRegex = new RegExp(
    `(?:^|\\s)(?:[\\w<>\\[\\],.?]+\\s+)?${escapeRegex(name)}\\s*(?:<[^>]*>)?\\s*\\(`,
    'm'
  );
  const defLineIdx = lines.findIndex(l => defRegex.test(l));
  if (defLineIdx === -1) return 'low';

  let startLine = defLineIdx;
  while (startLine < lines.length && !lines[startLine].includes('{') && !lines[startLine].includes('=>')) {
    startLine++;
  }
  if (startLine >= lines.length) return 'low';

  // If arrow function body, search that line/statement for branching
  if (lines[startLine].includes('=>') && !lines[startLine].includes('{')) {
    const arrowStmt = lines.slice(startLine, startLine + 5).join('\n');
    const branches = (
      arrowStmt.match(/\b(if|else|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []
    ).length;
    if (branches <= COMPLEXITY_THRESHOLDS.low) return 'low';
    if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
    return 'high';
  }

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
    body.match(/\b(if|else\s+if|else|for|while|do|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low) return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}
