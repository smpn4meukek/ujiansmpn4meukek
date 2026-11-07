import { pgTable, text, jsonb, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// Generic synced record store: one row per item of each client-side store
// (exams, results, teachers, students). Deleted items are kept as tombstones
// so other devices learn about deletions while polling.
export const records = pgTable(
  "records",
  {
    store: text().notNull(),
    id: text().notNull(),
    data: jsonb(),
    deleted: boolean().notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.store, t.id] }), index("records_updated_at_idx").on(t.updatedAt)],
);
