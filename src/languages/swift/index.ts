import { LanguageParser, registerParser } from '../registry';
import { swiftEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

export const SwiftParser: LanguageParser = {
  lang: 'swift',
  extensions: ['.swift'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: swiftEntityPatterns,
};

registerParser(SwiftParser);
