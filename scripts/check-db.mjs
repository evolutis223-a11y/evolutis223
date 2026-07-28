import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tables = await pool.query(
  `select table_name, table_type from information_schema.tables
   where table_schema = 'public' order by table_name;`
);
console.log(`${tables.rowCount} objets dans le schéma public :`);
for (const row of tables.rows) {
  console.log(`  - ${row.table_name} (${row.table_type})`);
}

await pool.end();
