import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Packet } from "./types";

/**
 * The packet is loaded as delivered: the file in `data/` is a byte-identical copy
 * of the packet we were given, and nothing here rewrites or pre-compiles it.
 * `PACKET_PATH` lets a different packet be pointed at without a code change.
 */
const DEFAULT_PACKET_PATH = "data/okafor_lindqvist_2025_packet.json";

/**
 * Parsing 1.9 MB of JSON on every request would be wasteful, and in development
 * Next.js re-evaluates modules on edit, so the cache hangs off `globalThis`
 * rather than a module-level binding.
 */
const CACHE_KEY = "__miraflores_packet__";

type GlobalWithCache = typeof globalThis & { [CACHE_KEY]?: Packet };

export function loadPacket(): Packet {
  const cache = globalThis as GlobalWithCache;
  const cached = cache[CACHE_KEY];
  if (cached) return cached;

  const path = resolve(process.cwd(), process.env.PACKET_PATH ?? DEFAULT_PACKET_PATH);
  const packet = JSON.parse(readFileSync(path, "utf8")) as Packet;

  cache[CACHE_KEY] = packet;
  return packet;
}
