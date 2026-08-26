import "dotenv/config";
import { app } from "./app";
import { pool } from "./db";

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  // Verify the DB connection before we accept any traffic.
  await pool.query("SELECT 1");
  console.log("Connected to Postgres");

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});