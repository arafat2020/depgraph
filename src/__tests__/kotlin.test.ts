import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/kotlin';
import { parseFile } from '../stages/parser';

describe('Kotlin Parser', () => {
  const tempDir = path.join(__dirname, 'temp_kotlin');

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

  it('extracts regular, data, sealed, and abstract classes', () => {
    const f = write('Types.kt', `
package com.example

class UserService

data class UserDto(val id: Long, val name: String)

sealed class Result<out T>

abstract class BaseRepository
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserService', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserDto', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Result', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'BaseRepository', type: 'class' }));
  });

  it('extracts object declarations (singletons)', () => {
    const f = write('Singleton.kt', `
package com.example

object AppConfig {
    val baseUrl = "https://api.example.com"
}
`);
    expect(parseFile(f)?.entities).toContainEqual(
      expect.objectContaining({ name: 'AppConfig', type: 'class' })
    );
  });

  it('extracts interfaces', () => {
    const f = write('Repository.kt', `
package com.example

interface UserRepository {
    fun findById(id: Long): User?
}
`);
    expect(parseFile(f)?.entities).toContainEqual(
      expect.objectContaining({ name: 'UserRepository', type: 'interface' })
    );
  });

  it('extracts regular, suspend, inline, and extension functions', () => {
    const f = write('Functions.kt', `
package com.example

fun greet(name: String): String = "Hello, ${'$'}name"

suspend fun fetchUser(id: Long): User = User()

inline fun <reified T> fromJson(json: String): T = TODO()

fun String.toSlug(): String = this.lowercase().replace(" ", "-")
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'greet', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'fetchUser', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'fromJson', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'toSlug', type: 'function' }));
  });

  it('estimates cyclomatic complexity for Kotlin functions', () => {
    const f = write('Complex.kt', `
fun evaluate(x: Int): String {
    return if (x > 100) {
        "huge"
    } else if (x > 50) {
        "large"
    } else if (x > 10) {
        when (x) {
            1 -> "one"
            2 -> "two"
            else -> {
                for (i in 0..x) {
                    if (i % 2 == 0) continue
                }
                "other"
            }
        }
    } else {
        "small"
    }
}
`);
    const parsed = parseFile(f);
    const entity = parsed?.entities.find(e => e.name === 'evaluate');
    expect(entity?.complexity).toBe('medium');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts imports and respects aliases', () => {
    const f = write('Imports.kt', `
import kotlin.collections.List
import java.util.UUID
import com.example.domain.User as DomainUser
import org.springframework.stereotype.Service
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'kotlin.collections.List', names: ['List'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'java.util.UUID', names: ['UUID'] }));
    // alias 'as DomainUser' should be the local name
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'com.example.domain.User', names: ['DomainUser'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'org.springframework.stereotype.Service', names: ['Service'] }));
  });

  it('skips wildcard imports', () => {
    const f = write('Wildcards.kt', `
import kotlin.collections.*
import java.util.*
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toHaveLength(0);
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts public top-level declarations', () => {
    const f = write('Exports.kt', `
package com.example

class PublicClass

private class PrivateClass

fun publicFun() {}

private fun privateFun() {}
`);
    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('PublicClass');
    expect(parsed?.exports).toContain('publicFun');
    expect(parsed?.exports).not.toContain('privateFun');
  });
});
