import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * The entity-matching patterns for Python.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const pyEntityPatterns: EntityPattern[] = [
  // functions and methods (including async def)
  {
    regex: /^[ \t]*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'function'
  },
  // classes (with optional generic parameters [T] and base classes (Base))
  {
    regex: /^[ \t]*class\s+([A-Za-z_]\w*)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?\s*:/gm,
    type: 'class'
  },
];
