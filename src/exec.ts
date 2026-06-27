import { spawn } from 'node:child_process';
import type { ResolvedTarget } from './types';

export function buildExecArgs(t: ResolvedTarget): string[] {
  const args = ['ecs', 'execute-command'];
  if (t.profile) args.push('--profile', t.profile);
  args.push(
    '--region',
    t.region,
    '--cluster',
    t.cluster,
    '--task',
    t.task,
    '--container',
    t.container,
    '--command',
    t.command,
    '--interactive',
  );
  return args;
}

export type SpawnFn = typeof spawn;

export function runExec(t: ResolvedTarget, spawnFn: SpawnFn = spawn): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawnFn('aws', buildExecArgs(t), { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve(signal === 'SIGINT' ? 130 : (code ?? 1));
    });
  });
}
