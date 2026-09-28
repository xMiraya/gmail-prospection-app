# Outil interne de prospection commerciale par email

Application Next.js connectée à Gmail pour centraliser les prospects, préparer des
emails de prospection personnalisés, programmer des relances, et **valider
manuellement chaque envoi avant qu'il ne parte** (aucun envoi automatique par défaut).

## Principe central : l'automatisation prépare, vous décidez

- L'application prépare des brouillons d'emails (email initial + relances) à partir de vos templates et des données de vos prospects.
- Chaque brouillon atterrit dans la page **"À valider"**.
- **Rien ne part tant que vous n'avez pas cliqué sur "Valider et envoyer" (ou "Valider et programmer")**, sauf si vous avez explicitement activé le mode Automatique dans Paramètres > Automatisation.
- Dès qu'un prospect répond, toutes ses relances en attente sont annulées automatiquement.

## Stack technique

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL ·
NextAuth (compte de l'outil) · OAuth 2.0 Google + API Gmail officielle (envoi/lecture)
· Vercel Cron pour les tâches planifiées.

## 1. Créer le projet Google Cloud et activer l'API Gmail

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com/) et créez un nouveau projet.
2. Dans **APIs & Services > Library**, recherchez **Gmail API** et cliquez sur **Enable**.
3. Dans **APIs & Services > OAuth consent screen** :
   - Type d'utilisateur : *External* (ou *Internal* si vous avez un Google Workspace).
   - Renseignez le nom de l'app, l'email de support, et ajoutez votre propre adresse Gmail comme utilisateur test tant que l'app n'est pas validée par Google.
4. Dans **APIs & Services > Credentials**, cliquez sur **Create Credentials > OAuth client ID** :
   - Type d'application : **Web application**.
   - **Authorized redirect URIs**, ajoutez :
     - `http://localhost:3000/api/gmail/callback` (développement)
     - `https://VOTRE-DOMAINE-VERCEL.vercel.app/api/gmail/callback` (production)
5. Notez le **Client ID** et le **Client Secret** générés.

## 2. Configurer les variables d'environnement

Copiez `.env.example` vers `.env` et remplissez :

```bash
cp .env.example .env
```

- `DATABASE_URL` : votre base PostgreSQL (voir §3).
- `NEXTAUTH_SECRET` : générez avec `openssl rand -base64 32`.
- `NEXTAUTH_URL` : `http://localhost:3000` en local.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` : depuis l'étape 1.
- `GOOGLE_REDIRECT_URI` : doit correspondre exactement à une URI autorisée dans Google Cloud.
- `CRON_SECRET` : générez avec `openssl rand -base64 32` (protège les routes `/api/cron/*`).

## 3. Base de données — tester sans Supabase ni Neon

Vous n'avez besoin d'aucun compte cloud pour tester l'application. Deux options locales :

**Option A — Docker (recommandé) :**

```bash
docker compose up -d
# DATABASE_URL="postgresql://prospection:prospection@localhost:5432/prospection"
```

**Option B — PostgreSQL déjà installé sur la machine :**

```bash
sudo pg_ctlcluster 16 main start   # ou : brew services start postgresql (macOS)
createdb prospection
# DATABASE_URL="postgresql://VOTRE_USER@localhost:5432/prospection"
```

Une fois prêt (dans les deux cas), passez à l'étape 4. Quand vous serez prêt pour la
production, remplacez simplement `DATABASE_URL` par une URL
[Supabase](https://supabase.com) ou [Neon](https://neon.tech) — rien d'autre ne change.

## 4. Installer et lancer le projet

```bash
npm install
npm run prisma:migrate   # crée les tables en base (crée aussi la migration si absente)
npm run seed              # optionnel : données de démo (20 prospects, 3 campagnes)
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000), créez un compte via **/signup**,
puis connectez-vous.

## 5. Mode sandbox — tester sans jamais risquer d'envoyer un email à un vrai prospect

