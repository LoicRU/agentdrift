import type { Code, InlineCode, Link, Root, RootContent } from 'mdast';
import type {
  Extracted,
  ExtractedCommand,
  ExtractedPath,
  Tool,
} from '../core/types.js';
import { parseMarkdown } from './markdown.js';

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'console', 'powershell', 'zsh']);
const TOOLS: Record<string, Tool> = {
  npm: 'npm', pnpm: 'pnpm', yarn: 'yarn', bun: 'bun', make: 'make', just: 'just',
  pip: 'pip', uv: 'uv', poetry: 'poetry', cargo: 'cargo', go: 'go',
};
const PLACEHOLDER = /[<>{}$*[\]]|\.\.\./;
const EXAMPLE_PREFIX = /(par exemple|for example|e\.g\.|example)\s*:?\s*$/i;
const PATH_RE = /^(?:\.{1,2}\/)?(?:[\w.@-]+\/)+[\w.@-]*$|^[\w.@-]+\.(?:md|json|ya?ml|toml|ts|tsx|js|jsx|mjs|cjs|py|rs|go|sh|mdc|lock)$/;

/** Analyse une ligne de commande. Retourne null si ce n'est pas une commande reconnue. */
export function parseCommand(raw: string): Pick<ExtractedCommand, 'tool' | 'script'> | null {
  const line = raw.trim().replace(/^[$>]\s+/, '');
  if (!line || PLACEHOLDER.test(line)) return null;
  const [bin, ...args] = line.split(/\s+/);
  const tool = bin ? TOOLS[bin] : undefined;
  if (!tool || !bin) return null;
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
  const result: Extracted = { commands: [], paths: [], links: [] };

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

    if (node.type === 'inlineCode') {
      const value = (node as InlineCode).value;
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
