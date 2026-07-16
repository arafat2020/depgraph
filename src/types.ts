// src/types.ts
// All data shapes for the compiler

/**
 * Represents a code entity (e.g., function, class, type, API endpoint)
 * extracted directly from the raw source code of a file before reference resolution.
 */
export interface RawEntity {
  /** The name or identifier of the entity (e.g. "getUserById", "GET /api/users"). */
  name: string;
  /** The categorization of the entity (e.g. "function", "component", "class", "api"). */
  type: string;
  /** The 1-indexed line number in the source file where this entity begins. */
  line: number;
  /** The estimated complexity rating ("low", "medium", "high"). */
  complexity: string;
}

/**
 * Represents an import statement extracted from a source file.
 */
export interface RawImport {
  /** The import path source string (e.g., "./userService", "express"). */
  source: string;
  /** The list of imported entity names or identifiers. */
  names: string[];
  /** True if the import points to a local file/module, false if it's an external library package. */
  isLocal: boolean;
}

/**
 * Contains metadata and entities parsed from an individual source file.
 */
export interface ParsedFile {
  /** The absolute or relative path to the parsed file on disk. */
  filePath: string;
  /** The identifier for the file's language (e.g., "js"). */
  lang: string;
  /** The total line count of the source file. */
  lines: number;
  /** A collection of all raw code entities found inside the file. */
  entities: RawEntity[];
  /** A collection of all import statements found inside the file. */
  imports: RawImport[];
  /** A collection of all exported entity names found inside the file. */
  exports: string[];
}

/**
 * Represents a resolved entity node within the dependency graph.
 */
export interface DepNode {
  /** The unique identifier of the node (usually composite, e.g., "entityName__fileName"). */
  id: string;
  /** The name or identifier of the entity. */
  name: string;
  /** The category of the entity (e.g., "function", "class", "interface"). */
  type: string;
  /** The path to the file containing this node. */
  file: string;
  /** The line number where this node starts in the source file. */
  line: number;
  /** The language of the file (e.g., "js"). */
  lang: string;
  /** The estimated code complexity rating ("low", "medium", "high"). */
  complexity: string;
  /** The number of incoming dependencies (how many other entities import or use this node). */
  inDegree: number;
  /** The number of outgoing dependencies (how many other entities this node imports or uses). */
  outDegree: number;
  /** The computed centrality score, representing the risk severity of changing this node. */
  centralityScore: number;
  /** The IDs of other nodes directly connected to this node in either direction. */
  connections: string[];
  /** Optional parent class or interface extended by this node. */
  extends?: string;
  /** Optional HTTP method if this node represents an API route. */
  method?: string;
  /** Optional route path string if this node represents an API route. */
  route?: string;
}

/**
 * Represents a directed link/edge between two nodes in the dependency graph.
 */
export interface DepEdge {
  /** The source node ID of the dependency (the dependent entity). */
  from: string;
  /** The target node ID of the dependency (the dependency entity). */
  to: string;
  /** The type of relationship between the nodes (e.g., "imports"). */
  type: string;
  /** A human-readable description describing the dependency link. */
  description: string;
}

/**
 * Represents the complete dependency graph consisting of resolved nodes and edges.
 */
export interface DepGraph {
  /** A map of unique node IDs to their resolved dependency node structures. */
  nodes: Map<string, DepNode>;
  /** An array of all dependency edges linking the nodes together. */
  edges: DepEdge[];
}

/**
 * Details a node that is impacted by changes made to a targeted node.
 */
export interface AffectedNode {
  /** The unique identifier of the affected node. */
  nodeId: string;
  /** The name of the affected entity. */
  name: string;
  /** The file path where this entity is located. */
  file: string;
  /** The traversal depth (shortest path distance) from the target change node. */
  depth: number;
  /** The impact category ("critical", "high", "medium", "low"). */
  impact: string;
  /** The human-readable explanation of why this node is affected. */
  reason: string;
  /** A description of the actions required to update this node. */
  changeRequired: string;
  /** Indicates whether the modification is likely a breaking change for this node. */
  breakingChange: boolean;
}

/**
 * The final simulation report generated when analyzing the impact of modifying a node.
 */
export interface ImpactReport {
  /** The node ID that is the target of the simulated change. */
  targetNode: string;
  /** A description of the proposed change details. */
  changeDescription: string;
  /** The calculated impact risk score (ranging from 0 to 100). */
  riskScore: number;
  /** The overall threat level classification ("LOW", "MEDIUM", "HIGH", "CRITICAL"). */
  riskLevel: string;
  /** A list of all downstream nodes affected by the change. */
  affectedNodes: AffectedNode[];
  /** A sub-collection of affected nodes that face a breaking change risk. */
  breakingChanges: AffectedNode[];
  /** Recommended testing strategies and specific regression test candidates. */
  testingPlan: string[];
  /** Actionable recommendations for the development and review process. */
  recommendations: string[];
}

/**
 * The full schema of the JSON report exported by DepGraph Core.
 */
export interface OutputJSON {
  /** Execution and scanning metadata. */
  meta: {
    /** The version of the DepGraph tool that generated this output. */
    version: string;
    /** The ISO timestamp of when the report was compiled. */
    timestamp: string;
    /** Total number of files successfully scanned. */
    totalFiles: number;
    /** Total cumulative lines of code parsed across all files. */
    totalLines: number;
  };
  /** Graph summaries and aggregated lists of node properties. */
  summary: {
    /** Total count of nodes in the resolved graph. */
    totalNodes: number;
    /** Total count of links/edges in the resolved graph. */
    totalEdges: number;
    /** List of root-level entry point node IDs (nodes with inDegree = 0, outDegree > 0). */
    entryPoints: string[];
    /** List of leaf node IDs (nodes with outDegree = 0, inDegree > 0). */
    leafNodes: string[];
    /** List of orphaned or dead code candidate node IDs (nodes with no dependencies). */
    isolatedNodes: string[];
    /** List of node IDs classified as highly critical (centrality score > 20). */
    criticalNodes: string[];
  };
  /** The full array of resolved nodes in the dependency graph. */
  nodes: DepNode[];
  /** The full array of dependency edges in the graph. */
  edges: DepEdge[];
  /** Detailed information about each parsed source file. */
  files: ParsedFile[];
  /** The optional simulation report, included only when an impact target is provided. */
  impact?: ImpactReport;
}