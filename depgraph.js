#!/usr/bin/env node
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// dist/languages/registry.js
var require_registry = __commonJS({
  "dist/languages/registry.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.registerParser = registerParser;
    exports2.getLanguageParser = getLanguageParser;
    var parsers = [];
    function registerParser(parser) {
      parsers.push(parser);
    }
    function getLanguageParser(ext) {
      return parsers.find((p) => p.extensions.includes(ext)) ?? null;
    }
  }
});

// dist/constants.js
var require_constants = __commonJS({
  "dist/constants.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.COMPLEXITY_THRESHOLDS = exports2.MAX_BFS_DEPTH = exports2.MAX_FILE_SIZE = exports2.SUPPORTED_EXTS = exports2.IGNORE_DIRS = exports2.VERSION = void 0;
    exports2.VERSION = "1.0.0";
    exports2.IGNORE_DIRS = /* @__PURE__ */ new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "__pycache__",
      "vendor",
      "venv",
      "target",
      "out",
      "coverage",
      ".cache"
    ]);
    exports2.SUPPORTED_EXTS = /* @__PURE__ */ new Set([
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".py",
      ".go",
      ".java",
      ".cs",
      ".rb",
      ".php",
      ".swift",
      ".kt",
      ".vue",
      ".svelte"
    ]);
    exports2.MAX_FILE_SIZE = 3e5;
    exports2.MAX_BFS_DEPTH = 10;
    exports2.COMPLEXITY_THRESHOLDS = {
      /** Complexity score is "low" if there are 3 or fewer branch points. */
      low: 3,
      /** Complexity score is "medium" if there are between 4 and 8 branch points. */
      medium: 8,
      /** Complexity score is "high" if there are 9 or more branch points. */
      high: Infinity
    };
  }
});

