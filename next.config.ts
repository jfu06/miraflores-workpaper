import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output so the container carries only the traced dependencies.
   * The server runs from `.next/standalone`, so anything read at runtime through
   * `process.cwd()` — the packet in `data/` — has to sit beside it there.
   */
  output: "standalone",
};

export default nextConfig;
