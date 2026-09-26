import type { Request, Response } from '../shared/types';

export type Handler = (req: Request, params: Record<string, string>) => Promise<Response>;

interface RouteDef {
  method: Request['method'];
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** Tiny method + path router with `:param` segments. */
export class Router {
  private readonly routes: RouteDef[] = [];

  get(path: string, handler: Handler): this {
    return this.add('GET', path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.add('POST', path, handler);
  }

  match(req: Request): { handler: Handler; params: Record<string, string> } | undefined {
    for (const r of this.routes) {
      if (r.method !== req.method) continue;
      const m = r.pattern.exec(req.path);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
      return { handler: r.handler, params };
    }
    return undefined;
  }

  private add(method: Request['method'], path: string, handler: Handler): this {
    const keys: string[] = [];
    const source = path.replace(/:([a-zA-Z]+)/g, (_, k: string) => {
      keys.push(k);
      return '([^/]+)';
    });
    this.routes.push({ method, pattern: new RegExp(`^${source}$`), keys, handler });
    return this;
  }
}
