// Applique les migrations Prisma via un pilote PostgreSQL pur JavaScript (pg),
// sans passer par le moteur natif de la CLI Prisma (`prisma migrate deploy`).
// Nécessaire sur Iridflow : le conteneur d'exécution est Alpine (musl), tourne
// en utilisateur non-root, et ne peut pas installer OpenSSL — le moteur natif
// de Prisma n'y fonctionne donc jamais, quelle que soit la cible binaryTargets
// choisie. Reproduit le comportement de `prisma migrate deploy` : applique
// dans l'ordre les migrations non encore enregistrées dans `_prisma_migrations`,
// jamais en double, jamais hors ordre.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "prisma", "migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL1;
  if (!connectionString) {
    console.error("DATABASE_URL1 manquant, impossible d'appliquer les migrations.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id                      VARCHAR(36) PRIMARY KEY,
        checksum                VARCHAR(64) NOT NULL,
        finished_at             TIMESTAMPTZ,
        migration_name          VARCHAR(255) NOT NULL,
        logs                    TEXT,
        rolled_back_at          TIMESTAMPTZ,
        started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_steps_count     INTEGER NOT NULL DEFAULT 0
      );
    `);

    const { rows: applied } = await client.query(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
    );
    const appliedNames = new Set(applied.map((r) => r.migration_name));

    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const dir of dirs) {
      if (appliedNames.has(dir)) continue;
      const sqlPath = join(migrationsDir, dir, "migration.sql");
      if (!existsSync(sqlPath)) continue;
      const sql = readFileSync(sqlPath, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const id = createHash("sha1").update(dir).digest("hex").slice(0, 36);

      console.log(`Applying migration: ${dir}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES ($1, $2, now(), $3, now(), 1)`,
          [id, checksum, dir]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("All migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
