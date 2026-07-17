# Stage 1 — Collector

> **File**: `src/stages/collector.ts`  
> **Exports**: `collectFiles(dir: string): string[]`

---

## What It Does

The collector is the very first thing that runs. Its job is simple: **walk a directory tree and return a flat list of file paths** that the rest of the pipeline should process.

It does **not** read file contents — it only looks at names, extensions, and file sizes.

---

## How It Works

### 1. Recursive directory walk

`collectFiles` calls an internal `walk()` helper which:

1. Reads the entries of the current directory with `fs.readdirSync`.
2. For each entry:
   - If it's a **directory**, check it against `IGNORE_DIRS`. If not ignored, recurse into it.
   - If it's a **file**, check its extension against `SUPPORTED_EXTS` and its size against `MAX_FILE_SIZE`.

```ts
if (stat.isDirectory()) {
  if (!IGNORE_DIRS.has(entry)) walk(fullPath);
  continue;
}

const ext = path.extname(entry);
if (SUPPORTED_EXTS.has(ext) && stat.size < MAX_FILE_SIZE) {
  results.push(fullPath);
}
```

### 2. Ignored directories

Defined in `src/constants.ts`:

```ts
export const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build',
  '.next', '__pycache__', 'vendor', 'venv',
  'target', 'out', 'coverage', '.cache'
]);
```

These are skipped entirely — the walker never descends into them.

### 3. Supported extensions

Also from constants:

```ts
export const SUPPORTED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.cs', '.rb',
  '.php', '.swift', '.kt', '.vue', '.svelte'
]);
```

> **Note**: Collecting a file with `.java` doesn't mean it will be *parsed* successfully. The collector just gathers eligible paths. If no language parser is registered for that extension, the parser stage silently drops it.

### 4. Size guard

```ts
export const MAX_FILE_SIZE = 300_000; // 300 KB
```

Files over 300 KB are skipped. This prevents the scanner from choking on minified bundles, lock files accidentally using a supported extension, or generated code.

---

## Error Handling

The collector is fault-tolerant at the entry level:
- If a directory can't be read (permissions, broken symlink), it logs a warning and continues.
- If `fs.statSync` fails on an entry, it skips that entry and continues.

It **never throws** — it always returns whatever it managed to collect.

---

## Output

A flat `string[]` of absolute file paths, for example:

```
[
  "/project/src/main.ts",
  "/project/src/utils/auth.ts",
  "/project/src/routes/users.ts"
]
```

---

## Configuration Quick Reference

| Constant | Default | Description |
|---|---|---|
| `IGNORE_DIRS` | See above | Directory names to skip entirely |
| `SUPPORTED_EXTS` | See above | File extensions that are eligible |
| `MAX_FILE_SIZE` | `300_000` (300 KB) | Maximum file size in bytes |

All constants live in [`src/constants.ts`](../src/constants.ts).
