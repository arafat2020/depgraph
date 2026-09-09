import { RawEntity, RawImport } from '../../types';
import { jsEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

/**
 * Extracts raw entities (React components, hooks, functions, classes, routes, etc.)
 * from clean JavaScript or TypeScript source code.
 * Uses regular expression heuristics to discover declarations.
 * @param code The clean source code of the file (without single-line comments).
 * @param filePath The file path of the source file.
 * @returns An array of raw extracted code entities.
 */
export function extractEntities(code: string, filePath: string): RawEntity[] {
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

// ─── import extractor ────────────────────────────────────

/**
 * Extracts raw imports from clean source code, detecting ESM imports (`import`)
 * and CommonJS `require` statements.
 * @param code The clean source code of the file.
 * @returns An array of raw extracted import structures.
 */
export function extractImports(code: string): RawImport[] {
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

// ─── export extractor ────────────────────────────────────

/**
 * Extracts exported entity names from clean source code, including inline exports
 * and export list declarations.
 * @param code The clean source code of the file.
 * @returns An array of exported entity identifier names.
 */
export function extractExports(code: string): string[] {
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
