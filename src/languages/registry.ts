import { RawEntity, RawImport } from '../types';

// the interface every language parser must implement
export interface LanguageParser {
  lang: string;
  extensions: string[];
  extractEntities: (code: string, filePath: string) => RawEntity[];
  extractImports:  (code: string) => RawImport[];
  extractExports:  (code: string) => string[];
}

// registry — all parsers register here
const parsers: LanguageParser[] = [];

export function registerParser(parser: LanguageParser): void {
  parsers.push(parser);
}

export function getLanguageParser(ext: string): LanguageParser | null {
  return parsers.find(p => p.extensions.includes(ext)) ?? null;
}