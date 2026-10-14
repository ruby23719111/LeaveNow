export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4174"
).replace(/\/$/, "");
export async function api(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(API_BASE + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const value = await response.json();
    if (!response.ok)
      throw Error(value.error || "Transport information unavailable.");
    return value;
  } catch (e) {
    if (e.message === "Network request failed" || e.name === "AbortError")
      throw Error(
        "Could not reach the transport service. Keep your Mac running and both devices on the same Wi-Fi, or try Demo mode in settings.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export const officialUrl =
  "https://jp.translink.com.au/plan-your-journey/journey-planner";
