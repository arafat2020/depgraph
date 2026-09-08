import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import '../languages/csharp';
import { parseFile } from '../stages/parser';

describe('C# Parser', () => {
  const tempDir = path.join(__dirname, 'temp_csharp');

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

  it('extracts classes, interfaces, records, structs, and enums', () => {
    const code = `namespace MyApp.Domain;

public class UserService : IUserService
{
}

public interface IUserService
{
}

public record struct UserDto(int Id, string Name);

public struct Coordinates
{
}

public enum UserStatus
{
    Active,
    Suspended
}
`;
    const f = write('Types.cs', code);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserService', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'IUserService', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserDto', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'Coordinates', type: 'class' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'UserStatus', type: 'class' }));
  });

  it('extracts methods and async/generic methods', () => {
    const code = `namespace MyApp.Services;

public class OrderService
{
    public async Task<Order> CreateOrderAsync(CreateOrderDto dto)
    {
        return null;
    }

    public static T ProcessItem<T>(T item) where T : class
    {
        return item;
    }

    private void InternalValidate()
    {
    }
}
`;
    const f = write('OrderService.cs', code);
    const parsed = parseFile(f);
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'CreateOrderAsync', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'ProcessItem', type: 'function' }));
    expect(parsed?.entities).toContainEqual(expect.objectContaining({ name: 'InternalValidate', type: 'function' }));
  });

  it('estimates cyclomatic complexity for C# methods', () => {
    const code = `namespace MyApp;

public class Calculator
{
    public int Compute(int x, int y)
    {
        if (x > 10)
        {
            for (int i = 0; i < y; i++)
            {
                if (i % 2 == 0)
                {
                    return i;
                }
            }
        }
        else if (x < 0)
        {
            switch (y)
            {
                case 1:
                    return 1;
                case 2:
                    return 2;
            }
        }
        return 0;
    }
}
`;
    const f = write('Calculator.cs', code);
    const parsed = parseFile(f);
    const entity = parsed?.entities.find(e => e.name === 'Compute');
    expect(entity?.complexity).toBe('medium');
  });

  // ─── imports ────────────────────────────────────────────

  it('extracts using directives, static usings, and alias usings', () => {
    const code = `using System;
using System.Collections.Generic;
using static System.Math;
using Project = MyApp.Core.Domain.Project;
global using MyApp.Shared;
`;
    const f = write('Imports.cs', code);
    const parsed = parseFile(f);
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'System', isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'System.Collections.Generic', isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'System.Math', isLocal: false }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'MyApp.Core.Domain.Project', names: ['Project'], isLocal: true }));
    expect(parsed?.imports).toContainEqual(expect.objectContaining({ source: 'MyApp.Shared', names: ['Shared'], isLocal: true }));
  });

  // ─── exports ────────────────────────────────────────────

  it('extracts public and internal types and methods', () => {
    const code = `namespace MyApp;

public class PublicClass
{
    public void PublicMethod() {}
    private void PrivateMethod() {}
}

internal class InternalClass
{
}
`;
    const f = write('Exports.cs', code);
    const parsed = parseFile(f);
    expect(parsed?.exports).toContain('PublicClass');
    expect(parsed?.exports).toContain('PublicMethod');
    expect(parsed?.exports).toContain('InternalClass');
    expect(parsed?.exports).not.toContain('PrivateMethod');
  });
});
