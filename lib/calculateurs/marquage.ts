// §10bis — moteur de coût par technique de marquage, partagé entre la vente interne et (plus
// tard) le configurateur public — jamais réinventé par écran. Fonctions pures, testables sans DB.

export type Technique = "SERIGRAPHIE" | "SUBLIMATION" | "DTF" | "FLOCAGE" | "BRODERIE";

export interface Encre {
  id: number;
  nom: string;
  technique: string;
  prixReference: number;
  // Quantité de référence en ml — informatif, affiché/édité en admin. N'entre jamais dans le
  // calcul du prix (voir calculerCoutZone) : le ml s'annule mathématiquement dans le ratio
  // prixReference/surfaceReferenceCm2, le rendre variable indépendamment ferait dériver le prix
  // sans justification réelle.
  qteReferenceMl: number | null;
  surfaceReferenceCm2: number;
}
export interface Support {
  id: number;
  nom: string;
  technique: string;
  prix: number;
  largeurCm: number;
  hauteurCm: number;
}
export interface CadreSerigraphie {
  id: number;
  nom: string;
  prixCadre: number;
}
export interface PalierBroderie {
  id: number;
  nom: string;
  prix: number;
}

export interface Bibliotheque {
  encres: Encre[];
  supports: Support[];
  cadres: CadreSerigraphie[];
  paliersBroderie: PalierBroderie[];
}

export interface ZoneConfig {
  id: string; // identifiant local (client), pas un id DB
  label: string;
  technique: Technique;
  largeurCm: number;
  hauteurCm: number;
  cadreId: number | null;
  encreId: number | null;
  supportId: number | null;
  palierBroderieId: number | null;
  // Position (% de la photo) où l'épingle de la zone s'affiche — purement visuel, jamais utilisé
  // par calculerCoutZone/calculerTotal. Absent pour "Toute la surface" (une seule zone, pas d'épingle).
  x?: number;
  y?: number;
}

export interface ZoneCoutResult {
  montant: number;
  detailLabel: string;
  detailEncre?: number;
  detailSupport?: number;
  feuilles?: number;
  // Purement informatif — dérivé de Encre.qteReferenceMl, ne participe pas à `montant`.
  mlConsommes?: number;
}

// Encre : consommation continue au cm² réel — aucun arrondi, ce n'est pas un support physique.
// Support (papier/film/vinyle) : physique, compté en feuilles entières selon SON propre format,
// indépendant du format de référence de l'encre (§10bis, corrigé plusieurs fois en session).
export function calculerCoutZone(zone: ZoneConfig, biblio: Bibliotheque): ZoneCoutResult {
  if (zone.technique === "SERIGRAPHIE") {
    const cadre = biblio.cadres.find((c) => c.id === zone.cadreId);
    if (!cadre) return { montant: 0, detailLabel: "Sérigraphie — cadre non défini" };
    return { montant: cadre.prixCadre, detailLabel: `Sérigraphie — ${cadre.nom}` };
  }

  if (zone.technique === "BRODERIE") {
    const palier = biblio.paliersBroderie.find((p) => p.id === zone.palierBroderieId);
    if (!palier) return { montant: 0, detailLabel: "Broderie — palier non défini" };
    return { montant: palier.prix, detailLabel: `Broderie — ${palier.nom}` };
  }

  const surface = Math.max(0, zone.largeurCm) * Math.max(0, zone.hauteurCm);

  if (zone.technique === "FLOCAGE") {
    const support = biblio.supports.find((s) => s.id === zone.supportId);
    if (!support) return { montant: 0, detailLabel: "Flocage — support non défini" };
    const surfaceRef = support.largeurCm * support.hauteurCm;
    const feuilles = Math.max(1, Math.ceil(surface / surfaceRef));
    const montant = feuilles * support.prix;
    return { montant, detailLabel: `Flocage — ${surface.toFixed(0)}cm²`, detailSupport: montant, feuilles };
  }

  // SUBLIMATION | DTF
  const encre = biblio.encres.find((e) => e.id === zone.encreId);
  const support = biblio.supports.find((s) => s.id === zone.supportId);
  if (!encre || !support) return { montant: 0, detailLabel: "Encre/support non défini" };
  const prixParCm2 = encre.prixReference / encre.surfaceReferenceCm2;
  const detailEncre = prixParCm2 * surface;
  const surfaceRefSupport = support.largeurCm * support.hauteurCm;
  const feuilles = Math.max(1, Math.ceil(surface / surfaceRefSupport));
  const detailSupport = feuilles * support.prix;
  const mlConsommes = encre.qteReferenceMl != null ? (surface / encre.surfaceReferenceCm2) * encre.qteReferenceMl : undefined;
  return {
    montant: detailEncre + detailSupport,
    detailLabel: `${zone.technique === "DTF" ? "DTF" : "Sublimation"} — ${surface.toFixed(0)}cm²`,
    detailEncre,
    detailSupport,
    feuilles,
    mlConsommes,
  };
}

export interface ChargeAdditionnelle {
  nom: string;
  montant: number;
}

export interface CalculTotalInput {
  prixBaseArticle: number;
  zones: ZoneConfig[];
  mainOeuvre: number;
  charges: ChargeAdditionnelle[];
  marge: number;
  prixBas?: number; // Ensemble complet
}

export interface CalculTotalResult {
  zoneResultats: (ZoneCoutResult & { zoneId: string })[];
  totalZones: number;
  totalCharges: number;
  total: number;
}

export function calculerTotal(input: CalculTotalInput, biblio: Bibliotheque): CalculTotalResult {
  const zoneResultats = input.zones.map((z) => ({ zoneId: z.id, ...calculerCoutZone(z, biblio) }));
  const totalZones = zoneResultats.reduce((acc, z) => acc + z.montant, 0);
  const totalCharges = input.charges.reduce((acc, c) => acc + c.montant, 0);
  const hasZones = input.zones.length > 0;
  const total =
    input.prixBaseArticle +
    (input.prixBas ?? 0) +
    totalZones +
    (hasZones ? input.mainOeuvre + input.marge : 0) +
    totalCharges;
  return { zoneResultats, totalZones, totalCharges, total };
}
