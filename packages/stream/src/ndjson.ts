/** Incremental NDJSON line splitter. Robust to partial chunks, CRLF and oversized lines. */
export class LineSplitter {
  private buf = '';
  private dropping = false;

  constructor(private readonly maxLine = 2 * 1024 * 1024) {}

  push(chunk: string): string[] {
    this.buf += chunk;
    const lines: string[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx).replace(/\r$/, '');
      this.buf = this.buf.slice(idx + 1);
      if (this.dropping) {
        this.dropping = false;
        continue;
      }
      if (line.trim()) lines.push(line);
    }
    if (this.buf.length > this.maxLine) {
      this.buf = '';
      this.dropping = true;
    }
    return lines;
  }

  flush(): string[] {
    const rest = this.dropping ? '' : this.buf.replace(/\r$/, '');
    this.buf = '';
    this.dropping = false;
    return rest.trim() ? [rest] : [];
  }
}

export type ParsedLine = { ok: true; value: Record<string, unknown> } | { ok: false; line: string };

export function parseLine(line: string): ParsedLine {
  try {
    const value: unknown = JSON.parse(line);
    if (value && typeof value === 'object' && !Array.isArray(value)) return { ok: true, value: value as Record<string, unknown> };
  } catch {
    // not JSON: surfaced as a non-event line
  }
  return { ok: false, line };
}
