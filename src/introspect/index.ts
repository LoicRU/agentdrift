import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Runtime } from '../core/types.js';
import { parseMakeTargets } from './make.js';

export interface NodeScope {
  dir: string;
  scripts: string[];
}

export interface DeclaredVersion {
  version: string;
  /** true = version épinglée ; false = minimum (engines, requires-python, go.mod) */
  exact: boolean;
  source: string;
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
];

const firstVersion = (s: string) => /\d+(?:\.\d+)*/.exec(s)?.[0];

export class Repo {
  private cache = new Map<string, unknown>();
  constructor(readonly root: string) {}

  private memo<T>(key: string, fn: () => T): T {
    if (!this.cache.has(key)) this.cache.set(key, fn());
    return this.cache.get(key) as T;
  }

  /** Dossiers de `fileDir` jusqu'à la racine (inclus), du plus proche au plus lointain. */
  chain(fileDir: string): string[] {
    const out: string[] = [];
    let cur = path.resolve(this.root, fileDir);
    while (true) {
      out.push(cur);
      if (cur === this.root || path.dirname(cur) === cur) break;
      cur = path.dirname(cur);
    }
    return out;
  }

  /** Scripts npm : package.json le plus proche, puis ceux des dossiers parents. */
  nodeScopes(fileDir: string): NodeScope[] {
    return this.memo(`node:${fileDir}`, () =>
      this.chain(fileDir).flatMap((dir) => {
        const file = path.join(dir, 'package.json');
        if (!existsSync(file)) return [];
        try {
          const json = JSON.parse(readFileSync(file, 'utf8')) as {
            scripts?: Record<string, string>;
          };
          return [{ dir, scripts: Object.keys(json.scripts ?? {}) }];
        } catch {
          return [];
        }
      }),
    );
  }

  /** Cibles Makefile du dossier le plus proche qui en contient un, ou null. */
  makeTargets(fileDir: string): string[] | null {
    return this.memo(`make:${fileDir}`, () => {
      for (const dir of this.chain(fileDir)) {
        for (const name of ['Makefile', 'makefile', 'GNUmakefile']) {
          const file = path.join(dir, name);
          if (existsSync(file)) return parseMakeTargets(readFileSync(file, 'utf8'));
        }
      }
      return null;
    });
  }

  /** Un chemin existe s'il existe depuis la racine ou depuis le dossier du fichier. */
  pathExists(p: string, fileDir: string): boolean {
    const clean = p.replace(/\/+$/, '');
    return [this.root, path.resolve(this.root, fileDir)].some((base) => {
      try {
        return statSync(path.resolve(base, clean)) !== undefined;
      } catch {
        return false;
      }
    });
  }

  /** Existence relative au dossier du fichier uniquement (liens, imports). */
  existsFrom(fileDir: string, p: string): boolean {
    return existsSync(path.resolve(this.root, fileDir, p));
  }

  /** Gestionnaire de paquets du dépôt : champ `packageManager`, sinon lockfile unique. */
  packageManager(fileDir: string): { pm: PackageManager; source: string } | null {
    return this.memo(`pm:${fileDir}`, () => {
      for (const dir of this.chain(fileDir)) {
        const pkg = path.join(dir, 'package.json');
        if (existsSync(pkg)) {
          try {
            const j = JSON.parse(readFileSync(pkg, 'utf8')) as { packageManager?: string };
            const name = j.packageManager?.split('@')[0] as PackageManager | undefined;
            if (name && LOCKFILES.some(([, pm]) => pm === name)) {
              return { pm: name, source: 'package.json "packageManager"' };
            }
          } catch {
            /* ignoré */
          }
        }
        const locks = LOCKFILES.filter(([f]) => existsSync(path.join(dir, f)));
        const pms = new Set(locks.map(([, pm]) => pm));
        if (pms.size === 1 && locks[0]) return { pm: locks[0][1], source: locks[0][0] };
        if (pms.size > 1) return null; // ambigu : on ne dit rien
      }
      return null;
    });
  }

  /** Version déclarée d'un runtime (.nvmrc, .tool-versions, engines, go.mod…). */
  declaredVersion(runtime: Runtime, fileDir: string): DeclaredVersion | null {
    return this.memo(`ver:${runtime}:${fileDir}`, () => {
      const read = (dir: string, name: string) => {
        const f = path.join(dir, name);
        return existsSync(f) ? readFileSync(f, 'utf8') : null;
      };
      const toolNames = { node: ['nodejs', 'node'], python: ['python'], go: ['golang', 'go'] }[
        runtime
      ];
      for (const dir of this.chain(fileDir)) {
        const files =
          runtime === 'node'
            ? ['.nvmrc', '.node-version']
            : runtime === 'python'
              ? ['.python-version']
              : [];
        for (const name of files) {
          const v = firstVersion(read(dir, name) ?? '');
          if (v) return { version: v, exact: true, source: name };
        }
        for (const line of (read(dir, '.tool-versions') ?? '').split('\n')) {
          const [tool, ver] = line.trim().split(/\s+/);
          const v = tool && toolNames.includes(tool) ? firstVersion(ver ?? '') : undefined;
          if (v) return { version: v, exact: true, source: '.tool-versions' };
        }
        if (runtime === 'node') {
          try {
            const j = JSON.parse(read(dir, 'package.json') ?? 'null') as {
              engines?: { node?: string };
            } | null;
            const v = firstVersion(j?.engines?.node ?? '');
            if (v) return { version: v, exact: false, source: 'package.json "engines"' };
          } catch {
            /* ignoré */
          }
        }
        if (runtime === 'python') {
          const m = /requires-python\s*=\s*"([^"]+)"/.exec(read(dir, 'pyproject.toml') ?? '');
          const v = firstVersion(m?.[1] ?? '');
          if (v) return { version: v, exact: false, source: 'pyproject.toml "requires-python"' };
        }
        if (runtime === 'go') {
          const m = /^go\s+(\d+\.\d+(?:\.\d+)?)/m.exec(read(dir, 'go.mod') ?? '');
          if (m?.[1]) return { version: m[1], exact: false, source: 'go.mod' };
        }
      }
      return null;
    });
  }
}
