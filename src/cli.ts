import { Command } from 'commander';
import { check } from './core/engine.js';
import { formatText } from './report/text.js';

const program = new Command();
program.name('agentdrift').description('Check that agent instructions match your repo').version('0.0.1');

program
  .command('check [dir]')
  .description('Vérifie que les fichiers d\'agents correspondent au dépôt')
  .option('--format <fmt>', 'text | json', 'text')
  .action(async (dir: string | undefined, opts: { format: string }) => {
    const findings = await check(dir ?? '.');
    console.log(opts.format === 'json' ? JSON.stringify(findings, null, 2) : formatText(findings));
    process.exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
