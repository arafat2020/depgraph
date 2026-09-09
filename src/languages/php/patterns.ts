import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * Entity-matching patterns for PHP, exposed for gitdiff reuse.
 * Mirrors _PHP_CONFIG: class_declaration, interface_declaration,
 * enum_declaration, trait_declaration, function_definition, method_declaration.
 */
export const phpEntityPatterns: EntityPattern[] = [
  // class (abstract class, final class, readonly class, etc.)
  {
    regex: /^[ \t]*(?:(?:abstract|final|readonly)\s+)*class\s+([A-Za-z_]\w*)(?:\s+extends\s+\S+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // interface
  {
    regex: /^[ \t]*interface\s+([A-Za-z_]\w*)(?:\s+extends\s+[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // trait
  {
    regex: /^[ \t]*trait\s+([A-Za-z_]\w*)\s*\{/gm,
    type: 'class',
  },
  // enum (PHP 8.1+)
  {
    regex: /^[ \t]*enum\s+([A-Za-z_]\w*)(?:\s*:\s*\w+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // function and method declarations
  {
    regex: /^[ \t]*(?:(?:public|protected|private|static|abstract|final|readonly)\s+)*function\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'function',
  },
];
