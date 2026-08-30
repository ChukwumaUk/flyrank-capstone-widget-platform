import "dotenv/config";
import { pool } from "./db";

// A fixed demo owner id so the seed is self-contained (no signup needed to demo).
const DEMO_OWNER = "00000000-0000-4000-8000-000000000001";

async function seed() {
  // Idempotent: only seed if no demo widget exists yet.
  const existing = await pool.query(
    `select id from widgets where owner_id = $1 limit 1`,
    [DEMO_OWNER]
  );

  if (existing.rows.length > 0) {
    console.log(`Demo widget already exists: ${existing.rows[0].id}`);
    await pool.end();
    return;
  }

  const { rows } = await pool.query(
    `insert into widgets (owner_id, type, title, description, config, allowed_origins)
     values ($1, 'signup', 'Demo Newsletter', 'Sign up for demo updates',
             $2, null)
     returning id`,
    [
      DEMO_OWNER,
      JSON.stringify({ fields: [{ name: "email", label: "Email", type: "email", required: true }] }),
    ]
  );

  console.log(`Seeded demo widget: ${rows[0].id}`);
  console.log(`Embed snippet:`);
  console.log(`<script src="http://localhost:3000/widget.js?id=${rows[0].id}"></script>`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});