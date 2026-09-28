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

## 3. Base de données

Compatible avec [Supabase](https://supabase.com), [Neon](https://neon.tech), ou toute
instance PostgreSQL classique. Créez une base, récupérez l'URL de connexion, et
mettez-la dans `DATABASE_URL`.

## 4. Installer et lancer le projet

```bash
npm install
npm run prisma:migrate   # crée les tables en base
npm run seed              # optionnel : données de démo (20 prospects, 3 campagnes)
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000), créez un compte via **/signup**,
puis connectez-vous.

## 5. Connecter et tester Gmail

1. Allez dans **Paramètres > Compte Gmail** et cliquez sur **Connecter Gmail**.
2. Autorisez les accès demandés (envoi + lecture pour détecter les réponses).
3. Créez un template dans **Templates**, puis cliquez sur **"M'envoyer un email test"**
   pour vérifier l'objet, le contenu, les variables et la mise en page — l'email
   test part uniquement vers votre propre adresse Gmail.

## 6. Tâches planifiées (cron)

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

## 7. Déployer sur Vercel

1. Importez le dépôt dans [vercel.com](https://vercel.com/new).
2. Renseignez les mêmes variables d'environnement que `.env` (avec l'URL de production
   pour `NEXTAUTH_URL` et `GOOGLE_REDIRECT_URI`).
3. Ajoutez cette URI de callback dans Google Cloud (voir étape 1).
4. Déployez. Les crons de `vercel.json` s'activent automatiquement (plan Pro requis
   pour une fréquence de quelques minutes ; sur le plan Hobby, les crons sont limités
   à une exécution par jour — adaptez les horaires en conséquence ou utilisez un
   service externe comme cron-job.org pour appeler ces routes plus fréquemment).

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
- File de validation "À valider" (individuelle, groupée, édition, report, refus).
- Templates avec variables, mode test.
- Séquences configurables, campagnes avec récapitulatif de lancement obligatoire.
- Planification des envois respectant limite quotidienne / plage horaire / jours / intervalle.
- Cron idempotents (verrouillage des lignes, statuts explicites) pour éviter les doubles envois.
- Dashboard, statistiques (uniquement des métriques mesurables via Gmail), pipeline drag & drop, blacklist, RGPD (opt-out, export, suppression).

## Limites connues à améliorer selon vos retours d'usage

- Le multi-jointure de threads Gmail utilise l'API `threads.get` par sondage (cron) plutôt que l'API History/push (webhooks Google Pub/Sub), plus économe mais plus complexe à mettre en place — une évolution possible si le volume augmente.
- Le "mode Automatique" envoie via le même job cron `send-emails` une fois les emails passés en statut `VALIDE`/`PROGRAMME` par la validation globale de campagne ; l'écran de validation globale par campagne peut être enrichi (aperçu email par email avant validation de masse en mode automatique).
- La gestion des pièces jointes n'est pas implémentée.
