import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimates cyclomatic complexity of a Java method by counting decision keywords
 * inside its body via brace-depth tracking.
 */
function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  // Match: returnType methodName( OR className( for constructors
  const defRegex = new RegExp(
    `(?:^|\\s)${escapeRegex(name)}\\s*\\(`,'m'
  );
  const defLineIdx = lines.findIndex(l => defRegex.test(l));
  if (defLineIdx === -1) return 'low';

  // Find opening brace of method body
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
    body.match(/\b(if|else\s+if|else|for|while|do|switch|case|catch|&&|\|\|)\b/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns ────────────────────────────────────

/**
 * Entity-matching patterns for Java, exposed for gitdiff reuse.
 * Mirrors _JAVA_CONFIG: class_declaration, interface_declaration,
 * record_declaration, enum_declaration, method_declaration,
 * constructor_declaration, annotation_type_declaration.
 */
export const javaEntityPatterns: EntityPattern[] = [
  // class / abstract class / final class
  {
    regex: /^[ \t]*(?:(?:public|protected|private|abstract|final|static)\s+)*class\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?:extends\s+\S+\s*)?(?:implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // interface
  {
    regex: /^[ \t]*(?:(?:public|protected|private|abstract|static)\s+)*interface\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?:extends\s+[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // record (Java 14+)
  {
    regex: /^[ \t]*(?:(?:public|protected|private|final|static)\s+)*record\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'class',
  },
  // enum
  {
    regex: /^[ \t]*(?:(?:public|protected|private|static)\s+)*enum\s+([A-Za-z_]\w*)\s*(?:implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // annotation type
  {
    regex: /^[ \t]*(?:(?:public|protected|private|abstract|static)\s+)*@interface\s+([A-Za-z_]\w*)\s*\{/gm,
    type: 'interface',
  },
  // method declarations (with return type before the name)
  {
    regex: /^[ \t]*(?:(?:public|protected|private|static|final|abstract|synchronized|native|default|override)\s+)*(?:<[^>]*>\s+)?(?:[\w.<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/gm,
    type: 'function',
  },
];

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, _filePath: string): RawEntity[] {
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

// ─── import extractor ───────────────────────────────────

/**
 * Extracts Java import statements.
 * Mirrors _import_java: walks scoped_identifier nodes taking the last segment.
 * Static imports and wildcard imports are both captured.
 */
function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // import [static] com.example.ClassName[.*];
  const importPattern = /^import\s+((?:static)\s+)?([\w.]+(?:\.\*)?)?\s*;/gm;
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

// ─── export extractor ───────────────────────────────────

/**
 * In Java, `public` members are the exported API surface.
 * Returns names of all top-level public classes, interfaces, enums, and methods.
 */
function extractExports(code: string): string[] {
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

// ─── register ───────────────────────────────────────────

const JavaParser: LanguageParser = {
  lang: 'java',
  extensions: ['.java'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: javaEntityPatterns,
};

registerParser(JavaParser);
