import { RawEntity, RawImport } from '../../types';
import { javaEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

export function extractEntities(code: string, _filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of javaEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];
      // Skip Java built-in keywords that may be captured
      if (['if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'return', 'new', 'void', 'this', 'super'].includes(name)) continue;

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
 * Extracts Java import statements.
 * Mirrors _import_java: walks scoped_identifier nodes taking the last segment.
 * Static imports and wildcard imports are both captured.
 */
export function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // import [static] com.example.ClassName[.*];
  const importPattern = /^import\s+((?:static)\s+)?([\w.]+(?:\.\*)?)?[;\s]/gm;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(code)) !== null) {
    const isStatic = Boolean(match[1]);
    const fullPath = (match[2] || '').trim();
    if (!fullPath) continue;

    const isWildcard = fullPath.endsWith('.*');
    const cleanPath = isWildcard ? fullPath.slice(0, -2) : fullPath;
    const segments = cleanPath.split('.');

    let source: string;
    let name: string;

    if (isStatic) {
      // `import static a.b.ClassName.methodName` → source=a.b.ClassName, name=methodName
      name = segments.pop() || cleanPath;
      source = segments.join('.') || cleanPath;
    } else {
      // `import a.b.ClassName` → source=a.b.ClassName, name=ClassName
      name = segments[segments.length - 1] || cleanPath;
      source = cleanPath;
    }

    imports.push({
      source,
      names: [name],
      isLocal: false,
    });
  }

  return imports;
}

// ─── export extractor ────────────────────────────────────

/**
 * In Java, `public` members are the exported API surface.
 * Returns names of all top-level public classes, interfaces, enums, and methods.
 */
export function extractExports(code: string): string[] {
  const exports: string[] = [];

  // public class / interface / enum / record / @interface
  const typePattern = /^public\s+(?:(?:abstract|final|static)\s+)*(?:class|interface|enum|record|@interface)\s+([A-Za-z_]\w*)/gm;
  let match: RegExpExecArray | null;

  while ((match = typePattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // public methods
  const methodPattern = /^[ \t]*public\s+(?:(?:static|final|abstract|synchronized|native|default)\s+)*(?:<[^>]*>\s+)?(?:[\w.<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\(/gm;
  while ((match = methodPattern.exec(code)) !== null) {
    const name = match[1];
    if (!['if', 'for', 'while', 'switch', 'class', 'interface', 'enum'].includes(name)) {
      exports.push(name);
    }
  }

  return [...new Set(exports)];
}
