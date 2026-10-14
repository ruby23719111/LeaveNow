export const REASONS = {
  prep_long: "Getting ready took longer",
  started_late: "I started getting ready late",
  walk_long: "The walk took longer",
  bus_early: "The bus arrived early",
  data_wrong: "The transport information was wrong",
  cancelled: "The service was cancelled",
  other: "Something else",
};
export function dateInBrisbane(epoch = Date.now()) {
  return new Date(epoch + 36000000).toISOString().slice(0, 10);
}
export function displayTime(epoch, withDate = false) {
  if (!Number.isFinite(epoch)) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(withDate ? { day: "numeric", month: "short" } : {}),
  }).format(new Date(epoch));
}
export function validateTrip(values) {
  const out = {
    origin: String(values.origin || ""),
    destination: String(values.destination || ""),
    date: values.date,
    arriveBy: values.arriveBy,
  };
  if (
    !/^\d+$/.test(out.origin) ||
    !/^\d+$/.test(out.destination) ||
    out.origin === out.destination
  )
    throw new Error("Choose your boarding and destination stops.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(out.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(out.arriveBy)
  )
    throw new Error("Choose a valid date and arrival time.");
  const deadline = Date.parse(out.date + "T" + out.arriveBy + ":00+10:00");
  if (!Number.isFinite(deadline) || dateInBrisbane(deadline) !== out.date)
    throw new Error("Choose a valid date.");
  for (const [key, min, max] of [
    ["prep", 1, 240],
    ["walk", 1, 60],
    ["afterWalk", 0, 60],
    ["buffer", 1, 30],
  ]) {
    const n = Number(values[key]);
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`${key} must be a whole number from ${min} to ${max}.`);
    out[key] = n;
  }
  return out;
}
export function serviceTime(s, kind, now = Date.now()) {
  const fresh =
    s.observedAt &&
    now / 1000 - s.observedAt <= 180 &&
    s.observedAt - now / 1000 <= 30;
  const prediction =
    kind === "departure" ? s.predictedDeparture : s.predictedArrival;
  const schedule =
    kind === "departure" ? s.scheduledDeparture : s.scheduledArrival;
  return {
    time: (fresh && Number.isFinite(prediction) ? prediction : schedule) * 1000,
    live: !!fresh && Number.isFinite(prediction),
  };
}
export function journeyTiming(j, service = j.service, now = Date.now()) {
  const dep = serviceTime(service, "departure", now),
    arr = serviceTime(service, "arrival", now);
  const rawLeave = dep.time - (j.settings.walk + j.settings.buffer) * 60000;
  const leave =
    !dep.live && service.id === j.service.id
      ? Math.min(j.committed.leave, rawLeave)
      : rawLeave;
  const elapsed =
    j.startedAt == null ? 0 : Math.max(0, (now - j.startedAt) / 60000);
  const remaining =
    j.departedAt != null
      ? 0
      : Number.isFinite(j.remainingOverrideUntil)
        ? Math.max(0, (j.remainingOverrideUntil - now) / 60000)
        : j.readyAt != null
          ? 0
          : Math.max(0, j.settings.prep + j.extra - elapsed);
  const ready = now + remaining * 60000;
  const projected = dep.live && !arr.live;
  const busArrival = projected
    ? Math.max(
        arr.time,
        dep.time +
          (service.scheduledArrival - service.scheduledDeparture) * 1000,
      )
    : arr.time;
  const arrival = busArrival + j.settings.afterWalk * 60000;
  const deadline = Date.parse(
    j.settings.date + "T" + j.settings.arriveBy + ":00+10:00",
  );
  return {
    departure: dep.time,
    live: dep.live,
    arrival,
    arrivalLive: arr.live,
    arrivalProjected: projected,
    leave,
    start: leave - (j.settings.prep + j.extra) * 60000,
    remaining,
    elapsed,
    ready,
    gap: Math.max(0, (ready - leave) / 60000),
    feasible:
      !service.cancelled &&
      !service.skipped &&
      service.status !== "changed" &&
      ready <= leave,
    late: Math.max(0, (arrival - deadline) / 60000),
  };
}
export function makeJourney(settings, service, services, now = Date.now()) {
  const leave =
    serviceTime(service, "departure", now).time -
    (settings.walk + settings.buffer) * 60000;
  return {
    id: crypto.randomUUID(),
    mode: "real",
    settings,
    service,
    services,
    committed: { leave, start: leave - settings.prep * 60000 },
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
export function acceptPlan(j, service, now = Date.now()) {
  const timing = journeyTiming(j, service, now);
  if (!timing.feasible)
    throw new Error("There is not enough preparation time for this service.");
  j.service = service;
  j.committed = {
    start: j.startedAt == null ? timing.start : j.committed.start,
    leave: timing.leave,
  };
}
export function extendPreparation(j, now = Date.now()) {
  if (j.startedAt == null || j.readyAt != null)
    throw new Error("Extra time is available while you are getting ready.");
  j.extra =
    Math.max(j.extra, (now - j.startedAt) / 60000 - j.settings.prep) + 5;
}
