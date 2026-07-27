# Briefing de transition — Projet EVOLUTIS223

À coller en premier message dans la nouvelle conversation (nouveau dossier, ex. `evolutis223`).

## Ce que le zip contient

Export Claude Design (`Gestion d'Evolutis 223 (2).zip`) :
- **Cahier des Charges Étape 1** — lexique métier, architecture générale, 4 processus fondateurs (Commandes/Production, Trésorerie/Espèces, Stock des Kits, Documents/Archivage).
- **Schéma Global de l'application** — carte complète cible : 5 familles d'approvisionnement, moteur de vente unifié, modules périphériques, droits d'accès, journal d'audit, trésorerie, rapport (5 fréquences).
- **Spécifications Techniques et Schéma SQL de Référence** — schéma PostgreSQL complet (tables + FK) et algorithme de validation du stock des Kits, marqué "figé".
- **Schéma Configurateur Articles Personnalisés** — parcours client à deux chemins (modèle prêt vs configuration à la carte) pour polo/t-shirt : support → zones de marquage → finitions → taille/quantité → récapitulatif.
- **Workflow Stock Vente Trésorerie**, **Application de Gestion EVOLUTIS223.dc.html** (~1 Mo, prototype interactif complet), 6 modèles de documents (Bon Commande, Bon Livraison, Fiche Paie, Ordre Mission, Reçu Caisse, Courrier), captures d'écran.
- Non encore lus en détail : Workflow Stock Vente Trésorerie, les modèles de documents, le prototype 1 Mo lui-même — à revoir en premier dans la nouvelle conversation.

## Ce qui est déjà solide (à ne pas casser)

- Lexique métier précis et cohérent (Affaire, Solde, PMP, Réserve personnalisation, Fonds en circulation...).
- Schéma SQL propre : stock en registre append-only (`stock_mouvements`, jamais un simple compteur modifiable), immuabilité des factures/tickets (correction uniquement par Avoir), journal d'audit append-only.
- Algorithme de validation des Kits déjà codé et cohérent avec la règle métier (contrôle variante par variante, jamais agrégé).
- Le configurateur articles personnalisés correspond exactement à ce que tu as décrit (parcours guidé, choix visuel de couleur avec vraie photo produit, prix calculé en direct).

## Points à trancher ou clarifier (repérés en lisant, pas encore résolus dans les docs)

1. **Authentification** : le SQL prévoit `email` unique par utilisateur. GESTE223 utilise téléphone + PIN. À choisir consciemment, pas par défaut.
2. **Articles sans variante (Famille B)** : le stock est toujours rattaché à une `variante_id` — un article simple (mug, stylo) aura donc besoin d'une "variante par défaut" (taille/couleur nulles). Implicite dans le schéma, jamais écrit noir sur blanc.
3. **Pas de `boutique_id` nulle part** : ce schéma est pensé pour UNE seule entreprise (la tienne), pas multi-tenant comme GESTE223. À confirmer que c'est bien voulu ainsi.
4. **Rôle Livreur** : présent dans l'enum SQL des rôles, absent du tableau "Droits d'accès" du Schéma Global — à compléter.
5. **Configurateur — 2 points explicitement laissés ouverts dans le document lui-même** : gestion des douzaines à l'étape Taille/Quantité (vente à l'unité ou par douzaine dans ce parcours ?), et si l'écran Taille/Quantité doit vraiment être identique entre le chemin court et le chemin long.

## Recommandation d'architecture (déjà validée avec toi dans l'autre conversation)

- **Desktop d'abord**, mobile ensuite en version allégée (l'essentiel pour ne pas être bloqué en déplacement, pas la parité complète comme GESTE223 aujourd'hui — leçon tirée des problèmes de responsive de GESTE223).
- Natif : option à évaluer plus tard, pas un objectif immédiat.
- Vitrine publique : commencer simple (page boutique en ligne) plutôt qu'un site complet dès le départ ; le configurateur à la carte peut s'y brancher pour les devis à distance.

## Configuration à faire (nouvelle conversation)

- **Connecter le dossier à GitHub** (compte `evolutis223-a11y`, même compte que GESTE223) :
  - `git init`, `git remote add origin https://github.com/evolutis223-a11y/evolutis223.git` (créer le repo GitHub d'abord, vide).
  - L'authentification Windows (Git Credential Manager) est déjà configurée sur cette machine pour ce compte — pas besoin de ressaisir d'identifiants normalement.
- **Jamais de mot de passe/clé/token écrit en clair** dans un fichier du dépôt ou dans ce briefing — ni par moi, ni à la demande de l'utilisateur. Un `.env` local (jamais commité, `.gitignore`) suffit le jour où une vraie base de données sera branchée — à ce moment-là, demander les valeurs directement, ne jamais les stocker ici.

## Comment je travaille avec toi

- Réponses **courtes** dans le chat — le détail va dans des fichiers ou artefacts, pas dans de longs messages.
- Tu dictes souvent (vocal → texte) : attends-toi à des mots déformés ("consonne" = console, etc.) — je les interprète par contexte, je demande si ambigu.
- Avant de coder une fonctionnalité conséquente, je montre d'abord une **maquette Artifact interactive** pour validation, plutôt que de décrire en texte.
- Je ne me contente pas de suivre le cahier des charges à la lettre : je signale les incohérences et propose des alternatives si je vois plus solide.
- Sur cette machine, `git push` échoue de mon côté (conflit `libcurl-4.dll`, probablement une politique de contrôle d'application Windows) — je committe localement et te donne la commande à lancer toi-même.
- Le terminal Bash est cassé dans cet environnement (exit code 2 systématique) — j'utilise PowerShell pour tout.
