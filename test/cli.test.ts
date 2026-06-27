import { describe, expect, it } from 'vitest';
import { buildProgram, extractTrailingCommand } from '../src/cli';

describe('buildProgram', () => {
  it('registers the reserved subcommands', () => {
    const names = buildProgram().commands.map((c) => c.name());
    expect(names).toEqual(expect.arrayContaining(['save', 'ls', 'rm', 'doctor']));
  });

  it('is named ecsh', () => {
    expect(buildProgram().name()).toBe('ecsh');
  });
});

describe('extractTrailingCommand', () => {
  it('extracts a single token after --', () => {
    expect(extractTrailingCommand(['node', 'cli', '--', '/bin/sh'])).toEqual({
      argv: ['node', 'cli'],
      command: '/bin/sh',
    });
  });

  it('joins multiple tokens after -- into a single string', () => {
    expect(extractTrailingCommand(['node', 'cli', 'prod', '--', '/bin/sh', '-c', 'x'])).toEqual({
      argv: ['node', 'cli', 'prod'],
      command: '/bin/sh -c x',
    });
  });

  it('returns argv unchanged and command undefined when -- is absent', () => {
    expect(extractTrailingCommand(['node', 'cli', 'prod'])).toEqual({
      argv: ['node', 'cli', 'prod'],
      command: undefined,
    });
  });
});
