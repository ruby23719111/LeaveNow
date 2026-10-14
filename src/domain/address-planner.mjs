import {
  preparationDraft,
  preparationChoice,
  normaliseFeedback,
  feedbackChoice,
} from "./preparation.mjs";
import { dateInBrisbane, serviceTime } from "./live-planner.mjs";

const whole = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : fallback;
};
const timeOr = (value, fallback) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? "")) ? value : fallback;
const records = (value, limit) =>
  Array.isArray(value) ? structuredClone(value.slice(-limit)) : [];
const own = (value, key) => value != null && Object.hasOwn(value, key);
const objectRecord = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);
const builtins = Object.freeze({ uni: "Uni", work: "Work" });
const customId = (id) =>
  typeof id === "string" &&
  /^place-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
const MAX_PLACES = 20;
function nameOrNull(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name &&
    Array.from(name).length <= 32 &&
    !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : null;
}
const nameKey = (name) => name.normalize("NFKC").toLocaleLowerCase("en-AU");
const snapshotName = (value, label) =>
  nameOrNull(value) ||
  nameOrNull(
    Array.from(label || "")
      .slice(0, 32)
      .join(""),
  ) ||
  "Destination";
function placeOrNull(value) {
  if (
    !objectRecord(value) ||
    !own(value, "id") ||
    !own(value, "label") ||
    typeof value.id !== "string" ||
    typeof value.label !== "string"
  )
    return null;
  const id = value.id.trim(),
    label = value.label.trim();
  return id && label ? { id, label } : null;
}

function profileFor(state, id) {
  if (id === "once")
    return own(state, "oneOff") &&
      objectRecord(state.oneOff) &&
      own(state.oneOff, "name") &&
      own(state.oneOff, "place")
      ? state.oneOff
      : null;
  if ((!own(builtins, id) && !customId(id)) || !own(state?.profiles, id))
    return null;
  const profile = state.profiles[id];
  return objectRecord(profile) &&
    own(profile, "place") &&
    (own(builtins, id) || own(profile, "name"))
    ? profile
    : null;
}

/** Active journeys keep their chosen name even if the corresponding saved place is renamed or deleted. */
export function profileName(state, id) {
  if (own(builtins, id)) return builtins[id];
  if (id !== "once" && !customId(id)) return "Destination";
  if (state?.journey?.profileId === id) {
    const name = nameOrNull(state.journey.destinationName);
    if (name) return name;
  }
  return nameOrNull(profileFor(state, id)?.name) || "Destination";
}

/** Save a custom place. Builtin profiles continue to use their existing edit flow. */
export function savePlace(state, { id, name, place, arriveBy } = {}) {
  if (!objectRecord(state?.profiles))
    throw new Error("Saved places are unavailable.");
  const existing =
    id == null
      ? null
      : customId(id) &&
          own(state.profiles, id) &&
          objectRecord(state.profiles[id])
        ? state.profiles[id]
        : null;
  if (id != null && !existing)
    throw new Error("Choose an existing custom saved place to edit.");
  const savedName = nameOrNull(name),
    savedPlace = placeOrNull(place);
  if (!savedName)
    throw new Error("Give this place a name from 1 to 32 characters.");
  if (!savedPlace)
    throw new Error("Search and select an address for this place.");
  const key = nameKey(savedName);
  const duplicate =
    Object.values(builtins).some((value) => nameKey(value) === key) ||
    Object.entries(state.profiles).some(
      ([otherId, profile]) =>
        otherId !== id &&
        customId(otherId) &&
        own(profile, "name") &&
        nameOrNull(profile.name) &&
        nameKey(profile.name.trim()) === key,
    );
  if (duplicate)
    throw new Error(
      "A saved place already uses that name. Choose a different name.",
    );
  const targetTime =
    arriveBy === undefined
      ? timeOr(existing?.arriveBy, "09:00")
      : timeOr(arriveBy, null);
  if (targetTime === null)
    throw new Error("Enter a valid arrival time, like 09:00 or 17:30.");
  if (
    !existing &&
    Object.keys(state.profiles).filter(customId).length >= MAX_PLACES
  )
    throw new Error(
      "You can save up to 20 custom places. Remove one before adding another.",
    );
  const savedId = id ?? `place-${crypto.randomUUID()}`;
  if (!existing && own(state.profiles, savedId))
    throw new Error("Could not create this saved place. Please try again.");
  state.profiles[savedId] = {
    name: savedName,
    place: savedPlace,
    arriveBy: targetTime,
  };
  return savedId;
}