// dist/languages/javascript.js
var require_javascript = __commonJS({
  "dist/languages/javascript.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function estimateComplexity(code, name) {
      const bodyMatch = code.match(new RegExp(`function\\s+${name}[^{]*{([\\s\\S]*?)
}`, "m"));
      if (!bodyMatch)
        return "low";
      const body = bodyMatch[1];
      const branches = (body.match(/\b(if|else|for|while|switch|catch|&&|\|\|)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    function extractEntities(code, filePath) {
      const entities = [];
      const lines = code.split("\n");
      const patterns = [
        // React components (PascalCase arrow functions)
        {
          regex: /^(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/gm,
          type: "component"
        },
        // React hooks (camelCase starting with "use")
        {
          regex: /^(?:export\s+)?(?:const\s+)?(use[A-Z]\w+)\s*=/gm,
          type: "hook"
        },
        // regular functions
        {
          regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
          type: "function"
        },
        // arrow functions assigned to const
        {
          regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
          type: "function"
        },
        // classes
        {
          regex: /^(?:export\s+)?(?:default\s+)?class\s+(\w+)/gm,
          type: "class"
        },
        // TypeScript interfaces
        {
          regex: /^(?:export\s+)?interface\s+(\w+)/gm,
          type: "interface"
        },
        // TypeScript types
        {
          regex: /^(?:export\s+)?type\s+(\w+)\s*=/gm,
          type: "type"
        },
        // Express routes
        {
          regex: /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gm,
          type: "api"
        }
      ];
      for (const { regex, type } of patterns) {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(code)) !== null) {
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (type === "api") {
            entities.push({
              name: `${match[1].toUpperCase()} ${match[2]}`,
              type: "api",
              line,
              complexity: "low"
            });
          } else {
            const name = match[1];
            if (entities.some((e) => e.name === name))
              continue;
            entities.push({
              name,
              type,
              line,
              complexity: estimateComplexity(code, name)
            });
          }
        }
      }
      return entities;
    }
    function extractImports(code) {
      const imports = [];
      const namedPattern = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
      let match;
      while ((match = namedPattern.exec(code)) !== null) {
        const names = match[1].split(",").map((n) => n.trim().replace(/\s+as\s+\w+/, ""));
        const source = match[2];
        imports.push({
          source,
          names,
          isLocal: source.startsWith(".")
        });
      }
      const defaultPattern = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm;
      while ((match = defaultPattern.exec(code)) !== null) {
        imports.push({
          source: match[2],
          names: [match[1]],
          isLocal: match[2].startsWith(".")
        });
      }
      const requirePattern = /(?:const|let|var)\s+\{?([^}=]+)\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
      while ((match = requirePattern.exec(code)) !== null) {
        const names = match[1].split(",").map((n) => n.trim());
        imports.push({
          source: match[2],
          names,
          isLocal: match[2].startsWith(".")
        });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const namedPattern = /^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/gm;
      let match;
      while ((match = namedPattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const listPattern = /^export\s+\{([^}]+)\}/gm;
      while ((match = listPattern.exec(code)) !== null) {
        const names = match[1].split(",").map((n) => n.trim());
        exports3.push(...names);
      }
      return [...new Set(exports3)];
    }
    var JavaScriptParser = {
      lang: "js",
      extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"],
      extractEntities,
      extractImports,
      extractExports
    };
    (0, registry_1.registerParser)(JavaScriptParser);
  }
});

// dist/languages/python.js
var require_python = __commonJS({
  "dist/languages/python.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defLine = lines.findIndex((l) => l.match(new RegExp(`def\\s+${name}\\s*\\(`)));
      if (defLine === -1)
        return "low";
      const bodyLines = [];
      for (let i = defLine + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "")
          continue;
        if (!line.match(/^\s+/))
          break;
        bodyLines.push(line);
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|elif|else|for|while|except|and|or)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    function extractEntities(code, filePath) {
      const entities = [];
      const patterns = [
        // regular functions
        {
          regex: /^(?:async\s+)?def\s+(\w+)\s*\(/gm,
          type: "function"
        },
        // classes
        {
          regex: /^class\s+(\w+)(?:\s*\([^)]*\))?\s*:/gm,
          type: "class"
        }
      ];
      for (const { regex, type } of patterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1];
          if (type === "function" && name.startsWith("__") && name.endsWith("__"))
            continue;
          if (entities.some((e) => e.name === name))
            continue;
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          entities.push({
            name,
            type,
            line,
            complexity: type === "function" ? estimateComplexity(code, name) : "low"
          });
        }
      }
      return entities;
    }
    function extractImports(code) {
      const imports = [];
      const fromPattern = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
      let match;
      while ((match = fromPattern.exec(code)) !== null) {
        const source = match[1];
        const names = match[2].split(",").map((n) => n.trim()).filter((n) => n.length > 0);
        const isLocal = source.startsWith(".");
        imports.push({ source, names, isLocal });
      }
      const importPattern = /^import\s+([\w.]+)/gm;
      while ((match = importPattern.exec(code)) !== null) {
        const source = match[1];
        imports.push({
          source,
          names: [source],
          isLocal: false
          // bare imports are always external
        });
      }
      return imports;
    }
    function extractExports(code) {
      const allMatch = code.match(/__all__\s*=\s*\[([^\]]+)\]/);
      if (!allMatch)
        return [];
      return allMatch[1].split(",").map((n) => n.trim().replace(/['"]/g, "")).filter((n) => n.length > 0);
    }
    var PythonParser = {
      lang: "py",
      extensions: [".py"],
      extractEntities,
      extractImports,
      extractExports
    };
    (0, registry_1.registerParser)(PythonParser);
  }
});

// dist/stages/collector.js
var require_collector = __commonJS({
  "dist/stages/collector.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.collectFiles = collectFiles;
    var fs_12 = __importDefault2(require("fs"));
    var path_1 = __importDefault2(require("path"));
    var constants_1 = require_constants();
    function collectFiles(dir) {
      const results = [];
      function walk(currentDir) {
        let entries;
        try {
          entries = fs_12.default.readdirSync(currentDir);
        } catch (err) {
          console.warn(` >> ====== > Cannot read directory: ${currentDir}`);
          return;
        }
        for (const entry of entries) {
          const fullPath = path_1.default.join(currentDir, entry);
          let stat;
          try {
            stat = fs_12.default.statSync(fullPath);
          } catch (err) {
            console.warn(` >> ====== > Cannot stat: ${fullPath}`);
            continue;
          }
          if (stat.isDirectory()) {
            if (!constants_1.IGNORE_DIRS.has(entry)) {
              walk(fullPath);
            }
            continue;
          }
          const ext = path_1.default.extname(entry);
          if (constants_1.SUPPORTED_EXTS.has(ext) && stat.size < constants_1.MAX_FILE_SIZE) {
            results.push(fullPath);
          }
        }
      }
      walk(dir);
      return results;
    }
  }
});

