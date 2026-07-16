// src/constants.ts
// Global constants used across all stages

/**
 * The current version of the DepGraph tool.
 */
export const VERSION = '1.0.0';

/**
 * Set of directory names that should be ignored during file collection.
 * Includes typical dependency folders, build directories, caches, and environment directories.
 */
export const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build',
  '.next', '__pycache__', 'vendor', 'venv',
  'target', 'out', 'coverage', '.cache'
]);

/**
 * Set of file extensions supported by the parsing system.
 * While the registry may only have parser configurations for a subset of these (e.g. JS/TS),
 * these represent the total scope of file formats the scanner can collect.
 */
export const SUPPORTED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.cs', '.rb',
  '.php', '.swift', '.kt', '.vue', '.svelte'
]);

/**
 * The maximum file size (in bytes) that the collector will read.
 * Prevents performance degradation when scanning large minified bundles or assets.
 * Defaults to 300 KB.
 */
export const MAX_FILE_SIZE = 300_000; 

/**
 * The maximum depth for Breadth-First Search (BFS) during impact simulation.
 * Prevents infinite loops/unreasonable compute times in highly circular dependency graphs.
 */
export const MAX_BFS_DEPTH = 10;     

/**
 * Threshold values (branch counts) used to categorize function or component complexity.
 */
export const COMPLEXITY_THRESHOLDS = {
  /** Complexity score is "low" if there are 3 or fewer branch points. */
  low: 3,
  /** Complexity score is "medium" if there are between 4 and 8 branch points. */
  medium: 8,
  /** Complexity score is "high" if there are 9 or more branch points. */
  high: Infinity
};