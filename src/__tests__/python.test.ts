import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/python';
import { parseFile } from '../stages/parser';

describe('Python Parser', () => {
  const tempDir = path.join(__dirname, 'temp_python');

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

  it('extracts a regular function', () => {
    const f = write('a.py', 'def get_user(id):\n    return id\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({ name: 'get_user', type: 'function' }));
  });

  it('extracts an async function', () => {
    const f = write('a.py', 'async def fetch_data():\n    pass\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({ name: 'fetch_data', type: 'function' }));
  });

  it('extracts a class', () => {
    const f = write('a.py', 'class UserService:\n    pass\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({ name: 'UserService', type: 'class' }));
  });

  it('extracts a class with a base class', () => {
    const f = write('a.py', 'class AdminService(UserService):\n    pass\n');
    expect(parseFile(f)?.entities).toContainEqual(expect.objectContaining({ name: 'AdminService', type: 'class' }));
  });

  it('skips dunder methods like __init__', () => {
    const f = write('a.py', 'class Foo:\n    def __init__(self):\n        pass\n    def save(self):\n        pass\n');
    const names = parseFile(f)?.entities.map(e => e.name);
    expect(names).not.toContain('__init__');
    expect(names).toContain('save');
  });

  it('keeps same-named methods from different classes', () => {
    const code = 'class A:\n    def validate(self):\n        pass\n\nclass B:\n    def validate(self):\n        pass\n';
    const f = write('a.py', code);
    const entities = parseFile(f)?.entities.filter(e => e.name === 'validate');
    expect(entities?.length).toBe(2);
  });

  it('sets lang to py', () => {
    const f = write('a.py', 'def foo():\n    pass\n');
    expect(parseFile(f)?.lang).toBe('py');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts a simple from-import', () => {
    const f = write('a.py', 'from os import path\n');
    expect(parseFile(f)?.imports).toContainEqual(expect.objectContaining({ source: 'os', names: ['path'] }));
  });

  it('extracts multiple names from a from-import', () => {
    const f = write('a.py', 'from os import path, getcwd\n');
    expect(parseFile(f)?.imports).toContainEqual(expect.objectContaining({ source: 'os', names: ['path', 'getcwd'] }));
  });

  it('strips aliases from from-imports', () => {
    const f = write('a.py', 'from module import something as alias\n');
    const imp = parseFile(f)?.imports.find(i => i.source === 'module');
    expect(imp?.names).toEqual(['something']);
  });

  it('extracts multi-line parenthesised imports', () => {
    const code = 'from os import (\n    path,\n    getcwd\n)\n';
    const f = write('a.py', code);
    const imp = parseFile(f)?.imports.find(i => i.source === 'os');
    expect(imp?.names).toContain('path');
    expect(imp?.names).toContain('getcwd');
  });

  it('extracts a bare import', () => {
    const f = write('a.py', 'import json\n');
    expect(parseFile(f)?.imports).toContainEqual(expect.objectContaining({ source: 'json', names: ['json'], isLocal: false }));
  });

  it('strips alias from bare import', () => {
    const f = write('a.py', 'import numpy as np\n');
    const imp = parseFile(f)?.imports.find(i => i.source === 'numpy');
    expect(imp?.names).toEqual(['numpy']);
  });

  it('marks relative imports as isLocal: true', () => {
    const f = write('a.py', 'from .utils import helper\n');
    expect(parseFile(f)?.imports).toContainEqual(expect.objectContaining({ source: '.utils', isLocal: true }));
  });

  it('marks absolute imports as isLocal: false', () => {
    const f = write('a.py', 'from flask import Flask\n');
    expect(parseFile(f)?.imports).toContainEqual(expect.objectContaining({ source: 'flask', isLocal: false }));
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts single-line __all__', () => {
    const f = write('a.py', '__all__ = ["get_user", "create_user"]\n');
    expect(parseFile(f)?.exports).toEqual(expect.arrayContaining(['get_user', 'create_user']));
  });

  it('extracts multi-line __all__', () => {
    const code = '__all__ = [\n    "get_user",\n    "create_user",\n]\n';
    const f = write('a.py', code);
    expect(parseFile(f)?.exports).toEqual(expect.arrayContaining(['get_user', 'create_user']));
  });

  it('returns empty exports when no __all__', () => {
    const f = write('a.py', 'def foo():\n    pass\n');
    expect(parseFile(f)?.exports).toEqual([]);
  });
});
