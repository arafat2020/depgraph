import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimates cyclomatic complexity of a PHP function/method via brace-depth tracking.
 */
function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const defRegex = new RegExp(
    `(?:^|\\s)function\\s+${escapeRegex(name)}\\s*\\(`, 'm'
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
    body.match(/\b(if|elseif|else|for|foreach|while|do|switch|case|catch|&&|\|\|)\b/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns ────────────────────────────────────

/**
 * Entity-matching patterns for PHP, exposed for gitdiff reuse.
 * Mirrors _PHP_CONFIG: class_declaration, interface_declaration,
 * enum_declaration, trait_declaration, function_definition, method_declaration.
 */
export const phpEntityPatterns: EntityPattern[] = [
  // class (abstract class, final class, readonly class, etc.)
  {
    regex: /^[ \t]*(?:(?:abstract|final|readonly)\s+)*class\s+([A-Za-z_]\w*)(?:\s+extends\s+\S+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // interface
  {
    regex: /^[ \t]*interface\s+([A-Za-z_]\w*)(?:\s+extends\s+[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // trait
  {
    regex: /^[ \t]*trait\s+([A-Za-z_]\w*)\s*\{/gm,
    type: 'class',
  },
  // enum (PHP 8.1+)
  {
    regex: /^[ \t]*enum\s+([A-Za-z_]\w*)(?:\s*:\s*\w+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // function and method declarations
  {
    regex: /^[ \t]*(?:(?:public|protected|private|static|abstract|final|readonly)\s+)*function\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'function',
  },
];

// ─── entity extractor ───────────────────────────────────

/**
 * PHP identifiers are case-insensitive, but we preserve the declared casing
 * for node labels, matching the Python extractor's behaviour.
 */
function extractEntities(code: string, _filePath: string): RawEntity[] {
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

// ─── import extractor ───────────────────────────────────

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
function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // use Foo\Bar\Baz [as Alias];
  // use Foo\Bar\{Baz, Qux as Q};
  // Regex captures: (1) the path/grouped-block, (2) optional `as Alias`
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

// ─── export extractor ───────────────────────────────────

/**
 * PHP has no explicit `export` keyword. By convention, everything declared at
 * the top level of a file is importable. We return all top-level public / no-modifier
 * class, interface, trait, enum, and function names.
 */
function extractExports(code: string): string[] {
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

// ─── register ───────────────────────────────────────────

const PhpParser: LanguageParser = {
  lang: 'php',
  extensions: ['.php', '.phtml', '.php3', '.php4', '.php5', '.php7'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: phpEntityPatterns,
};

registerParser(PhpParser);