// dist/stages/parser.js
var require_parser = __commonJS({
  "dist/stages/parser.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseFile = parseFile;
    exports2.parseFiles = parseFiles;
    var fs_12 = __importDefault2(require("fs"));
    var path_1 = __importDefault2(require("path"));
    var registry_1 = require_registry();
    function parseFile(filePath) {
      let code;
      try {
        code = fs_12.default.readFileSync(filePath, "utf-8");
      } catch {
        console.warn(`\u26A0 Cannot read file: ${filePath}`);
        return null;
      }
      const ext = path_1.default.extname(filePath).toLowerCase();
      const parser = (0, registry_1.getLanguageParser)(ext);
      if (!parser)
        return null;
      const cleanCode = code.split("\n").map((line) => {
        const commentIndex = line.indexOf("//");
        if (commentIndex === -1)
          return line;
        const before = line.slice(0, commentIndex);
        const inString = (before.match(/"/g) || []).length % 2 !== 0 || (before.match(/'/g) || []).length % 2 !== 0;
        return inString ? line : line.slice(0, commentIndex);
      }).join("\n");
      const lines = code.split("\n").length;
      const entities = parser.extractEntities(cleanCode, filePath);
      const imports = parser.extractImports(cleanCode);
      const exports3 = parser.extractExports(cleanCode);
      return { filePath, lang: parser.lang, lines, entities, imports, exports: exports3 };
    }
    function parseFiles(filePaths) {
      const results = [];
      for (const filePath of filePaths) {
        const parsed = parseFile(filePath);
        if (parsed) {
          results.push(parsed);
        }
      }
      return results;
    }
  }
});

// dist/stages/graph.js
var require_graph = __commonJS({
  "dist/stages/graph.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildGraph = buildGraph;
    var path_1 = __importDefault2(require("path"));
    function buildGraph(parsedFiles) {
      const nodes = /* @__PURE__ */ new Map();
      const edges = [];
      for (const file of parsedFiles) {
        const fileBase = path_1.default.basename(file.filePath, path_1.default.extname(file.filePath));
        for (const entity of file.entities) {
          const id = makeId(entity.name, fileBase);
          if (nodes.has(id))
            continue;
          nodes.set(id, {
            id,
            name: entity.name,
            type: entity.type,
            file: file.filePath,
            line: entity.line,
            lang: file.lang,
            complexity: entity.complexity,
            inDegree: 0,
            outDegree: 0,
            centralityScore: 0,
            connections: []
          });
        }
      }
      const fileMap = /* @__PURE__ */ new Map();
      for (const file of parsedFiles) {
        fileMap.set(file.filePath, file);
      }
      for (const file of parsedFiles) {
        const fileBase = path_1.default.basename(file.filePath, path_1.default.extname(file.filePath));
        for (const imp of file.imports) {
          if (!imp.isLocal)
            continue;
          const resolvedPath = resolvePath(file.filePath, imp.source, parsedFiles);
          if (!resolvedPath)
            continue;
          const targetFile = fileMap.get(resolvedPath);
          if (!targetFile)
            continue;
          for (const importedName of imp.names) {
            const targetEntity = targetFile.entities.find((e) => e.name === importedName);
            if (!targetEntity)
              continue;
            const targetBase = path_1.default.basename(resolvedPath, path_1.default.extname(resolvedPath));
            const toId = makeId(importedName, targetBase);
            if (!nodes.has(toId))
              continue;
            const fromEntities = file.entities.length > 0 ? file.entities : [{ name: fileBase, type: "file", line: 0, complexity: "low" }];
            for (const fromEntity of fromEntities) {
              const fromId = makeId(fromEntity.name, fileBase);
              if (!nodes.has(fromId))
                continue;
              if (fromId === toId)
                continue;
              const alreadyExists = edges.some((e) => e.from === fromId && e.to === toId && e.type === "imports");
              if (alreadyExists)
                continue;
              edges.push({
                from: fromId,
                to: toId,
                type: "imports",
                description: `${fromEntity.name} imports ${importedName} from ${path_1.default.basename(resolvedPath)}`
              });
              const fromNode = nodes.get(fromId);
              const toNode = nodes.get(toId);
              if (fromNode && !fromNode.connections.includes(toId)) {
                fromNode.connections.push(toId);
              }
              if (toNode && !toNode.connections.includes(fromId)) {
                toNode.connections.push(fromId);
              }
            }
          }
        }
      }
      return { nodes, edges };
    }
    function makeId(name, fileBase) {
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, "_");
      const cleanBase = fileBase.replace(/[^a-zA-Z0-9]/g, "_");
      return `${cleanName}__${cleanBase}`;
    }
    function resolvePath(fromFile, importSource, allFiles) {
      const fromDir = path_1.default.dirname(fromFile);
      const base = path_1.default.join(fromDir, importSource);
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        `${base}/index.ts`,
        `${base}/index.js`
      ];
      for (const candidate of candidates) {
        const normalized = candidate.replace(/\\/g, "/");
        const found = allFiles.find((f) => f.filePath.replace(/\\/g, "/") === normalized);
        if (found)
          return found.filePath;
      }
      return null;
    }
  }
});

