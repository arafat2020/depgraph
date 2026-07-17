# DepGraph — Developer Documentation

Welcome to the internal documentation for **DepGraph Core**.

This folder explains how every moving part of the compiler works so you can contribute confidently, extend it with new languages, or debug an unexpected result.

---

## Contents

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Big-picture overview — how the pipeline fits together |
| [stage-collector.md](./stage-collector.md) | Stage 1 — File collection (scanning the project directory) |
| [stage-parser.md](./stage-parser.md) | Stage 2 — Source file parsing (entities, imports, exports) |
| [stage-graph.md](./stage-graph.md) | Stage 3 — Dependency graph construction |
| [stage-metrics.md](./stage-metrics.md) | Stage 4 — Metrics computation (centrality, degrees) |
| [stage-impact.md](./stage-impact.md) | Stage 5 — Impact simulation (BFS + risk scoring) |
| [stage-output.md](./stage-output.md) | Stage 6 — JSON report generation |
| [language-registry.md](./language-registry.md) | The language plugin system — how to add a new language |
| [data-types.md](./data-types.md) | All shared TypeScript interfaces, explained |

---

## Quick Mental Model

```
 Your project folder
       │
       ▼
 ┌─────────────┐
 │  Collector  │  ← finds every eligible source file
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │   Parser    │  ← reads each file; extracts entities, imports, exports
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │    Graph    │  ← links entities together through their imports
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │   Metrics   │  ← computes in/out-degree and centrality for every node
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │   Impact    │  ← (optional) BFS from a target node → risk report
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │   Output    │  ← serialises everything to depgraph-output.json
 └─────────────┘
```

Each stage is self-contained. Data flows **forward only** — no stage reaches back to an earlier one.
