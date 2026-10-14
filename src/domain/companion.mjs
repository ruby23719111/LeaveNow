import { dateInBrisbane } from "./live-planner.mjs";

export const BUDDIES = [
  {
    id: "bus",
    name: "Bus Buddy",
    vehicle: "Brisbane bus",
    days: 0,
    rarity: "Starter",
    column: 0,
  },
  {
    id: "green_bus",
    name: "Green Buddy",
    vehicle: "Green & white bus",
    days: 0,
    rarity: "Starter",
    sheet: "quad",
  },
  {
    id: "metro",
    name: "Metro Mate",
    vehicle: "Brisbane Metro bus",
    days: 0,
    rarity: "Starter",
    sheet: "quad",
  },
  {
    id: "train",
    name: "Rail Pal",
    vehicle: "Queensland train",
    days: 1,
    rarity: "Common",
    column: 1,
  },
  {
    id: "tram",
    name: "Sunny",
    vehicle: "Gold Coast tram",
    days: 3,
    rarity: "Uncommon",
    column: 2,
  },
  {
    id: "ferry",
    name: "River Rover",
    vehicle: "CityCat ferry",
    days: 7,
    rarity: "Rare",
    column: 3,
  },
  {
    id: "bingo",
    name: "Bingo CityDog",
    vehicle: "Special ferry",
    days: 21,
    rarity: "Epic",
    column: 4,
  },
  {
    id: "bluey",
    name: "Bluey CityDog",
    vehicle: "Special ferry",
    days: 66,
    rarity: "Legendary",
    column: 5,
  },
];
export const LINES = {
  hello: "Hey, travel buddy! Where are we off to?",
  armed:
    "You're all set. I'll let you know when to get ready and when to head out.",
  prepare: "Time to get ready. Let's make this bus.",
  prepare_any: "Time to get ready. Let's make this trip.",
  leave: "Time to head out. You've got this.",
  caught: "Good on ya — you made it!",
  missed: "Ah, that's frustrating. What happened?",
  caring: "No worries. One missed trip doesn't undo your progress.",
  bus_early:
    "An early service can catch anyone out. That wasn't your preparation time.",
  cancelled: "That's a rough one. A cancelled service isn't on you.",
  data_wrong:
    "That information let you down. Let's keep that separate from your preparation time.",
  prep_long:
    "Thanks for letting me know. Your recorded preparation times can help us plan next time.",
  started_late:
    "Getting started can be the tricky bit. We can try an earlier reminder next time.",
  walk_long:
    "Sounds like the walk needed more time. That isn't time spent getting ready.",
  learning:
    "I've got a suggestion from your recorded preparation times. You decide what works for you.",
  updated: "All sorted. We'll use that preparation time for your next trip.",
  kept: "No worries. You're in charge. We'll keep your current preparation time.",
  check:
    "Let's check your trip before heading out. Read the latest update on screen.",
  preview: "G'day! I'll let you know when to get ready and when to head out.",
};
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const validDay = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

export function restoreCompanion(raw) {
  const days = [
    ...new Set(
      (Array.isArray(raw?.successDays) ? raw.successDays : []).filter(validDay),
    ),
  ].sort();
  const selected =
    BUDDIES.find((b) => b.id === raw?.selected && b.days <= days.length)?.id ||
    "bus";
  return {
    version: 1,
    selected,
    successDays: days,
    voice: raw?.voice !== false,
    motion: raw?.motion !== false,
    dismissedSuggestion:
      typeof raw?.dismissedSuggestion === "string"
        ? raw.dismissedSuggestion.slice(0, 4000)
        : "",
  };
}
export const unlockedBuddies = (companion) =>
  BUDDIES.filter((b) => b.days <= companion.successDays.length);
