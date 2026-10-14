// These public website endpoints are not a documented third-party API.
// Keep a provider link available if its response format or availability changes.
export const ADDRESS_PLANNER_URL =
  "https://jp.translink.com.au/plan-your-journey/journey-planner";
export const ADDRESS_SEARCH_URL =
  "https://jp.translink.com.au/api/location/search";
export const ADDRESS_PLAN_URL = "https://jp.translink.com.au/api/plan";
const addressModes = new Set(["Walk", "Bus", "Train", "Ferry", "Tram"]);

function addressText(value, max, message) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error(message);
  return value.trim();
}
function addressLocation(value) {
  if (!value || typeof value !== "object")
    throw new Error("Choose an address from the location suggestions.");
  const id = addressText(
    value.id,
    240,
    "Choose an address from the location suggestions.",
  );
  if (!/^(PL|SI|ST):[A-Za-z0-9_.-]+$/.test(id))
    throw new Error("Choose an address from the location suggestions.");
  return {
    id,
    label: addressText(
      value.label,
      300,
      "Choose an address from the location suggestions.",
    ),
  };
}
function addressDateTime(date, time) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")
  )
    throw new Error("Choose a valid travel date and arrival time.");
  const epoch = Date.parse(`${date}T${time}:00+10:00`);
  if (
    !Number.isFinite(epoch) ||
    new Date(epoch + 36000000).toISOString().slice(0, 10) !== date
  )
    throw new Error("Choose a valid travel date and arrival time.");
  return epoch;
}
export function addressPlanParams(settings) {
  const origin = addressLocation(settings?.origin),
    destination = addressLocation(settings?.destination);
  if (origin.id === destination.id)
    throw new Error("Choose different home and destination addresses.");
  addressDateTime(settings.date, settings.arriveBy);
  let date = settings.date,
    time = settings.arriveBy,
    mode = "ArriveBefore";
  if (
    settings.searchMode != null &&
    !["arriveBefore", "leaveAfter"].includes(settings.searchMode)
  )
    throw new Error("Choose a valid journey search mode.");
  if (settings.searchMode === "leaveAfter") {
    if (
      typeof settings.searchAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
        settings.searchAt,
      )
    )
      throw new Error("Choose a valid earliest departure time.");
    const epoch = Date.parse(settings.searchAt);
    if (
      !Number.isFinite(epoch) ||
      new Date(epoch).toISOString().slice(0, 19) !==
        settings.searchAt.slice(0, 19)
    )
      throw new Error("Choose a valid earliest departure time.");
    // Round upward: a departure search must never precede the user's readiness.
    const local = new Date(
      Math.ceil(epoch / 60000) * 60000 + 36000000,
    ).toISOString();
    date = local.slice(0, 10);
    time = local.slice(11, 16);
    mode = "LeaveAfter";
  }
  const maximumWalkingDistance = settings.maxWalk ?? 1000;
  if (![100, 250, 500, 1000, 1500, 2000, 4000].includes(maximumWalkingDistance))
    throw new Error(
      "Choose a maximum walking distance between 100 m and 4 km.",
    );
  const [hour, minute] = time.split(":").map(Number);
  const params = new URLSearchParams({
    searchDate: date,
    searchTime: `${hour % 12 || 12}:${String(minute).padStart(2, "0")}${hour < 12 ? "am" : "pm"}`,
    startLocationId: origin.id,
    start: origin.label,
    endLocationId: destination.id,
    end: destination.label,
    timeSearchMode: mode,
    maximumWalkingDistance: String(maximumWalkingDistance),
    walkingSpeed: "Normal",
  });
  for (const transport of ["Bus", "Train", "Ferry", "Tram"])
    params.append("transportModes", transport);
  for (const serviceType of ["Regular", "Express", "NightLink"])
    params.append("serviceTypes", serviceType);
  for (const fareType of ["Standard", "Prepaid", "Free"])
    params.append("fareTypes", fareType);
  return params;
}
export function addressPlannerLink(settings) {
  return `${ADDRESS_PLANNER_URL}?${addressPlanParams(settings)}`;
}

