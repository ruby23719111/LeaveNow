import { serviceTime } from "./live-planner.mjs";

const MAX_AHEAD = 31 * 86400000;
const validEpoch = (value) =>
  Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

/** An import request only. The native app must ask for confirmation and report scheduling. */
export function iPhoneAlarmHandoff(
  j,
  destination = "Destination",
  now = Date.now(),
) {
  if (!validEpoch(now))
    throw new Error("Check your device date and time before setting alarms.");
  if (
    !j ||
    j.armed !== true ||
    j.departedAt != null ||
    j.cancelled ||
    j.cancelledAt != null ||
    !validId(j.id)
  ) {
    throw new Error("Choose an active trip before setting iPhone alarms.");
  }
  const service = j.service;
  if (
    !service ||
    service.cancelled ||
    service.skipped ||
    ["changed", "cancelled", "unavailable", "stop-skipped"].includes(
      service.status,
    ) ||
    j.feed?.status === "unavailable"
  ) {
    throw new Error(
      "This journey could not be confirmed. Review it before setting iPhone alarms.",
    );
  }
  const ready = j.committed?.start,
    leave = j.committed?.leave;
  if (!validEpoch(ready) || !validEpoch(leave) || ready > leave)
    throw new Error(
      "This trip has invalid reminder times. Please choose a trip again.",
    );
  if (
    leave <= now ||
    !Number.isFinite(serviceTime(service, "departure", now).time) ||
    serviceTime(service, "departure", now).time <= now
  ) {
    throw new Error(
      "The leave time has passed. Review your next trip before setting alarms.",
    );
  }
  if (leave - now > MAX_AHEAD)
    throw new Error("Set iPhone alarms for a trip within the next 31 days.");
  const label =
    typeof destination === "string"
      ? Array.from(destination.replace(/[\u0000-\u001f\u007f]/g, "").trim())
          .slice(0, 64)
          .join("") || "Destination"
      : "Destination";
  const payload = {
    planId: j.id,
    ready,
    leave,
    destination: label,
    issuedAt: now,
  };
  // Foundation URLComponents preserves literal + characters instead of form-decoding them.
  const query = new URLSearchParams(
    Object.entries(payload).map(([key, value]) => [key, String(value)]),
  )
    .toString()
    .replace(/\+/g, "%20");
  const url = "leavenow://alarms?" + query;
  return { ...payload, prepareInPast: ready <= now, url };
}

/** A saved attempt never proves that iOS accepted or still has the alarms. */
export function hasIPhoneHandoff(j) {
  const attempt = j?.iphoneHandoff;
  return (
    !!attempt &&
    attempt.status === "attempted" &&
    validId(attempt.planId) &&
    validEpoch(attempt.ready) &&
    validEpoch(attempt.leave) &&
    validEpoch(attempt.issuedAt)
  );
}

export function iPhoneHandoffChanged(j) {
  return (
    hasIPhoneHandoff(j) &&
    (j.iphoneHandoff.planId !== j.id ||
      j.iphoneHandoff.ready !== j.committed?.start ||
      j.iphoneHandoff.leave !== j.committed?.leave)
  );
}
