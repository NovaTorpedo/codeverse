/**
 * Resolves a node id from a Bob document to a node in the city. Bob sometimes writes a service id as a
 * path (`svc:demo/shopfloor/src/gateway`) where the analyzer's id is the folder (`svc:gateway`); the longest
 * matching path suffix wins. Unknown ids are returned unchanged (grounding still reports them).
 */
export function resolveNodeId(ids: { has(id: string): boolean }, id: string): string {
  if (ids.has(id) || !id.startsWith('svc:')) return id;
  const parts = id.slice(4).replace(/\/+$/, '').split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const candidate = `svc:${parts.slice(i).join('/')}`;
    if (ids.has(candidate)) return candidate;
  }
  return id;
}
