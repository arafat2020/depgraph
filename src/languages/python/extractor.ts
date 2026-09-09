import { RawEntity, RawImport } from '../../types';
import { pyEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

export function extractEntities(code: string, filePath: string): RawEntity[] {
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

// ─── import extractor ────────────────────────────────────

function stripAlias(name: string): string {
  return name.replace(/\s+as\s+[A-Za-z_]\w*$/, '').trim();
}

/**
 * Extracts import statements from Python code.
 * @param code The Python code to analyze.
 * @returns An array of extracted import statements.
 */
export function extractImports(code: string): RawImport[] {
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

// ─── export extractor ────────────────────────────────────

/**
 * Extracts exported names from Python code via __all__.
 * @param code The Python code to analyze.
 * @returns An array of exported names.
 */
export function extractExports(code: string): string[] {
  // handle __all__ = [...] or __all__ = (...)
  const allMatch = code.match(/__all__\s*=\s*[\[\(]([\s\S]*?)[\]\)]/);
  if (!allMatch) return [];

  return allMatch[1]
    .split(',')
    .map(n => n.trim().replace(/['"]/g, '').replace(/#.*$/, '').trim())
    .filter(n => n.length > 0);
}
