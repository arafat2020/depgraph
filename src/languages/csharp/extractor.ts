import { RawEntity, RawImport } from '../../types';
import { csharpEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

export function extractEntities(code: string, filePath: string): RawEntity[] {
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

// ─── import extractor ────────────────────────────────────

export function extractImports(code: string): RawImport[] {
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

// ─── export extractor ────────────────────────────────────

export function extractExports(code: string): string[] {
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
