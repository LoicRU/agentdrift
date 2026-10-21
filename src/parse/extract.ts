import type { Code, InlineCode, Link, Root, RootContent } from 'mdast';
import type {
  Extracted,
  ExtractedCommand,
  ExtractedPath,
  ExtractedVersion,
  Runtime,
  Tool,
} from '../core/types.js';
import { parseMarkdown } from './markdown.js';

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'console', 'powershell', 'zsh']);
const TOOLS: Record<string, Tool> = {
  npm: 'npm',
  pnpm: 'pnpm',
  yarn: 'yarn',
  bun: 'bun',
  make: 'make',
  just: 'just',
  pip: 'pip',
  uv: 'uv',
  poetry: 'poetry',
  cargo: 'cargo',
  go: 'go',
};
const PLACEHOLDER = /[<>{}$*[\]]|\.\.\./;
const EXAMPLE_PREFIX = /(par exemple|for example|e\.g\.|example)\s*:?\s*$/i;
/** Chemin avec au moins un `/`, qui finit par `/` ou par un nom avec extension. Pas de `@scope/pkg`. */
const PATH_RE = /^(?:\.{1,2}\/)?(?:[\w.-]+\/)+(?:[\w.-]+\.\w+|)$/;

const VERSION_RE =
  /\b([Nn]ode(?:\.js)?|NodeJS|Python|Golang|Go)\s+(?:(≥|>=)\s*)?v?(\d+(?:\.\d+){0,2})(\+)?/g;
const IMPORT_RE = /^@(\S+)/;

function runtimeOf(name: string): Runtime {
  if (/^python$/i.test(name)) return 'python';
  if (/^go/i.test(name)) return 'go';
  return 'node';
}

function position(start: { line: number; column: number }, value: string, idx: number) {
  const before = value.slice(0, idx);
  const nl = before.split('\n').length - 1;
  const col = nl === 0 ? start.column + idx : idx - before.lastIndexOf('\n');
  return { line: start.line + nl, column: col };
}

function scanVersions(
  value: string,
  start: { line: number; column: number },
  out: ExtractedVersion[],
): void {
  for (const m of value.matchAll(VERSION_RE)) {
    const runtime = runtimeOf(m[1] ?? '');
    const version = m[3] ?? '';
    if (runtime === 'go' && !version.includes('.')) continue; // "Go 2 steps"
    out.push({
      runtime,
      version,
      orMore: Boolean(m[2] || m[4]),
      raw: m[0],
      ...position(start, value, m.index ?? 0),
    });
  }
}

/** Analyse une ligne de commande. Retourne null si ce n'est pas une commande reconnue. */
export function parseCommand(raw: string): Pick<ExtractedCommand, 'tool' | 'script'> | null {
  const line = raw.trim().replace(/^[$>]\s+/, '');
  if (!line || PLACEHOLDER.test(line)) return null;
  const [bin, ...args] = line.split(/\s+/);
  const tool = bin ? TOOLS[bin] : undefined;
  if (!tool || !bin) return null;
  if (args[0] === '=' || args[0] === '==') return null; // "npm = ..." : affectation, pas une commande
  // -w/--workspace/--filter/--prefix : le script vit dans un autre package, on s'abstient
  if (
    args.some((a) =>
      /^(-w|-F|-C|--workspaces?(=.*)?|--filter(=.*)?|--prefix(=.*)?|--cwd(=.*)?)$/.test(a),
    )
  ) {
    return { tool };
  }
  const rest = args.filter((a) => !a.startsWith('-'));
  const first = rest[0];

  switch (tool) {
    case 'npm':
      if (first === 'run' || first === 'run-script') return { tool, script: rest[1] };
      if (first === 'test' || first === 'start') return { tool, script: first };
      return { tool };
    case 'pnpm':
    case 'yarn':
    case 'bun':
      if (first === 'run') return { tool, script: rest[1] };
      if (first === 'test' || first === 'start') return { tool, script: first };
      return { tool };
    case 'make':
    case 'just':
      return first ? { tool, script: first } : { tool };
    default:
      return { tool };
  }
}

function lineCmds(
  text: string,
  baseLine: number,
  baseCol: number,
  confidence: 'high' | 'medium',
): ExtractedCommand[] {
  const out: ExtractedCommand[] = [];
  text.split('\n').forEach((l, i) => {
    const parsed = parseCommand(l);
    if (parsed) {
      out.push({
        raw: l.trim(),
        ...parsed,
        line: baseLine + i,
        column: i === 0 ? baseCol : 1,
        confidence,
      });
    }
  });
  return out;
}

function walk(node: RootContent | Root, visit: (n: RootContent, prev?: RootContent) => void): void {
  const children = (node as { children?: RootContent[] }).children;
  if (!children) return;
  children.forEach((child, i) => {
    visit(child, children[i - 1]);
    walk(child, visit);
  });
}

export function extract(content: string): Extracted {
  const tree = parseMarkdown(content);
  const lines = content.split('\n');
  const result: Extracted = { commands: [], paths: [], links: [], imports: [], versions: [] };

  walk(tree, (node) => {
    const pos = node.position;
    if (!pos) return;
    const { line, column } = pos.start;

    if (node.type === 'code') {
      const lang = (node as Code).lang?.toLowerCase();
      if (lang && SHELL_LANGS.has(lang)) {
        // le contenu commence à la ligne suivant l'ouverture de la clôture
        result.commands.push(...lineCmds((node as Code).value, line + 1, 1, 'high'));
      }
      return;
    }

    if (node.type === 'text') {
      const value = (node as { value: string }).value;
      scanVersions(value, pos.start, result.versions);
      for (const m of value.matchAll(/(?:^|\n)(@\S+)/g)) {
        const target = IMPORT_RE.exec(m[1] ?? '')?.[1];
        const atStart = m.index === 0 && pos.start.column === 1;
        if (target && (atStart || m[0].startsWith('\n')) && /\.\w+$/.test(target)) {
          const idx = (m.index ?? 0) + (m[0].startsWith('\n') ? 1 : 0);
          result.imports.push({ target, ...position(pos.start, value, idx) });
        }
      }
      return;
    }

    if (node.type === 'inlineCode') {
      const value = (node as InlineCode).value;
      scanVersions(value, pos.start, result.versions);
      const before = (lines[line - 1] ?? '').slice(0, column - 1);
      if (EXAMPLE_PREFIX.test(before)) return;
      const cmds = lineCmds(value, line, column, 'medium');
      if (cmds.length) {
        result.commands.push(...cmds);
      } else if (!PLACEHOLDER.test(value) && PATH_RE.test(value)) {
        const p: ExtractedPath = { raw: value, line, column };
        result.paths.push(p);
      }
      return;
    }

    if (node.type === 'link') {
      const url = (node as Link).url;
      if (url && !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(url)) {
        result.links.push({ target: url, line, column });
      }
    }
  });

  return result;
}
