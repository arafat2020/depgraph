import { RawEntity, RawImport } from '../../types';
import { rubyEntityPatterns } from './patterns';
import { estimateComplexity, sanitizeMethodName } from './helpers';

// ─── entity extractor ────────────────────────────────────

export function extractEntities(code: string, _filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of rubyEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const rawName = match[1];
      if (!rawName) continue;

      // Sanitize method suffixes for ID safety
      const name = type === 'function' ? sanitizeMethodName(rawName) : rawName;

      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

      if (entities.some(e => e.name === name && e.line === line)) continue;

      entities.push({
        name,
        type,
        line,
        complexity: type === 'function' ? estimateComplexity(code, rawName) : 'low',
      });
    }
  }

  return entities;
}

// ─── import extractor ────────────────────────────────────

/**
 * Extracts Ruby import/load statements.
 *
 * Ruby uses `require`, `require_relative`, and `load` for file imports,
 * and `include`/`extend`/`prepend` for mixing in modules.
 * The Python _RUBY_CONFIG has import_types=frozenset() because tree-sitter
 * handles Ruby requires as call nodes, not import nodes. We recover them
 * via regex to preserve the dependency graph edges.
 */
export function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // require 'module' or require "module"
  const requirePattern = /^[ \t]*require\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = requirePattern.exec(code)) !== null) {
    const source = match[1];
    const name = source.split('/').pop() || source;
    imports.push({ source, names: [name], isLocal: false });
  }

  // require_relative 'path'
  const relPattern = /^[ \t]*require_relative\s+['"]([^'"]+)['"]/gm;
  while ((match = relPattern.exec(code)) !== null) {
    const source = match[1];
    const name = source.split('/').pop() || source;
    imports.push({ source, names: [name], isLocal: true });
  }

  // load 'file.rb'
  const loadPattern = /^[ \t]*load\s+['"]([^'"]+)['"]/gm;
  while ((match = loadPattern.exec(code)) !== null) {
    const source = match[1];
    const name = source.split('/').pop()?.replace(/\.rb$/, '') || source;
    imports.push({ source, names: [name], isLocal: true });
  }

  // include / extend / prepend ModuleName (mixin as import edge)
  const mixinPattern = /^[ \t]*(?:include|extend|prepend)\s+([A-Z]\w*(?:::[A-Z]\w*)*)/gm;
  while ((match = mixinPattern.exec(code)) !== null) {
    const source = match[1];
    const name = source.split('::').pop() || source;
    imports.push({ source, names: [name], isLocal: false });
  }

  return imports;
}

// ─── export extractor ────────────────────────────────────

/**
 * In Ruby everything is accessible by default. We surface:
 *   - Top-level constants (classes, modules) — always public
 *   - Methods listed in `attr_reader`, `attr_writer`, `attr_accessor`
 *   - Explicitly `public` methods (following a `public` call with no args)
 * `module_function` methods are also treated as public API.
 */
export function extractExports(code: string): string[] {
  const exports: string[] = [];

  // Top-level classes and modules
  const typePattern = /^(?:class|module)\s+([A-Z]\w*(?:::[A-Z]\w*)*)/gm;
  let match: RegExpExecArray | null;
  while ((match = typePattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // attr_reader / attr_writer / attr_accessor :name, :name2
  const attrPattern = /^[ \t]*attr_(?:reader|writer|accessor)\s+(.+)$/gm;
  while ((match = attrPattern.exec(code)) !== null) {
    const syms = match[1].split(',').map(s => s.trim().replace(/^:/, ''));
    exports.push(...syms.filter(Boolean));
  }

  // module_function def foo, public def foo
  const pubFuncPattern = /^[ \t]*(?:module_function|public)\s+def\s+([A-Za-z_]\w*[!?=]?)/gm;
  while ((match = pubFuncPattern.exec(code)) !== null) {
    exports.push(sanitizeMethodName(match[1]));
  }

  return [...new Set(exports)];
}
