import { describe, expect, it } from 'vitest';
import { extract, parseCommand } from '../src/parse/extract.js';

describe('parseCommand', () => {
  it.each([
    ['npm run test:unit', 'npm', 'test:unit'],
    ['npm test', 'npm', 'test'],
    ['pnpm run build', 'pnpm', 'build'],
    ['make lint', 'make', 'lint'],
    ['$ just dev', 'just', 'dev'],
  ])('%s', (raw, tool, script) => {
    expect(parseCommand(raw)).toEqual({ tool, script });
  });

  it.each(['npm run <name>', 'echo hi', 'npm run $SCRIPT', 'make {{x}}'])('ignore %s', (raw) => {
    expect(parseCommand(raw)).toBeNull();
  });
});

describe('extract', () => {
  const md = [
    '# Doc',
    '',
    'Lancer `npm run test:unit` puis voir `src/legacy/`.',
    'Par exemple : `npm run foo`',
    '',
    '```bash',
    'pnpm install',
    'make build',
    '```',
    '',
    '```text',
    'npm run ignored',
    '```',
    '',
    'Voir [guide](docs/guide.md) et [site](https://x.dev) et [ancre](#a).',
  ].join('\n');

  const r = extract(md);

  it('extrait les commandes inline et bloc avec les bonnes lignes', () => {
    expect(r.commands.map((c) => [c.raw, c.line, c.confidence])).toEqual([
      ['npm run test:unit', 3, 'medium'],
      ['pnpm install', 7, 'high'],
      ['make build', 8, 'high'],
    ]);
  });

  it('extrait les chemins', () => {
    expect(r.paths.map((p) => p.raw)).toEqual(['src/legacy/']);
  });

  it('extrait seulement les liens relatifs', () => {
    expect(r.links.map((l) => l.target)).toEqual(['docs/guide.md']);
  });
});
