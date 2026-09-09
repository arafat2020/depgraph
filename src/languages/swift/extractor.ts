import { RawEntity, RawImport } from '../../types';
import { swiftEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

export function extractEntities(code: string, _filePath: string): RawEntity[] {
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

// ─── import extractor ────────────────────────────────────

/**
 * Extracts Swift import statements.
 * Mirrors _import_swift and _SWIFT_CONFIG.import_types = {"import_declaration"}.
 *
 * Swift imports name modules, not file paths, so the target is always external.
 * Sub-module imports (import Foundation.NSDate) use the first segment as the module.
 */
export function extractImports(code: string): RawImport[] {
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

// ─── export extractor ────────────────────────────────────

/**
 * In Swift, `public` and `open` access-level members are the exported API.
 * Returns names of all public/open declarations.
 */
export function extractExports(code: string): string[] {
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
