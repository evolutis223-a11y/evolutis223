# CAHIER DES CHARGES — EVOLUTIS223

**Document de référence unique pour le développement.** Rédigé le 2026-07-27, consolide et remplace les cinq documents sources du dossier `design/` (Cahier des Charges Étape 1, Schéma Global Application, Spécifications Techniques et Schéma SQL, Schéma Configurateur Articles Personnalisés, Workflow Stock Vente Trésorerie) ainsi que toutes les décisions prises en session de cadrage le 2026-07-27. Les documents sources restent dans `design/` comme archive historique, mais **c'est ce fichier qui fait foi** à partir de maintenant — toute divergence entre ce fichier et un document source doit être résolue en faveur de ce fichier, ou signalée si elle semble être une erreur.

Statut : prêt pour le développement. **Révision v2 (2026-07-27, même jour)** : check profond effectué — 6 corrections techniques sur le schéma SQL (§4.3, §4.5, §4.6, §4.8) et 3 ajouts confirmés par relecture intégrale de `design/Workflow Stock Vente Tresorerie.dc.html`, repérables par l'annotation `CORRECTION 2026-07-27 (v2)` / `AJOUT 2026-07-27 (v2)`. Les points encore ouverts sont listés en fin de document (§16) et ne bloquent pas le démarrage.

---

## 1. Vision et contexte

EVOLUTIS223 est une entreprise de Bamako (Mali), quartier Badalabougou, opérant une boutique physique déjà fonctionnelle (objets publicitaires, textile personnalisé, signalétique, impression, services). L'équipe réelle aujourd'hui est **deux personnes : l'utilisateur et son frère** — pas une équipe à former, ils co-construisent l'outil.

Ce cahier des charges décrit une application de gestion interne complète (vente, stock, trésorerie, RH, documents) plus une vitrine publique avec un configurateur d'articles personnalisés à la carte — la pièce maîtresse du projet, pensée pour permettre à un client de composer et commander à distance, à toute heure.

Vision à plus long terme (pas un objectif d'architecture immédiat) : une structure en branches — **EvoluTech** (développement/prestations informatiques), **EvoluTex** (textile personnalisé), **EvoluCom** (communication, publicité, signalétique — ce que couvre déjà l'essentiel du catalogue actuel) — esquissant un possible futur "groupe EVOLUTIS223". Cette entreprise (EVOLUTIS223) reste mono-boutique ; le multi-tenant n'est pas nécessaire ici (voir §3.5).

