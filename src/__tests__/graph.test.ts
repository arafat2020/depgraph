import { describe, it, expect } from 'vitest';
import { buildGraph } from '../stages/graph';
import { ParsedFile } from '../types';

function makeId(name: string, fileBase: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanBase = fileBase.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanName}__${cleanBase}`;
}

describe('Stage 3 — Graph Builder', () => {
  it('creates a node for every entity', () => {
    const parsed: ParsedFile[] = [
      {
        filePath: 'src/main.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'mainFunc', type: 'function', line: 1, complexity: 'low' },
          { name: 'helperVar', type: 'variable', line: 5, complexity: 'low' }
        ],
        imports: [],
        exports: ['mainFunc']
      }
    ];

    const graph = buildGraph(parsed);
    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.has(makeId('mainFunc', 'main'))).toBe(true);
    expect(graph.nodes.has(makeId('helperVar', 'main'))).toBe(true);
  });

  it('creates an edge between two connected files', () => {
    const parsed: ParsedFile[] = [
      {
        filePath: 'src/main.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'mainFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [
          { source: './helper', names: ['helperFunc'], isLocal: true }
        ],
        exports: []
      },
      {
        filePath: 'src/helper.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'helperFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [],
        exports: ['helperFunc']
      }
    ];

    const graph = buildGraph(parsed);
    const fromId = makeId('mainFunc', 'main');
    const toId = makeId('helperFunc', 'helper');

    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]).toEqual(expect.objectContaining({
      from: fromId,
      to: toId,
      type: 'imports'
    }));

    // Verify connections are updated on both nodes
    expect(graph.nodes.get(fromId)?.connections).toContain(toId);
    expect(graph.nodes.get(toId)?.connections).toContain(fromId);
  });

  it('does not create self-loops', () => {
    const parsed: ParsedFile[] = [
      {
        filePath: 'src/main.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'mainFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [
          // imports itself or name matches, leading to fromId === toId
          { source: './main', names: ['mainFunc'], isLocal: true }
        ],
        exports: []
      }
    ];

    const graph = buildGraph(parsed);
    expect(graph.edges.length).toBe(0);
  });

  it('does not create duplicate edges', () => {
    const parsed: ParsedFile[] = [
      {
        filePath: 'src/main.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'mainFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [
          // Same import duplicate entry
          { source: './helper', names: ['helperFunc'], isLocal: true },
          { source: './helper', names: ['helperFunc'], isLocal: true }
        ],
        exports: []
      },
      {
        filePath: 'src/helper.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'helperFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [],
        exports: ['helperFunc']
      }
    ];

    const graph = buildGraph(parsed);
    expect(graph.edges.length).toBe(1);
  });

  it('skips external imports (express, fs etc)', () => {
    const parsed: ParsedFile[] = [
      {
        filePath: 'src/main.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'mainFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [
          { source: 'express', names: ['Router'], isLocal: false },
          { source: 'fs', names: ['readFileSync'], isLocal: false }
        ],
        exports: []
      }
    ];

    const graph = buildGraph(parsed);
    expect(graph.edges.length).toBe(0);
  });

  it('resolves ./userService to userService.ts correctly', () => {
    const parsed: ParsedFile[] = [
      {
        filePath: 'src/main.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'mainFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [
          { source: './userService', names: ['getUser'], isLocal: true }
        ],
        exports: []
      },
      {
        filePath: 'src/userService.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'getUser', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [],
        exports: ['getUser']
      }
    ];

    const graph = buildGraph(parsed);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].to).toBe(makeId('getUser', 'userService'));
  });

  it('resolves ./utils/index to utils/index.ts correctly', () => {
    const parsed: ParsedFile[] = [
      {
        filePath: 'src/main.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'mainFunc', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [
          { source: './utils', names: ['formatDate'], isLocal: true }
        ],
        exports: []
      },
      {
        filePath: 'src/utils/index.ts',
        lang: 'ts',
        lines: 10,
        entities: [
          { name: 'formatDate', type: 'function', line: 1, complexity: 'low' }
        ],
        imports: [],
        exports: ['formatDate']
      }
    ];

    const graph = buildGraph(parsed);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].to).toBe(makeId('formatDate', 'index'));
  });
});
