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