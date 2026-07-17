# Stage 2 — Parser

> **File**: `src/stages/parser.ts`  
> **Exports**: `parseFile(filePath: string): ParsedFile | null`, `parseFiles(filePaths: string[]): ParsedFile[]`

---

## What It Does

The parser takes each file path from the collector and:

1. Reads the raw source code from disk.
2. Looks up the correct **language parser** from the registry based on the file extension.
3. Strips single-line `//` comments from the code before analysis.
4. Calls the language parser to extract **entities**, **imports**, and **exports**.
5. Returns a structured `ParsedFile` object.

---

## The `parseFile` Function — Step by Step

### Step 1: Read the file

```ts
const code = fs.readFileSync(filePath, 'utf-8');
```

If the file can't be read, it logs a warning and returns `null`.

### Step 2: Resolve the language parser

```ts
const ext = path.extname(filePath).toLowerCase();
const parser = getLanguageParser(ext);
if (!parser) return null;
```

`getLanguageParser` queries the language registry (see [language-registry.md](./language-registry.md)). If no parser is registered for the extension, the file is silently skipped.

### Step 3: Strip single-line comments

```ts
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
```

This is done before passing code to any parser to prevent `//` inside comments from confusing regex patterns. The string-detection guard prevents false positives on lines like:

```ts
const url = "https://example.com"; // this would break without the guard
```

> **Limitation**: The guard only checks for unbalanced `"` or `'` quotes on the *same line*. Multi-line strings or template literals are not fully handled.

### Step 4: Extract data via the language parser

```ts
const lines    = code.split('\n').length;       // count from original code
const entities = parser.extractEntities(cleanCode, filePath);
const imports  = parser.extractImports(cleanCode);
const exports  = parser.extractExports(cleanCode);
```

Note that line counting uses the **original** code (before stripping) to get accurate line numbers. Extraction uses the **clean** code.

### Step 5: Return the result

```ts
return { filePath, lang: parser.lang, lines, entities, imports, exports };
```

---

## The `parseFiles` Function

A simple iterator over `parseFile`. Files that return `null` are silently dropped:

```ts
for (const filePath of filePaths) {
  const parsed = parseFile(filePath);
  if (parsed) results.push(parsed);
}
```

---

## Output Shape — `ParsedFile`

```ts
interface ParsedFile {
  filePath: string;   // e.g. "/project/src/auth.ts"
  lang: string;       // e.g. "js" — from the parser's lang field
  lines: number;      // total line count
  entities: RawEntity[];
  imports:  RawImport[];
  exports:  string[];
}
```

See [data-types.md](./data-types.md) for the full definitions of `RawEntity` and `RawImport`.

---

## What "entities" means

An entity is any named code construct the parser can recognise:

- Functions, async functions, arrow functions
- Classes, interfaces, types (TypeScript)
- React components and hooks
- Express/Fastify API route declarations
- Python classes and `def` functions

Every entity has a `name`, `type`, `line`, and `complexity` rating.

---

## Complexity Estimation

Each language parser estimates complexity by counting branching keywords in the entity's body:

| Branch count | Rating |
|---|---|
| 0–3 | `"low"` |
| 4–8 | `"medium"` |
| 9+  | `"high"` |

Thresholds are set in `COMPLEXITY_THRESHOLDS` in [`src/constants.ts`](../src/constants.ts).

---

## Adding Support for a New Language

You don't touch the parser stage at all. Instead, register a new language parser — see [language-registry.md](./language-registry.md).
