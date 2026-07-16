import { DepGraph, AffectedNode, ImpactReport } from '../types';
import { MAX_BFS_DEPTH } from '../constants';

/**
 * Simulates the cascading impact of modifying a specific node in the dependency graph.
 * Performs a reverse BFS up to a configured max depth, mapping risk scores, risk levels,
 * downstream affected nodes, testing plans, and architectural recommendations.
 * 
 * @param graph The computed dependency graph.
 * @param targetName The name of the target entity to simulate a change for.
 * @param changeDescription A description detailing the reason or content of the proposed modification.
 * @returns The impact report structure.
 */
export function simulateImpact(
  graph: DepGraph,
  targetName: string,
  changeDescription: string
): ImpactReport {

  // ─── STEP 1 — find the target node ──────────────────────

  const targetNode = [...graph.nodes.values()]
    .find(n => n.name === targetName);

  if (!targetNode) {
    return emptyReport(targetName, changeDescription,
      `Node "${targetName}" not found in graph`);
  }

  // ─── STEP 2 — reverse BFS ───────────────────────────────

  const affected: AffectedNode[] = [];
  const visited  = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [];

  // seed the queue with direct dependents (depth 1)
  const directDependents = getDirectDependents(graph, targetNode.id);
  for (const depId of directDependents) {
    queue.push({ id: depId, depth: 1 });
  }

  // BFS loop
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!; // take from front

    // skip if already visited or too deep
    if (visited.has(id))       continue;
    if (depth > MAX_BFS_DEPTH) continue;

    visited.add(id);

    const node = graph.nodes.get(id);
    if (!node) continue;

    // determine impact level from depth
    const impact = getImpactLevel(depth);

    affected.push({
      nodeId:         id,
      name:           node.name,
      file:           node.file,
      depth,
      impact,
      reason:         getReason(node.name, targetName, depth),
      changeRequired: getChangeRequired(node.name, targetName, impact),
      breakingChange: depth <= 2,
    });

    // find what depends on THIS node and add to queue
    const nextDependents = getDirectDependents(graph, id);
    for (const nextId of nextDependents) {
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, depth: depth + 1 });
      }
    }
  }

  // ─── STEP 3 — compute risk score ────────────────────────

  const riskScore = computeRiskScore(affected, targetNode.inDegree);
  const riskLevel = getRiskLevel(riskScore);

  // ─── STEP 4 — build the report ──────────────────────────

  const breakingChanges = affected.filter(n => n.breakingChange);
  const testingPlan     = buildTestingPlan(targetName, affected);
  const recommendations = buildRecommendations(riskScore, breakingChanges.length);

  return {
    targetNode:        targetNode.id,
    changeDescription,
    riskScore,
    riskLevel,
    affectedNodes:     affected,
    breakingChanges,
    testingPlan,
    recommendations,
  };
}

// ─── HELPERS ────────────────────────────────────────────────

/**
 * Returns all node IDs in the graph that directly import/depend on the specified node.
 * 
 * @param graph The dependency graph.
 * @param nodeId The target node ID.
 * @returns An array of dependent node IDs.
 */
function getDirectDependents(graph: DepGraph, nodeId: string): string[] {
  return graph.edges
    .filter(e => e.to === nodeId)
    .map(e => e.from);
}

/**
 * Maps a BFS traversal depth to an impact classification string.
 * Depth 1 is "critical", Depth 2 is "high", Depth 3-4 is "medium", and deeper is "low".
 * 
 * @param depth The BFS depth.
 * @returns The impact level string.
 */
function getImpactLevel(depth: number): string {
  if (depth === 1)    return 'critical';
  if (depth === 2)    return 'high';
  if (depth <= 4)     return 'medium';
  return 'low';
}

/**
 * Computes a composite risk score (0 to 100) based on the quantities of downstream
 * affected nodes at different impact levels and the target node's in-degree count.
 * 
 * @param affected A list of downstream affected nodes.
 * @param inDegree The in-degree count of the target node.
 * @returns A risk score integer bounded between 0 and 100.
 */
function computeRiskScore(affected: AffectedNode[], inDegree: number): number {
  const C = affected.filter(n => n.impact === 'critical').length;
  const H = affected.filter(n => n.impact === 'high').length;
  const M = affected.filter(n => n.impact === 'medium').length;
  const L = affected.filter(n => n.impact === 'low').length;

  const score = C * 30 + H * 15 + M * 7 + L * 2 + inDegree * 3;
  return Math.min(100, score);
}