export function selectBuddy(companion, id) {
  if (!unlockedBuddies(companion).some((b) => b.id === id)) return false;
  companion.selected = id;
  return true;
}
/** Outcome is self-reported. Only a real departure can add a Brisbane calendar day. */
export function awardSuccess(companion, journey, outcome, now = Date.now()) {
  if (
    outcome !== "caught" ||
    journey?.mode !== "real" ||
    !Number.isFinite(journey.departedAt) ||
    journey.departedAt > now ||
    journey.departedAt <= 0
  )
    return [];
  const previous = companion.successDays.length;
  companion.successDays = [
    ...new Set([...companion.successDays, dateInBrisbane(journey.departedAt)]),
  ].sort();
  return BUDDIES.filter(
    (b) => b.days > previous && b.days <= companion.successDays.length,
  ).map((b) => b.id);
}
export function suggestionKey(samples, minutes, baseline, mode) {
  return JSON.stringify([
    samples
      .filter((s) => !s.excluded)
      .slice(-30)
      .map((s) => [s.id, s.startedAt, s.readyAt]),
    baseline,
  ]);
}
export function sprite(id = "bus", emotion = "calm", extra = "") {
  const buddy = BUDDIES.find((b) => b.id === id) || BUDDIES[0];
  const emotions = ["calm", "remind", "happy", "caring"];
  const frame = Math.max(0, emotions.indexOf(emotion));
  const label = frame === 1 ? "attentive" : emotions[frame];
  const x = buddy.sheet === "quad" ? (frame % 2) * 100 : buddy.column * 20;
  const y =
    buddy.sheet === "quad" ? Math.floor(frame / 2) * 100 : (frame * 100) / 3;
  return `<span class="buddy-sprite buddy-sprite-${buddy.id} ${extra}" role="img" aria-label="${esc(buddy.name)} looks ${label}" style="--buddy-x:${x}%;--buddy-y:${y}%"></span>`;
}
export function companionScene(
  companion,
  emotion,
  text,
  { compact = false } = {},
) {
  const name = (BUDDIES.find((b) => b.id === companion.selected) || BUDDIES[0])
    .name;
  return `<section class="companion-scene ${compact ? "compact" : ""}" aria-label="Your travel buddy"><button class="buddy-tap" data-buddy-action="greet" aria-label="Say hi to ${esc(name)}">${sprite(companion.selected, emotion)}</button><div class="buddy-bubble"><span class="buddy-name">${esc(name)}</span><p data-buddy-caption aria-live="polite">${esc(text)}</p><span class="buddy-playback" data-buddy-playback aria-live="polite"></span></div></section>`;
}
export function collectionMarkup(companion, demo = false) {
  const count = companion.successDays.length;
  const next = BUDDIES.filter((b) => b.days > count).sort(
    (a, b) => a.days - b.days,
  )[0];
  return `<p class="eyebrow">${demo ? "DEMO COLLECTION" : "YOUR TRAVEL CREW"}</p><p class="collection-progress"><strong>${count}</strong> successful ${count === 1 ? "day" : "days"}</p><p class="subtle">${next ? `${next.days - count} more to meet ${esc(next.name)}.` : "Your whole crew is here."} No streaks. No lost progress.</p><div class="buddy-collection">${BUDDIES.map(
    (b) => {
      const unlocked = b.days <= count,
        selected = companion.selected === b.id;
      return `<button class="buddy-card ${unlocked ? "" : "locked"} ${selected ? "selected" : ""}" data-buddy-action="select" data-id="${b.id}" ${unlocked ? "" : "disabled"} aria-pressed="${selected}">${sprite(b.id, unlocked ? "calm" : "calm")}<strong>${b.name}</strong><span>${b.vehicle}</span><small class="rarity rarity-${b.rarity.toLowerCase()}">${b.rarity}</small><span class="unlock-label">${selected ? "Your buddy ✓" : unlocked ? "Choose buddy" : `Unlock at ${b.days} days`}</span></button>`;
    },
  ).join(
    "",
  )}</div><p class="privacy-note">Self-reported successful travel days, counted once per Brisbane departure date. Days do not need to be consecutive. Every buddy has the same abilities. Stored in this browser.</p><p class="privacy-note">Student concept, not an official collaboration. CityDog designs reference Brisbane’s Bluey and Bingo ferries. <a href="https://www.bluey.tv/blog/brisbane-welcomes-citydogs/" target="_blank" rel="noopener">Meet the real CityDogs ↗</a></p>`;
}
export function demoSamples(now = Date.now()) {
  return [32, 28, 31].map((duration, index) => {
    const startedAt = now - (index + 1) * 86400000;
    const d = new Date(startedAt + 36000000),
      hour = d.getUTCHours() + d.getUTCMinutes() / 60;
    return {
      id: `demo-timing-${index}`,
      source: "real",
      startedAt,
      readyAt: startedAt + duration * 60000,
      duration,
      context: [
        Number([0, 6].includes(d.getUTCDay())),
        Math.sin((2 * Math.PI * hour) / 24),
        Math.cos((2 * Math.PI * hour) / 24),
      ],
    };
  });
}
export function demoDays(count, now = Date.now()) {
  return Array.from({ length: Math.max(0, Math.min(66, count)) }, (_, index) =>
    dateInBrisbane(now - index * 86400000),
  );
}
