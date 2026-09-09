# Language Parser Conventions

> **Standardized architecture, directory conventions, and coding guidelines for DepGraph language parsers.**

---

## Overview

DepGraph relies on language plugins to extract code entities, imports, and exports from source files across various languages without heavy AST dependencies. As support for languages grows in sophistication—especially when incorporating deep graph extractors (e.g. Graphify engines) or rich syntax parsing—parsers must adhere to clear structural conventions to remain readable, maintainable, and testable.

---

## The Two-Tier Architecture

To balance simplicity for straightforward languages and scalability for feature-rich languages, DepGraph uses a two-tier organization model:

| Tier | Format | When to Use | Typical File Count | Target Size |
|---|---|---|---|---|
| **Tier 1: Single-File Plugin** | `src/languages/<lang>.ts` | Simple languages or basic regex extractors | 1 file | < 300 lines |
| **Tier 2: Modular Directory Module** | `src/languages/<lang>/` | Complex languages, >300 lines, or dual-purpose extractors (DepGraph + Graphify) | 4–6 modular files | < 250 lines per file |

---

## Tier 1: Single-File Plugin Convention

Used by languages like Python, Go, Java, Kotlin, PHP, Ruby, Swift, C#, and JavaScript.

### Structure

A single file: `src/languages/<lang>.ts`

```
src/languages/
├── go.ts
├── python.ts
└── java.ts
```

### Standard Section Order

Every single-file parser must organize code into well-demarcated sections in the following order:

```ts
// 1. Imports & External Types
import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// 2. Helpers & Complexity Estimation
function estimateComplexity(code: string, name: string): string { ... }

// 3. Entity Patterns (Exported for gitdiff reuse)
export const langEntityPatterns: EntityPattern[] = [ ... ];

// 4. Entity Extractor
function extractEntities(code: string, filePath: string): RawEntity[] { ... }

// 5. Import Extractor
function extractImports(code: string): RawImport[] { ... }

// 6. Export Extractor
function extractExports(code: string): string[] { ... }

// 7. Parser Registration
export const LangParser: LanguageParser = {
  lang: 'lang',
  extensions: ['.ext'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: langEntityPatterns,
};

registerParser(LangParser);
```

---

## Tier 2: Modular Directory Module Convention

Used when a language parser exceeds ~300 lines or integrates secondary engines (such as standalone Graphify graph extractors). Languages using this tier include **Dart** and **Rust**.

### Directory Layout

```
src/languages/<lang>/
├── index.ts          # Public entrypoint, LanguageParser definition, side-effect registration
├── types.ts          # Specialized TypeScript interfaces (e.g., Graphify node/edge definitions)
├── patterns.ts       # EntityPattern definitions, keyword sets, and token constants
├── helpers.ts        # Lexing utilities, comment cleaners, brace depth counters, complexity
├── extractor.ts      # Core DepGraph contract: extractEntities, extractImports, extractExports
└── graphify.ts       # Standalone deep AST/regex graph extraction engine (if applicable)
```

### File Responsibilities & Contract

#### 1. `index.ts` (Entry Point & Barrel)
- Constructs the `LanguageParser` object.
- Invokes `registerParser(...)` at module evaluation time.
- Re-exports public helpers and secondary functions (e.g., `cleanDartComments`, `estimateComplexity`, `extractDart`) to ensure seamless backward compatibility.
- Transparently resolves `import './languages/dart'` without altering caller syntax.

```ts
import { LanguageParser, registerParser } from '../registry';
import { langEntityPatterns } from './patterns';
import { extractEntities, extractImports, extractExports } from './extractor';

export * from './types';
export * from './patterns';
export * from './helpers';
export * from './graphify';

export const LangParser: LanguageParser = {
  lang: 'lang',
  extensions: ['.ext'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: langEntityPatterns,
};

registerParser(LangParser);
```

#### 2. `types.ts` (Domain Types)
- Houses language-specific data contracts that do not belong in global `src/types.ts`.
- Example: Graphify node representations, edge payloads, and extractor result contracts (`DartGraphNode`, `DartGraphEdge`, `DartGraphResult`).

#### 3. `patterns.ts` (Regex & Token Sets)
- Contains `EntityPattern[]` regex rules with named or indexed capture groups (Group 1 must always be the entity name).
- Houses language keywords and primitive type sets (e.g., `DART_KEYWORDS`, `RUST_PRIMITIVES`).

#### 4. `helpers.ts` (Lexical & Analysis Utilities)
- String manipulations, string literal escaping (`escapeRegex`).
- Comment cleaning functions that preserve line counts (`clean<Lang>Comments`).
- Balanced bracket/brace scanners (`_findMatchingBrace`, `_splitBalanced`).
- Cyclomatic complexity estimation (`estimateComplexity`).

#### 5. `extractor.ts` (DepGraph Stage 2 Implementation)
- Implements the 3 required methods of `LanguageParser`:
  - `extractEntities(code: string, filePath: string): RawEntity[]`
  - `extractImports(code: string): RawImport[]`
  - `extractExports(code: string): string[]`
- Operates strictly on pre-cleaned code (single-line comments already stripped by the stage caller).

#### 6. `graphify.ts` (Deep Graph Engine)
- Isolated from core stage pipeline execution.
- Contains the self-contained graph extraction function (`extractDart`, `extractRust`).
- Allows comprehensive standalone graph analysis without bloating the pipeline parsing logic.

---

## Core Implementation Rules

Every parser, whether Tier 1 or Tier 2, must respect the following rules:

### 1. Zero Heavy AST Dependencies
DepGraph is intentionally designed to be lightweight, ultrafast, and dependency-free.
- **Do not** introduce heavy AST parsers (such as Babel, tree-sitter, or Roslyn).
- Rely on regular expressions, state machines, and balanced delimiter traversal.

### 2. Preserve Line Number Offsets During Comment Cleaning
When stripping comments or preprocessing files:
- Replace stripped blocks with the identical number of `\n` newline characters they spanned.
- This guarantees that entity line numbers reported in `RawEntity.line` accurately match original file source lines.

### 3. Regex State Hygiene
Global regular expressions (`/pattern/g`) retain state in `regex.lastIndex`.
- Reset `regex.lastIndex = 0` prior to any `exec` loop or instantiate regular expressions within the function scope.
- Never let `lastIndex` leak across calls.

### 4. Group 1 Entity Identifier Contract
Any pattern in `entityPatterns` must capture the entity identifier name in **Group 1**:
```ts
{
  regex: /^[ \t]*fn\s+([a-z_]\w*)/gm,
  type: 'function',
}
```
This enables `src/stages/gitdiff.ts` to deduce modified entity names directly from git hunk headers.

### 5. Local vs. External Import Flagging
- Mark `isLocal: true` only for relative or internal project paths (e.g., `./utils`, `../services`).
- Mark `isLocal: false` for standard library packages or third-party package dependencies (e.g., `fmt`, `dart:async`, `std::collections`).
- Only local imports become edges in DepGraph's dependency graph.

---

## When to Migrate from Tier 1 to Tier 2

Migrate a language parser from `src/languages/<lang>.ts` to `src/languages/<lang>/` when:
1. The single file exceeds **300 lines of code**.
2. The language incorporates custom type systems or deep extractors (e.g., Graphify bindings).
3. The language requires extensive grammar assistance (e.g., custom bracket matching, token splitting, or stateful tokenization).
