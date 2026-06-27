import { expect, test } from 'vitest';
import { CONFIG_VERSION, DEFAULT_COMMAND } from '../src/types';

test('foundation constants are defined', () => {
  expect(CONFIG_VERSION).toBe(1);
  expect(DEFAULT_COMMAND).toBe('/bin/bash');
});
