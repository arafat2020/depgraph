import { LanguageParser, registerParser } from '../registry';
import { rustEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';
export * from './graphify';

// ─── register LanguageParser ────────────────────────────

export const RustParser: LanguageParser = {
  lang: 'rust',
  extensions: ['.rs'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: rustEntityPatterns,
};

registerParser(RustParser);
