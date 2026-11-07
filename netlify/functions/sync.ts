import type { Config } from "@netlify/functions";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { records } from "../../db/schema.js";

const STORES = new Set(["exams", "results", "teachers", "students"]);
// Rows are re-sent for this window to cover transactions that committed late.
const OVERLAP_MS = 15_000;

type Change = { store: string; id: string; data?: unknown; deleted?: boolean };

export default async (req: Request) => {
  if (req.method === "GET") {
    const since = new URL(req.url).searchParams.get("since");
    // Taken before querying, so anything written after this moment is picked up next poll.
    const serverTime = new Date().toISOString();
    const sinceDate = since ? new Date(new Date(since).getTime() - OVERLAP_MS) : null;
    const rows = await db
      .select()
      .from(records)
      .where(sinceDate && !isNaN(sinceDate.getTime()) ? gt(records.updatedAt, sinceDate) : eq(records.deleted, false));
    return Response.json(
      {
        serverTime,
        full: !since,
        changes: rows.map((r) => ({ store: r.store, id: r.id, data: r.data, deleted: r.deleted })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (req.method === "POST") {
    let body: { changes?: Change[] };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const changes = (body.changes ?? []).filter(
      (c) => c && STORES.has(c.store) && typeof c.id === "string" && c.id.length > 0 && c.id.length < 200,
    );
    if (changes.length === 0) return Response.json({ ok: true, applied: 0 });
    if (changes.length > 500) return Response.json({ error: "Too many changes" }, { status: 413 });

    for (const c of changes) {
      const deleted = c.deleted === true;
      const data = deleted ? null : (c.data ?? null);
      await db
        .insert(records)
        .values({ store: c.store, id: c.id, data, deleted, updatedAt: sql`now()` })
        .onConflictDoUpdate({
          target: [records.store, records.id],
          set: { data, deleted, updatedAt: sql`now()` },
        });
    }
    return Response.json({ ok: true, applied: changes.length });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/sync" };
