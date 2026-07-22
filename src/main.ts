#!/usr/bin/env node

// ─── 1. IMPORTS first ────────────────────────────────────
import './languages/javascript';
import './languages/python';
import './languages/go';
import fs from 'fs';
import { collectFiles } from './stages/collector';
import { parseFiles } from './stages/parser';
import { buildGraph } from './stages/graph';
import { computeMetrics, getCriticalNodes } from './stages/metrics';
import { simulateImpact } from './stages/impact';
import { writeOutput } from './stages/output';
import { getChangedEntities } from './stages/gitdiff';

// ─── 2. PARSE ARGS second ────────────────────────────────
const args = process.argv.slice(2);
const noColor = args.includes('--no-color');
const verbose = args.includes('--verbose');

// ─── 3. COLOR HELPERS third (before any function uses them)
/**
 * Formats terminal text with ANSI escape color codes, unless colors are disabled.
 * 
 * @param text The text string to format.
 * @param code The ANSI color/style code.
 * @returns The formatted string.
 */
function color(text: string, code: string): string {
  if (noColor) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}
const dim = (t: string) => color(t, '2');
const bold = (t: string) => color(t, '1');
const green = (t: string) => color(t, '32');
const yellow = (t: string) => color(t, '33');
const red = (t: string) => color(t, '31');
const cyan = (t: string) => color(t, '36');

// ─── 4. ALL OTHER HELPERS fourth ─────────────────────────

/**
 * Retrieves the value of a command line option/flag if it exists.
 * Expects the value to be the next direct argument.
 * 
 * @param flag The option flag string (e.g. "--output").
 * @returns The option value if present, otherwise undefined.
 */
function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

/**
 * Prints the CLI usage description, supported options, and command examples to the stdout.
 */
function printHelp(): void {
  console.log(`
${bold('DepGraph')} ${dim('v1.0.2')}
${dim('Dependency mapping · Impact simulation · Developer intelligence')}

${bold('USAGE')}
  depgraph ${cyan('<projectDir>')} ${dim('[options]')}

${bold('OPTIONS')}
  ${cyan('--output')}  ${dim('<file>')}        Output path  ${dim('(default: ./depgraph-output.json)')}
  ${cyan('--impact')}  ${dim('<name> <desc>')} Simulate changing a node
  ${cyan('--verbose')}                Show per-file parsing details
  ${cyan('--no-color')}               Disable colors ${dim('(for CI)')}
  ${cyan('--help, -h')}               Show this help message

${bold('GIT FLAGS')}
  ${cyan('--git-impact')}              Auto-detect changes from git diff
  ${cyan('--commit')}  ${dim('<sha>')}          Analyze a specific commit
  ${cyan('--from')}    ${dim('<branch>')}        Compare from this branch
  ${cyan('--to')}      ${dim('<branch>')}        Compare to this branch

${bold('EXAMPLES')}
  ${dim('# Map a project')}
  depgraph ./my-app

  ${dim('# Map with custom output')}
  depgraph ./my-app --output ./reports/graph.json

  ${dim('# Simulate a change')}
  depgraph ./my-app --impact "getUserById" "removing userId param"

  ${dim('# CI mode')}
  depgraph ./src --no-color --output ./ci/depgraph.json

${bold('GIT EXAMPLES')}
  ${dim('# Analyze uncommitted changes')}
  depgraph ./src --git-impact

  ${dim('# Analyze last commit')}
  depgraph ./src --git-impact --commit HEAD

  ${dim('# Compare two branches')}
  depgraph ./src --git-impact --from main --to feature/my-branch

  ${dim('# Specific commit')}
  depgraph ./src --git-impact --commit abc1234
`);
}

/**
 * Prints a decorated startup banner to the console.
 */
function printBanner(): void {
  console.log(`
${bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
${bold('  DepGraph')}  ${dim('v1.0.0')}
${bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
`);
}

/**
 * Prints a summary table of the compiled dependency graph.
 * 
 * @param fileCount The total count of scanned files.
 * @param nodeCount The total count of resolved nodes.
 * @param edgeCount The total count of dependency edges.
 * @param criticalNodes An array of critical node identifiers.
 */
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

/**
 * Prints the results table of an impact simulation run.
 * 
 * @param impact The computed impact report object.
 */
function printImpact(impact: ReturnType<typeof simulateImpact>): void {
  const levelColor = impact.riskLevel === 'CRITICAL' ? red
    : impact.riskLevel === 'HIGH' ? yellow
      : impact.riskLevel === 'MEDIUM' ? cyan
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
        : node.impact === 'high' ? yellow
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
const outputPath   = getFlag('--output')  ?? './depgraph-output.json';
const impactTarget = getFlag('--impact');
const impactDesc   = impactTarget
  ? (args[args.indexOf('--impact') + 2] ?? 'no description provided')
  : undefined;

// ── git flags ────────────────────────────────────────────
const gitImpact = args.includes('--git-impact');
const gitCommit = getFlag('--commit');
const gitFrom   = getFlag('--from');
const gitTo     = getFlag('--to');

// determine git mode
const gitMode = (gitFrom && gitTo)
  ? 'branches'
  : gitCommit
    ? 'last-commit'
    : 'uncommitted';

printBanner();
console.log(`${bold('🔍 Scanning')} ${cyan(projectDir)}\n`);

if (!fs.existsSync(projectDir)) {
  console.error(red(`✗ Directory not found: ${projectDir}`));
  process.exit(1);
}

try {
  const files = collectFiles(projectDir);
  if (verbose) {
    files.forEach(f => console.log(dim(`  ${f}`)));
  }

  const parsed = parseFiles(files);
  if (verbose) {
    parsed.forEach(f => console.log(dim(`  parsed: ${f.filePath} → ${f.entities.length} entities`)));
  }

  const graph = buildGraph(parsed);
  const metrics = computeMetrics(graph);

  printSummary(files.length, metrics.nodes.size, metrics.edges.length, getCriticalNodes(metrics));

  // ─── impact simulation ──────────────────────────────────

  let impact = undefined;

  if (impactTarget) {
    // manual mode — user specified the function name directly
    impact = simulateImpact(metrics, impactTarget, impactDesc ?? '');
    printImpact(impact);

  } else if (gitImpact) {
    // git mode — auto-detect changed entities from diff
    console.log(`\n${bold('🔍 Reading git diff...')}`);

    const changed = getChangedEntities({
      projectDir,
      mode:   gitMode as 'uncommitted' | 'last-commit' | 'branches',
      commit: gitCommit,
      from:   gitFrom,
      to:     gitTo,
    });

    if (changed.length === 0) {
      console.log(`\n${green('✓')} No changed entities found in diff`);
    } else {
      console.log(`\n${bold(`Found ${changed.length} changed entity(s):`)}`);
      for (const entity of changed) {
        console.log(`   ${dim('→')} ${entity.name}  ${dim(`(${entity.file})`)}`);
      }

      // run impact simulation for each changed entity
      console.log(`\n${bold('Running impact simulation...')}`);

      for (const entity of changed) {
        console.log(`\n${dim('─'.repeat(42))}`);
        const result = simulateImpact(
          metrics,
          entity.name,
          entity.description,
        );
        printImpact(result);
      }
    }
  }

  writeOutput(metrics, parsed, outputPath, impact);

} catch (err) {
  console.error(red(`\n✗ Error: ${(err as Error).message}`));
  process.exit(1);
}