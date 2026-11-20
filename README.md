# Work Planner

Application web de gestion des temps des salariés : badgeuse dématérialisée, compteurs d'heures, corrections, congés et absences, planning d'équipe.

- **Application** : https://work-planner-fdrw.onrender.com
- **Code** : https://github.com/JustinDuhez/work_planner

> L'hébergement Render gratuit se met en veille après 15 minutes sans visite : le premier chargement peut prendre jusqu'à une minute, les suivants sont immédiats.

## Fonctionnalités

| Écran          | Ce qu'on y fait                                                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pointage**   | Badger (début / fin, sur site ou télétravail), voir sa semaine jour par jour, ses compteurs (écart de la semaine et écart cumulé), les jours non débadgés. Voir la semaine de n'importe qui en lecture seule ; un manager corrige un jour passé de son périmètre. |
| **Calendrier** | Année complète (selon le « Début d'année » choisi par l'admin) avec les demi-journées d'absence, en pastel si en attente, en plein si validées, et un récapitulatif par type. Un manager déclare une absence pour une personne de son périmètre.                  |
| **Planning**   | Mois d'une équipe (ou de toutes) : absences de chacun, solde d'heures, « Absents aujourd'hui ». Les managers remettent des compteurs à zéro en lot.                                                                                                               |
| **Demandes**   | « Mes demandes » et, pour les managers / admins, « À valider » : congé, télétravail (règle des 3 jours sur site par semaine), maladie, récupération, formation / déplacement, départ anticipé, par demi-journée.                                                  |
| **Annuaire**   | Tout le monde, avec recherche et filtre d'équipe. Les admins créent, bloquent, archivent les comptes et réinitialisent un mot de passe ; managers et admins changent le temps de travail journalier à partir d'une date.                                          |
| **Équipes**    | Arbre des équipes et sous-équipes, responsable et membres ; les admins créent, modifient et suppriment.                                                                                                                                                           |
| **Paramètres** | (admin) Jours fériés par année, import des fériés français, début d'année.                                                                                                                                                                                        |
| **Profil**     | Nom, mot de passe, équipes et responsables.                                                                                                                                                                                                                       |

Notifications dans l'application (cloche) pour les corrections et les demandes, et un mode sombre dans le menu du compte.

## Accès de démo

Tous les comptes de démo partagent le mot de passe `DEMO_PASSWORD`. Comme l'un d'eux est administrateur, ce mot de passe **n'est pas publié ici** : il est transmis en privé.

| Compte                                                                       | Rôle                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| ines.garcia@example.com                                                      | Équipe RH, avec l'option **administrateur** : accès à tout |
| claire.martin@example.com                                                    | Manager, Direction (haut de la hiérarchie)                 |
| julien.bernard@example.com                                                   | Manager, Tech (dans Direction, au-dessus de Front et Back) |
| sophie.dubois@example.com / thomas.petit@example.com                         | Managers, Front / Back                                     |
| nicolas.michel@example.com / manon.roux@example.com                          | Managers, Commercial / RH                                  |
| lea.moreau@example.com, camille.simon@example.com, emma.lefebvre@example.com | Collaboratrices                                            |
| hugo.laurent@example.com                                                     | Collaborateur dans deux équipes (Front et Back)            |
| lucas.fournier@example.com                                                   | Compte bloqué                                              |
| chloe.girard@example.com                                                     | Compte archivé (ne peut pas se connecter, masqué partout)  |

Les données de démo sont datées par rapport au jour où le seed a tourné : trois semaines d'historique de pointage, un jour non débadgé (Léa), une correction en attente de réponse (Léa, cloche), une correction refusée qui met le solde de Camille en rouge, une remise à zéro (Hugo), un changement de temps de travail (Emma, 6:00 par jour depuis le lundi de la semaine du seed), des demandes validées, en attente, refusées et annulées.

## Démarrage local

Prérequis : Node.js 24 et PostgreSQL 17, avec un rôle `work_planner` propriétaire de deux bases :

```sql
CREATE ROLE work_planner LOGIN PASSWORD 'work_planner';
CREATE DATABASE work_planner OWNER work_planner;
CREATE DATABASE work_planner_test OWNER work_planner;
```

