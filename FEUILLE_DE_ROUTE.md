# FEUILLE DE ROUTE — EVOLUTIS223

Rédigée le 2026-07-27. Opérationnalise `CAHIER_DES_CHARGES.md` §14 (Plan de développement) : chaque phase est décomposée en étapes concrètes, **dans l'ordre où elles doivent réellement être construites** (dépendances techniques, pas juste priorité métier). Chaque phase se termine par un **checkpoint testable en direct** — même logique que les sessions de cadrage précédentes : on ne passe à la suite qu'après un test réel, pas une supposition.

Référence : toute section `§X` renvoie à `CAHIER_DES_CHARGES.md`.

---

## État d'avancement

**À remettre à jour à chaque étape/checkpoint franchi — reflète l'état réel, pas le plan.** Dernière mise à jour : 2026-07-31.

| Phase | % | Détail |
|---|---|---|
| 0 — Fondations | **100%** | 0.1→0.5 fonctionnels, testés en direct dans le navigateur (connexion, déconnexion, modules par rôle). Sécurité PIN (hachage + blocage après tentatives, §16.2) résolue 2026-07-28. Structure PWA (manifest, icônes, plein écran) réellement construite et vérifiée le 2026-08-02 — elle était actée depuis le début mais jamais codée jusque-là. |
| 1 — Cœur métier | **100%** | 1.1→1.6 faits et vérifiés en base réelle. Cycle complet : Catalogue → Stock (appro + réserve détail) → Client → Affaire (commande en attente → contrôle stock → décrément FIFO → ticket) → Commande (Retrait/Livraison) → Règlement → Trésorerie (bon de décaissement, clôture de caisse avec écart + justification). Bug réel trouvé et corrigé en cours de route (Famille B ne résolvait jamais de variante — stock jamais décrémenté). Génération PDF (§8.4/§13) avancée en parallèle : Reçu de caisse, Bon de livraison et Fiche de paie faits et vérifiés en base réelle (2026-07-29 puis 2026-08-02 pour la Fiche de paie, une fois RH codé), paramétrage par champs/sections (`parametres_documents`) branché sur les trois ; 3 modèles restants (Bon de commande, Ordre de mission, Courrier) attendent le module Achats/Fournisseurs (Phase 4) — pas bloquant. Périphériques restants de Phase 1 (RH, Fournisseurs, Achats, Dépenses, Charges, Rapports) déplacés en Phase 4, cohérent avec le découpage d'origine. |
| 2 — Workflows spécifiques | **100%** | 2.1→2.5 tous faits et vérifiés en base réelle. Phase 2 terminée. |
| 2bis — R&D Calculateurs | **~65%** | Maquette validée (§10bis) puis moteur de coût par technique implémenté et vérifié en base réelle 2026-07-29 (`/rd-calculateurs`, bibliothèque de références, prix calculé en direct, ligne d'affaire normale). Ensemble complet / mode Tissu câblés et vérifiés en base réelle 2026-07-29 (réglage `categorieMarquage` ajouté à la fiche article du Catalogue). Reste : configurateur produit-first guidé (chemin long, §10) pour le client final. |
| 3 — Configurateur & vitrine | **~90%** | 3.1 (maquette), 3.2 (vitrine `/boutique`), 3.3 (configurateur réel, `/configurateur`) et 3.5 (suivi `/suivi/[numero]`) faits et vérifiés en base réelle. Reste : paiement Mobile Money (3.4 — bloqué sur choix d'agrégateur, décision utilisateur). |
| 3bis — Parcours maquette (§10ter) | **100%** | Parcours public `/maquette` (9 écrans, porté depuis la maquette Artifact validée), table dédiée `demandes_maquette` (même logique de dossier séparé que le pagne industriel), upload Vercel Blob (`lib/blob.ts`), intégration à la file `/validations` (Valider → `creerAffaire()` → `COMMANDE_ATTENTE` normale) et admin séparé `/maquette-admin` (Admin/Super Admin). Implémenté et vérifié de bout en bout en base réelle 2026-07-31 : soumission publique → `MAQ-26-0001` → Valider → `CDE-26-0002` réelle dans `/affaires` ; accès admin confirmé bloqué pour un rôle Vendeur. Résout au passage le blocage "stockage des fichiers" (point A ci-dessous) — reste à l'utilisateur de créer un vrai store Vercel Blob et fournir `BLOB_READ_WRITE_TOKEN` avant toute mise en prod ou test avec upload réel. |
| 3ter — Configurateur d'articles (§3.3/§10) | **100%** | Route publique `/configurateur` (chemin court + chemin long), porté depuis `design/Schema Configurateur Articles Personnalises.dc.html`. Décision utilisateur 2026-07-31 : commande directe (compte technique `+22300000098`, pas de file d'attente comme la maquette) — `creerAffaire` refactorée en `creerAffaireInterne` partagée. Zones de marquage réutilisent le moteur `lib/calculateurs/marquage.ts` (§10bis) tel quel ; coût de zone × quantité totale (décision utilisateur 2026-07-31, pas de distinction mise en place one-time pour cette passe). Galerie de modèles (`modeles_configurateur`) et finitions (`finitions_configurateur`) éditables dans `/configurateur-admin`. Testé de bout en bout sur Neon 2026-07-31 : chemin long (19 600 F) validé et décrémenté normalement ; chemin court (9 500 F) bloqué correctement par le contrôle réserve détail (§9), visible dans `/validations` comme une vente interne. Accès admin confirmé bloqué pour un rôle Vendeur. |
| 4 — Modules périphériques | **~85%** | Fournisseurs (2026-07-29), RH (2026-08-01, personnel + bulletins de paie + incidents + besoins saisonniers), Achats, Dépenses/Charges et Marketing (2026-08-02, promotions + bannière boutique) faits et vérifiés en base réelle. Rapports — 4 dimensions faites et vérifiées (Finance, RH, Incidents, Prévisions, 2026-08-02). Reste : Configurateur produit-first interne (R&D, Cas B), gabarits PDF liés à Achats. |

---

## Pourquoi cet ordre (logique de dépendances)

- **Rien ne peut se construire avant les rôles/permissions** (§6) : chaque module filtre par droit d'accès dès l'écriture, pas ajouté après coup.
- **Le Stock (§4.3 v2, §5, §9) doit exister avant les Affaires** : une vente sans contrôle de stock réel n'a pas de sens à tester.
- **Les Affaires doivent exister avant les Commandes/Kanban (§8.1)** : Commande est une vue/statut sur des affaires, pas une entité indépendante.
- **Les workflows de validation (§9, réserve détail) dépendent du Stock ET des Affaires** : il faut une vente réelle à bloquer avant de tester le blocage.
- **Le Configurateur/vitrine (§10) dépend du Catalogue+Stock (réserve détail) ET des Affaires (type COMMANDE_ATTENTE)** — c'est la dernière brique du cœur, pas la première, même si c'est la pièce maîtresse côté client.
- **Les modules périphériques (RH, Fournisseurs, Rapports…) ne bloquent rien** — ils lisent les autres modules, peuvent arriver après le lancement.

---

## Phase 0 — Fondations

| Étape | Contenu |
|---|---|
| 0.1 | Repo GitHub (créé par toi, vide) + `git init` local + `.gitignore` + `.env.example` (jamais de secret en clair, cf. mémoire projet) |
| 0.2 | Scaffold Next.js/TypeScript (App Router), Tailwind, shadcn/ui, PWA (manifest + icônes) |
| 0.3 | PostgreSQL local (dev) + Drizzle ORM — schéma complet §4 (v2, corrigé) en une seule migration initiale, tables créées dans l'ordre 4.1 → 4.9 |
| 0.4 | Authentification téléphone + PIN (§3.4) — hash PIN, session, formulaire de connexion. SMS réel pas encore branché (juste le flux, PIN saisi manuellement en dev) |
| 0.5 | Rôles & permissions (§6) — seed des 13 rôles, table de droits par module, middleware de garde |

**Checkpoint phase 0** : se connecter avec un compte seedé (ex. Super Admin), voir un tableau de bord vide dont les modules visibles changent selon le rôle testé.

---

## Phase 1 — Cœur métier

| Étape | Contenu |
|---|---|
| 1.1 | Catalogue & Articles — CRUD des 5 familles (§5), champ `publie_boutique` |
| 1.2 | Stock — lots, variantes, mouvements `pool` GROS/DETAIL (§4.3 v2), écran d'approvisionnement (attention au piège pièces/douzaines relevé dans le Workflow source) |
| 1.3 | Clients — Boutique vs ONG/Contrat |
| 1.4 | Affaires — Devis (versionné) → Bon de commande → Facture/Ticket, Avoir ; moteur de vente unifié (§5 tableau) |
| 1.5 | Commandes — ombrelle, `mode_finalisation` (Retrait/Livraison), statuts (§8.1) |
| 1.6 | Règlements & Trésorerie de base — bons de décaissement, clôture de caisse quotidienne |

**Checkpoint phase 1** : reproduire de bout en bout, dans la vraie appli, le test déjà fait manuellement sur le prototype (article "Polo Teste", 3 douzaines, répartition par taille, réserve personnalisation) — vente, décrément, ticket généré.

---

## Phase 2 — Workflows spécifiques

| Étape | Contenu |
|---|---|
| 2.1 | ✅ Réserve détail / stock gros + workflow de validation (§9) — `/validations`, Autoriser/Recharger/Refuser, alerte sonore opt-in (bip 30s, pause 1/5/15 min), audit tracé. Vérifié en base réelle. |
| 2.2 | ✅ Kits (§8.3) — recette dans Stocks, stock "goulot d'étranglement" recalculé en direct, vente intégrée à `validerAffaire` (blocage direct si insuffisant, décrément par composant sur son pool réel). Vérifié en base réelle. |
| 2.3 | ✅ Ordres de Fabrication (Famille D + Kit à assembler) + Kanban `/production` — séquence corrigée (Réception → Conception si personnalisé → Production → Contrôle qualité → Prêt, §8.1). Vérifié en base réelle. |
| 2.4 | ✅ Fonds en circulation — assignation livreur, encaissement terrain à la livraison, remise/rapprochement à `/fonds-circulation`, écart tracé. Vérifié en base réelle. |
| 2.5 | ✅ Proformas partenaires (§12) — formulaire `/commercial` (Freelance/Commercial/Resp. Commercial), file d'attente Admin/Super Admin intégrée à `/validations`. Envoi effectif au client pas encore construit (lié aux gabarits PDF restants, §13). Vérifié en base réelle. |

**Checkpoint phase 2** : simuler une rupture de réserve détail → alerte admin → décision (Autoriser / Recharger / Refuser) → effet réel sur le stock, tracé au journal d'audit.

---

## Phase 2bis — R&D Calculateurs (§10bis)

**Module ajouté après coup (2026-07-28)**, absent du plan d'origine — surfacé en cours de session à partir du besoin réel du polo à la carte et de la sérigraphie/DTF/sublimation. Dépend du Catalogue (1.1) et du Stock (1.2, déjà faits) pour le prix de base ; independent des workflows 2.1-2.5.

| Étape | Contenu |
|---|---|
| 2bis.1 | Schéma — tables `calculateurs`, `bibliotheque_references` (encres, supports d'impression, matières, emballages, chacune avec variantes nommées), zones de marquage, liaison à un article Catalogue existant |
| 2bis.2 | Écran principal produit-first — sélecteur de vêtement (Polo/T-shirt/Maillot/Survêtement/Tissu/Casquette), clic-zone (réutilise le composant zone-click du §10), calcul de prix en direct |
| 2bis.3 | Moteurs de coût par technique — Sérigraphie (couleurs/cadres), DTF/Sublimation (cm² continu encre + support arrondi par feuille), Flocage (cm² support seul), Broderie (paliers Petit/Moyen/Grand) |
| 2bis.4 | ✅ Options transverses — bascule Ensemble complet (haut+bas), mode Tissu (Zones spécifiques / Toute la surface), zones prédéfinies en boutons rapides. Réglage `categorieMarquage` par article ajouté à la fiche Catalogue (Famille A). Vérifié en base réelle. |
| 2bis.5 | Écran admin (bouton discret, Admin/Super Admin uniquement) — bibliothèque de références, main d'œuvre + charges additionnelles (liste ouverte), marge, séparés |
| 2bis.6 | Intégration Affaires — une config validée devient une `ligne_affaire` calculée, jamais un nouvel article Catalogue |

**Checkpoint phase 2bis** : configurer un polo avec 2 zones (poitrine + dos), technique DTF sur une zone et sérigraphie 2 couleurs sur l'autre, vérifier que le prix calculé correspond à la maquette Artifact validée, et que la ligne d'affaire résultante ne crée aucun article Catalogue.

**Hors périmètre pour l'instant** (§10bis) : production industrielle de pagne (usine, maquette/cadres, balles/pièces de 12 yards) — configurée à part plus tard, sur demande explicite de l'utilisateur.

---

## Phase 3 — Configurateur & vitrine

**Avant cette phase** : trancher §16.7 (seuil décaissement, mineur) n'est pas bloquant, mais **confirmer l'agrégateur Mobile Money** (§12 — PayDunya/CinetPay/Kkiapay) doit être fait avant 3.4.

| Étape | Contenu |
|---|---|
| 3.1 | ✅ Maquette Artifact du configurateur (chemin long, 5 points) — validée avec toi avant tout code. |
| 3.2 | ✅ Vitrine publique `/boutique` — aucune authentification (route publique dans `proxy.ts`), respecte `publie_boutique`, stock affiché = réserve détail uniquement (jamais le stock gros). Vérifié en base réelle. |
| 3.3 | ✅ Configurateur chemin long + chemin court — `/configurateur`, écran Taille/Quantité partagé, tire sur la réserve détail. Vérifié en base réelle 2026-07-31 (voir 3ter). |
| 3.4 | Paiement Mobile Money — intégration agrégateur, clés de test |
| 3.5 | ✅ Suivi de commande public — `/suivi/[numero]`, aucune authentification, stepper 4 étapes. Vérifié en base réelle. Reste : générer le QR lui-même sur les documents PDF (lié aux 5 gabarits restants, §13). |

**Checkpoint phase 3** : commande en ligne complète, du configurateur au paiement test, suivie via le QR — première brique visible côté client.

---

## Phase 4 — Modules périphériques (post-lancement possible)

RH, Fournisseurs, Achats, Dépenses, Charges, Rapports, Marketing/R&D — chacun indépendant des autres, peut être réordonné ou décalé après le lancement de V1 sans bloquer les phases 0-3.

---

## Points à garder en tête pendant la construction (§16)

Aucun ne bloque le démarrage, mais à trancher avant la phase concernée : rôles Marketing/Agent marketing (avant phase 0.5), sauvegardes BDD (avant mise en production, pas avant développement). ✅ Sécurité PIN — hachage/blocage : résolu 2026-07-28 (§16.2). ✅ Seuil décaissement : résolu 2026-07-28 (§16.7), seuil global 50 000 F par défaut, modifiable par Admin/Super Admin.

---

## Ce qui reste à faire — et pourquoi (mise à jour 2026-08-02)

Le noyau métier (Phases 0, 1, 2), le parcours maquette (§10ter), le configurateur public (§3.3/§10), RH (§7, personnel + paie + incidents + besoins saisonniers), Rapports 4 dimensions (§7) et Achats/Dépenses/Charges (§7) sont terminés et vérifiés en base réelle. Ce qui reste se répartit en quatre catégories bien différentes — le "pourquoi" change ce qu'il faut faire ensuite.

**A. Bloqué — décision hors de portée de Claude, besoin de l'utilisateur**
- **Paiement Mobile Money (3.4)** : choisir un agrégateur réel (PayDunya / CinetPay / Kkiapay) et créer un compte développeur pour obtenir des clés de test — nécessite un compte externe au nom de l'entreprise. **Seul vrai blocage restant avant la mise en ligne.**
- **Vercel Blob non configuré côté utilisateur** : le code est fait et vérifié (§10ter/3ter), mais aucun store réel n'existe encore — `BLOB_READ_WRITE_TOKEN` manquant dans le `.env` réel. Sans ça, aucun upload (logo maquette, logo configurateur, modèle admin) ne fonctionne en pratique. Pas une décision à prendre, juste une action à faire (créer le store sur vercel.com, copier le token).

**B. Pas encore attaqué**
- **Configurateur produit-first guidé interne (R&D, Cas B)** : distinct du configurateur client public déjà livré — écran "produit d'abord" pour la vente interne assistée, jamais détaillé au-delà d'une mention (§10bis). Rappel (2026-08-02) : R&D est en réalité un module plus large — un bac à sable pour d'autres applications de l'utilisateur (ex. tunnels de vente) en test avant d'être branchées à leur place définitive, potentiellement accessible à des partenaires/développeurs externes — pas juste le calculateur de marquage.
- **3 des 6 gabarits PDF restants** (Bon de commande, Ordre de mission, Courrier) — les deux premiers dépendent du module Achats/Fournisseurs (Bon de commande, achats de matières/consommables plutôt que sorties de caisse déjà couvertes) ; le Courrier n'a pas de point d'intégration identifié dans l'appli (à qui/quoi sert-il concrètement ?).

**C. Résolu depuis (2026-08-02)**
- ~~Production industrielle de pagne~~ : **tranchée différemment** — traitée comme un article normal via Devis/Proforma → Facture (§4.5/§12), plus de dossier séparé. Prix de revient saisi manuellement sur la fiche article (Famille C/D, `/catalogue`) construit et vérifié en base réelle. Le système de suivi de production plus complet reste explicitement pour plus tard, à la demande de l'utilisateur.
- ~~Incohérence des rôles "Marketing"/"Agent marketing"~~ : **résolue** — rôle Agent marketing créé (Tableau de bord/Marketing/Clients), personne ne l'occupe encore mais le poste est prêt dès l'embauche. Voir CAHIER_DES_CHARGES.md §6.
- ~~PWA plein écran (icône, pas de barre de navigateur)~~ : **construite** — actée depuis le tout début du projet (§3.2) mais jamais réellement codée jusqu'à ce qu'on le vérifie le 2026-08-02. Manifest + icônes + service worker minimal en place, vérifiés techniquement.
- ~~Tampon local du poste comptoir (résilience coupure internet, §3.3)~~ : **construit** — même constat, décidé au cadrage, jamais codé jusqu'au 2026-08-02. Route `/vente-comptoir` dédiée, testée de bout en bout avec une vraie coupure/reconnexion simulée.

**D. Petits points ouverts (§16), non bloquants**
- Sauvegardes/plan de reprise de la base — à trancher avant la mise en prod, pas avant.
- Migration de données existantes — inconnu s'il y a des données papier ou d'un système antérieur à reprendre.
- Fournisseur SMS réel pour le flux téléphone+PIN — pas encore vérifié auprès d'un fournisseur au Mali.
- **Authentification à deux facteurs (2FA) sur les comptes des services externes** (Vercel, GitHub, Namecheap, Neon) — ignorée pendant la mise en place initiale (2026-08-02) pour avancer plus vite, à activer ensuite. L'utilisateur a explicitement demandé qu'on n'oublie pas ce point.
