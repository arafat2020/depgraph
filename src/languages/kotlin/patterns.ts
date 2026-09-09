import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * Entity-matching patterns for Kotlin, exposed for gitdiff reuse.
 * Mirrors _KOTLIN_CONFIG: class_declaration, object_declaration, function_declaration.
 */
export const kotlinEntityPatterns: EntityPattern[] = [
  // class declarations (including data class, sealed class, abstract class, inner class)
  // The trailing brace is optional: abstract classes may have no body on the same line.
  // We anchor by requiring the class name to be followed by whitespace, <, (, :, { or EOL.
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|abstract|sealed|data|open|inner|inline|value|annotation)\s+)*class\s+([A-Za-z_]\w*)(?=[\s<(:,{\n]|$)/gm,
    type: 'class',
  },
  // object declarations (singleton objects and companion objects)
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal)\s+)*(?:companion\s+)?object\s+([A-Za-z_]\w*)\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // interface declarations
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|sealed|fun)\s+)*interface\s+([A-Za-z_]\w*)(?:\s*<[^{]*)?(?:\s*:\s*[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // enum class
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal)\s+)*enum\s+class\s+([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*\{/gm,
    type: 'class',
  },
  // function declarations (including suspend, inline, operator, extension functions)
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|override|open|final|abstract|suspend|inline|operator|infix|tailrec|external|actual|expect)\s+)*fun\s+(?:<[^>]*>\s+)?(?:[\w.]+\.)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
];
