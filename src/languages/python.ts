import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const defLine = lines.findIndex(l => l.match(new RegExp(`def\\s+${escapeRegex(name)}\\s*\\(`)));
  if (defLine === -1) return 'low';

  const bodyLines: string[] = [];
  for (let i = defLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (!line.match(/^\s+/)) break;
    bodyLines.push(line);
  }

  const branches = (bodyLines.join('\n').match(/\b(if|elif|else|for|while|except|and|or)\b/g) || []).length;
  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns ────────────────────────────────────

export const pyEntityPatterns: EntityPattern[] = [
  {
    regex: /^[ \t]*(?:async\s+)?def\s+(\w+)\s*\(/gm,
    type: 'function'
  },
  {
    regex: /^class\s+(\w+)(?:\s*\([^)]*\))?\s*:/gm,
    type: 'class'
  },
];

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of pyEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];

      // skip dunder methods (e.g. __init__, __str__)
      if (type === 'function' && name.startsWith('__') && name.endsWith('__')) continue;

      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

      // scope deduplication by name + line to allow same-named methods in different classes
      if (entities.some(e => e.name === name && e.line === line)) continue;

      entities.push({
        name,
        type,
        line,
        complexity: type === 'function' ? estimateComplexity(code, name) : 'low',
      });
    }
  }

  return entities;
}

// ─── import extractor ───────────────────────────────────

function stripAlias(name: string): string {
  return name.replace(/\s+as\s+\w+$/, '').trim();
}

/**
 * Extracts import statements from Python code.
 * @param code The Python code to analyze.
 * @returns An array of extracted import statements.
 */

function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // normalise multi-line parenthesised imports into single lines
  // e.g. "from os import (\n  path,\n  getcwd\n)" → "from os import path, getcwd"
  const normalised = code.replace(
    /^(from\s+[\w.]+\s+import\s*)\(\s*([\s\S]*?)\)/gm,
    (_, prefix: string, body: string) => prefix + body.replace(/\s*\n\s*/g, ', ')
  );

  // from .module import name1, name2 [as alias]
  const fromPattern = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = fromPattern.exec(normalised)) !== null) {
    const source = match[1];
    const names = match[2]
      .split(',')
      .map(n => stripAlias(n))
      .filter(n => n.length > 0 && n !== '*');

    imports.push({ source, names, isLocal: source.startsWith('.') });
  }

  // import os [as alias]
  const importPattern = /^import\s+([\w.]+)(?:\s+as\s+\w+)?/gm;
  while ((match = importPattern.exec(normalised)) !== null) {
    const source = match[1];
    imports.push({ source, names: [source], isLocal: false });
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────
/**
 * Extracts exported names from Python code.
 * @param code The Python code to analyze.
 * @returns An array of exported names.
 */
function extractExports(code: string): string[] {
  // handle both single-line and multi-line __all__ = [...]
  const allMatch = code.match(/__all__\s*=\s*\[([\s\S]*?)\]/);
  if (!allMatch) return [];

  return allMatch[1]
    .split(',')
    .map(n => n.trim().replace(/['"]/g, ''))
    .filter(n => n.length > 0);
}

// ─── register ───────────────────────────────────────────

const PythonParser: LanguageParser = {
  lang: 'py',
  extensions: ['.py'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: pyEntityPatterns,
};

registerParser(PythonParser);
