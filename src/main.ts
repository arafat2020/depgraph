// ─── 1. IMPORTS first ────────────────────────────────────
import './languages/javascript';
import fs from 'fs';
import { collectFiles }  from './stages/collector';
import { parseFiles }    from './stages/parser';
import { buildGraph }    from './stages/graph';
import { computeMetrics, getCriticalNodes } from './stages/metrics';
import { simulateImpact } from './stages/impact';
import { writeOutput }   from './stages/output';

// ─── 2. PARSE ARGS second ────────────────────────────────
const args          = process.argv.slice(2);
const noColor       = args.includes('--no-color');
const verbose       = args.includes('--verbose');

// ─── 3. COLOR HELPERS third (before any function uses them)
function color(text: string, code: string): string {
  if (noColor) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}
const dim    = (t: string) => color(t, '2');
const bold   = (t: string) => color(t, '1');
const green  = (t: string) => color(t, '32');
const yellow = (t: string) => color(t, '33');
const red    = (t: string) => color(t, '31');
const cyan   = (t: string) => color(t, '36');

// ─── 4. ALL OTHER HELPERS fourth ─────────────────────────
function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function printHelp(): void {
  console.log(`
${bold('DepGraph Compiler')} ${dim('v1.0.0')}
${dim('Dependency mapping · Impact simulation · Developer intelligence')}

${bold('USAGE')}
  node depgraph.js ${cyan('<projectDir>')} ${dim('[options]')}

${bold('OPTIONS')}
  ${cyan('--output')}  ${dim('<file>')}        Output path  ${dim('(default: ./depgraph-output.json)')}
  ${cyan('--impact')}  ${dim('<name> <desc>')} Simulate changing a node
  ${cyan('--verbose')}                Show per-file parsing details
  ${cyan('--no-color')}               Disable colors ${dim('(for CI)')}
  ${cyan('--help, -h')}               Show this help message

${bold('EXAMPLES')}
  ${dim('# Map a project')}
  node depgraph.js ./my-app

  ${dim('# Map with custom output')}
  node depgraph.js ./my-app --output ./reports/graph.json

  ${dim('# Simulate a change')}
  node depgraph.js ./my-app --impact "getUserById" "removing userId param"

  ${dim('# CI mode')}
  node depgraph.js ./src --no-color --output ./ci/depgraph.json
`);
}

function printBanner(): void {
  console.log(`
${bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
${bold('  DepGraph Compiler')}  ${dim('v1.0.0')}
${bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
`);
}

function printSummary(
  fileCount: number,
  nodeCount: number,
  edgeCount: number,
  criticalNodes: string[]
): void {
  console.log(bold('📊 Graph Summary'));
  console.log(`   ${dim('Files  :')} ${green(String(fileCount))}`);
  console.log(`   ${dim('Nodes  :')} ${green(String(nodeCount))}`);
  console.log(`   ${dim('Edges  :')} ${green(String(edgeCount))}`);

  if (criticalNodes.length > 0) {
    console.log(`\n${bold('🔴 Critical Nodes')} ${dim('(change carefully)')}`);
    for (const id of criticalNodes) {
      console.log(`   ${red('●')} ${id}`);
    }
  }
}

function printImpact(impact: ReturnType<typeof simulateImpact>): void {
  const levelColor = impact.riskLevel === 'CRITICAL' ? red
    : impact.riskLevel === 'HIGH'     ? yellow
    : impact.riskLevel === 'MEDIUM'   ? cyan
    : green;

  console.log(`\n${bold('💥 Impact Simulation')}`);
  console.log(`   ${dim('Target      :')} ${bold(impact.targetNode)}`);
  console.log(`   ${dim('Change      :')} ${impact.changeDescription}`);
  console.log(`   ${dim('Risk Score  :')} ${levelColor(String(impact.riskScore))}`);
  console.log(`   ${dim('Risk Level  :')} ${bold(levelColor(impact.riskLevel))}`);

  if (impact.affectedNodes.length === 0) {
    console.log(`\n   ${green('✓')} No affected nodes found`);
  } else {
    console.log(`\n${bold(`📋 Affected Nodes (${impact.affectedNodes.length})`)}`);
    for (const node of impact.affectedNodes) {
      const impColor = node.impact === 'critical' ? red
        : node.impact === 'high'   ? yellow
        : node.impact === 'medium' ? cyan
        : green;

      console.log(`\n   ${impColor(`[${node.impact.toUpperCase().padEnd(8)}]`)} ${bold(node.name)}`);
      console.log(`   ${dim('file    :')} ${node.file}`);
      console.log(`   ${dim('reason  :')} ${node.reason}`);
      console.log(`   ${dim('action  :')} ${node.changeRequired}`);
      console.log(`   ${dim('breaking:')} ${node.breakingChange ? red('YES') : green('no')}`);
    }
  }

  console.log(`\n${bold('🧪 Testing Plan')}`);
  for (const item of impact.testingPlan) {
    console.log(`   ${dim('→')} ${item}`);
  }

  console.log(`\n${bold('💡 Recommendations')}`);
  for (const rec of impact.recommendations) {
    console.log(`   ${dim('→')} ${rec}`);
  }
}

// ─── 5. ENTRY POINT last ─────────────────────────────────

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const projectDir   = args[0];
const outputPath   = getFlag('--output') ?? './depgraph-output.json';
const impactTarget = getFlag('--impact');
const impactDesc   = impactTarget
  ? (args[args.indexOf('--impact') + 2] ?? 'no description provided')
  : undefined;

printBanner();
console.log(`${bold('🔍 Scanning')} ${cyan(projectDir)}\n`);

if (!fs.existsSync(projectDir)) {
  console.error(red(`✗ Directory not found: ${projectDir}`));
  process.exit(1);
}

try {
  const files   = collectFiles(projectDir);
  if (verbose) {
    files.forEach(f => console.log(dim(`  ${f}`)));
  }

  const parsed  = parseFiles(files);
  if (verbose) {
    parsed.forEach(f => console.log(dim(`  parsed: ${f.filePath} → ${f.entities.length} entities`)));
  }

  const graph   = buildGraph(parsed);
  const metrics = computeMetrics(graph);

  printSummary(files.length, metrics.nodes.size, metrics.edges.length, getCriticalNodes(metrics));

  let impact = undefined;
  if (impactTarget) {
    impact = simulateImpact(metrics, impactTarget, impactDesc ?? '');
    printImpact(impact);
  }

  writeOutput(metrics, parsed, outputPath, impact);

} catch (err) {
  console.error(red(`\n✗ Error: ${(err as Error).message}`));
  process.exit(1);
}