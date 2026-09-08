import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── complexity estimation ──────────────────────────────

/**
 * Estimates the cyclomatic complexity rating of a C# method based on decision/branching keywords.
 * @param code The clean source code of the file.
 * @param name The name of the method to estimate complexity for.
 * @returns A string representing the complexity level ('low', 'medium', or 'high').
 */
function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const methodRegex = new RegExp(
    `(?:(?:public|private|protected|internal|static|async|virtual|override|abstract|sealed|partial)\\s+)+[\\w<>\\[\\],?]+\\s+${name}\\s*(?:<[^>]*>)?\\s*\\(`,
    'm'
  );
  const defLineIdx = lines.findIndex(l => methodRegex.test(l) || new RegExp(`\\b${name}\\s*\\(`, 'm').test(l));
  if (defLineIdx === -1) return 'low';

  let startLine = defLineIdx;
  while (startLine < lines.length && !lines[startLine].includes('{')) {
    startLine++;
  }
  if (startLine >= lines.length) return 'low';

  let braceCount = 0;
  let started = false;
  const bodyLines: string[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
      }
    }
    bodyLines.push(line);
    if (started && braceCount <= 0) {
      break;
    }
  }

  const body = bodyLines.join('\n');
  const branches = (body.match(/\b(if|else\s+if|for|foreach|while|do|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low)    return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns (module-level so gitdiff can reuse them) ────────────────

/**
 * The entity-matching patterns for C#.
 * Exposed via `entityPatterns` on the parser so gitdiff.ts can reuse them
 * against git diff context lines without duplicating any regex.
 */
export const csharpEntityPatterns: EntityPattern[] = [
  // Classes, structs, records, interfaces, enums
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*(?:class|interface|enum|struct|record(?:\s+(?:class|struct))?)\s+([A-Za-z_]\w*)/gm,
    type: 'class'
  },
  // Methods (constructors, instance methods, async/static methods)
  {
    regex: /^[ \t]*(?:(?:public|private|protected|internal|static|async|virtual|override|abstract|sealed|partial)\s+)+(?:(?:async\s+)?[\w<>[\]?,]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm,
    type: 'function'
  },
];

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of csharpEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];

      // Skip language keywords that might resemble method names
      if (['if', 'for', 'foreach', 'while', 'switch', 'catch', 'lock', 'using', 'get', 'set'].includes(name)) {
        continue;
      }

      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

      // Allow same-named methods on different lines (overloads / different classes)
      if (entities.some(e => e.name === name && e.line === line)) continue;

      entities.push({
        name,
        type,
        line,
        complexity: type === 'function' ? estimateComplexity(code, name) : 'low'
      });
    }
  }

  return entities;
}

// ─── import extractor ───────────────────────────────────

function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // Match: using System; | using System.Collections.Generic; | global using X; | using static X; | using Alias = Namespace.Type;
  const usingPattern = /^[ \t]*(?:global\s+)?using\s+(?:static\s+)?(?:([A-Za-z_]\w*)\s*=\s*)?([A-Za-z_][\w.]*(?:<[^>]*>)?)\s*;/gm;
  let match: RegExpExecArray | null;

  while ((match = usingPattern.exec(code)) !== null) {
    const alias = match[1];
    const targetFqn = match[2].trim();
    const simpleName = alias || targetFqn.split('.').pop() || targetFqn;

    // External check: standard .NET / Microsoft namespaces vs local project namespaces
    const isLocal = !targetFqn.startsWith('System') && !targetFqn.startsWith('Microsoft');

    imports.push({
      source: targetFqn,
      names: [simpleName],
      isLocal
    });
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────

function extractExports(code: string): string[] {
  const exports: string[] = [];

  // Exported types: public / internal class, interface, enum, struct, record
  const typePattern = /^[ \t]*(?:public|internal)\s+(?:(?:static|abstract|sealed|partial)\s+)*(?:class|interface|enum|struct|record(?:\s+(?:class|struct))?)\s+([A-Za-z_]\w*)/gm;
  let match: RegExpExecArray | null;
  while ((match = typePattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // Exported methods: public / internal methods
  const methodPattern = /^[ \t]*(?:public|internal)\s+(?:(?:static|async|virtual|override|abstract|sealed|partial)\s+)*(?:[\w<>[\]?,]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm;
  while ((match = methodPattern.exec(code)) !== null) {
    const name = match[1];
    if (!['if', 'for', 'foreach', 'while', 'switch', 'catch', 'lock', 'using', 'get', 'set'].includes(name)) {
      exports.push(name);
    }
  }

  return [...new Set(exports)];
}

// ─── register ───────────────────────────────────────────

/**
 * The language parser implementation for C# (.cs) source files.
 */
const CSharpParser: LanguageParser = {
  lang: 'cs',
  extensions: ['.cs'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: csharpEntityPatterns,
};

registerParser(CSharpParser);
