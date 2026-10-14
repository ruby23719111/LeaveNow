import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";
const addresses = Object.entries(networkInterfaces()).flatMap(
  ([name, values]) =>
    values
      .filter((a) => a.family === "IPv4" && !a.internal)
      .map((a) => ({ name, address: a.address })),
);
const ip =
  addresses.find((a) => a.name === "en0")?.address ||
  addresses.find((a) => a.name === "en1")?.address ||
  addresses[0]?.address ||
  "127.0.0.1";
let expo;
let closing = false;
const api = spawn(process.execPath, ["server/index.mjs"], {
  stdio: ["inherit", "inherit", "inherit", "ipc"],
  env: { ...process.env, LEAVENOW_AUTO_PORT: "1" },
});
function stop(code = 0) {
  if (closing) return;
  closing = true;
  api.kill();
  expo?.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
api.on("error", (error) => {
  console.error(`Could not start LeaveNow transport API: ${error.message}`);
  stop(1);
});
api.on("exit", (code) => {
  if (!closing) stop(code || 1);
});
api.once("message", (message) => {
  if (closing || message.type !== "ready") return;
  const env = {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL:
      process.env.EXPO_PUBLIC_API_BASE_URL || `http://${ip}:${message.port}`,
  };
  console.log(
    `LeaveNow transport API: ${env.EXPO_PUBLIC_API_BASE_URL}\nKeep your iPhone and Mac on the same Wi-Fi. Scan the Expo QR code with your iPhone camera.`,
  );
  expo = spawn(
    process.execPath,
    ["node_modules/expo/bin/cli", "start", "--go", ...process.argv.slice(2)],
    { stdio: "inherit", env },
  );
  expo.on("error", (error) => {
    console.error(`Could not start Expo: ${error.message}`);
    stop(1);
  });
  expo.on("exit", (code) => stop(code || 0));
});