// dist/stages/metrics.js
var require_metrics = __commonJS({
  "dist/stages/metrics.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.computeMetrics = computeMetrics;
    exports2.getEntryPoints = getEntryPoints;
    exports2.getLeafNodes = getLeafNodes;
    exports2.getIsolatedNodes = getIsolatedNodes;
    exports2.getCriticalNodes = getCriticalNodes;
    function computeMetrics(graph) {
      for (const edge of graph.edges) {
        const fromNode = graph.nodes.get(edge.from);
        const toNode = graph.nodes.get(edge.to);
        if (fromNode)
          fromNode.outDegree += 1;
        if (toNode)
          toNode.inDegree += 1;
      }
      for (const [, node] of graph.nodes) {
        node.centralityScore = node.inDegree * 2 + node.outDegree;
      }
      return graph;
    }
    function getEntryPoints(graph) {
      return [...graph.nodes.values()].filter((n) => n.inDegree === 0 && n.outDegree > 0).map((n) => n.id);
    }
    function getLeafNodes(graph) {
      return [...graph.nodes.values()].filter((n) => n.outDegree === 0 && n.inDegree > 0).map((n) => n.id);
    }
    function getIsolatedNodes(graph) {
      return [...graph.nodes.values()].filter((n) => n.inDegree === 0 && n.outDegree === 0).map((n) => n.id);
    }
    function getCriticalNodes(graph) {
      return [...graph.nodes.values()].filter((n) => n.centralityScore > 20).map((n) => n.id);
    }
  }
});

