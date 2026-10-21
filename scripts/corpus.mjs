#!/usr/bin/env node
// Calibration helper: runs agentdrift on a list of public repos and writes a report
// to review by hand. Repos are cloned (shallow) OUTSIDE this repo; nothing is copied here.
//
//   node scripts/corpus.mjs docs/corpus.txt          clone + check + write corpus-report.md
//   node scripts/corpus.mjs --local <dir>            check every sub-folder of <dir> (no clone)
//   node scripts/corpus.mjs --summarize corpus-report.md   false-positive rate per rule
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'dist', 'cli.js');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const out = flag('--out') ?? 'corpus-report.md';
const workdir = flag('--dir') ?? path.join(homedir(), 'agentdrift-corpus');

function summarize(file) {
  const text = readFileSync(file, 'utf8');
  const stats = {};
  for (const m of text.matchAll(/^- \[( |x|X)\] (AD\d{3}) /gm)) {
    stats[m[2]] = stats[m[2]] ?? { total: 0, fp: 0 };
    const s = stats[m[2]];
    s.total++;
    if (m[1] !== ' ') s.fp++;
  }
  console.log('Rule   findings  false positives  rate');
  for (const [id, s] of Object.entries(stats).sort()) {
    console.log(
      `${id}   ${String(s.total).padStart(8)}  ${String(s.fp).padStart(15)}  ${((100 * s.fp) / s.total).toFixed(1)}%`,
    );
  }
  console.log('\nTarget before publishing: < 10% on AD001 and AD002.');
}

function toUrl(entry) {
  return /^[\w.-]+\/[\w.-]+$/.test(entry) ? `https://github.com/${entry}` : entry;
}

function runCheck(dir) {
  try {
    return JSON.parse(
      execFileSync(process.execPath, [cli, 'check', dir, '--format', 'json'], { encoding: 'utf8' }),
    );
  } catch (e) {
    // exit code 1 = findings present; stdout still holds the JSON
    if (e.stdout) return JSON.parse(e.stdout);
    throw e;
  }
}

function sourceLine(dir, f) {
  try {
    return (
      readFileSync(path.join(dir, f.file), 'utf8').split('\n')[f.line - 1]?.trim().slice(0, 160) ??
      ''
    );
  } catch {
    return '';
  }
}

if (args[0] === '--summarize') {
  summarize(args[1] ?? out);
  process.exit(0);
}
if (!existsSync(cli)) {
  console.error('dist/cli.js not found: run "npm run build" first.');
  process.exit(2);
}

let repos; // [{ name, dir }]
if (args[0] === '--local') {
  const base = path.resolve(args[1] ?? workdir);
  repos = readdirSync(base)
    .filter((n) => statSync(path.join(base, n)).isDirectory())
    .map((n) => ({ name: n, dir: path.join(base, n) }));
} else {
  const list = args[0];
  if (!list) {
    console.error(
      'Usage: node scripts/corpus.mjs <list.txt> | --local <dir> | --summarize <report.md>',
    );
    process.exit(2);
  }
  mkdirSync(workdir, { recursive: true });
  repos = [];
  for (const raw of readFileSync(list, 'utf8').split('\n')) {
    const entry = raw.trim();
    if (!entry || entry.startsWith('#')) continue;
    const name = entry
      .replace(/^https?:\/\/[^/]+\//, '')
      .replace(/\.git$/, '')
      .replace(/\//g, '__');
    const dir = path.join(workdir, name);
    if (!existsSync(dir)) {
      console.log(`clone ${entry}`);
      try {
        execFileSync('git', ['clone', '--depth', '1', '--quiet', toUrl(entry), dir], {
          stdio: 'inherit',
        });
      } catch {
        console.error(`  failed, skipped: ${entry}`);
        continue;
      }
    }
    repos.push({ name, dir });
  }
}

const lines = [
  '# AgentDrift corpus review',
  '',
  'Mark a finding as a **false positive** by changing `[ ]` into `[x]`, then run:',
  '`node scripts/corpus.mjs --summarize corpus-report.md`',
  '',
];
const totals = {};
let withFiles = 0;
for (const { name, dir } of repos) {
  const findings = runCheck(dir);
  if (findings.length === 0) continue;
  withFiles++;
  lines.push(`## ${name}`, '');
  for (const f of findings) {
    totals[f.ruleId] = (totals[f.ruleId] ?? 0) + 1;
    const src = sourceLine(dir, f);
    lines.push(
      `- [ ] ${f.ruleId} ${f.file}:${f.line} — ${f.message}${src ? ` — \`${src.replace(/`/g, "'")}\`` : ''}`,
    );
  }
  lines.push('');
}
lines.splice(
  5,
  0,
  `Repos checked: ${repos.length} — with findings: ${withFiles}`,
  `Findings per rule: ${
    Object.entries(totals)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || 'none'
  }`,
  '',
);
writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`Report written to ${out} (${repos.length} repos, ${withFiles} with findings).`);
