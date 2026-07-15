import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/javascript';
import { parseFile } from '../stages/parser';

describe('Stage 2 — File Parser', () => {
  const tempDir = path.join(__dirname, 'temp_parser');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects language correctly from extension', () => {
    const testFile = path.join(tempDir, 'test.ts');
    fs.writeFileSync(testFile, 'export function test() {}');
    const parsed = parseFile(testFile);
    expect(parsed).not.toBeNull();
    expect(parsed?.lang).toBe('js'); // since JavascriptParser registers .ts with lang 'js'
  });

  it('extracts a regular function', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, 'function regularFunc() {}');
    const parsed = parseFile(testFile);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({
      name: 'regularFunc',
      type: 'function'
    }));
  });

  it('extracts an async function', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, 'async function asyncFunc() {}');
    const parsed = parseFile(testFile);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({
      name: 'asyncFunc',
      type: 'function'
    }));
  });

  it('extracts an arrow function', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, 'const arrowFunc = (a) => {};');
    const parsed = parseFile(testFile);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({
      name: 'arrowFunc',
      type: 'function'
    }));
  });

  it('extracts a class', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, 'class UserClass {}');
    const parsed = parseFile(testFile);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({
      name: 'UserClass',
      type: 'class'
    }));
  });

  it('extracts a React component (PascalCase)', () => {
    const testFile = path.join(tempDir, 'test.jsx');
    fs.writeFileSync(testFile, 'const MyComponent = () => {};');
    const parsed = parseFile(testFile);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({
      name: 'MyComponent',
      type: 'component'
    }));
  });

  it('extracts a React hook (useXxx)', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, 'const useAuth = () => {};');
    const parsed = parseFile(testFile);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({
      name: 'useAuth',
      type: 'hook'
    }));
  });

  it('extracts a TypeScript interface', () => {
    const testFile = path.join(tempDir, 'test.ts');
    fs.writeFileSync(testFile, 'interface UserInfo { name: string; }');
    const parsed = parseFile(testFile);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({
      name: 'UserInfo',
      type: 'interface'
    }));
  });

  it('extracts named imports', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, "import { getUser, createUser } from './userService';");
    const parsed = parseFile(testFile);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: './userService',
      names: ['getUser', 'createUser']
    }));
  });

  it('extracts default imports', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, "import React from 'react';");
    const parsed = parseFile(testFile);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'react',
      names: ['React']
    }));
  });

  it('marks local imports as isLocal: true', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, "import { localFunc } from './localFile';");
    const parsed = parseFile(testFile);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: './localFile',
      isLocal: true
    }));
  });

  it('marks external imports as isLocal: false', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, "import express from 'express';");
    const parsed = parseFile(testFile);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'express',
      isLocal: false
    }));
  });

  it('does NOT extract from comment lines', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, `// function commentedFunc() {}
// import { commentImport } from './comment';
function activeFunc() {}`);
    const parsed = parseFile(testFile);
    const entityNames = parsed?.entities.map(e => e.name) || [];
    const importSources = parsed?.imports.map(i => i.source) || [];

    expect(entityNames).not.toContain('commentedFunc');
    expect(entityNames).toContain('activeFunc');
    expect(importSources).not.toContain('./comment');
  });

  it('returns null for unsupported file type', () => {
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'hello world');
    const parsed = parseFile(testFile);
    expect(parsed).toBeNull();
  });
});
