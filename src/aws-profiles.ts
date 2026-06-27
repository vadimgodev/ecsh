import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface AwsProfile {
  name: string;
  region?: string;
}

function parseIni(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let current: string | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[#;].*$/, '').trim();
    if (!line) continue;
    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      current = section[1].trim();
      out[current] ??= {};
      continue;
    }
    const kv = line.match(/^([^=]+)=(.*)$/);
    if (kv && current) out[current][kv[1].trim()] = kv[2].trim();
  }
  return out;
}

export function parseProfiles(configText: string, credentialsText: string): AwsProfile[] {
  const map = new Map<string, AwsProfile>();

  for (const [section, body] of Object.entries(parseIni(configText))) {
    let name: string | null = null;
    if (section === 'default') name = 'default';
    else if (section.startsWith('profile ')) name = section.slice('profile '.length).trim();
    if (!name) continue;
    map.set(name, { name, region: body.region });
  }

  for (const [section, body] of Object.entries(parseIni(credentialsText))) {
    const existing = map.get(section);
    if (existing) {
      if (!existing.region && body.region) existing.region = body.region;
    } else {
      map.set(section, { name: section, region: body.region });
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function loadAwsProfiles(awsDir: string = join(homedir(), '.aws')): AwsProfile[] {
  const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8') : '');
  return parseProfiles(read(join(awsDir, 'config')), read(join(awsDir, 'credentials')));
}
