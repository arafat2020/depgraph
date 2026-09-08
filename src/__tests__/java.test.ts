import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/java';
import { parseFile } from '../stages/parser';

describe('Java Parser', () => {
  const tempDir = path.join(__dirname, 'temp_java');

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

  it('extracts classes, abstract classes, and final classes', () => {
    const f = write('Types.java', `
package com.example;

public class UserService {
}

public abstract class BaseRepository {
}

public final class Constants {
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserService', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'BaseRepository', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Constants', type: 'class' }));
  });

  it('extracts interfaces', () => {
    const f = write('IRepository.java', `
package com.example;

public interface UserRepository {
    User findById(Long id);
}
`);
    expect(parseFile(f)?.entities).toContainEqual(
      expect.objectContaining({ name: 'UserRepository', type: 'interface' })
    );
  });

  it('extracts enums', () => {
    const f = write('Status.java', `
package com.example;

public enum OrderStatus {
    PENDING, CONFIRMED, SHIPPED, DELIVERED
}
`);
    expect(parseFile(f)?.entities).toContainEqual(
      expect.objectContaining({ name: 'OrderStatus', type: 'class' })
    );
  });

  it('extracts records (Java 14+)', () => {
    const f = write('UserDto.java', `
package com.example;

public record UserDto(Long id, String name, String email) {
}
`);
    expect(parseFile(f)?.entities).toContainEqual(
      expect.objectContaining({ name: 'UserDto', type: 'class' })
    );
  });

  it('extracts methods with various modifiers', () => {
    const f = write('OrderService.java', `
package com.example;

public class OrderService {
    public Order createOrder(CreateOrderDto dto) {
        return null;
    }

    private void validateOrder(Order order) {
    }

    public static <T> List<T> toList(T item) {
        return null;
    }
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'createOrder', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'validateOrder', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'toList', type: 'function' }));
  });

  it('estimates cyclomatic complexity for Java methods', () => {
    const f = write('Calculator.java', `
package com.example;

public class Calculator {
    public String evaluate(int x) {
        if (x > 100) {
            return "huge";
        } else if (x > 50) {
            return "large";
        } else if (x > 10) {
            for (int i = 0; i < x; i++) {
                switch (i) {
                    case 1: return "one";
                    case 2: return "two";
                }
            }
        }
        return "small";
    }
}
`);
    const parsed = parseFile(f);
    const entity = parsed?.entities.find(e => e.name === 'evaluate');
    expect(entity?.complexity).toBe('medium');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts regular and static imports', () => {
    const f = write('Service.java', `
package com.example;

import java.util.List;
import java.util.Map;
import java.io.IOException;
import static java.util.Collections.emptyList;
import com.example.domain.*;
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'java.util.List', names: ['List'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'java.util.Map', names: ['Map'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'java.io.IOException', names: ['IOException'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'java.util.Collections', names: ['emptyList'] }));
    // wildcard: last segment before .* is the package name
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'com.example.domain', names: ['domain'] }));
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts public types and methods, excludes private', () => {
    const f = write('Exports.java', `
package com.example;

public class PublicService {
    public void doWork() {}
    private void internalWork() {}
    protected void protectedWork() {}
}

class PackagePrivateClass {
}
`);
    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('PublicService');
    expect(parsed?.exports).toContain('doWork');
    expect(parsed?.exports).not.toContain('internalWork');
  });
});
