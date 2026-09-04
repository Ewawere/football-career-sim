/**
 * Loads full API implementation from compressed payload (Railway-safe).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { gunzipSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const dir = dirname(fileURLToPath(import.meta.url));
const target = join(dir, "api.impl.ts");
const payload = join(dir, "api.impl.b64.txt");

if (!existsSync(target)) {
  const b64 = readFileSync(payload, "utf8").trim();
  writeFileSync(target, gunzipSync(Buffer.from(b64, "base64")), "utf8");
}

export * from "./api.impl.js";
