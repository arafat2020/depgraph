import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/rust';
import { extractRust, cleanRustComments, estimateComplexity } from '../languages/rust';
import { parseFile } from '../stages/parser';
import { buildGraph } from '../stages/graph';

describe('Rust Parser & Extractor', () => {
  const tempDir = path.join(__dirname, 'temp_rust');

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
    const code = `// Top comment
/* Multi-line
   comment */
let s = "http://example.com//not-a-comment";
let raw = r#"/* not a comment */"#;
let count = 42; // trailing comment`;

    const cleaned = cleanRustComments(code);
    expect(cleaned).toContain('"http://example.com//not-a-comment"');
    expect(cleaned).toContain('r#"/* not a comment */"#');
    expect(cleaned).not.toContain('// Top comment');
    expect(cleaned).not.toContain('// trailing comment');
    expect(cleaned.split('\n').length).toBe(code.split('\n').length);
  });

  // ─── entity extraction (LanguageParser) ─────────────────

  it('extracts structs, enums, traits, and type aliases', () => {
    const f = write('types.rs', `
pub struct User {
    pub id: u64,
    pub name: String,
}

pub enum Status {
    Active,
    Inactive,
}

pub trait Repository {
    fn find_by_id(&self, id: u64) -> Option<User>;
}

pub type UserId = u64;
`);

    const parsed = parseFile(f);
    expect(parsed?.lang).toBe('rust');
    const names = parsed?.entities.map(e => e.name);
    expect(names).toContain('User');
    expect(names).toContain('Status');
    expect(names).toContain('Repository');
    expect(names).toContain('UserId');
  });

  it('extracts free functions and impl methods', () => {
    const f = write('functions.rs', `
pub async fn calculate_total(items: &[Item]) -> f64 {
    items.iter().map(|i| i.price).sum()
}

impl OrderService {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn process_order(&self, order: Order) -> Result<(), Error> {
        Ok(())
    }
}
`);

    const parsed = parseFile(f);
    const funcEntities = parsed?.entities.filter(e => e.type === 'function').map(e => e.name);
    expect(funcEntities).toContain('calculate_total');
    expect(funcEntities).toContain('new');
    expect(funcEntities).toContain('process_order');
  });

  it('estimates cyclomatic complexity for Rust functions', () => {
    const code = `
fn evaluate(score: i32) -> &'static str {
    if score > 100 {
        "exceptional"
    } else if score > 80 {
        match score {
            90..=100 => "A+",
            _ => "A",
        }
    } else if score > 50 {
        while score > 60 {
            if score % 2 == 0 && score != 70 {
                return "good";
            }
        }
        "average"
    } else {
        "poor"
    }
}
`;
    const complexity = estimateComplexity(code, 'evaluate');
    expect(['medium', 'high']).toContain(complexity);
  });

  // ─── imports & exports ──────────────────────────────────

  it('extracts use statements, resolving local vs external crates and multiple imported symbols', () => {
    const f = write('imports.rs', `
use std::collections::HashMap;
use std::sync::Arc;
use crate::models::{User, Account};
use crate::services::auth_service as auth;
use super::helper::format_name;
`);

    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'std::collections::HashMap',
      names: ['HashMap'],
      isLocal: false,
    }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'crate::models',
      names: ['User', 'Account'],
      isLocal: true,
    }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'crate::services::auth_service',
      names: ['auth'],
      isLocal: true,
    }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({
      source: 'super::helper::format_name',
      names: ['format_name'],
      isLocal: true,
    }));
  });

  it('extracts public items and re-exports', () => {
    const f = write('exports.rs', `
pub struct PublicStruct;
struct PrivateStruct;

pub enum PublicEnum { A, B }
enum PrivateEnum { C }

pub trait PublicTrait {}

pub fn public_function() {}
fn private_function() {}

pub const MAX_LIMIT: usize = 100;
pub static APP_NAME: &str = "DepGraph";

pub use crate::internal::{ExportedOne, ExportedTwo};
pub use std::path::PathBuf;
`);

    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('PublicStruct');
    expect(parsed?.exports).toContain('PublicEnum');
    expect(parsed?.exports).toContain('PublicTrait');
    expect(parsed?.exports).toContain('public_function');
    expect(parsed?.exports).toContain('MAX_LIMIT');
    expect(parsed?.exports).toContain('APP_NAME');
    expect(parsed?.exports).toContain('ExportedOne');
    expect(parsed?.exports).toContain('ExportedTwo');
    expect(parsed?.exports).toContain('PathBuf');

    expect(parsed?.exports).not.toContain('PrivateStruct');
    expect(parsed?.exports).not.toContain('PrivateEnum');
    expect(parsed?.exports).not.toContain('private_function');
  });

  // ─── Graphify extractRust comprehensive verification ────

  it('extractRust extracts structs with named fields, tuple structs, and type references', () => {
    const f = write('structs.rs', `
struct UserProfile {
    user: User,
    metadata: HashMap<String, Config>,
}

struct Wrapper(pub Logger, Config);
`);

    const result = extractRust(f);
    const profileNode = result.nodes.find(n => n.label === 'UserProfile');
    const wrapperNode = result.nodes.find(n => n.label === 'Wrapper');

    expect(profileNode).toBeDefined();
    expect(wrapperNode).toBeDefined();

    // UserProfile -> User (field)
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: profileNode?.id,
      relation: 'references',
      target: expect.stringContaining('User'),
      context: 'field',
    }));

    // UserProfile -> Config (generic_arg of HashMap)
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: profileNode?.id,
      relation: 'references',
      target: expect.stringContaining('Config'),
      context: 'generic_arg',
    }));

    // Wrapper -> Logger (field)
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: wrapperNode?.id,
      relation: 'references',
      target: expect.stringContaining('Logger'),
      context: 'field',
    }));
  });

  it('extractRust extracts enums with tuple and struct variant payloads', () => {
    const f = write('enums.rs', `
enum Event {
    Click(Logger),
    Resize { size: Dimension },
}
`);

    const result = extractRust(f);
    const eventNode = result.nodes.find(n => n.label === 'Event');
    expect(eventNode).toBeDefined();

    expect(result.edges).toContainEqual(expect.objectContaining({
      source: eventNode?.id,
      relation: 'references',
      target: expect.stringContaining('Logger'),
      context: 'field',
    }));

    expect(result.edges).toContainEqual(expect.objectContaining({
      source: eventNode?.id,
      relation: 'references',
      target: expect.stringContaining('Dimension'),
      context: 'field',
    }));
  });

  it('extractRust extracts traits with bounds, methods, and impl blocks', () => {
    const f = write('traits.rs', `
trait Printable: BaseDisplay + Debug {
    fn print(&self) -> String;
}

impl Printable for Order {
    fn print(&self) -> String {
        self.format()
    }
}
`);

    const result = extractRust(f);
    const traitNode = result.nodes.find(n => n.label === 'Printable');
    const orderNode = result.nodes.find(n => n.label === 'Order');

    expect(traitNode).toBeDefined();
    expect(orderNode).toBeDefined();

    // Printable inherits BaseDisplay
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: traitNode?.id,
      relation: 'inherits',
      target: expect.stringContaining('BaseDisplay'),
    }));

    // Printable references Debug (generic_arg)
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: traitNode?.id,
      relation: 'references',
      target: expect.stringContaining('Debug'),
      context: 'generic_arg',
    }));

    // Order implements Printable
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: orderNode?.id,
      relation: 'implements',
      target: expect.stringContaining('Printable'),
    }));

    // Trait method .print()
    const methodNode = result.nodes.find(n => n.label === '.print()');
    expect(methodNode).toBeDefined();
  });

  it('extractRust extracts parameter and return type references', () => {
    const f = write('service.rs', `
fn fetch_user(id: UserId, client: &HttpClient) -> Result<User, ApiError> {
    client.get(id)
}
`);

    const result = extractRust(f);
    const funcNode = result.nodes.find(n => n.label === 'fetch_user()');
    expect(funcNode).toBeDefined();

    // Parameter type: UserId, HttpClient
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: funcNode?.id,
      relation: 'references',
      target: expect.stringContaining('UserId'),
      context: 'parameter_type',
    }));
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: funcNode?.id,
      relation: 'references',
      target: expect.stringContaining('HttpClient'),
      context: 'parameter_type',
    }));

    // Return type generic args: User, ApiError
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: funcNode?.id,
      relation: 'references',
      target: expect.stringContaining('User'),
      context: 'generic_arg',
    }));
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: funcNode?.id,
      relation: 'references',
      target: expect.stringContaining('ApiError'),
      context: 'generic_arg',
    }));
  });

  it('extractRust walks function calls, creating calls edges and collecting raw_calls', () => {
    const f = write('calls.rs', `
fn helper() {}

fn main() {
    helper();
    external_service();
    let x = value.clone(); // blocklisted: should not be in raw_calls
}
`);

    const result = extractRust(f);
    const mainNode = result.nodes.find(n => n.label === 'main()');
    const helperNode = result.nodes.find(n => n.label === 'helper()');

    expect(mainNode).toBeDefined();
    expect(helperNode).toBeDefined();

    // In-file call main -> helper
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: mainNode?.id,
      target: helperNode?.id,
      relation: 'calls',
      context: 'call',
    }));

    // external_service should be in raw_calls
    expect(result.raw_calls).toContainEqual(expect.objectContaining({
      caller_nid: mainNode?.id,
      callee: 'external_service',
    }));

    // clone is blocklisted so it should NOT be in raw_calls
    expect(result.raw_calls.some(c => c.callee === 'clone')).toBe(false);
  });

  it('extractRust extracts use declarations as imports_from', () => {
    const f = write('use_decl.rs', `
use std::sync::Mutex;
use crate::config::{AppConfig, DatabaseConfig};
`);

    const result = extractRust(f);
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'imports_from',
      target: expect.stringContaining('Mutex'),
      context: 'import',
    }));
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: 'imports_from',
      target: expect.stringContaining('config'),
      context: 'import',
    }));
  });

  it('extractRust supports raw code strings and handles unreadable files', () => {
    const raw = `
struct Item;
fn run(i: Item) {}
`;
    const res = extractRust(raw);
    expect(res.nodes.some(n => n.label === 'Item')).toBe(true);
    expect(res.nodes.some(n => n.label === 'run()')).toBe(true);

    const errRes = extractRust('/non/existent/file.rs');
    expect(errRes.error).toBeDefined();
  });

  // ─── graph building integration ─────────────────────────

  it('integrates with buildGraph to link Rust dependencies across files', () => {
    const modelFile = write('models.rs', `
pub struct UserModel {
    pub name: String,
}
`);

    const controllerFile = write('controller.rs', `
use crate::models::UserModel;

pub struct Controller {
    pub model: UserModel,
}
`);

    const parsed1 = parseFile(modelFile)!;
    const parsed2 = parseFile(controllerFile)!;
    expect(parsed1).not.toBeNull();
    expect(parsed2).not.toBeNull();

    const graph = buildGraph([parsed1, parsed2]);
    const userModelNode = Array.from(graph.nodes.values()).find(n => n.name === 'UserModel');
    const controllerNode = Array.from(graph.nodes.values()).find(n => n.name === 'Controller');

    expect(userModelNode).toBeDefined();
    expect(controllerNode).toBeDefined();

    const edge = graph.edges.find(e => e.from === controllerNode?.id && e.to === userModelNode?.id);
    expect(edge).toBeDefined();
    expect(edge?.type).toBe('imports');
  });
});
