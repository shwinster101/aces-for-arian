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
  qfMin: 60,        // QF onward: 8-game pro set, with ad — ~1 hr each
  warmupMin: 10,    // one-time warm-up before the very first matches
};

// First-serve anchors — the highest-leverage matches go on court at these
// times, and every projection counts forward from here. Local (venue =
// Central) wall-clock, same parse style as the reg-deadline constant.
export const EVENT_START = {
  Doubles: '2026-07-11T09:00:00', // Sat — doubles, 9:00 AM
  Singles: '2026-07-12T08:00:00', // Sun — singles, 8:00 AM
};
export function dayStartMs(event) {
  return new Date(/doub/i.test(event || '') ? EVENT_START.Doubles : EVENT_START.Singles).getTime();
}

// Rounds played as 8-game pro sets (QF onward) — longer than the earlier
// rounds. Doubles championship = East QF/SF/F; singles = Winners R3 (round of
// 8 = QF) / SF / Final, and the Grand Final. Keyed off the flat rows' `round`
// tag (see roundTag in src/lib/draw.js).
const LONG_ROUNDS = {
  Doubles: new Set(['QF', 'SF', 'F']),
  Singles: new Set(['R3', 'SF', 'F', 'Grand Final']),
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

// Match length for a match's event — round-aware: QF onward (8-game pro sets)
// take qfMin, earlier rounds take the event length. `round` is optional; when
// omitted (or an early round) it falls back to the event length.
export function matchMinFor(event, sched, round) {
  const s = { ...SCHEDULE_DEFAULTS, ...(sched || {}) };
  const isD = /doub/i.test(event || '');
  const longSet = isD ? LONG_ROUNDS.Doubles : LONG_ROUNDS.Singles;
  if (round && longSet.has(String(round).trim())) return s.qfMin;
  return isD ? s.doublesMin : s.singlesMin;
}

// Estimate for a single not-yet-final match, given the full match list.
// Returns { status } for live/final, else { ahead, waitMin, startAt }.
export function matchEstimate(match, allMatches, sched, nowMs = Date.now()) {
  if (isFinal(match)) return { status: 'final' };
  if (isLive(match)) return { status: 'live' };
  const s = { ...SCHEDULE_DEFAULTS, ...(sched || {}) };
  const courts = Math.max(1, Number(s.courts) || 1);
  const matchMin = Math.max(1, matchMinFor(match.event, s, match.round));

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
  // Project from first serve until the day actually starts, then from now —
  // so a player checking pre-event sees real clock times counting from 9/8 AM.
  const ds = dayStartMs(match.event);
  const baseMs = Number.isFinite(ds) ? Math.max(nowMs, ds) : nowMs;
  return { ahead, waitMin, startAt: new Date(baseMs + waitMin * 60000) };
}

// Approximate championship-path milestones (QF / SF / Final). PROGRESS-AWARE:
// before the day starts it's a plan anchored at first serve (9/8 AM); once
// matches go live/final it re-projects the remaining rounds from NOW, so the
// times shift as the day runs ahead of or behind schedule. Each championship
// round is one court-wave that can't begin until the prior clears; round-aware
// lengths (QF onward = qfMin); byes shrink early rounds via live counts.
// Returns { QF?, SF?, F? } where each is { at: Date } | { live: true } |
// { done: true }, or null when there's nothing to project yet.
export function roundMilestones(matches, event, sched, nowMs = Date.now()) {
  const s = { ...SCHEDULE_DEFAULTS, ...(sched || {}) };
  const courts = Math.max(1, Number(s.courts) || 1);
  const ev = (matches || []).filter(m => (m.event || '') === event);
  if (!ev.length) return null;
  const isD = /doub/i.test(event);
  const roundMs = (tags) => ev.filter(m => tags.includes(String(m.round || '').trim()));
  // Doubles play-ins go on court first, before East R1 — fold into the pre-QF
  // block. (Their consolation is separate and doesn't gate the QF.)
  const playIn = isD ? ev.filter(m => /play-?in/i.test(m.round || '') && !/consol/i.test(m.round || '')) : [];
  const path = isD ? [
    { ms: [...roundMs(['R1']), ...playIn], len: s.doublesMin },
    { key: 'QF', ms: roundMs(['QF']), len: s.qfMin },
    { key: 'SF', ms: roundMs(['SF']), len: s.qfMin },
    { key: 'F', ms: roundMs(['F']), len: s.qfMin },
  ] : [
    { ms: roundMs(['R1']), len: s.singlesMin },
    { ms: roundMs(['R2']), len: s.singlesMin },
    { key: 'QF', ms: roundMs(['R3']), len: s.qfMin },
    { key: 'SF', ms: roundMs(['SF']), len: s.qfMin },
    { key: 'F', ms: roundMs(['Grand Final', 'F']), len: s.qfMin },
  ];
  const durMs = (n, len) => (n > 0 ? Math.ceil(n / courts) : 0) * len * 60000;
  const started = ev.some(m => isLive(m) || isFinal(m));
  // Frontier = first path round not fully final (all before it are done).
  let frontier = path.length;
  for (let i = 0; i < path.length; i++) {
    if (!(path[i].ms.length > 0 && path[i].ms.every(isFinal))) { frontier = i; break; }
  }
  const ds = dayStartMs(event);
  let t = started ? nowMs : (Number.isFinite(ds) ? ds : nowMs);
  const out = {};
  for (let i = 0; i < path.length; i++) {
    const r = path[i];
    if (started && i < frontier) {           // round is behind us
      if (r.key) out[r.key] = { done: true };
      continue;                              // no clock advance — we anchor at now
    }
    if (started && i === frontier) {         // the round in progress right now
      const remaining = r.ms.filter(m => !isFinal(m));
      const anyLive = r.ms.some(isLive);
      let d = durMs(remaining.length, r.len);
      if (anyLive) d = Math.ceil(d / 2);     // ~half a match left on the live courts
      if (r.key) out[r.key] = anyLive ? { live: true } : { at: new Date(t) };
      t += d;
      continue;
    }
    if (r.key && r.ms.length > 0) out[r.key] = { at: new Date(t) }; // upcoming
    t += durMs(r.ms.length, r.len);
  }
  return (out.QF || out.SF || out.F) ? out : null;
}

// "What place is this match for?" — a concise stakes label per round tag, for
// the ops call sheet. Doubles is a compass (East = championship, W/N/S =
// placement paths); singles is double-elim (Grand Final decides it).
const STAKES = {
  Doubles: {
    'Play-in': 'Play-in — into the draw', 'Play-in Consol': 'Play-in consolation',
    R1: 'Round of 16', QF: 'Championship QF', SF: 'Championship SF', F: '🏆 Championship final',
    'West R1': 'West — placement', 'West SF': 'West semifinal', 'West F': 'West final (placement)',
    'North SF': 'North semifinal', 'North F': 'North final (placement)',
    'South SF': 'South semifinal', 'South F': 'South final (placement)',
  },
  Singles: {
    R1: 'Round of 32', R2: 'Round of 16', R3: 'Championship QF', SF: 'Championship SF',
    F: 'Winners final', 'Grand Final': '🏆 Grand Final',
    'Comeback R1': 'Comeback', 'Comeback R2': 'Comeback', 'Comeback R3': 'Comeback',
    'Comeback R4': 'Comeback', 'Comeback R5': 'Comeback', 'Comeback R6': 'Comeback',
    'Comeback R7': 'Comeback SF', 'Comeback F': 'Comeback final — into the Grand Final',
  },
};
export function stakesFor(event, round) {
  const tag = String(round || '').trim();
  const map = /doub/i.test(event || '') ? STAKES.Doubles : STAKES.Singles;
  return map[tag] || tag || '—';
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
