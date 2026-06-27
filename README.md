# ecsh

**ssh for ECS** — open an interactive shell in an AWS ECS container without copying
ARNs or remembering the long `aws ecs execute-command` invocation.

```bash
npx @vadimgodev/ecsh   # interactive wizard: profile → cluster → service → task → container → shell
```

## Prerequisites

`ecsh` discovers resources with the AWS SDK but delegates the interactive shell to the
AWS CLI, so two external tools must be installed:

1. **AWS CLI v2** — https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
2. **Session Manager plugin** — https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html

| OS | AWS CLI v2 | Session Manager plugin |
|---|---|---|
| macOS | `brew install awscli` | `brew install --cask session-manager-plugin` |
| Linux | bundled installer (see link) | `.deb`/`.rpm` or bundled installer (see link) |
| Windows | MSI installer (see link) | MSI installer (see link) |

Run `ecsh doctor` to check your environment.

## Install

```bash
npx @vadimgodev/ecsh        # no install
npm i -g @vadimgodev/ecsh   # global install (provides the `ecsh` command)
```

Requires Node.js ≥ 22.

## Usage

```bash
ecsh                              # interactive wizard
ecsh --cluster web --service api  # pre-fill steps with flags
ecsh -- /bin/sh                   # choose the command after --

ecsh save prod-api                # run the wizard, save coordinates (no connect)
ecsh prod-api                     # connect to a saved target (resolves the live task)
ecsh prod-api --container worker  # recall a target but override one field
ecsh --save prod-api              # connect now AND remember it

ecsh ls                           # list saved targets
ecsh rm prod-api                  # delete a saved target
ecsh doctor                       # diagnose why exec might fail
```

Flags: `--profile`, `--region`, `--cluster`, `--service`, `--task`, `--container`,
`--command` (or a trailing `-- <cmd…>`).

### Precedence

- General fields: `flag > saved target > prompt` (command also falls back to `/bin/bash`).
- `profile`: `--profile > target > $AWS_PROFILE > pick`.
- `region`: `--region > target > $AWS_REGION / $AWS_DEFAULT_REGION > profile default > pick`.

A saved target is self-contained: `ecsh prod-api` hits prod even if `AWS_PROFILE=staging`.
A target never stores a task — it resolves the live running task at connect time, so it
never goes stale across deploys.

## Configuration

Saved targets live in a JSON file resolved via XDG / `env-paths`
(`~/.config/ecsh/config.json` on Linux, `%APPDATA%\ecsh\config.json` on Windows). It is
machine-written by `ecsh save` but safe to hand-edit.

## License

MIT © Vadim Goncharov
