import { LanguageParser, registerParser } from '../registry';
import { csharpEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

/**
 * The language parser implementation for C# (.cs) source files.
 */
export const CSharpParser: LanguageParser = {
  lang: 'cs',
  extensions: ['.cs'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: csharpEntityPatterns,
};

registerParser(CSharpParser);
