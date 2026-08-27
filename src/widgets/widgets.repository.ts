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

export async function findWidgetsByOwner(ownerId: string): Promise<Widget[]> {
  const { rows } = await pool.query<Widget>(
    `select * from widgets where owner_id = $1 order by created_at desc`,
    [ownerId]
  );
  return rows;
}

export async function findWidgetByIdForOwner(id: string, ownerId: string): Promise<Widget | null> {
  const { rows } = await pool.query<Widget>(
    `select * from widgets where id = $1 and owner_id = $2`,
    [id, ownerId]
  );
  return rows[0] ?? null;
}

export async function updateWidgetForOwner(
  id: string,
  ownerId: string,
  fields: Partial<Pick<Widget, "title" | "description" | "config" | "allowed_origins">>
): Promise<Widget | null> {
  const { rows } = await pool.query<Widget>(
    `update widgets
        set title = coalesce($3, title),
            description = coalesce($4, description),
            config = coalesce($5, config),
            allowed_origins = coalesce($6, allowed_origins),
            updated_at = now()
      where id = $1 and owner_id = $2
      returning *`,
    [id, ownerId, fields.title ?? null, fields.description ?? null,
     fields.config ?? null, fields.allowed_origins ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteWidgetForOwner(id: string, ownerId: string): Promise<boolean> {
  const result = await pool.query(
    `delete from widgets where id = $1 and owner_id = $2`,
    [id, ownerId]
  );
  return (result.rowCount ?? 0) > 0;
}