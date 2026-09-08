import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimates cyclomatic complexity of a Swift function/method via brace-depth tracking.
 */
function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  // Match: func name(  or  init(  or  deinit  or  subscript
  const defRegex = new RegExp(
    `(?:^|\\s)(?:func\\s+${escapeRegex(name)}|init|deinit|subscript)\\s*(?:<[^>]*>)?\\s*\\(`, 'm'
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
    body.match(/\b(if|else\s+if|else|for\s|while|repeat|switch|case|catch|guard|&&|\|\|)\b/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns ────────────────────────────────────

/**
 * Entity-matching patterns for Swift, exposed for gitdiff reuse.
 * Mirrors _SWIFT_CONFIG: class_declaration, protocol_declaration,
 * function_declaration, init_declaration, deinit_declaration,
 * subscript_declaration.
 * Also covers struct/enum/actor/extension (all class-like containers in Swift).
 */
export const swiftEntityPatterns: EntityPattern[] = [
  // class (including final class, open class, public class)
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|open|final|@MainActor)\s+)*class\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // struct
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate)\s+)*struct\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // enum
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|indirect)\s+)*enum\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // protocol
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate)\s+)*protocol\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // actor (Swift 5.5+)
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|distributed)\s+)*actor\s+([A-Za-z_]\w*)(?:\s*:\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // extension (cross-file method container, same type as class in Python extractor)
  // Supports: extension Foo, extension Array where Element: Comparable
  {
    regex: /^[ \t]*extension\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s*<[^>{]*>)?(?:\s*:\s*[^{]+)?(?:\s+where\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // function declarations (including mutating, static, class func, override, async, throws)
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|open|override|static|class|mutating|nonmutating|dynamic|final|required|convenience|async|throws|rethrows|nonisolated|@discardableResult|@objc|@MainActor)\s+)*func\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
  // init declarations
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|override|required|convenience)\s+)*init\??\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
  // deinit
  {
    regex: /^[ \t]*deinit\s*\{/gm,
    type: 'function',
  },
  // subscript
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|static|override)\s+)*subscript\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
];

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, _filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of swiftEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      // Some patterns (init, deinit, subscript) have no capture group → use keyword
      const name = match[1] ?? (
        /\binit\b/.test(match[0]) ? 'init'
        : /\bdeinit\b/.test(match[0]) ? 'deinit'
        : 'subscript'
      );

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
 * Extracts Swift import statements.
 * Mirrors _import_swift and _SWIFT_CONFIG.import_types = {"import_declaration"}.
 *
 * Swift imports name modules, not file paths, so the target is always external.
 * Sub-module imports (import Foundation.NSDate) use the first segment as the module.
 */
function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // import ModuleName
  // import kind ModuleName.SubName  (kind = class/struct/enum/func/var/let/typealias)
  // The optional kind keyword must NOT be captured as the module name.
  const importPattern = /^[ \t]*import\s+(?:(?:class|struct|enum|func|var|let|typealias)\s+)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/gm;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(code)) !== null) {
    const fullPath = match[1];
    // Use only the top-level module name as the node target (mirrors Python _import_swift)
    const moduleName = fullPath.split('.')[0];
    // Skip if the captured name is itself a Swift keyword (shouldn't happen with the
    // optional non-capturing group above, but guard just in case)
    if (['class', 'struct', 'enum', 'func', 'var', 'let', 'typealias'].includes(moduleName)) continue;
    imports.push({
      source: moduleName,
      names: [moduleName],
      isLocal: false,
    });
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────

/**
 * In Swift, `public` and `open` access-level members are the exported API.
 * Returns names of all public/open declarations.
 */
function extractExports(code: string): string[] {
  const exports: string[] = [];

  const publicPatterns = [
    // public/open class, struct, enum, protocol, actor, extension
    /^(?:(?:public|open|final)\s+)*(?:class|struct|enum|protocol|actor)\s+([A-Za-z_]\w*)/gm,
    // public extension is not really an export, but surfaces it for graph linking
    /^(?:public\s+)?extension\s+([A-Za-z_]\w*)/gm,
    // public func
    /^[ \t]*(?:public|open)\s+(?:(?:static|class|override|mutating|async|throws|nonisolated)\s+)*func\s+([A-Za-z_]\w*)/gm,
    // public var / let
    /^[ \t]*(?:public|open)\s+(?:(?:static|class|lazy|private\(set\)|internal\(set\))\s+)*(?:var|let)\s+([A-Za-z_]\w*)/gm,
    // public init
    /^[ \t]*(?:public|open)\s+(?:required\s+|convenience\s+)?init/gm,
  ];

  for (const pattern of publicPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      if (match[1]) exports.push(match[1]);
    }
  }

  return [...new Set(exports)];
}

// ─── register ───────────────────────────────────────────

const SwiftParser: LanguageParser = {
  lang: 'swift',
  extensions: ['.swift'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: swiftEntityPatterns,
};

registerParser(SwiftParser);
