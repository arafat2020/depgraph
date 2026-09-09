import fs from 'fs';
import path from 'path';
import { RawEntity, RawImport } from '../types';
import { EntityPattern, LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── types for graphify extractor ────────────────────────

export interface DartGraphNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string | null;
  source_location: string | null;
}

export interface DartGraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: string;
  confidence_score: number;
  source_file: string;
  source_location: string | null;
  weight: number;
  context?: string;
}

export interface DartGraphResult {
  nodes: DartGraphNode[];
  edges: DartGraphEdge[];
  error?: string;
}

// ─── helpers ────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove inline and multi-line comments while leaving string literals untouched.
 * Comments are replaced with the same number of newlines they spanned so that line numbers
 * match the original file offsets.
 */
export function cleanDartComments(src: string): string {
  const commentStringPattern = /r?"""(?:\\.|[\s\S])*?"""|r?'''(?:\\.|[\s\S])*?'''|r?"(?:\\.|[^"\\])*"|r?'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  return src.replace(commentStringPattern, (token) => {
    if (token.startsWith('/')) {
      const newlineCount = (token.match(/\n/g) || []).length;
      return '\n'.repeat(newlineCount);
    }
    return token;
  });
}

export function _fileStem(filePath: string): string {
  const base = path.basename(filePath);
  const ext = path.extname(base);
  return ext ? base.slice(0, -ext.length) : base;
}

export function _makeId(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map(p => p.trim().replace(/[^a-zA-Z0-9_.-]/g, '_'))
    .join('__');
}

export function _splitTypes(text: string): string[] {
  const parts: string[] = [];
  const current: string[] = [];
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '<') {
      depth++;
      current.push(char);
    } else if (char === '>') {
      depth--;
      current.push(char);
    } else if (char === ',' && depth === 0) {
      const trimmed = current.join('').trim();
      if (trimmed) parts.push(trimmed);
      current.length = 0;
    } else {
      current.push(char);
    }
  }

  if (current.length > 0) {
    const trimmed = current.join('').trim();
    if (trimmed) parts.push(trimmed);
  }

  return parts;
}

