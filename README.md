# 📊 DepGraph Core

[![npm version](https://img.shields.io/npm/v/depgraph-core.svg)](https://www.npmjs.com/package/depgraph-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**DepGraph Core** is a powerful static analysis CLI that maps code dependencies and simulates the ripple-effect impact of changes in JavaScript, TypeScript, Python, and Go projects. By parsing imports, exports, functions, and classes, DepGraph constructs a comprehensive dependency graph, computes centrality metrics, and generates impact simulations — helping you prevent regression bugs in large codebases.

---

## 🚀 Key Features

- 🔍 **Automated Code Parsing**: Supports JS, TS, React (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`), Python (`.py`), and Go (`.go`) — extracting functions, classes, interfaces, types, React hooks/components, and Express routes.
- 🕸️ **Dependency Graph Reconstruction**: Resolves local imports and links entities across files to build a full topology map of your codebase.
- 📈 **Metrics & Centrality Analysis**: Calculates in-degree, out-degree, and centrality scores for every entity to automatically identify **Critical Nodes**.
- 💥 **Impact Simulation Engine**: Runs a reverse BFS to model the cascading impact of changing a specific function or class. Generates a risk score, lists affected nodes, and provides an actionable testing plan.
- 🧬 **Git Diff Integration**: Automatically detects changed entities from your git history (uncommitted changes, a specific commit, or a branch comparison) and runs impact simulation on every changed function — no manual target needed.
- 🖥️ **Rich CLI Interface**: Colorized, human-readable output with a `--no-color` flag for CI/CD pipelines.
- 💾 **Detailed JSON Output**: Exports a comprehensive report containing graph structure, metrics, and simulation results.

---

## 📦 Installation

### Global (recommended)
```bash
npm install -g depgraph-core
```

### Via `npx` (no install required)
```bash
npx depgraph-core <projectDir> [options]
```

---

## 🛠️ CLI Usage

```bash
depgraph <projectDir> [options]
```

### Options

| Flag | Parameter | Description | Default |
| :--- | :--- | :--- | :--- |
| `--output` | `<file>` | Output path for the generated JSON report | `./depgraph-output.json` |
| `--impact` | `<name> <desc>` | Manually simulate changing a specific entity | — |
| `--verbose` | — | Print per-file parsing details | `false` |
| `--no-color` | — | Disable ANSI color output (for CI/CD) | `false` |
| `--help`, `-h` | — | Show help message | — |

### Git Flags

| Flag | Parameter | Description |
| :--- | :--- | :--- |
| `--git-impact` | — | Auto-detect changed entities from git diff and run impact simulation |
| `--commit` | `<sha>` | Analyze a specific commit (vs its parent) |
| `--from` | `<branch>` | Compare from this branch (use with `--to`) |
| `--to` | `<branch>` | Compare to this branch (use with `--from`) |

---

## 📖 Examples

### Standard Usage

#### Map a project
```bash
depgraph ./src
```

#### Custom output path
```bash
depgraph ./src --output ./reports/graph-report.json
```

#### Manually simulate a change
```bash
depgraph ./src --impact "getUserById" "adding middleName field to returned object"
```

#### CI mode
```bash
depgraph ./src --no-color --output ./ci/depgraph.json
```

---

### 🧬 Git Diff Integration

`--git-impact` automatically reads your git diff, detects every function or class that changed, and runs an impact simulation for each one — no need to manually select a target entity.

#### ⚙️ How It Works under the Hood

1. **Git Diff Execution**: Runs the appropriate git command depending on the mode:
   - **Uncommitted Changes**: `git diff HEAD` (detects staged & unstaged changes).
   - **Last Commit (or Specific Commit)**: `git diff <commit>~1 <commit>` (compares the target commit against its parent).
   - **Branch Comparison**: `git diff <from>...<to>` (finds the merge base and diffs to the target branch).
2. **Context Parsing**: Scans git diff context lines (headers starting with `@@`) to extract target entities.
3. **No Regex Duplication**: Reuses the regex patterns defined in the language parsers (`jsEntityPatterns`, `pyEntityPatterns`, `goEntityPatterns`) via the language registry.
4. **Fallback Parsers**: Contains built-in fallback parser logic for popular OOP languages like Java (`.java`) and C# (`.cs`) to extract method signatures.
5. **Change Description Generation**: Automatically analyzes added/removed lines in the change hunk to build descriptive labels (e.g. `getUserById: 3 line(s) changed to 2 new line(s)`).

#### 📋 Git Commands Reference

| Mode | CLI Command | Under-the-hood Command | Description |
| :--- | :--- | :--- | :--- |
| **Uncommitted Changes** | `depgraph ./src --git-impact` | `git diff HEAD` | Analyze your current workspace changes |
| **Last Commit** | `depgraph ./src --git-impact --commit HEAD` | `git diff HEAD~1 HEAD` | Analyze the last commit |
| **Specific Commit** | `depgraph ./src --git-impact --commit <sha>` | `git diff <sha>~1 <sha>` | Analyze any commit by its SHA |
| **Branch Comparison** | `depgraph ./src --git-impact --from main --to feature/auth` | `git diff main...feature/auth` | Compare two branches |

#### 🖥️ CLI Output Example

Running `--git-impact` displays a colorized report of detected entities and runs an impact simulation for each one:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DepGraph  v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Scanning .

📊 Graph Summary
   Files  : 27
   Nodes  : 76
   Edges  : 252

🔍 Reading git diff...

Found 2 changed entity(s):
   → slugify  (src/languages/javascript.ts)
   → LanguageParser  (src/languages/registry.ts)

Running impact simulation...

──────────────────────────────────────────

💥 Impact Simulation
   Target      : slugify__javascript
   Change      : slugify: 16 line(s) added
   Risk Score  : 0
   Risk Level  : LOW

   ✓ No affected nodes found

🧪 Testing Plan
   → Test slugify directly after making changes

💡 Recommendations
   → Standard PR process is sufficient
   → Unit tests for the changed node are enough

──────────────────────────────────────────

💥 Impact Simulation
   Target      : LanguageParser__registry
   Change      : LanguageParser: 6 line(s) added
   Risk Score  : 100
   Risk Level  : CRITICAL

📋 Affected Nodes (3)

   [CRITICAL] extractEntities
   file    : src/languages/go.ts
   reason  : extractEntities directly imports LanguageParser
   action  : Update extractEntities to handle the new interface of LanguageParser
   breaking: YES

   [CRITICAL] extractImports
   file    : src/languages/go.ts
   reason  : extractImports directly imports LanguageParser
   action  : Update extractImports to handle the new interface of LanguageParser
   breaking: YES

   [CRITICAL] extractExports
   file    : src/languages/go.ts
   reason  : extractExports directly imports LanguageParser
   action  : Update extractExports to handle the new interface of LanguageParser
   breaking: YES

🧪 Testing Plan
   → Test LanguageParser directly after making changes
   → Regression test extractEntities — direct dependent
   → Regression test extractImports — direct dependent
   → Regression test extractExports — direct dependent
   → Run full test suite — 3 nodes affected

💡 Recommendations
   → Full team review required before merging
   → Consider a phased rollout
   → Run full regression test suite
   → 3 breaking change(s) must be updated before deploying

✅ Output written to ./depgraph-output.json
```

**Supported languages for diff parsing:** JavaScript/TypeScript, Python, Go. Java and C# method signatures are handled via a built-in fallback.

---

## 💥 Impact Simulation Mechanics

When running `--impact` or `--git-impact`, the tool performs:

1. **Target Identification**: Locates the node matching the provided name.
2. **Reverse BFS Traversal**: Traverses backwards up the dependency graph (up to depth 10) to find all direct and indirect dependents.
3. **Risk Scoring**: Calculates a score from `0–100` based on:
   - Number of critical-impact nodes (depth 1)
   - Number of high-impact nodes (depth 2)
   - Number of medium/low-impact nodes
   - The target node's in-degree
4. **Risk Level Mapping**:
   - 🔴 **CRITICAL** (≥ 75): Comprehensive review, phased rollout, full regression testing.
   - 🟡 **HIGH** (50–74): Tech lead review, feature flag recommended.
   - 🔵 **MEDIUM** (25–49): Standard peer review, targeted module testing.
   - 🟢 **LOW** (< 25): Standard PR process is sufficient.

---

## 📁 Output JSON Schema

```json
{
  "meta": {
    "version": "1.0.2",
    "timestamp": "2026-07-20T05:14:00.000Z",
    "totalFiles": 26,
    "totalLines": 2957
  },
  "summary": {
    "totalNodes": 70,
    "totalEdges": 252,
    "criticalNodes": ["simulateImpact__impact", "buildGraph__graph"]
  },
  "nodes": [
    {
      "id": "getUserById__userService",
      "name": "getUserById",
      "type": "function",
      "file": "src/services/userService.ts",
      "line": 15,
      "lang": "js",
      "complexity": "low",
      "inDegree": 3,
      "outDegree": 1,
      "centralityScore": 7
    }
  ],
  "edges": [
    {
      "from": "getUserRoute__userController",
      "to": "getUserById__userService",
      "type": "imports"
    }
  ],
  "impact": {
    "targetNode": "getUserById__userService",
    "changeDescription": "adding middleName",
    "riskScore": 52,
    "riskLevel": "HIGH",
    "affectedNodes": [
      {
        "name": "getUserRoute",
        "file": "src/controllers/userController.ts",
        "depth": 1,
        "impact": "critical",
        "breakingChange": true
      }
    ],
    "testingPlan": ["Test getUserById directly", "Regression test getUserRoute"],
    "recommendations": ["Tech lead review recommended", "Feature flag this change"]
  }
}
```

---

## 💻 Development & Contribution

### Setup
```bash
git clone https://github.com/arafat2020/depgraph.git
cd depgraph
npm install
```

### Commands

| Command | Description |
| :--- | :--- |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run bundle` | Bundle `dist/main.js` → `depgraph.js` via esbuild |
| `npm run release` | Build + bundle in one step |
| `npm run test` | Run tests in watch mode (vitest) |
| `npm run test:run` | Run tests once (for CI) |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
