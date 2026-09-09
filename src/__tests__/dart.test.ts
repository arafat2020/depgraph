import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/dart';
import { extractDart, cleanDartComments, estimateComplexity } from '../languages/dart';
import { parseFile } from '../stages/parser';
import { buildGraph } from '../stages/graph';

describe('Dart Parser & Extractor', () => {
  const tempDir = path.join(__dirname, 'temp_dart');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function write(name: string, content: string): string {
    const file = path.join(tempDir, name);
    fs.writeFileSync(file, content);
    return file;
  }

  // ─── comment cleaning ───────────────────────────────────

  it('cleans single-line and multi-line comments while preserving strings and line counts', () => {
    const code = `// Header comment
/* Multi-line
   comment */
String url = "https://example.com//not-a-comment";
String block = """/* still a string */""";
int counter = 0; // trailing comment`;

    const cleaned = cleanDartComments(code);
    expect(cleaned).toContain('"https://example.com//not-a-comment"');
    expect(cleaned).toContain('"""/* still a string */"""');
    expect(cleaned).not.toContain('// Header comment');
    expect(cleaned).not.toContain('// trailing comment');
    // Line count must match original code exactly
    expect(cleaned.split('\n').length).toBe(code.split('\n').length);
  });

  // ─── entity extraction (LanguageParser) ─────────────────

  it('extracts classes, mixins, enums, and extension types', () => {
    const f = write('types.dart', `
abstract class BaseRepository<T> {}

sealed class AuthState {}

base class ServiceBase {}

interface class GreeterContract {}

final class ImmutableConfig {}

mixin LoggerMixin {}

enum UserRole { admin, user, guest }

extension type UserId(int id) {}
`);

    const parsed = parseFile(f);
    expect(parsed?.lang).toBe('dart');
    const names = parsed?.entities.map(e => e.name);
    expect(names).toContain('BaseRepository');
    expect(names).toContain('AuthState');
    expect(names).toContain('ServiceBase');
    expect(names).toContain('GreeterContract');
    expect(names).toContain('ImmutableConfig');
    expect(names).toContain('LoggerMixin');
    expect(names).toContain('UserRole');
    expect(names).toContain('UserId');
  });

  it('extracts extensions (named and anonymous)', () => {
    const f = write('extensions.dart', `
extension StringValidation on String {
  bool get isValidEmail => contains('@');
}

extension on int {
  int doubleValue() => this * 2;
}
`);

    const parsed = parseFile(f);
    const names = parsed?.entities.map(e => e.name);
    expect(names).toContain('StringValidation');
    expect(names).toContain('extensions_anonymous_extension');
  });

  it('extracts typedefs', () => {
    const f = write('typedefs.dart', `
typedef JsonMap = Map<String, dynamic>;
typedef IntPredicate<T> = bool Function(T item);
`);

    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'JsonMap', type: 'type' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'IntPredicate', type: 'type' }));
  });

  it('extracts functions, methods, async functions, getters, and setters', () => {
    const f = write('functions.dart', `
void topLevelFunction() {
  print('hello');
}

Future<String> fetchUserData(String userId) async {
  return "user_$userId";
}

class Calculator {
  int add(int a, int b) {
    return a + b;
  }

  int get answer => 42;

  set answer(int val) {
    print(val);
  }
}
`);

    const parsed = parseFile(f);
    const funcs = parsed?.entities.filter(e => e.type === 'function').map(e => e.name);
    expect(funcs).toContain('topLevelFunction');
    expect(funcs).toContain('fetchUserData');
    expect(funcs).toContain('add');
    expect(funcs).toContain('answer');
  });

  it('extracts variables and record destructuring', () => {
    const f = write('variables.dart', `
const String appVersion = "1.0.0";
final ApiClient client = ApiClient();
late final String dbPath;
var (first, second) = ("a", "b");
`);

    const parsed = parseFile(f);
    const vars = parsed?.entities.filter(e => e.type === 'variable').map(e => e.name);
    expect(vars).toContain('appVersion');
    expect(vars).toContain('client');
    expect(vars).toContain('dbPath');
    expect(vars).toContain('first');
    expect(vars).toContain('second');
  });

  it('estimates cyclomatic complexity for Dart functions', () => {
    const code = `
int complexLogic(int x) {
  if (x > 100) {
    return 1;
  } else if (x > 50) {
    while (x > 60) {
      x--;
      if (x % 2 == 0 && x != 70) {
        return 2;
      }
    }
  } else {
    switch (x) {
      case 1: return 10;
      case 2: return 20;
      default: return 0;
    }
  }
  return 0;
}
`;
    const complexity = estimateComplexity(code, 'complexLogic');
    expect(['medium', 'high']).toContain(complexity);
  });

  // ─── imports & exports ──────────────────────────────────

  it('extracts package, sdk, and local relative imports with aliases and show clauses', () => {
    const f = write('imports.dart', `
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import './user_service.dart' show UserService, UserDto;
import '../common/utils.dart' hide debugPrint;
`);

    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'dart:async',
      isLocal: false,
    }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'package:flutter/material.dart',
      names: ['material'],
      isLocal: false,
    }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'package:provider/provider.dart',
      names: ['provider'],
      isLocal: false,
    }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: './user_service.dart',
      names: ['UserService', 'UserDto'],
      isLocal: true,
    }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: '../common/utils.dart',
      isLocal: true,
    }));
  });

  it('extracts public exports and re-exports while ignoring private _ prefixed declarations', () => {
    const f = write('exports.dart', `
export 'src/models.dart' show OrderModel;
export 'src/utils.dart';

class PublicClass {}
class _PrivateClass {}

void publicFunc() {}
void _privateFunc() {}

const String publicConst = "abc";
const String _privateConst = "xyz";
`);

    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('OrderModel');
    expect(parsed?.exports).toContain('utils');
    expect(parsed?.exports).toContain('PublicClass');
    expect(parsed?.exports).toContain('publicFunc');
    expect(parsed?.exports).toContain('publicConst');

    expect(parsed?.exports).not.toContain('_PrivateClass');
    expect(parsed?.exports).not.toContain('_privateFunc');
    expect(parsed?.exports).not.toContain('_privateConst');
  });

  // ─── Graphify extractDart comprehensive verification ────

  it('extractDart extracts inheritance, mixins, interfaces, and generic type parameters', () => {
    const f = write('bloc.dart', `
class AuthBloc extends Bloc<AuthEvent, AuthState> with DisposableMixin implements Initializable {
}
`);

    const result = extractDart(f);
    const authBlocId = result.nodes.find(n => n.label === 'AuthBloc')?.id;
    expect(authBlocId).toBeDefined();

    // inherits Bloc
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: authBlocId,
      relation: 'inherits',
    }));

    // generic arguments referenced: AuthEvent, AuthState
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: authBlocId,
      relation: 'references',
      target: expect.stringContaining('AuthEvent'),
    }));
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: authBlocId,
      relation: 'references',
      target: expect.stringContaining('AuthState'),
    }));

    // mixins and interfaces
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: authBlocId,
      relation: 'mixes_in',
      target: expect.stringContaining('DisposableMixin'),
    }));
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: authBlocId,
      relation: 'implements',
      target: expect.stringContaining('Initializable'),
    }));
  });

  it('extractDart extracts Bloc events, state emissions, and event additions', () => {
    const f = write('auth_bloc.dart', `
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(AuthInitial()) {
    on<LoginRequested>((event, emit) {
      emit(AuthLoading());
      emit(AuthSuccess());
    });
  }

  void dispatchLogout() {
    add(LogoutRequested());
  }
}
`);

    const result = extractDart(f);
    // on<LoginRequested>
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'calls',
      context: 'bloc_event',
      target: expect.stringContaining('LoginRequested'),
    }));

    // emit(AuthLoading), emit(AuthSuccess)
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'calls',
      context: 'emit_state',
      target: expect.stringContaining('AuthLoading'),
    }));
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'calls',
      context: 'emit_state',
      target: expect.stringContaining('AuthSuccess'),
    }));

    // add(LogoutRequested())
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'calls',
      context: 'bloc_add_event',
      target: expect.stringContaining('LogoutRequested'),
    }));
  });

  it('extractDart extracts Riverpod annotations, provider generation, and ref.watch references', () => {
    const f = write('riverpod_feature.dart', `
@riverpod
class CounterNotifier extends _$CounterNotifier {
  @override
  int build() => 0;
}

@riverpod
Future<String> fetchUserGreeting() async {
  return "hello";
}

class DashboardWidget {
  void build(WidgetRef ref) {
    final count = ref.watch(counterNotifierProvider);
    final user = ref.read(userProvider);
  }
}
`);

    const result = extractDart(f);

    // Generated providers
    const providerNodes = result.nodes.filter(n => n.label.endsWith('Provider'));
    expect(providerNodes.some(n => n.label === 'counterNotifierProvider')).toBe(true);
    expect(providerNodes.some(n => n.label === 'fetchUserGreetingProvider')).toBe(true);

    // ref.watch(counterNotifierProvider) and ref.read(userProvider)
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'references',
      context: 'riverpod_reference',
      target: expect.stringContaining('counterNotifierProvider'),
    }));
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'references',
      context: 'riverpod_reference',
      target: expect.stringContaining('userProvider'),
    }));
  });

  it('extractDart extracts universal navigation patterns and type lookups', () => {
    const f = write('nav.dart', `
class NavigationHelper {
  void navigate(BuildContext context) {
    context.go('/profile');
    context.pushNamed('settings');
    Navigator.push(context, UserDetailScreen());
    getIt<AuthService>().login();
  }
}
`);

    const result = extractDart(f);

    // Route path
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'navigates',
      context: 'route_path',
      target: expect.stringContaining('profile'),
    }));

    // Route object
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'navigates',
      context: 'route_object',
      target: expect.stringContaining('UserDetailScreen'),
    }));

    // Universal type lookup getIt<AuthService>()
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'references',
      context: 'type_lookup',
      target: expect.stringContaining('AuthService'),
    }));
  });

  it('extractDart handles part of file redirection to parent', () => {
    const parentFile = write('parent.dart', `
part 'child.dart';
class ParentClass {}
`);

    const childFile = write('child.dart', `
part of 'parent.dart';

class ChildClass {}
`);

    const result = extractDart(childFile);
    // Root node ID should be redirected to parent.dart stem / id
    const childClassNode = result.nodes.find(n => n.label === 'ChildClass');
    expect(childClassNode).toBeDefined();
    expect(childClassNode?.id).toContain('parent__ChildClass');
  });

  // ─── graph building integration ─────────────────────────

  it('integrates with buildGraph to link Dart dependencies across files', () => {
    const serviceFile = write('user_service.dart', `
class UserService {
  String getUsername() => "Alice";
}
`);

    const controllerFile = write('user_controller.dart', `
import './user_service.dart' show UserService;

class UserController {
  final UserService userService = UserService();
}
`);

    const parsed1 = parseFile(serviceFile)!;
    const parsed2 = parseFile(controllerFile)!;
    expect(parsed1).not.toBeNull();
    expect(parsed2).not.toBeNull();

    const graph = buildGraph([parsed1, parsed2]);
    const userServiceNode = Array.from(graph.nodes.values()).find(n => n.name === 'UserService');
    const userControllerNode = Array.from(graph.nodes.values()).find(n => n.name === 'UserController');

    expect(userServiceNode).toBeDefined();
    expect(userControllerNode).toBeDefined();

    const edge = graph.edges.find(e => e.from === userControllerNode?.id && e.to === userServiceNode?.id);
    expect(edge).toBeDefined();
    expect(edge?.type).toBe('imports');
  });

  it('extractDart supports raw code string and handles unreadable file', () => {
    const rawCode = `
class StandaloneService {
  void doWork() {}
}
`;
    const res = extractDart(rawCode);
    expect(res.nodes.some(n => n.label === 'StandaloneService')).toBe(true);

    const errRes = extractDart('/non/existent/path.dart');
    expect(errRes.error).toBeDefined();
  });
});

