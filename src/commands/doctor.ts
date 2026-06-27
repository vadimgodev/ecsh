import { ERROR_LINKS, formatError, mapError } from '../errors';

export interface DoctorFlags {
  profile?: string;
  region?: string;
  cluster?: string;
  service?: string;
}

export interface DoctorDeps {
  hasBinary(name: string): boolean;
  checkCredentials(profile?: string): Promise<boolean>;
  inspect?: (
    cluster: string,
    service: string,
  ) => Promise<{ enabled: boolean; runningCount: number; agentRunning: boolean | null }>;
  log(msg: string): void;
}

export async function runDoctor(flags: DoctorFlags, deps: DoctorDeps): Promise<number> {
  let ok = true;
  const line = (good: boolean, label: string, fix?: string) => {
    deps.log(`${good ? '✓' : '✗'} ${label}${!good && fix ? `\n  → ${fix}` : ''}`);
    if (!good) ok = false;
  };

  line(deps.hasBinary('aws'), 'AWS CLI installed', `Install AWS CLI v2 → ${ERROR_LINKS.cli}`);
  line(
    deps.hasBinary('session-manager-plugin'),
    'Session Manager plugin installed',
    `Install it → ${ERROR_LINKS.smp}`,
  );

  const creds = await deps.checkCredentials(flags.profile);
  line(
    creds,
    'AWS credentials resolve',
    flags.profile
      ? `Run: aws sso login --profile ${flags.profile}`
      : 'Configure AWS credentials or run: aws sso login',
  );

  if (flags.cluster && flags.service && deps.inspect && creds) {
    try {
      const info = await deps.inspect(flags.cluster, flags.service);
      line(
        info.enabled,
        `ECS Exec enabled on ${flags.service}`,
        'aws ecs update-service --enable-execute-command --force-new-deployment ... (tasks must restart)',
      );
      if (info.runningCount === 0) {
        line(
          false,
          `Service ${flags.service} has running tasks`,
          'Scale the service up so a task is running.',
        );
      } else if (info.agentRunning !== null) {
        line(
          info.agentRunning,
          'Exec agent is RUNNING on a task',
          'The task likely needs a restart after enabling exec.',
        );
      }
    } catch (e) {
      line(
        false,
        'Inspect service',
        formatError(mapError(e, { profile: flags.profile, service: flags.service })),
      );
    }
  }

  return ok ? 0 : 1;
}
