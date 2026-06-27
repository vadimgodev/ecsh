import { describe, expect, it, vi } from 'vitest';
import { type DoctorDeps, runDoctor } from '../../src/commands/doctor';

function makeDeps(over: Partial<DoctorDeps> = {}): DoctorDeps {
  return {
    hasBinary: () => true,
    checkCredentials: async () => true,
    inspect: undefined,
    log: vi.fn(),
    ...over,
  };
}

describe('runDoctor', () => {
  it('returns 0 when binaries and credentials are fine', async () => {
    expect(await runDoctor({}, makeDeps())).toBe(0);
  });

  it('returns 1 and shows a fix when a binary is missing', async () => {
    const log = vi.fn();
    const code = await runDoctor(
      {},
      makeDeps({ hasBinary: (b) => b !== 'session-manager-plugin', log }),
    );
    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/✗ Session Manager plugin/));
  });

  it('runs deep checks and flags a service without exec enabled', async () => {
    const log = vi.fn();
    const inspect = vi.fn(async () => ({ enabled: false, runningCount: 1, agentRunning: true }));
    const code = await runDoctor({ cluster: 'web', service: 'api' }, makeDeps({ inspect, log }));
    expect(inspect).toHaveBeenCalledWith('web', 'api');
    expect(code).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/✗ ECS Exec enabled/));
  });

  it('skips deep checks when credentials fail', async () => {
    const inspect = vi.fn();
    const code = await runDoctor(
      { cluster: 'web', service: 'api' },
      makeDeps({ checkCredentials: async () => false, inspect }),
    );
    expect(code).toBe(1);
    expect(inspect).not.toHaveBeenCalled();
  });
});
