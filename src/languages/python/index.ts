import { LanguageParser, registerParser } from '../registry';
import { pyEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './extractor';

// ─── register LanguageParser ─────────────────────────────

export const PythonParser: LanguageParser = {
  lang: 'py',
  extensions: ['.py'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: pyEntityPatterns,
};

registerParser(PythonParser);
