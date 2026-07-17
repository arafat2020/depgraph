# Data Types Reference

> **File**: `src/types.ts`  
> All shared TypeScript interfaces used across every stage of the pipeline.

---

## Data Flow Summary

```
RawEntity  ┐
RawImport  ├──► ParsedFile  ──► DepNode / DepEdge  ──► DepGraph
           ┘                          │
                                      ▼
                               AffectedNode  ──► ImpactReport
                                      │
                                      ▼
                                  OutputJSON  (written to disk)
```

---

## Stage 1–2 Types (Parser Output)

### `RawEntity`

A code construct extracted directly from source — before any cross-file resolution.

```ts
interface RawEntity {
  name:       string;  // e.g. "getUserById"
  type:       string;  // "function" | "class" | "component" | "hook" | "api" | "interface" | "type"
  line:       number;  // 1-indexed line number in the source file
  complexity: string;  // "low" | "medium" | "high"
}
```

**Entity types by language:**

| Type | Languages | Example |
|---|---|---|
| `function` | JS/TS, Python | `function doSomething()` |
| `class` | JS/TS, Python | `class UserService` |
| `component` | JS/TS (React) | `const Button = () =>` |
| `hook` | JS/TS (React) | `const useAuth = () =>` |
| `interface` | TypeScript | `interface User` |
| `type` | TypeScript | `type UserId = string` |
| `api` | JS/TS (Express) | `app.get('/users', ...)` |

---

### `RawImport`

An import statement extracted from a source file.

```ts
interface RawImport {
  source:  string;    // the import path, e.g. "./userService" or "express"
  names:   string[];  // the names imported, e.g. ["getUserById", "createUser"]
  isLocal: boolean;   // true if source starts with "." (relative path)
}
```

**Key distinction**: Only imports where `isLocal === true` become graph edges. External package imports (`"express"`, `"lodash"`, etc.) are ignored during graph construction.

---

### `ParsedFile`

The complete output for one source file after parsing.

```ts
interface ParsedFile {
  filePath: string;        // absolute or relative path on disk
  lang:     string;        // parser's lang id, e.g. "js" or "py"
  lines:    number;        // total line count
  entities: RawEntity[];   // all found code constructs
  imports:  RawImport[];   // all import statements
  exports:  string[];      // names of exported entities
}
```

---

## Stage 3–4 Types (Graph)

### `DepNode`

A fully resolved node in the dependency graph. Built from a `RawEntity`, enriched with graph metrics.

```ts
interface DepNode {
  id:              string;    // composite ID: "entityName__fileBase"
  name:            string;    // entity name, e.g. "getUserById"
  type:            string;    // same as RawEntity.type
  file:            string;    // source file path
  line:            number;    // source line number
  lang:            string;    // language id
  complexity:      string;    // "low" | "medium" | "high"
  inDegree:        number;    // how many other nodes import this one
  outDegree:       number;    // how many nodes this one imports
  centralityScore: number;    // inDegree * 2 + outDegree
  connections:     string[];  // IDs of directly connected nodes (both directions)

  // Optional — only present for specific entity types:
  extends?: string;  // parent class/interface name
  method?:  string;  // HTTP method for API routes, e.g. "GET"
  route?:   string;  // URL path for API routes, e.g. "/api/users"
}
```

**Node ID format**: `getUserById__userService`  
(entity name + `__` + file basename without extension, with non-alphanumeric chars replaced by `_`)

---

### `DepEdge`

A directed link from one node to another, representing an import relationship.

```ts
interface DepEdge {
  from:        string;  // source node ID (the importer)
  to:          string;  // target node ID (the imported entity)
  type:        string;  // currently always "imports"
  description: string;  // human-readable, e.g. "UserRouter imports getUserById from userService"
}
```

**Direction convention**: `from → to` means "`from` depends on `to`".

---

### `DepGraph`

The complete graph.

```ts
interface DepGraph {
  nodes: Map<string, DepNode>;  // keyed by node ID
  edges: DepEdge[];
}
```

The `nodes` Map is converted to an Array when writing to JSON output.

---

## Stage 5 Types (Impact)

### `AffectedNode`

A downstream node discovered during BFS traversal from the impact target.

```ts
interface AffectedNode {
  nodeId:         string;   // graph node ID
  name:           string;   // entity name
  file:           string;   // source file path
  depth:          number;   // BFS depth from target (1 = direct dependent)
  impact:         string;   // "critical" | "high" | "medium" | "low"
  reason:         string;   // why this node is affected
  changeRequired: string;   // what action needs to be taken
  breakingChange: boolean;  // true if depth <= 2
}
```

---

### `ImpactReport`

The full simulation result returned by `simulateImpact`.

```ts
interface ImpactReport {
  targetNode:        string;           // the node ID of the changed entity
  changeDescription: string;          // description from --impact flag
  riskScore:         number;           // 0–100
  riskLevel:         string;           // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  affectedNodes:     AffectedNode[];   // all downstream nodes
  breakingChanges:   AffectedNode[];   // subset where breakingChange === true
  testingPlan:       string[];         // recommended test actions
  recommendations:   string[];         // code review / deployment guidance
}
```

**Risk score formula**: `C×30 + H×15 + M×7 + L×2 + targetInDegree×3` (capped at 100)

---

## Output Type

### `OutputJSON`

The root schema of the generated `depgraph-output.json` file.

```ts
interface OutputJSON {
  meta: {
    version:    string;   // tool version, e.g. "1.0.0"
    timestamp:  string;   // ISO 8601, e.g. "2024-01-15T09:30:00.000Z"
    totalFiles: number;
    totalLines: number;
  };
  summary: {
    totalNodes:    number;
    totalEdges:    number;
    entryPoints:   string[];  // node IDs with inDegree=0 & outDegree>0
    leafNodes:     string[];  // node IDs with outDegree=0 & inDegree>0
    isolatedNodes: string[];  // node IDs with both degrees = 0 (dead code)
    criticalNodes: string[];  // node IDs with centralityScore > 20
  };
  nodes:   DepNode[];
  edges:   DepEdge[];
  files:   ParsedFile[];
  impact?: ImpactReport;  // only present when --impact was used
}
```
