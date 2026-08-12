import * as schema from "./schema";

// Pilote officiel Neon (WebSocket) au lieu de "pg" brut : "pg" garde des connexions TCP
// persistantes qui deviennent invalides quand le compute Neon se met en veille entre deux
// invocations de fonction serverless sur Vercel, provoquant des echecs aleatoires du type
// "Failed query" / panique WASM sur la premiere requete qui reutilise une connexion perimee.
//
// En local (NODE_ENV != production), le module natif "bufferutil" que "ws" utilise est bloque par
// la politique de securite Windows de ce poste (meme blocage que next-swc) et fait planter le
// driver websocket en boucle (§ constat 2026-08-12). Solution : basculer sur le pilote HTTP de Neon
// pour `next dev` uniquement — Vercel (prod ET previews, NODE_ENV=production) continue d'utiliser
// exactement le meme pilote websocket qu'avant, aucun changement de comportement en ligne.
export const db =
  process.env.NODE_ENV === "production"
    ? await (async () => {
        const { Pool, neonConfig } = await import("@neondatabase/serverless");
        const { drizzle } = await import("drizzle-orm/neon-serverless");
        const ws = (await import("ws")).default;
        neonConfig.webSocketConstructor = ws;
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        return drizzle(pool, { schema });
      })()
    : await (async () => {
        const { neon } = await import("@neondatabase/serverless");
        const { drizzle } = await import("drizzle-orm/neon-http");
        const sql = neon(process.env.DATABASE_URL!);
        return drizzle(sql, { schema });
      })();
