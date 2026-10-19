import path from 'node:path';
import { Command } from 'commander';
import { discover } from './discover/index.js';
import { extract } from './parse/extract.js';

const VERSION = '0.0.1';
const program = new Command();

program.name('agentdrift').description('Check that agent instructions match your repo').version(VERSION);

program
  .command('check [dir]')
  .description('Découvre les fichiers d\'agents et affiche ce qui y est extrait (M1)')
  .option('--json', 'sortie JSON')
  .action(async (dir: string | undefined, opts: { json?: boolean }) => {
    const root = path.resolve(dir ?? '.');
    const files = await discover(root);
    const report = files.map((f) => ({ file: f.path, ...extract(f.content) }));
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    if (files.length === 0) console.log('Aucun fichier d\'agent trouvé.');
    for (const r of report) {
      console.log(`${r.file}`);
      for (const c of r.commands) console.log(`  ${r.file}:${c.line}  cmd   ${c.raw}`);
      for (const p of r.paths) console.log(`  ${r.file}:${p.line}  path  ${p.raw}`);
      for (const l of r.links) console.log(`  ${r.file}:${l.line}  link  ${l.target}`);
    }
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
