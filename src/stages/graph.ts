import path from 'path';
import { ParsedFile, DepGraph, DepNode, DepEdge } from '../types';

/**
 * Assembles a resolved DepGraph from a collection of ParsedFile objects.
 * Maps entity nodes, parses import dependencies to resolve linkage paths, and links corresponding imports to exports.
 * 
 * @param parsedFiles An array of parsed files containing raw entity and import metadata.
 * @returns The resolved dependency graph containing nodes and directed import edges.
 */
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

/**
 * Creates a unique composite identifier string for a node by combining the entity name and clean file base name.
 * 
 * @param name The name of the entity.
 * @param fileBase The base filename (without extensions).
 * @returns A composite node ID.
 */
function makeId(name: string, fileBase: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanBase = fileBase.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanName}__${cleanBase}`;
}

/**
 * Resolves a relative import path path to the matching absolute/relative project file path registered in the project.
 * Tries file extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `/index.ts`, etc.) in sequential priority.
 * 
 * @param fromFile The file path containing the import declaration.
 * @param importSource The import source path string.
 * @param allFiles A list of all parsed files in the project.
 * @returns The matched file path if resolved, or null.
 */
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