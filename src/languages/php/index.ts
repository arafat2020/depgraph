import { LanguageParser, registerParser } from '../registry';
import { phpEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

export const PhpParser: LanguageParser = {
  lang: 'php',
  extensions: ['.php', '.phtml', '.php3', '.php4', '.php5', '.php7'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: phpEntityPatterns,
};

registerParser(PhpParser);
