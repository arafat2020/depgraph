import fs from 'fs';
import path from 'path';
import { RustGraphNode, RustGraphEdge, RustRawCall, RustGraphResult } from './types';
import {
  cleanRustComments,
  _fileStem,
  _makeId,
  _splitBalanced,
  _findMatchingBrace,
  _rustCollectTypeRefs
} from './helpers';
import {
  RUST_PRIMITIVES,
  RUST_KEYWORDS,
  RUST_TRAIT_METHOD_BLOCKLIST
} from './patterns';

// ─── Graphify Rust Extractor (Verbatim extraction function) ────

/**
 * Extracts functions, structs, enums, traits, impl methods, and use declarations
 * from a .rs file.
 * Corresponds to the Python extract_rust implementation.
 */
export function extractRust(
  fileInput: string | { path: string; readText?: () => string; readBytes?: () => Buffer }
): RustGraphResult {
  let source: string;
  let strPath: string;

  if (typeof fileInput === 'string') {
    strPath = fileInput;
    const isPath = (fileInput.endsWith('.rs') || fileInput.includes('/') || fileInput.includes('\\')) && !fileInput.includes('\n');
    if (isPath) {
      try {
        source = fs.readFileSync(fileInput, 'utf-8');
      } catch (err) {
        return { nodes: [], edges: [], raw_calls: [], error: `cannot read ${fileInput}` };
      }
    } else {
      source = fileInput;
      strPath = 'main.rs';
    }
  } else {
    strPath = fileInput.path;
    try {
      source = fileInput.readText ? fileInput.readText() : fs.readFileSync(fileInput.path, 'utf-8');
    } catch (err) {
      return { nodes: [], edges: [], raw_calls: [], error: `cannot read ${fileInput.path}` };
    }
  }

  const cleanSource = cleanRustComments(source);
  const stem = _fileStem(strPath);

  function lineAt(offset: number): number {
    return cleanSource.slice(0, offset).split('\n').length;
  }

  const nodes: RustGraphNode[] = [];
  const edges: RustGraphEdge[] = [];
  const rawCalls: RustRawCall[] = [];
  const seenIds = new Set<string>();

  function addNode(nid: string, label: string, line: number): void {
    if (!seenIds.has(nid)) {
      seenIds.add(nid);
      nodes.push({
        id: nid,
        label,
        file_type: 'code',
        source_file: strPath,
        source_location: `L${line}`,
      });
    }
  }

  function addEdge(
    src: string,
    tgt: string,
    relation: string,
    line: number,
    confidence = 'EXTRACTED',
    weight = 1.0,
    context?: string
  ): void {
    const edge: RustGraphEdge = {
      source: src,
      target: tgt,
      relation,
      confidence,
      source_file: strPath,
      source_location: `L${line}`,
      weight,
    };
    if (context) edge.context = context;
    edges.push(edge);
  }

  const fileNid = _makeId(strPath);
  addNode(fileNid, path.basename(strPath), 1);

  function ensureNamedNode(name: string, line: number): string {
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
        file_type: 'code',
        source_file: '',
        source_location: '',
        origin_file: strPath,
      });
    }
    return nidGlobal;
  }

  function emitParamReturnRefs(paramsText: string, returnText: string | null, funcNid: string, line: number): void {
    if (paramsText) {
      for (const p of _splitBalanced(paramsText)) {
        // param: &self, mut x: Type, or x: Type
        if (p === '&self' || p === '&mut self' || p === 'self' || p === 'mut self') continue;
        const colonIdx = p.indexOf(':');
        if (colonIdx !== -1) {
          const typePart = p.slice(colonIdx + 1).trim();
          const refs: [string, string][] = [];
          _rustCollectTypeRefs(typePart, false, refs);
          for (const [refName, role] of refs) {
            const ctx = role === 'generic_arg' ? 'generic_arg' : 'parameter_type';
            const tgt = ensureNamedNode(refName, line);
            if (tgt !== funcNid) {
              addEdge(funcNid, tgt, 'references', line, 'EXTRACTED', 1.0, ctx);
            }
          }
        }
      }
    }

    if (returnText) {
      const refs: [string, string][] = [];
      _rustCollectTypeRefs(returnText, false, refs);
      for (const [refName, role] of refs) {
        const ctx = role === 'generic_arg' ? 'generic_arg' : 'return_type';
        const tgt = ensureNamedNode(refName, line);
        if (tgt !== funcNid) {
          addEdge(funcNid, tgt, 'references', line, 'EXTRACTED', 1.0, ctx);
        }
      }
    }
  }

  // To track function bodies for walking calls
  const functionBodies: [string, string, number][] = []; // [funcNid, bodyCode, bodyStartOffset]

  // ─── 1. Structs, Enums, Traits, and Impl blocks ────────

  // Find all top-level / impl / trait constructs
  const itemPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(struct|enum)|(?:unsafe\s+)?(trait)|(impl))\b/gm;
  let m: RegExpExecArray | null;

  while ((m = itemPattern.exec(cleanSource)) !== null) {
    const itemStart = m.index;
    const kind = m[1] || m[2] || m[3];
    const headerEnd = cleanSource.indexOf('{', itemStart);
    const semiEnd = cleanSource.indexOf(';', itemStart);

    if (kind === 'struct') {
      // Named struct: struct Foo { ... }
      // Tuple struct: struct Foo(Bar, Baz);
      // Unit struct: struct Foo;
      const structM = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)(?:<[^>]*>)?(?:\s*\(([^)]*)\)|\s*\{)?/m.exec(
        cleanSource.slice(itemStart, itemStart + 300)
      );

      if (structM) {
        const structName = structM[1];
        const line = lineAt(itemStart);
        const structNid = _makeId(stem, structName);
        addNode(structNid, structName, line);
        addEdge(fileNid, structNid, 'contains', line);

        const tupleFields = structM[2];
        if (tupleFields !== undefined) {
          // Tuple struct: struct Foo(pub Logger, Config);
          for (const field of _splitBalanced(tupleFields)) {
            const cleanField = field.replace(/^pub(?:\([^)]*\))?\s+/, '').trim();
            const refs: [string, string][] = [];
            _rustCollectTypeRefs(cleanField, false, refs);
            for (const [refName, role] of refs) {
              const ctx = role === 'generic_arg' ? 'generic_arg' : 'field';
              const tgt = ensureNamedNode(refName, line);
              if (tgt !== structNid) {
                addEdge(structNid, tgt, 'references', line, 'EXTRACTED', 1.0, ctx);
              }
            }
          }
        } else if (headerEnd !== -1 && (semiEnd === -1 || headerEnd < semiEnd)) {
          // Named fields struct: struct Foo { field: Type, ... }
          const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
          const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);
          for (const rawField of _splitBalanced(body, ',')) {
            const field = rawField.trim();
            if (!field) continue;
            const colonIdx = field.indexOf(':');
            if (colonIdx !== -1) {
              const fType = field.slice(colonIdx + 1).trim();
              const fLine = lineAt(headerEnd);
              const refs: [string, string][] = [];
              _rustCollectTypeRefs(fType, false, refs);
              for (const [refName, role] of refs) {
                const ctx = role === 'generic_arg' ? 'generic_arg' : 'field';
                const tgt = ensureNamedNode(refName, fLine);
                if (tgt !== structNid) {
                  addEdge(structNid, tgt, 'references', fLine, 'EXTRACTED', 1.0, ctx);
                }
              }
            }
          }
        }
      }
    } else if (kind === 'enum') {
      const enumM = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/m.exec(
        cleanSource.slice(itemStart, itemStart + 200)
      );
      if (enumM && headerEnd !== -1) {
        const enumName = enumM[1];
        const line = lineAt(itemStart);
        const enumNid = _makeId(stem, enumName);
        addNode(enumNid, enumName, line);
        addEdge(fileNid, enumNid, 'contains', line);

        const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
        const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);

        // Match enum variants: Variant, Variant(Type1, Type2), Variant { field: Type }
        const variantPattern = /([A-Za-z_]\w*)(?:\s*\(([^)]*)\)|\s*\{([^}]*)\})?/g;
        let vm: RegExpExecArray | null;
        while ((vm = variantPattern.exec(body)) !== null) {
          const vLine = lineAt(headerEnd + vm.index);
          const tupleTypes = vm[2];
          const structFields = vm[3];

          if (tupleTypes) {
            for (const t of _splitBalanced(tupleTypes)) {
              const refs: [string, string][] = [];
              _rustCollectTypeRefs(t.trim(), false, refs);
              for (const [refName, role] of refs) {
                const ctx = role === 'generic_arg' ? 'generic_arg' : 'field';
                const tgt = ensureNamedNode(refName, vLine);
                if (tgt !== enumNid) {
                  addEdge(enumNid, tgt, 'references', vLine, 'EXTRACTED', 1.0, ctx);
                }
              }
            }
          } else if (structFields) {
            for (const rawField of _splitBalanced(structFields, ',')) {
              const field = rawField.trim();
              if (!field) continue;
              const colonIdx = field.indexOf(':');
              if (colonIdx !== -1) {
                const fType = field.slice(colonIdx + 1).trim();
                const refs: [string, string][] = [];
                _rustCollectTypeRefs(fType, false, refs);
                for (const [refName, role] of refs) {
                  const ctx = role === 'generic_arg' ? 'generic_arg' : 'field';
                  const tgt = ensureNamedNode(refName, vLine);
                  if (tgt !== enumNid) {
                    addEdge(enumNid, tgt, 'references', vLine, 'EXTRACTED', 1.0, ctx);
                  }
                }
              }
            }
          }
        }
      }
    } else if (kind === 'trait') {
      const traitM = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:unsafe\s+)?trait\s+([A-Za-z_]\w*)(?:<[^>]*>)?(?:\s*:\s*([^{]+))?/m.exec(
        cleanSource.slice(itemStart, itemStart + 300)
      );

      if (traitM && headerEnd !== -1) {
        const traitName = traitM[1];
        const line = lineAt(itemStart);
        const traitNid = _makeId(stem, traitName);
        addNode(traitNid, traitName, line);
        addEdge(fileNid, traitNid, 'contains', line);

        const boundsStr = traitM[2];
        if (boundsStr) {
          const bounds = boundsStr.split('+').map(s => s.trim()).filter(Boolean);
          for (let idx = 0; idx < bounds.length; idx++) {
            const b = bounds[idx];
            const refs: [string, string][] = [];
            _rustCollectTypeRefs(b, false, refs);
            for (let rIdx = 0; rIdx < refs.length; rIdx++) {
              const [refName] = refs[rIdx];
              const tgt = ensureNamedNode(refName, line);
              if (tgt === traitNid) continue;
              const rel = (idx === 0 && rIdx === 0) ? 'inherits' : 'references';
              addEdge(traitNid, tgt, rel, line, 'EXTRACTED', 1.0, rel === 'references' ? 'generic_arg' : undefined);
            }
          }
        }

        // Methods declared inside trait (both signatures without body and default methods)
        const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
        const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);
        const traitMethodPattern = /^[ \t]*(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{;]+))?\s*([{;])/gm;
        let tmm: RegExpExecArray | null;

        while ((tmm = traitMethodPattern.exec(body)) !== null) {
          const methodName = tmm[1];
          const mLine = lineAt(headerEnd + tmm.index);
          const methodNid = _makeId(traitNid, methodName);
          addNode(methodNid, `.${methodName}()`, mLine);
          addEdge(traitNid, methodNid, 'method', mLine);

          emitParamReturnRefs(tmm[2], tmm[3], methodNid, mLine);

          if (tmm[4] === '{') {
            const mBodyEnd = _findMatchingBrace(body, tmm.index);
            const mBody = body.slice(tmm.index + tmm[0].length - 1, mBodyEnd);
            functionBodies.push([methodNid, mBody, headerEnd + tmm.index + tmm[0].length - 1]);
          }
        }
      }
    } else if (kind === 'impl') {
      // impl Type or impl<T> Type<T> or impl Trait for Type or impl<T> Trait for Type<T>
      const implHeader = cleanSource.slice(itemStart, headerEnd).trim();
      const implM = /^[ \t]*impl(?:\s*<[^>]*>)?\s+(?:([A-Za-z_]\w*(?:\s*<[^>]*>)?)\s+for\s+)?([A-Za-z_]\w*(?:\s*<[^>]*>)?)/m.exec(implHeader);

      if (implM && headerEnd !== -1) {
        const traitPart = implM[1];
        const typePart = implM[2];
        const typeName = typePart.split('<')[0].split('::').pop()!.trim();
        const line = lineAt(itemStart);
        const implNid = _makeId(stem, typeName);
        addNode(implNid, typeName, line);

        if (traitPart) {
          const traitRefs: [string, string][] = [];
          _rustCollectTypeRefs(traitPart, false, traitRefs);
          for (let idx = 0; idx < traitRefs.length; idx++) {
            const [refName] = traitRefs[idx];
            const tgt = ensureNamedNode(refName, line);
            if (tgt !== implNid) {
              if (idx === 0) {
                addEdge(implNid, tgt, 'implements', line);
              } else {
                addEdge(implNid, tgt, 'references', line, 'EXTRACTED', 1.0, 'generic_arg');
              }
            }
          }
        }

        // Methods inside impl block
        const bodyEnd = _findMatchingBrace(cleanSource, itemStart);
        const body = cleanSource.slice(headerEnd + 1, bodyEnd - 1);
        const implMethodPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*\{/gm;
        let imm: RegExpExecArray | null;

        while ((imm = implMethodPattern.exec(body)) !== null) {
          const methodName = imm[1];
          const mLine = lineAt(headerEnd + imm.index);
          const methodNid = _makeId(implNid, methodName);
          addNode(methodNid, `.${methodName}()`, mLine);
          addEdge(implNid, methodNid, 'method', mLine);

          emitParamReturnRefs(imm[2], imm[3], methodNid, mLine);

          const mBodyEnd = _findMatchingBrace(body, imm.index);
          const mBody = body.slice(imm.index + imm[0].length - 1, mBodyEnd);
          functionBodies.push([methodNid, mBody, headerEnd + imm.index + imm[0].length - 1]);
        }
      }
    }
  }

  // ─── 2. Free / Top-level Functions ─────────────────────

  // Match free functions (not inside impl or trait)
  const freeFnPattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern(?:\s+"[^"]*")?)\s+)*fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*\{/gm;
  while ((m = freeFnPattern.exec(cleanSource)) !== null) {
    const funcName = m[1];
    const funcLine = lineAt(m.index);
    const funcNid = _makeId(stem, funcName);

    // If not already registered as an impl or trait method
    if (!seenIds.has(funcNid)) {
      addNode(funcNid, `${funcName}()`, funcLine);
      addEdge(fileNid, funcNid, 'contains', funcLine);

      emitParamReturnRefs(m[2], m[3], funcNid, funcLine);

      const mBodyEnd = _findMatchingBrace(cleanSource, m.index);
      const mBody = cleanSource.slice(m.index + m[0].length - 1, mBodyEnd);
      functionBodies.push([funcNid, mBody, m.index + m[0].length - 1]);
    }
  }

  // ─── 3. Use Declarations ───────────────────────────────

  const usePattern = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?use\s+([^;]+);/gm;
  while ((m = usePattern.exec(cleanSource)) !== null) {
    const raw = m[1].trim();
    const line = lineAt(m.index);

    if (raw.includes('{')) {
      const basePrefix = raw.slice(0, raw.indexOf('{')).replace(/::$/, '').trim();
      const moduleName = basePrefix.split('::').pop()!.trim();
      if (moduleName) {
        const tgtNid = _makeId(moduleName);
        addEdge(fileNid, tgtNid, 'imports_from', line, 'EXTRACTED', 1.0, 'import');
      }
    } else {
      const clean = raw.split(' as ')[0].trim().replace(/::\*$/, '').replace(/::$/, '');
      const moduleName = clean.split('::').pop()!.trim();
      if (moduleName) {
        const tgtNid = _makeId(moduleName);
        addEdge(fileNid, tgtNid, 'imports_from', line, 'EXTRACTED', 1.0, 'import');
      }
    }
  }

  // ─── 4. Walk Function Calls ────────────────────────────

  const labelToNid: Record<string, string> = {};
  for (const n of nodes) {
    const raw = n.label;
    const normalised = raw.replace(/\(\)$/, '').replace(/^\./, '');
    labelToNid[normalised] = n.id;
  }

  const seenCallPairs = new Set<string>();

  for (const [callerNid, bodyCode, bodyOffset] of functionBodies) {
    // Match direct function calls: foo(...) or method calls: obj.foo(...) or scoped calls: Type::foo(...)
    const callPattern = /([A-Za-z_]\w*)(?:::([A-Za-z_]\w*))?\s*\(|\.([A-Za-z_]\w*)\s*\(/g;
    let cm: RegExpExecArray | null;

    while ((cm = callPattern.exec(bodyCode)) !== null) {
      const isMemberCall = Boolean(cm[3]);
      const isScopedCall = Boolean(cm[2]);
      const calleeName = cm[3] || cm[2] || cm[1];

      if (!calleeName || RUST_KEYWORDS.has(calleeName)) continue;

      const callLine = lineAt(bodyOffset + cm.index);
      const tgtNid = labelToNid[calleeName];

      if (tgtNid && tgtNid !== callerNid) {
        const pairKey = `${callerNid}->${tgtNid}`;
        if (!seenCallPairs.has(pairKey)) {
          seenCallPairs.add(pairKey);
          edges.push({
            source: callerNid,
            target: tgtNid,
            relation: 'calls',
            confidence: 'EXTRACTED',
            source_file: strPath,
            source_location: `L${callLine}`,
            weight: 1.0,
            context: 'call',
          });
        }
      } else if (!isScopedCall && !RUST_TRAIT_METHOD_BLOCKLIST.has(calleeName.toLowerCase())) {
        rawCalls.push({
          caller_nid: callerNid,
          callee: calleeName,
          is_member_call: isMemberCall,
          source_file: strPath,
          source_location: `L${callLine}`,
        });
      }
    }
  }

  const validIds = seenIds;
  const cleanEdges = edges.filter(
    e => validIds.has(e.source) && (validIds.has(e.target) || e.relation === 'imports_from' || e.relation === 'imports')
  );

  return { nodes, edges: cleanEdges, raw_calls: rawCalls };
}
