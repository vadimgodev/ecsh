import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { buildExecArgs, runExec } from '../src/exec';
import type { ResolvedTarget } from '../src/types';

const base: ResolvedTarget = {
  profile: 'prod',
  region: 'us-east-1',
  cluster: 'web',
  service: 'api',
  task: 'abc123',
  container: 'app',
  command: '/bin/bash',
};

describe('exec', () => {
  it('builds the full argv', () => {
    expect(buildExecArgs(base)).toEqual([
      'ecs',
      'execute-command',
      '--profile',
      'prod',
      '--region',
      'us-east-1',
      '--cluster',
      'web',
      '--task',
      'abc123',
      '--container',
      'app',
      '--command',
      '/bin/bash',
      '--interactive',
    ]);
  });

  it('omits --profile when there is no profile', () => {
    expect(buildExecArgs({ ...base, profile: undefined })).not.toContain('--profile');
  });

  it('spawns aws with inherited stdio and resolves the exit code', async () => {
    const child = new EventEmitter();
    const spawnFn = vi.fn().mockReturnValue(child);
    const p = runExec(base, spawnFn as never);
    child.emit('exit', 0, null);
    expect(await p).toBe(0);
    expect(spawnFn).toHaveBeenCalledWith('aws', buildExecArgs(base), { stdio: 'inherit' });
  });

  it('maps a SIGINT exit to 130', async () => {
    const child = new EventEmitter();
    const p = runExec(base, vi.fn().mockReturnValue(child) as never);
    child.emit('exit', null, 'SIGINT');
    expect(await p).toBe(130);
  });

  it('rejects on spawn error', async () => {
    const child = new EventEmitter();
    const p = runExec(base, vi.fn().mockReturnValue(child) as never);
    child.emit('error', new Error('ENOENT'));
    await expect(p).rejects.toThrow('ENOENT');
  });
});
