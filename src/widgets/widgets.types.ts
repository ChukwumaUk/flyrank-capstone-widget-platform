// The shape of a widget as it lives in the database.
export interface Widget {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  allowed_origins: string[] | null;
  created_at: Date;
  updated_at: Date;
}

// The data needed to CREATE a widget (no id/timestamps — the DB makes those).
export interface CreateWidgetInput {
  owner_id: string;
  type: string;
  title: string;
  description?: string | null;
  config?: Record<string, unknown>;
  allowed_origins?: string[] | null;
}