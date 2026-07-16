import { RawEntity, RawImport } from '../types';
import { LanguageParser, registerParser } from './registry';
import { COMPLEXITY_THRESHOLDS } from '../constants';

// ─── helpers ────────────────────────────────────────────

/**
 * Estimate the complexity of a function based on the number of branching statements.
 * @param code The code of the function.
 * @param name The name of the function.
 * @returns The complexity level (low, medium, or high).
 */
function estimateComplexity(code: string, name: string): string {
    // find function body by looking for lines after def name:
    const lines = code.split('\n');
    const defLine = lines.findIndex(l => l.match(new RegExp(`def\\s+${name}\\s*\\(`)));
    if (defLine === -1) return 'low';

    // collect indented body lines
    const bodyLines = [];
    for (let i = defLine + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') continue;
        if (!line.match(/^\s+/)) break;  // back to zero indent = end of function
        bodyLines.push(line);
    }

    const body = bodyLines.join('\n');
    const branches = (body.match(/\b(if|elif|else|for|while|except|and|or)\b/g) || []).length;

    if (branches <= COMPLEXITY_THRESHOLDS.low) return 'low';
    if (branches <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
    return 'high';
}

// ─── entity extractor ───────────────────────────────────

function extractEntities(code: string, filePath: string): RawEntity[] {
    const entities: RawEntity[] = [];

    const patterns: Array<{ regex: RegExp; type: string }> = [
        // regular functions
        {
            regex: /^(?:async\s+)?def\s+(\w+)\s*\(/gm,
            type: 'function'
        },
        // classes
        {
            regex: /^class\s+(\w+)(?:\s*\([^)]*\))?\s*:/gm,
            type: 'class'
        },
    ];

    for (const { regex, type } of patterns) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(code)) !== null) {
            const name = match[1];

            // skip private/dunder methods like __init__, __str__
            // unless they are class-level (we still want the class)
            if (type === 'function' && name.startsWith('__') && name.endsWith('__')) continue;

            // skip duplicates
            if (entities.some(e => e.name === name)) continue;

            const upToMatch = code.slice(0, match.index);
            const line = upToMatch.split('\n').length;

            entities.push({
                name,
                type,
                line,
                complexity: type === 'function'
                    ? estimateComplexity(code, name)
                    : 'low',
            });
        }
    }

    return entities;
}

// ─── import extractor ───────────────────────────────────
/**
 * Extract imports from Python code.
 * @param code The Python code.
 * @returns An array of RawImport objects.
 */
function extractImports(code: string): RawImport[] {
    const imports: RawImport[] = [];

    // from .module import name1, name2
    // from ..utils import something
    // from package import thing
    const fromPattern = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = fromPattern.exec(code)) !== null) {
        const source = match[1];
        const names = match[2]
            .split(',')
            .map(n => n.trim())
            .filter(n => n.length > 0);

        // relative imports start with . or ..
        const isLocal = source.startsWith('.');

        imports.push({ source, names, isLocal });
    }

    // import os
    // import json
    const importPattern = /^import\s+([\w.]+)/gm;
    while ((match = importPattern.exec(code)) !== null) {
        const source = match[1];
        imports.push({
            source,
            names: [source],
            isLocal: false,   // bare imports are always external
        });
    }

    return imports;
}

// ─── export extractor ───────────────────────────────────

/**
 * Extract exports from Python code.
 * @param code The Python code.
 * @returns An array of exported entity names.
 */
function extractExports(code: string): string[] {
    // Python doesn't have explicit exports
    // __all__ defines the public API when present
    const allMatch = code.match(/__all__\s*=\s*\[([^\]]+)\]/);
    if (!allMatch) return [];

    return allMatch[1]
        .split(',')
        .map(n => n.trim().replace(/['"]/g, ''))
        .filter(n => n.length > 0);
}

// ─── register ───────────────────────────────────────────

/**
 * The Python parser implementation for DepGraph.
 */
const PythonParser: LanguageParser = {
    lang: 'py',
    extensions: ['.py'],
    extractEntities,
    extractImports,
    extractExports,
};

registerParser(PythonParser);