import { EntityPattern } from '../registry';

// ─── entity patterns (for gitdiff & depgraph reuse) ──────

/**
 * Entity-matching patterns for Dart, exposed for gitdiff reuse.
 * Group 1 must capture the entity identifier name.
 */
export const dartEntityPatterns: EntityPattern[] = [
  // class, abstract class, sealed class, mixin class, base class, interface class, final class, enum, extension type
  {
    regex: /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+([A-Za-z_]\w*)/gm,
    type: 'class',
  },
  // extension MyExt on MyClass (named extension)
  {
    regex: /^[ \t]{0,4}extension\s+([A-Za-z_]\w+)(?:<[^>]+>)?\s+on\s+[A-Za-z_]\w*/gm,
    type: 'class',
  },
  // typedef
  {
    regex: /^[ \t]*typedef\s+(?:[\w<>,.?\s]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]+>)?\s*(?:=|\()/gm,
    type: 'type',
  },
  // methods, functions, getters/setters, constructors
  {
    regex: /^[ \t]{0,2}(?:(?:factory|static|async|external|abstract)\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'function',
  },
];

export const DART_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'case', 'catch', 'return', 'void', 'dynamic',
  'final', 'const', 'get', 'set', 'true', 'false', 'null', 'default', 'break',
  'continue', 'throw', 'rethrow', 'assert', 'class', 'mixin', 'enum', 'extension',
  'typedef', 'import', 'export', 'part', 'library', 'with', 'implements', 'extends', 'on'
]);

export const DART_PRIMITIVE_TYPES = new Set([
  'String', 'int', 'double', 'bool', 'num', 'dynamic', 'Object', 'void',
  'List', 'Map', 'Set', 'Future', 'Stream', 'Function', 'Record'
]);
