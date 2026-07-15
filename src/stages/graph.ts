import path from 'path';
import { ParsedFile, DepGraph, DepNode, DepEdge } from '../types';

export function buildGraph(parsedFiles: ParsedFile[]): DepGraph {
  const nodes = new Map<string, DepNode>();
  const edges: DepEdge[] = [];

  // ─── STEP 1 — create a node for every entity ──────────────

  for (const file of parsedFiles) {
    const fileBase = path.basename(file.filePath, path.extname(file.filePath));

    for (const entity of file.entities) {
      const id = makeId(entity.name, fileBase);

      // skip duplicates
      if (nodes.has(id)) continue;

      nodes.set(id, {
        id,
        name:           entity.name,
        type:           entity.type,
        file:           file.filePath,
        line:           entity.line,
        lang:           file.lang,
        complexity:     entity.complexity,
        inDegree:       0,
        outDegree:      0,
        centralityScore: 0,
        connections:    [],
      });
    }
  }

  // ─── STEP 2 — build a lookup: filePath → ParsedFile ───────

  // this lets us find a file by its path instantly
  const fileMap = new Map<string, ParsedFile>();
  for (const file of parsedFiles) {
    fileMap.set(file.filePath, file);
  }

  // ─── STEP 3 — connect nodes through imports ────────────────

  for (const file of parsedFiles) {
    const fileBase = path.basename(file.filePath, path.extname(file.filePath));

    for (const imp of file.imports) {
      // skip external packages like 'express', 'lodash'
      if (!imp.isLocal) continue;

      // resolve './userService' → actual file path
      const resolvedPath = resolvePath(file.filePath, imp.source, parsedFiles);
      if (!resolvedPath) continue;

      const targetFile = fileMap.get(resolvedPath);
      if (!targetFile) continue;

      // for each imported name, find the matching entity
      for (const importedName of imp.names) {
        const targetEntity = targetFile.entities.find(e => e.name === importedName);
        if (!targetEntity) continue;

        const targetBase = path.basename(resolvedPath, path.extname(resolvedPath));
        const toId = makeId(importedName, targetBase);
        if (!nodes.has(toId)) continue;

        // create edge from EACH entity in the importing file
        const fromEntities = file.entities.length > 0
          ? file.entities
          : [{ name: fileBase, type: 'file', line: 0, complexity: 'low' }];

        for (const fromEntity of fromEntities) {
          const fromId = makeId(fromEntity.name, fileBase);

          if (!nodes.has(fromId)) continue;
          if (fromId === toId)    continue;

          const alreadyExists = edges.some(
            e => e.from === fromId && e.to === toId && e.type === 'imports'
          );
          if (alreadyExists) continue;

          edges.push({
            from: fromId,
            to:   toId,
            type: 'imports',
            description: `${fromEntity.name} imports ${importedName} from ${path.basename(resolvedPath)}`,
          });

          const fromNode = nodes.get(fromId);
          const toNode   = nodes.get(toId);

          if (fromNode && !fromNode.connections.includes(toId)) {
            fromNode.connections.push(toId);
          }
          if (toNode && !toNode.connections.includes(fromId)) {
            toNode.connections.push(fromId);
          }
        }
      }
    }
  }

  return { nodes, edges };
}

// ─── HELPERS ──────────────────────────────────────────────────

// turns "getUserById" + "userService" → "getUserById__userService"
function makeId(name: string, fileBase: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanBase = fileBase.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanName}__${cleanBase}`;
}

// resolves './userService' to 'src/services/userService.ts'
function resolvePath(
  fromFile: string,
  importSource: string,
  allFiles: ParsedFile[]
): string | null {
  const fromDir = path.dirname(fromFile);
  const base    = path.join(fromDir, importSource);

  // try these extensions in order
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.js`,
  ];

  for (const candidate of candidates) {
    // normalize path separators so comparison works on all OS
    const normalized = candidate.replace(/\\/g, '/');
    const found = allFiles.find(f => f.filePath.replace(/\\/g, '/') === normalized);
    if (found) return found.filePath;
  }

  return null;
}