import { RawEntity, RawImport } from '../types';

/**
 * Interface that must be implemented by parser engines for individual programming languages.
 * Provides extraction routines for parsing code constructs, imports, and exports from files.
 */
export interface LanguageParser {
  /** The unique identifier string for the language (e.g. "js"). */
  lang: string;
  /** File extensions matched by this parser (e.g. `[".js", ".ts"]`). */
  extensions: string[];
  /**
   * Extracts raw code entities (functions, classes, routes) from clean file source code.
   * @param code The clean source code of the file (with single-line comments stripped).
   * @param filePath The file path of the source file.
   * @returns An array of raw extracted code entities.
   */
  extractEntities: (code: string, filePath: string) => RawEntity[];
  /**
   * Extracts raw imports from clean file source code.
   * @param code The clean source code of the file.
   * @returns An array of raw extracted import relations.
   */
  extractImports:  (code: string) => RawImport[];
  /**
   * Extracts names of exported entities from clean file source code.
   * @param code The clean source code of the file.
   * @returns An array of exported entity identifier names.
   */
  extractExports:  (code: string) => string[];
}

/**
 * The internal registry store containing all registered language parser modules.
 */
const parsers: LanguageParser[] = [];

/**
 * Registers a language parser into the global registry.
 * @param parser The language parser implementation to register.
 */
export function registerParser(parser: LanguageParser): void {
  parsers.push(parser);
}

/**
 * Retrieves a matching language parser based on the file extension.
 * @param ext The lowercase file extension including the leading dot (e.g. ".ts").
 * @returns The matching parser implementation, or null if no parser is registered for that extension.
 */
export function getLanguageParser(ext: string): LanguageParser | null {
  return parsers.find(p => p.extensions.includes(ext)) ?? null;
}