```bash
npm install
cp apps/api/.env.example apps/api/.env   # puis renseigner ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD
npm run migrate
npm run seed
npm run dev:api   # API sur http://127.0.0.1:3001
npm run dev:web   # application sur http://localhost:5173
```

| Commande            | Rôle                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run seed`      | Compte admin + entreprise de démo (idempotent, relançable)                        |
| `npm test`          | Tests Jest des trois paquets (les tests d'intégration vident `work_planner_test`) |
| `npm run lint`      | ESLint avec la configuration Willemse                                             |
| `npm run typecheck` | TypeScript dans chaque paquet                                                     |
| `npm run format`    | Prettier                                                                          |
| `npm run build`     | Build de production : `apps/api/dist` + `apps/web/dist`                           |

Le seed crée le compte admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) et l'entreprise de démo, et importe les jours fériés français de l'année précédente, de l'année en cours et de la suivante. Il ne modifie jamais une personne, une équipe ou un mot de passe existants ; le relancer une autre semaine ajoute l'historique et les demandes de cette semaine-là.

## Architecture

```
packages/domain   Règles métier pures et contrats zod, partagés par l'API et le front
apps/api          Fastify + Kysely + PostgreSQL : routes, services, dépôts, migrations SQL, seed
apps/web          React + Vite + TanStack Query + Tailwind CSS
```

Chaque requête suit le même chemin, chaque couche testable seule :

- **Route** : valide l'entrée avec le contrat zod et traduit le résultat en HTTP. Aucune règle métier.
- **Service** : un cas d'usage (`clockIn`, `reviewLeave`, `resetCounters`…). Demande l'autorisation au module `policy`, appelle le domaine et les dépôts, porte la transaction.
- **Dépôt** : requêtes Kysely uniquement, toujours paramétrées.
- **Domaine** (`packages/domain`) : fonctions pures sans I/O (découpage des jours et des semaines à Paris, temps badgeable, écarts, règle du télétravail, fériés français). Il ne connaît ni Fastify ni React.

Les droits passent tous par un seul module, `packages/domain/src/policy.ts` : un manager agit sur les membres de ses équipes et de toutes leurs sous-équipes (une CTE récursive), un admin sur tout le monde, chacun peut lire les données de chacun. Les erreurs métier sont des classes (`NotFoundError`, `ConflictError`…) traduites en `{ code, message }` par un seul gestionnaire d'erreurs, qui ne renvoie jamais de trace ni de SQL au client.

## Choix clés

| Choix                                       | Pourquoi                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kysely plutôt qu'un ORM, migrations en SQL  | SQL lisible et typé, toujours paramétré ; le schéma (clés étrangères, contraintes) se relit dans les migrations.                                                                                       |
| Compteurs calculés à la lecture             | Aucun total stocké : une correction, un férié ajouté ou une absence validée corrigent aussitôt les semaines passées. Les faits sont chargés en un nombre fixe de requêtes.                             |
| Heure du serveur, à la minute, fuseau Paris | L'horloge du client n'est jamais crue ; jours, semaines et changements d'heure sont calculés par des fonctions pures du domaine.                                                                       |
| Rien ne tourne à minuit                     | Une période non fermée la veille est lue comme « non débadgée » (0 minute) jusqu'à sa fermeture : pas de tâche planifiée qui pourrait échouer.                                                         |
| Historique du temps de travail journalier   | Chaque jour utilise le temps en vigueur ce jour-là : un changement ne réécrit jamais les écarts passés.                                                                                                |
| Corrections avec accord de la personne      | Un manager corrige une journée entière ; la personne voit avant / après et accepte ou refuse. Un refus met son solde en rouge.                                                                         |
| Absences par demi-journée                   | Une ligne `half_day` par demi-journée ouvrée, unique par personne et date : les chevauchements sont impossibles en base, pas seulement dans le code.                                                   |
| Validation par le ou les managers directs   | Plus les admins, jamais le demandeur ; sans approbateur possible, la demande est validée automatiquement et marquée comme telle. Un télétravail qui respecte la règle des 3 jours est validé d'office. |
| Authentification maison                     | argon2id, sessions en base (cookie httpOnly, SameSite=Lax, Secure en production), jeton CSRF, limites de tentatives : peu de code, entièrement relu et testé.                                          |
| Pas de bibliothèque de composants           | Tailwind CSS et éléments natifs (`<dialog>`, `popover`) : accessibles, sans dépendance, compatibles avec une CSP stricte.                                                                              |
| Couleurs en OKLCH, bordures en alpha        | Une seule couleur d'accent et des contrastes vérifiés ; le mode sombre redéfinit les mêmes variables sans toucher les pages.                                                                           |

## Tests

`npm test` lance 1 467 tests Jest :

- **Domaine** (411) : fonctions pures (changement d'heure, minuit, temps badgeable, règle des 3 jours, remises à zéro) et une table exhaustive des droits (rôle × relation × action).
- **API** (588) : routes et services contre une vraie base PostgreSQL (`work_planner_test`, vidée à chaque suite) : droits, SQL, transactions et codes HTTP ensemble.
- **Web** (468) : écrans rendus avec Testing Library, interactions au clavier, et un contrôle d'accessibilité (jest-axe) sur les états chargé, vide et en erreur.

La CI GitHub (`.github/workflows`) exécute à chaque pull request et à chaque push sur `main` : `npm audit` (dépendances livrées), Prettier, ESLint, TypeScript, les tests et le build ; Render ne déploie `main` que si elle passe.

## Sécurité

- Mots de passe argon2id (12 à 128 caractères), changement avec l'ancien mot de passe, premier mot de passe à changer à la première connexion.
- Sessions côté serveur, supprimées à la déconnexion, au blocage et à l'archivage ; expiration après 8 h d'inactivité ou 7 jours.
- Limites de tentatives de connexion par IP réelle (en-tête `cf-connecting-ip` derrière Cloudflare) et par couple IP + e-mail ; un identifiant ou un mot de passe faux donne le même message, que l'e-mail existe ou non.
- En-têtes de sécurité (helmet) avec une CSP stricte (`style-src 'self'`, aucun script en ligne), réponses d'API non mises en cache.
- Revue OWASP Top 10 (2025) faite avant la livraison ; chaque point trouvé a été corrigé avec un test.

## Limites acceptées

- **Transparence** : chacun peut voir la semaine, les compteurs et le calendrier de chacun, y compris les jours de maladie et un solde en rouge. C'est la règle de lecture du cahier des charges ; restreindre la maladie aux managers serait le prochain changement.
- **Notifications** dans l'application seulement (cloche actualisée toutes les 30 s), pas d'e-mail ; pas de mot de passe oublié par e-mail : un admin réinitialise le mot de passe.
- **Profil** : le temps de travail journalier n'y est pas affiché, car l'API renvoie la valeur planifiée et non celle en vigueur aujourd'hui (l'Annuaire et le Pointage utilisent la bonne).
- **Mode sombre** mémorisé par navigateur, pas sur le compte.
- **Hébergement gratuit** : mise en veille après 15 minutes (premier chargement lent).

## Déploiement

Render (Docker, offre gratuite, Francfort) + Neon (PostgreSQL, `eu-central-1`). Render déploie `main` une fois la CI GitHub passée ; le conteneur applique les migrations avant de démarrer le serveur. `render.yaml` déclare le service et ses variables : `NODE_ENV`, `HOST`, `APP_TIMEZONE`, `LOG_LEVEL`, `TRUSTED_PROXY_HOP_COUNT=1`, `CLIENT_IP_HEADER=cf-connecting-ip`, et deux secrets à saisir dans Render :

- `DATABASE_URL` : chaîne **poolée** de Neon (hôte `-pooler`), utilisée par l'application.
- `DATABASE_URL_UNPOOLED` : chaîne **directe**, utilisée par les migrations (le mode transaction de PgBouncer ne gère pas les opérations de session).

Le projet Neon est lié avec `neon init` (`neon.ts` déclare les services ; `.neon` et le `.env.local` récupéré restent locaux). Pour alimenter la base de production, depuis sa machine, avec les trois variables du seed renseignées (jamais une valeur `change-this-…`) ; quand `DATABASE_URL` vient du shell, `apps/api/.env` n'est pas lu :

```bash
cd apps/api
set -a && . ../../.env.local && set +a   # DATABASE_URL / DATABASE_URL_UNPOOLED de Neon
ADMIN_EMAIL=... ADMIN_PASSWORD=... DEMO_PASSWORD=... npx tsx src/seed.ts
```
