# Stage 6 — Output

> **File**: `src/stages/output.ts`  
> **Exports**: `writeOutput(graph, parsed, outputPath, impact?): void`

---

## What It Does

The output stage is the final step in the pipeline. It takes the fully-enriched graph, the parsed file list, and the optional impact report, **serialises everything into a structured JSON document**, and writes it to disk.

---

## The Four-Step Write Process

### Step 1 — Compute the summary

```ts
const summary = {
  totalNodes:    graph.nodes.size,
  totalEdges:    graph.edges.length,
  entryPoints:   getEntryPoints(graph),
  leafNodes:     getLeafNodes(graph),
  isolatedNodes: getIsolatedNodes(graph),
  criticalNodes: getCriticalNodes(graph),
};
```

This calls the four categorisation helpers from the metrics stage (see [stage-metrics.md](./stage-metrics.md)) to produce the summary section.

### Step 2 — Assemble the full output object

```ts
const output: OutputJSON = {
  meta: {
    version:    '1.0.0',
    timestamp:  new Date().toISOString(),
    totalFiles: parsed.length,
    totalLines: totalLines,
  },
  summary,
  nodes:  [...graph.nodes.values()],   // Map → Array
  edges:  graph.edges,
  files:  parsed,
  impact,                              // undefined if --impact was not used
};
```

The `nodes` Map is converted to an Array here so it serialises correctly as JSON.

### Step 3 — Write to disk

```ts
fs.writeFileSync(
  outputPath,
  JSON.stringify(output, null, 2),  // pretty-printed, 2-space indent
  'utf-8'
);
```

If the output directory does not exist, it is created recursively:

```ts
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
```

### Step 4 — Print confirmation

After a successful write, a summary is printed to stdout:

```
✅ Output written to ./depgraph-output.json
   12 files
   87 nodes
   143 edges
   3240 total lines of code
```

If an impact report was included:

```
💥 Impact Report included
   Target     : getUserById__userService
   Risk Level : HIGH
   Risk Score : 62
   Affected   : 9 nodes
```

---

## Output File Schema — `OutputJSON`

```ts
interface OutputJSON {
  meta: {
    version:    string;   // tool version, e.g. "1.0.0"
    timestamp:  string;   // ISO 8601 datetime
    totalFiles: number;
    totalLines: number;
  };
  summary: {
    totalNodes:    number;
    totalEdges:    number;
    entryPoints:   string[];  // node IDs
    leafNodes:     string[];  // node IDs
    isolatedNodes: string[];  // node IDs (dead code candidates)
    criticalNodes: string[];  // node IDs (centrality > 20)
  };
  nodes:  DepNode[];
  edges:  DepEdge[];
  files:  ParsedFile[];
  impact?: ImpactReport;    // only present if --impact was used
}
```

See [data-types.md](./data-types.md) for the full definitions of each nested type.

---

## Default Output Path

```
./depgraph-output.json
```

Override with `--output <path>`:

```bash
node depgraph.js ./src --output ./reports/my-graph.json
```

---

## Using the Output File

The JSON output is designed to be consumed by:

- **Visualisation tools** — feed `nodes` and `edges` into a graph renderer (e.g. D3, Cytoscape, Sigma.js)
- **CI checks** — inspect `summary.criticalNodes` or `impact.riskLevel` in a script
- **IDE plugins** — parse `files` to annotate code with entity metadata
- **AI tools** — pass the graph as context for code review or refactoring suggestions
