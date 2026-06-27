import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deleteTarget,
  emptyConfig,
  getTarget,
  loadConfig,
  saveConfig,
  setTarget,
  toStableTarget,
  validateConfig,
  validateTargetName,
} from '../src/config';

function tmp(): string {
  return join(mkdtempSync(join(tmpdir(), 'ecsh-')), 'config.json');
}

describe('config', () => {
  it('returns an empty config when the file is missing', () => {
    expect(loadConfig(tmp())).toEqual({ version: 1, targets: {} });
  });

  it('round-trips save → load', () => {
    const path = tmp();
    const cfg = emptyConfig();
    setTarget(cfg, 'prod', { region: 'us-east-1', cluster: 'web', service: 'api' });
    saveConfig(path, cfg);
    expect(loadConfig(path)).toEqual(cfg);
  });

  it('throws a clear error for malformed JSON', () => {
    const path = tmp();
    writeFileSync(path, '{ not json', 'utf8');
    expect(() => loadConfig(path)).toThrow(/not valid JSON/i);
  });

  it('rejects a target field of the wrong type', () => {
    expect(() => validateConfig({ version: 1, targets: { x: { region: 5 } } })).toThrow(
      /"x.region" must be a string/i,
    );
  });

  it('defaults a missing version to CONFIG_VERSION', () => {
    expect(validateConfig({ targets: {} }).version).toBe(1);
  });

  it('get/set/delete operate on the targets map', () => {
    const cfg = emptyConfig();
    setTarget(cfg, 'a', { region: 'us-east-1' });
    expect(getTarget(cfg, 'a')).toEqual({ region: 'us-east-1' });
    expect(deleteTarget(cfg, 'a')).toBe(true);
    expect(deleteTarget(cfg, 'a')).toBe(false);
    expect(getTarget(cfg, 'a')).toBeUndefined();
  });

  it('validates target names', () => {
    expect(validateTargetName('prod-api')).toBeNull();
    expect(validateTargetName('')).toMatch(/empty/i);
    expect(validateTargetName('save')).toMatch(/reserved/i);
    expect(validateTargetName('-x')).toMatch(/start/i);
    expect(validateTargetName('a b')).toMatch(/letters/i);
  });

  it('toStableTarget drops the task and omits an undefined profile', () => {
    expect(
      toStableTarget({
        region: 'us-east-1',
        cluster: 'web',
        service: 'api',
        task: 'abc123',
        container: 'app',
        command: '/bin/bash',
      }),
    ).toEqual({
      region: 'us-east-1',
      cluster: 'web',
      service: 'api',
      container: 'app',
      command: '/bin/bash',
    });
  });
});
