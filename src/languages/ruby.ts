import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitise Ruby method name suffixes (!, ?, =) the same way the Python
 * extractor does (`_ruby_sanitize_method_name` in extract.py, issue #3077).
 */
function sanitizeMethodName(name: string): string {
  if (name.endsWith('!')) return `${name.slice(0, -1)}_bang`;
  if (name.endsWith('?')) return `${name.slice(0, -1)}_pred`;
  if (name.endsWith('=')) return `${name.slice(0, -1)}_eq`;
  return name;
}

/**
 * Estimates cyclomatic complexity of a Ruby method via indentation tracking.
 * Ruby methods don't use braces so we count branch keywords until `end`.
 */
function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  // Match: def name or def self.name
  const defRegex = new RegExp(`^[ \\t]*def\\s+(?:self\\.)?${escapeRegex(name)}(?:[!?=])?\\s*(\\(|$)`, 'm');
  const defLineIdx = lines.findIndex(l => defRegex.test(l));
  if (defLineIdx === -1) return 'low';

  const bodyLines: string[] = [];
  let depth = 0;

  for (let i = defLineIdx; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Keywords that open a new `end` scope
    if (/\b(def|class|module|do\b|begin|if(?!.*\bend\b)|unless(?!.*\bend\b)|while(?!.*\bend\b)|until(?!.*\bend\b)|for\s|case\b)\b/.test(trimmed)) {
      depth++;
    }
    if (/\bend\b/.test(trimmed)) {
      depth--;
      if (depth <= 0) { bodyLines.push(line); break; }
    }
    bodyLines.push(line);
  }

  const body = bodyLines.join('\n');
  const branches = (
    body.match(/\b(if|elsif|else|unless|while|until|for|rescue|when|and|or|&&|\|\|)\b/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns ────────────────────────────────────

/**
 * Entity-matching patterns for Ruby, exposed for gitdiff reuse.
 * Mirrors _RUBY_CONFIG: class, module, method (def), singleton_method (def self.*).
 */
export const rubyEntityPatterns: EntityPattern[] = [
  // class declarations (class Foo, class Foo < Bar)
  {
    regex: /^[ \t]*class\s+([A-Z]\w*(?:::[A-Z]\w*)*)\s*(?:<\s*\S+)?\s*$/gm,
    type: 'class',
  },
  // module declarations
  {
    regex: /^[ \t]*module\s+([A-Z]\w*(?:::[A-Z]\w*)*)\s*$/gm,
    type: 'class',
  },
  // singleton methods: def self.method_name[!?=]
  {
    regex: /^[ \t]*def\s+self\.([A-Za-z_]\w*[!?=]?)\s*(?:\(|$)/gm,
    type: 'function',
  },
  // instance methods: def method_name[!?=]
  {
    regex: /^[ \t]*def\s+([A-Za-z_]\w*[!?=]?)\s*(?:\(|$)/gm,
    type: 'function',
  },
];

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, _filePath: string): RawEntity[] {
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

// ─── import extractor ───────────────────────────────────

/**
 * Extracts Ruby import/load statements.
 *
 * Ruby uses `require`, `require_relative`, and `load` for file imports,
 * and `include`/`extend`/`prepend` for mixing in modules.
 * The Python _RUBY_CONFIG has import_types=frozenset() because tree-sitter
 * handles Ruby requires as call nodes, not import nodes. We recover them
 * via regex to preserve the dependency graph edges.
 */
function extractImports(code: string): RawImport[] {
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

// ─── export extractor ───────────────────────────────────

/**
 * In Ruby everything is accessible by default. We surface:
 *   - Top-level constants (classes, modules) — always public
 *   - Methods listed in `attr_reader`, `attr_writer`, `attr_accessor`
 *   - Explicitly `public` methods (following a `public` call with no args)
 * `module_function` methods are also treated as public API.
 */
function extractExports(code: string): string[] {
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

// ─── register ───────────────────────────────────────────

const RubyParser: LanguageParser = {
  lang: 'ruby',
  extensions: ['.rb', '.rake', '.gemspec'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: rubyEntityPatterns,
};

registerParser(RubyParser);
