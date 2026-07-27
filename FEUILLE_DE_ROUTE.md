# FEUILLE DE ROUTE — EVOLUTIS223

Rédigée le 2026-07-27. Opérationnalise `CAHIER_DES_CHARGES.md` §14 (Plan de développement) : chaque phase est décomposée en étapes concrètes, **dans l'ordre où elles doivent réellement être construites** (dépendances techniques, pas juste priorité métier). Chaque phase se termine par un **checkpoint testable en direct** — même logique que les sessions de cadrage précédentes : on ne passe à la suite qu'après un test réel, pas une supposition.

Référence : toute section `§X` renvoie à `CAHIER_DES_CHARGES.md`.

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
| 2.1 | Réserve détail / stock gros + workflow de validation (§9) — reprendre la maquette Artifact déjà approuvée avec toi, alerte sonore incluse |
| 2.2 | Kits (§8.3) — algorithme déjà validé, à porter tel quel |
| 2.3 | Ordres de Fabrication (Famille D) + vue Kanban |
| 2.4 | Fonds en circulation — Livreur interne + Livreur partenaire (§6) |
| 2.5 | Proformas partenaires (§12) |

**Checkpoint phase 2** : simuler une rupture de réserve détail → alerte admin → décision (Autoriser / Recharger / Refuser) → effet réel sur le stock, tracé au journal d'audit.

---

## Phase 3 — Configurateur & vitrine

**Avant cette phase** : trancher §16.7 (seuil décaissement, mineur) n'est pas bloquant, mais **confirmer l'agrégateur Mobile Money** (§12 — PayDunya/CinetPay/Kkiapay) doit être fait avant 3.4.

| Étape | Contenu |
|---|---|
| 3.1 | **Maquette Artifact du configurateur** (chemin long, 5 points) — validation visuelle avec toi avant tout code, comme convenu |
| 3.2 | Vitrine publique "Nos produits" — respecte la bascule `publie_boutique`, exclut les variantes réserve détail |
| 3.3 | Configurateur chemin long + chemin court (écran Taille/Quantité partagé, tire sur la réserve détail) |
| 3.4 | Paiement Mobile Money — intégration agrégateur, clés de test |
| 3.5 | Suivi de commande public (QR, §11) |

**Checkpoint phase 3** : commande en ligne complète, du configurateur au paiement test, suivie via le QR — première brique visible côté client.

---

## Phase 4 — Modules périphériques (post-lancement possible)

RH, Fournisseurs, Achats, Dépenses, Charges, Rapports, Marketing/R&D — chacun indépendant des autres, peut être réordonné ou décalé après le lancement de V1 sans bloquer les phases 0-3.

---

## Points à garder en tête pendant la construction (§16)

Aucun ne bloque le démarrage, mais à trancher avant la phase concernée : rôles Marketing/Agent marketing (avant phase 0.5), seuil décaissement (avant phase 1.6), sécurité PIN — hachage/blocage (avant phase 0.4), sauvegardes BDD (avant mise en production, pas avant développement).
