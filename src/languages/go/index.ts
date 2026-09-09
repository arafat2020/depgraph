import { LanguageParser, registerParser } from '../registry';
import { goEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

/**
 * The language parser implementation for Go source files.
 */
export const GoParser: LanguageParser = {
  lang: 'go',
  extensions: ['.go'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: goEntityPatterns,
};

registerParser(GoParser);
