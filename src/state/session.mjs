import {
  restoreAddressState,
  createAddressState,
  makeJourney,
} from "../domain/address-planner.mjs";
import {
  restoreCompanion,
  awardSuccess,
  demoSamples,
  demoDays,
} from "../domain/companion.mjs";
import { measuredSample } from "../domain/learning.mjs";
import { feedbackChoice, timingComparison } from "../domain/preparation.mjs";
import { dateInBrisbane } from "../domain/live-planner.mjs";
export const emptySession = () => ({
  travel: createAddressState(),
  buddy: restoreCompanion(),
  recordings: {},
  useRecordings: false,
});
export function restoreSession(raw) {
  return {
    ...emptySession(),
    travel: restoreAddressState(raw?.travel),
    buddy: restoreCompanion(raw?.buddy),
    recordings:
      raw?.recordings && typeof raw.recordings === "object"
        ? raw.recordings
        : {},
    useRecordings: raw?.useRecordings === true,
  };
}
export function recordReady(session, now = Date.now()) {
  const j = session.travel.journey;
  if (!j || j.readyAt != null) return;
  delete j.remainingOverrideUntil;
  j.readyAt = now;
  const sample = measuredSample(j);
  if (sample && !session.travel.samples.some((s) => s.id === sample.id)) {
    session.travel.samples.push(sample);
    session.travel.samples = session.travel.samples.slice(-100);
  }
}
export function reportOutcome(session, outcome, choice = {}, now = Date.now()) {
  const j = session.travel.journey;
  if (!j || j.companionOutcome || !j.departedAt) return false;
  const feedback = feedbackChoice(choice.category, choice.reasonDetails);
  const unlocked = awardSuccess(session.buddy, j, outcome, now);
  j.companionOutcome = { outcome, ...feedback, unlocked };
  j.armed = false;
  session.travel.reflections.push({
    id: j.id,
    at: now,
    ...j.companionOutcome,
    comparison: timingComparison(j),
    preparation: j.preparation,
  });
  session.travel.reflections = session.travel.reflections.slice(-30);
  return true;
}
export function makeDemo(seed = 0, now = Date.now()) {
  const value = emptySession();
  value.travel.home.place = { id: "PL:demo-home", label: "Home (demo)" };
  value.travel.profiles.uni.place = {
    id: "PL:demo-uni",
    label: "University (demo)",
  };
  value.travel.samples = demoSamples(now);
  value.buddy.successDays = demoDays(seed, now - 86400000);
  return value;
}
export function demoJourney(minutes, activities, now = Date.now()) {
  const settings = {
    origin: { id: "PL:demo-home", label: "Home (demo)" },
    destination: { id: "PL:demo-uni", label: "University (demo)" },
    date: dateInBrisbane(now),
    arriveBy: "23:59",
    prep: minutes,
    buffer: 2,
  };
  const departure = Math.floor((now + (minutes + 5) * 60000) / 1000);
  const service = {
    id: "demo-service",
    scheduledDeparture: departure,
    scheduledArrival: departure + 1200,
    walk: 1,
    afterWalk: 2,
    transfers: 0,
    legs: [
      {
        mode: "Bus",
        route: "116",
        from: "Demo stop",
        to: "Uni",
        scheduledDeparture: departure,
        scheduledArrival: departure + 1200,
      },
    ],
  };
  const j = makeJourney(settings, service, [service], now);
  j.profileId = "uni";
  j.destinationName = "Uni";
  j.armed = true;
  j.cues = [];
  j.preparation = { minutes, activities };
  return j;
}
