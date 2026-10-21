import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Runtime } from '../core/types.js';
import { globToRegExp } from '../util/glob.js';
import { parseMakeIncludes, parseMakeTargets } from './make.js';

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

  /** Cibles Makefile du dossier le plus proche qui en contient un (en suivant les 'include'), ou null. */
  makeTargets(fileDir: string): string[] | null {
    return this.memo(`make:${fileDir}`, () => {
      for (const dir of this.chain(fileDir)) {
        for (const name of ['Makefile', 'makefile', 'GNUmakefile']) {
          const file = path.join(dir, name);
          if (existsSync(file)) return [...this.collectMakeTargets(file, new Set())];
        }
      }
      return null;
    });
  }

  private collectMakeTargets(file: string, seen: Set<string>): Set<string> {
    const targets = new Set<string>();
    if (seen.has(file)) return targets;
    seen.add(file);
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      return targets;
    }
    for (const t of parseMakeTargets(content)) targets.add(t);
    const dir = path.dirname(file);
    for (const inc of parseMakeIncludes(content)) {
      for (const t of this.collectMakeTargets(path.resolve(dir, inc), seen)) targets.add(t);
    }
    return targets;
  }

  /**
   * Tous les suffixes de chemins du dépôt ("a/b/c" => "c", "b/c", "a/b/c").
   * Permet de reconnaître "src/foo/" cité depuis packages/x/AGENTS.md pour packages/x/src/foo.
   */
  private suffixes(): Set<string> {
    return this.memo('suffixes', () => {
      const set = new Set<string>();
      const skip = new Set(['.git', 'node_modules', 'dist', 'build', 'target', '.venv', 'vendor']);
      let count = 0;
      const walk = (dir: string, rel: string[]): void => {
        if (count > 100_000) return;
        let entries: import('node:fs').Dirent[];
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const parts = [...rel, e.name];
          for (let i = 0; i < parts.length; i++) set.add(parts.slice(i).join('/'));
          count++;
          if (e.isDirectory() && !skip.has(e.name)) walk(path.join(dir, e.name), parts);
        }
      };
      walk(this.root, []);
      return set;
    });
  }

  /** Un chemin existe depuis la racine, depuis le dossier du fichier, ou comme suffixe d'un chemin du dépôt. */
  pathExists(p: string, fileDir: string): boolean {
    const clean = p.replace(/\/+$/, '').replace(/^\.\//, '');
    if (this.suffixes().has(clean)) return true;
    return [this.root, path.resolve(this.root, fileDir)].some((base) => {
      try {
        return statSync(path.resolve(base, clean)) !== undefined;
      } catch {
        return false;
      }
    });
  }

  /** Vrai si le chemin est couvert par un .gitignore (racine ou dossiers du fichier) : absence normale. */
  isGitignored(p: string, fileDir = ''): boolean {
    const clean = p.replace(/^\.\//, '').replace(/\/+$/, '');
    // tel qu'écrit, et résolu depuis la racine (chemin relatif au dossier du fichier)
    const variants = [clean, path.posix.join(fileDir, clean)].map((v) => v.split('/'));
    return this.chain(fileDir).some((dir) =>
      this.gitignoreMatchers(dir).some((m) => variants.some((segs) => m(segs))),
    );
  }

  private gitignoreMatchers(dir: string): ((segs: string[]) => boolean)[] {
    return this.memo(`gitignore:${dir}`, () => {
      const f = path.join(dir, '.gitignore');
      if (!existsSync(f)) return [];
      const out: ((segs: string[]) => boolean)[] = [];
      for (const raw of readFileSync(f, 'utf8').split('\n')) {
        let line = raw.trim();
        if (!line || line.startsWith('#') || line.startsWith('!')) continue;
        const anchored = line.startsWith('/') || line.replace(/\/$/, '').includes('/');
        line = line.replace(/^\//, '').replace(/\/$/, '');
        const re = globToRegExp(line);
        out.push((segs) =>
          anchored
            ? segs.some((_, i) => re.test(segs.slice(0, i + 1).join('/')))
            : segs.some((seg) => re.test(seg)),
        );
      }
      return out;
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
