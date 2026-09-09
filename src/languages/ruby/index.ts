import { LanguageParser, registerParser } from '../registry';
import { rubyEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

export const RubyParser: LanguageParser = {
  lang: 'ruby',
  extensions: ['.rb', '.rake', '.gemspec'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: rubyEntityPatterns,
};

registerParser(RubyParser);
