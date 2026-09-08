import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/go';
import { parseFile } from '../stages/parser';

describe('Go Parser', () => {
  const tempDir = path.join(__dirname, 'temp_go');

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

  it('extracts regular functions', () => {
    const f = write('main.go', 'package main\n\nfunc calculateTotal(items []int) int {\n    return len(items)\n}\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({
      name: 'calculateTotal',
      type: 'function'
    }));
  });

  it('extracts methods with pointer receiver', () => {
    const f = write('user.go', 'package main\n\nfunc (u *User) GetFullName() string {\n    return u.FirstName + " " + u.LastName\n}\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({
      name: 'GetFullName',
      type: 'function'
    }));
  });

  it('extracts methods with value receiver', () => {
    const f = write('point.go', 'package main\n\nfunc (p Point) Distance() float64 {\n    return 0.0\n}\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({
      name: 'Distance',
      type: 'function'
    }));
  });

  it('extracts generic functions and methods', () => {
    const f = write('generics.go', 'package main\n\nfunc MapValues[K comparable, V any](m map[K]V) []V {\n    return nil\n}\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({
      name: 'MapValues',
      type: 'function'
    }));
  });

  it('extracts struct and interface types', () => {
    const f = write('types.go', `package main

type UserService struct {
    db DB
}

type DB interface {
    Query() string
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserService', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'DB', type: 'class' }));
  });

  it('extracts block type declarations', () => {
    const f = write('block_types.go', `package main

type (
    Config struct {
        Port int
    }
    Handler interface {
        Serve()
    }
    StringID string
)
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Config', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Handler', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'StringID', type: 'type' }));
  });

  it('estimates cyclomatic complexity for Go functions', () => {
    const f = write('complex.go', `package main

func Evaluate(x int) string {
    if x > 100 {
        return "huge"
    } else if x > 50 {
        return "large"
    } else if x > 10 {
        for i := 0; i < x; i++ {
            switch i {
            case 1:
                return "one"
            case 2:
                return "two"
            }
        }
    }
    return "small"
}
`);
    const parsed = parseFile(f);
    const entity = parsed?.entities.find(e => e.name === 'Evaluate');
    expect(entity?.complexity).toBe('medium');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts single-line imports and block imports with aliases', () => {
    const f = write('imports.go', `package main

import "fmt"
import (
    "os"
    "path/filepath"
    alias "github.com/gin-gonic/gin"
    . "./localpkg"
)
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'fmt', names: ['fmt'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'os', names: ['os'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'path/filepath', names: ['filepath'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'github.com/gin-gonic/gin', names: ['alias'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: './localpkg', isLocal: true }));
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts exported functions, types, and constants', () => {
    const f = write('exports.go', `package main

const GlobalTimeout = 30
var CurrentUser = "admin"

type (
    ExportedStruct struct{}
    unexportedStruct struct{}
)

func ExportedFunction() {}
func unexportedFunction() {}
func (e *ExportedStruct) ExportedMethod() {}
`);
    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('GlobalTimeout');
    expect(parsed?.exports).toContain('CurrentUser');
    expect(parsed?.exports).toContain('ExportedStruct');
    expect(parsed?.exports).toContain('ExportedFunction');
    expect(parsed?.exports).toContain('ExportedMethod');
    expect(parsed?.exports).not.toContain('unexportedStruct');
    expect(parsed?.exports).not.toContain('unexportedFunction');
  });
});
