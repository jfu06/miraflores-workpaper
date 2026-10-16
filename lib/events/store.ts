import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { AppendEvent, EventPayload, Scope, WorkpaperEvent } from "./types";

/**
 * Append-only event store.
 *
 * Append-only is enforced by the database, not by convention: triggers abort any
 * UPDATE or DELETE against the events table. Code that tries to rewrite history
 * fails loudly instead of quietly succeeding, which is the property the whole
 * design rests on.
 */
const DEFAULT_DB_PATH = "data/events.db";
const CACHE_KEY = "__miraflores_events_db__";

type GlobalWithDb = typeof globalThis & { [CACHE_KEY]?: DatabaseSync };

function open(): DatabaseSync {
  const cache = globalThis as GlobalWithDb;
  const cached = cache[CACHE_KEY];
  if (cached) return cached;

  const path = resolve(process.cwd(), process.env.EVENTS_DB_PATH ?? DEFAULT_DB_PATH);
  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS events (
      seq       INTEGER PRIMARY KEY AUTOINCREMENT,
      id        TEXT NOT NULL UNIQUE,
      at        TEXT NOT NULL,
      actor_id  TEXT NOT NULL,
      type      TEXT NOT NULL,
      scope_kind TEXT NOT NULL,
      scope_id  TEXT NOT NULL,
      payload   TEXT NOT NULL,
      group_id  TEXT
    );

    CREATE INDEX IF NOT EXISTS events_scope ON events (scope_kind, scope_id, seq);
    CREATE INDEX IF NOT EXISTS events_type  ON events (type, seq);
    CREATE INDEX IF NOT EXISTS events_group ON events (group_id);

    CREATE TRIGGER IF NOT EXISTS events_no_update
      BEFORE UPDATE ON events
      BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;

    CREATE TRIGGER IF NOT EXISTS events_no_delete
      BEFORE DELETE ON events
      BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
  `);

  cache[CACHE_KEY] = db;
  return db;
}

interface Row {
  seq: number;
  id: string;
  at: string;
  actor_id: string;
  type: string;
  scope_kind: string;
  scope_id: string;
  payload: string;
  group_id: string | null;
}

/**
 * `node:sqlite` types rows as `Record<string, SQLOutputValue>`. The schema above is
 * the only writer, so the shape is known; the cast is kept here rather than spread
 * across every query.
 */
function asRows(rows: unknown): Row[] {
  return rows as Row[];
}

function asRow(row: unknown): Row | undefined {
  return row as Row | undefined;
}

function toEvent(row: Row): WorkpaperEvent {
  return {
    seq: row.seq,
    id: row.id,
    at: row.at,
    actorId: row.actor_id,
    type: row.type as WorkpaperEvent["type"],
    scope: { kind: row.scope_kind as Scope["kind"], id: row.scope_id },
    payload: JSON.parse(row.payload) as EventPayload,
    groupId: row.group_id ?? undefined,
  };
}

export function append<P extends EventPayload>(event: AppendEvent<P>): WorkpaperEvent<P> {
  const db = open();
  const id = randomUUID();
  const at = new Date().toISOString();

  db.prepare(
    `INSERT INTO events (id, at, actor_id, type, scope_kind, scope_id, payload, group_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    at,
    event.actorId,
    event.type,
    event.scope.kind,
    event.scope.id,
    JSON.stringify(event.payload),
    event.groupId ?? null,
  );

  const row = asRow(db.prepare(`SELECT * FROM events WHERE id = ?`).get(id))!;
  return toEvent(row) as WorkpaperEvent<P>;
}

/** Append several events under one group id, so they revert as one action. */
export function appendGroup(events: AppendEvent[]): WorkpaperEvent[] {
  const groupId = randomUUID();
  const db = open();
  db.exec("BEGIN");
  try {
    const written = events.map((event) => append({ ...event, groupId }));
    db.exec("COMMIT");
    return written;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listForScope(scope: Scope): WorkpaperEvent[] {
  const db = open();
  const rows = db
    .prepare(
      `SELECT * FROM events WHERE scope_kind = ? AND scope_id = ? ORDER BY seq ASC`,
    )
    .all(scope.kind, scope.id);
  return asRows(rows).map(toEvent);
}

export function listAll(limit = 500): WorkpaperEvent[] {
  const db = open();
  const rows = db
    .prepare(`SELECT * FROM events ORDER BY seq DESC LIMIT ?`)
    .all(limit);
  return asRows(rows).map(toEvent).reverse();
}

export function getById(id: string): WorkpaperEvent | null {
  const db = open();
  const row = asRow(db.prepare(`SELECT * FROM events WHERE id = ?`).get(id));
  return row ? toEvent(row) : null;
}

/** Scope keys that have any events, for marking the outline without loading them all. */
export function scopesWithEvents(): { kind: string; id: string; count: number }[] {
  const db = open();
  return db
    .prepare(
      `SELECT scope_kind AS kind, scope_id AS id, COUNT(*) AS count
       FROM events GROUP BY scope_kind, scope_id`,
    )
    .all() as unknown as { kind: string; id: string; count: number }[];
}
