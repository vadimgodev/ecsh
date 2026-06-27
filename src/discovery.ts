import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  ListTasksCommand,
} from '@aws-sdk/client-ecs';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

export function createEcsClient(opts: { region: string; profile?: string }): ECSClient {
  return new ECSClient({
    region: opts.region,
    credentials: opts.profile ? fromNodeProviderChain({ profile: opts.profile }) : undefined,
  });
}

function shortName(arn: string): string {
  return arn.includes('/') ? (arn.split('/').pop() ?? arn) : arn;
}

async function collectAll<T>(
  page: (token?: string) => Promise<{ items: T[]; next?: string }>,
): Promise<T[]> {
  const out: T[] = [];
  let token: string | undefined;
  do {
    const { items, next } = await page(token);
    out.push(...items);
    token = next;
  } while (token);
  return out;
}

export async function listClusters(client: ECSClient): Promise<string[]> {
  const arns = await collectAll(async (t) => {
    const r = await client.send(new ListClustersCommand({ nextToken: t }));
    return { items: r.clusterArns ?? [], next: r.nextToken };
  });
  return arns.map(shortName);
}

export async function listServices(client: ECSClient, cluster: string): Promise<string[]> {
  const arns = await collectAll(async (t) => {
    const r = await client.send(new ListServicesCommand({ cluster, nextToken: t }));
    return { items: r.serviceArns ?? [], next: r.nextToken };
  });
  return arns.map(shortName);
}

export async function listTasks(
  client: ECSClient,
  cluster: string,
  service: string,
): Promise<string[]> {
  const arns = await collectAll(async (t) => {
    const r = await client.send(
      new ListTasksCommand({
        cluster,
        serviceName: service,
        desiredStatus: 'RUNNING',
        nextToken: t,
      }),
    );
    return { items: r.taskArns ?? [], next: r.nextToken };
  });
  return arns.map(shortName);
}

export async function listContainers(
  client: ECSClient,
  cluster: string,
  task: string,
): Promise<string[]> {
  const r = await client.send(new DescribeTasksCommand({ cluster, tasks: [task] }));
  return (r.tasks?.[0]?.containers ?? []).map((c) => c.name ?? '').filter(Boolean);
}

export async function getServiceExecInfo(
  client: ECSClient,
  cluster: string,
  service: string,
): Promise<{ enabled: boolean; runningCount: number }> {
  const r = await client.send(new DescribeServicesCommand({ cluster, services: [service] }));
  const s = r.services?.[0];
  return { enabled: Boolean(s?.enableExecuteCommand), runningCount: s?.runningCount ?? 0 };
}

export async function getTaskAgentRunning(
  client: ECSClient,
  cluster: string,
  task: string,
): Promise<boolean> {
  const r = await client.send(new DescribeTasksCommand({ cluster, tasks: [task] }));
  const agents = r.tasks?.[0]?.containers?.flatMap((c) => c.managedAgents ?? []) ?? [];
  return agents.find((a) => a.name === 'ExecuteCommandAgent')?.lastStatus === 'RUNNING';
}

export async function inspectExec(
  client: ECSClient,
  cluster: string,
  service: string,
): Promise<{ enabled: boolean; runningCount: number; agentRunning: boolean | null }> {
  const info = await getServiceExecInfo(client, cluster, service);
  let agentRunning: boolean | null = null;
  if (info.runningCount > 0) {
    const tasks = await listTasks(client, cluster, service);
    if (tasks[0]) agentRunning = await getTaskAgentRunning(client, cluster, tasks[0]);
  }
  return { ...info, agentRunning };
}
