// ─── types for graphify extractor ────────────────────────

export interface RustGraphNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string;
  source_location: string;
  origin_file?: string;
}

export interface RustGraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: string;
  source_file: string;
  source_location: string;
  weight: number;
  context?: string;
}

export interface RustRawCall {
  caller_nid: string;
  callee: string;
  is_member_call: boolean;
  source_file: string;
  source_location: string;
}

export interface RustGraphResult {
  nodes: RustGraphNode[];
  edges: RustGraphEdge[];
  raw_calls: RustRawCall[];
  error?: string;
}
