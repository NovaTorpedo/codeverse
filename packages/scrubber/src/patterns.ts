// Canonical secret patterns. scripts/secret-patterns.mjs mirrors these for the dependency-free git hook;
// a test keeps the two lists identical.
export const SECRET_PATTERNS: Array<{ id: string; re: RegExp }> = [
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
  // AssemblyAI keys are 32 hex characters; flag them next to their name or an Authorization header.
  { id: 'assemblyai-api-key', re: /\bassembly[_-]?ai[\w-]*["'\s]*[:=]\s*["']?[a-f0-9]{32}\b/gi },
  { id: 'authorization-hex-key', re: /\bauthorization["'\s]*[:=]\s*["']?[a-f0-9]{32}\b/gi },
];

export const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
export const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
export const IPV6 = /\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b|\b(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?\b/gi;
export const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
export const IBM_IDS = [
  /\bcrn:v1:[^\s"']+/g,
  /\b(?:account|team|tenant|org|instance)[_ -]?id["'\s]*[:=]\s*["']?[A-Za-z0-9_-]{8,}["']?/gi,
  /\b[a-f0-9]{32}\b/g,
];
/** Home-directory paths on Windows, macOS and Linux (with or without JSON-escaped backslashes). */
export const HOME_PATH = /(?:[A-Za-z]:(?:\\\\|\\|\/)(?:Users|Documents and Settings)(?:\\\\|\\|\/)[^\\/"'\s]+|\/(?:Users|home)\/[^/"'\s]+)/g;
export const ENV_LINE = /^[ \t]*(?:export[ \t]+|set[ \t]+|\$env:)?[A-Z][A-Z0-9_]{2,}=.*$/;
