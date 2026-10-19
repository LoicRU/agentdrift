export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
  suggestion?: string;
  docsUrl?: string;
}

export type Tool =
  | 'npm' | 'pnpm' | 'yarn' | 'bun' | 'make' | 'just'
  | 'pip' | 'uv' | 'poetry' | 'cargo' | 'go' | 'other';

export interface ExtractedCommand {
  raw: string;
  tool: Tool;
  script?: string;
  line: number;
  column: number;
  confidence: 'high' | 'medium';
}

export interface ExtractedPath {
  raw: string;
  line: number;
  column: number;
}

export interface ExtractedLink {
  target: string;
  line: number;
  column: number;
}

export interface Extracted {
  commands: ExtractedCommand[];
  paths: ExtractedPath[];
  links: ExtractedLink[];
}

export interface AgentFile {
  /** chemin relatif à la racine du dépôt (séparateurs `/`) */
  path: string;
  content: string;
}