async function addressFetchJson(url, init, options, maxBytes) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 12000,
  );
  let response;
  try {
    // Workerd supports manual/follow; manual plus the status check rejects redirects.
    response = await (options.fetchImpl ?? fetch)(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "application/json", ...init.headers },
    });
    if (!response.ok)
      throw new Error(
        "The official journey planner is unavailable. Please try again or open Translink.",
      );
    if (!/application\/json/i.test(response.headers.get("content-type") || ""))
      throw new Error(
        "The official journey planner returned an unexpected response.",
      );
    const reader = response.body?.getReader();
    if (!reader)
      throw new Error(
        "The official journey planner returned an empty response.",
      );
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(
          "The official journey response was too large. Please open Translink.",
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error(
        "The official journey planner returned an unexpected response.",
      );
    }
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The official journey planner took too long to respond. Please try again.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "The official journey planner could not be reached. Please try again.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function searchLocations(query, options = {}) {
  const text = addressText(
    query,
    200,
    "Enter a location between 2 and 200 characters.",
  );
  if (text.length < 2)
    throw new Error("Enter at least 2 characters to search for an address.");
  const url = new URL(ADDRESS_SEARCH_URL);
  url.searchParams.set("location", text);
  const raw = await addressFetchJson(
    url.href,
    { method: "GET" },
    options,
    128000,
  );
  if (!Array.isArray(raw))
    throw new Error(
      "The official location search returned an unexpected response.",
    );
  const result = [],
    seen = new Set();
  for (const value of raw.slice(0, 40)) {
    try {
      const item = addressLocation({
        id: value.LocationId,
        label: value.Description,
      });
      if (!seen.has(item.id)) {
        result.push(item);
        seen.add(item.id);
      }
    } catch {
      /* Ignore an unsupported location rather than inventing a coordinate. */
    }
  }
  return result;
}
function addressEpoch(value) {
  if (typeof value !== "string" || !/Z$/.test(value)) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch / 1000 : null;
}
function addressPoint(value) {
  if (!value || typeof value !== "object") return null;
  const point = {
    id: typeof value.id === "string" ? value.id : "",
    label: String(value.name ?? value.description ?? "").slice(0, 300),
  };
  if (
    Number.isFinite(value.position?.lat) &&
    Number.isFinite(value.position?.lng)
  )
    point.position = { lat: value.position.lat, lng: value.position.lng };
  return point;
}
function addressNotice(value) {
  return {
    id: value?.id ?? null,
    title: String(value?.title ?? "").slice(0, 300),
    description: String(value?.description ?? "").slice(0, 3000),
    severity: String(value?.severity ?? ""),
    cause: String(value?.cause ?? ""),
    effect: String(value?.effect ?? ""),
  };
}
export function normalizeAddressPlan(raw, settings, now = Date.now()) {
  if (!raw || !Array.isArray(raw.itineraries))
    throw new Error(
      "The official journey planner returned an unexpected response.",
    );
  const officialUrl = addressPlannerLink(settings),
    services = [],
    seen = new Set();
  const enquiry = raw.originalEnquiry || {},
    origin = addressPoint(enquiry.startLocation) || settings.origin,
    destination = addressPoint(enquiry.endLocation) || settings.destination;
  for (const itinerary of raw.itineraries.slice(0, 20)) {
    if (
      !itinerary ||
      !Array.isArray(itinerary.legs) ||
      !itinerary.legs.length ||
      itinerary.legs.length > 40 ||
      itinerary.legs.some((leg) => !leg || typeof leg !== "object")
    )
      continue;
    const legs = itinerary.legs.map((leg, index) => {
      const from = addressPoint(leg.origin) || (index === 0 ? origin : null),
        to =
          addressPoint(leg.destination) ||
          (index === itinerary.legs.length - 1 ? destination : null);
      const departure = addressEpoch(leg.departureTimeUtc),
        arrival = addressEpoch(leg.arrivalTimeUtc);
      return {
        mode: leg.travelMode,
        route: String(leg.legRoute?.code ?? ""),
        routeName: String(leg.legRoute?.name ?? ""),
        headsign: String(leg.tripHeadsign ?? ""),
        from: from?.label || "",
        to: to?.label || "",
        origin: from,
        destination: to,
        scheduledDeparture: departure,
        scheduledArrival: arrival,
        durationMins:
          departure != null && arrival != null
            ? (arrival - departure) / 60
            : null,
        distanceM:
          Number.isFinite(leg.distanceM) && leg.distanceM >= 0
            ? leg.distanceM
            : null,
        tripId: String(leg.tripId ?? ""),
        sameVehicleContinuation: leg.sameVehicleContinuation === true,
        cancelled: leg.cancelled === true || leg.isCancelled === true,
        notices: Array.isArray(leg.notices)
          ? leg.notices.map(addressNotice)
          : [],
      };
    });
    // A broken transfer or missing time cannot become a catchable recommendation.
    if (
      legs.some(
        (leg, index) =>
          !addressModes.has(leg.mode) ||
          leg.scheduledDeparture == null ||
          leg.scheduledArrival == null ||
          leg.scheduledArrival < leg.scheduledDeparture ||
          (index > 0 &&
            leg.scheduledDeparture < legs[index - 1].scheduledArrival),
      )
    )
      continue;
    const transit = legs.filter((leg) => leg.mode !== "Walk");
    if (
      !transit.length ||
      transit.some(
        (leg) => !leg.tripId || !leg.origin?.id || !leg.destination?.id,
      )
    )
      continue;
    const first = transit[0],
      last = transit.at(-1),
      firstIndex = legs.indexOf(first),
      lastIndex = legs.indexOf(last);
    const walk = Math.ceil(
        legs
          .slice(0, firstIndex)
          .reduce((sum, leg) => sum + leg.durationMins, 0),
      ),
      afterWalk = Math.ceil(
        legs
          .slice(lastIndex + 1)
          .reduce((sum, leg) => sum + leg.durationMins, 0),
      );
    const identity = transit
      .map((leg) => `${leg.tripId}:${leg.origin.id}:${leg.destination.id}`)
      .join("|");
    const id = `jp:${identity}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const cancelled =
      itinerary.cancelled === true ||
      itinerary.isCancelled === true ||
      transit.some((leg) => leg.cancelled);
    services.push({
      id,
      tripId: first.tripId,
      serviceDate: new Date(first.scheduledDeparture * 1000 + 36000000)
        .toISOString()
        .slice(0, 10),
      route: transit.map((leg) => leg.route || leg.mode).join(" → "),
      headsign: last.headsign || destination.label,
      origin: settings.origin.id,
      destination: settings.destination.id,
      boardingStop: first.origin,
      alightingStop: last.destination,
      scheduledDeparture: first.scheduledDeparture,
      scheduledArrival: last.scheduledArrival,
      scheduledLeave: legs[0].scheduledDeparture,
      scheduledDoorArrival: legs.at(-1).scheduledArrival,
      predictedDeparture: null,
      predictedArrival: null,
      observedAt: null,
      cancelled,
      skipped: false,
      status: cancelled ? "cancelled" : "scheduled",
      walk,
      afterWalk,
      transfers:
        Number.isInteger(itinerary.transfers) && itinerary.transfers >= 0
          ? itinerary.transfers
          : transit.slice(1).filter((leg) => !leg.sameVehicleContinuation)
              .length,
      legs,
      source: "translink-journey-planner",
      officialUrl,
    });
  }
  services.sort((a, b) => a.scheduledDeparture - b.scheduledDeparture);
  return {
    services,
    feed: {
      status: "scheduled",
      timestamp: null,
      fetchedAt: now / 1000,
      source: ADDRESS_PLAN_URL,
    },
    timezone: "Australia/Brisbane",
    attribution:
      "Journey information from Translink, Queensland Government. LeaveNow is an independent prototype.",
    officialUrl,
    notices: Array.isArray(raw.notices)
      ? raw.notices.slice(0, 60).map(addressNotice)
      : [],
    messages: Array.isArray(raw.messages) ? raw.messages.slice(0, 20) : [],
  };
}
export async function planAddressJourneys(settings, options = {}) {
  const params = addressPlanParams(settings);
  const raw = await addressFetchJson(
    ADDRESS_PLAN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: params.toString(),
    },
    options,
    3000000,
  );
  return normalizeAddressPlan(raw, settings, options.now ?? Date.now());
}
