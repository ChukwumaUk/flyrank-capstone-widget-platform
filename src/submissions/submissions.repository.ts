import { pool } from "../db";

// Does this widget exist? Returns the widget's id (and owner) or null.
// Note: NO owner_id filter here — a submission is public, from a visitor
// who is not the owner. Anyone may submit to a widget that exists.
export async function findWidgetForSubmission(
  widgetId: string
): Promise<{ id: string; owner_id: string } | null> {
  const { rows } = await pool.query<{ id: string; owner_id: string }>(
    `select id, owner_id from widgets where id = $1`,
    [widgetId]
  );
  return rows[0] ?? null;
}

export interface InsertSubmissionInput {
  widget_id: string;
  data: Record<string, unknown>;
  ip_address: string | null;
  country: string | null;
  city: string | null;
}

export async function insertSubmission(input: InsertSubmissionInput) {
  const { rows } = await pool.query(
    `insert into submissions (widget_id, data, ip_address, country, city)
     values ($1, $2, $3, $4, $5)
     returning id, widget_id, created_at`,
    [input.widget_id, input.data, input.ip_address, input.country, input.city]
  );
  return rows[0];
}

// List submissions for a widget — but ONLY if that widget belongs to the owner.
// Tenant isolation via a join: the widget must match both id AND owner_id.
export async function findSubmissionsForOwnerWidget(widgetId: string, ownerId: string) {
  const { rows } = await pool.query(
    `select s.id, s.data, s.country, s.city, s.created_at
       from submissions s
       join widgets w on w.id = s.widget_id
      where s.widget_id = $1
        and w.owner_id = $2
      order by s.created_at desc`,
    [widgetId, ownerId]
  );
  return rows;
}

// Basic stats for a widget the owner owns: total + counts by country.
export async function findStatsForOwnerWidget(widgetId: string, ownerId: string) {
  const totalResult = await pool.query(
    `select count(*)::int as total
       from submissions s
       join widgets w on w.id = s.widget_id
      where s.widget_id = $1 and w.owner_id = $2`,
    [widgetId, ownerId]
  );

  const byCountry = await pool.query(
    `select coalesce(s.country, 'Unknown') as country, count(*)::int as count
       from submissions s
       join widgets w on w.id = s.widget_id
      where s.widget_id = $1 and w.owner_id = $2
      group by s.country
      order by count desc`,
    [widgetId, ownerId]
  );

  return { total: totalResult.rows[0].total, by_country: byCountry.rows };
}