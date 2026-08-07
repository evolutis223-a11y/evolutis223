import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Pilote officiel Neon (WebSocket) au lieu de "pg" brut : "pg" garde des connexions TCP
// persistantes qui deviennent invalides quand le compute Neon se met en veille entre deux
// invocations de fonction serverless sur Vercel, provoquant des echecs aleatoires du type
// "Failed query" / panique WASM sur la premiere requete qui reutilise une connexion perimee.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
