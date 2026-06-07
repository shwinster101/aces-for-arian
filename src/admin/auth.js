// Change this before the tournament — share it only with the ops crew.
// NOTE: this is a casual deterrent, not real security. It's a static site with
// no server, so the PIN ships inside the public JS bundle either way; this
// gate just keeps random visitors who stumble on the URL from poking around.
export const ADMIN_PIN = '2311';

const UNLOCK_KEY = 'a4a-ops-unlocked';

export function isUnlocked() {
  try { return localStorage.getItem(UNLOCK_KEY) === ADMIN_PIN; } catch { return false; }
}

export function unlock() {
  try { localStorage.setItem(UNLOCK_KEY, ADMIN_PIN); } catch { /* ignore */ }
}

export function lock() {
  try { localStorage.removeItem(UNLOCK_KEY); } catch { /* ignore */ }
}
