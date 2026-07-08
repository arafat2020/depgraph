import fs from 'fs';
import path from 'path';
import { ParsedFile, RawEntity, RawImport } from '../types';
import { getLanguageParser } from '../languages/registry';

export function parseFile(filePath: string): ParsedFile | null {
  // 1. read the file
  let code: string;
  try {
    code = fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.warn(`⚠ Cannot read file: ${filePath}`);
    return null;
  }

  // 2. detect language from extension
  const ext = path.extname(filePath).toLowerCase();
  const parser = getLanguageParser(ext);
  if (!parser) return null;

  // 3. run extractors
  const lines = code.split('\n').length;
  const entities = parser.extractEntities(code, filePath);
  const imports  = parser.extractImports(code);
  const exports  = parser.extractExports(code);

  return {
    filePath,
    lang: parser.lang,
    lines,
    entities,
    imports,
    exports,
  };
}

export function parseFiles(filePaths: string[]): ParsedFile[] {
  const results: ParsedFile[] = [];

  for (const filePath of filePaths) {
    const parsed = parseFile(filePath);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}