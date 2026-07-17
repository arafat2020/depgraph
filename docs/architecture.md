# Architecture Overview

> **File**: `src/main.ts` — the orchestration entry point  
> **Role**: Wires together all six stages in sequential order and handles CLI argument parsing.

---

## The Pipeline at a Glance

DepGraph is a **linear, stage-based compiler**. There is no framework magic — it's a plain chain of function calls where the output of each stage becomes the input of the next.

```
collectFiles()
    │  string[]          (file paths)
    ▼
parseFiles()
    │  ParsedFile[]      (entities, imports, exports per file)
    ▼
buildGraph()
    │  DepGraph          (nodes + edges map)
    ▼
computeMetrics()
    │  DepGraph          (same graph, nodes now have inDegree / outDegree / centralityScore)
    ▼
simulateImpact()         ← only runs when --impact flag is provided
    │  ImpactReport
    ▼
writeOutput()
       depgraph-output.json
```

Every stage lives in its own file under `src/stages/`. They are pure functions — given the same input they always produce the same output, and they never touch the file system except for the collector (reading) and output (writing).

---

## Entry Point — `src/main.ts`

`main.ts` does four things and nothing else:

1. **Parses CLI flags** — `--output`, `--impact`, `--verbose`, `--no-color`, `--help`
2. **Runs the pipeline** inside a single `try/catch` block
3. **Prints progress** to stdout (banner, summary, impact table)
4. **Exits with code 1** on any unhandled error

### Key variables wired at startup

```ts
const projectDir  = args[0];              // the path to scan
const outputPath  = getFlag('--output');  // where to write the JSON
const impactTarget = getFlag('--impact'); // entity name to simulate
```

### Execution order in the `try` block

```ts
const files   = collectFiles(projectDir);   // Stage 1
const parsed  = parseFiles(files);          // Stage 2
const graph   = buildGraph(parsed);         // Stage 3
const metrics = computeMetrics(graph);      // Stage 4
// Stage 5 — optional
const impact  = impactTarget
  ? simulateImpact(metrics, impactTarget, impactDesc)
  : undefined;
writeOutput(metrics, parsed, outputPath, impact); // Stage 6
```

---

## Design Principles

| Principle | How it's applied |
|---|---|
| **Single responsibility** | Each stage file exports exactly one primary function |
| **No hidden state** | All data passed explicitly between stages |
| **Fail loudly** | `process.exit(1)` on unrecoverable errors — no silent swallowing |
| **Zero runtime dependencies** | Only Node.js built-ins (`fs`, `path`) plus TypeScript |
| **Plugin language support** | Languages register themselves via the registry (see [language-registry.md](./language-registry.md)) |

---

## Adding a New Stage

If you need to insert a new processing step (e.g. a linting stage), follow this pattern:

1. Create `src/stages/my-stage.ts` and export a pure function.
2. Import and call it in `main.ts` after the stage it depends on.
3. Thread its output into downstream stages.

No registration, no magic — just a function call.
