import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "./db";

export async function runMigrations() {
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }
}

// Still runnable directly via `npm run migrate`:
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .then(() => console.log("Migrations complete."))
    .catch((err) => { console.error("Migration failed:", err); process.exit(1); });
}