**Tant que vous n'êtes pas en production, laissez `EMAIL_SANDBOX_MODE="true"`** dans votre
`.env` (c'est la valeur par défaut de `.env.example`) et renseignez `SANDBOX_EMAIL` avec
une adresse à vous.

Effet concret :
- Un bandeau orange **"MODE SANDBOX"** s'affiche en haut de toute l'application.
- Quel que soit le prospect visé, **tout envoi Gmail réel est redirigé vers `SANDBOX_EMAIL`**
  (le sujet est préfixé `[SANDBOX → destiné à ...]` et le corps reçoit un bandeau rappelant
  le vrai destinataire prévu).
- L'interface (page "À valider", fiches prospects, etc.) continue d'afficher le **vrai**
  destinataire prévu — seul l'envoi réel est redirigé, pas ce que vous voyez à l'écran.
- Vous pouvez donc importer de vrais prospects, lancer de vraies campagnes, laisser
  tourner les crons de relance, et rien ne partira jamais vers une adresse externe.

Ne passez `EMAIL_SANDBOX_MODE="false"` que lorsque vous êtes prêt à envoyer de vrais
emails de prospection (voir la checklist avant production en fin de README).

## 6. Connecter et tester Gmail

1. Allez dans **Paramètres > Compte Gmail** et cliquez sur **Connecter Gmail**.
2. Autorisez les accès demandés (envoi + lecture pour détecter les réponses).
3. Créez un template dans **Templates**, puis cliquez sur **"M'envoyer un email test"**
   pour vérifier l'objet, le contenu, les variables et la mise en page — l'email
   test part uniquement vers votre propre adresse Gmail (indépendamment du mode sandbox).

## 7. Tâches planifiées (cron)

Trois routes protégées par `CRON_SECRET` (en-tête `Authorization: Bearer <CRON_SECRET>`) :

- `GET /api/cron/sync-gmail` — détecte les nouvelles réponses (toutes les 5 min recommandé).
- `GET /api/cron/send-emails` — envoie les emails déjà validés dont le créneau est échu (toutes les 3 min).
- `GET /api/cron/prepare-followups` — prépare les relances arrivées à échéance, dans "À valider" (toutes les heures).

Sur Vercel, `vercel.json` définit déjà ces plannings via **Vercel Cron Jobs**, qui
envoie automatiquement l'en-tête d'autorisation avec `CRON_SECRET`. En local, vous
pouvez les tester avec :

```bash
curl -H "Authorization: Bearer VOTRE_CRON_SECRET" http://localhost:3000/api/cron/send-emails
```

## 8. Déployer sur Vercel

1. Importez le dépôt dans [vercel.com](https://vercel.com/new).
2. Renseignez les mêmes variables d'environnement que `.env` (avec l'URL de production
   pour `NEXTAUTH_URL` et `GOOGLE_REDIRECT_URI`).
3. Ajoutez cette URI de callback dans Google Cloud (voir étape 1).
4. Déployez. Les crons de `vercel.json` s'activent automatiquement (plan Pro requis
   pour une fréquence de quelques minutes ; sur le plan Hobby, les crons sont limités
   à une exécution par jour — adaptez les horaires en conséquence ou utilisez un
   service externe comme cron-job.org pour appeler ces routes plus fréquemment).

## 9. Tester le scénario complet (bout en bout)

Un test d'intégration rejoue exactement ce scénario contre une vraie base PostgreSQL,
en mockant l'API Gmail (aucun réseau, aucun compte Google requis) :

prospect créé → template → brouillon généré → placé dans "À valider" → modifié
manuellement → validé → programmé → envoyé par le job d'envoi → passage en `ENVOYE`
→ relance préparée → réponse Gmail simulée → détection → annulation automatique de
la relance → prospect passé en `A_REPONDU`. Il vérifie aussi qu'exécuter le job
d'envoi deux fois de suite n'envoie jamais un email en double (idempotence).

```bash
# 1. Avoir une base de test qui tourne (voir §3 ci-dessus)
export DATABASE_URL="postgresql://prospection:prospection@localhost:5432/prospection"
npx prisma migrate deploy   # ou migrate dev si la base est vide

# 2. Lancer le test de bout en bout
npm run test:integration
```

Les tests unitaires (règles de validation, calcul des créneaux, personnalisation des
variables — aucune base de données requise) se lancent avec :

```bash
npm run test
```

## Scopes Gmail utilisés et pourquoi

L'application demande le strict minimum nécessaire, jamais un accès complet à la boîte :

| Scope | Pourquoi |
|---|---|
| `gmail.send` | Envoyer les emails de prospection et les relances depuis votre adresse. |
| `gmail.readonly` | Lire les threads existants pour détecter si un prospect a répondu (aucune suppression, aucune modification de vos emails). |
| `userinfo.email` | Afficher l'adresse Gmail connectée dans Paramètres > Compte Gmail. |

L'application ne demande jamais `gmail.modify` ni `mail.google.com` (accès complet),
qui permettraient de supprimer ou modifier des emails hors de son périmètre.

## Sécurité

- Le mot de passe Gmail n'est jamais demandé : uniquement OAuth 2.0 + API officielle.
- Les tokens Gmail (access + refresh) sont stockés côté serveur (base de données),
  jamais exposés au navigateur.
- Toutes les mutations passent par des Server Actions Next.js authentifiées
  (vérification systématique de la session et de la propriété des données).
- Validation des entrées via Zod sur les routes API sensibles (inscription, cron).

