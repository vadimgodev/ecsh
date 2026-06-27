import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import envPaths from 'env-paths';
import type { ConfigFile, ResolvedTarget, Target } from './types';
import { CONFIG_VERSION } from './types';

export const RESERVED_TARGET_NAMES = ['save', 'ls', 'rm', 'doctor'];

const TARGET_KEYS = ['profile', 'region', 'cluster', 'service', 'container', 'command'] as const;

export function defaultConfigPath(): string {
  return join(envPaths('ecsh', { suffix: '' }).config, 'config.json');
}

export function emptyConfig(): ConfigFile {
  return { version: CONFIG_VERSION, targets: {} };
}

export function loadConfig(filePath: string): ConfigFile {
  if (!existsSync(filePath)) return emptyConfig();
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    throw new Error(`Config file at ${filePath} is not valid JSON: ${(e as Error).message}`);
  }
  return validateConfig(raw, filePath);
}

export function validateConfig(raw: unknown, filePath = 'config'): ConfigFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Config at ${filePath} must be a JSON object.`);
  }
  const o = raw as Record<string, unknown>;
  const version = o.version === undefined ? CONFIG_VERSION : o.version;
  if (typeof version !== 'number') throw new Error('Config "version" must be a number.');
  const targetsRaw = o.targets ?? {};
  if (!targetsRaw || typeof targetsRaw !== 'object') {
    throw new Error('Config "targets" must be an object.');
  }
  const targets: Record<string, Target> = {};
  for (const [name, t] of Object.entries(targetsRaw as Record<string, unknown>)) {
    targets[name] = validateTarget(name, t);
  }
  return { version, targets };
}

function validateTarget(name: string, t: unknown): Target {
  if (!t || typeof t !== 'object') throw new Error(`Target "${name}" must be an object.`);
  const o = t as Record<string, unknown>;
  const out: Target = {};
  for (const key of TARGET_KEYS) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== 'string') throw new Error(`Target "${name}.${key}" must be a string.`);
    out[key] = v;
  }
  return out;
}

export function saveConfig(filePath: string, config: ConfigFile): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function getTarget(config: ConfigFile, name: string): Target | undefined {
  return config.targets[name];
}

export function setTarget(config: ConfigFile, name: string, t: Target): void {
  config.targets[name] = t;
}

export function deleteTarget(config: ConfigFile, name: string): boolean {
  if (!(name in config.targets)) return false;
  delete config.targets[name];
  return true;
}

export function validateTargetName(name: string): string | null {
  if (!name) return 'Target name cannot be empty.';
  if (name.startsWith('-')) return 'Target name cannot start with "-".';
  if (RESERVED_TARGET_NAMES.includes(name)) return `"${name}" is a reserved word.`;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    return 'Target name may only contain letters, numbers, ".", "_", "-".';
  }
  return null;
}

export function toStableTarget(r: ResolvedTarget): Target {
  const t: Target = {
    region: r.region,
    cluster: r.cluster,
    service: r.service,
    container: r.container,
    command: r.command,
  };
  if (r.profile) t.profile = r.profile;
  return t;
}
