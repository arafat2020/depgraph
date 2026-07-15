import { describe, it, expect } from 'vitest';
import { simulateImpact } from '../stages/impact';
import { DepGraph, DepNode } from '../types';

function createMockNode(id: string, name: string): DepNode {
  return {
    id,
    name,
    type: 'function',
    file: 'test.ts',
    line: 1,
    lang: 'js',
    complexity: 'low',
    inDegree: 0,
    outDegree: 0,
    centralityScore: 0,
    connections: []
  };
}

describe('Stage 5 — Impact Simulator', () => {
  it('returns empty report for unknown node name', () => {
    const graph: DepGraph = {
      nodes: new Map(),
      edges: []
    };
    const report = simulateImpact(graph, 'unknown', 'change desc');
    expect(report.riskScore).toBe(0);
    expect(report.affectedNodes.length).toBe(0);
    expect(report.testingPlan[0]).toContain('Could not simulate: Node "unknown" not found');
  });

  it('finds direct dependents at depth 1 as CRITICAL', () => {
    // A is target, B imports A
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')],
      ['B', createMockNode('B', 'dep1')]
    ]);
    const edges = [{ from: 'B', to: 'A', type: 'imports', description: '' }];
    const graph: DepGraph = { nodes, edges };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    const bReport = report.affectedNodes.find(n => n.name === 'dep1');
    expect(bReport).toBeDefined();
    expect(bReport?.depth).toBe(1);
    expect(bReport?.impact).toBe('critical');
  });

  it('finds transitive dependents at depth 2 as HIGH', () => {
    // A (target) <- B (depth 1) <- C (depth 2)
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')],
      ['B', createMockNode('B', 'dep1')],
      ['C', createMockNode('C', 'dep2')]
    ]);
    const edges = [
      { from: 'B', to: 'A', type: 'imports', description: '' },
      { from: 'C', to: 'B', type: 'imports', description: '' }
    ];
    const graph: DepGraph = { nodes, edges };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    const cReport = report.affectedNodes.find(n => n.name === 'dep2');
    expect(cReport).toBeDefined();
    expect(cReport?.depth).toBe(2);
    expect(cReport?.impact).toBe('high');
  });

  it('marks depth 1 and 2 as breakingChange: true', () => {
    // A (target) <- B (depth 1) <- C (depth 2) <- D (depth 3)
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')],
      ['B', createMockNode('B', 'dep1')],
      ['C', createMockNode('C', 'dep2')],
      ['D', createMockNode('D', 'dep3')]
    ]);
    const edges = [
      { from: 'B', to: 'A', type: 'imports', description: '' },
      { from: 'C', to: 'B', type: 'imports', description: '' },
      { from: 'D', to: 'C', type: 'imports', description: '' }
    ];
    const graph: DepGraph = { nodes, edges };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    const bReport = report.affectedNodes.find(n => n.name === 'dep1');
    const cReport = report.affectedNodes.find(n => n.name === 'dep2');
    const dReport = report.affectedNodes.find(n => n.name === 'dep3');

    expect(bReport?.breakingChange).toBe(true);
    expect(cReport?.breakingChange).toBe(true);
    expect(dReport?.breakingChange).toBe(false);
  });

  it('marks depth 5+ as LOW', () => {
    // Chain: A <- B <- C <- D <- E <- F (F is depth 5)
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')],
      ['B', createMockNode('B', 'dep1')],
      ['C', createMockNode('C', 'dep2')],
      ['D', createMockNode('D', 'dep3')],
      ['E', createMockNode('E', 'dep4')],
      ['F', createMockNode('F', 'dep5')]
    ]);
    const edges = [
      { from: 'B', to: 'A', type: 'imports', description: '' },
      { from: 'C', to: 'B', type: 'imports', description: '' },
      { from: 'D', to: 'C', type: 'imports', description: '' },
      { from: 'E', to: 'D', type: 'imports', description: '' },
      { from: 'F', to: 'E', type: 'imports', description: '' }
    ];
    const graph: DepGraph = { nodes, edges };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    const fReport = report.affectedNodes.find(n => n.name === 'dep5');
    expect(fReport?.depth).toBe(5);
    expect(fReport?.impact).toBe('low');
  });

  it('risk score is 0 when no dependents found', () => {
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')]
    ]);
    const graph: DepGraph = { nodes, edges: [] };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    expect(report.riskScore).toBe(0);
  });

  it('risk score is capped at 100', () => {
    // 5 critical nodes = 5 * 30 = 150 -> should be capped at 100
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')],
      ['B1', createMockNode('B1', 'dep1')],
      ['B2', createMockNode('B2', 'dep2')],
      ['B3', createMockNode('B3', 'dep3')],
      ['B4', createMockNode('B4', 'dep4')],
      ['B5', createMockNode('B5', 'dep5')]
    ]);
    const edges = [
      { from: 'B1', to: 'A', type: 'imports', description: '' },
      { from: 'B2', to: 'A', type: 'imports', description: '' },
      { from: 'B3', to: 'A', type: 'imports', description: '' },
      { from: 'B4', to: 'A', type: 'imports', description: '' },
      { from: 'B5', to: 'A', type: 'imports', description: '' }
    ];
    const graph: DepGraph = { nodes, edges };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    expect(report.riskScore).toBe(100);
  });

  it('testing plan includes the target node', () => {
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')]
    ]);
    const graph: DepGraph = { nodes, edges: [] };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    expect(report.testingPlan).toContain('Test targetNode directly after making changes');
  });

  it('recommendations are CRITICAL when score >= 75', () => {
    // 3 critical nodes = 3 * 30 = 90 >= 75
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A', 'targetNode')],
      ['B1', createMockNode('B1', 'dep1')],
      ['B2', createMockNode('B2', 'dep2')],
      ['B3', createMockNode('B3', 'dep3')]
    ]);
    const edges = [
      { from: 'B1', to: 'A', type: 'imports', description: '' },
      { from: 'B2', to: 'A', type: 'imports', description: '' },
      { from: 'B3', to: 'A', type: 'imports', description: '' }
    ];
    const graph: DepGraph = { nodes, edges };

    const report = simulateImpact(graph, 'targetNode', 'change desc');
    expect(report.riskScore).toBeGreaterThanOrEqual(75);
    expect(report.riskLevel).toBe('CRITICAL');
    expect(report.recommendations).toContain('Full team review required before merging');
  });
});
