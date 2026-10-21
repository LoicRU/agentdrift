/**
 * Une ligne qui parle de fichiers générés, créés plus tard, interdits, obsolètes ou donnés
 * en exemple n'affirme pas que la chose existe aujourd'hui : on s'abstient.
 */
const WORDS =
  /\b(generat\w*|gitignor\w*|git-ignored|creat\w*|writes?|written|output\w*|do not|don't|never|avoid|wrong|deprecated|removed|obsolete|outdated|example|such as|optional|will be|if present|if exists?)\b/i;
const OTHER = /e\.g\.|旧|不要|不得|禁止/i;

export function isNotAClaim(line: string): boolean {
  return WORDS.test(line) || OTHER.test(line);
}
