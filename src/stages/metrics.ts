import { DepGraph, DepNode } from '../types';

/**
 * Computes graph metrics (inDegree, outDegree, centralityScore) for all nodes in the dependency graph.
 * Mutates the input graph nodes with updated counts.
 * 
 * @param graph The dependency graph.
 * @returns The graph with updated node metrics.
 */
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

/**
 * Identifies entry points in the dependency graph (nodes with in-degree equal to 0, out-degree greater than 0).
 * Entry points typically represent application roots, API route declarations, or top-level entry files.
 * 
 * @param graph The dependency graph.
 * @returns An array of node ID strings representing entry points.
 */
export function getEntryPoints(graph: DepGraph): string[] {
  // nodes nothing depends on but depend on others
  // these are the roots — API routes, main modules, top components
  return [...graph.nodes.values()]
    .filter(n => n.inDegree === 0 && n.outDegree > 0)
    .map(n => n.id);
}

/**
 * Identifies leaf nodes in the dependency graph (nodes with out-degree equal to 0, in-degree greater than 0).
 * Leaf nodes are pure utilities or low-level components that do not depend on other project modules.
 * 
 * @param graph The dependency graph.
 * @returns An array of node ID strings representing leaf nodes.
 */
export function getLeafNodes(graph: DepGraph): string[] {
  // nodes that depend on nothing
  // pure utilities — hashPassword, formatDate etc
  return [...graph.nodes.values()]
    .filter(n => n.outDegree === 0 && n.inDegree > 0)
    .map(n => n.id);
}

/**
 * Identifies isolated/orphaned nodes in the dependency graph (nodes with zero in-degree and zero out-degree).
 * Isolated nodes represent potential dead code candidates.
 * 
 * @param graph The dependency graph.
 * @returns An array of node ID strings representing isolated nodes.
 */
export function getIsolatedNodes(graph: DepGraph): string[] {
  // nodes with no connections at all
  // dead code candidates
  return [...graph.nodes.values()]
    .filter(n => n.inDegree === 0 && n.outDegree === 0)
    .map(n => n.id);
}

/**
 * Identifies highly critical nodes in the dependency graph (centrality score > 20).
 * Modifying these nodes poses a higher risk of introducing regression bugs because they are heavily integrated.
 * 
 * @param graph The dependency graph.
 * @returns An array of node ID strings representing critical nodes.
 */
export function getCriticalNodes(graph: DepGraph): string[] {
  // nodes with centralityScore above 20
  // changing these affects the whole app
  return [...graph.nodes.values()]
    .filter(n => n.centralityScore > 20)
    .map(n => n.id);
}