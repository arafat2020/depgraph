import { RawEntity, RawImport } from '../../types';
import { cleanRustComments, estimateComplexity } from './helpers';
import { RUST_KEYWORDS } from './patterns';

// ─── entity extractor ───────────────────────────────────

export function extractEntities(code: string, _filePath: string): RawEntity[] {
  const cleanCode = cleanRustComments(code);
  const entities: RawEntity[] = [];

  function lineAt(offset: number): number {
    return cleanCode.slice(0, offset).split('\n').length;
  }

  // 1. Structs, Enums, Traits
  const itemPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(struct|enum)|(?:unsafe\s+)?(trait))\s+([A-Za-z_]\w*)/gm;
  let m: RegExpExecArray | null;

  while ((m = itemPattern.exec(cleanCode)) !== null) {
    const isStructOrEnum = Boolean(m[1]);
    const name = m[3];
    if (RUST_KEYWORDS.has(name)) continue;

    const line = lineAt(m.index);
    if (!entities.some(e => e.name === name && e.line === line)) {
      entities.push({
        name,
        type: isStructOrEnum ? 'class' : 'interface',
        line,
        complexity: 'low',
      });
    }
  }

  // 2. Type Aliases
  const typeAliasPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?type\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*=/gm;
  while ((m = typeAliasPattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (RUST_KEYWORDS.has(name)) continue;

    const line = lineAt(m.index);
    if (!entities.some(e => e.name === name && e.line === line)) {
      entities.push({
        name,
        type: 'type',
        line,
        complexity: 'low',
      });
    }
  }

  // 3. Functions & Methods (both free and inside impl/trait blocks)
  const fnPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm;
  while ((m = fnPattern.exec(cleanCode)) !== null) {
    const name = m[1];
    if (RUST_KEYWORDS.has(name)) continue;

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

  return entities;
}

// ─── import extractor ───────────────────────────────────

export function extractImports(code: string): RawImport[] {
  const cleanCode = cleanRustComments(code);
  const imports: RawImport[] = [];

  // Matches use [pub] foo::bar::{A, B}; or use foo::bar as my_bar; or use foo::bar;
  const usePattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?use\s+([^;]+);/gm;
  let m: RegExpExecArray | null;

  while ((m = usePattern.exec(cleanCode)) !== null) {
    const raw = m[1].trim();
    const isLocal = raw.startsWith('crate::') || raw.startsWith('super::') || raw.startsWith('self::');

    if (raw.includes('{')) {
      const braceStart = raw.indexOf('{');
      const basePrefix = raw.slice(0, braceStart).replace(/::$/, '').trim();
      const inner = raw.slice(braceStart + 1, raw.lastIndexOf('}')).trim();
      const items = inner.split(',').map(s => s.trim()).filter(Boolean);

      const names: string[] = [];
      for (const item of items) {
        if (item === 'self') {
          const baseName = basePrefix.split('::').pop()!;
          names.push(baseName);
        } else if (item.includes(' as ')) {
          const alias = item.split(' as ')[1].trim();
          names.push(alias);
        } else {
          names.push(item.split('::').pop()!.trim());
        }
      }

      imports.push({
        source: basePrefix,
        names: [...new Set(names)],
        isLocal,
      });
    } else {
      let source = '';
      let name = '';
      if (raw.includes(' as ')) {
        const parts = raw.split(' as ');
        source = parts[0].trim();
        name = parts[1].trim();
      } else {
        source = raw.trim();
        const segments = raw.split('::');
        name = segments[segments.length - 1].trim();
      }

      imports.push({
        source,
        names: [name],
        isLocal,
      });
    }
  }

  return imports;
}

// ─── export extractor ───────────────────────────────────

export function extractExports(code: string): string[] {
  const cleanCode = cleanRustComments(code);
  const exports: string[] = [];

  // 1. pub struct, pub enum, pub trait, pub type
  const itemPattern = /^[ \t]*pub(?:\([^)]*\))?\s+(?:(?:unsafe\s+)?(?:trait)|struct|enum|type)\s+([A-Za-z_]\w*)/gm;
  let m: RegExpExecArray | null;
  while ((m = itemPattern.exec(cleanCode)) !== null) {
    exports.push(m[1]);
  }

  // 2. pub fn
  const fnPattern = /^[ \t]*pub(?:\([^)]*\))?\s+(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)/gm;
  while ((m = fnPattern.exec(cleanCode)) !== null) {
    exports.push(m[1]);
  }

  // 3. pub const, pub static
  const constPattern = /^[ \t]*pub(?:\([^)]*\))?\s+(?:const|static)\s+([A-Za-z_]\w*)/gm;
  while ((m = constPattern.exec(cleanCode)) !== null) {
    exports.push(m[1]);
  }

  // 4. pub use re-exports
  const usePattern = /^[ \t]*pub(?:\([^)]*\))?\s+use\s+([^;]+);/gm;
  while ((m = usePattern.exec(cleanCode)) !== null) {
    const raw = m[1].trim();
    if (raw.includes('{')) {
      const inner = raw.slice(raw.indexOf('{') + 1, raw.lastIndexOf('}')).trim();
      const items = inner.split(',').map(s => s.trim().split(/\s+as\s+/).pop()!).filter(Boolean);
      exports.push(...items);
    } else {
      const last = raw.split(' as ').pop()!.split('::').pop()!.trim();
      if (last && last !== '*') exports.push(last);
    }
  }

  return [...new Set(exports)];
}
