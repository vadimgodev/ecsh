import { toStableTarget, validateTargetName } from '../config';
import type { ResolveInput } from '../resolver';
import type { ResolvedTarget, Target } from '../types';

export interface SaveDeps {
  resolve(input: ResolveInput): Promise<ResolvedTarget>;
  loadTarget(name: string): Target | undefined;
  saveTarget(name: string, t: Target): void;
  confirmOverwrite(name: string): Promise<boolean>;
  env: ResolveInput['env'];
  log(msg: string): void;
}

export async function runSave(
  name: string,
  flags: ResolveInput['flags'],
  deps: SaveDeps,
): Promise<number> {
  const nameError = validateTargetName(name);
  if (nameError) {
    deps.log(nameError);
    return 1;
  }
  if (deps.loadTarget(name) && !(await deps.confirmOverwrite(name))) {
    deps.log('Aborted.');
    return 1;
  }
  let resolved: ResolvedTarget;
  try {
    resolved = await deps.resolve({ flags, target: undefined, env: deps.env });
  } catch (e) {
    deps.log((e as Error).message);
    return 1;
  }
  deps.saveTarget(name, toStableTarget(resolved));
  deps.log(`Saved target "${name}". Connect with: ecsh ${name}`);
  return 0;
}
