import { chargerDonneesConfigurateur } from "./actions";
import { ConfigurateurClient } from "./configurateur-client";

// Route publique (§3.3/§10) — aucune authentification, proxy.ts.
export default async function ConfigurateurPage() {
  const donnees = await chargerDonneesConfigurateur();
  return <ConfigurateurClient donnees={donnees} />;
}
