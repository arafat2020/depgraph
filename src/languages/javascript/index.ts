import { LanguageParser, registerParser } from '../registry';
import { jsEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

/**
 * The language parser implementation for JavaScript and TypeScript source files.
 */
export const JavaScriptParser: LanguageParser = {
  lang: 'js',
  extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: jsEntityPatterns,
};

registerParser(JavaScriptParser);
