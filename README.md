# 📊 DepGraph Core

[![npm version](https://img.shields.io/npm/v/depgraph-core.svg)](https://www.npmjs.com/package/depgraph-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**DepGraph Core** is a powerful static analysis tool designed to map code dependencies and simulate the ripple effect/impact of changes in JavaScript and TypeScript projects. By parsing imports, exports, functions, classes, and routing definitions, DepGraph constructs a comprehensive dependency graph, computes critical centrality metrics, and generates interactive impact simulations to prevent regression bugs in large codebases.

---

## 🚀 Key Features

*   🔍 **Automated Code Parsing**: Parses JavaScript, TypeScript, React components/hooks (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`), extracting functions, classes, interfaces, types, React constructs, and Express API routes.
*   🕸️ **Dependency Graph Reconstruction**: Resolves local imports and links entities across files to construct an internal representation of your codebase topology.
*   📈 **Metrics & Centrality Analysis**: Calculates in-degree, out-degree, and centrality scores for every entity to automatically identify **Critical Nodes** (nodes that, if modified, carry high regression risks).
*   💥 **Impact Simulation Engine**: Runs a reverse Breadth-First Search (BFS) to model the cascading impact of changes to a specific function or component. Generates a risk score, details affected nodes, defines a targeted testing plan, and provides actionable engineering recommendations.
*   🖥️ **Rich CLI Interface**: Colorized and structured console feedback designed for human readability, with a `--no-color` flag optimized for CI/CD pipelines.
*   💾 **Detailed JSON Outputs**: Exports a comprehensive report containing metadata, files breakdown, graph structure, and simulation metrics.

---

## 📦 Installation

### Global Installation
Install `depgraph-core` globally via npm to run it anywhere:

```bash
npm install -g depgraph-core
```

### Run with `npx`
Alternatively, execute it directly without local installation:

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
| `--output` | `<file>` | Output path for the generated JSON report. | `./depgraph-output.json` |
| `--impact` | `<name> <desc>` | Simulate changing a specific entity. Must supply its name and a reason/description. | `N/A` |
| `--verbose` | — | Print per-file parsing and details. | `false` |
| `--no-color` | — | Disable terminal ANSI color output (recommended for CI/CD logs). | `false` |
| `--help`, `-h` | — | Display help message. | — |

### Examples

#### 1. Generate a dependency report for a project
```bash
depgraph ./src
```

#### 2. Run with custom output path
```bash
depgraph ./src --output ./reports/graph-report.json
```

#### 3. Simulate impact of modifying a critical component or helper
```bash
depgraph ./src --impact "getUserById" "adding middleName field to returned object"
```

#### 4. Run in CI Mode (silencing color output)
```bash
depgraph ./src --no-color --output ./ci/depgraph.json
```

---

## 💥 Impact Simulation Mechanics

When you simulate an impact using `--impact <name> <desc>`, the tool performs the following operations:
1. **Target Identification**: Locates the node matching the provided name.
2. **Reverse BFS Traversal**: Traverses backwards up the dependency graph up to a depth of 10 nodes to discover all direct and indirect dependents.
3. **Risk Scoring**: Calculates a score from `0` to `100` based on:
    * Number of critical-impact nodes (depth 1)
    * Number of high-impact nodes (depth 2)
    * Number of medium/low-impact nodes
    * The target node's in-degree (how many other entities import it)
4. **Risk Level Mapping**:
    *   🔴 **CRITICAL** (Score $\ge$ 75): Requires comprehensive review, phased rollouts, and global regression testing.
    *   🟡 **HIGH** (Score 50–74): Tech lead review recommended, feature flag encouraged.
    *   🔵 **MEDIUM** (Score 25–49): Standard peer code review, targeted module testing.
    *   🟢 **LOW** (Score < 25): Standard PR process is sufficient.

---

## 📁 Output JSON Schema

The tool generates a JSON report containing the following structure:

```json
{
  "meta": {
    "version": "1.0.0",
    "timestamp": "2026-07-16T02:45:52.311Z",
    "totalFiles": 25,
    "totalLines": 1968
  },
  "summary": {
    "totalNodes": 55,
    "totalEdges": 191,
    "entryPoints": [ "main__app" ],
    "leafNodes": [ "formatDate__utils" ],
    "isolatedNodes": [],
    "criticalNodes": [ "dbClient__db" ]
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
      "centralityScore": 7,
      "connections": [ "dbClient__db", "getUserRoute__userController" ]
    }
  ],
  "edges": [
    {
      "from": "getUserRoute__userController",
      "to": "getUserById__userService",
      "type": "imports",
      "description": "getUserRoute imports getUserById from userService"
    }
  ],
  "files": [
    {
      "filePath": "src/services/userService.ts",
      "lang": "js",
      "lines": 42,
      "entities": [
        { "name": "getUserById", "type": "function", "line": 15, "complexity": "low" }
      ],
      "imports": [
        { "source": "../db", "names": ["dbClient"], "isLocal": true }
      ],
      "exports": [ "getUserById" ]
    }
  ],
  "impact": {
    "targetNode": "getUserById__userService",
    "changeDescription": "adding middleName",
    "riskScore": 52,
    "riskLevel": "HIGH",
    "affectedNodes": [
      {
        "nodeId": "getUserRoute__userController",
        "name": "getUserRoute",
        "file": "src/controllers/userController.ts",
        "depth": 1,
        "impact": "critical",
        "reason": "getUserRoute directly imports getUserById",
        "changeRequired": "Update getUserRoute to handle the new interface of getUserById",
        "breakingChange": true
      }
    ],
    "breakingChanges": [...],
    "testingPlan": [
      "Test getUserById directly after making changes",
      "Regression test getUserRoute — direct dependent"
    ],
    "recommendations": [
      "Tech lead review recommended",
      "Feature flag this change",
      "1 breaking change(s) must be updated before deploying"
    ]
  }
}
```

---

## 💻 Development & Contribution

If you are developing or contributing to `depgraph-core`, follow these steps:

### Setup & Installation
Clone the repository and install development dependencies:
```bash
npm install
```

### Commands
*   **Compile TypeScript**:
    ```bash
    npm run build
    ```
*   **Create Production Bundle**:
    Bundles the application into a standalone executable file `depgraph.js` via `esbuild`:
    ```bash
    npm run bundle
    ```
*   **Rebuild Code for Release**:
    Cleans, recompiles, and bundles the source:
    ```bash
    npm run release
    ```
*   **Run Test Suite**:
    Uses `vitest` for running tests:
    ```bash
    # Watch mode
    npm run test
    
    # Run tests once (useful for CI)
    npm run test:run
    ```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
