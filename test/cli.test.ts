import { describe, expect, it } from 'vitest';
import { buildProgram } from '../src/cli';

describe('buildProgram', () => {
  it('registers the reserved subcommands', () => {
    const names = buildProgram().commands.map((c) => c.name());
    expect(names).toEqual(expect.arrayContaining(['save', 'ls', 'rm', 'doctor']));
  });

  it('is named ecsh', () => {
    expect(buildProgram().name()).toBe('ecsh');
  });
});
