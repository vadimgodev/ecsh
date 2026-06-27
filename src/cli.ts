import { spawnSync } from 'node:child_process';
import { Command } from 'commander';
import pkg from '../package.json';
import { loadAwsProfiles } from './aws-profiles';
import { runConnect } from './commands/connect';
import { runDoctor } from './commands/doctor';
import { runSave } from './commands/save';
import { runList, runRemove } from './commands/targets';
import { defaultConfigPath, getTarget, loadConfig, saveConfig, setTarget } from './config';
import * as discovery from './discovery';
import { runExec } from './exec';
import { commandExists, preflight, spawnRunner } from './preflight';
import * as prompts from './prompts';
import { mergeRegions } from './regions';
import { type ResolveInput, type ResolverDeps, resolveTarget } from './resolver';
import type { ConfigFile, ResolvedTarget, Target } from './types';

const resolverDeps: ResolverDeps = {
  discovery: {
    createEcsClient: discovery.createEcsClient,
    listClusters: discovery.listClusters,
    listServices: discovery.listServices,
    listTasks: discovery.listTasks,
    listContainers: discovery.listContainers,
  },
  prompts: {
    isInteractive: prompts.isInteractive,
    selectFuzzy: prompts.selectFuzzy,
    inputText: prompts.inputText,
  },
  profiles: { loadAwsProfiles },
  regions: { mergeRegions },
};

const env = {
  AWS_PROFILE: process.env.AWS_PROFILE,
  AWS_REGION: process.env.AWS_REGION,
  AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
};
const configPath = defaultConfigPath();
const log = (m: string) => process.stdout.write(`${m}\n`);
const resolve = (input: ResolveInput) => resolveTarget(input, resolverDeps);
const loadTarget = (name: string) => getTarget(loadConfig(configPath), name);
const saveTarget = (name: string, t: Target) => {
  const c = loadConfig(configPath);
  setTarget(c, name, t);
  saveConfig(configPath, c);
};
const confirmOverwrite = (name: string) => prompts.confirm(`Target "${name}" exists. Overwrite?`);

const connectDeps = {
  preflight: () => preflight(spawnRunner),
  loadTarget,
  resolve,
  exec: (t: ResolvedTarget) => runExec(t),
  saveTarget,
  confirmOverwrite,
  env,
  log,
};
const saveDeps = { resolve, loadTarget, saveTarget, confirmOverwrite, env, log };
const targetsDeps = {
  loadConfig: () => loadConfig(configPath),
  saveConfig: (c: ConfigFile) => saveConfig(configPath, c),
  log,
};

function connectFlags(opts: Record<string, string | undefined>): ResolveInput['flags'] {
  return {
    profile: opts.profile,
    region: opts.region,
    cluster: opts.cluster,
    service: opts.service,
    task: opts.task,
    container: opts.container,
    command: opts.command,
  };
}

function doctorDeps(opts: Record<string, string | undefined>) {
  const region = opts.region ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  const profile = opts.profile ?? env.AWS_PROFILE;
  const inspect = region
    ? (cluster: string, service: string) =>
        discovery.inspectExec(discovery.createEcsClient({ region, profile }), cluster, service)
    : undefined;
  return {
    hasBinary: (b: string) => commandExists(b, spawnRunner),
    checkCredentials: async (p?: string) =>
      spawnSync(
        'aws',
        ['sts', 'get-caller-identity', '--output', 'json', ...(p ? ['--profile', p] : [])],
        {
          stdio: 'ignore',
        },
      ).status === 0,
    inspect,
    log,
  };
}

export function extractTrailingCommand(argv: string[]): { argv: string[]; command?: string } {
  const i = argv.indexOf('--');
  if (i === -1) return { argv };
  const trailing = argv.slice(i + 1);
  return { argv: argv.slice(0, i), command: trailing.length ? trailing.join(' ') : undefined };
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('ecsh')
    .description('ssh for ECS — open an interactive shell in an ECS container')
    .version(pkg.version);

  const withConnectFlags = (c: Command) =>
    c
      .option('--profile <profile>', 'AWS profile')
      .option('--region <region>', 'AWS region')
      .option('--cluster <cluster>', 'ECS cluster')
      .option('--service <service>', 'ECS service')
      .option('--task <task>', 'ECS task id')
      .option('--container <container>', 'container name')
      .option('--command <command>', 'command to run (default /bin/bash)');

  // Default action: connect (optionally to a saved target name).
  withConnectFlags(program.argument('[name]', 'saved target name'))
    .option('--save <name>', 'connect and save as a target')
    .action(async (name: string | undefined, opts: Record<string, string | undefined>) => {
      const flags = connectFlags(opts);
      process.exitCode = await runConnect({ name, flags, saveAs: opts.save }, connectDeps);
    });

  withConnectFlags(
    program.command('save <name>').description('run the wizard and save a target'),
  ).action(async (name: string, opts: Record<string, string | undefined>) => {
    const flags = connectFlags(opts);
    process.exitCode = await runSave(name, flags, saveDeps);
  });

  program
    .command('ls')
    .description('list saved targets')
    .action(() => {
      process.exitCode = runList(targetsDeps);
    });

  program
    .command('rm <name>')
    .description('delete a saved target')
    .action((name: string) => {
      process.exitCode = runRemove(name, targetsDeps);
    });

  program
    .command('doctor')
    .description('diagnose the ECS Exec environment')
    .option('--profile <profile>', 'AWS profile')
    .option('--region <region>', 'AWS region')
    .option('--cluster <cluster>', 'ECS cluster')
    .option('--service <service>', 'ECS service')
    .action(async (opts: Record<string, string | undefined>) => {
      process.exitCode = await runDoctor(opts, doctorDeps(opts));
    });

  return program;
}

export async function main(argv: string[]): Promise<void> {
  const { argv: cleaned, command } = extractTrailingCommand(argv);
  const finalArgv = command !== undefined ? [...cleaned, '--command', command] : cleaned;
  await buildProgram().parseAsync(finalArgv);
}
