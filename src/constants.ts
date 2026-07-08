// src/constants.ts
// Global constants used across all stages

export const VERSION = '1.0.0';

export const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build',
  '.next', '__pycache__', 'vendor', 'venv',
  'target', 'out', 'coverage', '.cache'
]);

export const SUPPORTED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.cs', '.rb',
  '.php', '.swift', '.kt', '.vue', '.svelte'
]);

export const MAX_FILE_SIZE = 300_000; 

export const MAX_BFS_DEPTH = 10;     

export const COMPLEXITY_THRESHOLDS = {
  low: 3,     // 0-3 branches  → low complexity
  medium: 8,  // 4-8 branches  → medium complexity
  high: Infinity      // 9+            → high complexity
};