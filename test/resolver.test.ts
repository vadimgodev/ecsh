import type { ECSClient } from '@aws-sdk/client-ecs';
import { describe, expect, it, vi } from 'vitest';
import { NonTtyError, type ResolveInput, type ResolverDeps, resolveTarget } from '../src/resolver';

function makeDeps(over: {
  interactive?: boolean;
  clusters?: string[];
  services?: string[];
  tasks?: string[];
  containers?: string[];
  profiles?: { name: string; region?: string }[];
  pick?: (msg: string, choices: string[]) => string;
  text?: string;
}): ResolverDeps {
  const pick = over.pick ?? ((_m, choices) => choices[0]);
  return {
    discovery: {
      createEcsClient: vi.fn(() => ({}) as ECSClient),
      listClusters: vi.fn(async () => over.clusters ?? ['web']),
      listServices: vi.fn(async () => over.services ?? ['api']),
      listTasks: vi.fn(async () => over.tasks ?? ['task-1']),
      listContainers: vi.fn(async () => over.containers ?? ['app']),
    },
    prompts: {
      isInteractive: () => over.interactive ?? false,
      selectFuzzy: vi.fn(async ({ message, choices }) => pick(message, choices)),
      inputText: vi.fn(async () => over.text ?? '/bin/bash'),
    },
    profiles: { loadAwsProfiles: () => over.profiles ?? [] },
    regions: { mergeRegions: (extra) => [...extra, 'us-east-1'] },
  };
}

const noFlags = {} as ResolveInput['flags'];
const noEnv = {} as ResolveInput['env'];

describe('resolveTarget', () => {
  it('uses flags above everything', async () => {
    const deps = makeDeps({ interactive: true });
    const r = await resolveTarget(
      {
        flags: {
          profile: 'p',
          region: 'r',
          cluster: 'c',
          service: 's',
          task: 't',
          container: 'n',
          command: 'sh',
        },
        env: noEnv,
      },
      deps,
    );
    expect(r).toEqual({
      profile: 'p',
      region: 'r',
      cluster: 'c',
      service: 's',
      task: 't',
      container: 'n',
      command: 'sh',
    });
    expect(deps.prompts.selectFuzzy).not.toHaveBeenCalled();
  });

  it('lets a saved target beat ambient env', async () => {
    const deps = makeDeps({});
    const r = await resolveTarget(
      {
        flags: noFlags,
        target: { profile: 'prod', region: 'us-east-1', cluster: 'web', service: 'api' },
        env: { AWS_PROFILE: 'staging', AWS_REGION: 'eu-west-1' },
      },
      deps,
    );
    expect(r.profile).toBe('prod');
    expect(r.region).toBe('us-east-1');
  });

  it('falls back to env when there is no flag or target', async () => {
    const deps = makeDeps({});
    const r = await resolveTarget(
      {
        flags: { cluster: 'web', service: 'api' },
        env: { AWS_PROFILE: 'staging', AWS_REGION: 'eu-west-1' },
      },
      deps,
    );
    expect(r.profile).toBe('staging');
    expect(r.region).toBe('eu-west-1');
  });

  it('auto-selects a single task and single container without prompting', async () => {
    const deps = makeDeps({ tasks: ['only-task'], containers: ['only-container'] });
    const r = await resolveTarget(
      {
        flags: { profile: 'p', region: 'r', cluster: 'c', service: 's', command: 'sh' },
        env: noEnv,
      },
      deps,
    );
    expect(r.task).toBe('only-task');
    expect(r.container).toBe('only-container');
    expect(deps.prompts.selectFuzzy).not.toHaveBeenCalled();
  });

  it('throws NonTtyError when multiple tasks and not interactive', async () => {
    const deps = makeDeps({ tasks: ['a', 'b'], interactive: false });
    await expect(
      resolveTarget(
        {
          flags: { profile: 'p', region: 'r', cluster: 'c', service: 's', command: 'sh' },
          env: noEnv,
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(NonTtyError);
  });

  it('throws a clear error when a service has no running tasks', async () => {
    const deps = makeDeps({ tasks: [] });
    await expect(
      resolveTarget(
        {
          flags: { profile: 'p', region: 'r', cluster: 'c', service: 'svc', command: 'sh' },
          env: noEnv,
        },
        deps,
      ),
    ).rejects.toThrow(/Service `svc` has no running tasks/);
  });

  it('defaults command to /bin/bash in non-interactive mode', async () => {
    const deps = makeDeps({});
    const r = await resolveTarget(
      { flags: { profile: 'p', region: 'r', cluster: 'c', service: 's' }, env: noEnv },
      deps,
    );
    expect(r.command).toBe('/bin/bash');
  });

  it('maps the "(default credentials)" choice to an undefined profile', async () => {
    const deps = makeDeps({
      interactive: true,
      profiles: [{ name: 'prod' }],
      pick: (msg, choices) => (msg === 'AWS profile' ? '(default credentials)' : choices[0]),
    });
    const r = await resolveTarget(
      { flags: { region: 'r', cluster: 'c', service: 's', command: 'sh' }, env: noEnv },
      deps,
    );
    expect(r.profile).toBeUndefined();
  });
});
