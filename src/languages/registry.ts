import { RawEntity, RawImport } from '../types';

/**
 * A single entity-matching pattern used by a language parser.
 * Used both internally by extractEntities and externally by gitdiff
 * to match entity names from git diff context lines without duplicating regex.
 */
export interface EntityPattern {
  /** Regular expression to match an entity declaration. Capture group 1 must be the entity name. */
  regex: RegExp;
  /** The entity type label (e.g. 'function', 'class', 'method'). */
  type: string;
}

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
  /**
   * Optional: the raw entity patterns used internally by this parser.
   * When provided, gitdiff.ts will reuse them to match entity names
   * from git diff context lines instead of duplicating regex.
   */
  entityPatterns?: EntityPattern[];
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