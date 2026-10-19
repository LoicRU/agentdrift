import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const CONFIG_FILE = '.agentdrift.json';

const level = z.enum(['off', 'error', 'warn', 'info']);

export const ConfigSchema = z
  .object({
    files: z.array(z.string()).optional(),
    ignorePaths: z.array(z.string()).default([]),
    rules: z.record(z.string(), level).default({}),
    maxLines: z.number().int().positive().optional(),
    failOn: z.enum(['error', 'warn', 'info']).default('error'),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {}

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

export function loadConfig(root: string, explicit?: string): Config {
  const file = explicit ? path.resolve(explicit) : path.join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    if (explicit) throw new ConfigError(`Config file not found: ${file}`);
    return defaultConfig();
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${path.basename(file)}: invalid JSON (${(e as Error).message})`);
  }
  const parsed = ConfigSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new ConfigError(`${path.basename(file)} is invalid:\n${issues}`);
  }
  return parsed.data;
}