// dist/stages/impact.js
var require_impact = __commonJS({
  "dist/stages/impact.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.simulateImpact = simulateImpact;
    var constants_1 = require_constants();
    function simulateImpact(graph, targetName, changeDescription) {
      const targetNode = [...graph.nodes.values()].find((n) => n.name === targetName);
      if (!targetNode) {
        return emptyReport(targetName, changeDescription, `Node "${targetName}" not found in graph`);
      }
      const affected = [];
      const visited = /* @__PURE__ */ new Set();
      const queue = [];
      const directDependents = getDirectDependents(graph, targetNode.id);
      for (const depId of directDependents) {
        queue.push({ id: depId, depth: 1 });
      }
      while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (visited.has(id))
          continue;
        if (depth > constants_1.MAX_BFS_DEPTH)
          continue;
        visited.add(id);
        const node = graph.nodes.get(id);
        if (!node)
          continue;
        const impact = getImpactLevel(depth);
        affected.push({
          nodeId: id,
          name: node.name,
          file: node.file,
          depth,
          impact,
          reason: getReason(node.name, targetName, depth),
          changeRequired: getChangeRequired(node.name, targetName, impact),
          breakingChange: depth <= 2
        });
        const nextDependents = getDirectDependents(graph, id);
        for (const nextId of nextDependents) {
          if (!visited.has(nextId)) {
            queue.push({ id: nextId, depth: depth + 1 });
          }
        }
      }
      const riskScore = computeRiskScore(affected, targetNode.inDegree);
      const riskLevel = getRiskLevel(riskScore);
      const breakingChanges = affected.filter((n) => n.breakingChange);
      const testingPlan = buildTestingPlan(targetName, affected);
      const recommendations = buildRecommendations(riskScore, breakingChanges.length);
      return {
        targetNode: targetNode.id,
        changeDescription,
        riskScore,
        riskLevel,
        affectedNodes: affected,
        breakingChanges,
        testingPlan,
        recommendations
      };
    }
    function getDirectDependents(graph, nodeId) {
      return graph.edges.filter((e) => e.to === nodeId).map((e) => e.from);
    }
    function getImpactLevel(depth) {
      if (depth === 1)
        return "critical";
      if (depth === 2)
        return "high";
      if (depth <= 4)
        return "medium";
      return "low";
    }
    function computeRiskScore(affected, inDegree) {
      const C = affected.filter((n) => n.impact === "critical").length;
      const H = affected.filter((n) => n.impact === "high").length;
      const M = affected.filter((n) => n.impact === "medium").length;
      const L = affected.filter((n) => n.impact === "low").length;
      const score = C * 30 + H * 15 + M * 7 + L * 2 + inDegree * 3;
      return Math.min(100, score);
    }
    function getRiskLevel(score) {
      if (score >= 75)
        return "CRITICAL";
      if (score >= 50)
        return "HIGH";
      if (score >= 25)
        return "MEDIUM";
      return "LOW";
    }
    function getReason(nodeName, targetName, depth) {
      if (depth === 1)
        return `${nodeName} directly imports ${targetName}`;
      if (depth === 2)
        return `${nodeName} depends on something that uses ${targetName}`;
      return `${nodeName} is transitively affected by changes to ${targetName}`;
    }
    function getChangeRequired(name, targetName, impact) {
      if (impact === "critical")
        return `Update ${name} to handle the new interface of ${targetName}`;
      if (impact === "high")
        return `Review ${name} for compatibility with changed ${targetName}`;
      if (impact === "medium")
        return `Test ${name} after deploying changes to ${targetName}`;
      return `Monitor ${name} for unexpected behavior after ${targetName} changes`;
    }
    function buildTestingPlan(targetName, affected) {
      const plan = [];
      plan.push(`Test ${targetName} directly after making changes`);
      const critical = affected.filter((n) => n.impact === "critical");
      const high = affected.filter((n) => n.impact === "high");
      for (const node of critical) {
        plan.push(`Regression test ${node.name} \u2014 direct dependent`);
      }
      for (const node of high) {
        plan.push(`Integration test ${node.name} \u2014 indirect dependent`);
      }
      if (affected.length > 5) {
        plan.push(`Run full test suite \u2014 ${affected.length} nodes affected`);
      }
      return plan;
    }
    function buildRecommendations(riskScore, breakingCount) {
      const rec = [];
      if (riskScore >= 75) {
        rec.push("Full team review required before merging");
        rec.push("Consider a phased rollout");
        rec.push("Run full regression test suite");
      } else if (riskScore >= 50) {
        rec.push("Tech lead review recommended");
        rec.push("Feature flag this change");
        rec.push("Test all breaking changes before deploying");
      } else if (riskScore >= 25) {
        rec.push("Code review required");
        rec.push("Test all affected modules");
      } else {
        rec.push("Standard PR process is sufficient");
        rec.push("Unit tests for the changed node are enough");
      }
      if (breakingCount > 0) {
        rec.push(`${breakingCount} breaking change(s) must be updated before deploying`);
      }
      return rec;
    }
    function emptyReport(targetName, changeDescription, reason) {
      return {
        targetNode: targetName,
        changeDescription,
        riskScore: 0,
        riskLevel: "LOW",
        affectedNodes: [],
        breakingChanges: [],
        testingPlan: [`Could not simulate: ${reason}`],
        recommendations: ["Verify the node name and try again"]
      };
    }
  }
});

