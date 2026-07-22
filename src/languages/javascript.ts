import path from 'path';
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
  // find the function body and count branch keywords
  const bodyMatch = code.match(
    new RegExp(`function\\s+${name}[^{]*{([\\s\\S]*?)\n}`, 'm')
  );
  if (!bodyMatch) return 'low';

  const body = bodyMatch[1];
  const branches = (body.match(/\b(if|else|for|while|switch|catch|&&|\|\|)\b/g) || []).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

/**
 * Normalizes an arbitrary text string into an alphanumeric identifier (with underscores replacing non-word characters).
 * @param text The source text string.
 * @returns The slugified identifier string.
 */
function slugify(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '_');
}

// ─── entity patterns (module-level so gitdiff can reuse them) ────────────────

/**
 * The entity-matching patterns for JavaScript and TypeScript.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const jsEntityPatterns: EntityPattern[] = [
  // React components (PascalCase arrow functions)
  {
    regex: /^(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/gm,
    type: 'component'
  },
  // React hooks (camelCase starting with "use")
  {
    regex: /^(?:export\s+)?(?:const\s+)?(use[A-Z]\w+)\s*=/gm,
    type: 'hook'
  },
  // regular functions
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
    type: 'function'
  },
  // arrow functions assigned to const
  {
    regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
    type: 'function'
  },
  // classes
  {
    regex: /^(?:export\s+)?(?:default\s+)?class\s+(\w+)/gm,
    type: 'class'
  },
  // TypeScript interfaces
  {
    regex: /^(?:export\s+)?interface\s+(\w+)/gm,
    type: 'interface'
  },
  // TypeScript types
  {
    regex: /^(?:export\s+)?type\s+(\w+)\s*=/gm,
    type: 'type'
  },
  // Express routes (capture group 1 = method, group 2 = path — skipped in gitdiff context matching)
  {
    regex: /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gm,
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

    // reset regex state before each use
    regex.lastIndex = 0;

    while ((match = regex.exec(code)) !== null) {
      // find which line this match is on
      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

      if (type === 'api') {
        // special case: routes have method + path
        entities.push({
          name: `${match[1].toUpperCase()} ${match[2]}`,
          type: 'api',
          line,
          complexity: 'low',
        });
      } else {
        const name = match[1];

        // skip if we already have this entity
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

/**
 * Extracts raw imports from clean source code, detecting ESM imports (`import`) and CommonJS `require` statements.
 * @param code The clean source code of the file.
 * @returns An array of raw extracted import structures.
 */
function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  const namedPattern = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;

  while ((match = namedPattern.exec(code)) !== null) {
    const names = match[1].split(',').map(n => n.trim().replace(/\s+as\s+\w+/, ''));
    const source = match[2];
    imports.push({
      source,
      names,
      isLocal: source.startsWith('.'),
    });
  }

  const defaultPattern = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = defaultPattern.exec(code)) !== null) {
    imports.push({
      source: match[2],
      names: [match[1]],
      isLocal: match[2].startsWith('.'),
    });
  }

  // require: const x = require('./somewhere')
  const requirePattern = /(?:const|let|var)\s+\{?([^}=]+)\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = requirePattern.exec(code)) !== null) {
    const names = match[1].split(',').map(n => n.trim());
    imports.push({
      source: match[2],
      names,
      isLocal: match[2].startsWith('.'),
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

  const namedPattern = /^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/gm;
  let match: RegExpExecArray | null;

  while ((match = namedPattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // export lists: export { a, b, c }
  const listPattern = /^export\s+\{([^}]+)\}/gm;
  while ((match = listPattern.exec(code)) !== null) {
    const names = match[1].split(',').map(n => n.trim());
    exports.push(...names);
  }

  return [...new Set(exports)]; // remove duplicates
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