import { describe, expect, it } from 'vitest';
import { ERROR_LINKS, formatError, mapError } from '../src/errors';

describe('mapError', () => {
  it('maps AccessDeniedException to an IAM hint', () => {
    const m = mapError({ name: 'AccessDeniedException', message: 'User is not authorized' });
    expect(m.message).toMatch(/Access denied/i);
    expect(m.hint).toContain('ecs:ExecuteCommand');
    expect(m.exitCode).toBe(1);
  });

  it('maps expired SSO sessions with a profile-specific login hint', () => {
    const m = mapError(
      { name: 'CredentialsProviderError', message: 'The SSO session has expired or is invalid' },
      { profile: 'prod' },
    );
    expect(m.hint).toBe('Run: aws sso login --profile prod');
  });

  it('maps "execute command was not enabled" from CLI stderr text', () => {
    const m = mapError('An error occurred: The execute command was not enabled for the task');
    expect(m.message).toMatch(/isn't enabled/i);
    expect(m.hint).toContain('--enable-execute-command');
  });

  it('maps TargetNotConnected to an agent-not-ready message', () => {
    const m = mapError({ name: 'TargetNotConnectedException', message: 'x' });
    expect(m.message).toMatch(/agent isn't ready/i);
  });

  it('maps a missing session-manager-plugin to an install link', () => {
    const m = mapError('SessionManagerPlugin is not found. Please install it');
    expect(m.hint).toContain(ERROR_LINKS.smp);
  });

  it('falls back to the raw message for unknown errors', () => {
    const m = mapError(new Error('boom'));
    expect(m).toEqual({ message: 'boom', exitCode: 1 });
  });

  it('formatError renders message and hint on two lines', () => {
    expect(formatError({ message: 'Bad', hint: 'Fix it', exitCode: 1 })).toBe('Bad\n  → Fix it');
    expect(formatError({ message: 'Bad', exitCode: 1 })).toBe('Bad');
  });
});
