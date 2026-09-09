import path from 'path';
import { COMPLEXITY_THRESHOLDS } from '../../constants';
import { RUST_PRIMITIVES } from './patterns';

// ─── helpers ────────────────────────────────────────────

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

/**
 * Remove inline and multi-line comments while leaving string literals untouched.
 * Comments are replaced with the same number of newlines they spanned so that line numbers
 * match the original file offsets.
 */
export function cleanRustComments(src: string): string {
  // Regex matches raw strings r#*".*?"#*, regular strings, byte strings, block comments, and line comments
  const commentStringPattern = /b?r(#*)".*?"\1|b?"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  return src.replace(commentStringPattern, (token) => {
    if (token.startsWith('/')) {
      const newlineCount = (token.match(/\n/g) || []).length;
      return '\n'.repeat(newlineCount);
    }
    return token;
  });
}

/**
 * Splits balanced generic parameters or comma-separated lists at depth 0.
 */
export function _splitBalanced(text: string, delim = ','): string[] {
  const parts: string[] = [];
  const current: string[] = [];
  let depthAngle = 0;
  let depthParen = 0;
  let depthBracket = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '<') depthAngle++;
    else if (ch === '>') depthAngle--;
    else if (ch === '(') depthParen++;
    else if (ch === ')') depthParen--;
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket--;
    else if (ch === delim && depthAngle === 0 && depthParen === 0 && depthBracket === 0) {
      const trimmed = current.join('').trim();
      if (trimmed) parts.push(trimmed);
      current.length = 0;
      continue;
    }
    current.push(ch);
  }

  if (current.length > 0) {
    const trimmed = current.join('').trim();
    if (trimmed) parts.push(trimmed);
  }

  return parts;
}

/**
 * Finds the matching closing brace '}' for the opening brace '{' at or after startPos.
 */
export function _findMatchingBrace(text: string, startPos: number): number {
  let braceCount = 0;
  let inDoubleQuote = false;
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
    if (char === '"') {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inDoubleQuote) {
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
 * Walk a Rust type expression; append [name, role] tuples.
 * Corresponds to _rust_collect_type_refs in graphify/extract.py.
 */
export function _rustCollectTypeRefs(
  typeStr: string | null | undefined,
  generic: boolean,
  out: [string, string][]
): void {
  if (!typeStr) return;
  const raw = typeStr.trim();
  if (!raw) return;

  // Strip lifetimes e.g. &'a mut T, &'static T, 'a + Trait
  let clean = raw.replace(/&(?:\s*'[a-zA-Z_]\w*)?\s*(?:mut\s+)?/g, '').trim();

  // Strip pointer symbols *const, *mut
  clean = clean.replace(/^\*(?:const|mut)\s+/g, '').trim();

  // Slice / Array [T; N] or [T]
  if (clean.startsWith('[') && clean.endsWith(']')) {
    const inner = clean.slice(1, -1).split(';')[0].trim();
    _rustCollectTypeRefs(inner, generic, out);
    return;
  }

  // Tuples (A, B, ...)
  if (clean.startsWith('(') && clean.endsWith(')')) {
    const inner = clean.slice(1, -1).trim();
    if (inner) {
      for (const part of _splitBalanced(inner)) {
        _rustCollectTypeRefs(part, generic, out);
      }
    }
    return;
  }

  // Trait bounds A + B + C
  if (clean.includes('+') && !clean.includes('<')) {
    for (const part of clean.split('+')) {
      _rustCollectTypeRefs(part.trim(), generic, out);
    }
    return;
  }

  // Dyn trait
  if (clean.startsWith('dyn ')) {
    clean = clean.slice(4).trim();
  }

  // Generic type e.g. Option<T>, Result<T, E>, HashMap<K, V>
  const angleIdx = clean.indexOf('<');
  if (angleIdx !== -1 && clean.endsWith('>')) {
    const baseType = clean.slice(0, angleIdx).trim();
    const lastBaseSegment = baseType.split('::').pop()!.trim();

    if (!RUST_PRIMITIVES.has(lastBaseSegment) && lastBaseSegment) {
      out.push([lastBaseSegment, generic ? 'generic_arg' : 'type']);
    }

    const argsText = clean.slice(angleIdx + 1, -1).trim();
    const args = _splitBalanced(argsText);
    for (const arg of args) {
      _rustCollectTypeRefs(arg, true, out);
    }
    return;
  }

  // Scoped or simple identifier
  const lastSegment = clean.split('::').pop()!.trim();
  if (!RUST_PRIMITIVES.has(lastSegment) && /^[a-zA-Z_]\w*$/.test(lastSegment)) {
    out.push([lastSegment, generic ? 'generic_arg' : 'type']);
  }
}

/**
 * Estimates cyclomatic complexity of a Rust function via decision keywords
 * and brace-depth tracking.
 */
export function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const defRegex = new RegExp(
    `(?:^|\\s)fn\\s+${escapeRegex(name)}\\s*(?:<[^>]*>)?\\s*\\(`,
    'm'
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
    body.match(/\b(if|else\s+if|else|for|while|loop|match)\b|\?|(&&|\|\|)/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low) return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}
