import { LanguageParser, registerParser } from '../registry';
import { dartEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';
export * from './graphify';

// ─── register LanguageParser ────────────────────────────

export const DartParser: LanguageParser = {
  lang: 'dart',
  extensions: ['.dart'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: dartEntityPatterns,
};

registerParser(DartParser);
