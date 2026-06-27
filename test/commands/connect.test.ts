import { describe, expect, it, vi } from 'vitest';
import { type ConnectDeps, runConnect } from '../../src/commands/connect';
import type { ResolvedTarget } from '../../src/types';

const resolved: ResolvedTarget = {
  profile: 'prod',
  region: 'us-east-1',
  cluster: 'web',
  service: 'api',
  task: 'abc',
  container: 'app',
  command: '/bin/bash',
};

function makeDeps(over: Partial<ConnectDeps> = {}): ConnectDeps {
  return {
    preflight: () => ({ ok: true, missing: [] }),
    loadTarget: () => undefined,
    resolve: async () => resolved,
    exec: async () => 0,
    saveTarget: vi.fn(),
    confirmOverwrite: async () => true,
    env: {},
    log: vi.fn(),
    ...over,
  };
}

describe('runConnect', () => {
  it('aborts with install hints when preflight fails', async () => {
    const log = vi.fn();
    const code = await runConnect(
      { flags: {} },
      makeDeps({ preflight: () => ({ ok: false, missing: ['session-manager-plugin'] }), log }),
    );
    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('session-manager-plugin'));
  });

  it('errors when a named target does not exist', async () => {
    const log = vi.fn();
    const code = await runConnect(
      { name: 'ghost', flags: {} },
      makeDeps({ loadTarget: () => undefined, log }),
    );
    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No saved target "ghost"'));
  });

  it('resolves then execs, returning the exec exit code', async () => {
    const exec = vi.fn(async () => 42);
    const code = await runConnect({ flags: {} }, makeDeps({ exec }));
    expect(exec).toHaveBeenCalledWith(resolved);
    expect(code).toBe(42);
  });

  it('maps a resolve error to a friendly message', async () => {
    const log = vi.fn();
    const code = await runConnect(
      { flags: {} },
      makeDeps({
        resolve: async () => {
          throw { name: 'AccessDeniedException', message: 'no' };
        },
        log,
      }),
    );
    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/Access denied/));
  });

  it('persists stable coordinates when --save is given', async () => {
    const saveTarget = vi.fn();
    await runConnect({ flags: {}, saveAs: 'prod-api' }, makeDeps({ saveTarget }));
    expect(saveTarget).toHaveBeenCalledWith('prod-api', {
      profile: 'prod',
      region: 'us-east-1',
      cluster: 'web',
      service: 'api',
      container: 'app',
      command: '/bin/bash',
    });
  });

  it('rejects an invalid --save name without connecting', async () => {
    const resolve = vi.fn();
    const exec = vi.fn();
    const saveTarget = vi.fn();
    const log = vi.fn();
    const code = await runConnect(
      { flags: {}, saveAs: 'bad name!' },
      makeDeps({ resolve, exec, saveTarget, log }),
    );
    expect(code).toBe(1);
    expect(resolve).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(saveTarget).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.any(String));
  });

  it('rejects a reserved --save name without connecting', async () => {
    const resolve = vi.fn();
    const exec = vi.fn();
    const saveTarget = vi.fn();
    const log = vi.fn();
    const code = await runConnect(
      { flags: {}, saveAs: 'save' },
      makeDeps({ resolve, exec, saveTarget, log }),
    );
    expect(code).toBe(1);
    expect(resolve).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(saveTarget).not.toHaveBeenCalled();
  });
});
