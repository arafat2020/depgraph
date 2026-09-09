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
      ".svelte",
      ".dart",
      ".rs"
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
    exports2.jsEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const nameRegex = new RegExp(`(?:(?:async\\s+)?function(?:\\s*\\*|\\s+)|(?:const|let|var)\\s+)${name}\\b|\\b${name}\\s*(?:<[^>]*>)?\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => nameRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === "{") {
            braceCount++;
            started = true;
          } else if (char === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0) {
          break;
        }
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|for|while|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.jsEntityPatterns = [
      // React components: wrapped in memo/forwardRef
      {
        regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo|forwardRef)\(/gm,
        type: "component"
      },
      // React components: PascalCase arrow functions
      {
        regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/gm,
        type: "component"
      },
      // React components: PascalCase function declarations
      {
        regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
        type: "component"
      },
      // React hooks: camelCase starting with "use" (arrow functions or const assignments)
      {
        regex: /^(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+(use[A-Z]\w*)\s*=/gm,
        type: "hook"
      },
      // React hooks: camelCase starting with "use" (function declarations)
      {
        regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(use[A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
        type: "hook"
      },
      // regular and async function declarations (including generator functions)
      {
        regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*\s*|\s+)([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
        type: "function"
      },
      // arrow functions assigned to const / let / var
      {
        regex: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>/gm,
        type: "function"
      },
      // function expressions assigned to const / let / var
      {
        regex: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?function/gm,
        type: "function"
      },
      // classes (regular, exported, abstract)
      {
        regex: /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_]\w*)/gm,
        type: "class"
      },
      // TypeScript interfaces
      {
        regex: /^(?:export\s+)?(?:default\s+)?interface\s+([A-Za-z_]\w*)/gm,
        type: "interface"
      },
      // TypeScript types
      {
        regex: /^(?:export\s+)?(?:default\s+)?type\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*=/gm,
        type: "type"
      },
      // TypeScript enums (regular or const enum)
      {
        regex: /^(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_]\w*)/gm,
        type: "class"
      },
      // Express / router routes (capture group 1 = method, group 2 = path — skipped in gitdiff context matching)
      {
        regex: /(?:app|router|server)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/gm,
        type: "api"
      }
    ];
    function extractEntities(code, filePath) {
      const entities = [];
      for (const { regex, type } of exports2.jsEntityPatterns) {
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
      const combinedPattern = /^import\s+(?:type\s+)?([A-Za-z_$]\w*)\s*,\s*(?:\{([^}]+)\}|\*\s+as\s+([A-Za-z_$]\w*))\s+from\s+['"]([^'"]+)['"]/gm;
      let match;
      while ((match = combinedPattern.exec(code)) !== null) {
        const defaultName = match[1];
        const namedClause = match[2];
        const nsName = match[3];
        const source = match[4];
        const names = [defaultName];
        if (namedClause) {
          const parsedNamed = namedClause.split(",").map((n) => n.trim().replace(/^type\s+/, "").replace(/\s+as\s+\w+$/, "").trim()).filter((n) => n.length > 0);
          names.push(...parsedNamed);
        }
        if (nsName) {
          names.push(nsName);
        }
        imports.push({
          source,
          names: [...new Set(names)],
          isLocal: source.startsWith(".") || source.startsWith("/")
        });
      }
      const namedPattern = /^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
      while ((match = namedPattern.exec(code)) !== null) {
        const source = match[2];
        if (imports.some((i) => i.source === source))
          continue;
        const names = match[1].split(",").map((n) => n.trim().replace(/^type\s+/, "").replace(/\s+as\s+\w+$/, "").trim()).filter((n) => n.length > 0);
        imports.push({
          source,
          names: [...new Set(names)],
          isLocal: source.startsWith(".") || source.startsWith("/")
        });
      }
      const defaultPattern = /^import\s+(?:type\s+)?([A-Za-z_$]\w*)\s+from\s+['"]([^'"]+)['"]/gm;
      while ((match = defaultPattern.exec(code)) !== null) {
        const source = match[2];
        if (imports.some((i) => i.source === source))
          continue;
        imports.push({
          source,
          names: [match[1]],
          isLocal: source.startsWith(".") || source.startsWith("/")
        });
      }
      const nsPattern = /^import\s+\*\s+as\s+([A-Za-z_$]\w*)\s+from\s+['"]([^'"]+)['"]/gm;
      while ((match = nsPattern.exec(code)) !== null) {
        const source = match[2];
        if (imports.some((i) => i.source === source))
          continue;
        imports.push({
          source,
          names: [match[1]],
          isLocal: source.startsWith(".") || source.startsWith("/")
        });
      }
      const requirePattern = /(?:const|let|var)\s+\{?([^}=]+)\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
      while ((match = requirePattern.exec(code)) !== null) {
        const rawNames = match[1];
        const source = match[2];
        const names = rawNames.split(",").map((n) => n.trim().replace(/^\w+:\s*/, "").trim()).filter((n) => n.length > 0);
        imports.push({
          source,
          names: [...new Set(names)],
          isLocal: source.startsWith(".") || source.startsWith("/")
        });
      }
      const reexportPattern = /^export\s+(?:\{([^}]+)\}|\*\s+as\s+([A-Za-z_$]\w*)|\*)\s+from\s+['"]([^'"]+)['"]/gm;
      while ((match = reexportPattern.exec(code)) !== null) {
        const namedClause = match[1];
        const nsAlias = match[2];
        const source = match[3];
        let names = [];
        if (namedClause) {
          names = namedClause.split(",").map((n) => n.trim().replace(/^type\s+/, "").replace(/\s+as\s+\w+$/, "").trim()).filter((n) => n.length > 0);
        } else if (nsAlias) {
          names = [nsAlias];
        } else {
          names = ["*"];
        }
        imports.push({
          source,
          names: [...new Set(names)],
          isLocal: source.startsWith(".") || source.startsWith("/")
        });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const namedPattern = /^export\s+(?:default\s+)?(?:async\s+|abstract\s+)?(?:function(?:\s*\*|\s+)|class|const|let|var|type|interface|enum)\s+([A-Za-z_$]\w*)/gm;
      let match;
      while ((match = namedPattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const defaultIdentPattern = /^export\s+default\s+([A-Za-z_$]\w*)\s*(?:;|$)/gm;
      while ((match = defaultIdentPattern.exec(code)) !== null) {
        if (!["function", "class", "interface", "abstract"].includes(match[1])) {
          exports3.push(match[1]);
        }
      }
      const listPattern = /^export\s+\{([^}]+)\}(?!\s*from)/gm;
      while ((match = listPattern.exec(code)) !== null) {
        const names = match[1].split(",").map((n) => n.trim().replace(/^type\s+/, "").replace(/^\w+\s+as\s+/, "").trim()).filter((n) => n.length > 0);
        exports3.push(...names);
      }
      const reexportPattern = /^export\s+\{([^}]+)\}\s+from/gm;
      while ((match = reexportPattern.exec(code)) !== null) {
        const names = match[1].split(",").map((n) => n.trim().replace(/^type\s+/, "").replace(/^\w+\s+as\s+/, "").trim()).filter((n) => n.length > 0);
        exports3.push(...names);
      }
      return [...new Set(exports3)];
    }
    var JavaScriptParser = {
      lang: "js",
      extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.jsEntityPatterns
    };
    (0, registry_1.registerParser)(JavaScriptParser);
  }
});

// dist/languages/python.js
var require_python = __commonJS({
  "dist/languages/python.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.pyEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`^[ \\t]*(?:async\\s+)?def\\s+${escapeRegex(name)}\\s*\\(`, "m");
      const defLine = lines.findIndex((l) => defRegex.test(l));
      if (defLine === -1)
        return "low";
      let bodyStart = defLine;
      while (bodyStart < lines.length && !lines[bodyStart].includes(":")) {
        bodyStart++;
      }
      bodyStart++;
      const bodyLines = [];
      for (let i = bodyStart; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "")
          continue;
        if (!line.match(/^\s+/))
          break;
        bodyLines.push(line);
      }
      const branches = (bodyLines.join("\n").match(/\b(if|elif|else|for|while|except|and|or|match|case)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.pyEntityPatterns = [
      // functions and methods (including async def)
      {
        regex: /^[ \t]*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/gm,
        type: "function"
      },
      // classes (with optional generic parameters [T] and base classes (Base))
      {
        regex: /^[ \t]*class\s+([A-Za-z_]\w*)(?:\s*\[[^\]]*\])?(?:\s*\([^)]*\))?\s*:/gm,
        type: "class"
      }
    ];
    function extractEntities(code, filePath) {
      const entities = [];
      for (const { regex, type } of exports2.pyEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1];
          if (type === "function" && name.startsWith("__") && name.endsWith("__"))
            continue;
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (entities.some((e) => e.name === name && e.line === line))
            continue;
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
    function stripAlias(name) {
      return name.replace(/\s+as\s+[A-Za-z_]\w*$/, "").trim();
    }
    function extractImports(code) {
      const imports = [];
      const normalised = code.replace(/^(from\s+[\w.]+\s+import\s*)\(\s*([\s\S]*?)\)/gm, (_, prefix, body) => prefix + body.replace(/\s*\n\s*/g, ", "));
      const fromPattern = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
      let match;
      while ((match = fromPattern.exec(normalised)) !== null) {
        const source = match[1];
        const rawNames = match[2].replace(/#.*$/, "");
        const names = rawNames.split(",").map((n) => stripAlias(n.trim())).filter((n) => n.length > 0 && n !== "*");
        imports.push({ source, names, isLocal: source.startsWith(".") });
      }
      const importPattern = /^import\s+([^#\n]+)/gm;
      while ((match = importPattern.exec(normalised)) !== null) {
        const modules = match[1].split(",").map((m) => m.trim());
        for (const mod of modules) {
          if (!mod)
            continue;
          const cleanMod = stripAlias(mod);
          if (!cleanMod)
            continue;
          imports.push({
            source: cleanMod,
            names: [cleanMod],
            isLocal: cleanMod.startsWith(".")
          });
        }
      }
      return imports;
    }
    function extractExports(code) {
      const allMatch = code.match(/__all__\s*=\s*[\[\(]([\s\S]*?)[\]\)]/);
      if (!allMatch)
        return [];
      return allMatch[1].split(",").map((n) => n.trim().replace(/['"]/g, "").replace(/#.*$/, "").trim()).filter((n) => n.length > 0);
    }
    var PythonParser = {
      lang: "py",
      extensions: [".py"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.pyEntityPatterns
    };
    (0, registry_1.registerParser)(PythonParser);
  }
});

// dist/languages/go.js
var require_go = __commonJS({
  "dist/languages/go.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.goEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const funcRegex = new RegExp(`func\\s+(?:\\([^)]*\\)\\s+)?${name}\\s*(?:\\[[^\\]]*\\])?\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => funcRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === "{") {
            braceCount++;
            started = true;
          } else if (char === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0) {
          break;
        }
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|for|switch|case|select|&&|\|\|)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.goEntityPatterns = [
      // functions and methods with optional receiver and type parameters (generics)
      {
        regex: /^func\s+(?:\([^)]*\)\s+)?([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*\(/gm,
        type: "function"
      },
      // type declarations (structs, interfaces) with optional type parameters
      {
        regex: /^type\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(?:struct|interface)/gm,
        type: "class"
      },
      // type aliases and custom types (e.g. type HandlerFunc func(...), type MyInt int)
      {
        regex: /^type\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(?!(?:struct|interface)\b)[A-Za-z_\[\]\*]/gm,
        type: "type"
      }
    ];
    function extractEntities(code, filePath) {
      const entities = [];
      for (const { regex, type } of exports2.goEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1];
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
      const blockTypePattern = /^type\s*\(\s*\n?([\s\S]*?)\n\s*\)/gm;
      let blockMatch;
      while ((blockMatch = blockTypePattern.exec(code)) !== null) {
        const blockContent = blockMatch[1];
        const blockStartLine = code.slice(0, blockMatch.index).split("\n").length;
        const lines = blockContent.split("\n");
        let braceDepth = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (braceDepth === 0 && line.length > 0 && !line.startsWith("//")) {
            const structInterfaceMatch = line.match(/^([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(struct|interface)/);
            if (structInterfaceMatch) {
              const name = structInterfaceMatch[1];
              if (!entities.some((e) => e.name === name)) {
                entities.push({
                  name,
                  type: "class",
                  line: blockStartLine + i + 1,
                  complexity: "low"
                });
              }
            } else {
              const aliasMatch = line.match(/^([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(?:=\s*)?(?!(?:struct|interface)\b)[A-Za-z_\[\]\*]/);
              if (aliasMatch) {
                const name = aliasMatch[1];
                if (!entities.some((e) => e.name === name)) {
                  entities.push({
                    name,
                    type: "type",
                    line: blockStartLine + i + 1,
                    complexity: "low"
                  });
                }
              }
            }
          }
          for (const ch of line) {
            if (ch === "{")
              braceDepth++;
            else if (ch === "}")
              braceDepth--;
          }
        }
      }
      return entities;
    }
    function extractImports(code) {
      const imports = [];
      const singlePattern = /^import\s+(?:([A-Za-z_.\w]+)\s+)?["']([^"']+)["']/gm;
      let match;
      while ((match = singlePattern.exec(code)) !== null) {
        const alias = match[1];
        const source = match[2];
        const pkgName = alias && alias !== "_" && alias !== "." ? alias : source.split("/").pop() || source;
        imports.push({
          source,
          names: [pkgName],
          isLocal: source.startsWith(".") || source.startsWith("/")
        });
      }
      const blockPattern = /import\s*\(\s*([\s\S]*?)\s*\)/gm;
      while ((match = blockPattern.exec(code)) !== null) {
        const lines = match[1].split("\n");
        for (const line of lines) {
          const cleanLine = line.replace(/\/\/.*$/, "").trim();
          const pkgMatch = cleanLine.match(/^(?:([A-Za-z_.\w]+)\s+)?["']([^"']+)["']/);
          if (pkgMatch) {
            const alias = pkgMatch[1];
            const source = pkgMatch[2];
            const pkgName = alias && alias !== "_" && alias !== "." ? alias : source.split("/").pop() || source;
            imports.push({
              source,
              names: [pkgName],
              isLocal: source.startsWith(".") || source.startsWith("/")
            });
          }
        }
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const funcPattern = /^func\s+(?:\([^)]*\)\s+)?([A-Z]\w*)\s*(?:\[[^\]]*\])?\s*\(/gm;
      let match;
      while ((match = funcPattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const typePattern = /^type\s+([A-Z]\w*)/gm;
      while ((match = typePattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const blockTypePattern = /^type\s*\(\s*\n?([\s\S]*?)\n\s*\)/gm;
      let blockTypeMatch;
      while ((blockTypeMatch = blockTypePattern.exec(code)) !== null) {
        const lines = blockTypeMatch[1].split("\n");
        let braceDepth = 0;
        for (const line of lines) {
          const trimmed = line.trim();
          if (braceDepth === 0 && trimmed.length > 0 && !trimmed.startsWith("//")) {
            const m = trimmed.match(/^([A-Z]\w*)/);
            if (m)
              exports3.push(m[1]);
          }
          for (const ch of trimmed) {
            if (ch === "{")
              braceDepth++;
            else if (ch === "}")
              braceDepth--;
          }
        }
      }
      const constVarPattern = /^(?:const|var)\s+([A-Z]\w*)/gm;
      while ((match = constVarPattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const blockConstVarPattern = /^(?:const|var)\s*\(\s*\n?([\s\S]*?)\n\s*\)/gm;
      while ((match = blockConstVarPattern.exec(code)) !== null) {
        const lines = match[1].split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("//")) {
            const m = trimmed.match(/^([A-Z]\w*)/);
            if (m)
              exports3.push(m[1]);
          }
        }
      }
      return [...new Set(exports3)];
    }
    var GoParser = {
      lang: "go",
      extensions: [".go"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.goEntityPatterns
    };
    (0, registry_1.registerParser)(GoParser);
  }
});

// dist/languages/csharp.js
var require_csharp = __commonJS({
  "dist/languages/csharp.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.csharpEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const methodRegex = new RegExp(`(?:(?:public|private|protected|internal|static|async|virtual|override|abstract|sealed|partial)\\s+)+[\\w<>\\[\\],?]+\\s+${name}\\s*(?:<[^>]*>)?\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => methodRegex.test(l) || new RegExp(`\\b${name}\\s*\\(`, "m").test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === "{") {
            braceCount++;
            started = true;
          } else if (char === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0) {
          break;
        }
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|for|foreach|while|do|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.csharpEntityPatterns = [
      // Classes, structs, records, interfaces, enums
      {
        regex: /^[ \t]*(?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*(?:class|interface|enum|struct|record(?:\s+(?:class|struct))?)\s+([A-Za-z_]\w*)/gm,
        type: "class"
      },
      // Methods (constructors, instance methods, async/static methods)
      {
        regex: /^[ \t]*(?:(?:public|private|protected|internal|static|async|virtual|override|abstract|sealed|partial)\s+)+(?:(?:async\s+)?[\w<>[\]?,]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
        type: "function"
      }
    ];
    function extractEntities(code, filePath) {
      const entities = [];
      for (const { regex, type } of exports2.csharpEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1];
          if (["if", "for", "foreach", "while", "switch", "catch", "lock", "using", "get", "set"].includes(name)) {
            continue;
          }
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (entities.some((e) => e.name === name && e.line === line))
            continue;
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
      const usingPattern = /^[ \t]*(?:global\s+)?using\s+(?:static\s+)?(?:([A-Za-z_]\w*)\s*=\s*)?([A-Za-z_][\w.]*(?:<[^>]*>)?)\s*;/gm;
      let match;
      while ((match = usingPattern.exec(code)) !== null) {
        const alias = match[1];
        const targetFqn = match[2].trim();
        const simpleName = alias || targetFqn.split(".").pop() || targetFqn;
        const isLocal = !targetFqn.startsWith("System") && !targetFqn.startsWith("Microsoft");
        imports.push({
          source: targetFqn,
          names: [simpleName],
          isLocal
        });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const typePattern = /^[ \t]*(?:public|internal)\s+(?:(?:static|abstract|sealed|partial)\s+)*(?:class|interface|enum|struct|record(?:\s+(?:class|struct))?)\s+([A-Za-z_]\w*)/gm;
      let match;
      while ((match = typePattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const methodPattern = /^[ \t]*(?:public|internal)\s+(?:(?:static|async|virtual|override|abstract|sealed|partial)\s+)*(?:[\w<>[\]?,]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm;
      while ((match = methodPattern.exec(code)) !== null) {
        const name = match[1];
        if (!["if", "for", "foreach", "while", "switch", "catch", "lock", "using", "get", "set"].includes(name)) {
          exports3.push(name);
        }
      }
      return [...new Set(exports3)];
    }
    var CSharpParser = {
      lang: "cs",
      extensions: [".cs"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.csharpEntityPatterns
    };
    (0, registry_1.registerParser)(CSharpParser);
  }
});

// dist/languages/java.js
var require_java = __commonJS({
  "dist/languages/java.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.javaEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`(?:^|\\s)${escapeRegex(name)}\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => defRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === "{") {
            braceCount++;
            started = true;
          } else if (ch === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0)
          break;
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|else|for|while|do|switch|case|catch|&&|\|\|)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.javaEntityPatterns = [
      // class / abstract class / final class
      {
        regex: /^[ \t]*(?:(?:public|protected|private|abstract|final|static)\s+)*class\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?:extends\s+\S+\s*)?(?:implements\s+[^{]+)?\s*\{/gm,
        type: "class"
      },
      // interface
      {
        regex: /^[ \t]*(?:(?:public|protected|private|abstract|static)\s+)*interface\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?:extends\s+[^{]+)?\s*\{/gm,
        type: "interface"
      },
      // record (Java 14+)
      {
        regex: /^[ \t]*(?:(?:public|protected|private|final|static)\s+)*record\s+([A-Za-z_]\w*)\s*\(/gm,
        type: "class"
      },
      // enum
      {
        regex: /^[ \t]*(?:(?:public|protected|private|static)\s+)*enum\s+([A-Za-z_]\w*)\s*(?:implements\s+[^{]+)?\s*\{/gm,
        type: "class"
      },
      // annotation type
      {
        regex: /^[ \t]*(?:(?:public|protected|private|abstract|static)\s+)*@interface\s+([A-Za-z_]\w*)\s*\{/gm,
        type: "interface"
      },
      // method declarations (with return type before the name)
      {
        regex: /^[ \t]*(?:(?:public|protected|private|static|final|abstract|synchronized|native|default|override)\s+)*(?:<[^>]*>\s+)?(?:[\w.<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/gm,
        type: "function"
      }
    ];
    function extractEntities(code, _filePath) {
      const entities = [];
      for (const { regex, type } of exports2.javaEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1];
          if (["if", "else", "for", "while", "do", "switch", "try", "catch", "return", "new", "void", "this", "super"].includes(name))
            continue;
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (entities.some((e) => e.name === name && e.line === line))
            continue;
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
      const importPattern = /^import\s+((?:static)\s+)?([\w.]+(?:\.\*)?)?\s*;/gm;
      let match;
      while ((match = importPattern.exec(code)) !== null) {
        const isStatic = Boolean(match[1]);
        const fullPath = (match[2] || "").trim();
        if (!fullPath)
          continue;
        const isWildcard = fullPath.endsWith(".*");
        const cleanPath = isWildcard ? fullPath.slice(0, -2) : fullPath;
        const segments = cleanPath.split(".");
        let source;
        let name;
        if (isStatic) {
          name = segments.pop() || cleanPath;
          source = segments.join(".") || cleanPath;
        } else {
          name = segments[segments.length - 1] || cleanPath;
          source = cleanPath;
        }
        imports.push({
          source,
          names: [name],
          isLocal: false
        });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const typePattern = /^public\s+(?:(?:abstract|final|static)\s+)*(?:class|interface|enum|record|@interface)\s+([A-Za-z_]\w*)/gm;
      let match;
      while ((match = typePattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const methodPattern = /^[ \t]*public\s+(?:(?:static|final|abstract|synchronized|native|default)\s+)*(?:<[^>]*>\s+)?(?:[\w.<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\(/gm;
      while ((match = methodPattern.exec(code)) !== null) {
        const name = match[1];
        if (!["if", "for", "while", "switch", "class", "interface", "enum"].includes(name)) {
          exports3.push(name);
        }
      }
      return [...new Set(exports3)];
    }
    var JavaParser = {
      lang: "java",
      extensions: [".java"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.javaEntityPatterns
    };
    (0, registry_1.registerParser)(JavaParser);
  }
});

// dist/languages/kotlin.js
var require_kotlin = __commonJS({
  "dist/languages/kotlin.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.kotlinEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`(?:^|\\s)fun\\s+(?:<[^>]*>\\s+)?(?:\\w[\\w.]*\\.)?${escapeRegex(name)}\\s*(?:\\(|<)`, "m");
      const defLineIdx = lines.findIndex((l) => defRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === "{") {
            braceCount++;
            started = true;
          } else if (ch === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0)
          break;
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|else|for|while|when|catch|&&|\|\|)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.kotlinEntityPatterns = [
      // class declarations (including data class, sealed class, abstract class, inner class)
      // The trailing brace is optional: abstract classes may have no body on the same line.
      // We anchor by requiring the class name to be followed by whitespace, <, (, :, { or EOL.
      {
        regex: /^[ \t]*(?:(?:public|private|protected|internal|abstract|sealed|data|open|inner|inline|value|annotation)\s+)*class\s+([A-Za-z_]\w*)(?=[\s<(:,{\n]|$)/gm,
        type: "class"
      },
      // object declarations (singleton objects and companion objects)
      {
        regex: /^[ \t]*(?:(?:public|private|protected|internal)\s+)*(?:companion\s+)?object\s+([A-Za-z_]\w*)\s*(?::\s*[^{]+)?\s*\{/gm,
        type: "class"
      },
      // interface declarations
      {
        regex: /^[ \t]*(?:(?:public|private|protected|internal|sealed|fun)\s+)*interface\s+([A-Za-z_]\w*)(?:\s*<[^{]*)?(?:\s*:\s*[^{]+)?\s*\{/gm,
        type: "interface"
      },
      // enum class
      {
        regex: /^[ \t]*(?:(?:public|private|protected|internal)\s+)*enum\s+class\s+([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*\{/gm,
        type: "class"
      },
      // function declarations (including suspend, inline, operator, extension functions)
      {
        regex: /^[ \t]*(?:(?:public|private|protected|internal|override|open|final|abstract|suspend|inline|operator|infix|tailrec|external|actual|expect)\s+)*fun\s+(?:<[^>]*>\s+)?(?:[\w.]+\.)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
        type: "function"
      }
    ];
    function extractEntities(code, _filePath) {
      const entities = [];
      for (const { regex, type } of exports2.kotlinEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1];
          if (!name)
            continue;
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (entities.some((e) => e.name === name && e.line === line))
            continue;
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
      const importPattern = /^import\s+([\w.]+?)(\.\*)?\s*(?:as\s+(\w+))?\s*$/gm;
      let match;
      while ((match = importPattern.exec(code)) !== null) {
        const fullPath = match[1];
        const isWild = Boolean(match[2]);
        const alias = match[3];
        if (isWild)
          continue;
        const lastName = fullPath.split(".").pop() || fullPath;
        const localName = alias || lastName;
        imports.push({
          source: fullPath,
          names: [localName],
          isLocal: false
        });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const patterns = [
        /^(?:(?:public|open|abstract|sealed|data|inline|value)\s+)*class\s+([A-Za-z_]\w*)/gm,
        /^(?:(?:public)\s+)?object\s+([A-Za-z_]\w*)/gm,
        /^(?:(?:public|sealed|fun)\s+)*interface\s+([A-Za-z_]\w*)/gm,
        /^(?:(?:public|open|inline|suspend|operator|infix|tailrec)\s+)*fun\s+(?:<[^>]*>\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm
      ];
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          if (match[1])
            exports3.push(match[1]);
        }
      }
      return [...new Set(exports3)];
    }
    var KotlinParser = {
      lang: "kotlin",
      extensions: [".kt", ".kts"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.kotlinEntityPatterns
    };
    (0, registry_1.registerParser)(KotlinParser);
  }
});

// dist/languages/php.js
var require_php = __commonJS({
  "dist/languages/php.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.phpEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`(?:^|\\s)function\\s+${escapeRegex(name)}\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => defRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === "{") {
            braceCount++;
            started = true;
          } else if (ch === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0)
          break;
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|elseif|else|for|foreach|while|do|switch|case|catch|&&|\|\|)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.phpEntityPatterns = [
      // class (abstract class, final class, readonly class, etc.)
      {
        regex: /^[ \t]*(?:(?:abstract|final|readonly)\s+)*class\s+([A-Za-z_]\w*)(?:\s+extends\s+\S+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
        type: "class"
      },
      // interface
      {
        regex: /^[ \t]*interface\s+([A-Za-z_]\w*)(?:\s+extends\s+[^{]+)?\s*\{/gm,
        type: "interface"
      },
      // trait
      {
        regex: /^[ \t]*trait\s+([A-Za-z_]\w*)\s*\{/gm,
        type: "class"
      },
      // enum (PHP 8.1+)
      {
        regex: /^[ \t]*enum\s+([A-Za-z_]\w*)(?:\s*:\s*\w+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
        type: "class"
      },
      // function and method declarations
      {
        regex: /^[ \t]*(?:(?:public|protected|private|static|abstract|final|readonly)\s+)*function\s+([A-Za-z_]\w*)\s*\(/gm,
        type: "function"
      }
    ];
    function extractEntities(code, _filePath) {
      const entities = [];
      for (const { regex, type } of exports2.phpEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1];
          if (!name)
            continue;
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (entities.some((e) => e.name === name && e.line === line))
            continue;
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
      const usePattern = /^use\s+([\w\\]+(?:\s*\{[^}]*\})?)\s*(?:as\s+(\w+)\s*)?;/gm;
      let match;
      while ((match = usePattern.exec(code)) !== null) {
        const raw = match[1].trim();
        const alias = match[2]?.trim();
        if (raw.includes("{")) {
          const prefixMatch = raw.match(/^([\w\\]+)\\?\s*\{([^}]*)\}/);
          if (prefixMatch) {
            const prefix = prefixMatch[1];
            const items = prefixMatch[2].split(",");
            for (const item of items) {
              const parts = item.trim().split(/\s+as\s+/i);
              const fullName = (prefix + "\\" + parts[0].trim()).replace(/\\+/g, "\\");
              const lastName = parts[1] || parts[0].trim().split("\\").pop() || fullName;
              imports.push({ source: fullName, names: [lastName.trim()], isLocal: false });
            }
          }
        } else {
          const fullPath = raw;
          const lastName = alias || fullPath.split("\\").pop() || fullPath;
          imports.push({ source: fullPath, names: [lastName.trim()], isLocal: false });
        }
      }
      const includePattern = /(?:require|include)(?:_once)?\s*[^;'"]*?['"]([^'"]+)['"]/gm;
      while ((match = includePattern.exec(code)) !== null) {
        const source = match[1];
        const name = source.split("/").pop()?.replace(/\.php$/i, "") || source;
        imports.push({ source, names: [name], isLocal: true });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const patterns = [
        /^(?:(?:abstract|final|readonly)\s+)*class\s+([A-Za-z_]\w*)/gm,
        /^interface\s+([A-Za-z_]\w*)/gm,
        /^trait\s+([A-Za-z_]\w*)/gm,
        /^enum\s+([A-Za-z_]\w*)/gm,
        /^function\s+([A-Za-z_]\w*)\s*\(/gm
      ];
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          if (match[1])
            exports3.push(match[1]);
        }
      }
      return [...new Set(exports3)];
    }
    var PhpParser = {
      lang: "php",
      extensions: [".php", ".phtml", ".php3", ".php4", ".php5", ".php7"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.phpEntityPatterns
    };
    (0, registry_1.registerParser)(PhpParser);
  }
});

// dist/languages/ruby.js
var require_ruby = __commonJS({
  "dist/languages/ruby.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.rubyEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function sanitizeMethodName(name) {
      if (name.endsWith("!"))
        return `${name.slice(0, -1)}_bang`;
      if (name.endsWith("?"))
        return `${name.slice(0, -1)}_pred`;
      if (name.endsWith("="))
        return `${name.slice(0, -1)}_eq`;
      return name;
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`^[ \\t]*def\\s+(?:self\\.)?${escapeRegex(name)}(?:[!?=])?\\s*(\\(|$)`, "m");
      const defLineIdx = lines.findIndex((l) => defRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      const bodyLines = [];
      let depth = 0;
      for (let i = defLineIdx; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (/\b(def|class|module|do\b|begin|if(?!.*\bend\b)|unless(?!.*\bend\b)|while(?!.*\bend\b)|until(?!.*\bend\b)|for\s|case\b)\b/.test(trimmed)) {
          depth++;
        }
        if (/\bend\b/.test(trimmed)) {
          depth--;
          if (depth <= 0) {
            bodyLines.push(line);
            break;
          }
        }
        bodyLines.push(line);
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|elsif|else|unless|while|until|for|rescue|when|and|or|&&|\|\|)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.rubyEntityPatterns = [
      // class declarations (class Foo, class Foo < Bar)
      {
        regex: /^[ \t]*class\s+([A-Z]\w*(?:::[A-Z]\w*)*)\s*(?:<\s*\S+)?\s*$/gm,
        type: "class"
      },
      // module declarations
      {
        regex: /^[ \t]*module\s+([A-Z]\w*(?:::[A-Z]\w*)*)\s*$/gm,
        type: "class"
      },
      // singleton methods: def self.method_name[!?=]
      {
        regex: /^[ \t]*def\s+self\.([A-Za-z_]\w*[!?=]?)\s*(?:\(|$)/gm,
        type: "function"
      },
      // instance methods: def method_name[!?=]
      {
        regex: /^[ \t]*def\s+([A-Za-z_]\w*[!?=]?)\s*(?:\(|$)/gm,
        type: "function"
      }
    ];
    function extractEntities(code, _filePath) {
      const entities = [];
      for (const { regex, type } of exports2.rubyEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const rawName = match[1];
          if (!rawName)
            continue;
          const name = type === "function" ? sanitizeMethodName(rawName) : rawName;
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (entities.some((e) => e.name === name && e.line === line))
            continue;
          entities.push({
            name,
            type,
            line,
            complexity: type === "function" ? estimateComplexity(code, rawName) : "low"
          });
        }
      }
      return entities;
    }
    function extractImports(code) {
      const imports = [];
      const requirePattern = /^[ \t]*require\s+['"]([^'"]+)['"]/gm;
      let match;
      while ((match = requirePattern.exec(code)) !== null) {
        const source = match[1];
        const name = source.split("/").pop() || source;
        imports.push({ source, names: [name], isLocal: false });
      }
      const relPattern = /^[ \t]*require_relative\s+['"]([^'"]+)['"]/gm;
      while ((match = relPattern.exec(code)) !== null) {
        const source = match[1];
        const name = source.split("/").pop() || source;
        imports.push({ source, names: [name], isLocal: true });
      }
      const loadPattern = /^[ \t]*load\s+['"]([^'"]+)['"]/gm;
      while ((match = loadPattern.exec(code)) !== null) {
        const source = match[1];
        const name = source.split("/").pop()?.replace(/\.rb$/, "") || source;
        imports.push({ source, names: [name], isLocal: true });
      }
      const mixinPattern = /^[ \t]*(?:include|extend|prepend)\s+([A-Z]\w*(?:::[A-Z]\w*)*)/gm;
      while ((match = mixinPattern.exec(code)) !== null) {
        const source = match[1];
        const name = source.split("::").pop() || source;
        imports.push({ source, names: [name], isLocal: false });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const typePattern = /^(?:class|module)\s+([A-Z]\w*(?:::[A-Z]\w*)*)/gm;
      let match;
      while ((match = typePattern.exec(code)) !== null) {
        exports3.push(match[1]);
      }
      const attrPattern = /^[ \t]*attr_(?:reader|writer|accessor)\s+(.+)$/gm;
      while ((match = attrPattern.exec(code)) !== null) {
        const syms = match[1].split(",").map((s) => s.trim().replace(/^:/, ""));
        exports3.push(...syms.filter(Boolean));
      }
      const pubFuncPattern = /^[ \t]*(?:module_function|public)\s+def\s+([A-Za-z_]\w*[!?=]?)/gm;
      while ((match = pubFuncPattern.exec(code)) !== null) {
        exports3.push(sanitizeMethodName(match[1]));
      }
      return [...new Set(exports3)];
    }
    var RubyParser = {
      lang: "ruby",
      extensions: [".rb", ".rake", ".gemspec"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.rubyEntityPatterns
    };
    (0, registry_1.registerParser)(RubyParser);
  }
});

// dist/languages/swift.js
var require_swift = __commonJS({
  "dist/languages/swift.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.swiftEntityPatterns = void 0;
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`(?:^|\\s)(?:func\\s+${escapeRegex(name)}|init|deinit|subscript)\\s*(?:<[^>]*>)?\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => defRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === "{") {
            braceCount++;
            started = true;
          } else if (ch === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0)
          break;
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|else|for\s|while|repeat|switch|case|catch|guard|&&|\|\|)\b/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.swiftEntityPatterns = [
      // class (including final class, open class, public class)
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|open|final|@MainActor)\s+)*class\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
        type: "class"
      },
      // struct
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate)\s+)*struct\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
        type: "class"
      },
      // enum
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|indirect)\s+)*enum\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
        type: "class"
      },
      // protocol
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate)\s+)*protocol\s+([A-Za-z_]\w*)(?:\s*<[^{]*?)?\s*(?::\s*[^{]+)?\s*\{/gm,
        type: "interface"
      },
      // actor (Swift 5.5+)
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|distributed)\s+)*actor\s+([A-Za-z_]\w*)(?:\s*:\s*[^{]+)?\s*\{/gm,
        type: "class"
      },
      // extension (cross-file method container, same type as class in Python extractor)
      // Supports: extension Foo, extension Array where Element: Comparable
      {
        regex: /^[ \t]*extension\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s*<[^>{]*>)?(?:\s*:\s*[^{]+)?(?:\s+where\s+[^{]+)?\s*\{/gm,
        type: "class"
      },
      // function declarations (including mutating, static, class func, override, async, throws)
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|open|override|static|class|mutating|nonmutating|dynamic|final|required|convenience|async|throws|rethrows|nonisolated|@discardableResult|@objc|@MainActor)\s+)*func\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
        type: "function"
      },
      // init declarations
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|override|required|convenience)\s+)*init\??\s*(?:<[^>]*>)?\s*\(/gm,
        type: "function"
      },
      // deinit
      {
        regex: /^[ \t]*deinit\s*\{/gm,
        type: "function"
      },
      // subscript
      {
        regex: /^[ \t]*(?:(?:public|internal|private|fileprivate|static|override)\s+)*subscript\s*(?:<[^>]*>)?\s*\(/gm,
        type: "function"
      }
    ];
    function extractEntities(code, _filePath) {
      const entities = [];
      for (const { regex, type } of exports2.swiftEntityPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const name = match[1] ?? (/\binit\b/.test(match[0]) ? "init" : /\bdeinit\b/.test(match[0]) ? "deinit" : "subscript");
          const upToMatch = code.slice(0, match.index);
          const line = upToMatch.split("\n").length;
          if (entities.some((e) => e.name === name && e.line === line))
            continue;
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
      const importPattern = /^[ \t]*import\s+(?:(?:class|struct|enum|func|var|let|typealias)\s+)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/gm;
      let match;
      while ((match = importPattern.exec(code)) !== null) {
        const fullPath = match[1];
        const moduleName = fullPath.split(".")[0];
        if (["class", "struct", "enum", "func", "var", "let", "typealias"].includes(moduleName))
          continue;
        imports.push({
          source: moduleName,
          names: [moduleName],
          isLocal: false
        });
      }
      return imports;
    }
    function extractExports(code) {
      const exports3 = [];
      const publicPatterns = [
        // public/open class, struct, enum, protocol, actor, extension
        /^(?:(?:public|open|final)\s+)*(?:class|struct|enum|protocol|actor)\s+([A-Za-z_]\w*)/gm,
        // public extension is not really an export, but surfaces it for graph linking
        /^(?:public\s+)?extension\s+([A-Za-z_]\w*)/gm,
        // public func
        /^[ \t]*(?:public|open)\s+(?:(?:static|class|override|mutating|async|throws|nonisolated)\s+)*func\s+([A-Za-z_]\w*)/gm,
        // public var / let
        /^[ \t]*(?:public|open)\s+(?:(?:static|class|lazy|private\(set\)|internal\(set\))\s+)*(?:var|let)\s+([A-Za-z_]\w*)/gm,
        // public init
        /^[ \t]*(?:public|open)\s+(?:required\s+|convenience\s+)?init/gm
      ];
      for (const pattern of publicPatterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          if (match[1])
            exports3.push(match[1]);
        }
      }
      return [...new Set(exports3)];
    }
    var SwiftParser = {
      lang: "swift",
      extensions: [".swift"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.swiftEntityPatterns
    };
    (0, registry_1.registerParser)(SwiftParser);
  }
});

// dist/languages/dart.js
var require_dart = __commonJS({
  "dist/languages/dart.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DartParser = exports2.dartEntityPatterns = void 0;
    exports2.cleanDartComments = cleanDartComments;
    exports2._fileStem = _fileStem;
    exports2._makeId = _makeId;
    exports2._splitTypes = _splitTypes;
    exports2._findMatchingBrace = _findMatchingBrace;
    exports2.estimateComplexity = estimateComplexity;
    exports2.extractDart = extractDart;
    var fs_12 = __importDefault2(require("fs"));
    var path_1 = __importDefault2(require("path"));
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function cleanDartComments(src) {
      const commentStringPattern = /r?"""(?:\\.|[\s\S])*?"""|r?'''(?:\\.|[\s\S])*?'''|r?"(?:\\.|[^"\\])*"|r?'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
      return src.replace(commentStringPattern, (token) => {
        if (token.startsWith("/")) {
          const newlineCount = (token.match(/\n/g) || []).length;
          return "\n".repeat(newlineCount);
        }
        return token;
      });
    }
    function _fileStem(filePath) {
      const base = path_1.default.basename(filePath);
      const ext = path_1.default.extname(base);
      return ext ? base.slice(0, -ext.length) : base;
    }
    function _makeId(...parts) {
      return parts.filter((p) => Boolean(p && p.trim())).map((p) => p.trim().replace(/[^a-zA-Z0-9_.-]/g, "_")).join("__");
    }
    function _splitTypes(text) {
      const parts = [];
      const current = [];
      let depth = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === "<") {
          depth++;
          current.push(char);
        } else if (char === ">") {
          depth--;
          current.push(char);
        } else if (char === "," && depth === 0) {
          const trimmed = current.join("").trim();
          if (trimmed)
            parts.push(trimmed);
          current.length = 0;
        } else {
          current.push(char);
        }
      }
      if (current.length > 0) {
        const trimmed = current.join("").trim();
        if (trimmed)
          parts.push(trimmed);
      }
      return parts;
    }
    function _findMatchingBrace(text, startPos) {
      let braceCount = 0;
      let inDoubleQuote = false;
      let inSingleQuote = false;
      let escape = false;
      const firstBrace = text.indexOf("{", startPos);
      if (firstBrace === -1)
        return text.length;
      braceCount = 1;
      let i = firstBrace + 1;
      const n = text.length;
      while (i < n) {
        const char = text[i];
        if (escape) {
          escape = false;
          i++;
          continue;
        }
        if (char === "\\") {
          escape = true;
          i++;
          continue;
        }
        if (text.slice(i, i + 3) === '"""' && !inSingleQuote) {
          i += 3;
          const end = text.indexOf('"""', i);
          i = end !== -1 ? end + 3 : n;
          continue;
        }
        if (text.slice(i, i + 3) === "'''" && !inDoubleQuote) {
          i += 3;
          const end = text.indexOf("'''", i);
          i = end !== -1 ? end + 3 : n;
          continue;
        }
        if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
        } else if (!inDoubleQuote && !inSingleQuote) {
          if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;
            if (braceCount === 0) {
              return i + 1;
            }
          }
        }
        i++;
      }
      return text.length;
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`(?:^|\\s)(?:[\\w<>\\[\\],.?]+\\s+)?${escapeRegex(name)}\\s*(?:<[^>]*>)?\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => defRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{") && !lines[startLine].includes("=>")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      if (lines[startLine].includes("=>") && !lines[startLine].includes("{")) {
        const arrowStmt = lines.slice(startLine, startLine + 5).join("\n");
        const branches2 = (arrowStmt.match(/\b(if|else|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []).length;
        if (branches2 <= constants_1.COMPLEXITY_THRESHOLDS.low)
          return "low";
        if (branches2 <= constants_1.COMPLEXITY_THRESHOLDS.medium)
          return "medium";
        return "high";
      }
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === "{") {
            braceCount++;
            started = true;
          } else if (ch === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0)
          break;
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|else|for|while|do|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.dartEntityPatterns = [
      // class, abstract class, sealed class, mixin class, base class, interface class, final class, enum, extension type
      {
        regex: /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+([A-Za-z_]\w*)/gm,
        type: "class"
      },
      // extension MyExt on MyClass (named extension)
      {
        regex: /^[ \t]{0,4}extension\s+([A-Za-z_]\w+)(?:<[^>]+>)?\s+on\s+[A-Za-z_]\w*/gm,
        type: "class"
      },
      // typedef
      {
        regex: /^[ \t]*typedef\s+(?:[\w<>,.?\s]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]+>)?\s*(?:=|\()/gm,
        type: "type"
      },
      // methods, functions, getters/setters, constructors
      {
        regex: /^[ \t]{0,2}(?:(?:factory|static|async|external|abstract)\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+([A-Za-z_]\w*)\s*\(/gm,
        type: "function"
      }
    ];
    var DART_KEYWORDS = /* @__PURE__ */ new Set([
      "if",
      "for",
      "while",
      "switch",
      "case",
      "catch",
      "return",
      "void",
      "dynamic",
      "final",
      "const",
      "get",
      "set",
      "true",
      "false",
      "null",
      "default",
      "break",
      "continue",
      "throw",
      "rethrow",
      "assert",
      "class",
      "mixin",
      "enum",
      "extension",
      "typedef",
      "import",
      "export",
      "part",
      "library",
      "with",
      "implements",
      "extends",
      "on"
    ]);
    var DART_PRIMITIVE_TYPES = /* @__PURE__ */ new Set([
      "String",
      "int",
      "double",
      "bool",
      "num",
      "dynamic",
      "Object",
      "void",
      "List",
      "Map",
      "Set",
      "Future",
      "Stream",
      "Function",
      "Record"
    ]);
    function extractEntities(code, filePath) {
      const cleanCode = cleanDartComments(code);
      const entities = [];
      const stem = _fileStem(filePath);
      function lineAt(offset) {
        return cleanCode.slice(0, offset).split("\n").length;
      }
      const classPattern = /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/gm;
      let m;
      while ((m = classPattern.exec(cleanCode)) !== null) {
        const className = m[1];
        if (DART_KEYWORDS.has(className))
          continue;
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === className && e.line === line)) {
          entities.push({
            name: className,
            type: "class",
            line,
            complexity: "low"
          });
        }
      }
      const extPattern = /^[ \t]{0,4}extension\s+(?:(\w+)(?:<[^>]+>)?\s+)?on\s+(\w+)/gm;
      while ((m = extPattern.exec(cleanCode)) !== null) {
        const extName = m[1] || `${stem}_anonymous_extension`;
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === extName && e.line === line)) {
          entities.push({
            name: extName,
            type: "class",
            line,
            complexity: "low"
          });
        }
      }
      const typedefPattern = /^[ \t]*typedef\s+(?:[\w<>,.?\s]+\s+)?(\w+)\s*(?:<[^>]+>)?\s*(?:=\s*([^;]+)|\([^;]*\));/gm;
      while ((m = typedefPattern.exec(cleanCode)) !== null) {
        const typedefName = m[1];
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === typedefName && e.line === line)) {
          entities.push({
            name: typedefName,
            type: "type",
            line,
            complexity: "low"
          });
        }
      }
      const varPattern = /^[ \t]{0,2}(?:late\s+)?(?:(?:final|const|var)\s+)?(?:\([^)]+\)\s+|([a-zA-Z0-9_<>,.?]+(?:\s+[a-zA-Z0-9_<>,.?]+){0,3})\s+)?(?:(\w+)|(?:\w+\s*)?\(([^)]+)\))\s*(?:=|$|;)/gm;
      while ((m = varPattern.exec(cleanCode)) !== null) {
        const varType = m[1];
        const singleName = m[2];
        const destructured = m[3];
        if (!/^[ \t]*(?:late|final|const|var)\b/.test(m[0]) && !varType) {
          continue;
        }
        if (singleName && !DART_KEYWORDS.has(singleName) && !/^[A-Z]/.test(singleName)) {
          const line = lineAt(m.index);
          if (!entities.some((e) => e.name === singleName && e.line === line)) {
            entities.push({
              name: singleName,
              type: "variable",
              line,
              complexity: "low"
            });
          }
        } else if (destructured) {
          const line = lineAt(m.index);
          const names = destructured.split(",").map((n) => n.includes(":") ? n.split(":").pop().trim() : n.trim()).filter((n) => /^[a-zA-Z_]\w*$/.test(n) && !/^[A-Z]/.test(n) && !DART_KEYWORDS.has(n));
          for (const name of names) {
            if (!entities.some((e) => e.name === name && e.line === line)) {
              entities.push({
                name,
                type: "variable",
                line,
                complexity: "low"
              });
            }
          }
        }
      }
      const methodPattern = /^[ \t]{0,2}(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+(?:\.\w+)?)\s*\(/gm;
      while ((m = methodPattern.exec(cleanCode)) !== null) {
        const rawName = m[1];
        const name = rawName.split(".").pop();
        if (DART_KEYWORDS.has(name) || /^[A-Z]/.test(name))
          continue;
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === name && e.line === line)) {
          entities.push({
            name,
            type: "function",
            line,
            complexity: estimateComplexity(cleanCode, name)
          });
        }
      }
      const propPattern = /^[ \t]{0,2}(?:(?:static|final|late)\s+)*(?:[\w<>\[\]?]+\s+)?(?:get|set)\s+([A-Za-z_]\w*)/gm;
      while ((m = propPattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (DART_KEYWORDS.has(name))
          continue;
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === name && e.line === line)) {
          entities.push({
            name,
            type: "function",
            line,
            complexity: estimateComplexity(cleanCode, name)
          });
        }
      }
      const annotationPattern = /@(\w+)(?:\([^)]*\))?/g;
      while ((m = annotationPattern.exec(cleanCode)) !== null) {
        const annotationName = m[1];
        if (annotationName.toLowerCase() === "riverpod") {
          const annotationPos = annotationPattern.lastIndex;
          const intervening = cleanCode.slice(annotationPos, annotationPos + 300);
          const classM = /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/m.exec(intervening);
          const funcM = /^[ \t]*(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+)\s*\(/m.exec(intervening);
          let targetName = null;
          let isClass = false;
          if (classM && funcM) {
            if (classM.index < funcM.index) {
              targetName = classM[1];
              isClass = true;
            } else {
              targetName = funcM[1];
            }
          } else if (classM) {
            targetName = classM[1];
            isClass = true;
          } else if (funcM) {
            targetName = funcM[1];
          }
          if (targetName) {
            const providerName = isClass ? (targetName.length > 1 ? targetName[0].toLowerCase() + targetName.slice(1) : targetName.toLowerCase()) + "Provider" : targetName + "Provider";
            const line = lineAt(m.index);
            if (!entities.some((e) => e.name === providerName && e.line === line)) {
              entities.push({
                name: providerName,
                type: "variable",
                line,
                complexity: "low"
              });
            }
          }
        }
      }
      return entities;
    }
    function extractImports(code) {
      const cleanCode = cleanDartComments(code);
      const imports = [];
      const importPattern = /^[ \t]*import\s+['"]([^'"]+)['"](?:\s+(?:deferred\s+)?as\s+([A-Za-z_]\w*))?((?:\s+(?:show|hide)\s+[A-Za-z0-9_,\s]+)*)\s*;/gm;
      let m;
      while ((m = importPattern.exec(cleanCode)) !== null) {
        const source = m[1];
        const alias = m[2];
        const clauses = m[3] || "";
        const isLocal = !source.startsWith("package:") && !source.startsWith("dart:");
        const names = [];
        const showMatch = clauses.match(/\bshow\s+([^;]+)/);
        if (showMatch) {
          const shown = showMatch[1].split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
          names.push(...shown);
        } else if (alias) {
          names.push(alias);
        } else {
          const baseName = path_1.default.basename(source);
          const cleanStem = baseName.endsWith(".dart") ? baseName.slice(0, -5) : baseName;
          names.push(cleanStem);
        }
        imports.push({
          source,
          names: [...new Set(names)],
          isLocal
        });
      }
      return imports;
    }
    function extractExports(code) {
      const cleanCode = cleanDartComments(code);
      const exports3 = [];
      const exportPattern = /^[ \t]*export\s+['"]([^'"]+)['"](?:\s+show\s+([A-Za-z0-9_,\s]+))?\s*;/gm;
      let m;
      while ((m = exportPattern.exec(cleanCode)) !== null) {
        const showClause = m[2];
        if (showClause) {
          const names = showClause.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
          exports3.push(...names);
        } else {
          const base = path_1.default.basename(m[1]);
          const stem = base.endsWith(".dart") ? base.slice(0, -5) : base;
          exports3.push(stem);
        }
      }
      const typePattern = /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+([A-Za-z_]\w*)/gm;
      while ((m = typePattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (!name.startsWith("_") && !DART_KEYWORDS.has(name)) {
          exports3.push(name);
        }
      }
      const extPattern = /^[ \t]{0,4}extension\s+([A-Za-z_]\w+)(?:<[^>]+>)?\s+on\s+[A-Za-z_]\w*/gm;
      while ((m = extPattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (name && !name.startsWith("_") && !DART_KEYWORDS.has(name)) {
          exports3.push(name);
        }
      }
      const typedefPattern = /^[ \t]*typedef\s+(?:[\w<>,.?\s]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]+>)?\s*(?:=|\()/gm;
      while ((m = typedefPattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (!name.startsWith("_") && !DART_KEYWORDS.has(name)) {
          exports3.push(name);
        }
      }
      const funcPattern = /^[ \t]{0,2}(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+([A-Za-z_]\w*)\s*\(/gm;
      while ((m = funcPattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (!name.startsWith("_") && !/^[A-Z]/.test(name) && !DART_KEYWORDS.has(name)) {
          exports3.push(name);
        }
      }
      const varPattern = /^[ \t]{0,2}(?:(?:final|const|var)\s+)(?:[a-zA-Z0-9_<>,.?]+\s+)?([A-Za-z_]\w*)\s*=/gm;
      while ((m = varPattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (!name.startsWith("_") && !DART_KEYWORDS.has(name)) {
          exports3.push(name);
        }
      }
      return [...new Set(exports3)];
    }
    exports2.DartParser = {
      lang: "dart",
      extensions: [".dart"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.dartEntityPatterns
    };
    (0, registry_1.registerParser)(exports2.DartParser);
    function extractDart(fileInput) {
      let src;
      let filePathStr;
      if (typeof fileInput === "string") {
        filePathStr = fileInput;
        const isPath = (fileInput.endsWith(".dart") || fileInput.includes("/") || fileInput.includes("\\")) && !fileInput.includes("\n");
        if (isPath) {
          try {
            src = fs_12.default.readFileSync(fileInput, "utf-8");
          } catch (err) {
            return { nodes: [], edges: [], error: `cannot read ${fileInput}` };
          }
        } else {
          src = fileInput;
          filePathStr = "main.dart";
        }
      } else {
        filePathStr = fileInput.path;
        try {
          src = fileInput.readText ? fileInput.readText() : fs_12.default.readFileSync(fileInput.path, "utf-8");
        } catch (err) {
          return { nodes: [], edges: [], error: `cannot read ${fileInput.path}` };
        }
      }
      const srcClean = cleanDartComments(src);
      function lineAt(offset) {
        return srcClean.slice(0, offset).split("\n").length;
      }
      let stem = _fileStem(filePathStr);
      let fileNid = _makeId(filePathStr);
      let isPart = false;
      const partOfMatch = /^\s*part\s+of\s+['"]([^'"]+)['"]/m.exec(srcClean);
      if (partOfMatch) {
        const parentRef = partOfMatch[1];
        if (parentRef.endsWith(".dart")) {
          try {
            const parentPath = path_1.default.resolve(path_1.default.dirname(filePathStr), parentRef);
            if (fs_12.default.existsSync(parentPath)) {
              stem = _fileStem(parentPath);
              fileNid = _makeId(parentPath);
              isPart = true;
            }
          } catch {
          }
        }
      }
      const nodes = [];
      if (!isPart) {
        nodes.push({
          id: fileNid,
          label: path_1.default.basename(filePathStr),
          file_type: "code",
          source_file: filePathStr,
          source_location: null
        });
      }
      const edges = [];
      const defined = /* @__PURE__ */ new Set();
      function addNode(nid, label, ftype = "code", sourceFile = filePathStr, line = null) {
        if (!defined.has(nid)) {
          nodes.push({
            id: nid,
            label,
            file_type: ftype,
            source_file: sourceFile,
            source_location: line ? `L${line}` : null
          });
          defined.add(nid);
        }
      }
      function addEdge(srcId, tgtId, relation, weight = 1, context, line) {
        const edge = {
          source: srcId,
          target: tgtId,
          relation,
          confidence: "EXTRACTED",
          confidence_score: 1,
          source_file: filePathStr,
          source_location: line ? `L${line}` : null,
          weight
        };
        if (context)
          edge.context = context;
        edges.push(edge);
      }
      const classPattern = /^\s*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/gm;
      let m;
      while ((m = classPattern.exec(srcClean)) !== null) {
        const className = m[1];
        const classLine = lineAt(m.index + m[0].indexOf(className));
        const classNid = _makeId(stem, className);
        addNode(classNid, className, "code", filePathStr, classLine);
        addEdge(fileNid, classNid, "defines", 1, void 0, classLine);
        const startIdx = classPattern.lastIndex;
        let rest = srcClean.slice(startIdx, startIdx + 500);
        if (rest.trimStart().startsWith("<")) {
          const offset = rest.indexOf("<");
          let depth = 1;
          let i = offset + 1;
          while (i < rest.length && depth > 0) {
            if (rest[i] === "<")
              depth++;
            else if (rest[i] === ">")
              depth--;
            i++;
          }
          rest = rest.slice(i);
        }
        if (rest.trimStart().startsWith("(")) {
          const offset = rest.indexOf("(");
          let depth = 1;
          let i = offset + 1;
          while (i < rest.length && depth > 0) {
            if (rest[i] === "(")
              depth++;
            else if (rest[i] === ")")
              depth--;
            i++;
          }
          rest = rest.slice(i);
        }
        let headerEnd = rest.indexOf("{");
        if (headerEnd === -1)
          headerEnd = rest.indexOf(";");
        if (headerEnd === -1)
          headerEnd = rest.length;
        let header = rest.slice(0, headerEnd);
        let baseClass = null;
        let generics = null;
        let mixinsList = [];
        let interfacesList = [];
        const extendsM = /^\s*(?:extends|on)\s+([a-zA-Z0-9_.]+)/.exec(header);
        if (extendsM) {
          baseClass = extendsM[1];
          const restHeader = header.slice(extendsM.index + extendsM[0].length);
          if (restHeader.trimStart().startsWith("<")) {
            const startBracket = restHeader.indexOf("<");
            let depth = 1;
            let i = startBracket + 1;
            while (i < restHeader.length && depth > 0) {
              if (restHeader[i] === "<")
                depth++;
              else if (restHeader[i] === ">") {
                depth--;
                if (depth === 0) {
                  generics = restHeader.slice(startBracket + 1, i);
                  break;
                }
              }
              i++;
            }
            header = generics !== null ? restHeader.slice(i + 1) : restHeader;
          } else {
            header = restHeader;
          }
        }
        const withM = /^\s*with\s+/.exec(header);
        if (withM) {
          const restHeader = header.slice(withM.index + withM[0].length);
          const implIdx = restHeader.indexOf("implements");
          let mixinsStr = "";
          if (implIdx !== -1) {
            mixinsStr = restHeader.slice(0, implIdx);
            header = restHeader.slice(implIdx);
          } else {
            mixinsStr = restHeader;
            header = "";
          }
          mixinsList = _splitTypes(mixinsStr);
        }
        const implM = /^\s*implements\s+/.exec(header);
        if (implM) {
          interfacesList = _splitTypes(header.slice(implM.index + implM[0].length));
        }
        if (baseClass) {
          const baseNid = _makeId(baseClass);
          addNode(baseNid, baseClass, "code", null);
          addEdge(classNid, baseNid, "inherits", 1, void 0, classLine);
          if (generics) {
            for (const gen of _splitTypes(generics)) {
              const genClean = gen.split("<")[0].trim();
              if (!DART_PRIMITIVE_TYPES.has(genClean)) {
                const genNid = _makeId(genClean);
                addNode(genNid, genClean, "code", null);
                addEdge(classNid, genNid, "references", 1, void 0, classLine);
              }
            }
          }
        }
        for (const mixin of mixinsList) {
          const mixinClean = mixin.split("<")[0].trim();
          const mixinNid = _makeId(mixinClean);
          addNode(mixinNid, mixinClean, "code", null);
          addEdge(classNid, mixinNid, "mixes_in", 1, void 0, classLine);
        }
        for (const iface of interfacesList) {
          const ifaceClean = iface.split("<")[0].trim();
          const ifaceNid = _makeId(ifaceClean);
          addNode(ifaceNid, ifaceClean, "code", null);
          addEdge(classNid, ifaceNid, "implements", 1, void 0, classLine);
        }
        const declStart = m.index;
        const bracePos = srcClean.indexOf("{", declStart);
        const semiPos = srcClean.indexOf(";", declStart);
        let hasBody = bracePos !== -1;
        if (hasBody && semiPos !== -1 && semiPos < bracePos) {
          hasBody = false;
        }
        if (hasBody) {
          const endPos = _findMatchingBrace(srcClean, declStart);
          const classBody = srcClean.slice(bracePos, endPos);
          const onEventRegex = /\bon<(\w+)>\s*\(/g;
          let em;
          while ((em = onEventRegex.exec(classBody)) !== null) {
            const eventName = em[1];
            const eventNid = _makeId(eventName);
            addNode(eventNid, eventName, "code", null);
            addEdge(classNid, eventNid, "calls", 1, "bloc_event", lineAt(bracePos + em.index));
          }
          const emitRegex = /\b(?:emit|yield)\s*\(?\s*(?:const\s+)?([A-Z]\w*)\b/g;
          let sm;
          while ((sm = emitRegex.exec(classBody)) !== null) {
            const stateName = sm[1];
            if (!DART_PRIMITIVE_TYPES.has(stateName)) {
              const stateNid = _makeId(stateName);
              addNode(stateNid, stateName, "code", null);
              addEdge(classNid, stateNid, "calls", 1, "emit_state", lineAt(bracePos + sm.index));
            }
          }
          const addEventRegex = /\b(?:(?:\w*[Bb]loc\w*|context\.read<\w+>\(\)|widget)\.)?add\(\s*(?:const\s+)?([A-Z]\w*)\b/g;
          let am;
          while ((am = addEventRegex.exec(classBody)) !== null) {
            const eventName = am[1];
            if (!DART_PRIMITIVE_TYPES.has(eventName)) {
              const eventNid = _makeId(eventName);
              addNode(eventNid, eventName, "code", null);
              addEdge(classNid, eventNid, "calls", 1, "bloc_add_event", lineAt(bracePos + am.index));
            }
          }
          const refRegex = /\bref\.(?:watch|read|listen)\s*\(\s*(\w+)\b/g;
          let rm;
          while ((rm = refRegex.exec(classBody)) !== null) {
            const providerName = rm[1];
            const providerNid = _makeId(providerName);
            addNode(providerNid, providerName, "code", null);
            addEdge(classNid, providerNid, "references", 1, "riverpod_reference", lineAt(bracePos + rm.index));
          }
          const widgetBlocRegex = /\bBloc(?:Builder|Listener|Consumer|Provider|Selector)\s*<\s*([a-zA-Z0-9_]+)\b/g;
          let bm;
          while ((bm = widgetBlocRegex.exec(classBody)) !== null) {
            const blocName = bm[1];
            if (!DART_PRIMITIVE_TYPES.has(blocName)) {
              const blocNid = _makeId(blocName);
              addNode(blocNid, blocName, "code", null);
              addEdge(classNid, blocNid, "references", 1, "bloc_widget_binding", lineAt(bracePos + bm.index));
            }
          }
          const contextLookupRegex = /\b(?:read|watch|select|of)\s*<([a-zA-Z0-9_]+)>/g;
          let lm;
          while ((lm = contextLookupRegex.exec(classBody)) !== null) {
            const blocName = lm[1];
            if (!DART_PRIMITIVE_TYPES.has(blocName)) {
              const blocNid = _makeId(blocName);
              addNode(blocNid, blocName, "code", null);
              addEdge(classNid, blocNid, "references", 1, "bloc_lookup", lineAt(bracePos + lm.index));
            }
          }
        }
      }
      const annotationPattern = /@(\w+)(?:\([^)]*\))?/g;
      let anMatch;
      while ((anMatch = annotationPattern.exec(srcClean)) !== null) {
        const annotationName = anMatch[1];
        if (["override", "deprecated", "required", "protected", "mustCallSuper"].includes(annotationName)) {
          continue;
        }
        const annotationPos = annotationPattern.lastIndex;
        const intervening = srcClean.slice(annotationPos, annotationPos + 300);
        const classM = /^\s*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/m.exec(intervening);
        const funcM = /^\s*(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+)\s*\(/m.exec(intervening);
        let targetNid = null;
        let targetName = null;
        let targetType = null;
        if (classM && funcM) {
          if (classM.index < funcM.index) {
            targetName = classM[1];
            targetType = "class";
            targetNid = _makeId(stem, targetName);
          } else {
            targetName = funcM[1];
            targetType = "function";
            targetNid = _makeId(stem, targetName);
          }
        } else if (classM) {
          targetName = classM[1];
          targetType = "class";
          targetNid = _makeId(stem, targetName);
        } else if (funcM) {
          targetName = funcM[1];
          targetType = "function";
          targetNid = _makeId(stem, targetName);
        }
        if (targetNid && targetName) {
          const minOffset = Math.min(classM ? classM.index : 300, funcM ? funcM.index : 300);
          const actualIntervening = intervening.slice(0, minOffset);
          if (!actualIntervening.includes(";") && !actualIntervening.includes("}") && !actualIntervening.includes("{")) {
            const annotationLine = lineAt(anMatch.index);
            const annotationNid = _makeId("annotation", annotationName.toLowerCase());
            addNode(annotationNid, `@${annotationName}`, "concept", null);
            addEdge(targetNid, annotationNid, "configures", 1, void 0, annotationLine);
            if (annotationName.toLowerCase() === "riverpod") {
              const providerName = targetType === "class" ? (targetName.length > 1 ? targetName[0].toLowerCase() + targetName.slice(1) : targetName.toLowerCase()) + "Provider" : targetName + "Provider";
              const providerNid = _makeId(providerName);
              addNode(providerNid, providerName, "concept", filePathStr, annotationLine);
              addEdge(targetNid, providerNid, "defines", 1, "riverpod_provider", annotationLine);
            }
          }
        }
      }
      const typedefPattern = /^\s*typedef\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*([^;]+);/gm;
      while ((m = typedefPattern.exec(srcClean)) !== null) {
        const typedefName = m[1];
        const typedefLine = lineAt(m.index);
        const targetType = m[2].split("<")[0].split(".").pop().trim();
        if (!DART_PRIMITIVE_TYPES.has(targetType)) {
          const typedefNid = _makeId(stem, typedefName);
          addNode(typedefNid, typedefName, "code", filePathStr, typedefLine);
          addEdge(fileNid, typedefNid, "defines", 1, void 0, typedefLine);
          const targetNid = _makeId(targetType);
          addNode(targetNid, targetType, "code", null);
          addEdge(typedefNid, targetNid, "references", 1, "typedef", typedefLine);
        }
      }
      const extPattern = /^\s{0,4}extension\s+(?:(\w+)(?:<[^>]+>)?\s+)?on\s+(\w+)/gm;
      while ((m = extPattern.exec(srcClean)) !== null) {
        const extName = m[1] || `${stem}_anonymous_extension`;
        const targetClass = m[2];
        const extLine = lineAt(m.index);
        const extNid = _makeId(stem, extName);
        const label = m[1] || `Extension on ${targetClass}`;
        addNode(extNid, label, "code", filePathStr, extLine);
        addEdge(fileNid, extNid, "defines", 1, void 0, extLine);
        const targetNid = _makeId(targetClass);
        addNode(targetNid, targetClass, "code", null);
        addEdge(extNid, targetNid, "extends", 1, void 0, extLine);
      }
      const varPattern = /^\s{0,2}(?:late\s+)?(?:(?:final|const|var)\s+)?(?:\([^)]+\)\s+|([a-zA-Z0-9_<>,.?]+(?:\s+[a-zA-Z0-9_<>,.?]+){0,3})\s+)?(?:(\w+)|(?:\w+\s*)?\(([^)]+)\))\s*(?:=|$|;)/gm;
      while ((m = varPattern.exec(srcClean)) !== null) {
        const varType = m[1];
        const singleName = m[2];
        const destructuredNames = m[3];
        if (!/^\s*(?:late|final|const|var)\b/.test(m[0]) && !varType) {
          continue;
        }
        if (singleName && !["if", "for", "while", "switch", "catch", "return"].includes(singleName)) {
          const varLine = lineAt(m.index);
          const varNid = _makeId(stem, singleName);
          addNode(varNid, singleName, "code", filePathStr, varLine);
          addEdge(fileNid, varNid, "defines", 1, void 0, varLine);
          if (varType) {
            const cleanType = varType.split("<")[0].split(".").pop().trim();
            if (!DART_PRIMITIVE_TYPES.has(cleanType)) {
              const typeNid = _makeId(cleanType);
              addNode(typeNid, cleanType, "code", null);
              addEdge(fileNid, typeNid, "references", 1, "variable_type", varLine);
            }
          }
        } else if (destructuredNames) {
          const destructureLine = lineAt(m.index);
          const names = destructuredNames.split(",").map((n) => n.includes(":") ? n.split(":").pop().trim() : n.trim()).filter((n) => /^[a-zA-Z_]\w*$/.test(n) && !/^[A-Z]/.test(n) && !["if", "for", "while", "switch", "catch", "return"].includes(n));
          for (const name of names) {
            const varNid = _makeId(stem, name);
            addNode(varNid, name, "code", filePathStr, destructureLine);
            addEdge(fileNid, varNid, "defines", 1, void 0, destructureLine);
          }
        }
      }
      const methodPattern = /^\s{0,2}(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+(?:\.\w+)?)\s*\(/gm;
      while ((m = methodPattern.exec(srcClean)) !== null) {
        const rawName = m[1];
        const name = rawName.split(".").pop();
        if (["if", "for", "while", "switch", "catch", "return", "void", "dynamic", "final", "const", "get", "set"].includes(name)) {
          continue;
        }
        if (/^[A-Z]/.test(name))
          continue;
        const methodLine = lineAt(m.index);
        const nid = _makeId(stem, name);
        addNode(nid, name, "code", filePathStr, methodLine);
        addEdge(fileNid, nid, "defines", 1, void 0, methodLine);
        const startIdx = m.index;
        const bracePos = srcClean.indexOf("{", startIdx);
        const semiPos = srcClean.indexOf(";", startIdx);
        const arrowPos = srcClean.indexOf("=>", startIdx);
        let hasBody = bracePos !== -1;
        if (hasBody && semiPos !== -1 && semiPos < bracePos)
          hasBody = false;
        if (hasBody && arrowPos !== -1 && arrowPos < bracePos)
          hasBody = false;
        if (hasBody) {
          const endPos = _findMatchingBrace(srcClean, startIdx);
          const funcBody = srcClean.slice(bracePos, endPos);
          const refRegex = /\bref\.(?:watch|read|listen)\s*\(\s*(\w+)\b/g;
          let rm;
          while ((rm = refRegex.exec(funcBody)) !== null) {
            const providerName = rm[1];
            const providerNid = _makeId(providerName);
            addNode(providerNid, providerName, "code", null);
            addEdge(nid, providerNid, "references", 1, "riverpod_reference", lineAt(bracePos + rm.index));
          }
          const addEventRegex = /\b(?:(?:\w*[Bb]loc\w*|context\.read<\w+>\(\)|widget)\.)?add\(\s*(?:const\s+)?([A-Z]\w*)\b/g;
          let am;
          while ((am = addEventRegex.exec(funcBody)) !== null) {
            const eventName = am[1];
            if (!DART_PRIMITIVE_TYPES.has(eventName)) {
              const eventNid = _makeId(eventName);
              addNode(eventNid, eventName, "code", null);
              addEdge(nid, eventNid, "calls", 1, "bloc_add_event", lineAt(bracePos + am.index));
            }
          }
          const contextLookupRegex = /\b(?:read|watch|select|of)\s*<([a-zA-Z0-9_]+)>/g;
          let lm;
          while ((lm = contextLookupRegex.exec(funcBody)) !== null) {
            const blocName = lm[1];
            if (!DART_PRIMITIVE_TYPES.has(blocName)) {
              const blocNid = _makeId(blocName);
              addNode(blocNid, blocName, "code", null);
              addEdge(nid, blocNid, "references", 1, "bloc_lookup", lineAt(bracePos + lm.index));
            }
          }
          const routePathRegex = /\b(?:go|push|goNamed|pushNamed|replace|replaceNamed)\s*\(\s*(?:context\s*,\s*)?['"]([a-zA-Z0-9_/?=&%-]+)['"]/g;
          let nm;
          while ((nm = routePathRegex.exec(funcBody)) !== null) {
            const routePath = nm[1];
            const routeNid = _makeId("route", routePath.replace(/[/=&#?-]/g, "_"));
            addNode(routeNid, `Route ${routePath}`, "concept", null);
            addEdge(nid, routeNid, "navigates", 1, "route_path", lineAt(bracePos + nm.index));
          }
          const routeConstRegex = /\b(?:go|push|goNamed|pushNamed|replace|replaceNamed)\s*\(\s*(?:context\s*,\s*)?([A-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+)/g;
          let cm;
          while ((cm = routeConstRegex.exec(funcBody)) !== null) {
            const routeConst = cm[1];
            const routeNid = _makeId("route", routeConst.replace(/\./g, "_"));
            addNode(routeNid, routeConst, "concept", null);
            addEdge(nid, routeNid, "navigates", 1, "route_const", lineAt(bracePos + cm.index));
          }
          const routeObjRegex = /\b(?:push|replace)\s*\(\s*(?:context\s*,\s*)?.*?\b([A-Z]\w*(?:Route|Screen|Page))\b/g;
          let om;
          while ((om = routeObjRegex.exec(funcBody)) !== null) {
            const routeClass = om[1];
            const routeNid = _makeId(routeClass);
            addNode(routeNid, routeClass, "code", null);
            addEdge(nid, routeNid, "navigates", 1, "route_object", lineAt(bracePos + om.index));
          }
        }
      }
      const importPattern = /^\s*import\s+['"]([^'"]+)['"]/gm;
      while ((m = importPattern.exec(srcClean)) !== null) {
        const pkg = m[1];
        const tgtNid = _makeId(pkg);
        addNode(tgtNid, pkg, "code", null);
        addEdge(fileNid, tgtNid, "imports", 1, void 0, lineAt(m.index));
      }
      const exportPattern = /^\s*export\s+['"]([^'"]+)['"]/gm;
      while ((m = exportPattern.exec(srcClean)) !== null) {
        const pkg = m[1];
        const tgtNid = _makeId(pkg);
        addNode(tgtNid, pkg, "code", null);
        addEdge(fileNid, tgtNid, "exports", 1, void 0, lineAt(m.index));
      }
      const genericCallPattern = /\b\w+<([a-zA-Z0-9_.]+(?:<[a-zA-Z0-9_.,\s<>]+>)?)\s*>\s*\(/g;
      while ((m = genericCallPattern.exec(srcClean)) !== null) {
        const typeName = m[1].split(".").pop().trim();
        const cleanName = typeName.split("<")[0].trim();
        if (!DART_PRIMITIVE_TYPES.has(cleanName)) {
          const targetNid = _makeId(cleanName);
          addNode(targetNid, cleanName, "code", null);
          addEdge(fileNid, targetNid, "references", 1, "type_lookup", lineAt(m.index));
        }
      }
      return { nodes, edges };
    }
  }
});

// dist/languages/rust.js
var require_rust = __commonJS({
  "dist/languages/rust.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.RustParser = exports2.rustEntityPatterns = exports2.RUST_TRAIT_METHOD_BLOCKLIST = void 0;
    exports2._fileStem = _fileStem;
    exports2._makeId = _makeId;
    exports2.cleanRustComments = cleanRustComments;
    exports2._splitBalanced = _splitBalanced;
    exports2._findMatchingBrace = _findMatchingBrace;
    exports2._rustCollectTypeRefs = _rustCollectTypeRefs;
    exports2.estimateComplexity = estimateComplexity;
    exports2.extractRust = extractRust;
    var fs_12 = __importDefault2(require("fs"));
    var path_1 = __importDefault2(require("path"));
    var registry_1 = require_registry();
    var constants_1 = require_constants();
    exports2.RUST_TRAIT_METHOD_BLOCKLIST = /* @__PURE__ */ new Set([
      "new",
      "default",
      "parse",
      "from_str",
      "now",
      "clone",
      "into",
      "from",
      "to_string",
      "to_owned",
      "len",
      "is_empty",
      "iter",
      "next",
      "build",
      "start",
      "run",
      "init",
      "app",
      "get",
      "set",
      "push",
      "pop",
      "insert",
      "remove",
      "contains",
      "collect",
      "map",
      "filter",
      "unwrap",
      "expect",
      "ok",
      "err",
      "some",
      "none",
      "send",
      "recv",
      "lock",
      "read",
      "write"
    ]);
    var RUST_PRIMITIVES = /* @__PURE__ */ new Set([
      "bool",
      "char",
      "str",
      "i8",
      "i16",
      "i32",
      "i64",
      "i128",
      "isize",
      "u8",
      "u16",
      "u32",
      "u64",
      "u128",
      "usize",
      "f32",
      "f64",
      "()",
      "!"
    ]);
    var RUST_KEYWORDS = /* @__PURE__ */ new Set([
      "as",
      "async",
      "await",
      "break",
      "const",
      "continue",
      "crate",
      "dyn",
      "else",
      "enum",
      "extern",
      "false",
      "fn",
      "for",
      "if",
      "impl",
      "in",
      "let",
      "loop",
      "match",
      "mod",
      "move",
      "mut",
      "pub",
      "ref",
      "return",
      "self",
      "Self",
      "static",
      "struct",
      "super",
      "trait",
      "true",
      "type",
      "unsafe",
      "use",
      "where",
      "while"
    ]);
    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function _fileStem(filePath) {
      const base = path_1.default.basename(filePath);
      const ext = path_1.default.extname(base);
      return ext ? base.slice(0, -ext.length) : base;
    }
    function _makeId(...parts) {
      return parts.filter((p) => Boolean(p && p.trim())).map((p) => p.trim().replace(/[^a-zA-Z0-9_.-]/g, "_")).join("__");
    }
    function cleanRustComments(src) {
      const commentStringPattern = /b?r(#*)".*?"\1|b?"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
      return src.replace(commentStringPattern, (token) => {
        if (token.startsWith("/")) {
          const newlineCount = (token.match(/\n/g) || []).length;
          return "\n".repeat(newlineCount);
        }
        return token;
      });
    }
    function _splitBalanced(text, delim = ",") {
      const parts = [];
      const current = [];
      let depthAngle = 0;
      let depthParen = 0;
      let depthBracket = 0;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "<")
          depthAngle++;
        else if (ch === ">")
          depthAngle--;
        else if (ch === "(")
          depthParen++;
        else if (ch === ")")
          depthParen--;
        else if (ch === "[")
          depthBracket++;
        else if (ch === "]")
          depthBracket--;
        else if (ch === delim && depthAngle === 0 && depthParen === 0 && depthBracket === 0) {
          const trimmed = current.join("").trim();
          if (trimmed)
            parts.push(trimmed);
          current.length = 0;
          continue;
        }
        current.push(ch);
      }
      if (current.length > 0) {
        const trimmed = current.join("").trim();
        if (trimmed)
          parts.push(trimmed);
      }
      return parts;
    }
    function _findMatchingBrace(text, startPos) {
      let braceCount = 0;
      let inDoubleQuote = false;
      let escape = false;
      const firstBrace = text.indexOf("{", startPos);
      if (firstBrace === -1)
        return text.length;
      braceCount = 1;
      let i = firstBrace + 1;
      const n = text.length;
      while (i < n) {
        const char = text[i];
        if (escape) {
          escape = false;
          i++;
          continue;
        }
        if (char === "\\") {
          escape = true;
          i++;
          continue;
        }
        if (char === '"') {
          inDoubleQuote = !inDoubleQuote;
        } else if (!inDoubleQuote) {
          if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;
            if (braceCount === 0) {
              return i + 1;
            }
          }
        }
        i++;
      }
      return text.length;
    }
    function _rustCollectTypeRefs(typeStr, generic, out) {
      if (!typeStr)
        return;
      const raw = typeStr.trim();
      if (!raw)
        return;
      let clean = raw.replace(/&(?:\s*'[a-zA-Z_]\w*)?\s*(?:mut\s+)?/g, "").trim();
      clean = clean.replace(/^\*(?:const|mut)\s+/g, "").trim();
      if (clean.startsWith("[") && clean.endsWith("]")) {
        const inner = clean.slice(1, -1).split(";")[0].trim();
        _rustCollectTypeRefs(inner, generic, out);
        return;
      }
      if (clean.startsWith("(") && clean.endsWith(")")) {
        const inner = clean.slice(1, -1).trim();
        if (inner) {
          for (const part of _splitBalanced(inner)) {
            _rustCollectTypeRefs(part, generic, out);
          }
        }
        return;
      }
      if (clean.includes("+") && !clean.includes("<")) {
        for (const part of clean.split("+")) {
          _rustCollectTypeRefs(part.trim(), generic, out);
        }
        return;
      }
      if (clean.startsWith("dyn ")) {
        clean = clean.slice(4).trim();
      }
      const angleIdx = clean.indexOf("<");
      if (angleIdx !== -1 && clean.endsWith(">")) {
        const baseType = clean.slice(0, angleIdx).trim();
        const lastBaseSegment = baseType.split("::").pop().trim();
        if (!RUST_PRIMITIVES.has(lastBaseSegment) && lastBaseSegment) {
          out.push([lastBaseSegment, generic ? "generic_arg" : "type"]);
        }
        const argsText = clean.slice(angleIdx + 1, -1).trim();
        const args2 = _splitBalanced(argsText);
        for (const arg of args2) {
          _rustCollectTypeRefs(arg, true, out);
        }
        return;
      }
      const lastSegment = clean.split("::").pop().trim();
      if (!RUST_PRIMITIVES.has(lastSegment) && /^[a-zA-Z_]\w*$/.test(lastSegment)) {
        out.push([lastSegment, generic ? "generic_arg" : "type"]);
      }
    }
    function estimateComplexity(code, name) {
      const lines = code.split("\n");
      const defRegex = new RegExp(`(?:^|\\s)fn\\s+${escapeRegex(name)}\\s*(?:<[^>]*>)?\\s*\\(`, "m");
      const defLineIdx = lines.findIndex((l) => defRegex.test(l));
      if (defLineIdx === -1)
        return "low";
      let startLine = defLineIdx;
      while (startLine < lines.length && !lines[startLine].includes("{")) {
        startLine++;
      }
      if (startLine >= lines.length)
        return "low";
      let braceCount = 0;
      let started = false;
      const bodyLines = [];
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === "{") {
            braceCount++;
            started = true;
          } else if (ch === "}") {
            braceCount--;
          }
        }
        bodyLines.push(line);
        if (started && braceCount <= 0)
          break;
      }
      const body = bodyLines.join("\n");
      const branches = (body.match(/\b(if|else\s+if|else|for|while|loop|match)\b|\?|(&&|\|\|)/g) || []).length;
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.low)
        return "low";
      if (branches <= constants_1.COMPLEXITY_THRESHOLDS.medium)
        return "medium";
      return "high";
    }
    exports2.rustEntityPatterns = [
      // Functions: free functions, methods, async fn, const fn, unsafe fn
      {
        regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)/gm,
        type: "function"
      },
      // Structs
      {
        regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)/gm,
        type: "class"
      },
      // Enums
      {
        regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/gm,
        type: "class"
      },
      // Traits
      {
        regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:unsafe\s+)?trait\s+([A-Za-z_]\w*)/gm,
        type: "interface"
      },
      // Impl blocks: impl Type or impl Trait for Type
      {
        regex: /^[ \t]*impl(?:\s*<[^>]*>)?\s+(?:[A-Za-z_]\w*(?:\s*<[^>]*>)?\s+for\s+)?([A-Za-z_]\w*)/gm,
        type: "class"
      },
      // Type aliases
      {
        regex: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?type\s+([A-Za-z_]\w*)/gm,
        type: "type"
      }
    ];
    function extractEntities(code, _filePath) {
      const cleanCode = cleanRustComments(code);
      const entities = [];
      function lineAt(offset) {
        return cleanCode.slice(0, offset).split("\n").length;
      }
      const itemPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(struct|enum)|(?:unsafe\s+)?(trait))\s+([A-Za-z_]\w*)/gm;
      let m;
      while ((m = itemPattern.exec(cleanCode)) !== null) {
        const isStructOrEnum = Boolean(m[1]);
        const name = m[3];
        if (RUST_KEYWORDS.has(name))
          continue;
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === name && e.line === line)) {
          entities.push({
            name,
            type: isStructOrEnum ? "class" : "interface",
            line,
            complexity: "low"
          });
        }
      }
      const typeAliasPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?type\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*=/gm;
      while ((m = typeAliasPattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (RUST_KEYWORDS.has(name))
          continue;
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === name && e.line === line)) {
          entities.push({
            name,
            type: "type",
            line,
            complexity: "low"
          });
        }
      }
      const fnPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm;
      while ((m = fnPattern.exec(cleanCode)) !== null) {
        const name = m[1];
        if (RUST_KEYWORDS.has(name))
          continue;
        const line = lineAt(m.index);
        if (!entities.some((e) => e.name === name && e.line === line)) {
          entities.push({
            name,
            type: "function",
            line,
            complexity: estimateComplexity(cleanCode, name)
          });
        }
      }
      return entities;
    }
    function extractImports(code) {
      const cleanCode = cleanRustComments(code);
      const imports = [];
      const usePattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?use\s+([^;]+);/gm;
      let m;
      while ((m = usePattern.exec(cleanCode)) !== null) {
        const raw = m[1].trim();
        const isLocal = raw.startsWith("crate::") || raw.startsWith("super::") || raw.startsWith("self::");
        if (raw.includes("{")) {
          const braceStart = raw.indexOf("{");
          const basePrefix = raw.slice(0, braceStart).replace(/::$/, "").trim();
          const inner = raw.slice(braceStart + 1, raw.lastIndexOf("}")).trim();
          const items = inner.split(",").map((s) => s.trim()).filter(Boolean);
          const names = [];
          for (const item of items) {
            if (item === "self") {
              const baseName = basePrefix.split("::").pop();
              names.push(baseName);
            } else if (item.includes(" as ")) {
              const alias = item.split(" as ")[1].trim();
              names.push(alias);
            } else {
              names.push(item.split("::").pop().trim());
            }
          }
          imports.push({
            source: basePrefix,
            names: [...new Set(names)],
            isLocal
          });
        } else {
          let source = "";
          let name = "";
          if (raw.includes(" as ")) {
            const parts = raw.split(" as ");
            source = parts[0].trim();
            name = parts[1].trim();
          } else {
            source = raw.trim();
            const segments = raw.split("::");
            name = segments[segments.length - 1].trim();
          }
          imports.push({
            source,
            names: [name],
            isLocal
          });
        }
      }
      return imports;
    }
    function extractExports(code) {
      const cleanCode = cleanRustComments(code);
      const exports3 = [];
      const itemPattern = /^[ \t]*pub(?:\([^)]*\))?\s+(?:(?:unsafe\s+)?(?:trait)|struct|enum|type)\s+([A-Za-z_]\w*)/gm;
      let m;
      while ((m = itemPattern.exec(cleanCode)) !== null) {
        exports3.push(m[1]);
      }
      const fnPattern = /^[ \t]*pub(?:\([^)]*\))?\s+(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)/gm;
      while ((m = fnPattern.exec(cleanCode)) !== null) {
        exports3.push(m[1]);
      }
      const constPattern = /^[ \t]*pub(?:\([^)]*\))?\s+(?:const|static)\s+([A-Za-z_]\w*)/gm;
      while ((m = constPattern.exec(cleanCode)) !== null) {
        exports3.push(m[1]);
      }
      const usePattern = /^[ \t]*pub(?:\([^)]*\))?\s+use\s+([^;]+);/gm;
      while ((m = usePattern.exec(cleanCode)) !== null) {
        const raw = m[1].trim();
        if (raw.includes("{")) {
          const inner = raw.slice(raw.indexOf("{") + 1, raw.lastIndexOf("}")).trim();
          const items = inner.split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean);
          exports3.push(...items);
        } else {
          const last = raw.split(" as ").pop().split("::").pop().trim();
          if (last && last !== "*")
            exports3.push(last);
        }
      }
      return [...new Set(exports3)];
    }
    exports2.RustParser = {
      lang: "rust",
      extensions: [".rs"],
      extractEntities,
      extractImports,
      extractExports,
      entityPatterns: exports2.rustEntityPatterns
    };
    (0, registry_1.registerParser)(exports2.RustParser);
    function extractRust(fileInput) {
      let source;
      let strPath;
      if (typeof fileInput === "string") {
        strPath = fileInput;
        const isPath = (fileInput.endsWith(".rs") || fileInput.includes("/") || fileInput.includes("\\")) && !fileInput.includes("\n");
        if (isPath) {
          try {
            source = fs_12.default.readFileSync(fileInput, "utf-8");
          } catch (err) {
            return { nodes: [], edges: [], raw_calls: [], error: `cannot read ${fileInput}` };
          }
        } else {
          source = fileInput;
          strPath = "main.rs";
        }
      } else {
        strPath = fileInput.path;
        try {
          source = fileInput.readText ? fileInput.readText() : fs_12.default.readFileSync(fileInput.path, "utf-8");
        } catch (err) {
          return { nodes: [], edges: [], raw_calls: [], error: `cannot read ${fileInput.path}` };
        }
      }
      const cleanSource = cleanRustComments(source);
      const stem = _fileStem(strPath);
      function lineAt(offset) {
        return cleanSource.slice(0, offset).split("\n").length;
      }
      const nodes = [];
      const edges = [];
      const rawCalls = [];
      const seenIds = /* @__PURE__ */ new Set();
      function addNode(nid, label, line) {
        if (!seenIds.has(nid)) {
          seenIds.add(nid);
          nodes.push({
            id: nid,
            label,
            file_type: "code",
            source_file: strPath,
            source_location: `L${line}`
          });
        }
      }
      function addEdge(src, tgt, relation, line, confidence = "EXTRACTED", weight = 1, context) {
        const edge = {
          source: src,
          target: tgt,
          relation,
          confidence,
          source_file: strPath,
          source_location: `L${line}`,
          weight
        };
        if (context)
          edge.context = context;
        edges.push(edge);
      }
      const fileNid = _makeId(strPath);
      addNode(fileNid, path_1.default.basename(strPath), 1);
      function ensureNamedNode(name, line) {
        const nidInFile = _makeId(stem, name);
        if (seenIds.has(nidInFile)) {
          return nidInFile;
        }
        const nidGlobal = _makeId(name);
        if (!seenIds.has(nidGlobal)) {
          seenIds.add(nidGlobal);
          nodes.push({
            id: nidGlobal,
            label: name,
            file_type: "code",
            source_file: "",
            source_location: "",
            origin_file: strPath
          });
        }
        return nidGlobal;
      }
      function emitParamReturnRefs(paramsText, returnText, funcNid, line) {
        if (paramsText) {
          for (const p of _splitBalanced(paramsText)) {
            if (p === "&self" || p === "&mut self" || p === "self" || p === "mut self")
              continue;
            const colonIdx = p.indexOf(":");
            if (colonIdx !== -1) {
              const typePart = p.slice(colonIdx + 1).trim();
              const refs = [];
              _rustCollectTypeRefs(typePart, false, refs);
              for (const [refName, role] of refs) {
                const ctx = role === "generic_arg" ? "generic_arg" : "parameter_type";
                const tgt = ensureNamedNode(refName, line);
                if (tgt !== funcNid) {
                  addEdge(funcNid, tgt, "references", line, "EXTRACTED", 1, ctx);
                }
              }
            }
          }
        }
        if (returnText) {
          const refs = [];
          _rustCollectTypeRefs(returnText, false, refs);
          for (const [refName, role] of refs) {
            const ctx = role === "generic_arg" ? "generic_arg" : "return_type";
            const tgt = ensureNamedNode(refName, line);
            if (tgt !== funcNid) {
              addEdge(funcNid, tgt, "references", line, "EXTRACTED", 1, ctx);
            }
          }
        }
      }
      const functionBodies = [];
      const itemPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(struct|enum)|(?:unsafe\s+)?(trait)|(impl))\b/gm;
      let m;
      while ((m = itemPattern.exec(cleanSource)) !== null) {
        const itemStart = m.index;
        const kind = m[1] || m[2] || m[3];
        const headerEnd = cleanSource.indexOf("{", itemStart);
        const semiEnd = cleanSource.indexOf(";", itemStart);
        if (kind === "struct") {
          const structM = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)(?:<[^>]*>)?(?:\s*\(([^)]*)\)|\s*\{)?/m.exec(cleanSource.slice(itemStart, itemStart + 300));
          if (structM) {
            const structName = structM[1];
            const line = lineAt(itemStart);
            const structNid = _makeId(stem, structName);
            addNode(structNid, structName, line);
            addEdge(fileNid, structNid, "contains", line);
            const tupleFields = structM[2];
            if (tupleFields !== void 0) {
              for (const field of _splitBalanced(tupleFields)) {
                const cleanField = field.replace(/^pub(?:\([^)]*\))?\s+/, "").trim();
                const refs = [];
                _rustCollectTypeRefs(cleanField, false, refs);
                for (const [refName, role] of refs) {
                  const ctx = role === "generic_arg" ? "generic_arg" : "field";
                  const tgt = ensureNamedNode(refName, line);
                  if (tgt !== structNid) {
                    addEdge(structNid, tgt, "references", line, "EXTRACTED", 1, ctx);
                  }
                }
              }
            } else if (headerEnd !== -1 && (semiEnd === -1 || headerEnd < semiEnd)) {
              const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
              const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);
              for (const rawField of _splitBalanced(body, ",")) {
                const field = rawField.trim();
                if (!field)
                  continue;
                const colonIdx = field.indexOf(":");
                if (colonIdx !== -1) {
                  const fType = field.slice(colonIdx + 1).trim();
                  const fLine = lineAt(headerEnd);
                  const refs = [];
                  _rustCollectTypeRefs(fType, false, refs);
                  for (const [refName, role] of refs) {
                    const ctx = role === "generic_arg" ? "generic_arg" : "field";
                    const tgt = ensureNamedNode(refName, fLine);
                    if (tgt !== structNid) {
                      addEdge(structNid, tgt, "references", fLine, "EXTRACTED", 1, ctx);
                    }
                  }
                }
              }
            }
          }
        } else if (kind === "enum") {
          const enumM = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/m.exec(cleanSource.slice(itemStart, itemStart + 200));
          if (enumM && headerEnd !== -1) {
            const enumName = enumM[1];
            const line = lineAt(itemStart);
            const enumNid = _makeId(stem, enumName);
            addNode(enumNid, enumName, line);
            addEdge(fileNid, enumNid, "contains", line);
            const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
            const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);
            const variantPattern = /([A-Za-z_]\w*)(?:\s*\(([^)]*)\)|\s*\{([^}]*)\})?/g;
            let vm;
            while ((vm = variantPattern.exec(body)) !== null) {
              const vLine = lineAt(headerEnd + vm.index);
              const tupleTypes = vm[2];
              const structFields = vm[3];
              if (tupleTypes) {
                for (const t of _splitBalanced(tupleTypes)) {
                  const refs = [];
                  _rustCollectTypeRefs(t.trim(), false, refs);
                  for (const [refName, role] of refs) {
                    const ctx = role === "generic_arg" ? "generic_arg" : "field";
                    const tgt = ensureNamedNode(refName, vLine);
                    if (tgt !== enumNid) {
                      addEdge(enumNid, tgt, "references", vLine, "EXTRACTED", 1, ctx);
                    }
                  }
                }
              } else if (structFields) {
                for (const rawField of _splitBalanced(structFields, ",")) {
                  const field = rawField.trim();
                  if (!field)
                    continue;
                  const colonIdx = field.indexOf(":");
                  if (colonIdx !== -1) {
                    const fType = field.slice(colonIdx + 1).trim();
                    const refs = [];
                    _rustCollectTypeRefs(fType, false, refs);
                    for (const [refName, role] of refs) {
                      const ctx = role === "generic_arg" ? "generic_arg" : "field";
                      const tgt = ensureNamedNode(refName, vLine);
                      if (tgt !== enumNid) {
                        addEdge(enumNid, tgt, "references", vLine, "EXTRACTED", 1, ctx);
                      }
                    }
                  }
                }
              }
            }
          }
        } else if (kind === "trait") {
          const traitM = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:unsafe\s+)?trait\s+([A-Za-z_]\w*)(?:<[^>]*>)?(?:\s*:\s*([^{]+))?/m.exec(cleanSource.slice(itemStart, itemStart + 300));
          if (traitM && headerEnd !== -1) {
            const traitName = traitM[1];
            const line = lineAt(itemStart);
            const traitNid = _makeId(stem, traitName);
            addNode(traitNid, traitName, line);
            addEdge(fileNid, traitNid, "contains", line);
            const boundsStr = traitM[2];
            if (boundsStr) {
              const bounds = boundsStr.split("+").map((s) => s.trim()).filter(Boolean);
              for (let idx = 0; idx < bounds.length; idx++) {
                const b = bounds[idx];
                const refs = [];
                _rustCollectTypeRefs(b, false, refs);
                for (let rIdx = 0; rIdx < refs.length; rIdx++) {
                  const [refName] = refs[rIdx];
                  const tgt = ensureNamedNode(refName, line);
                  if (tgt === traitNid)
                    continue;
                  const rel = idx === 0 && rIdx === 0 ? "inherits" : "references";
                  addEdge(traitNid, tgt, rel, line, "EXTRACTED", 1, rel === "references" ? "generic_arg" : void 0);
                }
              }
            }
            const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
            const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);
            const traitMethodPattern = /^[ \t]*(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{;]+))?\s*([{;])/gm;
            let tmm;
            while ((tmm = traitMethodPattern.exec(body)) !== null) {
              const methodName = tmm[1];
              const mLine = lineAt(headerEnd + tmm.index);
              const methodNid = _makeId(traitNid, methodName);
              addNode(methodNid, `.${methodName}()`, mLine);
              addEdge(traitNid, methodNid, "method", mLine);
              emitParamReturnRefs(tmm[2], tmm[3], methodNid, mLine);
              if (tmm[4] === "{") {
                const mBodyEnd = _findMatchingBrace(body, tmm.index);
                const mBody = body.slice(tmm.index + tmm[0].length - 1, mBodyEnd);
                functionBodies.push([methodNid, mBody, headerEnd + tmm.index + tmm[0].length - 1]);
              }
            }
          }
        } else if (kind === "impl") {
          const implHeader = cleanSource.slice(itemStart, headerEnd).trim();
          const implM = /^[ \t]*impl(?:\s*<[^>]*>)?\s+(?:([A-Za-z_]\w*(?:\s*<[^>]*>)?)\s+for\s+)?([A-Za-z_]\w*(?:\s*<[^>]*>)?)/m.exec(implHeader);
          if (implM && headerEnd !== -1) {
            const traitPart = implM[1];
            const typePart = implM[2];
            const typeName = typePart.split("<")[0].split("::").pop().trim();
            const line = lineAt(itemStart);
            const implNid = _makeId(stem, typeName);
            addNode(implNid, typeName, line);
            if (traitPart) {
              const traitRefs = [];
              _rustCollectTypeRefs(traitPart, false, traitRefs);
              for (let idx = 0; idx < traitRefs.length; idx++) {
                const [refName] = traitRefs[idx];
                const tgt = ensureNamedNode(refName, line);
                if (tgt !== implNid) {
                  if (idx === 0) {
                    addEdge(implNid, tgt, "implements", line);
                  } else {
                    addEdge(implNid, tgt, "references", line, "EXTRACTED", 1, "generic_arg");
                  }
                }
              }
            }
            const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
            const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);
            const implMethodPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*\{/gm;
            let imm;
            while ((imm = implMethodPattern.exec(body)) !== null) {
              const methodName = imm[1];
              const mLine = lineAt(headerEnd + imm.index);
              const methodNid = _makeId(implNid, methodName);
              addNode(methodNid, `.${methodName}()`, mLine);
              addEdge(implNid, methodNid, "method", mLine);
              emitParamReturnRefs(imm[2], imm[3], methodNid, mLine);
              const mBodyEnd = _findMatchingBrace(body, imm.index);
              const mBody = body.slice(imm.index + imm[0].length - 1, mBodyEnd);
              functionBodies.push([methodNid, mBody, headerEnd + imm.index + imm[0].length - 1]);
            }
          }
        }
      }
      const freeFnPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*\{/gm;
      while ((m = freeFnPattern.exec(cleanSource)) !== null) {
        const funcName = m[1];
        const funcLine = lineAt(m.index);
        const funcNid = _makeId(stem, funcName);
        if (!seenIds.has(funcNid)) {
          addNode(funcNid, `${funcName}()`, funcLine);
          addEdge(fileNid, funcNid, "contains", funcLine);
          emitParamReturnRefs(m[2], m[3], funcNid, funcLine);
          const mBodyEnd = _findMatchingBrace(cleanSource, m.index);
          const mBody = cleanSource.slice(m.index + m[0].length - 1, mBodyEnd);
          functionBodies.push([funcNid, mBody, m.index + m[0].length - 1]);
        }
      }
      const usePattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?use\s+([^;]+);/gm;
      while ((m = usePattern.exec(cleanSource)) !== null) {
        const raw = m[1].trim();
        const line = lineAt(m.index);
        if (raw.includes("{")) {
          const basePrefix = raw.slice(0, raw.indexOf("{")).replace(/::$/, "").trim();
          const moduleName = basePrefix.split("::").pop().trim();
          if (moduleName) {
            const tgtNid = _makeId(moduleName);
            addEdge(fileNid, tgtNid, "imports_from", line, "EXTRACTED", 1, "import");
          }
        } else {
          const clean = raw.split(" as ")[0].trim().replace(/::\*$/, "").replace(/::$/, "");
          const moduleName = clean.split("::").pop().trim();
          if (moduleName) {
            const tgtNid = _makeId(moduleName);
            addEdge(fileNid, tgtNid, "imports_from", line, "EXTRACTED", 1, "import");
          }
        }
      }
      const labelToNid = {};
      for (const n of nodes) {
        const raw = n.label;
        const normalised = raw.replace(/\(\)$/, "").replace(/^\./, "");
        labelToNid[normalised] = n.id;
      }
      const seenCallPairs = /* @__PURE__ */ new Set();
      for (const [callerNid, bodyCode, bodyOffset] of functionBodies) {
        const callPattern = /([A-Za-z_]\w*)(?:::([A-Za-z_]\w*))?\s*\(|\.([A-Za-z_]\w*)\s*\(/g;
        let cm;
        while ((cm = callPattern.exec(bodyCode)) !== null) {
          const isMemberCall = Boolean(cm[3]);
          const isScopedCall = Boolean(cm[2]);
          const calleeName = cm[3] || cm[2] || cm[1];
          if (!calleeName || RUST_KEYWORDS.has(calleeName))
            continue;
          const callLine = lineAt(bodyOffset + cm.index);
          const tgtNid = labelToNid[calleeName];
          if (tgtNid && tgtNid !== callerNid) {
            const pairKey = `${callerNid}->${tgtNid}`;
            if (!seenCallPairs.has(pairKey)) {
              seenCallPairs.add(pairKey);
              edges.push({
                source: callerNid,
                target: tgtNid,
                relation: "calls",
                confidence: "EXTRACTED",
                source_file: strPath,
                source_location: `L${callLine}`,
                weight: 1,
                context: "call"
              });
            }
          } else if (!isScopedCall && !exports2.RUST_TRAIT_METHOD_BLOCKLIST.has(calleeName.toLowerCase())) {
            rawCalls.push({
              caller_nid: callerNid,
              callee: calleeName,
              is_member_call: isMemberCall,
              source_file: strPath,
              source_location: `L${callLine}`
            });
          }
        }
      }
      const validIds = seenIds;
      const cleanEdges = edges.filter((e) => validIds.has(e.source) && (validIds.has(e.target) || e.relation === "imports_from" || e.relation === "imports"));
      return { nodes, edges: cleanEdges, raw_calls: rawCalls };
    }
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
      const isHashCommentLang = [".py", ".rb", ".sh", ".bash", ".ps1"].includes(ext);
      const commentChar = isHashCommentLang ? "#" : "//";
      const cleanCode = code.split("\n").map((line) => {
        const commentIndex = line.indexOf(commentChar);
        if (commentIndex === -1)
          return line;
        const before = line.slice(0, commentIndex);
        const inDouble = (before.match(/"/g) || []).length % 2 !== 0;
        const inSingle = (before.match(/'/g) || []).length % 2 !== 0;
        const inBacktick = (before.match(/`/g) || []).length % 2 !== 0;
        return inDouble || inSingle || inBacktick ? line : line.slice(0, commentIndex);
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
      let normalizedSource = importSource;
      if (normalizedSource.startsWith("crate::")) {
        normalizedSource = normalizedSource.slice(7).replace(/::/g, "/");
      } else if (normalizedSource.startsWith("super::")) {
        normalizedSource = "../" + normalizedSource.slice(7).replace(/::/g, "/");
      } else if (normalizedSource.startsWith("self::")) {
        normalizedSource = "./" + normalizedSource.slice(6).replace(/::/g, "/");
      }
      const base = path_1.default.join(fromDir, normalizedSource);
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        `${base}/index.ts`,
        `${base}/index.js`,
        `${base}.dart`,
        `${base}.rs`
      ];
      for (const candidate of candidates) {
        const normalized = candidate.replace(/\\/g, "/");
        const found = allFiles.find((f) => f.filePath.replace(/\\/g, "/") === normalized);
        if (found)
          return found.filePath;
      }
      const parentBase = path_1.default.dirname(base);
      if (parentBase && parentBase !== base) {
        const parentCandidates = [
          `${parentBase}.rs`,
          `${parentBase}.ts`,
          `${parentBase}.tsx`,
          `${parentBase}.js`,
          `${parentBase}.jsx`,
          `${parentBase}.dart`
        ];
        for (const candidate of parentCandidates) {
          const normalized = candidate.replace(/\\/g, "/");
          const found = allFiles.find((f) => f.filePath.replace(/\\/g, "/") === normalized);
          if (found)
            return found.filePath;
        }
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

// dist/stages/gitdiff.js
var require_gitdiff = __commonJS({
  "dist/stages/gitdiff.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getChangedEntities = getChangedEntities;
    var child_process_1 = require("child_process");
    var path_1 = __importDefault2(require("path"));
    var registry_1 = require_registry();
    function getChangedEntities(options) {
      const diff = runGitDiff(options);
      if (!diff)
        return [];
      return parseDiff(diff, options.projectDir);
    }
    function runGitDiff(options) {
      const { projectDir: projectDir2, mode, commit, from, to } = options;
      let command;
      if (mode === "uncommitted") {
        command = "git diff HEAD";
      } else if (mode === "last-commit") {
        if (commit) {
          command = `git diff ${commit}~1 ${commit}`;
        } else {
          command = "git diff HEAD~1 HEAD";
        }
      } else if (mode === "branches") {
        if (!from || !to) {
          console.warn("\u26A0 --from and --to are required for branch comparison");
          return null;
        }
        command = `git diff ${from}...${to}`;
      } else {
        return null;
      }
      try {
        const result = (0, child_process_1.execSync)(command, {
          cwd: projectDir2,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"]
        });
        return result || null;
      } catch (err) {
        console.warn(`\u26A0 Git command failed: ${command}`);
        console.warn(`  Make sure ${projectDir2} is a git repository`);
        return null;
      }
    }
    function parseDiff(diff, projectDir2) {
      const entities = [];
      const lines = diff.split("\n");
      let currentFile = "";
      let changeType = "modified";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("diff --git")) {
          const fileMatch = line.match(/b\/(.+)$/);
          if (fileMatch) {
            currentFile = fileMatch[1];
          }
          changeType = "modified";
          continue;
        }
        if (line.startsWith("new file mode")) {
          changeType = "added";
          continue;
        }
        if (line.startsWith("deleted file mode")) {
          changeType = "deleted";
          continue;
        }
        if (line.startsWith("index ")) {
          if (changeType === "modified")
            changeType = "modified";
          continue;
        }
        if (line.startsWith("@@")) {
          const contextMatch = line.match(/@@[^@]*@@\s*(.+)$/);
          if (contextMatch) {
            const context = contextMatch[1].trim();
            const entity = extractEntityFromContext(context, currentFile);
            if (entity) {
              const description = buildDescription(lines, i, entity.name);
              const alreadyFound = entities.some((e) => e.name === entity.name && e.file === currentFile);
              if (!alreadyFound) {
                entities.push({
                  name: entity.name,
                  file: currentFile,
                  changeType,
                  description
                });
              }
            }
          }
          continue;
        }
      }
      return entities;
    }
    function extractEntityFromContext(context, file) {
      const ext = path_1.default.extname(file).toLowerCase();
      const parser = (0, registry_1.getLanguageParser)(ext);
      if (parser?.entityPatterns) {
        for (const { regex, type } of parser.entityPatterns) {
          if (type === "api")
            continue;
          const singleLineRegex = new RegExp(regex.source, regex.flags.replace("g", ""));
          const m = singleLineRegex.exec(context);
          if (m?.[1])
            return { name: m[1], type };
        }
        return null;
      }
      if ([".java", ".cs"].includes(ext)) {
        const m = context.match(/(?:public|private|protected|static|override|async|virtual)\s+\S+\s+(\w+)\s*\(/);
        if (m)
          return { name: m[1], type: "method" };
      }
      return null;
    }
    function buildDescription(lines, contextIdx, entityName) {
      const added = [];
      const removed = [];
      for (let i = contextIdx + 1; i < Math.min(contextIdx + 20, lines.length); i++) {
        const line = lines[i];
        if (line.startsWith("@@") || line.startsWith("diff"))
          break;
        if (line.startsWith("+") && !line.startsWith("+++")) {
          added.push(line.slice(1).trim());
        }
        if (line.startsWith("-") && !line.startsWith("---")) {
          removed.push(line.slice(1).trim());
        }
      }
      if (added.length === 0 && removed.length > 0) {
        return `${entityName}: ${removed.length} line(s) removed`;
      }
      if (added.length > 0 && removed.length === 0) {
        return `${entityName}: ${added.length} line(s) added`;
      }
      if (added.length > 0 && removed.length > 0) {
        return `${entityName}: ${removed.length} line(s) changed to ${added.length} new line(s)`;
      }
      return `${entityName}: modified`;
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
require_go();
require_csharp();
require_java();
require_kotlin();
require_php();
require_ruby();
require_swift();
require_dart();
require_rust();
var fs_1 = __importDefault(require("fs"));
var collector_1 = require_collector();
var parser_1 = require_parser();
var graph_1 = require_graph();
var metrics_1 = require_metrics();
var impact_1 = require_impact();
var output_1 = require_output();
var gitdiff_1 = require_gitdiff();
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
${bold("DepGraph")} ${dim("v1.5.1")}
${dim("Dependency mapping \xB7 Impact simulation \xB7 Developer intelligence")}

${bold("USAGE")}
  depgraph ${cyan("<projectDir>")} ${dim("[options]")}

${bold("OPTIONS")}
  ${cyan("--output")}  ${dim("<file>")}        Output path  ${dim("(default: ./depgraph-output.json)")}
  ${cyan("--impact")}  ${dim("<name> <desc>")} Simulate changing a node
  ${cyan("--verbose")}                Show per-file parsing details
  ${cyan("--no-color")}               Disable colors ${dim("(for CI)")}
  ${cyan("--help, -h")}               Show this help message

${bold("GIT FLAGS")}
  ${cyan("--git-impact")}              Auto-detect changes from git diff
  ${cyan("--commit")}  ${dim("<sha>")}          Analyze a specific commit
  ${cyan("--from")}    ${dim("<branch>")}        Compare from this branch
  ${cyan("--to")}      ${dim("<branch>")}        Compare to this branch

${bold("EXAMPLES")}
  ${dim("# Map a project")}
  depgraph ./my-app

  ${dim("# Map with custom output")}
  depgraph ./my-app --output ./reports/graph.json

  ${dim("# Simulate a change")}
  depgraph ./my-app --impact "getUserById" "removing userId param"

  ${dim("# CI mode")}
  depgraph ./src --no-color --output ./ci/depgraph.json

${bold("GIT EXAMPLES")}
  ${dim("# Analyze uncommitted changes")}
  depgraph ./src --git-impact

  ${dim("# Analyze last commit")}
  depgraph ./src --git-impact --commit HEAD

  ${dim("# Compare two branches")}
  depgraph ./src --git-impact --from main --to feature/my-branch

  ${dim("# Specific commit")}
  depgraph ./src --git-impact --commit abc1234
`);
}
function printBanner() {
  console.log(`
${bold("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501")}
${bold("  DepGraph")}  ${dim("v1.0.0")}
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
var gitImpact = args.includes("--git-impact");
var gitCommit = getFlag("--commit");
var gitFrom = getFlag("--from");
var gitTo = getFlag("--to");
var gitMode = gitFrom && gitTo ? "branches" : gitCommit ? "last-commit" : "uncommitted";
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
  } else if (gitImpact) {
    console.log(`
${bold("\u{1F50D} Reading git diff...")}`);
    const changed = (0, gitdiff_1.getChangedEntities)({
      projectDir,
      mode: gitMode,
      commit: gitCommit,
      from: gitFrom,
      to: gitTo
    });
    if (changed.length === 0) {
      console.log(`
${green("\u2713")} No changed entities found in diff`);
    } else {
      console.log(`
${bold(`Found ${changed.length} changed entity(s):`)}`);
      for (const entity of changed) {
        console.log(`   ${dim("\u2192")} ${entity.name}  ${dim(`(${entity.file})`)}`);
      }
      console.log(`
${bold("Running impact simulation...")}`);
      for (const entity of changed) {
        console.log(`
${dim("\u2500".repeat(42))}`);
        const result = (0, impact_1.simulateImpact)(metrics, entity.name, entity.description);
        printImpact(result);
      }
    }
  }
  (0, output_1.writeOutput)(metrics, parsed, outputPath, impact);
} catch (err) {
  console.error(red(`
\u2717 Error: ${err.message}`));
  process.exit(1);
}
