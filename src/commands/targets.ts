import { deleteTarget } from '../config';
import type { ConfigFile } from '../types';

export interface TargetsDeps {
  loadConfig(): ConfigFile;
  saveConfig(c: ConfigFile): void;
  log(msg: string): void;
}

export function runList(deps: TargetsDeps): number {
  const { targets } = deps.loadConfig();
  const names = Object.keys(targets).sort();
  if (names.length === 0) {
    deps.log('No saved targets. Create one with: ecsh save <name>');
    return 0;
  }
  for (const name of names) {
    const t = targets[name];
    const where = [t.profile, t.region, t.cluster, t.service].filter(Boolean).join(' / ');
    deps.log(`${name}\t${where}`);
  }
  return 0;
}

export function runRemove(name: string, deps: TargetsDeps): number {
  const config = deps.loadConfig();
  if (!deleteTarget(config, name)) {
    deps.log(`No saved target "${name}".`);
    return 1;
  }
  deps.saveConfig(config);
  deps.log(`Removed target "${name}".`);
  return 0;
}