// dist/stages/output.js
var require_output = __commonJS({
  "dist/stages/output.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.writeOutput = writeOutput;
    var fs_12 = __importDefault2(require("fs"));
    var path_1 = __importDefault2(require("path"));
    var metrics_12 = require_metrics();
    function writeOutput(graph, parsed, outputPath2, impact) {
      const totalLines = parsed.reduce((sum, f) => sum + f.lines, 0);
      const summary = {
        totalNodes: graph.nodes.size,
        totalEdges: graph.edges.length,
        entryPoints: (0, metrics_12.getEntryPoints)(graph),
        leafNodes: (0, metrics_12.getLeafNodes)(graph),
        isolatedNodes: (0, metrics_12.getIsolatedNodes)(graph),
        criticalNodes: (0, metrics_12.getCriticalNodes)(graph)
      };
      const output = {
        meta: {
          version: "1.0.0",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          totalFiles: parsed.length,
          totalLines
        },
        summary,
        nodes: [...graph.nodes.values()],
        // Map → Array
        edges: graph.edges,
        files: parsed,
        impact
        // optional, only if --impact was used
      };
      const dir = path_1.default.dirname(outputPath2);
      if (!fs_12.default.existsSync(dir)) {
        fs_12.default.mkdirSync(dir, { recursive: true });
      }
      fs_12.default.writeFileSync(
        outputPath2,
        JSON.stringify(output, null, 2),
        // 2 = pretty print with 2 spaces
        "utf-8"
      );
      console.log(`
\u2705 Output written to ${outputPath2}`);
      console.log(`   ${output.meta.totalFiles} files`);
      console.log(`   ${summary.totalNodes} nodes`);
      console.log(`   ${summary.totalEdges} edges`);
      console.log(`   ${totalLines} total lines of code`);
      if (impact) {
        console.log(`
\u{1F4A5} Impact Report included`);
        console.log(`   Target     : ${impact.targetNode}`);
        console.log(`   Risk Level : ${impact.riskLevel}`);
        console.log(`   Risk Score : ${impact.riskScore}`);
        console.log(`   Affected   : ${impact.affectedNodes.length} nodes`);
      }
    }
  }
});

