import { EntityPattern } from '../registry';

// ─── entity patterns ─────────────────────────────────────

/**
 * Entity-matching patterns for Swift, exposed for gitdiff reuse.
 * Mirrors _SWIFT_CONFIG: class_declaration, protocol_declaration,
 * function_declaration, init_declaration, deinit_declaration,
 * subscript_declaration.
 * Also covers struct/enum/actor/extension (all class-like containers in Swift).
 */
export const swiftEntityPatterns: EntityPattern[] = [
  // class (including final class, open class, public class)
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|open|final|@MainActor)\s+)*class\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // struct
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate)\s+)*struct\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // enum
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|indirect)\s+)*enum\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // protocol
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate)\s+)*protocol\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
    type: 'interface',
  },
  // actor (Swift 5.5+)
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|distributed)\s+)*actor\s+([A-Za-z_]\w*)(?:\s*:\s*[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // extension (cross-file method container, same type as class in Python extractor)
  // Supports: extension Foo, extension Array where Element: Comparable
  {
    regex: /^[ \t]*extension\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s*<[^>{]*>)?(?:\s*:\s*[^{]+)?(?:\s+where\s+[^{]+)?\s*\{/gm,
    type: 'class',
  },
  // function declarations (including mutating, static, class func, override, async, throws)
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|open|override|static|class|mutating|nonmutating|dynamic|final|required|convenience|async|throws|rethrows|nonisolated|@discardableResult|@objc|@MainActor)\s+)*func\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
  // init declarations
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|override|required|convenience)\s+)*init\??\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
  // deinit
  {
    regex: /^[ \t]*deinit\s*\{/gm,
    type: 'function',
  },
  // subscript
  {
    regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|static|override)\s+)*subscript\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function',
  },
];
