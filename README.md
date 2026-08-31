# YSA Application

Plateforme communautaire et organisationnelle pour la gestion d'équipes et de projets — fil d'actualité, annuaire, agenda, tâches et messagerie réunis en une seule application.

Déployé sur [youthstation.vercel.app](https://youthstation.vercel.app)

---

## Fonctionnalités

- **Fil d'actualité (Feed)** : publications, stories (24h), likes et commentaires
- **Annuaire** : répertoire des membres avec poste, téléphone, email et photo
- **Agenda** : calendrier partagé des événements
- **Tâches** : suivi et gestion des missions de l'équipe
- **Messages** : messagerie interne entre membres
- **Paramètres** : personnalisation du profil et préférences
- **Authentification** : connexion sécurisée via Supabase Auth
- **Multilingue** : interface en Français et Turc

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| Backend / Auth | Supabase |
| Base de données | PostgreSQL (Supabase) |
| Déploiement | Vercel |
| Prototypage UI | v0 by Vercel |

---

## Architecture

```
ysa-application/
├── app/
│   ├── page.tsx           # Redirection auth → /feed ou /auth/login
│   ├── (app)/
│   │   ├── feed/          # Fil d'actualité avec posts et stories
│   │   ├── annuaire/      # Répertoire organisationnel des membres
│   │   ├── agenda/        # Calendrier et événements
│   │   ├── gorevler/      # Gestion des tâches
│   │   ├── messages/      # Messagerie interne
│   │   └── ayarlar/       # Paramètres utilisateur
│   ├── auth/              # Pages de connexion / inscription
│   └── api/               # Routes API Next.js
├── components/            # Composants React réutilisables
├── lib/
│   └── supabase/          # Client Supabase (server + browser)
├── supabase/
│   └── migrations/        # Migrations de base de données
└── types/                 # Types TypeScript partagés
```

### Données clés

- **Profils** : informations membres (nom, poste, station, téléphone, photo)
- **Posts** : publications avec compteurs de likes et commentaires
- **Stories** : contenu éphémère filtré sur une fenêtre de 24 heures
- **Tâches** : assignées aux membres de l'équipe

---

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/onur-arn/ysa-application.git
cd ysa-application

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Renseigner : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Appliquer les migrations Supabase
npx supabase db push

# Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service Supabase (serveur uniquement) |
| `TURN_URLS` | URLs TURN séparées par des virgules (ex. `turn:host:443,turns:host:443`) |
| `TURN_USERNAME` | Identifiant TURN (fourni par ton hébergeur TURN) |
| `TURN_CREDENTIAL` | Mot de passe / credential TURN |
| `METERED_APP_NAME` | Sous-domaine Metered (ex. si ton domaine est `monapp.metered.live` → `monapp`) |
| `METERED_SECRET_KEY` | Secret Key (Dashboard → **Developers** — ne jamais exposer côté client) |
| `METERED_DOMAIN` | Optionnel : domaine complet (`monapp.metered.live`) à la place de `METERED_APP_NAME` |
| `GIPHY_API_KEY` | Clé API Giphy pour la recherche GIF ([developers.giphy.com](https://developers.giphy.com/dashboard/)) |

### Appels audio/vidéo (WebRTC)

1. Tables `call_sessions` + `call_signals` dans Supabase (voir `supabase/schema.sql`)
2. Realtime activé sur ces deux tables
3. **TURN** — une des deux options :
   - **Option A (simple)** : `TURN_URLS` + `TURN_USERNAME` + `TURN_CREDENTIAL`
   - **Option B (Metered, recommandé)** : `METERED_APP_NAME` + `METERED_SECRET_KEY` — l’app crée les credentials automatiquement via l’API (pas besoin du dashboard TURN)

**Metered — où trouver les clés :**
1. [dashboard.metered.ca](https://dashboard.metered.ca) → **Developers**
2. Copie **Metered Domain** (ex. `youthstation.metered.live`) → `METERED_APP_NAME=youthstation`
3. Copie **Secret Key** → `METERED_SECRET_KEY=...` (sur Vercel uniquement, jamais dans le code)

---

## Flux utilisateur

1. L'utilisateur se connecte via `/auth/login`
2. Redirection automatique vers le fil d'actualité `/feed`
3. Navigation entre les sections : annuaire, agenda, tâches, messages
4. Stories disponibles pendant 24h, posts permanents avec interactions
