import { RawEntity, RawImport } from '../../types';
import { goEntityPatterns } from './patterns';
import { estimateComplexity } from './helpers';

// ─── entity extractor ────────────────────────────────────

export function extractEntities(code: string, filePath: string): RawEntity[] {
  const entities: RawEntity[] = [];

  for (const { regex, type } of goEntityPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];
      if (entities.some(e => e.name === name)) continue;

      const upToMatch = code.slice(0, match.index);
      const line = upToMatch.split('\n').length;

      entities.push({
        name,
        type,
        line,
        complexity: type === 'function' ? estimateComplexity(code, name) : 'low'
      });
    }
  }

  // Handle block type declarations: type (\n Name1 struct { ... }\n Name2 interface { ... }\n)
  const blockTypePattern = /^type\s*\(\s*\n?([\s\S]*?)\n\s*\)/gm;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockTypePattern.exec(code)) !== null) {
    const blockContent = blockMatch[1];
    const blockStartLine = code.slice(0, blockMatch.index).split('\n').length;
    const lines = blockContent.split('\n');

    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (braceDepth === 0 && line.length > 0 && !line.startsWith('//')) {
        const structInterfaceMatch = line.match(/^([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(struct|interface)/);
        if (structInterfaceMatch) {
          const name = structInterfaceMatch[1];
          if (!entities.some(e => e.name === name)) {
            entities.push({
              name,
              type: 'class',
              line: blockStartLine + i + 1,
              complexity: 'low'
            });
          }
        } else {
          const aliasMatch = line.match(/^([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s+(?:=\s*)?(?!(?:struct|interface)\b)[A-Za-z_\[\]\*]/);
          if (aliasMatch) {
            const name = aliasMatch[1];
            if (!entities.some(e => e.name === name)) {
              entities.push({
                name,
                type: 'type',
                line: blockStartLine + i + 1,
                complexity: 'low'
              });
            }
          }
        }
      }

      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
    }
  }

  return entities;
}

// ─── import extractor ────────────────────────────────────

export function extractImports(code: string): RawImport[] {
  const imports: RawImport[] = [];

  // import "pkg" or import alias "pkg"
  const singlePattern = /^import\s+(?:([A-Za-z_.\w]+)\s+)?["']([^"']+)["']/gm;
  let match: RegExpExecArray | null;
  while ((match = singlePattern.exec(code)) !== null) {
    const alias = match[1];
    const source = match[2];
    const pkgName = alias && alias !== '_' && alias !== '.'
      ? alias
      : source.split('/').pop() || source;
    imports.push({
      source,
      names: [pkgName],
      isLocal: source.startsWith('.') || source.startsWith('/')
    });
  }

  // import ( "pkg1" \n alias "pkg2" )
  const blockPattern = /import\s*\(\s*([\s\S]*?)\s*\)/gm;
  while ((match = blockPattern.exec(code)) !== null) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const cleanLine = line.replace(/\/\/.*$/, '').trim();
      const pkgMatch = cleanLine.match(/^(?:([A-Za-z_.\w]+)\s+)?["']([^"']+)["']/);
      if (pkgMatch) {
        const alias = pkgMatch[1];
        const source = pkgMatch[2];
        const pkgName = alias && alias !== '_' && alias !== '.'
          ? alias
          : source.split('/').pop() || source;
        imports.push({
          source,
          names: [pkgName],
          isLocal: source.startsWith('.') || source.startsWith('/')
        });
      }
    }
  }

  return imports;
}

// ─── export extractor ────────────────────────────────────

export function extractExports(code: string): string[] {
  // In Go, any top-level identifier starting with an uppercase letter is exported
  const exports: string[] = [];

  // Exported functions & methods
  const funcPattern = /^func\s+(?:\([^)]*\)\s+)?([A-Z]\w*)\s*(?:\[[^\]]*\])?\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = funcPattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // Exported types (single line)
  const typePattern = /^type\s+([A-Z]\w*)/gm;
  while ((match = typePattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // Exported types inside type blocks
  const blockTypePattern = /^type\s*\(\s*\n?([\s\S]*?)\n\s*\)/gm;
  let blockTypeMatch: RegExpExecArray | null;
  while ((blockTypeMatch = blockTypePattern.exec(code)) !== null) {
    const lines = blockTypeMatch[1].split('\n');
    let braceDepth = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (braceDepth === 0 && trimmed.length > 0 && !trimmed.startsWith('//')) {
        const m = trimmed.match(/^([A-Z]\w*)/);
        if (m) exports.push(m[1]);
      }
      for (const ch of trimmed) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
    }
  }

  // Exported constants and variables
  const constVarPattern = /^(?:const|var)\s+([A-Z]\w*)/gm;
  while ((match = constVarPattern.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // Exported constants and variables inside blocks
  const blockConstVarPattern = /^(?:const|var)\s*\(\s*\n?([\s\S]*?)\n\s*\)/gm;
  while ((match = blockConstVarPattern.exec(code)) !== null) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('//')) {
        const m = trimmed.match(/^([A-Z]\w*)/);
        if (m) exports.push(m[1]);
      }
    }
  }

  return [...new Set(exports)];
}
