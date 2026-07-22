import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';

// ─── entity patterns (module-level so gitdiff can reuse them) ────────────────

/**
 * The entity-matching patterns for Go.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const goEntityPatterns: EntityPattern[] = [
  // functions (including methods: func (r *Receiver) Name(...))
  {
    regex: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm,
    type: 'function'
  },
  // type declarations (structs, interfaces, type aliases)
  {
    regex: /^type\s+(\w+)\s+(?:struct|interface)/gm,
    type: 'class'
  },
];

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of goEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];
      if (entities.some(e => e.name === name)) continue;

      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

      entities.push({ name, type, line, complexity: 'low' });
    }
  }

  return entities;
}

// ─── import extractor ───────────────────────────────────

function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // import "pkg" or import alias "pkg"
  const singlePattern = /^import\s+(?:\w+\s+)?["']([^"']+)["']/gm;
  let match: RegExpExecArray | null;
  while ((match = singlePattern.exec(code)) !== null) {
    imports.push({ source: match[1], names: [match[1]], isLocal: match[1].startsWith('.') });
  }

  // import ( "pkg1" \n "pkg2" )
  const blockPattern = /import\s+\(([^)]+)\)/gs;
  while ((match = blockPattern.exec(code)) !== null) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const pkgMatch = line.match(/(?:\w+\s+)?["']([^"']+)["']/);
      if (pkgMatch) {
        imports.push({ source: pkgMatch[1], names: [pkgMatch[1]], isLocal: pkgMatch[1].startsWith('.') });
      }
    }
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────

function extractExports(code: string): string[] {
  // In Go, exported names start with an uppercase letter
  const exports: string[] = [];
  const pattern = /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?([A-Z]\w*)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    exports.push(match[1]);
  }
  return [...new Set(exports)];
}

// ─── register ───────────────────────────────────────────

/**
 * The language parser implementation for Go source files.
 */
const GoParser: LanguageParser = {
  lang: 'go',
  extensions: ['.go'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: goEntityPatterns,
};

registerParser(GoParser);
