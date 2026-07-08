import fs from 'fs';
import path from 'path';
import { IGNORE_DIRS, SUPPORTED_EXTS, MAX_FILE_SIZE } from '../constants';

export function collectFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    // 1. what's inside this folder?
    let entries: string[];
    try {
      entries = fs.readdirSync(currentDir);
    } catch (err) {
      console.warn(` >> ====== > Cannot read directory: ${currentDir}`);
      return;
    }

    // 2. look at each item inside
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        console.warn(` >> ====== > Cannot stat: ${fullPath}`);
        continue;
      }

      // 3. if it's a folder — go deeper (unless ignored)
      if (stat.isDirectory()) {
        if (!IGNORE_DIRS.has(entry)) {
          walk(fullPath);
        }
        continue;
      }

      // 4. if it's a file — check extension and size
      const ext = path.extname(entry);
      if (SUPPORTED_EXTS.has(ext) && stat.size < MAX_FILE_SIZE) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}