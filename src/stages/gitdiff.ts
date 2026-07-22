import { execSync } from 'child_process';
import path from 'path';
import { getLanguageParser } from '../languages/registry';

// ─── types ───────────────────────────────────────────────

export interface ChangedEntity {
  name:        string;
  file:        string;
  changeType:  'modified' | 'added' | 'deleted';
  description: string;
}

export interface GitDiffOptions {
  projectDir: string;
  mode:       'uncommitted' | 'last-commit' | 'branches';
  commit?:    string;
  from?:      string;
  to?:        string;
}

// ─── main function ───────────────────────────────────────

/**
 * Runs a git diff and returns all changed entities (functions, classes, etc.)
 * detected in the diff output.
 *
 * Entity name detection reuses the regex patterns already defined in the
 * language registry (javascript.ts, python.ts, go.ts …) via the
 * `entityPatterns` field — no regex is duplicated here.
 *
 * @param options  Git diff configuration (projectDir, mode, optional refs).
 * @returns        Array of changed entities with name, file, changeType, and description.
 */
export function getChangedEntities(options: GitDiffOptions): ChangedEntity[] {
  const diff = runGitDiff(options);
  if (!diff) return [];
  return parseDiff(diff, options.projectDir);
}

// ─── step 1: run the right git command ───────────────────

function runGitDiff(options: GitDiffOptions): string | null {
  const { projectDir, mode, commit, from, to } = options;

  let command: string;

  if (mode === 'uncommitted') {
    // changes not yet committed (staged + unstaged)
    command = 'git diff HEAD';
  } else if (mode === 'last-commit') {
    if (commit) {
      // specific commit vs its parent
      command = `git diff ${commit}~1 ${commit}`;
    } else {
      // last commit vs the one before it
      command = 'git diff HEAD~1 HEAD';
    }
  } else if (mode === 'branches') {
    if (!from || !to) {
      console.warn('⚠ --from and --to are required for branch comparison');
      return null;
    }
    command = `git diff ${from}...${to}`;
  } else {
    return null;
  }

  try {
    const result = execSync(command, {
      cwd:      projectDir,
      encoding: 'utf-8',
      stdio:    ['pipe', 'pipe', 'pipe'],
    });
    return result || null;
  } catch (err) {
    console.warn(`⚠ Git command failed: ${command}`);
    console.warn(`  Make sure ${projectDir} is a git repository`);
    return null;
  }
}

// ─── step 2: parse the diff output ───────────────────────

function parseDiff(diff: string, projectDir: string): ChangedEntity[] {
  const entities: ChangedEntity[] = [];
  const lines = diff.split('\n');

  let currentFile = '';
  let changeType: ChangedEntity['changeType'] = 'modified';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── detect file being changed ──
    // diff --git a/src/services/userService.ts b/src/services/userService.ts
    if (line.startsWith('diff --git')) {
      const fileMatch = line.match(/b\/(.+)$/);
      if (fileMatch) {
        currentFile = fileMatch[1];
      }
      changeType = 'modified'; // reset for new file section
      continue;
    }

    // detect if file was added or deleted
    if (line.startsWith('new file mode')) {
      changeType = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      changeType = 'deleted';
      continue;
    }
    if (line.startsWith('index ')) {
      // reset to modified unless already set to added/deleted above
      if (changeType === 'modified') changeType = 'modified';
      continue;
    }

    // ── detect changed function/class from @@ context line ──
    // @@ -22,7 +22,6 @@ export function getUserById(id: string) {
    if (line.startsWith('@@')) {
      const contextMatch = line.match(/@@[^@]*@@\s*(.+)$/);
      if (contextMatch) {
        const context = contextMatch[1].trim();
        const entity  = extractEntityFromContext(context, currentFile);
        if (entity) {
          const description = buildDescription(lines, i, entity.name);

          // skip duplicates (same entity in multiple hunks of the same file)
          const alreadyFound = entities.some(
            e => e.name === entity.name && e.file === currentFile
          );
          if (!alreadyFound) {
            entities.push({
              name:        entity.name,
              file:        currentFile,
              changeType,
              description,
            });
          }
        }
      }
      continue;
    }
  }

  return entities;
}

// ─── step 3: extract entity name from context line ───────

/**
 * Tries to extract an entity name from a git diff @@ context line.
 *
 * Instead of duplicating language-specific regex patterns, this function
 * looks up the registered language parser for the file extension and
 * runs its `entityPatterns` against the context string.
 * If no registered parser is found for the extension, a built-in fallback
 * handles the most common Java/C# method signatures.
 *
 * @param context  The text after the @@ marker (e.g. "export function foo(…)").
 * @param file     The relative file path (used to determine extension).
 * @returns        An object with the entity name and type, or null.
 */
function extractEntityFromContext(
  context: string,
  file: string
): { name: string; type: string } | null {
  const ext    = path.extname(file).toLowerCase();
  const parser = getLanguageParser(ext);

  if (parser?.entityPatterns) {
    for (const { regex, type } of parser.entityPatterns) {
      // Skip the Express-route pattern — its group 1 is the HTTP method
      // (get/post/…), not an entity name meaningful for impact analysis.
      if (type === 'api') continue;

      // Clone the regex without the /g flag for single-line context matching
      // (the patterns have /gm which keeps lastIndex state between calls).
      const singleLineRegex = new RegExp(regex.source, regex.flags.replace('g', ''));
      const m = singleLineRegex.exec(context);
      if (m?.[1]) return { name: m[1], type };
    }
    return null;
  }

  // ── fallback: Java / C# method signatures ────────────────────────────────
  // These languages don't have a parser registered yet but their diff context
  // lines follow a predictable pattern: visibility modifier + return type + name(
  if (['.java', '.cs'].includes(ext)) {
    const m = context.match(
      /(?:public|private|protected|static|override|async|virtual)\s+\S+\s+(\w+)\s*\(/
    );
    if (m) return { name: m[1], type: 'method' };
  }

  return null;
}

// ─── step 4: build a human description of the change ─────

function buildDescription(
  lines:      string[],
  contextIdx: number,
  entityName: string
): string {
  const added:   string[] = [];
  const removed: string[] = [];

  // look at the next 20 lines after the @@ marker
  for (let i = contextIdx + 1; i < Math.min(contextIdx + 20, lines.length); i++) {
    const line = lines[i];

    // stop at next @@ or next file
    if (line.startsWith('@@') || line.startsWith('diff')) break;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      added.push(line.slice(1).trim());
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      removed.push(line.slice(1).trim());
    }
  }

  // build a plain english description
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
