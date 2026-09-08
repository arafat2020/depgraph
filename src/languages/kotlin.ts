import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimates cyclomatic complexity of a Kotlin function via brace-depth tracking.
 */
function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const defRegex = new RegExp(
    `(?:^|\\s)fun\\s+(?:<[^>]*>\\s+)?(?:\\w[\\w.]*\\.)?${escapeRegex(name)}\\s*(?:\\(|<)`, 'm'
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
    body.match(/\b(if|else\s+if|else|for|while|when|catch|&&|\|\|)\b/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns ────────────────────────────────────

/**
 * Entity-matching patterns for Kotlin, exposed for gitdiff reuse.
 * Mirrors _KOTLIN_CONFIG: class_declaration, object_declaration, function_declaration.
 */
export const kotlinEntityPatterns: EntityPattern[] = [
  // class declarations (including data class, sealed class, abstract class, inner class)
  // The trailing brace is optional: abstract classes may have no body on the same line.
  // We anchor by requiring the class name to be followed by whitespace, <, (, :, { or EOL.
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|abstract|sealed|data|open|inner|inline|value|annotation)\s+)*class\s+([A-Za-z_]\w*)(?=[\s<(:,{\n]|$)/gm,
    type: 'class',
  },
  // object declarations (singleton objects and companion objects)
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal)\s+)*(?:companion\s+)?object\s+([A-Za-z_]\w*)\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // interface declarations
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|sealed|fun)\s+)*interface\s+([A-Za-z_]\w*)(?:\s*<[^{]*)?(?:\s*:\s*[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // enum class
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal)\s+)*enum\s+class\s+([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*\{/gm,
    type: 'class',
  },
  // function declarations (including suspend, inline, operator, extension functions)
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|override|open|final|abstract|suspend|inline|operator|infix|tailrec|external|actual|expect)\s+)*fun\s+(?:<[^>]*>\s+)?(?:[\w.]+\.)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
];

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, _filePath: string): RawEntity[] {
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

// ─── import extractor ───────────────────────────────────

/**
 * Extracts Kotlin import statements.
 * Mirrors _import_kotlin: handles qualified paths, wildcards (skipped),
 * and `as` aliases. The last segment of the dotted path is the local name.
 */
function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // import com.example.Foo [as Bar]
  // import com.example.*   (wildcard → skip per Python impl)
  // Regex: capture dotted-name, then optionally `.*` in its own group so
  // the endsWith check below always sees the asterisk when present.
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

// ─── export extractor ───────────────────────────────────

/**
 * In Kotlin, `public` (the default visibility) members are the exported API.
 * Returns names of all public / implicitly public top-level declarations.
 */
function extractExports(code: string): string[] {
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

// ─── register ───────────────────────────────────────────

const KotlinParser: LanguageParser = {
  lang: 'kotlin',
  extensions: ['.kt', '.kts'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: kotlinEntityPatterns,
};

registerParser(KotlinParser);
