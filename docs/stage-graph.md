# Stage 3 — Graph Builder

> **File**: `src/stages/graph.ts`  
> **Exports**: `buildGraph(parsedFiles: ParsedFile[]): DepGraph`

---

## What It Does

The graph builder takes the flat list of `ParsedFile` objects and turns it into a **directed dependency graph**: a collection of **nodes** (entities) connected by **edges** (import relationships).

After this stage, you know exactly which entity depends on which other entity, across the entire codebase.

---

## The Three-Step Build Process

### Step 1 — Create a node for every entity

Every `RawEntity` found in every file becomes a `DepNode` in the graph:

```ts
for (const file of parsedFiles) {
  const fileBase = path.basename(file.filePath, path.extname(file.filePath));

  for (const entity of file.entities) {
    const id = makeId(entity.name, fileBase); // e.g. "getUserById__userService"

    if (nodes.has(id)) continue; // skip duplicates

    nodes.set(id, {
      id,
      name: entity.name,
      type: entity.type,
      file: file.filePath,
      line: entity.line,
      lang: file.lang,
      complexity: entity.complexity,
      inDegree: 0,
      outDegree: 0,
      centralityScore: 0,
      connections: [],
    });
  }
}
```

**Node IDs** are composite strings: `entityName__fileBasename`.  
For example, the function `getUserById` in `src/services/userService.ts` gets ID `getUserById__userService`.

This scheme prevents collisions when two files have a function with the same name.

### Step 2 — Build a file path lookup map

```ts
const fileMap = new Map<string, ParsedFile>();
for (const file of parsedFiles) {
  fileMap.set(file.filePath, file);
}
```

This allows O(1) lookup from a resolved file path → its `ParsedFile` data.

### Step 3 — Connect nodes through imports

This is where the real graph-building happens. For every file:

1. Iterate over its `imports`.
2. Skip **external** imports (packages like `express`, `lodash`) — only local imports matter.
3. **Resolve** the import path to an actual file on disk (see path resolution below).
4. For each imported name, find the matching entity in the target file.
5. Create an edge from **every entity in the importing file** to the **matching target entity**.

```ts
edges.push({
  from: fromId,
  to: toId,
  type: 'imports',
  description: `${fromEntity.name} imports ${importedName} from ${path.basename(resolvedPath)}`,
});
```

Duplicate edges are guarded against before insertion.

---

## Path Resolution

Import paths like `"./userService"` don't include an extension. The `resolvePath` helper tries these candidates in priority order:

```
./userService
./userService.ts
./userService.tsx
./userService.js
./userService.jsx
./userService/index.ts
./userService/index.js
```

It finds the first candidate that matches a known file in `parsedFiles` and returns that path. If nothing matches, the import is silently skipped.

---

## Output Shape — `DepGraph`

```ts
interface DepGraph {
  nodes: Map<string, DepNode>;
  edges: DepEdge[];
}
```

At this point, all `inDegree`, `outDegree`, and `centralityScore` fields on each node are still `0`. The **Metrics stage** fills these in (see [stage-metrics.md](./stage-metrics.md)).

---

## Edge Direction Convention

```
FROM → TO
 (importer)  (imported)
```

If `routes/users.ts` imports `getUserById` from `services/userService.ts`, the edge is:

```
GET /api/users__users  →  getUserById__userService
```

This forward-direction convention means: **following edges = following dependencies**.  
For impact analysis (who depends on me?), edges are traversed **in reverse** (see [stage-impact.md](./stage-impact.md)).

---

## The `makeId` Helper

```ts
function makeId(name: string, fileBase: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanBase = fileBase.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanName}__${cleanBase}`;
}
```

Non-alphanumeric characters (e.g. spaces, slashes in route paths like `GET /api/users`) are replaced with underscores. This keeps IDs safe for use as JSON keys and stable across runs.

---

## Common Gotchas

| Situation | Behaviour |
|---|---|
| Two files export the same function name | First one wins; second is skipped (duplicate `id` guard) |
| Import resolves to a file with no entities | The import is dropped — nothing to link to |
| Circular imports (A imports B, B imports A) | Both edges are created; no infinite loop — the graph is built in a single linear pass |
| External package imports | Skipped via the `isLocal` flag on `RawImport` |
