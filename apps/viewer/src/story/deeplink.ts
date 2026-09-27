/** Shareable URL state: every chapter and replay moment has a link. Only known values are accepted. */
export type Chapter = 'explore' | 'investigate' | 'fixed';

export const MOMENTS = {
  investigate: ['start', 'ticket', 'logs', 'subagents', 'verify', 'rootcause', 'blocked', 'done', 'failure', 'explain'],
  fixed: ['fix', 'healed', 'impact'],
} as const;
export type LinkMoment = (typeof MOMENTS)['investigate'][number] | (typeof MOMENTS)['fixed'][number];

export interface LinkState {
  world?: string;
  chapter?: Chapter;
  moment?: LinkMoment;
  node?: string;
  flow?: string;
  step?: number;
  story?: boolean;
  tour?: boolean;
}

const CHAPTERS: Chapter[] = ['explore', 'investigate', 'fixed'];
const ID = /^[A-Za-z0-9:/._ -]{1,300}$/;

export function parseLink(search: string): LinkState {
  const q = new URLSearchParams(search);
  const out: LinkState = {};
  const world = q.get('world');
  if (world && /^[a-z0-9][a-z0-9-]{0,63}$/.test(world)) out.world = world;
  let chapter = q.get('c') as Chapter | null;
  if (!chapter && q.get('mode') === 'incident') chapter = 'investigate'; // links from older builds
  if (chapter && CHAPTERS.includes(chapter)) out.chapter = chapter;
  const m = q.get('m');
  if (m && out.chapter && out.chapter !== 'explore' && (MOMENTS[out.chapter] as readonly string[]).includes(m)) out.moment = m as LinkMoment;
  const node = q.get('n');
  if (node && ID.test(node)) out.node = node;
  const flow = q.get('flow');
  if (flow && ID.test(flow)) out.flow = flow;
  const step = Number(q.get('step'));
  if (out.flow && Number.isInteger(step) && step >= 0 && step < 100) out.step = step;
  if (q.get('story') === '1') out.story = true;
  if (q.get('tour') === '1' || q.get('mode') === 'tour') out.tour = true;
  return out;
}

export function linkSearch(s: LinkState): string {
  const q = new URLSearchParams();
  if (s.world && s.world !== 'shopfloor') q.set('world', s.world);
  if (s.story) q.set('story', '1');
  else if (s.tour) q.set('tour', '1');
  else {
    if (s.chapter) q.set('c', s.chapter);
    if (s.moment && s.chapter !== 'explore') q.set('m', s.moment);
    if (s.flow) {
      q.set('flow', s.flow);
      if (s.step !== undefined) q.set('step', String(s.step));
    }
    if (s.node) q.set('n', s.node);
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}
