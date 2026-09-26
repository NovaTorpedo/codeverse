// Shared secret and personal-data patterns for the pre-commit guard, CI and the recording scrubber.
export const SECRET_PATTERNS = [
  { id: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'jwt-or-iam-token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/g },
  { id: 'ibm-cloud-api-key', re: /\b(?:ibm[_-]?cloud[_-]?)?api[_-]?key["'\s]*[:=]\s*["']?[A-Za-z0-9_-]{40,48}\b/gi },
  { id: 'ibm-iam-apikey-json', re: /"apikey"\s*:\s*"[A-Za-z0-9_-]{30,}"/gi },
  { id: 'bob-api-key-assignment', re: /\bBOB_API_KEY\s*[:=]\s*["']?(?!your-api-key|<|\$\{?|process\.env)[A-Za-z0-9_\-.]{12,}/g },
  { id: 'bearer-token', re: /\bBearer\s+[A-Za-z0-9\-_.=+/]{20,}/g },
  { id: 'generic-secret-assignment', re: /\b(?:secret|token|passwd|password|api[_-]?key|access[_-]?key)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-/+=.]{20,}["']/gi },
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { id: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'llm-provider-key', re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}\b/g },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
];

export const ALLOW_MARKER = 'secret-scan:allow';

export function findSecrets(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const { id, re } of SECRET_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) hits.push({ id, line: i + 1 });
    }
  });
  return hits;
}
