import { afterEach, describe, expect, it } from 'vitest';
import { filterChoices, isInteractive } from '../src/prompts';

describe('prompts helpers', () => {
  it('filters choices case-insensitively by substring', () => {
    expect(filterChoices(['web', 'batch', 'web-api'], 'web')).toEqual(['web', 'web-api']);
    expect(filterChoices(['Web', 'batch'], 'WEB')).toEqual(['Web']);
  });

  it('returns all choices for an empty term', () => {
    expect(filterChoices(['a', 'b'], '')).toEqual(['a', 'b']);
    expect(filterChoices(['a', 'b'], undefined)).toEqual(['a', 'b']);
  });

  const original = { in: process.stdin.isTTY, out: process.stdout.isTTY };
  afterEach(() => {
    process.stdin.isTTY = original.in;
    process.stdout.isTTY = original.out;
  });

  it('isInteractive reflects both streams being a TTY', () => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    expect(isInteractive()).toBe(true);
    process.stdin.isTTY = false;
    expect(isInteractive()).toBe(false);
  });
});
