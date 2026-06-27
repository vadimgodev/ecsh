/** Default shell opened in the container when no command is given. */
export const DEFAULT_COMMAND = '/bin/bash';

/** On-disk config schema version (for forward-compatible migrations). */
export const CONFIG_VERSION = 1;

/** Stable coordinates of a saved target — never includes a task ID/ARN. */
export interface Target {
  profile?: string;
  region?: string;
  cluster?: string;
  service?: string;
  /** Optional — resolved at runtime if omitted. */
  container?: string;
  /** Optional — defaults to DEFAULT_COMMAND. */
  command?: string;
}

/** A fully resolved target ready to connect — all required fields present. */
export interface ResolvedTarget {
  /** undefined = "default credentials" (pass no --profile). */
  profile?: string;
  region: string;
  cluster: string;
  service: string;
  /** Live task ID resolved at connect time. */
  task: string;
  container: string;
  command: string;
}

/** Shape of `config.json`. */
export interface ConfigFile {
  version: number;
  targets: Record<string, Target>;
}
