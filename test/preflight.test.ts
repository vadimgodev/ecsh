import { describe, expect, it } from 'vitest';
import { type CommandRunner, commandExists, preflight } from '../src/preflight';

const enoent = (): { status: null; error: Error } => {
  const error = new Error('not found') as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return { status: null, error };
};

describe('preflight', () => {
  it('reports a present binary', () => {
    const run: CommandRunner = () => ({ status: 0 });
    expect(commandExists('aws', run)).toBe(true);
  });

  it('reports a missing binary on ENOENT', () => {
    expect(commandExists('aws', enoent)).toBe(false);
  });

  it('lists missing binaries and is ok only when both exist', () => {
    const onlyAws: CommandRunner = (cmd) => (cmd === 'aws' ? { status: 0 } : enoent());
    expect(preflight(onlyAws)).toEqual({ ok: false, missing: ['session-manager-plugin'] });
    expect(preflight(() => ({ status: 0 }))).toEqual({ ok: true, missing: [] });
  });
});