/**
 * Maps a risk score integer to a qualitative threat level classification string.
 * Score 75+ is "CRITICAL", 50+ is "HIGH", 25+ is "MEDIUM", and lower is "LOW".
 * 
 * @param score The risk score.
 * @returns The threat level classification string.
 */
function getRiskLevel(score: number): string {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Builds a natural explanation describing why a specific downstream node is affected by a change.
 * 
 * @param nodeName The name of the downstream node.
 * @param targetName The name of the modified target node.
 * @param depth The traversal depth.
 * @returns A human-readable reason string.
 */
function getReason(nodeName: string, targetName: string, depth: number): string {
  if (depth === 1) return `${nodeName} directly imports ${targetName}`;
  if (depth === 2) return `${nodeName} depends on something that uses ${targetName}`;
  return `${nodeName} is transitively affected by changes to ${targetName}`;
}

/**
 * Resolves the action required to verify/update a downstream node based on its impact classification.
 * 
 * @param name The name of the downstream node.
 * @param targetName The name of the target node.
 * @param impact The impact level string.
 * @returns An action description string.
 */
function getChangeRequired(name: string, targetName: string, impact: string): string {
  if (impact === 'critical') return `Update ${name} to handle the new interface of ${targetName}`;
  if (impact === 'high')     return `Review ${name} for compatibility with changed ${targetName}`;
  if (impact === 'medium')   return `Test ${name} after deploying changes to ${targetName}`;
  return `Monitor ${name} for unexpected behavior after ${targetName} changes`;
}

/**
 * Compiles a structured testing plan listing regression and integration candidates based on traversal nodes.
 * 
 * @param targetName The name of the target node.
 * @param affected The array of downstream affected nodes.
 * @returns A list of testing steps/actions.
 */
function buildTestingPlan(targetName: string, affected: AffectedNode[]): string[] {
  const plan: string[] = [];

  plan.push(`Test ${targetName} directly after making changes`);

  const critical = affected.filter(n => n.impact === 'critical');
  const high     = affected.filter(n => n.impact === 'high');

  for (const node of critical) {
    plan.push(`Regression test ${node.name} — direct dependent`);
  }
  for (const node of high) {
    plan.push(`Integration test ${node.name} — indirect dependent`);
  }

  if (affected.length > 5) {
    plan.push(`Run full test suite — ${affected.length} nodes affected`);
  }

  return plan;
}

/**
 * Compiles action-oriented code review recommendations based on risk scores and breaking changes counts.
 * 
 * @param riskScore The computed risk score.
 * @param breakingCount The number of downstream breaking changes.
 * @returns A list of recommendations.
 */
function buildRecommendations(riskScore: number, breakingCount: number): string[] {
  const rec: string[] = [];

  if (riskScore >= 75) {
    rec.push('Full team review required before merging');
    rec.push('Consider a phased rollout');
    rec.push('Run full regression test suite');
  } else if (riskScore >= 50) {
    rec.push('Tech lead review recommended');
    rec.push('Feature flag this change');
    rec.push('Test all breaking changes before deploying');
  } else if (riskScore >= 25) {
    rec.push('Code review required');
    rec.push('Test all affected modules');
  } else {
    rec.push('Standard PR process is sufficient');
    rec.push('Unit tests for the changed node are enough');
  }

  if (breakingCount > 0) {
    rec.push(`${breakingCount} breaking change(s) must be updated before deploying`);
  }

  return rec;
}

/**
 * Generates an empty default impact report in cases where the target node was not found.
 * 
 * @param targetName The name of the target node.
 * @param changeDescription The description of the change.
 * @param reason The error reason.
 * @returns An empty impact report.
 */
function emptyReport(
  targetName: string,
  changeDescription: string,
  reason: string
): ImpactReport {
  return {
    targetNode:        targetName,
    changeDescription,
    riskScore:         0,
    riskLevel:         'LOW',
    affectedNodes:     [],
    breakingChanges:   [],
    testingPlan:       [`Could not simulate: ${reason}`],
    recommendations:   ['Verify the node name and try again'],
  };
}