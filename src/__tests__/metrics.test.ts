import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  getEntryPoints,
  getLeafNodes,
  getIsolatedNodes,
  getCriticalNodes
} from '../stages/metrics';
import { DepGraph, DepNode } from '../types';

function createMockNode(id: string): DepNode {
  return {
    id,
    name: id,
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

describe('Stage 4 — Metrics Engine', () => {
  it('inDegree increases when something imports a node', () => {
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A')],
      ['B', createMockNode('B')]
    ]);
    const edges = [{ from: 'A', to: 'B', type: 'imports', description: '' }];
    const graph: DepGraph = { nodes, edges };

    computeMetrics(graph);
    expect(graph.nodes.get('B')?.inDegree).toBe(1);
  });

  it('outDegree increases when a node imports something', () => {
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A')],
      ['B', createMockNode('B')]
    ]);
    const edges = [{ from: 'A', to: 'B', type: 'imports', description: '' }];
    const graph: DepGraph = { nodes, edges };

    computeMetrics(graph);
    expect(graph.nodes.get('A')?.outDegree).toBe(1);
  });

  it('centralityScore = inDegree * 2 + outDegree', () => {
    const nodes = new Map<string, DepNode>([
      ['A', createMockNode('A')],
      ['B', createMockNode('B')]
    ]);
    const edges = [{ from: 'A', to: 'B', type: 'imports', description: '' }];
    const graph: DepGraph = { nodes, edges };

    computeMetrics(graph);
    const nodeA = graph.nodes.get('A')!;
    const nodeB = graph.nodes.get('B')!;

    // A: inDegree=0, outDegree=1 => centrality = 0 * 2 + 1 = 1
    // B: inDegree=1, outDegree=0 => centrality = 1 * 2 + 0 = 2
    expect(nodeA.centralityScore).toBe(1);
    expect(nodeB.centralityScore).toBe(2);
  });

  it('entry points have inDegree 0 and outDegree > 0', () => {
    const nodes = new Map<string, DepNode>([
      ['A', { ...createMockNode('A'), inDegree: 0, outDegree: 2 }],
      ['B', { ...createMockNode('B'), inDegree: 1, outDegree: 1 }],
      ['C', { ...createMockNode('C'), inDegree: 1, outDegree: 0 }],
      ['D', { ...createMockNode('D'), inDegree: 0, outDegree: 0 }]
    ]);
    const graph: DepGraph = { nodes, edges: [] };

    const entryPoints = getEntryPoints(graph);
    expect(entryPoints).toEqual(['A']);
  });

  it('leaf nodes have outDegree 0 and inDegree > 0', () => {
    const nodes = new Map<string, DepNode>([
      ['A', { ...createMockNode('A'), inDegree: 0, outDegree: 2 }],
      ['B', { ...createMockNode('B'), inDegree: 1, outDegree: 1 }],
      ['C', { ...createMockNode('C'), inDegree: 1, outDegree: 0 }],
      ['D', { ...createMockNode('D'), inDegree: 0, outDegree: 0 }]
    ]);
    const graph: DepGraph = { nodes, edges: [] };

    const leafNodes = getLeafNodes(graph);
    expect(leafNodes).toEqual(['C']);
  });

  it('isolated nodes have both inDegree 0 and outDegree 0', () => {
    const nodes = new Map<string, DepNode>([
      ['A', { ...createMockNode('A'), inDegree: 0, outDegree: 2 }],
      ['B', { ...createMockNode('B'), inDegree: 1, outDegree: 1 }],
      ['C', { ...createMockNode('C'), inDegree: 1, outDegree: 0 }],
      ['D', { ...createMockNode('D'), inDegree: 0, outDegree: 0 }]
    ]);
    const graph: DepGraph = { nodes, edges: [] };

    const isolatedNodes = getIsolatedNodes(graph);
    expect(isolatedNodes).toEqual(['D']);
  });

  it('critical nodes have centralityScore > 20', () => {
    const nodes = new Map<string, DepNode>([
      ['A', { ...createMockNode('A'), centralityScore: 21 }],
      ['B', { ...createMockNode('B'), centralityScore: 20 }],
      ['C', { ...createMockNode('C'), centralityScore: 5 }]
    ]);
    const graph: DepGraph = { nodes, edges: [] };

    const criticalNodes = getCriticalNodes(graph);
    expect(criticalNodes).toEqual(['A']);
  });
});
