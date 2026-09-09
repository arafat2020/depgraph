import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * Entity-matching patterns for Java, exposed for gitdiff reuse.
 * Mirrors _JAVA_CONFIG: class_declaration, interface_declaration,
 * record_declaration, enum_declaration, method_declaration,
 * constructor_declaration, annotation_type_declaration.
 */
export const javaEntityPatterns: EntityPattern[] = [
  // class / abstract class / final class
  {
    regex: /^[ \t]*(?:(?:public|protected|private|abstract|final|static)\s+)*class\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?:extends\s+\S+\s*)?(?:implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // interface
  {
    regex: /^[ \t]*(?:(?:public|protected|private|abstract|static)\s+)*interface\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?:extends\s+[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // record (Java 14+)
  {
    regex: /^[ \t]*(?:(?:public|protected|private|final|static)\s+)*record\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'class',
  },
  // enum
  {
    regex: /^[ \t]*(?:(?:public|protected|private|static)\s+)*enum\s+([A-Za-z_]\w*)\s*(?:implements\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // annotation type
  {
    regex: /^[ \t]*(?:(?:public|protected|private|abstract|static)\s+)*@interface\s+([A-Za-z_]\w*)\s*\{/gm,
    type: 'interface',
  },
  // method declarations (with return type before the name)
  {
    regex: /^[ \t]*(?:(?:public|protected|private|static|final|abstract|synchronized|native|default|override)\s+)*(?:<[^>]*>\s+)?(?:[\w.<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/gm,
    type: 'function',
  },
];
