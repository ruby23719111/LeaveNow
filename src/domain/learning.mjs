export function prepContext(epoch) {
  const d = new Date(epoch + 36000000),
    hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  return [
    Number([0, 6].includes(d.getUTCDay())),
    Math.sin((2 * Math.PI * hour) / 24),
    Math.cos((2 * Math.PI * hour) / 24),
  ];
}
export function measuredSample(journey, confirmedLong = false) {
  if (
    journey.mode !== "real" ||
    !Number.isFinite(journey.startedAt) ||
    !Number.isFinite(journey.readyAt)
  )
    return null;
  const duration = (journey.readyAt - journey.startedAt) / 60000;
  if (duration < 0.5 || duration > 1440 || (duration > 240 && !confirmedLong))
    return null;
  return {
    id: journey.id,
    source: "real",
    startedAt: journey.startedAt,
    readyAt: journey.readyAt,
    duration,
    context: prepContext(journey.startedAt),
    confirmedLong,
    excluded: false,
  };
}
export function validSamples(records) {
  const unique = new Map();
  for (const r of records) {
    const duration = (r?.readyAt - r?.startedAt) / 60000;
    if (
      r?.source !== "real" ||
      r.excluded ||
      !Number.isFinite(duration) ||
      duration < 0.5 ||
      duration > 1440 ||
      (duration > 240 && !r.confirmedLong) ||
      !Array.isArray(r.context) ||
      r.context.length !== 3 ||
      !r.context.every(Number.isFinite)
    )
      continue;
    unique.set(r.id, { ...r, duration });
  }
  return [...unique.values()]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-30);
}
function solve(a, b) {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < b.length; i++) {
    let pivot = i;
    for (let j = i + 1; j < b.length; j++)
      if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot = j;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    if (Math.abs(m[i][i]) < 1e-10)
      throw new Error("Insufficient model variation");
    const div = m[i][i];
    for (let k = i; k <= b.length; k++) m[i][k] /= div;
    for (let j = 0; j < b.length; j++)
      if (j !== i) {
        const scale = m[j][i];
        for (let k = i; k <= b.length; k++) m[j][k] -= scale * m[i][k];
      }
  }
  return m.map((row) => row[b.length]);
}
export function estimatePreparation(records, baseline, at = Date.now()) {
  const samples = validSamples(records),
    n = samples.length,
    base = Math.max(1, Math.min(240, Number(baseline) || 22));
  if (n < 3)
    return { minutes: base, sampleCount: n, mode: "insufficient", range: null };
  const average =
    base + samples.reduce((sum, r) => sum + r.duration - base, 0) / (n + 3);
  let estimate = average,
    mode = "personal-average";
  if (n >= 8) {
    const mean = [0, 1, 2].map(
      (i) => samples.reduce((sum, r) => sum + r.context[i], 0) / n,
    );
    const x = samples.map((r) => [1, ...r.context.map((v, i) => v - mean[i])]);
    const a = Array.from({ length: 4 }, (_, i) =>
      Array.from(
        { length: 4 },
        (_, j) =>
          x.reduce((sum, row) => sum + row[i] * row[j], 0) +
          (i === j ? (i === 0 ? 3 : 12) : 0),
      ),
    );
    const b = Array.from({ length: 4 }, (_, i) =>
      x.reduce(
        (sum, row, index) => sum + row[i] * (samples[index].duration - base),
        0,
      ),
    );
    try {
      const beta = solve(a, b),
        target = [1, ...prepContext(at).map((v, i) => v - mean[i])];
      estimate = base + beta.reduce((sum, v, i) => sum + v * target[i], 0);
      mode = "contextual";
    } catch {
      /* mean fit remains available */
    }
  }
  return {
    minutes: Math.ceil(Math.max(1, Math.min(240, estimate))),
    sampleCount: n,
    mode,
    range: [
      Math.floor(Math.min(...samples.map((r) => r.duration))),
      Math.ceil(Math.max(...samples.map((r) => r.duration))),
    ],
  };
}
