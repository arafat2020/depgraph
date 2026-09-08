import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/ruby';
import { parseFile } from '../stages/parser';

describe('Ruby Parser', () => {
  const tempDir = path.join(__dirname, 'temp_ruby');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function write(name: string, content: string) {
    const file = path.join(tempDir, name);
    fs.writeFileSync(file, content);
    return file;
  }

  // ─── entities ───────────────────────────────────────────

  it('extracts classes with and without superclass', () => {
    const f = write('types.rb', `
class User
end

class AdminUser < User
end
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'User', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'AdminUser', type: 'class' }));
  });

  it('extracts modules', () => {
    const f = write('helpers.rb', `
module Greetable
  def greet
    "Hello"
  end
end

module Services
  module Auth
  end
end
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Greetable', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Services', type: 'class' }));
  });

  it('extracts instance methods', () => {
    const f = write('user.rb', `
class User
  def full_name
    "#{first_name} #{last_name}"
  end

  def save!
    # bang method
  end

  def valid?
    true
  end
end
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'full_name', type: 'function' }));
    // Bang and predicate suffixes are sanitised to safe names
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'save_bang', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'valid_pred', type: 'function' }));
  });

  it('extracts singleton (class-level) methods', () => {
    const f = write('service.rb', `
class UserService
  def self.find_by_email(email)
    User.where(email: email).first
  end

  def self.create!(attrs)
    User.create!(attrs)
  end
end
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'find_by_email', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'create_bang', type: 'function' }));
  });

  it('estimates cyclomatic complexity for Ruby methods', () => {
    const f = write('complex.rb', `
def evaluate(x)
  if x > 100
    "huge"
  elsif x > 50
    "large"
  elsif x > 10
    result = "other"
    while x > 0
      if x.even?
        result = "even" if x > 5
      end
      x -= 1
    end
    result
  else
    "small"
  end
end
`);
    const parsed = parseFile(f);
    const entity = parsed?.entities.find(e => e.name === 'evaluate');
    expect(entity?.complexity).toBe('medium');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts require and require_relative imports', () => {
    const f = write('app.rb', `
require 'json'
require 'net/http'
require_relative '../models/user'
require_relative './helpers'
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'json', names: ['json'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'net/http', names: ['http'], isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: '../models/user', isLocal: true }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: './helpers', isLocal: true }));
  });

  it('extracts mixin imports (include, extend, prepend)', () => {
    const f = write('mixins.rb', `
class User
  include Greetable
  extend ClassMethods
  prepend Auditable
end
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'Greetable', names: ['Greetable'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'ClassMethods', names: ['ClassMethods'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'Auditable', names: ['Auditable'] }));
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts classes, modules, and attr_accessor names as exports', () => {
    const f = write('exports.rb', `
module MyLib
end

class PublicApi
  attr_reader :id, :name
  attr_accessor :status

  module_function def helper
    "help"
  end
end
`);
    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('MyLib');
    expect(parsed?.exports).toContain('PublicApi');
    expect(parsed?.exports).toContain('id');
    expect(parsed?.exports).toContain('name');
    expect(parsed?.exports).toContain('status');
  });
});
