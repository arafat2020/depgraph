# Stage 5 — Impact Simulator

> **File**: `src/stages/impact.ts`  
> **Exports**: `simulateImpact(graph, targetName, changeDescription): ImpactReport`  
> **Triggered by**: `--impact <name> <description>` CLI flag

---

## What It Does

The impact simulator answers the question: **"If I change this entity, what else breaks?"**

It performs a **reverse Breadth-First Search (BFS)** starting from the target node, walking *against* the edge direction to find every node that (directly or transitively) depends on the target. It then scores each affected node by impact severity and produces a risk report with testing recommendations.

---

## The Four-Step Algorithm

### Step 1 — Find the target node

```ts
const targetNode = [...graph.nodes.values()]
  .find(n => n.name === targetName);
```

Searches by `name` (not `id`). If the target is not found, an empty report is returned immediately.

### Step 2 — Reverse BFS

A standard BFS, but instead of following edges *forward* (A→B means A depends on B), we follow edges *backward* (find all edges where `edge.to === nodeId`):

```ts
function getDirectDependents(graph, nodeId) {
  return graph.edges
    .filter(e => e.to === nodeId)
    .map(e => e.from);
}
```

The BFS seeds the queue with **direct dependents** (depth 1) and expands outward, level by level, until:
- A node has already been visited (`visited` Set), or
- The depth exceeds `MAX_BFS_DEPTH` (default: `10`)

```
target node
   ▲
   │  (direct dependents — depth 1)
[A, B, C]
   ▲
   │  (dependents of A, B, C — depth 2)
[D, E, F, G]
   ▲  ...and so on up to depth 10
```

### Step 3 — Score each affected node

Impact level is determined by **BFS depth**:

| Depth | Impact Level | Breaking Change? |
|---|---|---|
| 1 | `critical` | ✅ Yes |
| 2 | `high` | ✅ Yes |
| 3–4 | `medium` | ❌ No |
| 5–10 | `low` | ❌ No |

Nodes at depth ≤ 2 are flagged as `breakingChange: true` because they directly consume the target's interface.

### Step 4 — Compute the risk score

```ts
const score = C * 30 + H * 15 + M * 7 + L * 2 + inDegree * 3;
return Math.min(100, score);
```

Where `C`, `H`, `M`, `L` are the counts of critical/high/medium/low affected nodes, and `inDegree` is the target node's own in-degree.

The score is capped at 100.

**Risk level thresholds:**

| Score | Risk Level |
|---|---|
| ≥ 75 | `CRITICAL` |
| ≥ 50 | `HIGH` |
| ≥ 25 | `MEDIUM` |
| < 25  | `LOW` |

---

## Output Shape — `ImpactReport`

```ts
interface ImpactReport {
  targetNode: string;           // the ID of the changed node
  changeDescription: string;   // from CLI --impact flag
  riskScore: number;            // 0–100
  riskLevel: string;            // LOW / MEDIUM / HIGH / CRITICAL
  affectedNodes: AffectedNode[];
  breakingChanges: AffectedNode[]; // subset of affectedNodes where breakingChange=true
  testingPlan: string[];
  recommendations: string[];
}
```

### `AffectedNode`

```ts
interface AffectedNode {
  nodeId:        string;
  name:          string;
  file:          string;
  depth:         number;     // BFS distance from target
  impact:        string;     // critical / high / medium / low
  reason:        string;     // human-readable why
  changeRequired: string;    // what action is needed
  breakingChange: boolean;
}
```

---

## Recommendations Logic

Recommendations are generated automatically based on the risk score:

| Risk Score | Recommendations |
|---|---|
| ≥ 75 | Full team review, phased rollout, full regression suite |
| ≥ 50 | Tech lead review, feature flag the change |
| ≥ 25 | Code review, test all affected modules |
| < 25 | Standard PR process sufficient |

If any breaking changes exist, an additional note is always appended.

---

## Usage Example

```bash
node depgraph.js ./src --impact "getUserById" "removing userId parameter"
```

This runs the full pipeline and then simulates changing `getUserById`, returning a detailed report of everything that would be affected.

---

## Edge Cases

| Situation | Behaviour |
|---|---|
| Target not found | Returns an empty report with `riskScore: 0` and an explanatory testing plan entry |
| Target has no dependents | Returns an empty `affectedNodes` array and `LOW` risk |
| Circular dependencies | The `visited` Set prevents infinite loops |
| Extremely deep dependency chains | `MAX_BFS_DEPTH = 10` hard-caps traversal |
