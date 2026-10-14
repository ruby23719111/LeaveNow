import http from "node:http";
import { searchLocations, planAddressJourneys } from "./transit.mjs";
const initialPort = Number(process.env.LEAVENOW_API_PORT || 4174);
let port = initialPort;
// Development only: LAN binding lets your iPhone reach this Mac. No request logging.
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  if (
    origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.[\d.]+|10\.[\d.]+|172\.(1[6-9]|2\d|3[01])\.[\d.]+)(:\d+)?$/.test(
      origin,
    )
  )
    res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") {
      res.end(
        JSON.stringify({
          ok: true,
          service: "LeaveNow development transport API",
        }),
      );
      return;
    }
    if (url.pathname === "/api/locations" && req.method === "GET") {
      res.end(
        JSON.stringify({
          locations: await searchLocations(url.searchParams.get("q")),
        }),
      );
      return;
    }
    if (url.pathname === "/api/plan" && req.method === "POST") {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8000) throw Error("Request too large");
        chunks.push(chunk);
      }
      const result = await planAddressJourneys(
        JSON.parse(Buffer.concat(chunks).toString()),
      );
      res.end(JSON.stringify(result));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (e) {
    res.writeHead(502);
    res.end(
      JSON.stringify({
        error: e.message || "Transport information unavailable.",
      }),
    );
  }
});
const host = process.env.LEAVENOW_API_HOST || "0.0.0.0";
server.on("error", (error) => {
  if (
    error.code === "EADDRINUSE" &&
    process.env.LEAVENOW_AUTO_PORT === "1" &&
    port < initialPort + 10
  ) {
    console.log(`Port ${port} is busy; trying ${port + 1}.`);
    port++;
    server.listen(port, host);
    return;
  }
  console.error(
    error.code === "EADDRINUSE"
      ? `Transport port ${port} is already in use. Run npm run dev to select a free port automatically.`
      : `Could not start transport API: ${error.message}`,
  );
  process.exitCode = 1;
  process.disconnect?.();
});
server.on("listening", () => {
  const address = server.address();
  console.log(`Transport API on port ${address.port}. Development LAN only.`);
  process.send?.({ type: "ready", port: address.port });
});
server.listen(port, host);
