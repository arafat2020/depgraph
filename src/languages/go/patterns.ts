import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * The entity-matching patterns for Go.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const goEntityPatterns: EntityPattern[] = [
  // functions and methods with optional receiver and type parameters (generics)
  {
    regex: /^func\s+(?:\([^)]*\)\s+)?([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*\(/gm,
    type: 'function'
  },
  // type declarations (structs, interfaces) with optional type parameters
  {
    regex: /^type\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(?:struct|interface)/gm,
    type: 'class'
  },
  // type aliases and custom types (e.g. type HandlerFunc func(...), type MyInt int)
  {
    regex: /^type\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(?!(?:struct|interface)\b)[A-Za-z_\[\]\*]/gm,
    type: 'type'
  }
];
