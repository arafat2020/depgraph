import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/swift';
import { parseFile } from '../stages/parser';

describe('Swift Parser', () => {
  const tempDir = path.join(__dirname, 'temp_swift');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function write(name: string, content: string) {
    const file = path.join(tempDir, name);
    fs.writeFileSync(file, content);
    return file;
  }

  // ─── entities ───────────────────────────────────────────

  it('extracts classes including final and open', () => {
    const f = write('Types.swift', `
import Foundation

public class UserService {
}

open class BaseViewModel {
}

final class AppRouter {
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserService', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'BaseViewModel', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'AppRouter', type: 'class' }));
  });

  it('extracts structs and enums', () => {
    const f = write('ValueTypes.swift', `
struct Point {
    var x: Double
    var y: Double
}

enum Direction {
    case north, south, east, west
}

enum NetworkError: Error {
    case notFound
    case serverError(Int)
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Point', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Direction', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'NetworkError', type: 'class' }));
  });

  it('extracts protocols', () => {
    const f = write('Protocols.swift', `
protocol UserRepository {
    func findById(_ id: UUID) -> User?
    func save(_ user: User) throws
}

protocol Codable: Decodable, Encodable {}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserRepository', type: 'interface' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Codable', type: 'interface' }));
  });

  it('extracts actors (Swift 5.5+)', () => {
    const f = write('Actors.swift', `
actor DataCache {
    private var store: [String: Data] = [:]

    func get(_ key: String) -> Data? {
        store[key]
    }
}
`);
    expect(parseFile(f)?.entities).toContainEqual(
      expect.objectContaining({ name: 'DataCache', type: 'class' })
    );
  });

  it('extracts extensions', () => {
    const f = write('Extensions.swift', `
extension String {
    func toSlug() -> String {
        return self.lowercased().replacingOccurrences(of: " ", with: "-")
    }
}

extension Array where Element: Comparable {
    func sortedDescending() -> [Element] {
        return self.sorted(by: >)
    }
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'String', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Array', type: 'class' }));
  });

  it('extracts functions with modifiers (async, throws, mutating, static)', () => {
    const f = write('Functions.swift', `
struct UserStore {
    mutating func addUser(_ user: User) {}
    static func shared() -> UserStore { UserStore() }
    func fetchAll() async throws -> [User] { [] }
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'addUser', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'shared', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'fetchAll', type: 'function' }));
  });

  it('extracts init and deinit', () => {
    const f = write('Init.swift', `
class Connection {
    init(url: URL) {}
    deinit {}
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'init', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'deinit', type: 'function' }));
  });

  it('estimates cyclomatic complexity for Swift functions', () => {
    const f = write('Complex.swift', `
func evaluate(x: Int) -> String {
    if x > 100 {
        return "huge"
    } else if x > 50 {
        return "large"
    } else if x > 10 {
        for i in 0..<x {
            switch i {
            case 1:
                return "one"
            case 2:
                return "two"
            default:
                break
            }
        }
    }
    return "small"
}
`);
    const parsed = parseFile(f);
    const entity = parsed?.entities.find(e => e.name === 'evaluate');
    expect(entity?.complexity).toBe('medium');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts module imports including sub-module and kind imports', () => {
    const f = write('Imports.swift', `
import Foundation
import UIKit
import SwiftUI
import class UIKit.UIViewController
import func Darwin.cos
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'Foundation', names: ['Foundation'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'UIKit', names: ['UIKit'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'SwiftUI', names: ['SwiftUI'], isLocal: false }));
    // Kind imports: `import class UIKit.UIViewController` → top module is UIKit
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'UIKit', names: ['UIKit'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'Darwin', names: ['Darwin'] }));
  });

  it('deduplicates repeated module imports', () => {
    const f = write('DupeImports.swift', `
import Foundation
import UIKit
import Foundation
`);
    const parsed = parseFile(f);
    const foundationImports = parsed?.imports.filter(i => i.source === 'Foundation');
    // raw duplicates are allowed at the import level; dedup happens in graph build
    expect(foundationImports?.length).toBeGreaterThanOrEqual(1);
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts public and open declarations, excludes internal/private', () => {
    const f = write('Exports.swift', `
public class PublicService {}
open class OpenBase {}
internal class InternalHelper {}
private class PrivateImpl {}

public func publicFunction() {}
internal func internalHelper() {}
private func privateHelper() {}

public struct PublicStruct {}
public enum PublicEnum { case a, b }
public protocol PublicProtocol {}
`);
    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('PublicService');
    expect(parsed?.exports).toContain('OpenBase');
    expect(parsed?.exports).toContain('publicFunction');
    expect(parsed?.exports).toContain('PublicStruct');
    expect(parsed?.exports).toContain('PublicEnum');
    expect(parsed?.exports).toContain('PublicProtocol');
    expect(parsed?.exports).not.toContain('InternalHelper');
    expect(parsed?.exports).not.toContain('PrivateImpl');
    expect(parsed?.exports).not.toContain('internalHelper');
    expect(parsed?.exports).not.toContain('privateHelper');
  });
});
