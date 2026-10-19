import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { CONFIG_FILE, ConfigError, loadConfig } from './core/config.js';
import { check, exceeds } from './core/engine.js';
import { formatGithub } from './report/github.js';
import { formatText } from './report/text.js';
import { rules } from './rules/index.js';

const VERSION = '0.0.1';
const list = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);
const LEVELS = ['error', 'warn', 'info'] as const;
type Level = (typeof LEVELS)[number];

const program = new Command();
program.name('agentdrift').description('Check that agent instructions match your repo').version(VERSION);

program
  .command('check [dir]')
  .description("Vérifie que les fichiers d'agents correspondent au dépôt")
  .option('--format <fmt>', 'text | json | github', 'text')
  .option('--fail-on <level>', 'error | warn | info (défaut: config ou error)')
  .option('--rule <ids>', 'exécuter seulement ces règles (ex: AD001,AD002)', list)
  .option('--ignore-rule <ids>', 'désactiver ces règles', list)
  .option('--config <file>', 'chemin vers un fichier de config')
  .action(
    async (
      dir: string | undefined,
      opts: { format: string; failOn?: string; rule?: string[]; ignoreRule?: string[]; config?: string },
    ) => {
      const root = path.resolve(dir ?? '.');
      if (!['text', 'json', 'github'].includes(opts.format)) {
        throw new ConfigError(`Unknown format "${opts.format}" (text | json | github).`);
      }
      if (opts.failOn && !LEVELS.includes(opts.failOn as Level)) {
        throw new ConfigError(`Invalid --fail-on "${opts.failOn}" (error | warn | info).`);
      }
      const known = new Set(rules.map((r) => r.id));
      for (const id of [...(opts.rule ?? []), ...(opts.ignoreRule ?? [])]) {
        if (!known.has(id.toUpperCase())) throw new ConfigError(`Unknown rule "${id}". See: agentdrift list-rules`);
      }
      const config = loadConfig(root, opts.config);
      const findings = await check(root, { config, only: opts.rule, skip: opts.ignoreRule });
      const out =
        opts.format === 'json'
          ? JSON.stringify(findings, null, 2)
          : opts.format === 'github'
            ? formatGithub(findings)
            : formatText(findings);
      if (out) console.log(out);
      process.exitCode = exceeds(findings, (opts.failOn as Level | undefined) ?? config.failOn) ? 1 : 0;
    },
  );

program
  .command('list-rules')
  .description('Liste les règles disponibles')
  .action(() => {
    for (const r of rules) console.log(`${r.id}  ${r.defaultSeverity.padEnd(5)}  ${r.name}`);
  });

program
  .command('explain <id>')
  .description('Explique une règle')
  .action((id: string) => {
    const r = rules.find((x) => x.id === id.toUpperCase());
    if (!r) throw new ConfigError(`Unknown rule "${id}". See: agentdrift list-rules`);
    console.log(`${r.id} ${r.name} (default: ${r.defaultSeverity})\n\n${r.description}`);
    console.log(`\nDisable on one line:  <!-- agentdrift-disable-next-line ${r.id} -->`);
    console.log(`Disable globally:     { "rules": { "${r.id}": "off" } } in ${CONFIG_FILE}`);
  });

program
  .command('init [dir]')
  .description(`Crée un ${CONFIG_FILE} minimal`)
  .action((dir: string | undefined) => {
    const file = path.join(path.resolve(dir ?? '.'), CONFIG_FILE);
    if (existsSync(file)) throw new ConfigError(`${CONFIG_FILE} already exists.`);
    writeFileSync(file, `${JSON.stringify({ ignorePaths: [], rules: {}, failOn: 'error' }, null, 2)}\n`);
    console.log(`Created ${CONFIG_FILE}`);
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
