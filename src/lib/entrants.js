// ==========================================
// ENTRANT DERIVATION — raw roster rows -> seedable entrants
// ==========================================
// The roster has no team entity: each doubles registrant names their partner
// as free text, so one team often arrives as two rows ("Ashwin w/ Ati" and
// "Ati w/ Ashwin"). These helpers canonicalize the field into one entrant per
// singles player / doubles team, and flag the day-of landmines — a named
// partner who never signed up, conflicting pairings (A names B, B names C),
// unpaired players, and double registrations — so the seeding committee can
// resolve them before the draw goes out. Pure functions, no store access.

export const normName = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const firstName = (s) => normName(s).split(' ')[0] || '';

// --- DRAW STRUCTURE (single source of truth) --------------------------------
// Shared by the public brackets/seed board (src/App.jsx) and the admin seed
// list (src/admin/sections/Seeding.jsx) so band boundaries, draw sizes, and
// bye placement can never disagree. Positions 1..SEED_CUT are individually
// seeded; the rest of the field places in the draw as groups.
export const SEED_CUT = 8;
export const DRAW_CAP = { Singles: 32, Doubles: 16 };
// Bracket badge for a draw position: exact number for true seeds, band label
// ("9–16" / "17–32") for the grouped rest of the field.
export const bandLabel = (seed) => (seed <= SEED_CUT ? null : seed <= 16 ? '9–16' : '17–32');

// Title-case a free-text partner name the same way mapRoster does.
const titleCase = (s) => (s || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Split "A & B" / "A and B" / "A + B" / "A / B" into the two sides.
export function splitTeamName(s) {
  const parts = (s || '').split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).map(p => p.trim()).filter(Boolean);
  return parts.length >= 2 ? [parts[0], parts.slice(1).join(' & ')] : null;
}

// Canonical keys — the ONLY place the key format lives (deriveEntrants and
// the seed-list checks all build keys through these two helpers, so the
// format can't drift between producers and consumers). `key` is
// order-independent for teams — "Ashwin & Atishay" and "Atishay & Ashwin"
// collide — and `loose` matches on first names only, so a hand-typed
// "Ashwin & Atishay" still matches the full-name entrant "Ashwin Yedavalli &
// Atishay Kandukuri". Loose matching is first-TOKEN only: a nickname like
// "Ati" does NOT match "Atishay" — those rows get flagged "not in the field"
// rather than silently guessed.
export const playerKeys = (name) => ({ key: 'p:' + normName(name), loose: 'p~' + firstName(name) });
export const teamKeys = (a, b) => ({
  key: 't:' + [a, b].map(normName).sort().join('|'),
  loose: 't~' + [a, b].map(firstName).sort().join('|'),
});

// Canonical keys for a seed-row name (splits "A & B" style team strings).
export function rowKeys(name) {
  const team = splitTeamName(name);
  return team ? teamKeys(team[0], team[1]) : playerKeys(name);
}

// Both canonical keys of every non-blank row in a seed list — used to hide
// already-seeded entrants from the field picker.
export function seedKeySet(list) {
  const set = new Set();
  for (const row of list) {
    const name = (row.name || '').trim();
    if (!name) continue;
    const k = rowKeys(name);
    set.add(k.key);
    set.add(k.loose);
  }
  return set;
}

// Collapse duplicate roster rows for the same person (someone submitting the
// form twice); `count` keeps how many rows merged.
function dedupeByName(list) {
  const by = new Map();
  for (const p of list) {
    const k = normName(p.name);
    if (!k) continue;
    if (by.has(k)) by.get(k).count += 1;
    else by.set(k, { ...p, count: 1 });
  }
  return [...by.values()];
}

// Per-player partner analysis for the doubles field.
// Returns Map: normName(player) -> { player, raw, resolvedName, unpaired,
// missing, conflict, count }. The ops overlay partner (last-minute swaps set
// in the admin) wins over the form answer — same precedence the Seeding tab's
// partner card has always used. A partner given as a first name only still
// resolves when exactly one registered doubles player has that first name.
export function doublesPartnerFlags(participants) {
  const players = dedupeByName(participants.filter(p => (p.events || '').includes('Doubles')));
  const byName = new Map(players.map(p => [normName(p.name), p]));
  const byFirst = new Map();
  for (const p of players) {
    const f = firstName(p.name);
    byFirst.set(f, byFirst.has(f) ? null : p); // null = ambiguous first name
  }
  const rawOf = (p) => ((p.overlay && p.overlay.partner) || p.partner || '').trim();
  const resolve = (raw, selfName) => {
    const k = normName(raw);
    if (!k) return null;
    const hit = byName.get(k) || byFirst.get(firstName(raw)) || null;
    return hit && normName(hit.name) !== normName(selfName) ? hit : null;
  };

  const flags = new Map();
  for (const p of players) {
    const raw = rawOf(p);
    const resolved = resolve(raw, p.name);
    flags.set(normName(p.name), {
      player: p,
      raw,
      resolvedName: resolved ? resolved.name : '',
      unpaired: !raw,
      missing: !!raw && !resolved,
      conflict: false, // filled below
      count: p.count,
    });
  }
  // Conflict: I name X, but X names someone else.
  for (const f of flags.values()) {
    if (!f.resolvedName) continue;
    const theirs = flags.get(normName(f.resolvedName));
    if (theirs && theirs.resolvedName && normName(theirs.resolvedName) !== normName(f.player.name)) {
      f.conflict = true;
    }
  }
  return flags;
}

