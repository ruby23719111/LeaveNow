import { esc } from "./companion.mjs";

export const ACTIVITIES = Object.freeze({
  eat: "Eat",
  shower: "Shower",
  makeup: "Makeup",
  hair: "Hair styling",
  dressed: "Get dressed",
  bag: "Pack my bag",
  other: "Something else",
});
export const FEEDBACK = Object.freeze({
  preparation: {
    label: "Getting ready took longer",
    reason: "prep_long",
    details: { ...ACTIVITIES, unexpected: "Something unexpected" },
  },
  start: {
    label: "I started later than planned",
    reason: "started_late",
    details: {
      lost_time: "Lost track of time",
      finishing: "Was finishing something else",
      hard_start: "Found it hard to get started",
      reminder: "Didn’t notice the reminder",
    },
  },
  walk: {
    label: "Getting to the stop took longer",
    reason: "walk_long",
    details: {
      left_behind: "Left something behind",
      longer_walk: "The walk took longer",
      interruption: "An interruption on the way",
    },
  },
  transport: {
    label: "Something changed with transport",
    reason: "other",
    details: {
      bus_early: "The service arrived early",
      cancelled: "The service was cancelled or didn’t arrive",
      data_wrong: "The information didn’t match",
      boarding: "Couldn’t board",
    },
  },
  other: { label: "Something else / Not sure", reason: "other", details: {} },
});
const filtered = (values, options) =>
  Array.isArray(values)
    ? [
        ...new Set(
          values.filter(
            (v) => typeof v === "string" && Object.hasOwn(options, v),
          ),
        ),
      ]
    : [];
export const activityIds = (values) => filtered(values, ACTIVITIES);
export function preparationChoice(minutes, activities = []) {
  const value = Number(minutes);
  if (!Number.isInteger(value) || value < 1 || value > 240)
    throw Error("Choose 1 to 240 whole minutes to get ready.");
  return { minutes: value, activities: activityIds(activities) };
}
export function preparationDraft(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.profileId !== "string" ||
    typeof value.originId !== "string" ||
    typeof value.destinationId !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.arriveBy)
  )
    return null;
  // Keep incomplete numeric entry as a draft, never as an accepted trip time.
  const minutes = String(value.minutes ?? "").slice(0, 4);
  return {
    profileId: value.profileId,
    originId: value.originId,
    destinationId: value.destinationId,
    date: value.date,
    arriveBy: value.arriveBy,
    minutes,
    activities: activityIds(value.activities),
    visible: value.visible === true,
  };
}
export function matchesPreparation(draft, context) {
  return (
    !!draft &&
    ["profileId", "originId", "destinationId", "date", "arriveBy"].every(
      (key) => draft[key] === context[key],
    )
  );
}
// Keep reflection content outside the transport request, even if attached by a caller.
export function journeyRequest(settings, extra = {}) {
  const { origin, destination, date, arriveBy, prep, buffer } = settings;
  const request = { origin, destination, date, arriveBy, prep, buffer };
  for (const key of ["searchMode", "searchAt"])
    if (extra[key] != null) request[key] = extra[key];
  return request;
}
export function preparationFields(
  draft,
  usual,
  { demo = false, plain = false } = {},
) {
  return `<form id="trip-preparation-form" ${demo ? "data-demo-preparation" : ""} novalidate><p class="eyebrow">FOR THIS TRIP ONLY</p><h1>${plain ? "How much time do you need?" : "What do you need to do before heading out?"}</h1><p class="subtle">${plain ? "Choose your total time to get ready." : "Pick what applies, then allow time for the whole routine."}</p>${
    plain
      ? ""
      : `<div class="prep-chips" role="group" aria-label="Things to do before leaving">${Object.entries(
          ACTIVITIES,
        )
          .map(
            ([id, label]) =>
              `<button type="button" class="prep-chip" data-prep-activity="${id}" aria-pressed="${draft.activities.includes(id)}">${label}</button>`,
          )
          .join(
            "",
          )}</div><p class="subtle prep-hint">Optional — these prompts don’t add minutes.</p>`
  }<label for="trip-prep-minutes">Time to get ready<div class="input-unit"><input id="trip-prep-minutes" name="minutes" type="number" inputmode="numeric" min="1" max="240" step="1" value="${esc(draft.minutes)}" required><span>min</span></div></label><p class="subtle">Your usual setting is ${usual} minutes. It won’t change.</p><p class="form-error" role="alert"></p><button class="primary">${demo ? "See my demo plan" : "Find routes"}</button><button type="button" class="quiet" data-prep-skip>Skip · use my usual time</button></form>`;
}
export function feedbackChoice(category, details = []) {
  const key = Object.hasOwn(FEEDBACK, category) ? category : "";
  const selected = key ? filtered(details, FEEDBACK[key].details) : [];
  // Multiple transport causes use a neutral response rather than choosing one as fact.
  const reason =
    key === "transport" &&
    selected.length === 1 &&
    ["bus_early", "cancelled", "data_wrong"].includes(selected[0])
      ? selected[0]
      : FEEDBACK[key]?.reason || "";
  return { category: key, reason, reasonDetails: selected };
}
export function normaliseFeedback(record) {
  if (!record || typeof record !== "object") return record;
  if (Object.hasOwn(FEEDBACK, record.category))
    return {
      ...record,
      ...feedbackChoice(record.category, record.reasonDetails),
    };
  const category =
    {
      prep_long: "preparation",
      started_late: "start",
      walk_long: "walk",
      bus_early: "transport",
      cancelled: "transport",
      data_wrong: "transport",
      other: "other",
    }[record.reason] || "";
  const details = category === "transport" ? [record.reason] : [];
  return { ...record, ...feedbackChoice(category, details) };
}
export function timingComparison(journey) {
  if (
    !journey ||
    journey.mode !== "real" ||
    !Number.isFinite(journey.startedAt) ||
    !Number.isFinite(journey.readyAt)
  )
    return null;
  const minutes = (journey.readyAt - journey.startedAt) / 60000;
  if (
    minutes < 0.5 ||
    minutes > 240 ||
    !Number.isInteger(journey.settings?.prep)
  )
    return null;
  return { planned: journey.settings.prep, recorded: Math.round(minutes) };
}
export function deleteFeedback(state) {
  state.reflections = [];
  if (state.journey) {
    delete state.journey.feedbackDraft;
    if (state.journey.companionOutcome) {
      const { outcome, unlocked } = state.journey.companionOutcome;
      state.journey.companionOutcome = {
        outcome,
        unlocked,
        feedbackDeleted: true,
      };
    }
  }
}
