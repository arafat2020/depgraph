import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimates the cyclomatic complexity rating of a Python function based on decision/branching keywords.
 * @param code The clean source code of the file.
 * @param name The name of the function to estimate complexity for.
 * @returns A string representing the complexity level ('low', 'medium', or 'high').
 */
function estimateComplexity(code: string, name: string): string {
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

// ─── entity patterns ────────────────────────────────────

/**
 * The entity-matching patterns for Python.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const pyEntityPatterns: EntityPattern[] = [
  // functions and methods (including async def)
  {
    regex: /^[ \t]*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'function'
  },
  // classes (with optional generic parameters [T] and base classes (Base))
  {
    regex: /^[ \t]*class\s+([A-Za-z_]\w*)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?\s*:/gm,
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

      // skip dunder methods (e.g. __init__, __str__, __repr__)
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
  return name.replace(/\s+as\s+[A-Za-z_]\w*$/, '').trim();
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
  // from . import utils
  const fromPattern = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = fromPattern.exec(normalised)) !== null) {
    const source = match[1];
    const rawNames = match[2].replace(/#.*$/, ''); // strip inline comments
    const names = rawNames
      .split(',')
      .map(n => stripAlias(n.trim()))
      .filter(n => n.length > 0 && n !== '*');

    imports.push({ source, names, isLocal: source.startsWith('.') });
  }

  // import os, sys [as alias]
  const importPattern = /^import\s+([^#\n]+)/gm;
  while ((match = importPattern.exec(normalised)) !== null) {
    const modules = match[1].split(',').map(m => m.trim());
    for (const mod of modules) {
      if (!mod) continue;
      const cleanMod = stripAlias(mod);
      if (!cleanMod) continue;
      imports.push({
        source: cleanMod,
        names: [cleanMod],
        isLocal: cleanMod.startsWith('.'),
      });
    }
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────

/**
 * Extracts exported names from Python code via __all__.
 * @param code The Python code to analyze.
 * @returns An array of exported names.
 */
function extractExports(code: string): string[] {
  // handle __all__ = [...] or __all__ = (...)
  const allMatch = code.match(/__all__\s*=\s*[\[\(]([\s\S]*?)[\]\)]/);
  if (!allMatch) return [];

  return allMatch[1]
    .split(',')
    .map(n => n.trim().replace(/['"]/g, '').replace(/#.*$/, '').trim())
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

