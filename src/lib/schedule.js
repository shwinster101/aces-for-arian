// ==========================================
// SCHEDULE ESTIMATES — "when's my next match?"
// ==========================================
// Turns the live match queue into a rough "you're ~N ahead, ~M min out"
// estimate. Courts are assigned dynamically (next match -> next open court),
// so the model is wave-based: with C courts running, matches clear ~C at a
// time, each taking ~matchMin. Everything is APPROXIMATE and labelled with
// "~" — it's for setting expectations, not a promise. Pure functions.

export const SCHEDULE_DEFAULTS = {
  courts: 9,        // courts available for play
  doublesMin: 40,   // Fast-4 best-of-3 doubles match — rough average
  singlesMin: 50,   // 6-/8-game singles match — rough average (varies by round)
  warmupMin: 10,    // one-time warm-up before the very first matches
};

const num = (m) => Number(m && m.num) || 0;
const isFinal = (m) => (m && m.status) === 'final';
const isLive = (m) => (m && m.status) === 'live';

// Match length for a match's event.
export function matchMinFor(event, sched) {
  const s = { ...SCHEDULE_DEFAULTS, ...(sched || {}) };
  return /doub/i.test(event || '') ? s.doublesMin : s.singlesMin;
}

// Estimate for a single not-yet-final match, given the full match list.
// Returns { status } for live/final, else { ahead, waitMin, startAt }.
export function matchEstimate(match, allMatches, sched, nowMs = Date.now()) {
  if (isFinal(match)) return { status: 'final' };
  if (isLive(match)) return { status: 'live' };
  const s = { ...SCHEDULE_DEFAULTS, ...(sched || {}) };
  const courts = Math.max(1, Number(s.courts) || 1);
  const matchMin = Math.max(1, matchMinFor(match.event, s));

  // Matches ahead = every non-final match with a lower play position, within
  // the same event (a day runs one event). Live matches count — they hold
  // courts. This match's own position is excluded.
  const mine = num(match);
  const ahead = allMatches.filter(o =>
    o !== match &&
    (o.event || '') === (match.event || '') &&
    !isFinal(o) &&
    num(o) > 0 && num(o) < mine
  ).length;

  const wave = Math.floor(ahead / courts);
  // Warm-up only applies at the very start of the day (nothing decided yet).
  const anyStarted = allMatches.some(o => isLive(o) || isFinal(o));
  const waitMin = wave * matchMin + (anyStarted ? 0 : s.warmupMin);
  return { ahead, waitMin, startAt: new Date(nowMs + waitMin * 60000) };
}

const clock = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
// Round a minutes figure to a friendly 5-min step for display.
const round5 = (m) => Math.round(m / 5) * 5;

// Short human label. courtName lets callers show the actual court for a live
// match ("On court 5"); falls back to "On court".
export function estimateLabel(match, allMatches, sched, nowMs = Date.now()) {
  const e = matchEstimate(match, allMatches, sched, nowMs);
  if (e.status === 'final') return match.score ? `Final · ${match.score}` : 'Final';
  if (e.status === 'live') return match.court ? `On court ${match.court} now` : 'On court now';
  const aheadTxt = e.ahead === 0 ? 'You’re up next' : `~${e.ahead} match${e.ahead === 1 ? '' : 'es'} ahead`;
  if (e.waitMin <= 0) return `${aheadTxt} · about now`;
  return `${aheadTxt} · ~${round5(e.waitMin)} min · around ${clock(e.startAt)}`;
}
