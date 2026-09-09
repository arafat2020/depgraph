// ─── types for graphify extractor ────────────────────────

export interface RubyGraphNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string | null;
  source_location: string | null;
}

export interface RubyGraphEdge {
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

export interface RubyGraphResult {
  nodes: RubyGraphNode[];
  edges: RubyGraphEdge[];
  error?: string;
}
