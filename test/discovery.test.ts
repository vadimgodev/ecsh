import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  ListClustersCommand,
  ListTasksCommand,
} from '@aws-sdk/client-ecs';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getServiceExecInfo,
  inspectExec,
  listClusters,
  listContainers,
  listTasks,
} from '../src/discovery';

const ecs = mockClient(ECSClient);
afterEach(() => ecs.reset());

describe('discovery', () => {
  it('lists clusters across pages and returns short names', async () => {
    ecs
      .on(ListClustersCommand, { nextToken: undefined })
      .resolves({ clusterArns: ['arn:aws:ecs:us-east-1:1:cluster/web'], nextToken: 't' })
      .on(ListClustersCommand, { nextToken: 't' })
      .resolves({ clusterArns: ['arn:aws:ecs:us-east-1:1:cluster/batch'] });
    expect(await listClusters(ecs as unknown as ECSClient)).toEqual(['web', 'batch']);
  });

  it('lists only RUNNING tasks for a service', async () => {
    ecs.on(ListTasksCommand).resolves({
      taskArns: ['arn:aws:ecs:us-east-1:1:task/web/abc123'],
    });
    expect(await listTasks(ecs as unknown as ECSClient, 'web', 'api')).toEqual(['abc123']);
    expect(ecs.commandCalls(ListTasksCommand)[0].args[0].input).toMatchObject({
      cluster: 'web',
      serviceName: 'api',
      desiredStatus: 'RUNNING',
    });
  });

  it('lists container names from DescribeTasks', async () => {
    ecs.on(DescribeTasksCommand).resolves({
      tasks: [{ containers: [{ name: 'app' }, { name: 'sidecar' }] }],
    });
    expect(await listContainers(ecs as unknown as ECSClient, 'web', 'abc123')).toEqual([
      'app',
      'sidecar',
    ]);
  });

  it('reads enableExecuteCommand and runningCount', async () => {
    ecs.on(DescribeServicesCommand).resolves({
      services: [{ enableExecuteCommand: true, runningCount: 2 }],
    });
    expect(await getServiceExecInfo(ecs as unknown as ECSClient, 'web', 'api')).toEqual({
      enabled: true,
      runningCount: 2,
    });
  });

  it('inspectExec composes service + agent status', async () => {
    ecs.on(DescribeServicesCommand).resolves({
      services: [{ enableExecuteCommand: true, runningCount: 1 }],
    });
    ecs.on(ListTasksCommand).resolves({ taskArns: ['arn:aws:ecs:us-east-1:1:task/web/abc'] });
    ecs.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          containers: [{ managedAgents: [{ name: 'ExecuteCommandAgent', lastStatus: 'RUNNING' }] }],
        },
      ],
    });
    expect(await inspectExec(ecs as unknown as ECSClient, 'web', 'api')).toEqual({
      enabled: true,
      runningCount: 1,
      agentRunning: true,
    });
  });
});
