import fs from 'fs';
import path from 'path';
import { ParsedFile, RawEntity, RawImport } from '../types';
import { getLanguageParser } from '../languages/registry';

/**
 * Parses an individual source file to extract its metadata, imports, exports, and internal code entities.
 * Dynamically resolves the language parser, strips single-line comments from code before parsing, and computes line counts.
 * 
 * @param filePath The absolute or relative path to the file to parse.
 * @returns A ParsedFile object if successful, or null if the file cannot be read or no parser matches the extension.
 */
export function parseFile(filePath: string): ParsedFile | null {
  let code: string;
  try {
    code = fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.warn(`⚠ Cannot read file: ${filePath}`);
    return null;
  }

  const ext = path.extname(filePath).toLowerCase();
  const parser = getLanguageParser(ext);
  if (!parser) return null;

  // ← ADD THIS: strip single-line comments before parsing
  const cleanCode = code
    .split('\n')
    .map(line => {
      const commentIndex = line.indexOf('//');
      if (commentIndex === -1) return line;
      // make sure // is not inside a string
      const before = line.slice(0, commentIndex);
      const inString = (before.match(/"/g) || []).length % 2 !== 0
                    || (before.match(/'/g) || []).length % 2 !== 0;
      return inString ? line : line.slice(0, commentIndex);
    })
    .join('\n');

  const lines    = code.split('\n').length;
  const entities = parser.extractEntities(cleanCode, filePath);
  const imports  = parser.extractImports(cleanCode);
  const exports  = parser.extractExports(cleanCode);

  return { filePath, lang: parser.lang, lines, entities, imports, exports };
}

/**
 * Iteratively parses an array of file paths.
 * Skips files that cannot be parsed (e.g. unsupported extensions, unreadable files).
 * 
 * @param filePaths An array of file paths to process.
 * @returns An array of successfully parsed files.
 */
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