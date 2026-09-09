import { RawEntity, RawImport } from '../../types';
import { phpEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

/**
 * PHP identifiers are case-insensitive, but we preserve the declared casing
 * for node labels, matching the Python extractor's behaviour.
 */
export function extractEntities(code: string, _filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of phpEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];
      if (!name) continue;

      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

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

/**
 * Extracts PHP import statements.
 *
 * PHP has no native module system. Imports come from:
 *   1. `use Namespace\ClassName [as Alias];` (namespace import — mirrors _import_php)
 *   2. `require`/`require_once`/`include`/`include_once` file includes
 *
 * The Python extractor only handles namespace_use_clause, so we model
 * both but mark file includes as isLocal.
 */
export function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // use Foo\Bar\Baz [as Alias];
  // use Foo\Bar\{Baz, Qux as Q};
  const usePattern = /^use\s+([\w\\]+(?:\s*\{[^}]*\})?)\s*(?:as\s+(\w+)\s*)?;/gm;
  let match: RegExpExecArray | null;

  while ((match = usePattern.exec(code)) !== null) {
    const raw   = match[1].trim();
    const alias = match[2]?.trim();

    if (raw.includes('{')) {
      // Grouped use: use Foo\Bar\{Baz, Qux as Q}
      const prefixMatch = raw.match(/^([\w\\]+)\\?\s*\{([^}]*)\}/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        const items = prefixMatch[2].split(',');
        for (const item of items) {
          const parts = item.trim().split(/\s+as\s+/i);
          const fullName = (prefix + '\\' + parts[0].trim()).replace(/\\+/g, '\\');
          const lastName = (parts[1] || parts[0].trim().split('\\').pop()) || fullName;
          imports.push({ source: fullName, names: [lastName.trim()], isLocal: false });
        }
      }
    } else {
      // Single use: use Foo\Bar [as Alias]
      const fullPath = raw;
      const lastName = alias || fullPath.split('\\').pop() || fullPath;
      imports.push({ source: fullPath, names: [lastName.trim()], isLocal: false });
    }
  }

  // require/require_once/include/include_once 'path'
  // Handles both direct string and concatenated forms: require __DIR__ . '/path'
  const includePattern = /(?:require|include)(?:_once)?\s*[^;'"]*?['"]([^'"]+)['"]/gm;
  while ((match = includePattern.exec(code)) !== null) {
    const source = match[1];
    const name = source.split('/').pop()?.replace(/\.php$/i, '') || source;
    imports.push({ source, names: [name], isLocal: true });
  }

  return imports;
}

// ─── export extractor ────────────────────────────────────

/**
 * PHP has no explicit `export` keyword. By convention, everything declared at
 * the top level of a file is importable. We return all top-level public / no-modifier
 * class, interface, trait, enum, and function names.
 */
export function extractExports(code: string): string[] {
  const exports: string[] = [];

  const patterns = [
    /^(?:(?:abstract|final|readonly)\s+)*class\s+([A-Za-z_]\w*)/gm,
    /^interface\s+([A-Za-z_]\w*)/gm,
    /^trait\s+([A-Za-z_]\w*)/gm,
    /^enum\s+([A-Za-z_]\w*)/gm,
    /^function\s+([A-Za-z_]\w*)\s*\(/gm,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      if (match[1]) exports.push(match[1]);
    }
  }

  return [...new Set(exports)];
}
