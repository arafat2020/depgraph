import { LanguageParser, registerParser } from '../registry';
import { javaEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

export const JavaParser: LanguageParser = {
  lang: 'java',
  extensions: ['.java'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: javaEntityPatterns,
};

registerParser(JavaParser);
