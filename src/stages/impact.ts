import { DepGraph, AffectedNode, ImpactReport } from '../types';
import { MAX_BFS_DEPTH } from '../constants';

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

// find all nodes that directly import/use this node
function getDirectDependents(graph: DepGraph, nodeId: string): string[] {
  return graph.edges
    .filter(e => e.to === nodeId)
    .map(e => e.from);
}

function getImpactLevel(depth: number): string {
  if (depth === 1)    return 'critical';
  if (depth === 2)    return 'high';
  if (depth <= 4)     return 'medium';
  return 'low';
}

function computeRiskScore(affected: AffectedNode[], inDegree: number): number {
  const C = affected.filter(n => n.impact === 'critical').length;
  const H = affected.filter(n => n.impact === 'high').length;
  const M = affected.filter(n => n.impact === 'medium').length;
  const L = affected.filter(n => n.impact === 'low').length;

  const score = C * 30 + H * 15 + M * 7 + L * 2 + inDegree * 3;
  return Math.min(100, score);
}

function getRiskLevel(score: number): string {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

function getReason(nodeName: string, targetName: string, depth: number): string {
  if (depth === 1) return `${nodeName} directly imports ${targetName}`;
  if (depth === 2) return `${nodeName} depends on something that uses ${targetName}`;
  return `${nodeName} is transitively affected by changes to ${targetName}`;
}

function getChangeRequired(name: string, targetName: string, impact: string): string {
  if (impact === 'critical') return `Update ${name} to handle the new interface of ${targetName}`;
  if (impact === 'high')     return `Review ${name} for compatibility with changed ${targetName}`;
  if (impact === 'medium')   return `Test ${name} after deploying changes to ${targetName}`;
  return `Monitor ${name} for unexpected behavior after ${targetName} changes`;
}

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