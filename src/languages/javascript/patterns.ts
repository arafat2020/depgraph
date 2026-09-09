import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * The entity-matching patterns for JavaScript and TypeScript.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const jsEntityPatterns: EntityPattern[] = [
  // React components: wrapped in memo/forwardRef
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo|forwardRef)\(/gm,
    type: 'component'
  },
  // React components: PascalCase arrow functions
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/gm,
    type: 'component'
  },
  // React components: PascalCase function declarations
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'component'
  },
  // React hooks: camelCase starting with "use" (arrow functions or const assignments)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+(use[A-Z]\w*)\s*=/gm,
    type: 'hook'
  },
  // React hooks: camelCase starting with "use" (function declarations)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(use[A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'hook'
  },
  // regular and async function declarations (including generator functions)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*\s*|\s+)([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function'
  },
  // arrow functions assigned to const / let / var
  {
    regex: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/gm,
    type: 'function'
  },
  // function expressions assigned to const / let / var
  {
    regex: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?function/gm,
    type: 'function'
  },
  // classes (regular, exported, abstract)
  {
    regex: /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_]\w*)/gm,
    type: 'class'
  },
  // TypeScript interfaces
  {
    regex: /^(?:export\s+)?(?:default\s+)?interface\s+([A-Za-z_]\w*)/gm,
    type: 'interface'
  },
  // TypeScript types
  {
    regex: /^(?:export\s+)?(?:default\s+)?type\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*=/gm,
    type: 'type'
  },
  // TypeScript enums (regular or const enum)
  {
    regex: /^(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_]\w*)/gm,
    type: 'class'
  },
  // Express / router routes (capture group 1 = method, group 2 = path — skipped in gitdiff context matching)
  {
    regex: /(?:app|router|server)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/gm,
    type: 'api'
  },
];