// dist/main.js
var __importDefault = exports && exports.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require_javascript();
require_python();
var fs_1 = __importDefault(require("fs"));
var collector_1 = require_collector();
var parser_1 = require_parser();
var graph_1 = require_graph();
var metrics_1 = require_metrics();
var impact_1 = require_impact();
var output_1 = require_output();
var args = process.argv.slice(2);
var noColor = args.includes("--no-color");
var verbose = args.includes("--verbose");
function color(text, code) {
  if (noColor)
    return text;
  return `\x1B[${code}m${text}\x1B[0m`;
}
var dim = (t) => color(t, "2");
var bold = (t) => color(t, "1");
var green = (t) => color(t, "32");
var yellow = (t) => color(t, "33");
var red = (t) => color(t, "31");
var cyan = (t) => color(t, "36");
function getFlag(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : void 0;
}
function printHelp() {
  console.log(`
${bold("DepGraph Compiler")} ${dim("v1.0.2")}
${dim("Dependency mapping \xB7 Impact simulation \xB7 Developer intelligence")}

${bold("USAGE")}
  node depgraph.js ${cyan("<projectDir>")} ${dim("[options]")}

${bold("OPTIONS")}
  ${cyan("--output")}  ${dim("<file>")}        Output path  ${dim("(default: ./depgraph-output.json)")}
  ${cyan("--impact")}  ${dim("<name> <desc>")} Simulate changing a node
  ${cyan("--verbose")}                Show per-file parsing details
  ${cyan("--no-color")}               Disable colors ${dim("(for CI)")}
  ${cyan("--help, -h")}               Show this help message

${bold("EXAMPLES")}
  ${dim("# Map a project")}
  node depgraph.js ./my-app

  ${dim("# Map with custom output")}
  node depgraph.js ./my-app --output ./reports/graph.json

  ${dim("# Simulate a change")}
  node depgraph.js ./my-app --impact "getUserById" "removing userId param"

  ${dim("# CI mode")}
  node depgraph.js ./src --no-color --output ./ci/depgraph.json
`);
}
function printBanner() {
  console.log(`
${bold("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501")}
${bold("  DepGraph Compiler")}  ${dim("v1.0.0")}
${bold("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501")}
`);
}
function printSummary(fileCount, nodeCount, edgeCount, criticalNodes) {
  console.log(bold("\u{1F4CA} Graph Summary"));
  console.log(`   ${dim("Files  :")} ${green(String(fileCount))}`);
  console.log(`   ${dim("Nodes  :")} ${green(String(nodeCount))}`);
  console.log(`   ${dim("Edges  :")} ${green(String(edgeCount))}`);
  if (criticalNodes.length > 0) {
    console.log(`
${bold("\u{1F534} Critical Nodes")} ${dim("(change carefully)")}`);
    for (const id of criticalNodes) {
      console.log(`   ${red("\u25CF")} ${id}`);
    }
  }
}
function printImpact(impact) {
  const levelColor = impact.riskLevel === "CRITICAL" ? red : impact.riskLevel === "HIGH" ? yellow : impact.riskLevel === "MEDIUM" ? cyan : green;
  console.log(`
${bold("\u{1F4A5} Impact Simulation")}`);
  console.log(`   ${dim("Target      :")} ${bold(impact.targetNode)}`);
  console.log(`   ${dim("Change      :")} ${impact.changeDescription}`);
  console.log(`   ${dim("Risk Score  :")} ${levelColor(String(impact.riskScore))}`);
  console.log(`   ${dim("Risk Level  :")} ${bold(levelColor(impact.riskLevel))}`);
  if (impact.affectedNodes.length === 0) {
    console.log(`
   ${green("\u2713")} No affected nodes found`);
  } else {
    console.log(`
${bold(`\u{1F4CB} Affected Nodes (${impact.affectedNodes.length})`)}`);
    for (const node of impact.affectedNodes) {
      const impColor = node.impact === "critical" ? red : node.impact === "high" ? yellow : node.impact === "medium" ? cyan : green;
      console.log(`
   ${impColor(`[${node.impact.toUpperCase().padEnd(8)}]`)} ${bold(node.name)}`);
      console.log(`   ${dim("file    :")} ${node.file}`);
      console.log(`   ${dim("reason  :")} ${node.reason}`);
      console.log(`   ${dim("action  :")} ${node.changeRequired}`);
      console.log(`   ${dim("breaking:")} ${node.breakingChange ? red("YES") : green("no")}`);
    }
  }
  console.log(`
${bold("\u{1F9EA} Testing Plan")}`);
  for (const item of impact.testingPlan) {
    console.log(`   ${dim("\u2192")} ${item}`);
  }
  console.log(`
${bold("\u{1F4A1} Recommendations")}`);
  for (const rec of impact.recommendations) {
    console.log(`   ${dim("\u2192")} ${rec}`);
  }
}
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}
var projectDir = args[0];
var outputPath = getFlag("--output") ?? "./depgraph-output.json";
var impactTarget = getFlag("--impact");
var impactDesc = impactTarget ? args[args.indexOf("--impact") + 2] ?? "no description provided" : void 0;
printBanner();
console.log(`${bold("\u{1F50D} Scanning")} ${cyan(projectDir)}
`);
if (!fs_1.default.existsSync(projectDir)) {
  console.error(red(`\u2717 Directory not found: ${projectDir}`));
  process.exit(1);
}
try {
  const files = (0, collector_1.collectFiles)(projectDir);
  if (verbose) {
    files.forEach((f) => console.log(dim(`  ${f}`)));
  }
  const parsed = (0, parser_1.parseFiles)(files);
  if (verbose) {
    parsed.forEach((f) => console.log(dim(`  parsed: ${f.filePath} \u2192 ${f.entities.length} entities`)));
  }
  const graph = (0, graph_1.buildGraph)(parsed);
  const metrics = (0, metrics_1.computeMetrics)(graph);
  printSummary(files.length, metrics.nodes.size, metrics.edges.length, (0, metrics_1.getCriticalNodes)(metrics));
  let impact = void 0;
  if (impactTarget) {
    impact = (0, impact_1.simulateImpact)(metrics, impactTarget, impactDesc ?? "");
    printImpact(impact);
  }
  (0, output_1.writeOutput)(metrics, parsed, outputPath, impact);
} catch (err) {
  console.error(red(`
\u2717 Error: ${err.message}`));
  process.exit(1);
}