## Ce qui est réellement fonctionnel dans cette version

- Authentification, CRUD prospects, import CSV avec aperçu/mapping/déduplication.
- OAuth Gmail complet (connexion, refresh automatique, déconnexion, reconnexion).
- Envoi réel d'emails via l'API Gmail, avec threading correct pour les relances.
- Détection réelle des réponses via l'API Gmail (par thread), annulation automatique des relances.
- File de validation "À valider" (individuelle, groupée avec récapitulatif bloquant, édition,
  aperçu Gmail, report, refus, raccourcis clavier).
- **Porte de sécurité unique** (`src/lib/queue/guards.ts`) revérifiée juste avant CHAQUE
  envoi réel (validation individuelle, groupée, ou job cron) : statut validé, variables
  résolues, prospect non répondant / non blacklisté / non opt-out.
- Mode sandbox (`EMAIL_SANDBOX_MODE`) : redirige tout envoi réel vers une adresse de test.
- Templates avec variables, mode test.
- Séquences configurables, campagnes avec récapitulatif de lancement obligatoire.
- Planification des envois respectant limite quotidienne / plage horaire / jours / intervalle.
- Cron idempotents (verrouillage des lignes, statuts explicites) pour éviter les doubles envois — couvert par un test d'intégration.
- Journal d'activité détaillé (`EMAIL_PREPARED`, `EMAIL_EDITED`, `EMAIL_APPROVED`, `EMAIL_SENT`,
  `EMAIL_FAILED`, `REPLY_DETECTED`, `FOLLOWUPS_CANCELLED`, etc.) pour tracer pourquoi chaque email est parti.
- Dashboard, statistiques (uniquement des métriques mesurables via Gmail), pipeline drag & drop, blacklist, RGPD (opt-out, export, suppression).
- 21 tests unitaires + 1 test d'intégration bout-en-bout (voir §9).

## Ce qui reste volontairement simple ou n'est pas encore fait

Pour rester honnête sur l'état actuel plutôt que de survendre :

- **Interface** : fonctionnelle et cohérente, mais pas encore reconstruite avec shadcn/ui —
  les composants Tailwind sont faits main. Le rendu est sobre plutôt que "premium" au sens
  design (inspirations Linear/Attio/Notion demandées, pas encore atteintes visuellement).
- La page "À valider" a un mode liste (implicite, une carte à la fois avec navigation) et
  un aperçu Gmail simulé, mais pas encore la disposition en 3 colonnes (infos prospect à
  gauche / éditeur au centre / infos campagne à droite) demandée.
- Pas d'onboarding pas-à-pas en 10 étapes à la première ouverture — le README fait office
  de guide de démarrage.
- Tous les modes d'automatisation (`Manuel`, `Semi-automatique`, `Automatique`) exigent
  aujourd'hui la même validation humaine explicite avant tout envoi — c'est un choix de
  sécurité assumé : le mode `AUTOMATIQUE` n'auto-approuve pas encore après une validation
  de campagne globale, pour ne jamais risquer un envoi non désiré tant que ce chemin n'a
  pas été testé aussi rigoureusement que le reste.
- Détection des réponses par sondage (cron `threads.get`) plutôt que par webhooks Gmail
  Pub/Sub — plus simple à opérer, un peu moins réactif (quelques minutes de latence).
- Pas de gestion des pièces jointes.

## Checklist avant de passer en production (vrai Gmail + vraie base)

Ne cochez cette liste qu'une fois la phase de test en sandbox terminée à votre satisfaction :

- [ ] Base PostgreSQL de production configurée (Supabase, Neon, ou autre)
- [ ] Migrations exécutées (`npm run prisma:deploy`)
- [ ] Gmail OAuth configuré avec les identifiants et URIs de production
- [ ] Testé en mode sandbox (`EMAIL_SANDBOX_MODE="true"`) avec des données réalistes
- [ ] Email de test reçu via "M'envoyer un email test"
- [ ] Scénario complet rejoué avec `npm run test:integration`
- [ ] Cron sécurisé : `CRON_SECRET` défini et différent de la valeur d'exemple
- [ ] URLs OAuth de production ajoutées dans Google Cloud Console
- [ ] Variables d'environnement de production configurées sur Vercel
- [ ] `npm run test` et `npm run build` passent sans erreur
- [ ] Aucun secret versionné dans Git (`git log -p -- .env` ne doit rien montrer)
- [ ] `.env` bien listé dans `.gitignore`
- [ ] Validation humaine testée manuellement : un email `A_VALIDER` non validé ne part jamais, même après plusieurs exécutions du cron
- [ ] `EMAIL_SANDBOX_MODE` repassé à `"false"` seulement à ce stade, en connaissance de cause
