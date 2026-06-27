import { describe, expect, it, vi } from 'vitest';
import { runSave, type SaveDeps } from '../../src/commands/save';
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

function makeDeps(over: Partial<SaveDeps> = {}): SaveDeps {
  return {
    resolve: async () => resolved,
    loadTarget: () => undefined,
    saveTarget: vi.fn(),
    confirmOverwrite: async () => true,
    env: {},
    log: vi.fn(),
    ...over,
  };
}

describe('runSave', () => {
  it('rejects a reserved name without resolving', async () => {
    const resolve = vi.fn();
    const code = await runSave('doctor', {}, makeDeps({ resolve }));
    expect(code).toBe(1);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('persists stable coordinates (no task) and does not connect', async () => {
    const saveTarget = vi.fn();
    const code = await runSave('prod-api', {}, makeDeps({ saveTarget }));
    expect(code).toBe(0);
    expect(saveTarget).toHaveBeenCalledWith('prod-api', {
      profile: 'prod',
      region: 'us-east-1',
      cluster: 'web',
      service: 'api',
      container: 'app',
      command: '/bin/bash',
    });
  });

  it('aborts when overwrite is declined', async () => {
    const saveTarget = vi.fn();
    const code = await runSave(
      'prod-api',
      {},
      makeDeps({
        loadTarget: () => ({ region: 'us-east-1' }),
        confirmOverwrite: async () => false,
        saveTarget,
      }),
    );
    expect(code).toBe(1);
    expect(saveTarget).not.toHaveBeenCalled();
  });
});
