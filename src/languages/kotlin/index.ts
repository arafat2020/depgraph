import { LanguageParser, registerParser } from '../registry';
import { kotlinEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

export const KotlinParser: LanguageParser = {
  lang: 'kotlin',
  extensions: ['.kt', '.kts'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: kotlinEntityPatterns,
};

registerParser(KotlinParser);
