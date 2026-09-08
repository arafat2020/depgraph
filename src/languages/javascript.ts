import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

/**
 * Estimates the cyclomatic complexity rating of a function based on the count of decision/branching keywords.
 * @param code The clean source code of the file.
 * @param name The name of the function to estimate complexity for.
 * @returns A string representing the complexity level ('low', 'medium', or 'high').
 */
function estimateComplexity(code: string, name: string): string {
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

// ─── entity patterns (module-level so gitdiff can reuse them) ────────────────

/**
 * The entity-matching patterns for JavaScript and TypeScript.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const jsEntityPatterns: EntityPattern[] = [
  // React components: wrapped in memo/forwardRef
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo|forwardRef)\(/gm,
    type: 'component'
  },
  // React components: PascalCase arrow functions
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/gm,
    type: 'component'
  },
  // React components: PascalCase function declarations
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'component'
  },
  // React hooks: camelCase starting with "use" (arrow functions or const assignments)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+(use[A-Z]\w*)\s*=/gm,
    type: 'hook'
  },
  // React hooks: camelCase starting with "use" (function declarations)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(use[A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'hook'
  },
  // regular and async function declarations (including generator functions)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*\s*|\s+)([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function'
  },
  // arrow functions assigned to const / let / var
  {
    regex: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/gm,
    type: 'function'
  },
  // function expressions assigned to const / let / var
  {
    regex: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?function/gm,
    type: 'function'
  },
  // classes (regular, exported, abstract)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_]\w*)/gm,
    type: 'class'
  },
  // TypeScript interfaces
  {
    regex: /^(?:export\s+)?(?:default\s+)?interface\s+([A-Za-z_]\w*)/gm,
    type: 'interface'
  },
  // TypeScript types
  {
    regex: /^(?:export\s+)?(?:default\s+)?type\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*=/gm,
    type: 'type'
  },
  // TypeScript enums (regular or const enum)
  {
    regex: /^(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_]\w*)/gm,
    type: 'class'
  },
  // Express / router routes (capture group 1 = method, group 2 = path — skipped in gitdiff context matching)
  {
    regex: /(?:app|router|server)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/gm,
    type: 'api'
  },
];

// ─── entity extractor ───────────────────────────────────

/**
 * Extracts raw entities (React components, hooks, functions, classes, routes, etc.) from clean JavaScript or TypeScript source code.
 * Uses regular expression heuristics to discover declarations.
 * @param code The clean source code of the file (without single-line comments).
 * @param filePath The file path of the source file.
 * @returns An array of raw extracted code entities.
 */
function extractEntities(code: string, filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of jsEntityPatterns) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((match = regex.exec(code)) !== null) {
      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

      if (type === 'api') {
        entities.push({
          name: `${match[1].toUpperCase()} ${match[2]}`,
          type: 'api',
          line,
          complexity: 'low',
        });
      } else {
        const name = match[1];

        // skip if we already recorded this entity
        if (entities.some(e => e.name === name)) continue;

        entities.push({
          name,
          type,
          line,
          complexity: estimateComplexity(code, name),
        });
      }
    }
  }

  return entities;
}

// ─── import extractor ───────────────────────────────────

/**
 * Extracts raw imports from clean source code, detecting ESM imports (`import`) and CommonJS `require` statements.
 * @param code The clean source code of the file.
 * @returns An array of raw extracted import structures.
 */
