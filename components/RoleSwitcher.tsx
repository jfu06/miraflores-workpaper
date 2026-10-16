"use client";

import { useEffect, useState } from "react";

import type { ActorInfo } from "@/lib/events/derive";
import { clearCaches } from "@/lib/view/client";
import { Chip } from "./ui";

/**
 * Switching who is acting.
 *
 * The choice is sent to the server and kept in a cookie; it is not held in the
 * browser. Cached detail is dropped on the way out, because responses are masked
 * per actor and one person's view must not be shown to the next.
 */
export function RoleSwitcher({ onSwitched }: { onSwitched: () => void }) {
  const [actors, setActors] = useState<ActorInfo[]>([]);
  const [current, setCurrent] = useState<ActorInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/actor")
      .then((r) => r.json())
      .then((d: { current: ActorInfo; actors: ActorInfo[] }) => {
        setCurrent(d.current);
        setActors(d.actors);
      })
      .catch(() => undefined);
  }, []);

  const switchTo = async (actorId: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/actor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId }),
      });
      const body = (await response.json()) as { current: ActorInfo };
      setCurrent(body.current);
      clearCaches();
      onSwitched();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={current?.id ?? ""}
        disabled={busy}
        onChange={(e) => switchTo(e.target.value)}
        className="rounded border border-edge bg-surface px-1.5 py-1 text-[11px] outline-none focus:border-accent disabled:opacity-50"
        title="Acting as"
      >
        {actors.map((actor) => (
          <option key={actor.id} value={actor.id}>
            {actor.name} — {actor.role.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {current && !current.sensitiveDataClearance && (
        <Chip tone="warn" title="Sees SSNs, bank and account numbers and IP PINs masked.">
          no clearance
        </Chip>
      )}
    </div>
  );
}