// One entrant per unique player (Singles) or canonical team (Doubles):
// { kind: 'player'|'team', key, looseKey, display, mergedCount,
//   partnerMissing?, conflict?, unpaired?, memberNames? }
// Doubles teams are keyed order-independently, so reciprocal registrations
// ("Ashwin w/ Ati" + "Ati w/ Ashwin") merge into ONE entrant with
// mergedCount 2 — that's the automatic duplicate removal.
export function deriveEntrants(participants, event) {
  const byDisplay = (a, b) => a.display.localeCompare(b.display);

  if (event !== 'Doubles') {
    return dedupeByName(participants.filter(p => (p.events || '').includes(event)))
      .map(p => {
        const k = playerKeys(p.name);
        return { kind: 'player', key: k.key, looseKey: k.loose, display: p.name, mergedCount: p.count };
      })
      .sort(byDisplay);
  }

  const flags = doublesPartnerFlags(participants);
  const teams = new Map();
  const claimed = new Set(); // players who ended up inside a team
  for (const f of flags.values()) {
    if (f.unpaired) continue;
    const partnerName = f.resolvedName || titleCase(f.raw);
    const k = teamKeys(f.player.name, partnerName);
    let t = teams.get(k.key);
    if (!t) {
      const pair = [f.player.name, partnerName].sort((a, b) => a.localeCompare(b));
      t = {
        kind: 'team',
        key: k.key,
        looseKey: k.loose,
        display: `${pair[0]} & ${pair[1]}`,
        memberNames: pair,
        mergedCount: 0,
        partnerMissing: false,
        conflict: false,
      };
      teams.set(k.key, t);
    }
    t.mergedCount += 1;
    if (f.missing) t.partnerMissing = true;
    if (f.conflict) t.conflict = true;
    claimed.add(normName(f.player.name));
    if (f.resolvedName) claimed.add(normName(f.resolvedName));
  }

  // A registered player appearing in two different teams is a conflict even
  // when the direct check above missed it (e.g. A names B, B names C:
  // "A & B" and "B & C" both carry B).
  const teamsPerMember = new Map();
  for (const t of teams.values()) {
    for (const m of t.memberNames) {
      const k = normName(m);
      if (!flags.has(k)) continue; // an unregistered partner can't conflict
      teamsPerMember.set(k, (teamsPerMember.get(k) || 0) + 1);
    }
  }
  for (const t of teams.values()) {
    if (t.memberNames.some(m => (teamsPerMember.get(normName(m)) || 0) > 1)) t.conflict = true;
  }

  const solos = [...flags.values()]
    .filter(f => f.unpaired && !claimed.has(normName(f.player.name)))
    .map(f => {
      const k = playerKeys(f.player.name);
      return { kind: 'player', key: k.key, looseKey: k.loose, display: f.player.name, mergedCount: f.count, unpaired: true };
    });

  return [...[...teams.values()].sort(byDisplay), ...solos.sort(byDisplay)];
}

// Loose (first-name) keys are only trustworthy when they identify a single
// entrant — e.g. ten players who share a first name must NOT alias each
// other. Returns the set of loose keys shared by 2+ distinct entrants.
export function ambiguousLooseKeys(entrants) {
  const count = new Map();
  for (const e of entrants) count.set(e.looseKey, (count.get(e.looseKey) || 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
}

// Issues per seed row: { duplicateOf?: <earlier row index>, unknown?: true }.
// `duplicateOf` catches the same player/team seeded twice — including the
// reversed-partner form of a doubles team. `unknown` marks a name matching no
// registered entrant (typo, or someone who never signed up). Loose first-name
// matches only count as duplicates when the loose key is unambiguous in the
// field (see ambiguousLooseKeys).
export function seedListIssues(list, entrants) {
  const known = new Set();
  for (const e of entrants) {
    known.add(e.key);
    known.add(e.looseKey);
  }
  const ambiguous = ambiguousLooseKeys(entrants);
  const seen = new Map(); // canonical key -> first row index using it
  return list.map((row, i) => {
    const name = (row.name || '').trim();
    if (!name) return {};
    const k = rowKeys(name);
    const issue = {};
    const dupe = seen.has(k.key) ? seen.get(k.key)
      : (!ambiguous.has(k.loose) && seen.has(k.loose)) ? seen.get(k.loose)
      : undefined;
    if (dupe !== undefined) issue.duplicateOf = dupe;
    if (!seen.has(k.key)) seen.set(k.key, i);
    if (!seen.has(k.loose)) seen.set(k.loose, i);
    if (!known.has(k.key) && !known.has(k.loose)) issue.unknown = true;
    return issue;
  });
}
