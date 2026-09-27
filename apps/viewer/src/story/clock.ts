import type { Recording } from '@codeverse/schema';
import { keyMoments, storyClock, type Moment, type StoryClock } from './moments';

const clocks = new WeakMap<Recording, StoryClock>();
const moments = new WeakMap<Recording, Moment[]>();

/** Story clock for a recording, computed once per recording object. */
export function clockFor(rec: Recording): StoryClock {
  let c = clocks.get(rec);
  if (!c) {
    c = storyClock(rec);
    clocks.set(rec, c);
  }
  return c;
}

export function momentsFor(rec: Recording): Moment[] {
  let m = moments.get(rec);
  if (!m) {
    m = keyMoments(rec);
    moments.set(rec, m);
  }
  return m;
}
