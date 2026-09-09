import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * The entity-matching patterns for C#.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const csharpEntityPatterns: EntityPattern[] = [
  // Classes, structs, records, interfaces, enums
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*(?:class|interface|enum|struct|record(?:\s+(?:class|struct))?)\s+([A-Za-z_]\w*)/gm,
    type: 'class'
  },
  // Methods (constructors, instance methods, async/static methods)
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|static|async|virtual|override|abstract|sealed|partial)\s+)+(?:(?:async\s+)?[\w<>[\]?,]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function'
  },
];