export function _findMatchingBrace(text: string, startPos: number): number {
  let braceCount = 0;
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let escape = false;

  const firstBrace = text.indexOf('{', startPos);
  if (firstBrace === -1) return text.length;

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
    if (char === '\\') {
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
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
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

/**
 * Estimates cyclomatic complexity of a Dart function/method via brace-depth tracking
 * and decision keyword counting.
 */
export function estimateComplexity(code: string, name: string): string {
  const lines = code.split('\n');
  const defRegex = new RegExp(
    `(?:^|\\s)(?:[\\w<>\\[\\],.?]+\\s+)?${escapeRegex(name)}\\s*(?:<[^>]*>)?\\s*\\(`,
    'm'
  );
  const defLineIdx = lines.findIndex(l => defRegex.test(l));
  if (defLineIdx === -1) return 'low';

  let startLine = defLineIdx;
  while (startLine < lines.length && !lines[startLine].includes('{') && !lines[startLine].includes('=>')) {
    startLine++;
  }
  if (startLine >= lines.length) return 'low';

  // If arrow function body, search that line/statement for branching
  if (lines[startLine].includes('=>') && !lines[startLine].includes('{')) {
    const arrowStmt = lines.slice(startLine, startLine + 5).join('\n');
    const branches = (
      arrowStmt.match(/\b(if|else|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []
    ).length;
    if (branches <= COMPLEXITY_THRESHOLDS.low) return 'low';
    if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
    return 'high';
  }

  let braceCount = 0;
  let started = false;
  const bodyLines: string[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { braceCount++; started = true; }
      else if (ch === '}') { braceCount--; }
    }
    bodyLines.push(line);
    if (started && braceCount <= 0) break;
  }

  const body = bodyLines.join('\n');
  const branches = (
    body.match(/\b(if|else\s+if|else|for|while|do|switch|case|catch|&&|\|\||\?\?)\b|\?[^:]*:/g) || []
  ).length;

  if (branches <= COMPLEXITY_THRESHOLDS.low) return 'low';
  if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ─── entity patterns (for gitdiff & depgraph reuse) ──────

/**
 * Entity-matching patterns for Dart, exposed for gitdiff reuse.
 * Group 1 must capture the entity identifier name.
 */
export const dartEntityPatterns: EntityPattern[] = [
  // class, abstract class, sealed class, mixin class, base class, interface class, final class, enum, extension type
  {
    regex: /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+([A-Za-z_]\w*)/gm,
    type: 'class',
  },
  // extension MyExt on MyClass (named extension)
  {
    regex: /^[ \t]{0,4}extension\s+([A-Za-z_]\w+)(?:<[^>]+>)?\s+on\s+[A-Za-z_]\w*/gm,
    type: 'class',
  },
  // typedef
  {
    regex: /^[ \t]*typedef\s+(?:[\w<>,.?\s]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]+>)?\s*(?:=|\()/gm,
    type: 'type',
  },
  // methods, functions, getters/setters, constructors
  {
    regex: /^[ \t]{0,2}(?:(?:factory|static|async|external|abstract)\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+([A-Za-z_]\w*)\s*\(/gm,
    type: 'function',
  },
];

const DART_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'case', 'catch', 'return', 'void', 'dynamic',
  'final', 'const', 'get', 'set', 'true', 'false', 'null', 'default', 'break',
  'continue', 'throw', 'rethrow', 'assert', 'class', 'mixin', 'enum', 'extension',
  'typedef', 'import', 'export', 'part', 'library', 'with', 'implements', 'extends', 'on'
]);

const DART_PRIMITIVE_TYPES = new Set([
  'String', 'int', 'double', 'bool', 'num', 'dynamic', 'Object', 'void',
  'List', 'Map', 'Set', 'Future', 'Stream', 'Function', 'Record'
]);

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, filePath: string): RawEntity[] {
  const cleanCode = cleanDartComments(code);
  const entities: RawEntity[] = [];
  const stem = _fileStem(filePath);

  function lineAt(offset: number): number {
    return cleanCode.slice(0, offset).split('\n').length;
  }

  // 1. Classes, mixins, enums, extension types
  const classPattern = /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/gm;
  let m: RegExpExecArray | null;

  while ((m = classPattern.exec(cleanCode)) !== null) {
    const className = m[1];
    if (DART_KEYWORDS.has(className)) continue;
    const line = lineAt(m.index);
    if (!entities.some(e => e.name === className && e.line === line)) {
      entities.push({
        name: className,
        type: 'class',
        line,
        complexity: 'low',
      });
    }
  }

  // 2. Extensions (extension MyExt on MyClass or extension on MyClass)
  const extPattern = /^[ \t]{0,4}extension\s+(?:(\w+)(?:<[^>]+>)?\s+)?on\s+(\w+)/gm;
  while ((m = extPattern.exec(cleanCode)) !== null) {
    const extName = m[1] || `${stem}_anonymous_extension`;
    const line = lineAt(m.index);
    if (!entities.some(e => e.name === extName && e.line === line)) {
      entities.push({
        name: extName,
        type: 'class',
        line,
        complexity: 'low',
      });
    }
  }

  // 3. Typedefs
  const typedefPattern = /^[ \t]*typedef\s+(?:[\w<>,.?\s]+\s+)?(\w+)\s*(?:<[^>]+>)?\s*(?:=\s*([^;]+)|\([^;]*\));/gm;
  while ((m = typedefPattern.exec(cleanCode)) !== null) {
    const typedefName = m[1];
    const line = lineAt(m.index);
    if (!entities.some(e => e.name === typedefName && e.line === line)) {
      entities.push({
        name: typedefName,
        type: 'type',
        line,
        complexity: 'low',
      });
    }
  }

  // 4. Variables (top-level and class-level fields)
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
      if (!entities.some(e => e.name === singleName && e.line === line)) {
        entities.push({
          name: singleName,
          type: 'variable',
          line,
          complexity: 'low',
        });
      }
    } else if (destructured) {
      const line = lineAt(m.index);
      const names = destructured
        .split(',')
        .map(n => n.includes(':') ? n.split(':').pop()!.trim() : n.trim())
        .filter(n => /^[a-zA-Z_]\w*$/.test(n) && !/^[A-Z]/.test(n) && !DART_KEYWORDS.has(n));

      for (const name of names) {
        if (!entities.some(e => e.name === name && e.line === line)) {
          entities.push({
            name,
            type: 'variable',
            line,
            complexity: 'low',
          });
        }
      }
    }
  }

  // 5. Functions, methods, and getters
  const methodPattern = /^[ \t]{0,2}(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+(?:\.\w+)?)\s*\(/gm;
  while ((m = methodPattern.exec(cleanCode)) !== null) {
    const rawName = m[1];
    const name = rawName.split('.').pop()!;
    if (DART_KEYWORDS.has(name) || /^[A-Z]/.test(name)) continue;

    const line = lineAt(m.index);
    if (!entities.some(e => e.name === name && e.line === line)) {
      entities.push({
        name,
        type: 'function',
        line,
        complexity: estimateComplexity(cleanCode, name),
      });
    }
  }

  // Getters & setters: get foo => ... or set foo(val)
  const propPattern = /^[ \t]{0,2}(?:(?:static|final|late)\s+)*(?:[\w<>\[\]?]+\s+)?(?:get|set)\s+([A-Za-z_]\w*)/gm;
  while ((m = propPattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (DART_KEYWORDS.has(name)) continue;
    const line = lineAt(m.index);
    if (!entities.some(e => e.name === name && e.line === line)) {
      entities.push({
        name,
        type: 'function',
        line,
        complexity: estimateComplexity(cleanCode, name),
      });
    }
  }

  // 6. Riverpod Provider Generation from @riverpod annotations
  const annotationPattern = /@(\w+)(?:\([^)]*\))?/g;
  while ((m = annotationPattern.exec(cleanCode)) !== null) {
    const annotationName = m[1];
    if (annotationName.toLowerCase() === 'riverpod') {
      const annotationPos = annotationPattern.lastIndex;
      const intervening = cleanCode.slice(annotationPos, annotationPos + 300);

      const classM = /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/m.exec(intervening);
      const funcM = /^[ \t]*(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+)\s*\(/m.exec(intervening);

      let targetName: string | null = null;
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
        const providerName = isClass
          ? (targetName.length > 1 ? targetName[0].toLowerCase() + targetName.slice(1) : targetName.toLowerCase()) + 'Provider'
          : targetName + 'Provider';
        const line = lineAt(m.index);
        if (!entities.some(e => e.name === providerName && e.line === line)) {
          entities.push({
            name: providerName,
            type: 'variable',
            line,
            complexity: 'low',
          });
        }
      }
    }
  }

  return entities;
}

// ─── import extractor ───────────────────────────────────

function extractImports(code: string): RawImport[] {
  const cleanCode = cleanDartComments(code);
  const imports: RawImport[] = [];

  // Matches:
  // import 'package:flutter/material.dart';
  // import 'package:foo/foo.dart' as foo;
  // import './models/user.dart' show User, Address;
  // import '../utils.dart' hide Unused;
  const importPattern = /^[ \t]*import\s+['"]([^'"]+)['"](?:\s+(?:deferred\s+)?as\s+([A-Za-z_]\w*))?((?:\s+(?:show|hide)\s+[A-Za-z0-9_,\s]+)*)\s*;/gm;
  let m: RegExpExecArray | null;

  while ((m = importPattern.exec(cleanCode)) !== null) {
    const source = m[1];
    const alias = m[2];
    const clauses = m[3] || '';

    // Relative local files vs external packages/sdk
    const isLocal = !source.startsWith('package:') && !source.startsWith('dart:');

    // Extract names: if show clause exists, use those. If alias, use alias.
    // Otherwise use the module/file stem as the default imported symbol.
    const names: string[] = [];
    const showMatch = clauses.match(/\bshow\s+([^;]+)/);

    if (showMatch) {
      const shown = showMatch[1].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
      names.push(...shown);
    } else if (alias) {
      names.push(alias);
    } else {
      const baseName = path.basename(source);
      const cleanStem = baseName.endsWith('.dart') ? baseName.slice(0, -5) : baseName;
      names.push(cleanStem);
    }

    imports.push({
      source,
      names: [...new Set(names)],
      isLocal,
    });
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────

function extractExports(code: string): string[] {
  const cleanCode = cleanDartComments(code);
  const exports: string[] = [];

  // 1. Explicit re-exports: export 'path' [show A, B];
  const exportPattern = /^[ \t]*export\s+['"]([^'"]+)['"](?:\s+show\s+([A-Za-z0-9_,\s]+))?\s*;/gm;
  let m: RegExpExecArray | null;

  while ((m = exportPattern.exec(cleanCode)) !== null) {
    const showClause = m[2];
    if (showClause) {
      const names = showClause.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
      exports.push(...names);
    } else {
      const base = path.basename(m[1]);
      const stem = base.endsWith('.dart') ? base.slice(0, -5) : base;
      exports.push(stem);
    }
  }

  // 2. In Dart, all public top-level declarations (not starting with _) are part of the exported surface:
  // Classes, mixins, enums, extension types
  const typePattern = /^[ \t]*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+([A-Za-z_]\w*)/gm;
  while ((m = typePattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (!name.startsWith('_') && !DART_KEYWORDS.has(name)) {
      exports.push(name);
    }
  }

  // Extensions (named)
  const extPattern = /^[ \t]{0,4}extension\s+([A-Za-z_]\w+)(?:<[^>]+>)?\s+on\s+[A-Za-z_]\w*/gm;
  while ((m = extPattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (name && !name.startsWith('_') && !DART_KEYWORDS.has(name)) {
      exports.push(name);
    }
  }

  // Typedefs
  const typedefPattern = /^[ \t]*typedef\s+(?:[\w<>,.?\s]+\s+)?([A-Za-z_]\w*)\s*(?:<[^>]+>)?\s*(?:=|\()/gm;
  while ((m = typedefPattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (!name.startsWith('_') && !DART_KEYWORDS.has(name)) {
      exports.push(name);
    }
  }

  // Top-level functions
  const funcPattern = /^[ \t]{0,2}(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+([A-Za-z_]\w*)\s*\(/gm;
  while ((m = funcPattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (!name.startsWith('_') && !/^[A-Z]/.test(name) && !DART_KEYWORDS.has(name)) {
      exports.push(name);
    }
  }

  // Top-level variables
  const varPattern = /^[ \t]{0,2}(?:(?:final|const|var)\s+)(?:[a-zA-Z0-9_<>,.?]+\s+)?([A-Za-z_]\w*)\s*=/gm;
  while ((m = varPattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (!name.startsWith('_') && !DART_KEYWORDS.has(name)) {
      exports.push(name);
    }
  }

  return [...new Set(exports)];
}

// ─── register LanguageParser ────────────────────────────

export const DartParser: LanguageParser = {
  lang: 'dart',
  extensions: ['.dart'],
  extractEntities,
  extractImports,
  extractExports,
  entityPatterns: dartEntityPatterns,
};

registerParser(DartParser);

// ─── Graphify Dart Extractor (Verbatim extraction function) ────

/**
 * Extracts classes, mixins, functions, imports, generic calls, framework bindings,
 * routes, and annotations from a .dart file using regex.
 * Corresponds to the Python extract_dart implementation.
 */
export function extractDart(
  fileInput: string | { path: string; readText?: () => string }
): DartGraphResult {
  let src: string;
  let filePathStr: string;

  if (typeof fileInput === 'string') {
    filePathStr = fileInput;
    const isPath = (fileInput.endsWith('.dart') || fileInput.includes('/') || fileInput.includes('\\')) && !fileInput.includes('\n');
    if (isPath) {
      try {
        src = fs.readFileSync(fileInput, 'utf-8');
      } catch (err) {
        return { nodes: [], edges: [], error: `cannot read ${fileInput}` };
      }
    } else {
      src = fileInput;
      filePathStr = 'main.dart';
    }
  } else {
    filePathStr = fileInput.path;
    try {
      src = fileInput.readText ? fileInput.readText() : fs.readFileSync(fileInput.path, 'utf-8');
    } catch (err) {
      return { nodes: [], edges: [], error: `cannot read ${fileInput.path}` };
    }
  }

  const srcClean = cleanDartComments(src);

  function lineAt(offset: number): number {
    return srcClean.slice(0, offset).split('\n').length;
  }

  let stem = _fileStem(filePathStr);
  let fileNid = _makeId(filePathStr);
  let isPart = false;

  // Check if this is a part-of file and redirect to parent
  const partOfMatch = /^\s*part\s+of\s+['"]([^'"]+)['"]/m.exec(srcClean);
  if (partOfMatch) {
    const parentRef = partOfMatch[1];
    if (parentRef.endsWith('.dart')) {
      try {
        const parentPath = path.resolve(path.dirname(filePathStr), parentRef);
        if (fs.existsSync(parentPath)) {
          stem = _fileStem(parentPath);
          fileNid = _makeId(parentPath);
          isPart = true;
        }
      } catch {
        // Ignore resolution errors
      }
    }
  }

  const nodes: DartGraphNode[] = [];
  if (!isPart) {
    nodes.push({
      id: fileNid,
      label: path.basename(filePathStr),
      file_type: 'code',
      source_file: filePathStr,
      source_location: null,
    });
  }

  const edges: DartGraphEdge[] = [];
  const defined = new Set<string>();

  function addNode(
    nid: string,
    label: string,
    ftype: string = 'code',
    sourceFile: string | null = filePathStr,
    line: number | null = null
  ): void {
    if (!defined.has(nid)) {
      nodes.push({
        id: nid,
        label,
        file_type: ftype,
        source_file: sourceFile,
        source_location: line ? `L${line}` : null,
      });
      defined.add(nid);
    }
  }

  function addEdge(
    srcId: string,
    tgtId: string,
    relation: string,
    weight: number = 1.0,
    context?: string,
    line?: number
  ): void {
    const edge: DartGraphEdge = {
      source: srcId,
      target: tgtId,
      relation,
      confidence: 'EXTRACTED',
      confidence_score: 1.0,
      source_file: filePathStr,
      source_location: line ? `L${line}` : null,
      weight,
    };
    if (context) edge.context = context;
    edges.push(edge);
  }

  // 1. Classes, mixins, and enums declarations
  const classPattern = /^\s*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/gm;
  let m: RegExpExecArray | null;

  while ((m = classPattern.exec(srcClean)) !== null) {
    const className = m[1];
    const classLine = lineAt(m.index + m[0].indexOf(className));
    const classNid = _makeId(stem, className);
    addNode(classNid, className, 'code', filePathStr, classLine);
    addEdge(fileNid, classNid, 'defines', 1.0, undefined, classLine);

    // Manually parse extends/on, with, and implements in header
    const startIdx = classPattern.lastIndex;
    let rest = srcClean.slice(startIdx, startIdx + 500);

    // Skip class generic parameters <...>
    if (rest.trimStart().startsWith('<')) {
      const offset = rest.indexOf('<');
      let depth = 1;
      let i = offset + 1;
      while (i < rest.length && depth > 0) {
        if (rest[i] === '<') depth++;
        else if (rest[i] === '>') depth--;
        i++;
      }
      rest = rest.slice(i);
    }

    // Skip primary constructor (e.g. extension type MyExt(int id))
    if (rest.trimStart().startsWith('(')) {
      const offset = rest.indexOf('(');
      let depth = 1;
      let i = offset + 1;
      while (i < rest.length && depth > 0) {
        if (rest[i] === '(') depth++;
        else if (rest[i] === ')') depth--;
        i++;
      }
      rest = rest.slice(i);
    }

    let headerEnd = rest.indexOf('{');
    if (headerEnd === -1) headerEnd = rest.indexOf(';');
    if (headerEnd === -1) headerEnd = rest.length;
    let header = rest.slice(0, headerEnd);

    let baseClass: string | null = null;
    let generics: string | null = null;
    let mixinsList: string[] = [];
    let interfacesList: string[] = [];

    // Parse extends or on
    const extendsM = /^\s*(?:extends|on)\s+([a-zA-Z0-9_.]+)/.exec(header);
    if (extendsM) {
      baseClass = extendsM[1];
      const restHeader = header.slice(extendsM.index + extendsM[0].length);
      if (restHeader.trimStart().startsWith('<')) {
        const startBracket = restHeader.indexOf('<');
        let depth = 1;
        let i = startBracket + 1;
        while (i < restHeader.length && depth > 0) {
          if (restHeader[i] === '<') depth++;
          else if (restHeader[i] === '>') {
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

    // Parse with
    const withM = /^\s*with\s+/.exec(header);
    if (withM) {
      const restHeader = header.slice(withM.index + withM[0].length);
      const implIdx = restHeader.indexOf('implements');
      let mixinsStr = '';
      if (implIdx !== -1) {
        mixinsStr = restHeader.slice(0, implIdx);
        header = restHeader.slice(implIdx);
      } else {
        mixinsStr = restHeader;
        header = '';
      }
      mixinsList = _splitTypes(mixinsStr);
    }

    // Parse implements
    const implM = /^\s*implements\s+/.exec(header);
    if (implM) {
      interfacesList = _splitTypes(header.slice(implM.index + implM[0].length));
    }

    // Map extends inheritance relation
    if (baseClass) {
      const baseNid = _makeId(baseClass);
      addNode(baseNid, baseClass, 'code', null);
      addEdge(classNid, baseNid, 'inherits', 1.0, undefined, classLine);

      // Map generic type arguments (e.g. MyBloc extends Bloc<MyEvent, MyState>)
      if (generics) {
        for (const gen of _splitTypes(generics)) {
          const genClean = gen.split('<')[0].trim();
          if (!DART_PRIMITIVE_TYPES.has(genClean)) {
            const genNid = _makeId(genClean);
            addNode(genNid, genClean, 'code', null);
            addEdge(classNid, genNid, 'references', 1.0, undefined, classLine);
          }
        }
      }
    }

    // Map mixins
    for (const mixin of mixinsList) {
      const mixinClean = mixin.split('<')[0].trim();
      const mixinNid = _makeId(mixinClean);
      addNode(mixinNid, mixinClean, 'code', null);
      addEdge(classNid, mixinNid, 'mixes_in', 1.0, undefined, classLine);
    }

    // Map interfaces
    for (const iface of interfacesList) {
      const ifaceClean = iface.split('<')[0].trim();
      const ifaceNid = _makeId(ifaceClean);
      addNode(ifaceNid, ifaceClean, 'code', null);
      addEdge(classNid, ifaceNid, 'implements', 1.0, undefined, classLine);
    }

    // Extract class body for precise framework dependencies and event handling
    const declStart = m.index;
    const bracePos = srcClean.indexOf('{', declStart);
    const semiPos = srcClean.indexOf(';', declStart);

    let hasBody = bracePos !== -1;
    if (hasBody && semiPos !== -1 && semiPos < bracePos) {
      hasBody = false;
    }

    if (hasBody) {
      const endPos = _findMatchingBrace(srcClean, declStart);
      const classBody = srcClean.slice(bracePos, endPos);

      // Bloc event registration: on<MyEvent>()
      const onEventRegex = /\bon<(\w+)>\s*\(/g;
      let em: RegExpExecArray | null;
      while ((em = onEventRegex.exec(classBody)) !== null) {
        const eventName = em[1];
        const eventNid = _makeId(eventName);
        addNode(eventNid, eventName, 'code', null);
        addEdge(classNid, eventNid, 'calls', 1.0, 'bloc_event', lineAt(bracePos + em.index));
      }

      // Bloc state emissions: emit(MyState) or yield MyState
      const emitRegex = /\b(?:emit|yield)\s*\(?\s*(?:const\s+)?([A-Z]\w*)\b/g;
      let sm: RegExpExecArray | null;
      while ((sm = emitRegex.exec(classBody)) !== null) {
        const stateName = sm[1];
        if (!DART_PRIMITIVE_TYPES.has(stateName)) {
          const stateNid = _makeId(stateName);
          addNode(stateNid, stateName, 'code', null);
          addEdge(classNid, stateNid, 'calls', 1.0, 'emit_state', lineAt(bracePos + sm.index));
        }
      }

      // Bloc event additions: widget.add(MyEvent()) or bloc.add(MyEvent()) or add(MyEvent())
      const addEventRegex = /\b(?:(?:\w*[Bb]loc\w*|context\.read<\w+>\(\)|widget)\.)?add\(\s*(?:const\s+)?([A-Z]\w*)\b/g;
      let am: RegExpExecArray | null;
      while ((am = addEventRegex.exec(classBody)) !== null) {
        const eventName = am[1];
        if (!DART_PRIMITIVE_TYPES.has(eventName)) {
          const eventNid = _makeId(eventName);
          addNode(eventNid, eventName, 'code', null);
          addEdge(classNid, eventNid, 'calls', 1.0, 'bloc_add_event', lineAt(bracePos + am.index));
        }
      }

      // Riverpod provider references: ref.watch(provider)
      const refRegex = /\bref\.(?:watch|read|listen)\s*\(\s*(\w+)\b/g;
      let rm: RegExpExecArray | null;
      while ((rm = refRegex.exec(classBody)) !== null) {
        const providerName = rm[1];
        const providerNid = _makeId(providerName);
        addNode(providerNid, providerName, 'code', null);
        addEdge(classNid, providerNid, 'references', 1.0, 'riverpod_reference', lineAt(bracePos + rm.index));
      }

      // Widget to Bloc references: BlocBuilder<MyBloc, ...>
      const widgetBlocRegex = /\bBloc(?:Builder|Listener|Consumer|Provider|Selector)\s*<\s*([a-zA-Z0-9_]+)\b/g;
      let bm: RegExpExecArray | null;
      while ((bm = widgetBlocRegex.exec(classBody)) !== null) {
        const blocName = bm[1];
        if (!DART_PRIMITIVE_TYPES.has(blocName)) {
          const blocNid = _makeId(blocName);
          addNode(blocNid, blocName, 'code', null);
          addEdge(classNid, blocNid, 'references', 1.0, 'bloc_widget_binding', lineAt(bracePos + bm.index));
        }
      }

      // context.read<MyBloc>() or BlocProvider.of<MyBloc>(context)
      const contextLookupRegex = /\b(?:read|watch|select|of)\s*<([a-zA-Z0-9_]+)>/g;
      let lm: RegExpExecArray | null;
      while ((lm = contextLookupRegex.exec(classBody)) !== null) {
        const blocName = lm[1];
        if (!DART_PRIMITIVE_TYPES.has(blocName)) {
          const blocNid = _makeId(blocName);
          addNode(blocNid, blocName, 'code', null);
          addEdge(classNid, blocNid, 'references', 1.0, 'bloc_lookup', lineAt(bracePos + lm.index));
        }
      }
    }
  }

  // 2. Annotations mapping
  const annotationPattern = /@(\w+)(?:\([^)]*\))?/g;
  let anMatch: RegExpExecArray | null;

  while ((anMatch = annotationPattern.exec(srcClean)) !== null) {
    const annotationName = anMatch[1];
    if (['override', 'deprecated', 'required', 'protected', 'mustCallSuper'].includes(annotationName)) {
      continue;
    }

    const annotationPos = annotationPattern.lastIndex;
    const intervening = srcClean.slice(annotationPos, annotationPos + 300);

    const classM = /^\s*(?:(?:abstract|sealed|base|interface|final|mixin)\s+)*(?:class|mixin|enum|extension\s+type)\s+(\w+)/m.exec(intervening);
    const funcM = /^\s*(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+)\s*\(/m.exec(intervening);

    let targetNid: string | null = null;
    let targetName: string | null = null;
    let targetType: 'class' | 'function' | null = null;

    if (classM && funcM) {
      if (classM.index < funcM.index) {
        targetName = classM[1];
        targetType = 'class';
        targetNid = _makeId(stem, targetName);
      } else {
        targetName = funcM[1];
        targetType = 'function';
        targetNid = _makeId(stem, targetName);
      }
    } else if (classM) {
      targetName = classM[1];
      targetType = 'class';
      targetNid = _makeId(stem, targetName);
    } else if (funcM) {
      targetName = funcM[1];
      targetType = 'function';
      targetNid = _makeId(stem, targetName);
    }

    if (targetNid && targetName) {
      const minOffset = Math.min(
        classM ? classM.index : 300,
        funcM ? funcM.index : 300
      );
      const actualIntervening = intervening.slice(0, minOffset);

      if (!actualIntervening.includes(';') && !actualIntervening.includes('}') && !actualIntervening.includes('{')) {
        const annotationLine = lineAt(anMatch.index);
        const annotationNid = _makeId('annotation', annotationName.toLowerCase());
        addNode(annotationNid, `@${annotationName}`, 'concept', null);
        addEdge(targetNid, annotationNid, 'configures', 1.0, undefined, annotationLine);

        // Riverpod specific provider generation mapping
        if (annotationName.toLowerCase() === 'riverpod') {
          const providerName = targetType === 'class'
            ? (targetName.length > 1 ? targetName[0].toLowerCase() + targetName.slice(1) : targetName.toLowerCase()) + 'Provider'
            : targetName + 'Provider';
          const providerNid = _makeId(providerName);
          addNode(providerNid, providerName, 'concept', filePathStr, annotationLine);
          addEdge(targetNid, providerNid, 'defines', 1.0, 'riverpod_provider', annotationLine);
        }
      }
    }
  }

  // 2.5 Typedefs
  const typedefPattern = /^\s*typedef\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*([^;]+);/gm;
  while ((m = typedefPattern.exec(srcClean)) !== null) {
    const typedefName = m[1];
    const typedefLine = lineAt(m.index);
    const targetType = m[2].split('<')[0].split('.').pop()!.trim();

    if (!DART_PRIMITIVE_TYPES.has(targetType)) {
      const typedefNid = _makeId(stem, typedefName);
      addNode(typedefNid, typedefName, 'code', filePathStr, typedefLine);
      addEdge(fileNid, typedefNid, 'defines', 1.0, undefined, typedefLine);

      const targetNid = _makeId(targetType);
      addNode(targetNid, targetType, 'code', null);
      addEdge(typedefNid, targetNid, 'references', 1.0, 'typedef', typedefLine);
    }
  }

  // 3. Extensions (extension MyExt on MyClass)
  const extPattern = /^\s{0,4}extension\s+(?:(\w+)(?:<[^>]+>)?\s+)?on\s+(\w+)/gm;
  while ((m = extPattern.exec(srcClean)) !== null) {
    const extName = m[1] || `${stem}_anonymous_extension`;
    const targetClass = m[2];
    const extLine = lineAt(m.index);

    const extNid = _makeId(stem, extName);
    const label = m[1] || `Extension on ${targetClass}`;
    addNode(extNid, label, 'code', filePathStr, extLine);
    addEdge(fileNid, extNid, 'defines', 1.0, undefined, extLine);

    const targetNid = _makeId(targetClass);
    addNode(targetNid, targetClass, 'code', null);
    addEdge(extNid, targetNid, 'extends', 1.0, undefined, extLine);
  }

  // 4. Variables (generic variables, records, late, and destructuring)
  const varPattern = /^\s{0,2}(?:late\s+)?(?:(?:final|const|var)\s+)?(?:\([^)]+\)\s+|([a-zA-Z0-9_<>,.?]+(?:\s+[a-zA-Z0-9_<>,.?]+){0,3})\s+)?(?:(\w+)|(?:\w+\s*)?\(([^)]+)\))\s*(?:=|$|;)/gm;
  while ((m = varPattern.exec(srcClean)) !== null) {
    const varType = m[1];
    const singleName = m[2];
    const destructuredNames = m[3];

    if (!/^\s*(?:late|final|const|var)\b/.test(m[0]) && !varType) {
      continue;
    }

    if (singleName && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(singleName)) {
      const varLine = lineAt(m.index);
      const varNid = _makeId(stem, singleName);
      addNode(varNid, singleName, 'code', filePathStr, varLine);
      addEdge(fileNid, varNid, 'defines', 1.0, undefined, varLine);

      if (varType) {
        const cleanType = varType.split('<')[0].split('.').pop()!.trim();
        if (!DART_PRIMITIVE_TYPES.has(cleanType)) {
          const typeNid = _makeId(cleanType);
          addNode(typeNid, cleanType, 'code', null);
          addEdge(fileNid, typeNid, 'references', 1.0, 'variable_type', varLine);
        }
      }
    } else if (destructuredNames) {
      const destructureLine = lineAt(m.index);
      const names = destructuredNames
        .split(',')
        .map(n => n.includes(':') ? n.split(':').pop()!.trim() : n.trim())
        .filter(n => /^[a-zA-Z_]\w*$/.test(n) && !/^[A-Z]/.test(n) && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(n));

      for (const name of names) {
        const varNid = _makeId(stem, name);
        addNode(varNid, name, 'code', filePathStr, destructureLine);
        addEdge(fileNid, varNid, 'defines', 1.0, undefined, destructureLine);
      }
    }
  }

  // 5. Top-level and member functions/methods
  const methodPattern = /^\s{0,2}(?:factory\s+|static\s+|async\s+|external\s+|abstract\s+)?(?:\([^)]+\)|[a-zA-Z0-9_<>,.?]+)(?:\s+[a-zA-Z0-9_<>,.?]+){0,3}\s+(\w+(?:\.\w+)?)\s*\(/gm;
  while ((m = methodPattern.exec(srcClean)) !== null) {
    const rawName = m[1];
    const name = rawName.split('.').pop()!;
    if (['if', 'for', 'while', 'switch', 'catch', 'return', 'void', 'dynamic', 'final', 'const', 'get', 'set'].includes(name)) {
      continue;
    }
    if (/^[A-Z]/.test(name)) continue;

    const methodLine = lineAt(m.index);
    const nid = _makeId(stem, name);
    addNode(nid, name, 'code', filePathStr, methodLine);
    addEdge(fileNid, nid, 'defines', 1.0, undefined, methodLine);

    // Get function body
    const startIdx = m.index;
    const bracePos = srcClean.indexOf('{', startIdx);
    const semiPos = srcClean.indexOf(';', startIdx);
    const arrowPos = srcClean.indexOf('=>', startIdx);

    let hasBody = bracePos !== -1;
    if (hasBody && semiPos !== -1 && semiPos < bracePos) hasBody = false;
    if (hasBody && arrowPos !== -1 && arrowPos < bracePos) hasBody = false;

    if (hasBody) {
      const endPos = _findMatchingBrace(srcClean, startIdx);
      const funcBody = srcClean.slice(bracePos, endPos);

      // Riverpod references: ref.watch(provider)
      const refRegex = /\bref\.(?:watch|read|listen)\s*\(\s*(\w+)\b/g;
      let rm: RegExpExecArray | null;
      while ((rm = refRegex.exec(funcBody)) !== null) {
        const providerName = rm[1];
        const providerNid = _makeId(providerName);
        addNode(providerNid, providerName, 'code', null);
        addEdge(nid, providerNid, 'references', 1.0, 'riverpod_reference', lineAt(bracePos + rm.index));
      }

      // Bloc event additions: widget.add(MyEvent()) or bloc.add(MyEvent()) or add(MyEvent())
      const addEventRegex = /\b(?:(?:\w*[Bb]loc\w*|context\.read<\w+>\(\)|widget)\.)?add\(\s*(?:const\s+)?([A-Z]\w*)\b/g;
      let am: RegExpExecArray | null;
      while ((am = addEventRegex.exec(funcBody)) !== null) {
        const eventName = am[1];
        if (!DART_PRIMITIVE_TYPES.has(eventName)) {
          const eventNid = _makeId(eventName);
          addNode(eventNid, eventName, 'code', null);
          addEdge(nid, eventNid, 'calls', 1.0, 'bloc_add_event', lineAt(bracePos + am.index));
        }
      }

      // context.read<MyBloc>() or BlocProvider.of<MyBloc>(context)
      const contextLookupRegex = /\b(?:read|watch|select|of)\s*<([a-zA-Z0-9_]+)>/g;
      let lm: RegExpExecArray | null;
      while ((lm = contextLookupRegex.exec(funcBody)) !== null) {
        const blocName = lm[1];
        if (!DART_PRIMITIVE_TYPES.has(blocName)) {
          const blocNid = _makeId(blocName);
          addNode(blocNid, blocName, 'code', null);
          addEdge(nid, blocNid, 'references', 1.0, 'bloc_lookup', lineAt(bracePos + lm.index));
        }
      }

      // Universal Navigation Patterns (GoRouter, AutoRoute, Navigator)
      const routePathRegex = /\b(?:go|push|goNamed|pushNamed|replace|replaceNamed)\s*\(\s*(?:context\s*,\s*)?['"]([a-zA-Z0-9_/?=&%-]+)['"]/g;
      let nm: RegExpExecArray | null;
      while ((nm = routePathRegex.exec(funcBody)) !== null) {
        const routePath = nm[1];
        const routeNid = _makeId('route', routePath.replace(/[/=&#?-]/g, '_'));
        addNode(routeNid, `Route ${routePath}`, 'concept', null);
        addEdge(nid, routeNid, 'navigates', 1.0, 'route_path', lineAt(bracePos + nm.index));
      }

      const routeConstRegex = /\b(?:go|push|goNamed|pushNamed|replace|replaceNamed)\s*\(\s*(?:context\s*,\s*)?([A-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+)/g;
      let cm: RegExpExecArray | null;
      while ((cm = routeConstRegex.exec(funcBody)) !== null) {
        const routeConst = cm[1];
        const routeNid = _makeId('route', routeConst.replace(/\./g, '_'));
        addNode(routeNid, routeConst, 'concept', null);
        addEdge(nid, routeNid, 'navigates', 1.0, 'route_const', lineAt(bracePos + cm.index));
      }

      const routeObjRegex = /\b(?:push|replace)\s*\(\s*(?:context\s*,\s*)?.*?\b([A-Z]\w*(?:Route|Screen|Page))\b/g;
      let om: RegExpExecArray | null;
      while ((om = routeObjRegex.exec(funcBody)) !== null) {
        const routeClass = om[1];
        const routeNid = _makeId(routeClass);
        addNode(routeNid, routeClass, 'code', null);
        addEdge(nid, routeNid, 'navigates', 1.0, 'route_object', lineAt(bracePos + om.index));
      }
    }
  }

  // 6. Imports and Exports
  const importPattern = /^\s*import\s+['"]([^'"]+)['"]/gm;
  while ((m = importPattern.exec(srcClean)) !== null) {
    const pkg = m[1];
    const tgtNid = _makeId(pkg);
    addNode(tgtNid, pkg, 'code', null);
    addEdge(fileNid, tgtNid, 'imports', 1.0, undefined, lineAt(m.index));
  }

  const exportPattern = /^\s*export\s+['"]([^'"]+)['"]/gm;
  while ((m = exportPattern.exec(srcClean)) !== null) {
    const pkg = m[1];
    const tgtNid = _makeId(pkg);
    addNode(tgtNid, pkg, 'code', null);
    addEdge(fileNid, tgtNid, 'exports', 1.0, undefined, lineAt(m.index));
  }

  // 7. Generic Invocations / Type Lookups (Universal Dependency Lookup)
  const genericCallPattern = /\b\w+<([a-zA-Z0-9_.]+(?:<[a-zA-Z0-9_.,\s<>]+>)?)\s*>\s*\(/g;
  while ((m = genericCallPattern.exec(srcClean)) !== null) {
    const typeName = m[1].split('.').pop()!.trim();
    const cleanName = typeName.split('<')[0].trim();
    if (!DART_PRIMITIVE_TYPES.has(cleanName)) {
      const targetNid = _makeId(cleanName);
      addNode(targetNid, cleanName, 'code', null);
      addEdge(fileNid, targetNid, 'references', 1.0, 'type_lookup', lineAt(m.index));
    }
  }

  return { nodes, edges };
}
