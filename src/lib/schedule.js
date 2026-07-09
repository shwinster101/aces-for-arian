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

// PLAY position — the order matches actually go on court. Doubles play-ins
// and their consolation are numbered M29+ to protect the public bracket
// numbering contract (East 1-15 … South 26-28), but the play-ins go on
// court FIRST — so the M29+ block sorts ahead of M1 for queueing and
// estimates. (The consolation only becomes playable once the play-ins are
// final, so its early slot just means "fit it in ASAP", which is right —
// those teams are standing around waiting.) Everything else plays in
// number order.
export const playPos = (m) => {
  const n = num(m);
  return n >= 29 && /doub/i.test((m && m.event) || '') ? n - 100 : n;
};

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

  // Matches ahead = every non-final match with a lower PLAY position (see
  // playPos — play-ins queue first despite their M29+ numbers), within the
  // same event (a day runs one event). Live matches count — they hold
  // courts. This match's own position is excluded.
  const mine = playPos(match);
  const ahead = allMatches.filter(o =>
    o !== match &&
    (o.event || '') === (match.event || '') &&
    !isFinal(o) &&
    num(o) > 0 && playPos(o) < mine
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

// Label for a line WAITING on upstream matches (a bye holder whose opponent
// hasn't emerged, a play-in host line, any later round): "Waits on M2 ·
// ~9:40" — the latest blocker's start plus one match length (half a match if
// it's already live). `nums` are the blocking match numbers; blockers not
// posted yet keep the bare "Waits on M2" tag.
export function waitsOnLabel(nums, allMatches, event, sched, nowMs = Date.now()) {
  if (!nums || !nums.length) return null;
  const byNum = new Map((allMatches || []).filter(x => (x.event || '') === event).map(x => [num(x), x]));
  let worstMs = 0;
  let unposted = false;
  for (const n of nums) {
    const fm = byNum.get(n);
    if (!fm) { unposted = true; continue; }
    if (isFinal(fm)) continue;
    const mm = matchMinFor(event, sched) * 60000;
    const e = matchEstimate(fm, allMatches, sched, nowMs);
    const finish = e.status === 'live' ? nowMs + mm / 2 : e.startAt.getTime() + mm;
    worstMs = Math.max(worstMs, finish);
  }
  const tag = `Waits on M${nums.join(' & M')}`;
  if (worstMs) return `${tag} · ~${clock(new Date(worstMs))}`;
  return unposted ? tag : `${tag} · about now`;
}

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
