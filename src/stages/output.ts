import fs from 'fs';
import path from 'path';
import { DepGraph, ParsedFile, ImpactReport, OutputJSON } from '../types';
import {
  getEntryPoints,
  getLeafNodes,
  getIsolatedNodes,
  getCriticalNodes
} from './metrics';

/**
 * Formats, compiles, and writes the complete dependency report to the specified file path.
 * Prepares the JSON payload containing metadata summaries, resolved nodes, edges, file information,
 * and the optional simulation report.
 * 
 * @param graph The computed dependency graph.
 * @param parsed The list of all parsed files.
 * @param outputPath The file path where the JSON output should be saved.
 * @param impact The optional impact simulation report.
 */
export function writeOutput(
  graph:      DepGraph,
  parsed:     ParsedFile[],
  outputPath: string,
  impact?:    ImpactReport,
): void {

  // ─── STEP 1 — build the summary ─────────────────────────

  const totalLines = parsed.reduce((sum, f) => sum + f.lines, 0);

  const summary = {
    totalNodes:    graph.nodes.size,
    totalEdges:    graph.edges.length,
    entryPoints:   getEntryPoints(graph),
    leafNodes:     getLeafNodes(graph),
    isolatedNodes: getIsolatedNodes(graph),
    criticalNodes: getCriticalNodes(graph),
  };

  // ─── STEP 2 — assemble the full output ──────────────────

  const output: OutputJSON = {
    meta: {
      version:    '1.0.0',
      timestamp:  new Date().toISOString(),
      totalFiles: parsed.length,
      totalLines,
    },
    summary,
    nodes:  [...graph.nodes.values()],  // Map → Array
    edges:  graph.edges,
    files:  parsed,
    impact,                             // optional, only if --impact was used
  };

  // ─── STEP 3 — write to disk ─────────────────────────────

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, null, 2),  // 2 = pretty print with 2 spaces
    'utf-8'
  );

  // ─── STEP 4 — print confirmation ────────────────────────

  console.log(`\n✅ Output written to ${outputPath}`);
  console.log(`   ${output.meta.totalFiles} files`);
  console.log(`   ${summary.totalNodes} nodes`);
  console.log(`   ${summary.totalEdges} edges`);
  console.log(`   ${totalLines} total lines of code`);

  if (impact) {
    console.log(`\n💥 Impact Report included`);
    console.log(`   Target     : ${impact.targetNode}`);
    console.log(`   Risk Level : ${impact.riskLevel}`);
    console.log(`   Risk Score : ${impact.riskScore}`);
    console.log(`   Affected   : ${impact.affectedNodes.length} nodes`);
  }
}