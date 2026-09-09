// ─── types for graphify extractor ────────────────────────

export interface DartGraphNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string | null;
  source_location: string | null;
}

export interface DartGraphEdge {
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

export interface DartGraphResult {
  nodes: DartGraphNode[];
  edges: DartGraphEdge[];
  error?: string;
}
