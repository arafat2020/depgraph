import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/php';
import { parseFile } from '../stages/parser';

describe('PHP Parser', () => {
  const tempDir = path.join(__dirname, 'temp_php');

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

  it('extracts classes including abstract and final', () => {
    const f = write('Types.php', `<?php

class UserService {
}

abstract class BaseRepository {
}

final class Singleton {
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserService', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'BaseRepository', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Singleton', type: 'class' }));
  });

  it('extracts interfaces and traits', () => {
    const f = write('Contracts.php', `<?php

interface UserRepository {
    public function findById(int $id): ?User;
}

trait Timestampable {
    public function setCreatedAt(\DateTime $dt): void {}
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserRepository', type: 'interface' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Timestampable', type: 'class' }));
  });

  it('extracts PHP 8.1 enums', () => {
    const f = write('Status.php', `<?php

enum OrderStatus: string {
    case Pending = 'pending';
    case Shipped = 'shipped';
}

enum Suit implements HasColor {
    case Hearts;
    case Diamonds;
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'OrderStatus', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Suit', type: 'class' }));
  });

  it('extracts functions and methods with modifiers', () => {
    const f = write('Service.php', `<?php

class OrderService {
    public function createOrder(array $data): Order {
        return new Order();
    }

    private function validate(array $data): void {}

    public static function fromArray(array $data): self {
        return new self();
    }
}

function globalHelper(string $input): string {
    return strtolower($input);
}
`);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'createOrder', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'validate', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'fromArray', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'globalHelper', type: 'function' }));
  });

  it('estimates cyclomatic complexity for PHP functions', () => {
    const f = write('Complex.php', `<?php

function evaluate(int $x): string {
    if ($x > 100) {
        return 'huge';
    } elseif ($x > 50) {
        return 'large';
    } elseif ($x > 10) {
        foreach (range(0, $x) as $i) {
            switch ($i) {
                case 1: return 'one';
                case 2: return 'two';
            }
        }
    }
    return 'small';
}
`);
    const parsed = parseFile(f);
    const entity = parsed?.entities.find(e => e.name === 'evaluate');
    expect(entity?.complexity).toBe('medium');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts single use statements and alias use', () => {
    const f = write('Imports.php', `<?php

use App\\Domain\\User;
use App\\Services\\OrderService;
use App\\Contracts\\Repository as RepositoryInterface;
use Illuminate\\Support\\Collection;
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'App\\Domain\\User', names: ['User'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'App\\Services\\OrderService', names: ['OrderService'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'App\\Contracts\\Repository', names: ['RepositoryInterface'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'Illuminate\\Support\\Collection', names: ['Collection'] }));
  });

  it('extracts grouped use statements', () => {
    const f = write('GroupedImports.php', `<?php

use App\\Domain\\{User, Order, Product as Prod};
`);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ names: ['User'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ names: ['Order'] }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ names: ['Prod'] }));
  });

  it('extracts require/include file imports', () => {
    const f = write('Includes.php', [
      '<?php',
      "require_once __DIR__ . '/vendor/autoload.php';",
      "require 'config/database.php';",
      "include 'helpers/utils.php';",
    ].join('\n'));
    const parsed = parseFile(f);
    expect(parsed?.imports.some(i => i.names.includes('autoload'))).toBe(true);
    expect(parsed?.imports.some(i => i.names.includes('database'))).toBe(true);
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts top-level classes, interfaces, traits, and functions as exports', () => {
    const f = write('Exports.php', `<?php

class PublicClass {}
interface PublicInterface {}
trait PublicTrait {}
function publicFunction() {}
`);
    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('PublicClass');
    expect(parsed?.exports).toContain('PublicInterface');
    expect(parsed?.exports).toContain('PublicTrait');
    expect(parsed?.exports).toContain('publicFunction');
  });
});
