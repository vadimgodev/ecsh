import { describe, expect, it } from 'vitest';
import { parseProfiles } from '../src/aws-profiles';

const CONFIG = `
[default]
region = us-east-1

[profile prod]
region = eu-west-1
sso_session = corp
sso_account_id = 111122223333

[sso-session corp]
sso_start_url = https://example.awsapps.com/start
`;

const CREDENTIALS = `
[ci]
aws_access_key_id = AKIA...
aws_secret_access_key = secret
`;

describe('parseProfiles', () => {
  it('reads [default] and [profile x] from config with regions', () => {
    const profiles = parseProfiles(CONFIG, '');
    expect(profiles).toEqual([
      { name: 'default', region: 'us-east-1' },
      { name: 'prod', region: 'eu-west-1' },
    ]);
  });

  it('ignores non-profile sections like [sso-session]', () => {
    expect(parseProfiles(CONFIG, '').some((p) => p.name === 'corp')).toBe(false);
  });

  it('merges credentials-only profiles and sorts by name', () => {
    const names = parseProfiles(CONFIG, CREDENTIALS).map((p) => p.name);
    expect(names).toEqual(['ci', 'default', 'prod']);
  });

  it('tolerates comments and blank lines', () => {
    const profiles = parseProfiles('# hi\n[default]\nregion = us-west-2 ; inline\n', '');
    expect(profiles).toEqual([{ name: 'default', region: 'us-west-2' }]);
  });
});
