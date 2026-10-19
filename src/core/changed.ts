import { execFileSync } from 'node:child_process';
import { ConfigError } from './config.js';

/** Fichiers qui servent de "source de vérité" : s'ils changent, tout le dépôt est revérifié. */
const TRUTH =
  /(^|\/)(package\.json|Makefile|makefile|GNUmakefile|pnpm-lock\.yaml|yarn\.lock|package-lock\.json|npm-shrinkwrap\.json|bun\.lockb?|\.nvmrc|\.node-version|\.python-version|\.tool-versions|pyproject\.toml|go\.mod|\.agentdrift\.json)$/;

/** Parse la sortie de `git diff --name-only` (un chemin par ligne). */
export function parseNameOnly(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

/** Retourne les chemins à vérifier, ou null = tout vérifier. */
export function selectFiles(agentFiles: string[], changed: string[]): string[] | null {
  if (changed.some((c) => TRUTH.test(c))) return null;
  const set = new Set(changed);
  return agentFiles.filter((f) => set.has(f));
}

/** Liste les fichiers modifiés depuis `base` (lecture seule : `git diff --name-only`). */
export function changedFiles(root: string, base: string): string[] {
  const run = (range: string) =>
    execFileSync('git', ['diff', '--name-only', '--relative', '--diff-filter=ACMRD', range], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    return parseNameOnly(run(`${base}...HEAD`));
  } catch {
    try {
      return parseNameOnly(run(base));
    } catch (e) {
      const msg =
        (e as { stderr?: Buffer | string }).stderr?.toString().trim() || (e as Error).message;
      throw new ConfigError(
        `--changed-only: cannot diff against "${base}" (${msg}). In CI, fetch full history (fetch-depth: 0).`,
      );
    }
  }
}