function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // 1. Combined default + named imports:
  // e.g. import React, { useState, useEffect as useEff } from 'react';
  // e.g. import React, * as ReactNS from 'react';
  const combinedPattern = /^import\s+(?:type\s+)?([A-Za-z_$]\w*)\s*,\s*(?:\{([^}]+)\}|\*\s+as\s+([A-Za-z_$]\w*))\s+from\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = combinedPattern.exec(code)) !== null) {
    const defaultName = match[1];
    const namedClause = match[2];
    const nsName = match[3];
    const source = match[4];

    const names: string[] = [defaultName];
    if (namedClause) {
      const parsedNamed = namedClause
        .split(',')
        .map(n => n.trim().replace(/^type\s+/, '').replace(/\s+as\s+\w+$/, '').trim())
        .filter(n => n.length > 0);
      names.push(...parsedNamed);
    }
    if (nsName) {
      names.push(nsName);
    }

    imports.push({
      source,
      names: [...new Set(names)],
      isLocal: source.startsWith('.') || source.startsWith('/'),
    });
  }

  // 2. Pure named imports (including multi-line):
  // e.g. import { getUser, createUser as cu } from './userService';
  // e.g. import type { User, Admin } from './types';
  const namedPattern = /^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = namedPattern.exec(code)) !== null) {
    const source = match[2];
    // skip if already extracted by combined pattern
    if (imports.some(i => i.source === source)) continue;

    const names = match[1]
      .split(',')
      .map(n => n.trim().replace(/^type\s+/, '').replace(/\s+as\s+\w+$/, '').trim())
      .filter(n => n.length > 0);

    imports.push({
      source,
      names: [...new Set(names)],
      isLocal: source.startsWith('.') || source.startsWith('/'),
    });
  }

  // 3. Pure default imports:
  // e.g. import React from 'react';
  // e.g. import type React from 'react';
  const defaultPattern = /^import\s+(?:type\s+)?([A-Za-z_$]\w*)\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = defaultPattern.exec(code)) !== null) {
    const source = match[2];
    if (imports.some(i => i.source === source)) continue;

    imports.push({
      source,
      names: [match[1]],
      isLocal: source.startsWith('.') || source.startsWith('/'),
    });
  }

  // 4. Namespace imports:
  // e.g. import * as fs from 'fs';
  const nsPattern = /^import\s+\*\s+as\s+([A-Za-z_$]\w*)\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = nsPattern.exec(code)) !== null) {
    const source = match[2];
    if (imports.some(i => i.source === source)) continue;

    imports.push({
      source,
      names: [match[1]],
      isLocal: source.startsWith('.') || source.startsWith('/'),
    });
  }

  // 5. CommonJS require:
  // e.g. const { a, b: c } = require('./somewhere')
  // e.g. const x = require('./somewhere')
  const requirePattern = /(?:const|let|var)\s+\{?([^}=]+)\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = requirePattern.exec(code)) !== null) {
    const rawNames = match[1];
    const source = match[2];
    const names = rawNames
      .split(',')
      .map(n => n.trim().replace(/^\w+:\s*/, '').trim())
      .filter(n => n.length > 0);

    imports.push({
      source,
      names: [...new Set(names)],
      isLocal: source.startsWith('.') || source.startsWith('/'),
    });
  }

  // 6. Re-export source imports:
  // e.g. export { a, b } from './module';
  // e.g. export * as ns from './module';
  // e.g. export * from './module';
  const reexportPattern = /^export\s+(?:\{([^}]+)\}|\*\s+as\s+([A-Za-z_$]\w*)|\*)\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = reexportPattern.exec(code)) !== null) {
    const namedClause = match[1];
    const nsAlias = match[2];
    const source = match[3];

    let names: string[] = [];
    if (namedClause) {
      names = namedClause
        .split(',')
        .map(n => n.trim().replace(/^type\s+/, '').replace(/\s+as\s+\w+$/, '').trim())
        .filter(n => n.length > 0);
    } else if (nsAlias) {
      names = [nsAlias];
    } else {
      names = ['*'];
    }

    imports.push({
      source,
      names: [...new Set(names)],
      isLocal: source.startsWith('.') || source.startsWith('/'),
    });
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────

/**
 * Extracts exported entity names from clean source code, including inline exports and export list declarations.
 * @param code The clean source code of the file.
 * @returns An array of exported entity identifier names.
 */
function extractExports(code: string): string[] {
  const exports: string[] = [];

  // Inline declarations: export [default] [async/abstract/const/etc] function/class/const/type/interface/enum Name
  const namedPattern = /^export\s+(?:default\s+)?(?:async\s+|abstract\s+)?(?:function(?:\s*\*|\s+)|class|const|let|var|type|interface|enum)\s+([A-Za-z_$]\w*)/gm;
  let match: RegExpExecArray | null;
  while ((match = namedPattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // export default identifier / expression: export default MyComponent;
  const defaultIdentPattern = /^export\s+default\s+([A-Za-z_$]\w*)\s*(?:;|$)/gm;
  while ((match = defaultIdentPattern.exec(code)) !== null) {
    if (!['function', 'class', 'interface', 'abstract'].includes(match[1])) {
      exports.push(match[1]);
    }
  }

  // export lists: export { a, b as c, d }
  const listPattern = /^export\s+\{([^}]+)\}(?!\s*from)/gm;
  while ((match = listPattern.exec(code)) !== null) {
    const names = match[1]
      .split(',')
      .map(n => n.trim().replace(/^type\s+/, '').replace(/^\w+\s+as\s+/, '').trim())
      .filter(n => n.length > 0);
    exports.push(...names);
  }

  // re-exports: export { a, b as c } from './module'
  const reexportPattern = /^export\s+\{([^}]+)\}\s+from/gm;
  while ((match = reexportPattern.exec(code)) !== null) {
    const names = match[1]
      .split(',')
      .map(n => n.trim().replace(/^type\s+/, '').replace(/^\w+\s+as\s+/, '').trim())
      .filter(n => n.length > 0);
    exports.push(...names);
  }

  return [...new Set(exports)];
}

// ─── register ───────────────────────────────────────────

/**
 * The language parser implementation for JavaScript and TypeScript source files.
 */
const JavaScriptParser: LanguageParser = {
  lang: 'js',
  extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: jsEntityPatterns,
};

registerParser(JavaScriptParser);