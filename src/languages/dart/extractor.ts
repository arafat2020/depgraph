import path from 'path';
import { RawEntity, RawImport } from '../../types';
import { cleanDartComments, _fileStem, estimateComplexity } from './helpers';
import { DART_KEYWORDS } from './patterns';

// ─── entity extractor ───────────────────────────────────

export function extractEntities(code: string, filePath: string): RawEntity[] {
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

export function extractImports(code: string): RawImport[] {
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

export function extractExports(code: string): string[] {
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
