import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { getChangedEntities } from '../stages/gitdiff';

// Register language parsers to populate the registry
import '../languages/javascript';
import '../languages/python';
import '../languages/go';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('Stage 5 — Git Diff Integration', () => {
  const mockExecSync = execSync as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs git diff HEAD for uncommitted mode', () => {
    mockExecSync.mockReturnValue('');
    getChangedEntities({ projectDir: '/dummy/dir', mode: 'uncommitted' });
    expect(mockExecSync).toHaveBeenCalledWith('git diff HEAD', expect.any(Object));
  });

  it('runs git diff HEAD~1 HEAD for last-commit mode without specific commit', () => {
    mockExecSync.mockReturnValue('');
    getChangedEntities({ projectDir: '/dummy/dir', mode: 'last-commit' });
    expect(mockExecSync).toHaveBeenCalledWith('git diff HEAD~1 HEAD', expect.any(Object));
  });

  it('runs git diff sha~1 sha for last-commit mode with specific commit', () => {
    mockExecSync.mockReturnValue('');
    getChangedEntities({ projectDir: '/dummy/dir', mode: 'last-commit', commit: 'abc1234' });
    expect(mockExecSync).toHaveBeenCalledWith('git diff abc1234~1 abc1234', expect.any(Object));
  });

  it('runs git diff from...to for branches mode', () => {
    mockExecSync.mockReturnValue('');
    getChangedEntities({ projectDir: '/dummy/dir', mode: 'branches', from: 'main', to: 'feature' });
    expect(mockExecSync).toHaveBeenCalledWith('git diff main...feature', expect.any(Object));
  });

  it('returns empty array if from or to is missing in branches mode', () => {
    mockExecSync.mockReturnValue('');
    const result1 = getChangedEntities({ projectDir: '/dummy/dir', mode: 'branches', from: 'main' });
    const result2 = getChangedEntities({ projectDir: '/dummy/dir', mode: 'branches', to: 'feature' });
    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('returns empty array if execSync throws an error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Git command failed');
    });
    const result = getChangedEntities({ projectDir: '/dummy/dir', mode: 'uncommitted' });
    expect(result).toEqual([]);
  });

  it('correctly parses JS/TS, Python, Go, and Java diff hunks', () => {
    const diffOutput = `
diff --git a/src/utils/math.ts b/src/utils/math.ts
index 1234567..89abcde 100644
--- a/src/utils/math.ts
+++ b/src/utils/math.ts
@@ -10,6 +10,12 @@ export function add(a: number, b: number): number {
+  console.log("adding numbers");
+  return a + b;
 }
diff --git a/src/main.py b/src/main.py
index aaaaaaa..bbbbbbb 100644
--- a/src/main.py
+++ b/src/main.py
@@ -5,4 +5,8 @@ def process_data(data):
-    pass
+    # process items
+    for item in data:
+        print(item)
+    return len(data)
diff --git a/src/api.go b/src/api.go
index ccccccc..ddddddd 100644
--- a/src/api.go
+++ b/src/api.go
@@ -12,4 +12,4 @@ func (s *Server) Start() error {
-	return nil
+	return s.ListenAndServe()
 }
diff --git a/src/App.java b/src/App.java
index eeeeeee..fffffff 100644
--- a/src/App.java
+++ b/src/App.java
@@ -15,4 +15,4 @@     public static void execute() {
-        System.out.println("old");
+        System.out.println("new");
 }
`;
    mockExecSync.mockReturnValue(diffOutput);
    const result = getChangedEntities({ projectDir: '/dummy/dir', mode: 'uncommitted' });

    expect(result).toHaveLength(4);

    // 1. JavaScript test
    expect(result).toContainEqual({
      name: 'add',
      file: 'src/utils/math.ts',
      changeType: 'modified',
      description: 'add: 2 line(s) added',
    });

    // 2. Python test
    expect(result).toContainEqual({
      name: 'process_data',
      file: 'src/main.py',
      changeType: 'modified',
      description: 'process_data: 1 line(s) changed to 4 new line(s)',
    });

    // 3. Go test
    expect(result).toContainEqual({
      name: 'Start',
      file: 'src/api.go',
      changeType: 'modified',
      description: 'Start: 1 line(s) changed to 1 new line(s)',
    });

    // 4. Java fallback test
    expect(result).toContainEqual({
      name: 'execute',
      file: 'src/App.java',
      changeType: 'modified',
      description: 'execute: 1 line(s) changed to 1 new line(s)',
    });
  });

  it('handles added and deleted file modes', () => {
    const diffOutput = `
diff --git a/src/newfile.ts b/src/newfile.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/newfile.ts
@@ -1,5 +1,5 @@ export function newFunc() {
+export function newFunc() {
+  return 42;
+}
diff --git a/src/deletedfile.py b/src/deletedfile.py
deleted file mode 100644
index 7654321..0000000
--- a/src/deletedfile.py
+++ /dev/null
@@ -1,5 +1,5 @@ def old_func():
-def old_func():
-    pass
`;
    mockExecSync.mockReturnValue(diffOutput);
    const result = getChangedEntities({ projectDir: '/dummy/dir', mode: 'uncommitted' });

    expect(result).toContainEqual({
      name: 'newFunc',
      file: 'src/newfile.ts',
      changeType: 'added',
      description: 'newFunc: 3 line(s) added',
    });

    expect(result).toContainEqual({
      name: 'old_func',
      file: 'src/deletedfile.py',
      changeType: 'deleted',
      description: 'old_func: 2 line(s) removed',
    });
  });

  it('ignores Express-route and other API type patterns in JS/TS', () => {
    const diffOutput = `
diff --git a/src/routes.ts b/src/routes.ts
index 1234567..89abcde 100644
--- a/src/routes.ts
+++ b/src/routes.ts
@@ -10,6 +10,12 @@ router.get('/users', (req, res) => {
+  console.log("api access");
+  res.send([]);
 });
`;
    mockExecSync.mockReturnValue(diffOutput);
    const result = getChangedEntities({ projectDir: '/dummy/dir', mode: 'uncommitted' });
    expect(result).toEqual([]);
  });

  it('avoids duplicating the same entity in multiple hunks of the same file', () => {
    const diffOutput = `
diff --git a/src/utils/math.ts b/src/utils/math.ts
index 1234567..89abcde 100644
--- a/src/utils/math.ts
+++ b/src/utils/math.ts
@@ -10,3 +10,4 @@ export function add(a: number, b: number): number {
+  console.log("first touch");
@@ -20,3 +21,4 @@ export function add(a: number, b: number): number {
+  console.log("second touch");
`;
    mockExecSync.mockReturnValue(diffOutput);
    const result = getChangedEntities({ projectDir: '/dummy/dir', mode: 'uncommitted' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('add');
  });
});
