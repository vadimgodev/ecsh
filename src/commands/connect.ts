import { toStableTarget, validateTargetName } from '../config';
import { ERROR_LINKS, formatError, mapError } from '../errors';
import type { ResolveInput } from '../resolver';
import type { ResolvedTarget, Target } from '../types';

export interface ConnectOptions {
  name?: string;
  flags: ResolveInput['flags'];
  saveAs?: string;
}

export interface ConnectDeps {
  preflight(): { ok: boolean; missing: string[] };
  loadTarget(name: string): Target | undefined;
  resolve(input: ResolveInput): Promise<ResolvedTarget>;
  exec(t: ResolvedTarget): Promise<number>;
  saveTarget(name: string, t: Target): void;
  confirmOverwrite(name: string): Promise<boolean>;
  env: ResolveInput['env'];
  log(msg: string): void;
}

export async function runConnect(opts: ConnectOptions, deps: ConnectDeps): Promise<number> {
  if (opts.saveAs !== undefined) {
    const error = validateTargetName(opts.saveAs);
    if (error !== null) {
      deps.log(error);
      return 1;
    }
  }

  const pf = deps.preflight();
  if (!pf.ok) {
    for (const tool of pf.missing) {
      const link = tool === 'aws' ? ERROR_LINKS.cli : ERROR_LINKS.smp;
      deps.log(
        formatError({
          message: `Required tool "${tool}" not found.`,
          hint: `Install it → ${link}`,
          exitCode: 1,
        }),
      );
    }
    return 1;
  }

  let target: Target | undefined;
  if (opts.name) {
    target = deps.loadTarget(opts.name);
    if (!target) {
      deps.log(`No saved target "${opts.name}". Run \`ecsh ls\` to see saved targets.`);
      return 1;
    }
  }

  let resolved: ResolvedTarget;
  try {
    resolved = await deps.resolve({ flags: opts.flags, target, env: deps.env });
  } catch (e) {
    const m = mapError(e, {
      profile: opts.flags.profile ?? target?.profile ?? deps.env.AWS_PROFILE,
    });
    deps.log(formatError(m));
    return m.exitCode;
  }

  if (opts.saveAs) {
    if (deps.loadTarget(opts.saveAs) && !(await deps.confirmOverwrite(opts.saveAs))) {
      deps.log('Not saved.');
    } else {
      deps.saveTarget(opts.saveAs, toStableTarget(resolved));
      deps.log(`Saved target "${opts.saveAs}".`);
    }
  }

  try {
    return await deps.exec(resolved);
  } catch (e) {
    const m = mapError(e, { profile: resolved.profile, service: resolved.service });
    deps.log(formatError(m));
    return m.exitCode;
  }
}
