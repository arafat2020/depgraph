// ─── types for graphify extractor ────────────────────────

export interface SwiftGraphNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string | null;
  source_location: string | null;
}

export interface SwiftGraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: string;
  confidence_score: number;
  source_file: string;
  source_location: string | null;
  weight: number;
  context?: string;
}

export interface SwiftGraphResult {
  nodes: SwiftGraphNode[];
  edges: SwiftGraphEdge[];
  error?: string;
}
