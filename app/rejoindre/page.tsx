import { RejoindreClient } from "./rejoindre-client";

// Page publique — auto-inscription du futur personnel (§ décision utilisateur 2026-08-04).
// Aucune authentification requise ; la demande est mise en attente jusqu'à validation Super Admin.
export default function RejoindrePage() {
  return <RejoindreClient />;
}
