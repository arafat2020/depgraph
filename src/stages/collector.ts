import fs from 'fs';
import path from 'path';
import { IGNORE_DIRS, SUPPORTED_EXTS, MAX_FILE_SIZE } from '../constants';

/**
 * Recursively scans a target directory and gathers paths of all files that match
 * supported extensions and fit within maximum file size limitations.
 * Automatically ignores specified directories (e.g. node_modules, .git, etc.).
 * 
 * @param dir The root directory path to start scanning from.
 * @returns An array of absolute or relative file paths matching scanner criteria.
 */
export function collectFiles(dir: string): string[] {
  const results: string[] = [];

  /**
   * Helper function to recursively walk through directory entries.
   * @param currentDir The current directory path to traverse.
   */
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