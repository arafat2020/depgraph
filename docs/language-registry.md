# Language Registry

> **File**: `src/languages/registry.ts`  
> **Exports**: `LanguageParser` (interface), `registerParser`, `getLanguageParser`

---

## Overview

The language registry is a **simple plugin system**. It solves one problem: the parser stage needs to know *how* to parse a `.py` file differently from a `.ts` file, without hardcoding language logic into the stage itself.

Any file that imports `registerParser` and calls it at module load time becomes a **language plugin**. The parser stage just calls `getLanguageParser(ext)` and gets back the right handler — it doesn't know or care which language it's dealing with.

---

## The `LanguageParser` Interface

This is the contract every language plugin must fulfil:

```ts
export interface LanguageParser {
  /** A short unique identifier for the language, e.g. "js", "py". */
  lang: string;

  /** File extensions this parser handles, e.g. [".js", ".ts", ".tsx"]. */
  extensions: string[];

  /**
   * Extract named code entities (functions, classes, routes, etc.)
   * from clean source code (single-line comments already stripped).
   */
  extractEntities: (code: string, filePath: string) => RawEntity[];

  /**
   * Extract import statements from clean source code.
   */
  extractImports: (code: string) => RawImport[];

  /**
   * Extract the names of exported entities from clean source code.
   */
  extractExports: (code: string) => string[];
}
```

---

## How Registration Works

The registry stores parsers in a private module-level array:

```ts
const parsers: LanguageParser[] = [];

export function registerParser(parser: LanguageParser): void {
  parsers.push(parser);
}

export function getLanguageParser(ext: string): LanguageParser | null {
  return parsers.find(p => p.extensions.includes(ext)) ?? null;
}
```

That's the entire registry — an array and two functions.

### Lookup

`getLanguageParser(".ts")` returns the first registered parser whose `extensions` array includes `".ts"`. If none match, it returns `null` and the file is skipped by the parser stage.

---

## How Plugins Self-Register

Each language file (e.g. `src/languages/javascript.ts`) defines a parser object and calls `registerParser` at the **bottom of the file**, at module scope:

```ts
const JavaScriptParser: LanguageParser = {
  lang: 'js',
  extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'],
  extractEntities,
  extractImports,
  extractExports,
};

registerParser(JavaScriptParser);
```

This code runs **once**, when the module is first imported.

### Triggering registration

Plugins must be imported somewhere in the application for their side-effect (`registerParser(...)`) to run. In `src/main.ts`:

```ts
import './languages/javascript';
import './languages/python';
```

These are **side-effect imports** (no named export is consumed). They exist purely to execute the registration call.

> If you add a new language parser file but forget to import it in `main.ts`, it will never be registered and its extensions will never be recognised.

---

## Currently Registered Languages

| File | `lang` | Extensions |
|---|---|---|
| `javascript.ts` | `js` | `.js` `.jsx` `.mjs` `.cjs` `.ts` `.tsx` |
| `python.ts` | `py` | `.py` |

The following language files exist as stubs (imported but with minimal or no implementation yet):

- `java.ts`
- `csharp.ts`
- `go.ts`
- `kotlin.ts`
- `php.ts`
- `ruby.ts`
- `swift.ts`

---

## How to Add a New Language

Follow these steps to add full support for a new language.

### 1. Create the parser file

Create `src/languages/mylang.ts`:

```ts
import { RawEntity, RawImport } from '../types';
import { LanguageParser, registerParser } from './registry';

function extractEntities(code: string, filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];
  // Use regex or any other technique to find functions, classes, etc.
  // Populate and return the entities array.
  return entities;
}

function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];
  // Parse import/require/use statements.
  // Set isLocal: true for relative imports ('./something').
  return imports;
}

function extractExports(code: string): string[] {
  // Return an array of exported entity names.
  return [];
}

const MyLangParser: LanguageParser = {
  lang: 'mylang',
  extensions: ['.ml', '.mls'],
  extractEntities,
  extractImports,
  extractExports,
};

registerParser(MyLangParser);
```

### 2. Import it in `main.ts`

```ts
import './languages/mylang';
```

Add this **before** the pipeline starts (with the other language imports at the top of the file).

### 3. Ensure the extension is in `SUPPORTED_EXTS`

In `src/constants.ts`, add your extension to the set:

```ts
export const SUPPORTED_EXTS = new Set([
  // ... existing extensions
  '.ml', '.mls',
]);
```

Without this, the collector will never hand files with that extension to the parser in the first place.

### 4. Test it

```bash
node depgraph.js ./path/to/mylang-project --verbose
```

Look for your files appearing in the verbose output and entities showing up in the summary.

---

## Rules for Writing a Good Parser

| Rule | Why |
|---|---|
| Only use `code` (the cleaned version) — never read files | The stage already strips comments and passes clean code |
| Reset `regex.lastIndex = 0` before each `exec` loop | Global regexes maintain state; forgetting this causes skipped matches |
| Guard against duplicates (`entities.some(e => e.name === name)`) | The graph stage skips duplicates, but clean data is better upstream |
| Mark relative imports with `isLocal: true` | Only local imports become graph edges; external packages are ignored |
| Keep extraction logic regex-based or simple string parsing | The project has zero AST dependencies on purpose — keep it that way |
