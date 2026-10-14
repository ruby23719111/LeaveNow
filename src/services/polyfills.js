import { randomUUID } from "expo-crypto";
// The shared planner only clones plain JSON state; no DOM or browser storage.
if (typeof globalThis.structuredClone !== "function")
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = randomUUID;
