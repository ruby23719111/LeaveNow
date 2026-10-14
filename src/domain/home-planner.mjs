import {
  dateInBrisbane,
  journeyTiming,
  serviceTime,
  validateTrip,
} from "./live-planner.mjs";

// Text controls keep app-owned dates/times English even on a non-English OS.
export function normaliseArrivalTime(value) {
  let text = String(value ?? "").trim();
  if (/^\d{3,4}$/.test(text))
    text = text.padStart(4, "0").replace(/(\d{2})(\d{2})/, "$1:$2");
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(text))
    throw Object.assign(
      new Error("Enter a 24-hour time, like 09:00 or 17:30."),
      { field: "arriveBy" },
    );
  return text.padStart(5, "0");
}

export function normaliseTravelDate(value) {
  let text = String(value ?? "").trim();
  if (/^\d{8}$/.test(text))
    text = text.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const epoch = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? Date.parse(text + "T00:00:00+10:00")
    : NaN;
  if (!Number.isFinite(epoch) || dateInBrisbane(epoch) !== text)
    throw Object.assign(new Error("Enter a valid date in YYYY-MM-DD format."), {
      field: "travel-date",
    });
  return text;
}

export function departureFields(values, now = Date.now()) {
  const arriveBy = normaliseArrivalTime(values.arriveBy),
    date = normaliseTravelDate(values.date);
  if (date < dateInBrisbane(now))
    throw Object.assign(new Error("Choose today or a future date."), {
      field: "travel-date",
    });
  if (Date.parse(`${date}T${arriveBy}:00+10:00`) <= now)
    throw Object.assign(new Error("Choose an arrival time in the future."), {
      field: "arriveBy",
    });
  return { arriveBy, date };
}

const wholeNumber = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Create fresh Home preferences, or migrate the previous uncategorised store.
 * This does not read, change, or delete either browser-storage key.
 */
export function createHomeState(legacy = null, now = Date.now()) {
  const preferences = legacy?.version === 1 ? legacy.preferences : null;
  const origin = /^\d+$/.test(String(preferences?.origin ?? ""))
    ? String(preferences.origin)
    : "1186";
  const state = {
    version: 2,
    home: {
      origin,
      walk: origin === "1186" ? 1 : wholeNumber(preferences?.walk, 1, 60, 1),
      prep: wholeNumber(preferences?.prep, 1, 240, 22),
      buffer: wholeNumber(preferences?.buffer, 1, 30, 2),
      configured: false,
    },
    profiles: {
      uni: { destination: "", afterWalk: 0, arriveBy: "09:00" },
      work: { destination: "", afterWalk: 0, arriveBy: "17:00" },
    },
    selected: "uni",
    samples:
      legacy?.version === 1 && Array.isArray(legacy.samples)
        ? structuredClone(legacy.samples)
        : [],
    reflections:
      legacy?.version === 1 && Array.isArray(legacy.reflections)
        ? structuredClone(legacy.reflections)
        : [],
    journey: null,
  };
  if (
    /^\d+$/.test(String(preferences?.destination ?? "")) &&
    String(preferences.destination) !== state.home.origin
  ) {
    state.suggestedDestination = String(preferences.destination);
  }
  return state;
}

/** Category-specific destination and arrival target share one Home origin. */
export function settingsForTrip(state, profileId, date, arriveBy) {
  if (!["uni", "work"].includes(profileId) || !state?.profiles?.[profileId])
    throw new Error("Choose University or Work.");
  const profile = state.profiles[profileId];
  return validateTrip({
    origin: state.home.origin,
    walk: state.home.walk,
    prep: state.home.prep,
    buffer: state.home.buffer,
    destination: profile.destination,
    afterWalk: profile.afterWalk,
    date,
    arriveBy: arriveBy ?? profile.arriveBy,
  });
}

/** A late result is an option for confirmation, never an accepted journey. */
export function recommendService(settings, services, now = Date.now()) {
  const candidates = [];
  for (const service of services ?? []) {
    if (!service) continue;
    const leave =
      serviceTime(service, "departure", now).time -
      (settings.walk + settings.buffer) * 60000;
    const timing = journeyTiming(
      {
        settings,
        service,
        committed: { leave },
        extra: 0,
        startedAt: null,
        readyAt: null,
        departedAt: null,
      },
      service,
      now,
    );
    if (
      !timing.feasible ||
      ![
        timing.departure,
        timing.arrival,
        timing.leave,
        timing.start,
        timing.late,
      ].every(Number.isFinite)
    )
      continue;
    candidates.push({ service, timing, late: timing.late > 0 });
  }
  candidates.sort(
    (a, b) =>
      a.timing.departure - b.timing.departure ||
      a.timing.arrival - b.timing.arrival ||
      String(a.service.id).localeCompare(String(b.service.id)),
  );
  return (
    candidates.filter((candidate) => !candidate.late).at(-1) ??
    candidates[0] ??
    null
  );
}

/** Advance an active plan conservatively; delays never move its reminders back. */
export function advanceEarlierPlan(j, now = Date.now()) {
  if (
    !j?.service ||
    !j.settings ||
    !j.committed ||
    !Number.isFinite(now) ||
    j.departedAt != null
  )
    return false;
  if (
    j.service.cancelled ||
    j.service.skipped ||
    j.service.status === "changed"
  )
    return false;
  const timing = journeyTiming(j, j.service, now);
  if (
    !Number.isFinite(timing.leave) ||
    !Number.isFinite(j.committed.leave) ||
    j.committed.leave - timing.leave < 30000
  )
    return false;
  j.committed.leave = timing.leave;
  if (j.startedAt == null && Number.isFinite(timing.start))
    j.committed.start = Math.min(j.committed.start, timing.start);
  return true;
}

/** A fresh five-minute estimate changes planning, never observed preparation. */
export function requestMoreTime(j, now = Date.now()) {
  if (!j || !Number.isFinite(now))
    throw new Error("A journey and valid time are required.");
  j.remainingOverrideUntil = now + 5 * 60000;
  return j.remainingOverrideUntil;
}

/** The caller records the returned key only after actually delivering a cue. */
export function nextCue(j, now = Date.now()) {
  if (!j?.armed || j.departedAt != null || !Number.isFinite(now) || !j.id)
    return null;
  const cues = Array.isArray(j.cues) ? j.cues : [];
  const cue = (kind, threshold, text) => {
    const key = `${j.id}:${kind}:${threshold}`;
    return cues.includes(key) ? null : { key, kind, text };
  };
  if (Number.isFinite(j.committed?.leave) && now >= j.committed.leave) {
    return cue(
      "leave",
      j.committed.leave,
      "It’s time to leave Home. Head to your stop.",
    );
  }
  if (
    j.startedAt == null &&
    Number.isFinite(j.committed?.start) &&
    now >= j.committed.start
  ) {
    return cue(
      "prepare",
      j.committed.start,
      "It’s time to start getting ready.",
    );
  }
  return null;
}
