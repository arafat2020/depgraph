import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

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
