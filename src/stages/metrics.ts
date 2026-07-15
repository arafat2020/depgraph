import { DepGraph, DepNode } from '../types';

export function computeMetrics(graph: DepGraph): DepGraph {

  // ─── STEP 1 — count inDegree and outDegree ──────────────

  for (const edge of graph.edges) {
    const fromNode = graph.nodes.get(edge.from);
    const toNode   = graph.nodes.get(edge.to);

    // the node doing the importing gets +1 outDegree
    if (fromNode) fromNode.outDegree += 1;

    // the node being imported gets +1 inDegree
    if (toNode)   toNode.inDegree   += 1;
  }

  // ─── STEP 2 — compute centralityScore ───────────────────

  for (const [, node] of graph.nodes) {
    node.centralityScore = node.inDegree * 2 + node.outDegree;
  }

  return graph;
}

// ─── STEP 3 — helper functions for summary ──────────────────

export function getEntryPoints(graph: DepGraph): string[] {
  // nodes nothing depends on but depend on others
  // these are the roots — API routes, main modules, top components
  return [...graph.nodes.values()]
    .filter(n => n.inDegree === 0 && n.outDegree > 0)
    .map(n => n.id);
}

export function getLeafNodes(graph: DepGraph): string[] {
  // nodes that depend on nothing
  // pure utilities — hashPassword, formatDate etc
  return [...graph.nodes.values()]
    .filter(n => n.outDegree === 0 && n.inDegree > 0)
    .map(n => n.id);
}

export function getIsolatedNodes(graph: DepGraph): string[] {
  // nodes with no connections at all
  // dead code candidates
  return [...graph.nodes.values()]
    .filter(n => n.inDegree === 0 && n.outDegree === 0)
    .map(n => n.id);
}

export function getCriticalNodes(graph: DepGraph): string[] {
  // nodes with centralityScore above 20
  // changing these affects the whole app
  return [...graph.nodes.values()]
    .filter(n => n.centralityScore > 20)
    .map(n => n.id);
}