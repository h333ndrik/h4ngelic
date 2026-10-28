/** Local interaction settings; visitor memory contains only count/last activity. */
export const easterSettings = {
  ink: {
    enabled: true,
    maximumMarks: 12,
    minimumLifetimeMs: 6000,
    maximumLifetimeMs: 12000,
    minimumSize: 48,
    maximumSize: 78,
    maximumPointerTravel: 8,
    touch: {
      enabled: true,
      minimumIntervalMs: 180,
      minimumTravel: 24,
      initialTravel: 18,
      minimumLifetimeMs: 6000,
      maximumLifetimeMs: 10000,
      palette: ['#8511ff', '#bcff16', '#ff3dbb', '#2266ff'],
    },
    // The same damaged material appears only after a real blank click/tap.
    texture: '/assets/corrupted-film-mobile.webp',
    palette: ['#bcff16', '#8511ff', '#ff3dbb', '#2266ff', '#fffefb'],
    textureOpacity: .54,
    otherTextureOpacity: .79,
    smearDistance: 13,
    fractureMs: 480,
    glowPx: 3,
    otherGlowPx: 6,
  },
  hint: { fadeMs: 600, visibleMs: 2000 },
  visits: {
    enabled: true,
    // Optional host policy: true also requires hasVisitorConsent() === true.
    // The requested local-only counter works without a separate integration.
    requireConsent: false,
    showNumber: true,
    storageKey: 'h4ngelic.visits.v1',
    separatedVisitMs: 30 * 60 * 1000,
    writeIntervalMs: 60 * 1000,
  },
};

export const visitorMessages = [
  'nice to meet you.',
  'you came back.',
  'we’re practically friends now.',
  "getting familiar, aren't we?",
  'you know your way around here.',
  'some things are worth returning to.',
  "you're part of this place now.",
];

export function visitorMessage(count) {
  const visit = Number.isSafeInteger(count) && count > 0 ? count : 1;
  const index = visit >= 10 ? 6 : visit >= 6 ? 5 : visit - 1;
  return visitorMessages[index];
}

/** A visit is separated by inactivity, never by a page view or immediate reload. */
export function nextVisit(record, now, intervalMs = easterSettings.visits.separatedVisitMs) {
  if (!Number.isFinite(now) || now < 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('Visit timing must use a positive interval and a valid timestamp.');
  }
  const valid = record && Number.isSafeInteger(record.count) && record.count > 0
    && Number.isFinite(record.lastSeen) && record.lastSeen >= 0;
  const count = valid ? record.count : 1;
  const separated = valid && now - record.lastSeen >= intervalMs;
  return { count: separated && count < Number.MAX_SAFE_INTEGER ? count + 1 : count, lastSeen: now };
}

export function canRememberVisits(settings, consent = false) {
  return settings.enabled === true && (settings.requireConsent !== true || consent === true);
}
