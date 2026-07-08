// src/types.ts
// All data shapes for the compiler

export interface RawEntity {
  name: string;
  type: string;
  line: number;
  complexity: string;
}

export interface RawImport {
  source: string;
  names: string[];
  isLocal: boolean;
}

export interface ParsedFile {
  filePath: string;
  lang: string;
  lines: number;
  entities: RawEntity[];
  imports: RawImport[];
  exports: string[];
}

export interface DepNode {
  id: string;
  name: string;
  type: string;
  file: string;
  line: number;
  lang: string;
  complexity: string;
  inDegree: number;
  outDegree: number;
  centralityScore: number;
  connections: string[];
  extends?: string;
  method?: string;
  route?: string;
}

export interface DepEdge {
  from: string;
  to: string;
  type: string;
  description: string;
}

export interface DepGraph {
  nodes: Map<string, DepNode>;
  edges: DepEdge[];
}

export interface AffectedNode {
  nodeId: string;
  name: string;
  file: string;
  depth: number;
  impact: string;
  reason: string;
  changeRequired: string;
  breakingChange: boolean;
}

export interface ImpactReport {
  targetNode: string;
  changeDescription: string;
  riskScore: number;
  riskLevel: string;
  affectedNodes: AffectedNode[];
  breakingChanges: AffectedNode[];
  testingPlan: string[];
  recommendations: string[];
}

export interface OutputJSON {
  meta: {
    version: string;
    timestamp: string;
    totalFiles: number;
    totalLines: number;
  };
  summary: {
    totalNodes: number;
    totalEdges: number;
    entryPoints: string[];
    leafNodes: string[];
    isolatedNodes: string[];
    criticalNodes: string[];
  };
  nodes: DepNode[];
  edges: DepEdge[];
  files: ParsedFile[];
  impact?: ImpactReport;
}