**Branche — catégorisation légère, confirmée 2026-07-28.** Chaque article se voit assigner une branche (table `branches`, FK nullable `articles.branche_id`) — un simple tag de catégorisation pour deux usages : préparer une future scission en secteurs autonomes sans devoir la reconstruire à ce moment-là, et permettre aux Rapports (§7) de ventiler chiffre d'affaires/marge/stock par branche pour la vision globale. **Ce n'est pas du multi-tenant** (pas d'isolation de données, pas de `boutique_id`, §3.5 inchangé) — juste une dimension de reporting orthogonale aux 5 familles d'articles (§5) : la famille dit comment le stock fonctionne, la branche dit à quelle activité l'article appartient. Un article Famille A (textile) est presque toujours EvoluTex, mais un Famille C (service) peut être EvoluTech ou EvoluCom selon le cas — assignation manuelle, jamais déduite automatiquement de la famille.

---

## 2. Lexique métier

| Terme | Définition métier | Définition technique |
|---|---|---|
| **Affaire** | Toute transaction commerciale enregistrée (devis, facture, reçu/ticket) liant un client à des lignes d'articles. | Objet unique, numéro (ex. `A-26-XXXX`), type, statut, lignes, montants, solde. |
| **Commande en attente** | Commande reçue (souvent en ligne) pas encore transformée en affaire validée. | Type d'affaire `COMMANDE_ATTENTE`, distinct, avant intégration au Kanban. |
| **Ordre de Fabrication (OF)** | Instruction de production déclenchée par la vente d'un article Famille D ou d'un Kit nécessitant assemblage. | Lié à l'affaire d'origine : étapes (conception/production/contrôle/livraison), pilote assigné, suivi au Kanban. |
| **Bon de caisse / décaissement** | Pièce justificative obligatoire pour toute sortie d'argent liquide, catégorisée. | Enregistrement horodaté : catégorie, montant, motif, auteur, validation selon seuil. |
| **Acompte** | Montant versé avant livraison/facturation finale. | Paiement partiel ; l'affaire reste "en cours" tant que solde > 0. |
| **Solde** | Montant restant dû (ou trop perçu) sur une affaire. | `Solde = TTC − Σ règlements`. |
| **Famille d'article** | Catégorie déterminant le mode d'approvisionnement/vente : A Textile/douzaine, B Unité simple, C Service, D Fabrication sur commande, E Produit composé. | Champ obligatoire de la fiche article, conditionne formulaires et calculs. |
| **Variante** | Déclinaison vendable d'un article textile (taille/couleur). | Ligne de stock distincte rattachée à un article parent. |
| **Archive immuable** | Version figée d'un document officiel, non modifiable après émission. | PDF horodaté, hash d'intégrité ; correction uniquement via Avoir. |
| **Lot de production** | Enregistrement d'un approvisionnement précis, trace l'origine de chaque unité. | Horodaté : produit / réservé / vendu / restant, par variante. |
| **Réserve détail** *(généralise "Réserve personnalisation")* | Quantité mise de côté à l'appro pour la vente au détail — boutique **et** configurateur en ligne. Distincte du **stock gros** (douzaines intactes, vente en gros à partir d'un seuil configurable). Voir §5 et §9. | Ligne de stock séparée, exclue des suggestions de vente en gros. |
| **PMP** | Coût d'achat moyen pondéré, valorise stock et marge. | Recalculé à chaque entrée de lot à prix différent. |
| **Stock disponible** | Quantité réellement vendable en détail à l'instant T. | Σ mouvements du/des lot(s) − réserve − déjà vendu. |
| **Kanban** | Tableau visuel des commandes/fabrications en cours par étape. | Vue Commandes/OF groupés par statut, cartes déplaçables. |
| **Devis (V1, V2…)** | Proposition commerciale chiffrée, non engageante, révisable. | Type "Devis", versionné ; converti en Bon de commande à l'acceptation. |
| **Bon de commande** | Confirmation formelle engageant les deux parties. | Généré à la conversion du devis accepté. |
| **Facture** | Document comptable définitif, non annulable. | Archive immuable dès émission ; correction uniquement par Avoir. |
| **Ticket / Reçu** | Preuve d'achat simplifiée pour une vente comptant. | Type "Reçu" ; généralement sans délai de paiement. |
| **Avoir** | Document correctif qui annule/réduit une facture émise, sans la supprimer. | Nouvelle affaire type "Avoir", liée au numéro d'origine, montant négatif. |
| **Produit composé / Kit** | Article assemblant plusieurs articles existants, prix propre. | Fiche "recette" (composants + variante exacte requise) ; pas de stock propre. |
| **Clôture de caisse** | Vérification quotidienne obligatoire argent physique / solde théorique. | Calcule un écart, exige justification si écart ≠ 0. |
| **Fonds en circulation** | Espèces encaissées par un livreur, pas encore remises/validées. | Statut attaché au livreur (pas à la Trésorerie) jusqu'à validation Admin. |
| **Boîte noire / Journal d'audit** | Registre inviolable de toutes les actions. | Append-only, non modifiable même par Super Admin, horodaté, lié à l'auteur. |
| **Client Boutique** | Particulier, achat comptant, sans contrat. | Paiement immédiat (total ou acompte) requis avant validation. |
| **Client ONG/Contrat** | Institutionnel avec contrat-cadre, paiement différé possible. | Bon de commande signé déclenche la production ; paiement selon termes contractuels. |
| **Commande** *(renommage confirmé, remplace l'usage exclusif de "Livraison")* | Toute commande en cours de préparation, quel que soit son mode de finalisation. | Voir §8.1 — Livraison est un sous-cas, pas l'ensemble. |

---

## 3. Architecture technique

### 3.1 Vue d'ensemble des flux

```
Interface Utilisateur (Back-office + Vitrine publique)
        ↓
Serveur logique — moteurs métier
  Moteur Ventes/Commandes · Moteur Stock/Kits · Moteur Trésorerie/Caisse · Moteur Documents
        ↓                                              ↕
Base de données                          Droits d'accès (filtre chaque action)
  Articles/Variantes · Stock/Lots ·                     ↕
  Affaires/Commandes · Trésorerie/Caisse ·   Journal d'audit (trace chaque action)
  Documents archivés · Journal d'audit
```

**Règle générale :** aucun module n'écrit directement en base sans passer par son moteur logique — aucune saisie ne contourne les contrôles (droits, stock, traçabilité).

**Principe de paramétrage, confirmé 2026-07-28 :** l'utilisateur ne code pas — tout ce qui a une vraie raison de changer avec l'activité (un seuil, un tarif, un texte de document, une règle métier appelée à évoluer) doit être exposé en **Paramètres**, pas codé en dur, sinon il ne peut l'ajuster lui-même sans dépendre d'une session de développement. **Ce n'est pas pour autant un mandat de tout rendre configurable partout** : chaque module est évalué au cas par cas selon ce qui a un vrai besoin de bouger (ex. `parametres_vente_gros` §4.7, personnalisation des documents §13) — décidé module par module au moment de sa construction, pas en bloc à l'avance.

**Journal d'audit — confirmé intouchable, y compris pour Super Admin (2026-07-28).** Question posée et tranchée explicitement : même le compte le plus privilégié ne peut ni modifier ni supprimer une entrée du journal d'audit (§4.9). Raison : un journal qu'on peut altérer perd toute valeur probante, précisément dans le seul cas où elle compte (litige, erreur, PIN compromis — y compris celui du Super Admin lui-même). Accès total en **lecture** pour Super Admin, oui ; toute correction passe par une action compensatoire tracée (ex. Avoir), jamais par une suppression/modification de l'historique.

### 3.2 Stack retenu

| Couche | Choix | Pourquoi |
|---|---|---|
| Application | **Next.js / TypeScript**, installable en PWA | Un seul code pour back-office et vitrine ; installable sur téléphone (icône, plein écran) sans app store. |
| Base de données | **PostgreSQL**, centrale, hébergée en ligne | Déjà imposé par le schéma SQL (§4) ; une seule vérité partagée par tous les utilisateurs, où qu'ils soient. |
| Accès BDD | **Drizzle ORM** | Plus proche du SQL brut que Prisma — préserve les contraintes CHECK, colonnes générées et triggers d'audit déjà conçus dans le schéma. |
| UI | **Tailwind + shadcn/ui** | Cohérent avec le thème sombre/clair déjà vu dans le prototype, rapide à construire. |
| Authentification | **Téléphone + PIN**, maison (pas email, pas OAuth) | Décision du 2026-07-27 — voir §3.4. |
| Stockage fichiers | Objet compatible S3 (logos, photos produits, uploads du configurateur) | Ne pas stocker sur disque local d'un serveur éphémère. |
| Documents imprimables | Génération PDF côté serveur à partir du HTML stylé déjà conçu (`design/Modele *.dc.html`), cachet intégré automatiquement à la validation | Pas d'impression ni de tampon physique obligatoires — voir §8.4. |

### 3.3 Topologie — pourquoi pas une appli locale

Direction initiale envisagée (locale, native, offline-first) **abandonnée** après clarification : plusieurs personnes (l'utilisateur en Super Admin, l'Admin, de futurs partenaires à distance) doivent pouvoir vendre/facturer de n'importe où, à toute heure, y compris depuis un téléphone la nuit. Une base locale par machine créerait des vérités divergentes (risque de survente du même stock). Retenu :

- **Une seule application cloud**, une seule base centrale — tout le monde voit le même stock en direct.
- **PWA installable** sur téléphone — c'est ce qui permet de facturer depuis un téléphone n'importe où.
- **Le poste dédié à la boutique** garde une résilience locale : cache du catalogue/prix + file d'attente de synchronisation, pour qu'une coupure internet momentanée n'empêche pas d'encaisser au comptoir. Ce n'est **pas** une base de données locale complète — juste un tampon de secours pour ce poste précis.

### 3.4 Authentification

**Décidé : téléphone + PIN**, pas email — "sauf si ça pose problème" (révisable si un vrai problème apparaît, mais c'est la base de travail). Le schéma SQL §4.1 doit remplacer `email VARCHAR(150) UNIQUE NOT NULL` par un identifiant basé sur le téléphone + PIN (haché). Détails de sécurité (hachage du PIN, blocage après tentatives échouées) : **pas encore spécifiés**, voir §16.

### 3.5 Mono-boutique — pas de `boutique_id`

Confirmé intentionnel : EVOLUTIS223 gère une seule boutique physique ; la future boutique en ligne n'en est que l'interface web, pas un second tenant. Le schéma SQL n'a donc pas besoin de `boutique_id`. (Contexte : GESTE223, le projet précédent, était lui pensé comme un produit SaaS multi-tenant potentiellement vendu à d'autres boutiques — c'est pour ça qu'il avait cette notion, sans rapport avec le besoin d'EVOLUTIS223 aujourd'hui.)

### 3.6 Hébergement

| Offre | Prix | Facturation | Avantages | Inconvénients |
|---|---|---|---|---|
| Vercel Hobby + Neon Free | 0 F/mois | Mensuel | Gratuit, déploiement simple | **Vercel Hobby interdit l'usage commercial par contrat** — à ne pas utiliser pour une vraie entreprise |
| **Vercel Pro + Neon Free — retenu** | ≈ 12 000 F/mois (≈20 $) | Mensuel ou annuel (~-20 %) | Usage commercial couvert, excellent CDN pour la vitrine publique, support, pas de mise en veille | Coût fixe même à faible trafic |
| Railway (tout-en-un) | ≈ 3 000–15 000 F/mois | À l'usage | App + base + stockage réunis, facture qui suit l'activité réelle | Facture moins prévisible, écosystème plus jeune |
| VPS auto-géré (Hetzner/OVH) | ≈ 4 500 F/mois | Mensuel/annuel | Le moins cher en absolu | Sauvegardes/sécurité/mises à jour à la charge de l'utilisateur — **déconseillé** pour un opérateur solo sans sysadmin dédié |

**Timing confirmé :** ces coûts ne démarrent pas pendant le développement (travail en local / paliers gratuits) — seulement à la mise en production réelle. Seul le nom de domaine (≈830 F/mois amorti) vaut la peine d'être réservé tôt.

---

## 4. Modèle de données (schéma SQL de référence, mis à jour)

Base : PostgreSQL. Le schéma ci-dessous reprend celui du document source (marqué "figé") et intègre les décisions de cadrage. **Changements par rapport au schéma figé d'origine sont annotés `-- MAJ 2026-07-27`.**

### 4.1 Identité / Droits

```sql
CREATE TABLE roles (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(30) UNIQUE NOT NULL,
  -- MAJ 2026-07-27 : liste complète, voir §6 —
  -- SUPER_ADMIN, ADMIN, MANAGER, COMPTABLE, RESP_COMMERCIAL, COMMERCIAL,
  -- VENDEUR, FREELANCE, JOURNALIER, EMPLOYE, SUPPORT, LIVREUR, LIVREUR_PARTENAIRE
  libelle       VARCHAR(60) NOT NULL
);

CREATE TABLE utilisateurs (
  id             SERIAL PRIMARY KEY,
  nom            VARCHAR(100) NOT NULL,
  -- MAJ 2026-07-27 : remplace email par téléphone + PIN (voir §3.4)
  telephone      VARCHAR(20) UNIQUE NOT NULL,
  pin_hash       TEXT NOT NULL,
  role_id        INTEGER NOT NULL REFERENCES roles(id),
  actif          BOOLEAN NOT NULL DEFAULT TRUE
);
```

### 4.2 Clients

```sql
CREATE TABLE clients (
  id                     SERIAL PRIMARY KEY,
  type_client            VARCHAR(20) NOT NULL CHECK (type_client IN ('BOUTIQUE','ONG_CONTRAT')),
  nom                    VARCHAR(150) NOT NULL,
  contact                VARCHAR(150),
  contrat_ref            VARCHAR(60),
  paiement_differe_jours INTEGER
);
```

### 4.3 Articles, Variantes, Lots, Mouvements de stock

```sql
CREATE TABLE articles (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(30) UNIQUE NOT NULL,
  nom           VARCHAR(150) NOT NULL,
  famille       CHAR(1) NOT NULL CHECK (famille IN ('A','B','C','D','E')),
  -- A: Textile/douzaine · B: Unité simple · C: Service · D: Fabrication sur commande · E: Kit
  prix_vente    NUMERIC(12,2) NOT NULL,
  pmp           NUMERIC(12,2) NOT NULL DEFAULT 0,
  a_variantes   BOOLEAN NOT NULL DEFAULT FALSE,
  -- AJOUT 2026-07-27 (v2, confirmé par design/Workflow Stock Vente Tresorerie.dc.html §"Nos produits") :
  -- absent de la v1. Un article créé au Catalogue n'apparaît PAS automatiquement sur la vitrine
  -- publique — bascule explicite "🌐 Publié sur la boutique en ligne". Règle associée (app-level) :
  -- une variante réserve détail n'est jamais publiable, quelle que soit la valeur de ce champ.
  publie_boutique BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE variantes (
  id            SERIAL PRIMARY KEY,
  article_id    INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  taille        VARCHAR(20),   -- NULL = "variante par défaut" pour un article Famille B sans déclinaison
  couleur       VARCHAR(30),   -- NULL = idem
  seuil_alerte  INTEGER NOT NULL DEFAULT 0
);
-- MAJ 2026-07-27 : les articles Famille B (mug, stylo — sans taille/couleur) utilisent une
-- unique variante "par défaut" (taille=NULL, couleur=NULL) — pas de nouvelle table, pattern déjà
-- confirmé fonctionnel dans le prototype (fiche "Stock disponible: N" sans grille de variantes).
-- CORRECTION 2026-07-27 (v2, check profond) : un simple UNIQUE(article_id, taille, couleur) NE
-- PROTÈGE PAS le cas NULL/NULL — en PostgreSQL deux NULL ne sont jamais égaux pour une contrainte
-- UNIQUE, donc rien n'empêchait de créer deux "variantes par défaut" pour le même article Famille B
-- (stock qui se scinde silencieusement en deux lignes). Remplacé par deux index partiels :
CREATE UNIQUE INDEX uq_variante_defaut
  ON variantes (article_id) WHERE taille IS NULL AND couleur IS NULL;
CREATE UNIQUE INDEX uq_variante_taille_couleur
  ON variantes (article_id, taille, couleur) WHERE taille IS NOT NULL OR couleur IS NOT NULL;

CREATE TABLE lots (
  id                  SERIAL PRIMARY KEY,
  article_id          INTEGER NOT NULL REFERENCES articles(id),
  reference           VARCHAR(40),
  date_reception      TIMESTAMP NOT NULL DEFAULT now(),
  prix_achat_unitaire NUMERIC(12,2) NOT NULL
);
-- AJOUT 2026-07-27 (v2, confirmé par design/Workflow Stock Vente Tresorerie.dc.html §"Stock/Catalogue") :
-- suppression d'un lot possible (droit de retour sur erreur de saisie à l'appro), mais UNIQUEMENT
-- si aucune de ses lot_variantes n'a encore été vendue ni libérée vers/depuis la réserve détail —
-- contrôle app-level à la suppression (aucun mouvement de type VENTE/LIBERATION référençant ce
-- lot_id), sinon refus explicite. Ne contredit pas l'immuabilité des documents (§8.4) : ceci
-- corrige une saisie de stock avant toute vente, pas un document déjà émis.

CREATE TABLE lot_variantes (
  id                 SERIAL PRIMARY KEY,
  lot_id             INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  variante_id        INTEGER NOT NULL REFERENCES variantes(id),
  quantite_produite  INTEGER NOT NULL CHECK (quantite_produite >= 0),
  UNIQUE (lot_id, variante_id)
);

-- CORRECTION 2026-07-27 (v2, check profond) : la version v1 encodait le pool (détail/gros) DANS
-- le type du mouvement, avec une seule quantité signée par ligne. Résultat vérifié incohérent :
-- TRANSFERT_GROS_VERS_DETAIL était compté dans stock_detail ET stock_gros avec le même signe
-- (le transfert créait du stock au lieu de le déplacer), et RESERVE_DETAIL/LIBERATION_RESERVE
-- n'étaient pas soustraits du pool d'origine (stock_total gonflait à chaque réservation). Un
-- transfert entre deux pools ne peut pas être représenté par une seule ligne signée — il lui faut
-- une ligne par pool impacté. Nouveau modèle : `pool` explicite, `type` réduit à des mouvements
-- primaires (plus de type "transfert" qui mélangeait les deux pools dans une ligne).
CREATE TABLE stock_mouvements (
  id             SERIAL PRIMARY KEY,
  variante_id    INTEGER NOT NULL REFERENCES variantes(id),
  lot_id         INTEGER REFERENCES lots(id),
  pool           VARCHAR(10) NOT NULL CHECK (pool IN ('GROS','DETAIL')),
  type           VARCHAR(20) NOT NULL CHECK (type IN
                   ('ENTREE','VENTE','RESERVATION','LIBERATION','AJUSTEMENT')),
  -- ENTREE : appro, toujours pool=GROS, quantite > 0
  -- VENTE : décrément à la vente, quantite < 0, pool selon canal (détail vs gros)
  -- RESERVATION : écrit 2 lignes liées (transfert_ref) — (GROS,-N) + (DETAIL,+N)
  -- LIBERATION : inverse de RESERVATION — (DETAIL,-N) + (GROS,+N)
  -- AJUSTEMENT : correction manuelle motivée, quantite signée, pool concerné
  quantite       INTEGER NOT NULL,   -- signé
  transfert_ref  UUID,               -- lie les 2 lignes d'une RESERVATION/LIBERATION ; NULL sinon
  affaire_id     INTEGER,            -- si type = VENTE ; FK ajoutée après création de affaires
  auteur_id      INTEGER NOT NULL REFERENCES utilisateurs(id),
  date_mouvement TIMESTAMP NOT NULL DEFAULT now()
);
-- ALTER TABLE stock_mouvements ADD CONSTRAINT fk_mvt_affaire FOREIGN KEY (affaire_id) REFERENCES affaires(id);

-- Chaque ligne porte déjà son pool — plus de recomposition par filtrage de type, plus de double
-- comptage possible. stock_total = somme des deux pools, par construction cohérente.
CREATE VIEW v_stock_variante AS
SELECT
  v.id AS variante_id,
  v.article_id,
  COALESCE(SUM(CASE WHEN m.pool = 'DETAIL' THEN m.quantite ELSE 0 END), 0) AS reserve_detail,
  COALESCE(SUM(CASE WHEN m.pool = 'DETAIL' THEN m.quantite ELSE 0 END), 0) AS stock_detail,
  COALESCE(SUM(CASE WHEN m.pool = 'GROS'   THEN m.quantite ELSE 0 END), 0) AS stock_gros,
  COALESCE(SUM(m.quantite), 0) AS stock_total
FROM variantes v
LEFT JOIN stock_mouvements m ON m.variante_id = v.id
GROUP BY v.id, v.article_id;
-- Note : reserve_detail et stock_detail sont ici la même colonne (une variante A n'a qu'un seul
-- pool détail par construction) — gardées séparées uniquement pour ne pas casser le nom de colonne
-- déjà utilisé ailleurs dans ce document (§9, §10).
```

### 4.4 Kits (composants de recette)

```sql
CREATE TABLE kit_composants (
  id                    SERIAL PRIMARY KEY,
  kit_article_id        INTEGER NOT NULL REFERENCES articles(id), -- famille = 'E'
  composant_article_id  INTEGER NOT NULL REFERENCES articles(id),
  variante_id           INTEGER REFERENCES variantes(id), -- OBLIGATOIRE si composant textile
  quantite_requise      INTEGER NOT NULL CHECK (quantite_requise > 0),
  CHECK (kit_article_id <> composant_article_id)
);
-- Contrainte métier (validée en appli) : si composant_article_id.a_variantes = TRUE, variante_id obligatoire.
```

### 4.5 Commandes, Affaires, Lignes, Règlements, Ordres de Fabrication

```sql
-- MAJ 2026-07-27 : la table affaires reste le cœur, le module applicatif "Commande" (§8.1) en est
-- l'ombrelle fonctionnelle — mais CORRECTION 2026-07-27 (v2) : ce n'est PAS une deuxième numérotation.
-- Une affaire garde un seul numéro, préfixé par son TYPE (DEV- Devis, BC- Bon de commande,
-- FACT- Facture, TIC- Ticket, AVR- Avoir, CDE- Commande en attente) — "Commande" au sens module
-- désigne juste le pipeline de préparation/statut, pas un espace de numérotation séparé. LIV-
-- reste le préfixe propre au sous-enregistrement livraisons (table livraisons, §4.5), seul cas où
-- deux numéros coexistent légitimement pour une même affaire (l'affaire + sa livraison).
CREATE TABLE affaires (
  id                 SERIAL PRIMARY KEY,
  numero             VARCHAR(20) UNIQUE NOT NULL, -- ex DEV-26-0001 / FACT-26-0001 / CDE-26-0001
  type               VARCHAR(20) NOT NULL CHECK (type IN
                       ('COMMANDE_ATTENTE','DEVIS','PROFORMA','BON_COMMANDE','TICKET','FACTURE','AVOIR')),
                       -- MAJ : ajout PROFORMA (voir §12 — demandes partenaires en attente de validation)
  statut             VARCHAR(20) NOT NULL DEFAULT 'EN_COURS'
                       CHECK (statut IN ('EN_ATTENTE','EN_COURS','VALIDEE','CLOTUREE','ANNULEE')),
  mode_finalisation  VARCHAR(20) CHECK (mode_finalisation IN ('RETRAIT','LIVRAISON')), -- MAJ 2026-07-27, voir §8.1
  client_id          INTEGER NOT NULL REFERENCES clients(id),
  devis_parent_id    INTEGER REFERENCES affaires(id),
  version            INTEGER NOT NULL DEFAULT 1,
  affaire_origine_id INTEGER REFERENCES affaires(id),
  montant_ttc        NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_creation      TIMESTAMP NOT NULL DEFAULT now(),
  auteur_id          INTEGER NOT NULL REFERENCES utilisateurs(id),
  immuable           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE lignes_affaire (
  id            SERIAL PRIMARY KEY,
  affaire_id    INTEGER NOT NULL REFERENCES affaires(id) ON DELETE CASCADE,
  article_id    INTEGER NOT NULL REFERENCES articles(id),
  variante_id   INTEGER REFERENCES variantes(id),
  quantite      INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC(12,2) NOT NULL
);

CREATE TABLE reglements (
  id             SERIAL PRIMARY KEY,
  affaire_id     INTEGER NOT NULL REFERENCES affaires(id),
  montant        NUMERIC(12,2) NOT NULL,
  -- CORRECTION 2026-07-27 (v2) : liste ouverte à l'origine, sans CHECK — incohérent avec le reste
  -- du schéma (chaque champ à vocabulaire contrôlé a un CHECK). Le choix agrégateur Mobile Money
  -- étant tranché (§12), les valeurs sont connues :
  mode           VARCHAR(20) NOT NULL CHECK (mode IN ('ESPECES','MOBILE_MONEY','VIREMENT','CARTE')),
  date_reglement TIMESTAMP NOT NULL DEFAULT now(),
  auteur_id      INTEGER NOT NULL REFERENCES utilisateurs(id)
);
-- Solde = affaires.montant_ttc - SUM(reglements.montant)

CREATE TABLE ordres_fabrication (
  id               SERIAL PRIMARY KEY,
  affaire_id       INTEGER NOT NULL REFERENCES affaires(id),
  ligne_affaire_id INTEGER NOT NULL REFERENCES lignes_affaire(id),
  etape            VARCHAR(20) NOT NULL DEFAULT 'CONCEPTION'
                     CHECK (etape IN ('CONCEPTION','PRODUCTION','CONTROLE_QUALITE','LIVRAISON')),
  pilote_id        INTEGER REFERENCES utilisateurs(id),
  date_creation    TIMESTAMP NOT NULL DEFAULT now()
);

-- MAJ 2026-07-27 : nouvelle table, sous-enregistrement Livraison lié à une affaire
-- (uniquement si mode_finalisation = 'LIVRAISON') — voir §8.1
CREATE TABLE livraisons (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(20) UNIQUE NOT NULL, -- ex LIV-26-0001
  affaire_id      INTEGER NOT NULL REFERENCES affaires(id),
  livreur_id      INTEGER REFERENCES utilisateurs(id), -- rôle LIVREUR ou LIVREUR_PARTENAIRE
  statut          VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
                    CHECK (statut IN ('EN_ATTENTE','PRIS_EN_CHARGE','EN_ROUTE','LIVREE','ECHEC')),
  adresse         TEXT,
  date_creation   TIMESTAMP NOT NULL DEFAULT now()
);
```

### 4.6 Trésorerie — Bons de décaissement, Clôtures de caisse, Fonds en circulation

```sql
CREATE TABLE bons_decaissement (
  id            SERIAL PRIMARY KEY,
  categorie     VARCHAR(20) NOT NULL CHECK (categorie IN ('ACHAT_MARCHANDISE','CHARGE_GENERAL','RH_SALAIRE')),
  montant       NUMERIC(12,2) NOT NULL,
  motif         TEXT NOT NULL,
  auteur_id     INTEGER NOT NULL REFERENCES utilisateurs(id),
  validateur_id INTEGER REFERENCES utilisateurs(id), -- requis si montant > seuil
  date_creation TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE clotures_caisse (
  id              SERIAL PRIMARY KEY,
  date_cloture    DATE NOT NULL UNIQUE,
  solde_theorique NUMERIC(12,2) NOT NULL,
  comptage_reel   NUMERIC(12,2) NOT NULL,
  ecart           NUMERIC(12,2) GENERATED ALWAYS AS (comptage_reel - solde_theorique) STORED,
  justification   TEXT,
  auteur_id       INTEGER NOT NULL REFERENCES utilisateurs(id)
);

-- Sert aussi bien le Livreur interne que le Livreur partenaire externe (voir §6)
CREATE TABLE fonds_circulation (
  id              SERIAL PRIMARY KEY,
  livreur_id      INTEGER NOT NULL REFERENCES utilisateurs(id),
  affaire_id      INTEGER NOT NULL REFERENCES affaires(id),
  montant_attendu NUMERIC(12,2) NOT NULL,
  statut          VARCHAR(20) NOT NULL DEFAULT 'EN_CIRCULATION' CHECK (statut IN ('EN_CIRCULATION','VALIDE')),
  montant_remis   NUMERIC(12,2),
  validateur_id   INTEGER REFERENCES utilisateurs(id),
  date_remise     TIMESTAMP
);
```

### 4.7 Stock détail vs stock gros — paramètre configurable

```sql
-- MAJ 2026-07-27 — voir §5 et §9 : seuil admin-ajustable, par article ou global
CREATE TABLE parametres_vente_gros (
  id                SERIAL PRIMARY KEY,
  article_id        INTEGER REFERENCES articles(id), -- NULL = valeur par défaut globale
  seuil_douzaines   INTEGER NOT NULL DEFAULT 1, -- quantité (en douzaines) à partir de laquelle une commande est traitée en gros
  modifie_par       INTEGER NOT NULL REFERENCES utilisateurs(id),
  date_modification TIMESTAMP NOT NULL DEFAULT now()
);
```

### 4.8 Validation vente au détail — demandes admin

```sql
-- MAJ 2026-07-27 — voir §9, workflow maqueté et approuvé
-- CORRECTION 2026-07-27 (v2) : la v1 n'avait aucun lien vers la vente bloquée elle-même — impossible
-- de savoir quelle affaire reprendre une fois la demande autorisée. Ajout de affaire_id : la
-- commande entre toujours d'abord comme affaire type COMMANDE_ATTENTE (§8.1 règle 1) avant tout
-- contrôle de stock, donc la ligne existe déjà au moment où le blocage se produit.
CREATE TABLE demandes_validation_stock (
  id               SERIAL PRIMARY KEY,
  affaire_id       INTEGER NOT NULL REFERENCES affaires(id), -- l'affaire (COMMANDE_ATTENTE) bloquée, à reprendre après décision
  variante_id      INTEGER NOT NULL REFERENCES variantes(id),
  quantite_demandee INTEGER NOT NULL,
  manque           INTEGER NOT NULL,
  canal            VARCHAR(20) NOT NULL CHECK (canal IN ('BOUTIQUE','EN_LIGNE')),
  demandeur_id     INTEGER NOT NULL REFERENCES utilisateurs(id),
  statut           VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
                     CHECK (statut IN ('EN_ATTENTE','AUTORISEE','RECHARGEE','REFUSEE')),
  quantite_rechargee INTEGER,
  traite_par_id    INTEGER REFERENCES utilisateurs(id),
  date_creation    TIMESTAMP NOT NULL DEFAULT now(),
  date_traitement  TIMESTAMP
);
```

### 4.9 Documents archivés, Journal d'audit

```sql
CREATE TABLE documents_archives (
  id             SERIAL PRIMARY KEY,
  affaire_id     INTEGER NOT NULL REFERENCES affaires(id),
  type           VARCHAR(20) NOT NULL,
  fichier_path   TEXT NOT NULL,
  hash_integrite VARCHAR(64) NOT NULL, -- SHA-256, garantit l'immuabilité
  qr_payload     TEXT, -- MAJ 2026-07-27 : contenu encodé dans le QR (suivi commande + messages, voir §11)
  date_emission  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE journal_audit (
  id                BIGSERIAL PRIMARY KEY,
  table_cible       VARCHAR(60) NOT NULL,
  enregistrement_id INTEGER NOT NULL,
  action            VARCHAR(20) NOT NULL, -- CREATION, MODIFICATION, SUPPRESSION, VALIDATION
  utilisateur_id    INTEGER NOT NULL REFERENCES utilisateurs(id),
  details           JSONB,
  date_action       TIMESTAMP NOT NULL DEFAULT now()
);
-- Aucun UPDATE/DELETE autorisé sur journal_audit (GRANT restreint / trigger REVOKE).
```

**Ordre de création** : respecter l'ordre des sections 4.1 → 4.9 (clés étrangères).

---

## 5. Les 5 familles d'articles

Chaque article appartient à UNE seule famille, qui détermine comment son stock est constitué, affiché et vendu. Toutes convergent vers le même Stock et le même Catalogue — seule la façon de renseigner la quantité change.

| Famille | Exemples | Approvisionnement | Stock résultant |
|---|---|---|---|
| **A — Textile par douzaine** | Polo, T-shirt | Douzaines + répartition taille/couleur + réserve (en pièces) | **Réserve détail** (unité, boutique+configurateur) séparée du **stock gros** (douzaines intactes) — voir §9. Lot de production tracé. |
| **B — Unité simple** | Mug, stylo, casquette unie | Quantité initiale + seuil, pas de taille/couleur | Une seule ligne de stock (variante "par défaut", taille=NULL couleur=NULL). Réserve possible si personnalisable. |
| **C — Service sans stock** | Relooking, reportage photo | Aucun — créé au Catalogue avec un prix | Stock affiché "—", toujours vendable. "Vendre" crée une entrée Agenda/Commandes plutôt qu'un mouvement de stock. |
| **D — Fabrication sur commande** | Signalétique, impression grand format | Aucun stock de produit fini (matière première optionnelle) | Vente sans contrôle de stock fini ; déclenche automatiquement un **Ordre de Fabrication** (Kanban Conception→Production→Contrôle→Livraison/Retrait). |
| **E — Produit composé / Kit** | "Kit Rentrée" = tenue + sac + stylo | Aucune saisie propre — recette de composants existants | Stock calculé = MIN(stock de chaque composant ÷ quantité requise), jamais saisi. Voir algorithme §10. |

**Moteur de vente unifié** — le formulaire "Nouvelle affaire" reste unique ; ce qui change selon la famille :

| Famille | Contrôle à la vente | Décrémenté |
|---|---|---|
| A | Qté ≤ stock détail (ou déclenche §9 si insuffisant) | Ligne taille/couleur, FIFO par lot |
| B | Qté ≤ stock | Ligne unique, FIFO par lot |
| C | Aucun | Rien — entrée Agenda/Commandes |
| D | Aucun (ou matière première si suivie) | Matière première si suivie ; Ordre de Fabrication créé |
| E | Qté ≤ stock calculé (composant limitant) | Chaque composant, sur sa variante exacte |

Dans tous les cas : client + au moins un article obligatoires ; réserve jamais proposée à la vente en gros ; message d'erreur explicite si contrôle échoué — **jamais d'échec silencieux**.

---

## 6. Rôles et permissions

Rôles cibles (fusion du schéma SQL d'origine, du prototype et des décisions de cadrage) :

| Rôle | Statut | Portée |
|---|---|---|
| Super Admin | Existant | Accès complet, y compris prix d'achat, journal d'audit, gestion des rôles. Seul à pouvoir modifier les droits d'un autre utilisateur. |
| Admin | Existant | Vente, stock, catalogue, validations (remises, retours, demandes de réserve détail §9). Prix d'achat masqué sauf autorisation nominative. |
| Manager | Existant (prototype) | Vue globale opérationnelle. |
| Comptable | Existant | Règlements, achats, dépenses, trésorerie. Pas de modification stock/catalogue. |
| Responsable Commercial | Existant | Supervise Commercial + Vendeur, valide commissions, remises jusqu'à un plafond. |
| Commercial | Existant | Devis/factures B2B, ses clients, catalogue en lecture seule. Pas d'accès règlements/trésorerie. |
| Vendeur | Existant | Vente guichet boutique, encaissement. Pas de gestion clients ni négociation. |
| Freelance | Existant | Apporteur d'affaires/vendeur externe en ligne. Portail dédié, lecture seule sur ses deals/commissions. |
| Journalier | Existant | Main-d'œuvre ponctuelle (RH). **Aucun compte applicatif**, payé en espèces via Caisse. |
| Employé | Existant | Accès de base (stock, livraisons). |
| Support | Existant | Tickets et assistance. |
| **Livreur (interne)** | **Nouveau, 2026-07-27** | Pas encore embauché (livraisons gérées ad hoc par l'utilisateur avec des livreurs locaux sans compte) — profil créé par anticipation. Accès : Commandes/Livraisons — lecture + statut, scopé à ses livraisons assignées uniquement ; Fonds en circulation — déclare son montant remis, voit son propre solde, **pas** de droit de validation (reste Admin/Comptable, `validateur_id`) ; Clients — lecture seule, contact/adresse de livraison uniquement. Rien d'autre. |
| **Livreur partenaire (externe)** | **Nouveau, 2026-07-27** | Pour les partenariats ponctuels actuels avec des livreurs locaux informels — objectif : automatiser au lieu de coordonner par téléphone/WhatsApp, sans en faire des employés. Portail léger façon Freelance, connexion téléphone+PIN, mêmes droits scopés que le Livreur interne. |

**Points de droits fins** (au-delà de la matrice par rôle) :
- **Prix d'achat** : visible par Super Admin uniquement ; autorisation nominative possible pour une personne précise.
- **Conversion Devis → Facture** : Super Admin uniquement par défaut ; autorisation nominative possible ; toute modification de prix/quantité lors de la conversion part automatiquement en validation.
- **Droits temporaires** : octroi d'un droit à une personne nommée, borné dans le temps et/ou par zone/activité, avec date d'expiration et révocation possible.

**Incohérence relevée, à trancher** : le sélecteur de profils du prototype liste aussi "Marketing" et "Agent marketing" comme personas distincts, mais la matrice de permissions réelle ne les répertorie pas séparément (probablement à fondre dans Employé, ou à leur donner leur propre ligne) — non résolu.

---

## 7. Modules fonctionnels

19 modules confirmés dans le prototype : Tableau de bord, Affaires, Clients, Catalogue, Nos produits, Marketing, R&D, Stocks, **Commandes** (voir §8.1), Règlements, Documents, RH, Commercial, Fournisseurs, Achats, Dépenses, Charges, Trésorerie, Rapports, Paramètres.

| Module | Reçoit de | Alimente |
|---|---|---|
| Fournisseurs | Saisie manuelle (contact, délais) | Prix d'achat et origine des lots à l'approvisionnement |
| Clients | Affaires enregistrées | Historique, solde dû, Trésorerie |
| RH | Saisie manuelle (employés/partenaires) | Commissions calculées sur les Affaires → Trésorerie |
| Marketing | Articles du Catalogue | Promos sur prix de vente, demandes de devis → Affaires |
| Commandes | Affaires (retrait/livraison), fabrications Famille D | Statut livré/retiré → clôture de l'affaire |
| Documents | Chaque affaire (Devis/Facture/Reçu/Bon) | Archive imprimable, aucune saisie propre |
| Rapports | Affaires, Stock, Dépenses/Charges, Commissions, Commandes — tous les modules | Tableaux de bord jour/semaine/mois/semestre/an |

**Rapport** — 5 fréquences (quotidien, hebdomadaire, mensuel, semestriel, annuel), 4 dimensions (Finance, RH, Incidents, Prévisions). Bénéfice brut = CA − coût d'achat des ventes ; bénéfice net = brut − dépenses/charges/commissions. Toujours recalculé, jamais saisi à la main.

---

## 8. Processus métier fondateurs

### 8.1 Flux Commandes et Production — Commande vs Livraison

**Renommage confirmé (2026-07-27)** : le module était nommé "Livraison" à l'origine, l'utilisateur avait demandé son élargissement en "Commandes" — vérifié dans le prototype, seul le libellé du menu avait changé, tout le dessous (codes `LIV-26-00xx`, statut "Livrée", bilan "PAIEMENTS LIÉS AUX LIVRAISONS") restait Livraison-only. **Modèle cible :**

- **Commande = ombrelle** : toute commande dans le pipeline de préparation, quel que soit son mode de finalisation.
- **Livraison = un sous-cas** de finalisation, l'autre étant **Retrait en boutique** (`mode_finalisation`, §4.5).
- Préfixe `CMD-` pour toute commande ; sous-enregistrement `LIV-` (table `livraisons`, §4.5) uniquement si `mode_finalisation = LIVRAISON`.
- Statuts partagés au début (Préparation → Prêt), puis bifurquent : Retrait → en attente de retrait → retirée → clôturée ; Livraison → en cours de livraison → livrée → clôturée.
- Bilan des paiements reformulé pour être neutre (couvre les deux modes), pas "liés aux livraisons" spécifiquement.

**Règles (reprises du Cahier des Charges Étape 1, toujours valides) :**
1. Toute commande (boutique en ligne ou guichet) entre d'abord comme **Commande en attente** — jamais directement comme affaire validée.
2. Le type de client détermine la suite : **Boutique/Particulier** exige paiement (total ou acompte) avant validation ; **ONG/Contrat** peut être validée sur Bon de commande signé, paiement différé selon contrat.
3. Une fois validée, l'affaire entre au **Kanban** à l'étape Conception.
4. Si l'article est Famille D ou un Kit nécessitant assemblage, un **Ordre de Fabrication** est déclenché automatiquement.
5. L'OF progresse (Conception → Production → Contrôle qualité → Livraison/Retrait) ; chaque changement d'étape est journalisé.
6. Clôture de l'affaire uniquement après confirmation de livraison/retrait.

### 8.2 Flux Trésorerie et Dépenses espèces

1. Aucune écriture libre : toute sortie d'argent liquide exige un **Bon de décaissement**, catégorisé (Achat marchandise / Charge générale / RH-Salaire).
2. Au-delà d'un seuil défini, validation hiérarchique obligatoire avant exécution.
3. **Clôture de caisse** quotidienne obligatoire : comptage physique vs solde théorique.
4. Écart ≠ 0 bloque la clôture tant qu'une justification n'est pas saisie ; tracé au Journal d'audit.
5. Une livraison encaissée en espèces sur le terrain ne rejoint jamais directement la caisse centrale : statut **Fonds en circulation**, sous la responsabilité du livreur (interne ou partenaire, §6) jusqu'à remise.
6. La remise exige une **validation manuelle Admin/Comptable** (rapprochement montant remis / attendu) ; c'est seulement là que le montant impacte la Trésorerie centrale.
7. Tant que non validé, le solde du livreur reste visible séparément, jamais fondu dans la Trésorerie ; tout écart est tracé.

**Implémenté et vérifié en base réelle (2026-07-28)** : livreur assignable à une livraison directement dans Commandes (`assignerLivreur`) ; marquer une livraison "Livrée" avec un solde restant propose un champ "espèces reçues" — si renseigné, crée une ligne `fonds_circulation` (statut `EN_CIRCULATION`) au lieu d'un règlement direct (`app/commandes/actions.ts` — `avancerLivraison`). Écran Admin/Comptable à `/fonds-circulation` : rapprochement montant remis/attendu, "Valider la remise" insère alors le règlement réel (mode ESPECES, impacte immédiatement `calculerSoldeTheorique`) et trace l'écart dans `journal_audit`. Le livreur voit son propre solde en circulation dans Commandes (bandeau, pas de nouveau module). Testé de bout en bout sur Neon : encaissement partiel (5 000 F sur 7 000 F de solde) → fonds en circulation → remise de 4 800 F → écart -200 F correctement tracé, règlement créé à la date de validation (pas de la collecte).

### 8.3 Calcul du stock des Kits (Famille E)

1. Un Kit n'a jamais de quantité saisie directement — toujours recalculée depuis sa recette.
2. La recette liste chaque composant, la quantité requise par kit, et — si composant textile — la **variante exacte exigée** (jamais une famille entière de tailles).
3. Si le client choisit une variante à la commande, le contrôle cible **uniquement cette variante précise**.
4. La réserve détail d'une variante n'est jamais comptée dans le stock disponible d'un kit.
5. Pour chaque composant : `stock possible = stock disponible de la variante exacte ÷ quantité requise` (arrondi bas).
6. Stock du Kit = le plus petit résultat parmi tous les composants (le "goulot d'étranglement"), avec composant/variante limitant affiché en clair.
7. Si la variante précise demandée est épuisée, la vente est **bloquée** même si d'autres variantes du même composant sont disponibles.
8. Vendre un Kit décrémente chaque composant sur sa variante exacte — contrôle variante par variante, jamais agrégé.

**Algorithme de référence (JavaScript, déjà validé, à porter tel quel) :**

```js
/**
 * Vérifie la disponibilité d'un Kit variante par variante (jamais agrégée)
 * et bloque la vente si une variante exacte requise est en rupture.
 */
function verifierDisponibiliteKit(recette, quantiteDemandee, getStockDisponible) {
  let stockKit = Infinity;
  let composantLimitant = null;

  for (const ligne of recette) {
    if (ligne.varianteId == null) {
      throw new Error(`Composant ${ligne.composantArticleId} sans variante exacte définie : recette invalide.`);
    }
    const stockVariante = getStockDisponible(ligne.varianteId); // réserve détail déjà exclue
    const stockPossible = Math.floor(stockVariante / ligne.quantiteRequise);
    if (stockPossible < stockKit) {
      stockKit = stockPossible;
      composantLimitant = { ...ligne, stockVariante, stockPossible };
    }
  }

  const venteAutorisee = stockKit >= quantiteDemandee;
  return {
    stockKitCalcule: stockKit,
    venteAutorisee,
    composantLimitant: venteAutorisee ? null : composantLimitant,
    message: venteAutorisee ? null :
      `Rupture : variante exacte requise (id ${composantLimitant.varianteId}) insuffisante — ` +
      `stock possible ${composantLimitant.stockPossible}, demandé ${quantiteDemandee}.`
  };
}

function vendreKit({ recette, quantiteDemandee, affaireId, auteurId, getStockDisponible, enregistrerMouvement }) {
  const verif = verifierDisponibiliteKit(recette, quantiteDemandee, getStockDisponible);
  if (!verif.venteAutorisee) return { statut: 'BLOQUEE', ...verif };

  for (const ligne of recette) {
    enregistrerMouvement({
      varianteId: ligne.varianteId,
      type: 'VENTE',
      quantite: -(ligne.quantiteRequise * quantiteDemandee),
      affaireId, auteurId, dateMouvement: new Date()
    });
  }
  return { statut: 'AUTORISEE', ...verif };
}
```

**Implémenté et vérifié en base réelle (2026-07-28)** : recette gérée dans Stocks (`app/stocks/actions.ts` — `listerRecetteKit`, `ajouterComposantKit`, `retirerComposantKit`), stock calculé en direct (`calculerStockKit`) et affiché avec le composant limitant. Vente intégrée dans `validerAffaire` (`app/affaires/actions.ts`) : blocage direct (pas de workflow Admin comme §9, la spec ne le prévoit pas pour les kits) si insuffisant, décrément par composant sinon. **Précision par rapport à l'algorithme de référence** : celui-ci suppose un seul pool générique ; en pratique un composant Famille A (détail/gros) se contrôle et se décrémente sur le stock **gros** (réserve détail exclue, point 4), tandis qu'un composant Famille B (pas de split détail/gros — tout son stock vit en `DETAIL`) se contrôle et se décrémente sur son seul pool réel. Testé de bout en bout sur Neon : kit à 2 composants (1 Famille B + 1 Famille A), goulot d'étranglement correctement identifié sur le composant Famille A, blocage à quantité excessive, vente réussie décrémentant chaque composant sur son pool et lot corrects (FIFO).

### 8.4 Gestion et archivage des documents

1. Un **Devis** peut être révisé (V1, V2…) tant qu'il n'est pas accepté ; chaque révision archive la précédente sans la supprimer.
2. L'acceptation génère un **Bon de commande**, engageant les deux parties.
3. Selon le mode de vente : **Ticket** (comptant guichet) ou **Facture** (crédit/institutionnel).
4. Dès émission, Ticket et Facture deviennent une **Archive PDF immuable** : aucune modification/suppression, par personne, y compris Super Admin.
5. Toute erreur après émission se corrige exclusivement par un **Avoir**.
6. **Nouveau (2026-07-27)** : le PDF est généré et "cacheté" automatiquement à la validation — pas d'impression ni de tampon physique obligatoires. Le document numérique fait foi, envoyable directement depuis un téléphone.

---

## 9. Réserve détail vs stock gros — règle métier et workflow de validation

**Principe (généralise "Réserve personnalisation", 2026-07-27) :** les polos (Famille A) sont achetés par la douzaine, avec une répartition de tailles fixe par douzaine. À chaque approvisionnement, le stock se scinde en deux :
- **Réserve détail** : pièces mises de côté pour la vente à l'unité — boutique physique **et** configurateur en ligne (voir §10).
- **Stock gros** : conservé en douzaines intactes, pour les commandes en gros au-delà d'un **seuil configurable** (§4.7, ex. 20 douzaines).

**Pourquoi** : si la vente au détail grignote librement le stock gros pièce par pièce, les douzaines et certaines tailles finissent par manquer — même si le total en stock paraît suffisant. Le prototype actuel ne protège pas contre ça (testé en direct : une vente unitaire depuis le stock non réservé passe sans aucun blocage).

**Workflow de validation (maqueté et approuvé)** — quand une vente au détail dépasse la réserve détail disponible :
1. La vente est **bloquée**, une demande part vers Admin/Super Admin (table `demandes_validation_stock`, §4.8).
2. Une alerte se déclenche : bip répété **toutes les 30 secondes** (opt-in, désactivé par défaut), avec possibilité de **mise en pause** (1/5/15 min, reprise automatique à l'échéance) — l'admin doit pouvoir la silencer sans perdre la demande de vue.
3. L'admin choisit : **(a) Autoriser** — transfère automatiquement le manque du stock gros vers la réserve détail et complète la vente ; **(b) Recharger la réserve d'abord** — l'admin choisit combien de pièces transférer (minimum = le manque) avant validation ; **(c) Refuser**.
4. Tout passage est tracé au Journal d'audit.

Maquette de référence (Artifact, pour reprise lors du développement) : logique complète interactive testée avec l'utilisateur, structure ci-dessus = version finale approuvée.

**Implémenté et vérifié en base réelle (2026-07-28)** : le blocage (point 1) existait déjà depuis la Phase 1 (`validerAffaire`, `app/affaires/actions.ts`) ; l'écran de décision Admin/Super Admin (points 2-4) est construit à `/validations` (`app/validations/`) — Autoriser transfère exactement le manque du stock gros vers la réserve détail (FIFO par lot, comme le décrément), Recharger permet une quantité supérieure au manque, Refuser laisse l'affaire bloquée. Chaque décision est tracée dans `journal_audit`. Une fois toutes les demandes d'une affaire résolues (aucune ne reste `EN_ATTENTE`), l'affaire se finalise automatiquement (revalidation). Testé de bout en bout sur la base Neon réelle : Autoriser (transfert de 3 pièces) et Recharger (transfert de 1 pièce) produisent chacun un Ticket (`TIC-...`) correct. L'alerte sonore (bip 30s, pause 1/5/15 min) est un réglage local par appareil (opt-in, non persisté en base) — pas encore l'alerte serveur/push envisagée à terme.

---

## 10. Configurateur d'articles personnalisés

Deux chemins d'entrée, un même flux final en 5 points pour un article textile (polo/t-shirt).

**Chemin court** (modèle prêt) : galerie de designs prêts (photo + prix de départ) → Taille/qté → couleur/coupe → upload logo → aperçu généré → prix → validation → paiement → livraison. 9 écrans.

**Chemin long** (à la carte — **la pièce maîtresse du projet**) :
1. **Support** — couleur en points cliquables limités au stock/catalogue réel de l'article (photo produit swap en direct par couleur, points grisés "rupture" si indisponible) ; coupe H/F/Enfant ; encolure/manches affichées seulement pour t-shirt.
2. **Zones de marquage** — clic sur le vêtement pour ajouter/retirer une zone, technique par zone, upload logo par zone. **Détaillé et élargi au §10bis** (le moteur de coût par technique est partagé avec la vente interne, pas réinventé pour le configurateur seul).
3. **Finitions** — options cumulables, textile uniquement, surcharges fixes : broderie relief 3D +800F, patch tissé cousu +500F, étiquette perso +300F, emballage individuel +150F.
4. **Taille & quantité** — voir résolutions ci-dessous.
5. **Récapitulatif** — prix détaillé complet, "Valider" fige la config comme ligne d'affaire.

Chaque champ du point 1 (Support) a une bascule admin par article : demander au client, ou valeur fixe unique.

**Points laissés ouverts dans le document source, résolus le 2026-07-27 :**
1. **Le pool utilisé au point 4 (Taille/quantité) = réserve détail.** Une commande en ligne à la carte est une vente au détail — elle passe par le même workflow de blocage/validation §9 si la réserve est insuffisante.
2. **L'écran Taille/quantité est partagé** (un seul composant) entre chemin court et chemin long — pas deux implémentations séparées.
3. **Nouveau, pas encore designé** : le **seuil minimum** (§4.7) décidant qu'une commande compte comme "vente en gros" plutôt que "vente au détail" doit être **ajustable par l'admin**, pas codé en dur — l'utilisateur compte l'affiner "au fil des activités". Valeur exacte et granularité (par ligne de taille ou par commande entière) non encore précisées, à régler dans Paramètres au moment venu.

*(Note : `design/Canvas.dc.html` contient trois pistes UI antérieures pour ce configurateur — accordéon une page, onglets+cartes, tableau technique compact. Probablement supplantées par le flux en 5 points ci-dessus ; à vérifier si une de ces pistes doit influencer l'habillage visuel du point 1/2.)*

---

## 10bis. Marquage personnalisé et calculateurs de coût (R&D)

**Ajouté le 2026-07-28, conçu par 6 itérations de maquette Artifact avec l'utilisateur (validé "c'est bon"), pas encore codé.** Ce module naît d'un constat : les articles à prix variable (polo à la carte, sérigraphie/DTF/sublimation/broderie/flocage, tissu au mètre) ne doivent pas devenir chacun un cas spécial codé en dur dans Catalogue/Stock/Affaires. À la place, un module **R&D** définit des **calculateurs** — formules réutilisables qui calculent un prix de ligne à partir de paramètres — qu'un article du Catalogue *attache*. **Une vente configurée reste toujours une `ligne_affaire` calculée à la volée ; ce n'est jamais un nouvel article Catalogue.**

**Trois niveaux de complexité pour une ligne de vente (pas un seul) :**
1. **Cas A — ligne simple** : commande spéciale ponctuelle ne nécessitant pas de devis/proforma, juste un prix d'achat/fabrication → prix de vente. Pas de calculateur.
2. **Calculateur à formule** (ce module) — logique de prix réutilisable par catégorie de produit.
3. **Cas B — configurateur guidé complet** (polo à la carte, §10) — le plus complexe, déjà maqueté et flux ci-dessus.

**Écran principal : produit d'abord, pas la config technique.** Barre de sélection de vêtement (Polo, T-shirt, Maillot, Survêtement, Tissu, Casquette) → clic direct sur les zones du vêtement pour les marquer (réutilise le clic-zone du §10) → prix calculé en direct, le prix de base venant du Stock réel. La configuration des formules (bibliothèque d'encres/supports, main d'œuvre, marge, charges) est déportée derrière un **bouton discret, réservé Admin/Super Admin**, jamais l'écran principal — un premier jet qui mettait la config admin au centre a été rejeté par l'utilisateur comme incompréhensible.

**Options transverses :**
- **Ensemble complet** (haut+bas, tailles/couleurs indépendantes) : bascule disponible sur Polo/T-shirt/Maillot/Survêtement — **pas** sur Tissu.
- **Tissu** a son propre mode à la place : **"Zones spécifiques"** vs **"Toute la surface"** (pas de notion d'ensemble).
- **Zones prédéfinies** en boutons rapides (poitrine centre/gauche/droite, dos, manche courte/longue pour les vêtements ; avant/côté pour Casquette), en plus du clic libre n'importe où.

**Par zone, une technique — chacune avec son propre moteur de coût (ne pas fusionner, corrigé plusieurs fois en session) :**
- **Sérigraphie** — prix au nombre de couleurs/cadres (chaque couleur = un cadre physique = coût de mise en place).
- **DTF / Sublimation** (« sérigraphie numérique ») — prix à la zone (cm²) : coût d'encre **continu** (prix/cm² × surface réelle, aucun arrondi — l'encre est un liquide) + coût du support d'impression (papier ordinaire, papier spécial sublimation, film DTF…) qui lui **arrondit au support entier** selon **le format propre de ce support** (A4/A3/personnalisé en cm) — ce format est indépendant du format de référence de l'encre, car certains supports (ex. vinyle flocage) se vendent différemment (rouleau découpé sur mesure, pas en feuilles A4).
- **Flocage** — même famille de calcul cm² que DTF/sublimation, mais sans composant encre : uniquement coût du support/vinyle.
- **Broderie** — prix par **paliers de taille discrets** (Petit/Moyen/Grand), pas par surface continue — modèle volontairement différent, confirmé par l'expérience professionnelle de l'utilisateur (10+ ans, designer textile en usine au Mali).

**Toujours séparés, jamais fusionnés dans une même ligne :** main d'œuvre, charges additionnelles (liste ouverte, positionnée sous main d'œuvre, on peut ajouter des lignes), marge. Le prix dégressif par quantité reste un placeholder simple, volontairement non prioritaire (l'utilisateur : "c'est le côté des prix dégressifs qui me fatigue un peu").

**Bibliothèque de références** (encres, supports d'impression, matières, emballages) : section admin repliée par défaut, modifiée rarement (changement de prix fournisseur, nouvelle marque d'encre), avec plusieurs variantes nommées par catégorie (ex. « Encre sublimation Claude : 100ml/1000F = 1 A4 »). Les calculateurs **sélectionnent** une entrée plutôt que d'embarquer un prix en dur.

**Explicitement hors périmètre pour l'instant :** la **production industrielle de pagne** (sous-traitance usine, maquette/cadres, prix par balle/pièce de 12 yards, transport/douane) est **retirée** de ce module — l'utilisateur, fort de son expérience professionnelle directe dans une usine textile au Mali, a jugé que l'entreprise n'a pas encore toute la visibilité sur l'économie de ce segment et que le risque financier est trop élevé pour l'inclure maintenant ; elle sera configurée à part, plus tard, à sa demande explicite. Ne pas la refondre dans la bibliothèque de références sans qu'il ne rouvre le sujet.

**Statut : maquette Artifact validée, aucune implémentation réelle (schéma/écrans) encore commencée.** À planifier en Phase 2 ou 3 de `FEUILLE_DE_ROUTE.md` (nouveau module, absent de la feuille de route d'origine — ajouté après coup).

---

## 11. Suivi de commande client

Demandé et confirmé (2026-07-27) : une page publique **sans connexion**, liée à la Commande/Affaire, atteignable via le **QR code** déjà présent (mais jusque-là sans usage défini) sur chaque modèle de document (`design/Modele *.dc.html`). Le QR n'est pas réservé au suivi seul — il peut porter d'autres contenus/messages (portée exacte non précisée, à définir au moment du design du payload, cf. `qr_payload` en §4.9).

Affiche un simple statut d'avancement scopé à cette commande uniquement (ex. reçue → en préparation → en livraison/prête au retrait → livrée/retirée), aucun prix au-delà de ce que le client a déjà accepté, aucune autre donnée interne.

---

## 12. Paiement en ligne — Mobile Money, en V1

**Tranché le 2026-07-27 : dans la V1**, pas différé. Au Mali, ça signifie **Orange Money / Moov Money** — pas de carte bancaire type Stripe, ça ne correspond pas au marché.

**Ce qui avait été mal évalué au départ :** Claude avait présenté l'ouverture d'un compte marchand comme un préalable pouvant retarder le développement. Corrigé par l'utilisateur — au Mali, ouvrir un compte marchand Orange Money/Moov Money est rapide (moins de 24h) et ne demande aucune démarche particulière, ce n'est pas un facteur bloquant. Ça n'aurait d'ailleurs jamais dû bloquer le développement de toute façon : l'intégration (formulaire, réception de la confirmation, déblocage automatique de la commande) se construit avec des identifiants de test fournis dès l'inscription développeur, sans attendre l'approbation marchande. Le compte réel ne sert qu'à remplacer les clés de test par les clés live juste avant la mise en ligne.

**Choix technique retenu : un agrégateur** (PayDunya, CinetPay ou Kkiapay — tous actifs au Mali) plutôt qu'une intégration directe séparée avec chaque opérateur. Pas pour contourner une lenteur administrative (il n'y en a pas) mais pour éviter de maintenir deux intégrations différentes : Orange Money et Moov Money ont chacun leur propre API, l'agrégateur les unifie derrière une seule.

Prérequis réels avant la mise en production (pas avant le développement) : inscription développeur chez l'agrégateur choisi (clés de test immédiates), puis compte marchand réel + clés live avant le lancement public. Identifiants API à transmettre hors du dépôt (`.env` local, jamais en clair) une fois obtenus.

Table `PROFORMA` (§4.5) : les partenaires (Freelance, Commercial à distance, où qu'ils soient) remplissent un formulaire de proforma — fonctionnellement un Devis — qui part en validation Admin/Super Admin avant de pouvoir être envoyé au client. Même logique de file d'attente que §9.

**Implémenté et vérifié en base réelle (2026-07-28)** : module `/commercial` (rôles Freelance/Commercial/Resp. Commercial, module "Commercial") — formulaire simple (client par nom+contact, créé ou retrouvé automatiquement ; lignes réutilisant le composant d'Affaires) qui crée une `affaire` de type `PROFORMA`, statut `EN_ATTENTE`, numérotée `PRO-AA-NNNN`. File d'attente Admin/Super Admin intégrée à l'écran `/validations` existant (§9) plutôt qu'un troisième écran séparé — Valider passe le statut à `VALIDEE` ("prête à envoyer"), Refuser à `ANNULEE`, chaque décision tracée au journal d'audit. L'envoi effectif au client (document/partage) n'est pas encore construit — reste avec les 5 gabarits PDF restants (§13).

---

## 13. Documents imprimables et branding

Six modèles existants dans `design/` (A4 sauf Reçu en A5 paysage), tous avec logo, mentions légales, et un emplacement QR CODE jusqu'ici sans usage défini (voir §11) :

| Document | Format | Contenu spécifique |
|---|---|---|
| Bon de commande | A4 | Objet, fournisseur, tableau lignes, total, signatures |
| Bon de livraison | A4 | Objet, affaire liée, canal, qté commandée/livrée |
| Fiche de paie | A4 | Employé, base/montant par rubrique (salaire, prime transport, commission, retenue INPS, avance) |
| Ordre de mission | A4 | Rôles/noms/matricules, destination, dates, moyen de transport, frais avancés |
| Reçu de caisse | A5 paysage | Lignes numérotées article/qté/**PU**/total, mode de règlement, sous-total/remise/TVA/TTC, reliquat, **QR code** |
| Courrier | A4 | En-tête/pied de page, corps libre |

Mentions légales communes : Badalabougou, Rue 90, Porte 307 — RCCM MA.BKO.2022.A03394 — NINA 32209195100049N — NIF 085149443X — Banque Atlantique ML135 01016 072750680001 16 — Tél 0023 74 74 40 82 — evolutis223@gmail.com — Bamako/Mali.

**Cachet numérique** : voir §8.4 point 6 — généré et appliqué automatiquement au PDF à la validation, pas de tampon physique requis pour la validité du document.

**Reçu de caisse — premier modèle construit et validé (2026-07-28)** : `lib/documents/recu-caisse.tsx`, généré via `@react-pdf/renderer` (pur JS, voir §16 nouvelles notes techniques). QR code ajouté (`lib/documents/qr.ts`, lib `qrcode` pure JS) — payload provisoire `EVOLUTIS223-SUIVI:{numero}` en attendant la vraie page de suivi (§11) et un nom de domaine. Les 5 autres modèles suivront le même patron une fois le point ci-dessous tranché.

**Paramétrage des documents — exigence nouvelle, 2026-07-28, pas encore conçue.** L'utilisateur veut pouvoir **personnaliser, voire modifier en profondeur**, les documents générés — pas seulement remplir des valeurs dans un gabarit figé codé en dur. Deux niveaux possibles, à trancher avant de construire les 5 modèles restants (retravailler `recu-caisse.tsx` après coup pour l'un ou l'autre coûterait plus cher que de trancher maintenant) :
1. **Paramétrage par champs/sections (recommandé pour V1)** : un écran Paramètres par type de document permettant de basculer l'affichage de sections optionnelles, surcharger des blocs de texte (mentions légales, message de remerciement), changer logo/cachet, couleur d'accent, colonnes du tableau — mais la structure de mise en page reste celle codée. Techniquement : une table `parametres_documents` (type_document, config JSONB, modifie_par, date_modification — même esprit que `parametres_vente_gros` §4.7), lue par `lib/documents/` à la génération.
2. **Éditeur de gabarit profond** : l'admin peut réellement réorganiser les sections, ajouter/retirer des colonnes, redéfinir la mise en page elle-même — un mini constructeur de template. Bien plus lourd (schéma de mise en page structuré + UI de construction), risque réel de dépasser le budget de sessions du §14 si fait pour les 6 documents.
**Tranché 2026-07-28 : option 1 (paramétrage par champs/sections)** — cohérent avec le principe de paramétrage ci-dessus (§3.1) : décidé au cas par cas, pas un éditeur de gabarit universel. Table `parametres_documents` (type_document, config JSONB, modifie_par, date_modification) à construire au moment de généraliser aux 5 autres modèles.

---

## 14. Plan de développement

Build solo (l'utilisateur + Claude Code, pas d'équipe externe). Estimation en **sessions de travail**, pas en semaines-développeur classiques — écrire le code n'est pas le facteur limitant ; la clarification des règles métier et les tests réels (comme cette session) le sont.

| Phase | Contenu | Sessions estimées |
|---|---|---|
| 0 — Fondations | Schéma BDD à jour (§4), authentification téléphone+PIN, rôles & permissions (§6), structure PWA | 1–3 |
| 1 — Cœur métier | Catalogue & Stock (5 familles, §5), réserve détail/gros (§9), Affaires (§8.4), Clients, Commandes (§8.1), Trésorerie & Règlements (§8.2) | 5–10 |
| 2 — Workflows spécifiques | Validation vente au détail (§9), proformas partenaires (§12), Fonds en circulation Livreur interne/externe | 2–4 |
| 3 — Configurateur & vitrine | Chemin court/long (§10), synchro catalogue → vitrine publique, suivi de commande (§11), **décision paiement en ligne (§12) à prendre avant cette phase** | 3–6 |
| 4 — Modules périphériques | RH, Fournisseurs, Achats, Dépenses, Charges, Rapports, Marketing/R&D | 3–6, peuvent suivre le lancement |

**V1 lançable** (phases 0-3) : 14–25 sessions ≈ 2–3,5 semaines à 1 session/jour, 7–13 jours à 2/jour.
**Tout compris** (0-4) : 20–35 sessions ≈ 3–5 semaines à 1/jour, 10–18 jours à 2/jour.

---

## 15. Budget

| Poste | Coût | Notes |
|---|---|---|
| Développement | Abonnement Claude existant | Pas de salaire dev ni d'agence, quel que soit le nombre de sessions |
| Hébergement (§3.6) | ≈12 000 F/mois (Vercel Pro + Neon Free) | Démarre à la mise en production, pas pendant le développement |
| Nom de domaine | ≈10 000 F/an (≈830 F/mois amorti) | Peut être réservé tôt |
| SMS de vérification (PIN) | ≈2 000–5 000 F/mois | Estimé, fournisseur Mali (Orange/Moov) non encore vérifié — voir §16 |
| Email professionnel | 0 F pour démarrer (gmail existant) | Optionnel plus tard |
| **Total estimé — démarrage** | **≈15 000 F/mois** | Hors abonnement Claude |
| **Total estimé — croissance** | **≈32 000 F/mois** | Si hébergement niveau supérieur nécessaire |

---

## 16. Points ouverts / risques (à traiter avant ou pendant le développement, ne bloquent pas le démarrage)

1. **Sauvegardes / plan de reprise** pour les données de stock et de trésorerie — pas encore désigné, juste supposé "géré par le fournisseur de BDD managée".
2. **Sécurité de l'authentification** — hachage du PIN, blocage après tentatives échouées : pas encore spécifié.
3. **Migration de données existantes** — inconnu si des données papier ou d'un système antérieur doivent être reprises au lancement.
4. **Fournisseur SMS fiable au Mali** (Orange/Moov) pour le flux téléphone+PIN — coût estimé, pas vérifié auprès d'un vrai fournisseur (à ne pas surestimer non plus, même logique que le paiement mobile ci-dessus — probablement plus simple que prévu).
5. **Incohérence Marketing/Agent marketing** dans les rôles du prototype (§6) — à trancher.
6. ~~**Ligne "Réservé" dans Stocks**~~ — **RÉSOLU 2026-07-27 (v2)**, confirmé en relisant `design/Workflow Stock Vente Tresorerie.dc.html` en entier : c'est un affichage voulu, pas un bug — la colonne "Réservé" montre la quantité mise de côté pour la réserve détail, pour cette même taille/couleur. Pas de double comptage.
7. **Seuil de validation des Bons de décaissement** (§4.6, "validateur_id requis si montant > seuil") — le seuil lui-même n'est modélisé nulle part (pas de table équivalente à `parametres_vente_gros`, §4.7). À trancher : seuil unique global, ou par catégorie (Achat marchandise / Charge générale / RH-Salaire) ?
8. ~~**Répartition de la réserve au prorata des tailles**~~ — **RÉSOLU 2026-07-28**, tranché par Claude en construisant l'écran d'approvisionnement (Phase 1.2) : méthode du **plus grand reste** (largest remainder / Hare). Pour chaque taille : `part = floor(réserve_totale × produit_taille / produit_total)` ; le reliquat non distribué (`réserve_totale − Σ parts`) est attribué une unité à la fois aux tailles ayant le plus grand reste fractionnaire, jusqu'à épuisement. Méthode standard d'apportionnement, déterministe, jamais de reste négatif ni de dépassement de la réserve demandée.
9. **Unités de mesure au-delà de la pièce/douzaine — nouveau, signalé 2026-07-28, volontairement différé après Stock (1.2) pour les articles simples.** Le tissu et le pagne se vendent au **yard** (unité de base), conditionnés en **pièces** (12 yards pour la gamme EVOLUTIS223 — la norme du marché va plutôt de 3 à 6 yards/pièce selon les fournisseurs, confirmé par recherche) puis en **balles** (50 pièces = 600 yards). Ça ne rentre pas dans le modèle Famille A actuel, qui suppose des douzaines de vêtements en tailles/couleurs — il faudrait généraliser la notion de "conditionnement par palier" (aujourd'hui figée sur la douzaine) plutôt que créer un cas spécial pour le tissu. Séparément, mais lié : le pagne se facture aussi **selon le nombre de cadres/couleurs** — exactement comme la sérigraphie facture selon le nombre de couleurs et le type d'encre. Ce n'est pas un prix fixe par article mais un **calcul** — l'utilisateur avait déjà prévu un module **R&D/Calculateurs** (§7) réunissant plusieurs calculateurs de coût de production/fabrication ; c'est là que cette logique doit vivre, pas comme champ `prix_vente` simple sur `articles`. À concevoir (probablement maquette dédiée) avant de coder — chantier séparé, après le Stock des familles déjà couvertes.

---

*Fin du document. Sources : `design/Cahier des Charges Etape 1.dc.html`, `design/EVOLUTIS 223 - Spécifications Techniques et Schéma SQL de Référence.dc.html`, `design/Schema Global Application EVOLUTIS223.dc.html`, `design/Schema Configurateur Articles Personnalises.dc.html`, `design/Workflow Stock Vente Tresorerie.dc.html`, `design/Application de Gestion EVOLUTIS223.dc.html` (prototype exploré en direct), 6 modèles de documents, `design/Canvas.dc.html`, et l'intégralité de la session de cadrage du 2026-07-27.*
