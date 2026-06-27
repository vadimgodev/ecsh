import { confirm as confirmPrompt, input, search } from '@inquirer/prompts';

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function filterChoices(choices: string[], term: string | undefined): string[] {
  if (!term) return choices;
  const needle = term.toLowerCase();
  return choices.filter((c) => c.toLowerCase().includes(needle));
}

export function selectFuzzy(opts: { message: string; choices: string[] }): Promise<string> {
  return search({
    message: opts.message,
    source: (term) => filterChoices(opts.choices, term).map((c) => ({ value: c, name: c })),
  });
}

export function inputText(opts: { message: string; default?: string }): Promise<string> {
  return input({ message: opts.message, default: opts.default });
}

export function confirm(message: string): Promise<boolean> {
  return confirmPrompt({ message, default: false });
}
