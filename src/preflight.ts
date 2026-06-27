import { spawnSync } from 'node:child_process';

export type CommandRunner = (
  cmd: string,
  args: string[],
) => { status: number | null; error?: Error };

export const spawnRunner: CommandRunner = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'ignore' });
  return { status: r.status, error: r.error };
};

export function commandExists(cmd: string, run: CommandRunner): boolean {
  const r = run(cmd, ['--version']);
  if (r.error && (r.error as NodeJS.ErrnoException).code === 'ENOENT') return false;
  return true;
}

export interface PreflightResult {
  ok: boolean;
  missing: string[];
}

export function preflight(run: CommandRunner): PreflightResult {
  const missing: string[] = [];
  if (!commandExists('aws', run)) missing.push('aws');
  if (!commandExists('session-manager-plugin', run)) missing.push('session-manager-plugin');
  return { ok: missing.length === 0, missing };
}