export function removePlace(state, id) {
  if (!customId(id))
    throw new Error("Only custom saved places can be removed.");
  if (!own(state?.profiles, id)) return false;
  delete state.profiles[id];
  if (state.selected === id) state.selected = "uni";
  return true;
}

/** Migrate user preferences and measured records without pretending old stops are addresses. */
export function createAddressState(legacy = null) {
  const recognised = legacy?.version === 1 || legacy?.version === 2;
  const oldHome =
    legacy?.version === 2
      ? legacy.home
      : legacy?.version === 1
        ? legacy.preferences
        : null;
  return {
    version: 3,
    home: {
      place: null,
      prep: whole(oldHome?.prep, 1, 240, 22),
      buffer: whole(oldHome?.buffer, 1, 30, 2),
    },
    profiles: {
      uni: {
        place: null,
        arriveBy: timeOr(
          legacy?.version === 2 ? legacy.profiles?.uni?.arriveBy : null,
          "09:00",
        ),
      },
      work: {
        place: null,
        arriveBy: timeOr(
          legacy?.version === 2 ? legacy.profiles?.work?.arriveBy : null,
          "17:00",
        ),
      },
    },
    selected:
      legacy?.version === 2 && legacy.selected === "work" ? "work" : "uni",
    samples: recognised ? records(legacy.samples, 100) : [],
    reflections: recognised ? records(legacy.reflections, 30) : [],
    preparationDraft: null,
    journey: null,
  };
}

/** Valid v3 plans may be restored; enabling browser audio still requires a fresh user gesture. */
export function restoreAddressState(saved, legacy = null) {
  const state = createAddressState(legacy);
  if (saved?.version !== 3) return state;
  state.home = {
    place: placeOrNull(saved.home?.place),
    prep: whole(saved.home?.prep, 1, 240, state.home.prep),
    buffer: whole(saved.home?.buffer, 1, 30, state.home.buffer),
  };
  for (const id of ["uni", "work"]) {
    const profile = own(saved.profiles, id) ? saved.profiles[id] : null;
    state.profiles[id] = {
      place: placeOrNull(profile?.place),
      arriveBy: timeOr(profile?.arriveBy, state.profiles[id].arriveBy),
    };
  }
  const names = new Set(Object.values(builtins).map(nameKey));
  let restoredPlaces = 0;
  if (objectRecord(saved.profiles))
    for (const [id, profile] of Object.entries(saved.profiles)) {
      if (
        !customId(id) ||
        !objectRecord(profile) ||
        restoredPlaces >= MAX_PLACES
      )
        continue;
      const name = own(profile, "name") ? nameOrNull(profile.name) : null;
      const place = own(profile, "place") ? placeOrNull(profile.place) : null;
      if (!name || !place || names.has(nameKey(name))) continue;
      state.profiles[id] = {
        name,
        place,
        arriveBy: timeOr(profile.arriveBy, "09:00"),
      };
      names.add(nameKey(name));
      restoredPlaces++;
    }
  state.selected =
    typeof saved.selected === "string" && own(state.profiles, saved.selected)
      ? saved.selected
      : "uni";
  state.samples = records(saved.samples, 100);
  state.reflections = records(saved.reflections, 30).map((r) =>
    r?.category != null ? normaliseFeedback(r) : r,
  );
  state.preparationDraft = preparationDraft(saved.preparationDraft);
  if (saved.journey) {
    try {
      const j = structuredClone(saved.journey);
      j.settings = validateTrip(j.settings);
      if (
        !j.id ||
        j.mode !== "real" ||
        !validService(j.service) ||
        !Number.isFinite(j.committed?.leave) ||
        !Number.isFinite(j.committed?.start)
      )
        throw new Error("Invalid saved journey.");
      if (j.preparation)
        j.preparation = preparationChoice(
          j.settings.prep,
          j.preparation.activities,
        );
      if (j.companionOutcome)
        j.companionOutcome = normaliseFeedback(j.companionOutcome);
      if (j.feedbackDraft)
        j.feedbackDraft = feedbackChoice(
          j.feedbackDraft.category,
          j.feedbackDraft.reasonDetails,
        );
      if (
        !own(builtins, j.profileId) &&
        j.profileId !== "once" &&
        !customId(j.profileId)
      )
        delete j.profileId;
      j.destinationName = snapshotName(
        j.destinationName,
        j.settings.destination.label,
      );
      for (const key of ["startedAt", "readyAt", "departedAt"]) {
        if (j[key] != null && !Number.isFinite(j[key]))
          throw new Error("Invalid saved preparation time.");
        j[key] ??= null;
      }
      j.extra = Number.isFinite(j.extra) && j.extra >= 0 ? j.extra : 0;
      if (!Number.isFinite(j.remainingOverrideUntil))
        delete j.remainingOverrideUntil;
      j.services = Array.isArray(j.services)
        ? j.services.filter(validService)
        : [j.service];
      j.cues = Array.isArray(j.cues)
        ? j.cues.filter((key) => typeof key === "string")
        : [];
      j.announced = Array.isArray(j.announced)
        ? j.announced.filter((key) => typeof key === "string")
        : [];
      j.armed = j.armed === true && j.departedAt == null;
      state.journey = j;
    } catch {
      /* Keep valid settings and records even when the saved plan is unusable. */
    }
  }
  return state;
}

