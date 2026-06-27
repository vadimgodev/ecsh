import type { ECSClient } from '@aws-sdk/client-ecs';
import type { ResolvedTarget, Target } from './types';
import { DEFAULT_COMMAND } from './types';

export class NonTtyError extends Error {
  constructor(
    public field: string,
    public flag: string,
  ) {
    super(`Cannot resolve "${field}" without an interactive terminal. Provide ${flag}.`);
    this.name = 'NonTtyError';
  }
}

export interface ResolveInput {
  flags: {
    profile?: string;
    region?: string;
    cluster?: string;
    service?: string;
    task?: string;
    container?: string;
    command?: string;
  };
  target?: Target;
  env: { AWS_PROFILE?: string; AWS_REGION?: string; AWS_DEFAULT_REGION?: string };
}

export interface ResolverDeps {
  discovery: {
    createEcsClient(opts: { region: string; profile?: string }): ECSClient;
    listClusters(client: ECSClient): Promise<string[]>;
    listServices(client: ECSClient, cluster: string): Promise<string[]>;
    listTasks(client: ECSClient, cluster: string, service: string): Promise<string[]>;
    listContainers(client: ECSClient, cluster: string, task: string): Promise<string[]>;
  };
  prompts: {
    isInteractive(): boolean;
    selectFuzzy(opts: { message: string; choices: string[] }): Promise<string>;
    inputText(opts: { message: string; default?: string }): Promise<string>;
  };
  profiles: { loadAwsProfiles(): { name: string; region?: string }[] };
  regions: { mergeRegions(extra: string[]): string[] };
}

const DEFAULT_CREDS_LABEL = '(default credentials)';

async function pickField(
  field: string,
  flag: string,
  preset: string | undefined,
  list: () => Promise<string[]>,
  deps: ResolverDeps,
  autoSingle: boolean,
): Promise<string> {
  if (preset !== undefined) return preset;
  const choices = await list();
  if (autoSingle && choices.length === 1) return choices[0];
  if (choices.length === 0) throw new Error(`No ${field}s found.`);
  if (!deps.prompts.isInteractive()) throw new NonTtyError(field, flag);
  return deps.prompts.selectFuzzy({ message: field, choices });
}

export async function resolveTarget(
  input: ResolveInput,
  deps: ResolverDeps,
): Promise<ResolvedTarget> {
  const { flags, target, env } = input;
  const profiles = deps.profiles.loadAwsProfiles();

  // profile
  let profile: string | undefined;
  const presetProfile = flags.profile ?? target?.profile ?? env.AWS_PROFILE;
  if (presetProfile !== undefined) {
    profile = presetProfile;
  } else if (deps.prompts.isInteractive()) {
    const choices = [...profiles.map((p) => p.name), DEFAULT_CREDS_LABEL];
    const picked = await deps.prompts.selectFuzzy({ message: 'AWS profile', choices });
    profile = picked === DEFAULT_CREDS_LABEL ? undefined : picked;
  } else {
    profile = undefined; // non-TTY with nothing set → default credentials (env / instance role)
  }

  // region
  let region = flags.region ?? target?.region ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (!region && profile) region = profiles.find((p) => p.name === profile)?.region;
  if (!region) {
    if (!deps.prompts.isInteractive()) throw new NonTtyError('region', '--region');
    const extra = profiles.map((p) => p.region).filter((r): r is string => Boolean(r));
    region = await deps.prompts.selectFuzzy({
      message: 'AWS region',
      choices: deps.regions.mergeRegions(extra),
    });
  }

  const client = deps.discovery.createEcsClient({ region, profile });

  // cluster, service
  const cluster = await pickField(
    'cluster',
    '--cluster',
    flags.cluster ?? target?.cluster,
    () => deps.discovery.listClusters(client),
    deps,
    false,
  );
  const service = await pickField(
    'service',
    '--service',
    flags.service ?? target?.service,
    () => deps.discovery.listServices(client, cluster),
    deps,
    false,
  );

  // task — a saved target never stores a task; only a flag or live resolution
  let task: string;
  if (flags.task !== undefined) {
    task = flags.task;
  } else {
    const tasks = await deps.discovery.listTasks(client, cluster, service);
    if (tasks.length === 0) throw new Error(`Service \`${service}\` has no running tasks.`);
    if (tasks.length === 1) task = tasks[0];
    else if (!deps.prompts.isInteractive()) throw new NonTtyError('task', '--task');
    else task = await deps.prompts.selectFuzzy({ message: 'task', choices: tasks });
  }

  // container — auto-select when a task has a single container
  const container = await pickField(
    'container',
    '--container',
    flags.container ?? target?.container,
    () => deps.discovery.listContainers(client, cluster, task),
    deps,
    true,
  );

  // command
  let command = flags.command ?? target?.command;
  if (command === undefined) {
    command = deps.prompts.isInteractive()
      ? await deps.prompts.inputText({ message: 'Command', default: DEFAULT_COMMAND })
      : DEFAULT_COMMAND;
  }

  return { profile, region, cluster, service, task, container, command };
}
