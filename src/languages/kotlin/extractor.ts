import { RawEntity, RawImport } from '../../types';
import { kotlinEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

export function extractEntities(code: string, _filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of kotlinEntityPatterns) {
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
 * Extracts Kotlin import statements.
 * Mirrors _import_kotlin: handles qualified paths, wildcards (skipped),
 * and `as` aliases. The last segment of the dotted path is the local name.
 */
export function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // import com.example.Foo [as Bar]
  // import com.example.*   (wildcard → skip per Python impl)
  const importPattern = /^import\s+([\w.]+?)(\.\*)?\s*(?:as\s+(\w+))?\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(code)) !== null) {
    const fullPath  = match[1];
    const isWild    = Boolean(match[2]);
    const alias     = match[3];

    // Wildcard import: names a whole package — skip (mirrors Python impl)
    if (isWild) continue;

    const lastName  = fullPath.split('.').pop() || fullPath;
    const localName  = alias || lastName;

    imports.push({
      source: fullPath,
      names: [localName],
      isLocal: false,
    });
  }

  return imports;
}

// ─── export extractor ────────────────────────────────────

/**
 * In Kotlin, `public` (the default visibility) members are the exported API.
 * Returns names of all public / implicitly public top-level declarations.
 */
export function extractExports(code: string): string[] {
  const exports: string[] = [];

  // public or no-modifier top-level classes, objects, interfaces, funs
  const patterns = [
    /^(?:(?:public|open|abstract|sealed|data|inline|value)\s+)*class\s+([A-Za-z_]\w*)/gm,
    /^(?:(?:public)\s+)?object\s+([A-Za-z_]\w*)/gm,
    /^(?:(?:public|sealed|fun)\s+)*interface\s+([A-Za-z_]\w*)/gm,
    /^(?:(?:public|open|inline|suspend|operator|infix|tailrec)\s+)*fun\s+(?:<[^>]*>\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      if (match[1]) exports.push(match[1]);
    }
  }

  return [...new Set(exports)];
}