export function validateTrip(values) {
  const origin = placeOrNull(values?.origin),
    destination = placeOrNull(values?.destination);
  if (!origin || !destination || origin.id === destination.id)
    throw new Error(
      "Choose different Home and destination addresses from the search results.",
    );
  const date = values.date,
    arriveBy = values.arriveBy;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(arriveBy)
  )
    throw new Error("Choose a valid date and arrival time.");
  const deadline = Date.parse(`${date}T${arriveBy}:00+10:00`);
  if (!Number.isFinite(deadline) || dateInBrisbane(deadline) !== date)
    throw new Error("Choose a valid date.");
  const prep = whole(values.prep, 1, 240, null),
    buffer = whole(values.buffer, 1, 30, null);
  if (prep === null || buffer === null)
    throw new Error(
      "Preparation must be 1–240 minutes and the stop buffer must be 1–30 minutes.",
    );
  return { origin, destination, date, arriveBy, prep, buffer };
}

export function settingsForTrip(
  state,
  id,
  date,
  arriveBy,
  prep = state.home?.prep,
) {
  const profile = profileFor(state, id);
  if (!profile || (!own(builtins, id) && !nameOrNull(profile.name)))
    throw new Error("Choose a saved place or set a destination for this trip.");
  return validateTrip({
    origin: state.home?.place,
    destination: profile.place,
    date,
    arriveBy: arriveBy ?? profile.arriveBy,
    prep,
    buffer: state.home?.buffer,
  });
}

function validService(service) {
  return (
    !!service &&
    typeof service.id === "string" &&
    !!service.id &&
    Number.isFinite(service.scheduledDeparture) &&
    Number.isFinite(service.scheduledArrival) &&
    service.scheduledArrival >= service.scheduledDeparture &&
    Number.isFinite(service.walk) &&
    service.walk >= 0 &&
    Number.isFinite(service.afterWalk) &&
    service.afterWalk >= 0
  );
}

