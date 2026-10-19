/** Lecture minimale de pyproject.toml : tâches poe, scripts [project.scripts]. */
export function parsePyprojectScripts(content: string): string[] {
  const names = new Set<string>();
  let section = '';
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    const sec = /^\[([^\]]+)\]$/.exec(line);
    if (sec?.[1]) {
      section = sec[1].trim();
      const sub = /^tool\.poe\.tasks\.([\w-]+)$/.exec(section);
      if (sub?.[1]) names.add(sub[1]);
      continue;
    }
    if (section === 'project.scripts' || section === 'tool.poe.tasks' || section === 'tool.poetry.scripts') {
      const kv = /^([\w.-]+)\s*=/.exec(line);
      if (kv?.[1]) names.add(kv[1]);
    }
  }
  return [...names];
}
