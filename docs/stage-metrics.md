# Stage 4 — Metrics

> **File**: `src/stages/metrics.ts`  
> **Exports**: `computeMetrics`, `getEntryPoints`, `getLeafNodes`, `getIsolatedNodes`, `getCriticalNodes`

---

## What It Does

The metrics stage takes the raw graph from the builder and **enriches each node** with three numeric properties: `inDegree`, `outDegree`, and `centralityScore`. It also provides four helper functions for categorising nodes.

This stage **mutates** the nodes inside the graph in place and returns the same `DepGraph` object.

---

## `computeMetrics(graph: DepGraph): DepGraph`

### Step 1 — Count in-degree and out-degree

The function iterates over every edge and increments counters on the two endpoint nodes:

```ts
for (const edge of graph.edges) {
  const fromNode = graph.nodes.get(edge.from);
  const toNode   = graph.nodes.get(edge.to);

  if (fromNode) fromNode.outDegree += 1;  // this node imports something
  if (toNode)   toNode.inDegree   += 1;   // this node is imported by something
}
```

| Property | Meaning |
|---|---|
| `inDegree` | Number of other nodes that import **this** node |
| `outDegree` | Number of nodes **this** node imports |

### Step 2 — Compute centrality score

```ts
node.centralityScore = node.inDegree * 2 + node.outDegree;
```

The formula weights **inDegree** more heavily (×2) because being imported by many things is riskier than importing many things. A node with a high inDegree is a "load-bearing" piece of code — changing it breaks many consumers.

---

## Node Categorisation Helpers

These four helper functions are used by both the **Output** stage and the **main** entry point to produce the summary section of the report.

### `getEntryPoints(graph)`

```ts
n.inDegree === 0 && n.outDegree > 0
```

**Nothing imports this node, but it imports others.**  
These are application roots: `main.ts`, route files, top-level scripts. They start the dependency chain.

### `getLeafNodes(graph)`

```ts
n.outDegree === 0 && n.inDegree > 0
```

**This node imports nothing, but others import it.**  
These are pure utilities and helpers: `hashPassword`, `formatDate`, shared constants. They're at the bottom of the dependency chain.

### `getIsolatedNodes(graph)`

```ts
n.inDegree === 0 && n.outDegree === 0
```

**This node has no connections at all.**  
These are dead code candidates — entities defined but never imported or used by any other tracked entity in the project.

### `getCriticalNodes(graph)`

```ts
n.centralityScore > 20
```

**Nodes with a centrality score above 20.**  
These are architectural hotspots. Modifying them carries high risk of unintended side-effects across the codebase. The impact simulator (see [stage-impact.md](./stage-impact.md)) was designed specifically for these.

---

## Understanding the Score Threshold

The threshold of `20` for critical nodes translates roughly to:
- A node imported by 10 other nodes (`10 * 2 = 20`), or
- A node imported by 7 nodes and importing 6 others (`7*2 + 6 = 20`)

Adjust `getCriticalNodes` if your project has a different risk tolerance.

---

## Example — Annotated Node After This Stage

```json
{
  "id": "getUserById__userService",
  "name": "getUserById",
  "type": "function",
  "inDegree": 8,
  "outDegree": 2,
  "centralityScore": 18,
  "connections": ["usersRouter__routes", "adminRouter__routes", "..."]
}
```

This node is imported by 8 other nodes and imports 2. Its centrality score is 18 — just under the critical threshold.
