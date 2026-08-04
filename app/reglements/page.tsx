import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { affaires, articles, clients, lignesAffaire, livraisons, reglements, utilisateurs, roles, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerMastheadTexte } from "@/app/parametres/actions";
import { chargerParametresAffaireDocument } from "@/lib/documents/parametres";
import { ReglementsClient } from "./reglements-client";

export default async function ReglementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Règlements")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux règlements.</p>
      </main>
    );
  }

  const [[user], affaireRows, ligneRows, articleRows, varianteRows, livraisonRows, reglementRows, masthead, mentionsValidite] = await Promise.all([
    db
      .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
      .from(utilisateurs)
      .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
      .where(eq(utilisateurs.id, session.userId))
      .limit(1),
    db
      .select({
        id: affaires.id,
        numero: affaires.numero,
        type: affaires.type,
        immuable: affaires.immuable,
        dateCreation: affaires.dateCreation,
        objet: affaires.objet,
        clientNom: clients.nom,
        clientAdresse: clients.adresse,
        clientTelephone: clients.contact,
        commercialNom: utilisateurs.nom,
        provenance: affaires.provenance,
        modeFinalisation: affaires.modeFinalisation,
        tvaPct: affaires.tvaPct,
        remiseMontant: affaires.remiseMontant,
        remiseUnite: affaires.remiseUnite,
        montantTtc: affaires.montantTtc,
        infosComplementaires: affaires.infosComplementaires,
        mentionValidite: affaires.mentionValidite,
        acomptePct: affaires.acomptePct,
      })
      .from(affaires)
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .innerJoin(utilisateurs, eq(utilisateurs.id, affaires.auteurId))
      .where(eq(affaires.immuable, true))
      .orderBy(desc(affaires.id)),
    db.select().from(lignesAffaire),
    db.select().from(articles),
    db.select().from(variantes),
    db.select({ affaireId: livraisons.affaireId, adresse: livraisons.adresse }).from(livraisons),
    db
      .select({
        id: reglements.id,
        affaireId: reglements.affaireId,
        payeurNom: reglements.payeurNom,
        payeurPrenom: reglements.payeurPrenom,
        payeurTelephone: reglements.payeurTelephone,
        reference: reglements.reference,
        commentaire: reglements.commentaire,
        montant: reglements.montant,
        mode: reglements.mode,
        dateReglement: reglements.dateReglement,
      })
      .from(reglements)
      .orderBy(desc(reglements.id)),
    chargerMastheadTexte(),
    Promise.all(
      (["FACTURE", "DEVIS", "PROFORMA", "BON_COMMANDE", "TICKET"] as const).map(async (t) => [t, (await chargerParametresAffaireDocument(t)).mentionValidite] as const)
    ).then((entries) => Object.fromEntries(entries)),
  ]);

  const livraisonByAffaire = new Map(livraisonRows.map((l) => [l.affaireId, l.adresse]));

  const affairesAvecLignes = affaireRows.map((a) => ({
    ...a,
    adresseLivraison: livraisonByAffaire.get(a.id) ?? null,
    lignes: ligneRows
      .filter((l) => l.affaireId === a.id)
      .map((l) => {
        const art = articleRows.find((x) => x.id === l.articleId);
        const vnt = varianteRows.find((v) => v.id === l.varianteId);
        return { nom: `${art?.nom ?? ""}${vnt ? ` — ${vnt.taille ?? ""} ${vnt.couleur ?? ""}` : ""}`, qte: l.quantite, pu: Number(l.prixUnitaire) };
      }),
  }));

  return (
    <ReglementsClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      affaires={affairesAvecLignes}
      reglements={reglementRows}
      masthead={masthead}
      mentionsValidite={mentionsValidite}
    />
  );
}
