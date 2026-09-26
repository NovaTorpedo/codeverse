import type { ReactNode } from 'react';

const KEYWORDS = new Set(
  'import export from const let var function return if else for while do switch case break continue new class extends implements interface type enum async await try catch finally throw typeof instanceof in of as public private protected readonly static void null undefined true false this super default yield'.split(' '),
);

const TOKEN = /(\/\/.*$|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)/g;

/**
 * Text-safe syntax highlighting: returns React text nodes wrapped in spans.
 * Never produces HTML strings, so untrusted source cannot inject markup.
 */
export function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const [text, com, str, num, word] = m;
    let cls: string | undefined;
    if (com) cls = 'tok-com';
    else if (str) cls = 'tok-str';
    else if (num) cls = 'tok-num';
    else if (word) {
      if (KEYWORDS.has(word)) cls = 'tok-kw';
      else if (/^[A-Z]/.test(word)) cls = 'tok-type';
      else if (line[i + word.length] === '(') cls = 'tok-fn';
    }
    out.push(cls ? (
      <span key={k++} className={cls}>
        {text}
      </span>
    ) : (
      text
    ));
    last = i + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
