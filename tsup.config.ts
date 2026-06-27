import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  splitting: false,
  clean: true,
  dts: false,
  minify: false,
  banner: { js: '#!/usr/bin/env node' },
});