/** Provider arrival is the last transit leg. Never infer a transfer arrival from first-leg delay. */
export function journeyTiming(j, service = j.service, now = Date.now()) {
  const dep = serviceTime(service, "departure", now),
    arr = serviceTime(service, "arrival", now);
  const rawLeave = dep.time - (service.walk + j.settings.buffer) * 60000;
  const samePlan = service.id === j.service.id;
  const leave =
    samePlan && Number.isFinite(j.committed?.leave)
      ? Math.min(j.committed.leave, rawLeave)
      : rawLeave;
  const elapsed =
    j.startedAt == null ? 0 : Math.max(0, (now - j.startedAt) / 60000);
  const extra = Number.isFinite(j.extra) && j.extra >= 0 ? j.extra : 0;
  const remaining =
    j.departedAt != null
      ? 0
      : Number.isFinite(j.remainingOverrideUntil)
        ? Math.max(0, (j.remainingOverrideUntil - now) / 60000)
        : j.readyAt != null
          ? 0
          : Math.max(0, j.settings.prep + extra - elapsed);
  const ready = now + remaining * 60000;
  const arrival = arr.time + service.afterWalk * 60000;
  const deadline = Date.parse(
    `${j.settings.date}T${j.settings.arriveBy}:00+10:00`,
  );
  const numbersValid = [
    now,
    dep.time,
    arr.time,
    leave,
    arrival,
    deadline,
    ready,
  ].every(Number.isFinite);
  const feasible =
    validService(service) &&
    numbersValid &&
    arr.time >= dep.time &&
    !service.cancelled &&
    !service.skipped &&
    !["changed", "cancelled", "stop-skipped", "unavailable"].includes(
      service.status,
    ) &&
    ready <= leave;
  return {
    departure: dep.time,
    live: dep.live,
    arrival,
    arrivalLive: arr.live,
    arrivalProjected: false,
    leave,
    start: leave - (j.settings.prep + extra) * 60000,
    remaining,
    elapsed,
    ready,
    gap: Math.max(0, (ready - leave) / 60000),
    feasible,
    late: Math.max(0, (arrival - deadline) / 60000),
  };
}

export function makeJourney(settings, service, services, now = Date.now()) {
  const trip = validateTrip(settings);
  if (!validService(service) || !Number.isFinite(now))
    throw new Error("This journey has incomplete transport information.");
  const leave =
    serviceTime(service, "departure", now).time -
    (service.walk + trip.buffer) * 60000;
  return {
    id: crypto.randomUUID(),
    mode: "real",
    settings: trip,
    service: structuredClone(service),
    services: structuredClone((services ?? [service]).filter(validService)),
    committed: { leave, start: leave - trip.prep * 60000 },
    startedAt: null,
    readyAt: null,
    departedAt: null,
    extra: 0,
    outcome: "",
    reason: "",
    feedbackSaved: false,
    createdAt: now,
  };
}

/** An explicit choice may change the plan; measured preparation timestamps are preserved. */
export function acceptPlan(j, service, now = Date.now()) {
  // Remove the current-plan floor for an explicit selection, including the same delayed service.
  const timing = journeyTiming({ ...j, service, committed: {} }, service, now);
  if (!timing.feasible)
    throw new Error("There is not enough preparation time for this journey.");
  j.service = structuredClone(service);
  j.committed = {
    start: j.startedAt == null ? timing.start : j.committed.start,
    leave: timing.leave,
  };
}

export function recommendService(settings, services, now = Date.now()) {
  const trip = validateTrip(settings),
    candidates = [];
  for (const service of services ?? []) {
    if (!validService(service)) continue;
    const timing = journeyTiming(
      {
        settings: trip,
        service,
        committed: {},
        extra: 0,
        startedAt: null,
        readyAt: null,
        departedAt: null,
      },
      service,
      now,
    );
    if (timing.feasible && Number.isFinite(timing.late))
      candidates.push({ service, timing, late: timing.late > 0 });
  }
  const identity = (a, b) => a.service.id.localeCompare(b.service.id);
  const onTime = candidates.filter((candidate) => !candidate.late);
  if (onTime.length)
    return onTime.sort(
      (a, b) =>
        b.timing.leave - a.timing.leave ||
        a.timing.arrival - b.timing.arrival ||
        identity(a, b),
    )[0];
  return (
    candidates.sort(
      (a, b) =>
        a.timing.arrival - b.timing.arrival ||
        b.timing.leave - a.timing.leave ||
        identity(a, b),
    )[0] ?? null
  );
}

export function advanceEarlierPlan(j, now = Date.now()) {
  if (
    !j?.service ||
    !j.settings ||
    !j.committed ||
    !Number.isFinite(now) ||
    j.departedAt != null ||
    !validService(j.service)
  )
    return false;
  if (
    j.service.cancelled ||
    j.service.skipped ||
    ["changed", "cancelled", "stop-skipped", "unavailable"].includes(
      j.service.status,
    )
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
