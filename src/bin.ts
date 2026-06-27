// CLI entry point. This module is only ever executed (it is the `bin`), never
// imported as a library, so it runs main() unconditionally — no fragile
// import.meta.url/argv[1] guard that breaks when invoked through a symlink
// (which is how global installs and npx run the binary).
import { main } from './cli';

main(process.argv).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
