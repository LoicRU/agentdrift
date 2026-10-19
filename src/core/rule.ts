import type { Repo } from '../introspect/index.js';
import type { AgentFile, Extracted, Finding, Severity } from './types.js';

export interface RuleContext {
  file: AgentFile;
  /** dossier du fichier, relatif à la racine ('' = racine) */
  fileDir: string;
  extracted: Extracted;
  repo: Repo;
}

export interface Rule {
  id: string;
  name: string;
  defaultSeverity: Severity;
  run(ctx: RuleContext): Finding[];
}
