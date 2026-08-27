import { pool } from "../db";
import { Widget, CreateWidgetInput } from "./widgets.types";

export async function insertWidget(input: CreateWidgetInput): Promise<Widget> {
  const { rows } = await pool.query<Widget>(
    `insert into widgets (owner_id, type, title, description, config, allowed_origins)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      input.owner_id,
      input.type,
      input.title,
      input.description ?? null,
      input.config ?? {},
      input.allowed_origins ?? null,
    ]
  );
  return rows[0];
}