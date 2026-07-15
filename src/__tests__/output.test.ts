import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { writeOutput } from '../stages/output';
import { DepGraph, ParsedFile, ImpactReport } from '../types';

describe('Stage 6 — Output Serializer', () => {
  const outputPath = path.join(__dirname, 'temp_output/output.json');

  beforeEach(() => {
    const dir = path.dirname(outputPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    const dir = path.dirname(outputPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates the output file at the specified path', () => {
    const graph: DepGraph = { nodes: new Map(), edges: [] };
    const parsed: ParsedFile[] = [];

    writeOutput(graph, parsed, outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('output contains meta, summary, nodes, edges, files', () => {
    const graph: DepGraph = { nodes: new Map(), edges: [] };
    const parsed: ParsedFile[] = [];

    writeOutput(graph, parsed, outputPath);
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(content).toHaveProperty('meta');
    expect(content).toHaveProperty('summary');
    expect(content).toHaveProperty('nodes');
    expect(content).toHaveProperty('edges');
    expect(content).toHaveProperty('files');
  });

  it('nodes is an array not a Map', () => {
    const nodes = new Map([
      ['nodeA', {
        id: 'nodeA',
        name: 'nodeA',
        type: 'function',
        file: 'test.ts',
        line: 1,
        lang: 'js',
        complexity: 'low',
        inDegree: 0,
        outDegree: 0,
        centralityScore: 0,
        connections: []
      }]
    ]);
    const graph: DepGraph = { nodes, edges: [] };
    const parsed: ParsedFile[] = [];

    writeOutput(graph, parsed, outputPath);
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(Array.isArray(content.nodes)).toBe(true);
    expect(content.nodes).toHaveLength(1);
    expect(content.nodes[0].id).toBe('nodeA');
  });

  it('impact field is present when impact report is passed', () => {
    const graph: DepGraph = { nodes: new Map(), edges: [] };
    const parsed: ParsedFile[] = [];
    const impactReport: ImpactReport = {
      targetNode: 'nodeA',
      changeDescription: 'desc',
      riskScore: 10,
      riskLevel: 'LOW',
      affectedNodes: [],
      breakingChanges: [],
      testingPlan: [],
      recommendations: []
    };

    writeOutput(graph, parsed, outputPath, impactReport);
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(content).toHaveProperty('impact');
    expect(content.impact).toEqual(impactReport);
  });

  it('impact field is absent when no impact report', () => {
    const graph: DepGraph = { nodes: new Map(), edges: [] };
    const parsed: ParsedFile[] = [];

    writeOutput(graph, parsed, outputPath);
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(content).not.toHaveProperty('impact');
  });

  it('totalLines is sum of all file lines', () => {
    const graph: DepGraph = { nodes: new Map(), edges: [] };
    const parsed: ParsedFile[] = [
      { filePath: 'a.js', lang: 'js', lines: 15, entities: [], imports: [], exports: [] },
      { filePath: 'b.js', lang: 'js', lines: 25, entities: [], imports: [], exports: [] }
    ];

    writeOutput(graph, parsed, outputPath);
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(content.meta.totalLines).toBe(40);
  });
});
