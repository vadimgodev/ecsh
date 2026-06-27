import { describe, expect, it, vi } from 'vitest';
import { runList, runRemove, type TargetsDeps } from '../../src/commands/targets';
import type { ConfigFile } from '../../src/types';

function deps(config: ConfigFile, over: Partial<TargetsDeps> = {}): TargetsDeps {
  return { loadConfig: () => config, saveConfig: vi.fn(), log: vi.fn(), ...over };
}

describe('targets', () => {
  it('reports when there are no targets', () => {
    const log = vi.fn();
    expect(runList(deps({ version: 1, targets: {} }, { log }))).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No saved targets'));
  });

  it('lists target names with their coordinates', () => {
    const log = vi.fn();
    runList(
      deps(
        {
          version: 1,
          targets: {
            'prod-api': { profile: 'prod', region: 'us-east-1', cluster: 'web', service: 'api' },
          },
        },
        { log },
      ),
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('prod-api'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('web'));
  });

  it('removes an existing target and saves', () => {
    const saveConfig = vi.fn();
    const config: ConfigFile = { version: 1, targets: { a: { region: 'us-east-1' } } };
    expect(runRemove('a', deps(config, { saveConfig }))).toBe(0);
    expect(config.targets.a).toBeUndefined();
    expect(saveConfig).toHaveBeenCalled();
  });

  it('errors when removing a missing target', () => {
    const saveConfig = vi.fn();
    expect(runRemove('ghost', deps({ version: 1, targets: {} }, { saveConfig }))).toBe(1);
    expect(saveConfig).not.toHaveBeenCalled();
  });
});
