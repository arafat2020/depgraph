import { EntityPattern } from '../registry';

// ─── blocklist & primitives ──────────────────────────────

export const RUST_TRAIT_METHOD_BLOCKLIST: ReadonlySet<string> = new Set([
  'new', 'default', 'parse', 'from_str', 'now', 'clone', 'into', 'from',
  'to_string', 'to_owned', 'len', 'is_empty', 'iter', 'next', 'build',
  'start', 'run', 'init', 'app', 'get', 'set', 'push', 'pop', 'insert',
  'remove', 'contains', 'collect', 'map', 'filter', 'unwrap', 'expect',
  'ok', 'err', 'some', 'none', 'send', 'recv', 'lock', 'read', 'write',
]);

export const RUST_PRIMITIVES = new Set([
  'bool', 'char', 'str',
  'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
  'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
  'f32', 'f64', '()', '!',
]);

export const RUST_KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
  'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in',
  'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type',
  'unsafe', 'use', 'where', 'while'
]);

// ─── entity patterns (for gitdiff & depgraph reuse) ──────

export const rustEntityPatterns: EntityPattern[] = [
  // Functions: free functions, methods, async fn, const fn, unsafe fn
  {
    regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)/gm,
    type: 'function',
  },
  // Structs
  {
    regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)/gm,
    type: 'class',
  },
  // Enums
  {
    regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/gm,
    type: 'class',
  },
  // Traits
  {
    regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:unsafe\s+)?trait\s+([A-Za-z_]\w*)/gm,
    type: 'interface',
  },
  // Impl blocks: impl Type or impl Trait for Type
  {
    regex: /^[ \t]*impl(?:\s*<[^>]*>)?\s+(?:[A-Za-z_]\w*(?:\s*<[^>]*>)?\s+for\s+)?([A-Za-z_]\w*)/gm,
    type: 'class',
  },
  // Type aliases
  {
    regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?type\s+([A-Za-z_]\w*)/gm,
    type: 'type',
  },
];
