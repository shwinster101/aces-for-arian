// Two-tier ops access. Share each PIN only with the right crew:
//   2311 -> 'hq'   — full console (owner's phone + the check-in laptop).
//   0526 -> 'desk' — volunteer tier: Check-ins, Payments, Scores & Courts.
// NOTE: this is a casual deterrent, not real security. It's a static site
// with no server, so both PINs ship inside the public JS bundle either way;
// the gate just keeps random visitors who stumble on the URL from poking
// around, and the desk tier keeps volunteers out of screens they don't need
// (draws, announcements, the email list) — it does NOT stop a determined
// person who reads the bundle. Rotate both after the event.
export const PINS = { '2311': 'hq', '0526': 'desk' };

const UNLOCK_KEY = 'a4a-ops-unlocked';

// 'hq' | 'desk' | null — derived from the stored PIN so an old stored value
// (or a rotated PIN) silently falls back to locked.
export function role() {
  try { return PINS[localStorage.getItem(UNLOCK_KEY)] || null; } catch { return null; }
}

export function isUnlocked() {
  return role() !== null;
}

export function unlock(pin) {
  try { localStorage.setItem(UNLOCK_KEY, pin); } catch { /* ignore */ }
}

export function lock() {
  try { localStorage.removeItem(UNLOCK_KEY); } catch { /* ignore */ }
}
