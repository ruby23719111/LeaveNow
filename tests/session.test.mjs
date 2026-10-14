import test from "node:test";
import assert from "node:assert/strict";
import {
  emptySession,
  restoreSession,
  makeDemo,
  demoJourney,
  recordReady,
  reportOutcome,
} from "../src/state/session.mjs";
import { estimatePreparation } from "../src/domain/learning.mjs";
import { journeyRequest, deleteFeedback } from "../src/domain/preparation.mjs";
const now = Date.parse("2026-10-14T08:00:00+10:00");
test("native storage restores measured records and independent collection", () => {
  const s = emptySession();
  s.buddy.successDays = ["2026-10-10"];
  s.buddy.selected = "train";
  s.travel.home.prep = 40;
  const r = restoreSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.travel.home.prep, 40);
  assert.equal(r.buddy.selected, "train");
  assert.equal(r.travel.journey, null);
});
test("a measured ready event is saved once; feedback is not a training sample", () => {
  const s = emptySession();
  s.travel.journey = demoJourney(30, ["shower"], now);
  s.travel.journey.startedAt = now;
  recordReady(s, now + 36 * 60000);
  recordReady(s, now + 40 * 60000);
  assert.equal(s.travel.samples.length, 1);
  assert.equal(s.travel.samples[0].duration, 36);
  s.travel.journey.departedAt = now + 37 * 60000;
  reportOutcome(
    s,
    "missed",
    { category: "transport", reasonDetails: ["bus_early"] },
    now + 40 * 60000,
  );
  assert.equal(s.travel.home.prep, 22);
  assert.equal(s.travel.samples.length, 1);
  assert.equal(s.travel.reflections[0].reason, "bus_early");
});
test("success is idempotent across taps and storage reloads", () => {
  let s = emptySession();
  s.travel.journey = demoJourney(30, [], now);
  s.travel.journey.departedAt = now;
  assert.equal(reportOutcome(s, "caught", {}, now), true);
  assert.equal(reportOutcome(s, "caught", {}, now), false);
  s = restoreSession(JSON.parse(JSON.stringify(s)));
  assert.equal(reportOutcome(s, "caught", {}, now), false);
  assert.equal(s.buddy.successDays.length, 1);
  assert.deepEqual(s.travel.journey.companionOutcome.unlocked, ["train"]);
});
test("demo samples and rewards do not mutate real state", () => {
  const real = emptySession(),
    demo = makeDemo(65, now);
  demo.travel.journey = demoJourney(40, [], now);
  demo.travel.journey.departedAt = now;
  reportOutcome(demo, "caught", {}, now);
  assert.equal(demo.buddy.successDays.length, 66);
  assert.equal(real.buddy.successDays.length, 0);
  assert.equal(real.travel.samples.length, 0);
  assert.equal(estimatePreparation(demo.travel.samples, 22).sampleCount, 3);
});
test("trip-specific preparation affects the plan but not usual settings", () => {
  const real = emptySession(),
    j = demoJourney(40, ["eat"], now);
  assert.equal((j.committed.leave - j.committed.start) / 60000, 40);
  assert.equal(real.travel.home.prep, 22);
});
test("transport payload excludes reflection data and delete preserves collection", () => {
  const s = emptySession();
  s.travel.journey = demoJourney(30, ["shower"], now);
  const payload = journeyRequest({
    ...s.travel.journey.settings,
    activities: ["shower"],
    feedback: "private",
  });
  assert.equal("activities" in payload, false);
  assert.equal("feedback" in payload, false);
  s.travel.journey.departedAt = now;
  reportOutcome(s, "caught", {}, now);
  deleteFeedback(s.travel);
  assert.equal(s.travel.reflections.length, 0);
  assert.equal(s.buddy.successDays.length, 1);
  assert.equal(reportOutcome(s, "caught", {}, now), false);
});
