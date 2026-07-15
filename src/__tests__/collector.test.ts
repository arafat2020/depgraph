import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { collectFiles } from '../stages/collector';

describe('Stage 1 — File Collector', () => {
  const tempDir = path.join(__dirname, 'temp_collector');

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

  it('finds files in a directory recursively', () => {
    fs.mkdirSync(path.join(tempDir, 'sub1'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'file1.js'), 'console.log(1)');
    fs.writeFileSync(path.join(tempDir, 'sub1', 'file2.ts'), 'const a = 2;');

    const files = collectFiles(tempDir).map(f => path.basename(f)).sort();
    expect(files).toEqual(['file1.js', 'file2.ts']);
  });

  it('skips node_modules folder', () => {
    fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'file.js'), 'console.log(1)');
    fs.writeFileSync(path.join(tempDir, 'file1.js'), 'console.log(1)');

    const files = collectFiles(tempDir).map(f => path.basename(f));
    expect(files).toEqual(['file1.js']);
  });

  it('skips dist folder', () => {
    fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'dist', 'file.js'), 'console.log(1)');
    fs.writeFileSync(path.join(tempDir, 'file1.js'), 'console.log(1)');

    const files = collectFiles(tempDir).map(f => path.basename(f));
    expect(files).toEqual(['file1.js']);
  });

  it('skips files over 300KB', () => {
    // 301,000 bytes is > 300,000 (300KB)
    const largeBuffer = Buffer.alloc(301_000, 'a');
    fs.writeFileSync(path.join(tempDir, 'large.js'), largeBuffer);
    fs.writeFileSync(path.join(tempDir, 'small.js'), 'console.log(1)');

    const files = collectFiles(tempDir).map(f => path.basename(f));
    expect(files).toEqual(['small.js']);
  });

  it('only returns supported extensions', () => {
    fs.writeFileSync(path.join(tempDir, 'file.js'), 'console.log(1)');
    fs.writeFileSync(path.join(tempDir, 'file.ts'), 'console.log(1)');
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'hello world');
    fs.writeFileSync(path.join(tempDir, 'file.png'), 'binary');

    const files = collectFiles(tempDir).map(f => path.basename(f)).sort();
    expect(files).toEqual(['file.js', 'file.ts']);
  });

  it('returns empty array for empty directory', () => {
    const files = collectFiles(tempDir);
    expect(files).toEqual([]);
  });

  it("handles directory that doesn't exist gracefully", () => {
    const nonExistent = path.join(tempDir, 'does_not_exist');
    const files = collectFiles(nonExistent);
    expect(files).toEqual([]);
  });
});
