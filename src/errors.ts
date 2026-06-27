export interface MappedError {
  message: string;
  hint?: string;
  exitCode: number;
}

export interface ErrorContext {
  profile?: string;
  service?: string;
}

export const ERROR_LINKS = {
  cli: 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html',
  smp: 'https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html',
  exec: 'https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html',
};

interface Norm {
  name: string;
  message: string;
}

function normalize(err: unknown): Norm {
  if (typeof err === 'string') return { name: '', message: err };
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown };
    return { name: String(e.name ?? ''), message: String(e.message ?? '') };
  }
  return { name: '', message: String(err) };
}

export function mapError(err: unknown, ctx: ErrorContext = {}): MappedError {
  const { name, message } = normalize(err);
  const hay = `${name} ${message}`;

  if (/sso/i.test(hay) && /(expire|invalid|login)/i.test(hay)) {
    return {
      message: 'Your AWS SSO session has expired.',
      hint: `Run: aws sso login${ctx.profile ? ` --profile ${ctx.profile}` : ''}`,
      exitCode: 1,
    };
  }
  if (/ExpiredToken/i.test(name) || /token.*expired/i.test(message)) {
    return {
      message: 'Your AWS credentials have expired.',
      hint: ctx.profile
        ? `Run: aws sso login --profile ${ctx.profile}`
        : 'Refresh your AWS credentials.',
      exitCode: 1,
    };
  }
  if (/AccessDenied/i.test(name)) {
    return {
      message: 'Access denied for ECS Exec.',
      hint: `Caller needs ecs:ExecuteCommand; the task role needs ssmmessages:* permissions. See ${ERROR_LINKS.exec}`,
      exitCode: 1,
    };
  }
  if (/TargetNotConnected/i.test(hay)) {
    return {
      message: "The task's exec agent isn't ready.",
      hint: 'It likely needs a restart after enabling ECS Exec.',
      exitCode: 1,
    };
  }
  if (/execute command was not enabled/i.test(message) || /enableExecuteCommand/i.test(hay)) {
    return {
      message: "ECS Exec isn't enabled for this service.",
      hint: 'Enable it: aws ecs update-service --enable-execute-command --force-new-deployment ... (tasks must restart).',
      exitCode: 1,
    };
  }
  if (/session-?manager-?plugin/i.test(hay)) {
    return {
      message: 'The Session Manager plugin is required.',
      hint: `Install it → ${ERROR_LINKS.smp}`,
      exitCode: 1,
    };
  }
  return { message: message || 'Unexpected error.', exitCode: 1 };
}

export function formatError(m: MappedError): string {
  return m.hint ? `${m.message}\n  → ${m.hint}` : m.message;
}
