# ImmoElite - Plateforme Immobili\u00e8re Compl\u00e8te

## Structure du projet

```
immobilier-full/
\u251c\u2500\u2500 package.json          # D\u00e9pendances Node.js
\u251c\u2500\u2500 server/              # Backend
\u2502   \u251c\u2500\u2500 server.js        # Serveur Express principal
\u2502   \u251c\u2500\u2500 db.js           # Base de donn\u00e9es SQLite
\u2502   \u251c\u2500\u2500 auth.js          # Authentification
\u2502   \u251c\u2500\u2500 properties.js    # Gestion des annonces
\u2502   \u251c\u2500\u2500 payments.js      # Gestion des paiements
\u2502   \u2514\u2500\u2500 estimation.js    # Calcul d'estimation
\u2514\u2500\u2500 public/              # Frontend
    \u251c\u2500\u2500 index.html        # Site principal
    \u251c\u2500\u2500 dashboard.html   # Espace utilisateur
    \u251c\u2500\u2500 admin.html       # Panneau d'administration
    \u251c\u2500\u2500 styles.css       # Styles
    \u251c\u2500\u2500 script.js        # JS principal
    \u251c\u2500\u2500 dashboard.js     # JS espace utilisateur
    \u251c\u2500\u2500 admin.js        # JS administration
    \u2514\u2500\u2500 uploads/         # Photos des annonces
```

## Installation

### Pr\u00e9requis
- Node.js 18+ install\u00e9
- npm install\u00e9 avec Node.js

### \u00c9tapes

```bash
# 1. Aller dans le dossier
cd immobilier-full

# 2. Installer les d\u00e9pendances
npm install

# 3. Lancer le serveur
npm start

# 4. Ouvrir dans le navigateur
# http://localhost:3000
```

## Compte Admin par d\u00e9faut

- **Email** : admin@immoelite.dz
- **Mot de passe** : admin123

\u26a0\ufe0f **Changez ce mot de passe imm\u00e9diatement apr\u00e8s la premi\u00e8re connexion !**

## Fonctionnalit\u00e9s

### Site public (index.html)
- Recherche d'annonces par type, wilaya, cat\u00e9gorie
- Affichage des commissions sur chaque carte
- Simulateur d'estimation
- Formulaire de contact
- Inscription / Connexion

### Espace utilisateur (dashboard.html)
- Publier une annonce (formulaire + upload photos + paiement BaridiMob)
- Voir ses annonces et leur statut
- Voir l'historique de ses paiements
- Modifier son profil et son RIP BaridiMob

### Panneau Admin (admin.html)
- Statistiques g\u00e9n\u00e9rales (revenus, annonces, utilisateurs)
- G\u00e9rer les annonces (activer, supprimer)
- Confirmer/Rejeter les paiements
- Voir les messages de contact
- Modifier les param\u00e8tres (commissions, RIP, WhatsApp)

### API REST
| M\u00e9thode | Route | Description |
|---------|-------|-------------|
| POST | /api/register | Inscription |
| POST | /api/login | Connexion |
| GET | /api/profile | Profil utilisateur |
| PUT | /api/profile | Modifier profil |
| GET | /api/properties | Liste annonces |
| GET | /api/properties/:id | D\u00e9tail annonce |
| POST | /api/properties | Cr\u00e9er annonce (auth) |
| PUT | /api/properties/:id | Modifier annonce |
| DELETE | /api/properties/:id | Supprimer annonce |
| POST | /api/estimation | Calcul estimation |
| POST | /api/contact | Envoyer message |
| GET | /api/payments/my | Mes paiements |
| GET | /api/payments | Tous paiements (admin) |
| POST | /api/payments/:id/confirm | Confirmer paiement (admin) |
| GET | /api/stats | Statistiques (admin) |
| GET | /api/settings | Param\u00e8tres |
| PUT | /api/settings | Modifier param\u00e8tres (admin) |
| GET | /api/admin/properties | Toutes annonces (admin) |
| GET | /api/admin/contacts | Tous messages (admin) |

## D\u00e9ploiement

### Option 1 : VPS (Recommand\u00e9 pour l'Alg\u00e9rie)
1. Louez un VPS (OVH, Hostinger, ~5-10$/mois)
2. Installez Node.js 18+
3. Uploadez le projet
4. `npm install && npm start`
5. Configurez Nginx comme reverse proxy

### Option 2 : Railway / Render
1. Cr\u00e9ez un compte sur railway.app ou render.com
2. Connectez votre d\u00e9p\u00f4t GitHub
3. D\u00e9ploiement automatique

### Nom de domaine
- Achetez immoelite.dz (~2 000 DZ/an chez .dz registrar)
- Ou immoelite.com (~1 500 DZ/an)

## S\u00e9curit\u00e9 \u00e0 renforcer

1. **Changez le mot de passe admin** apr\u00e8s installation
2. Utilisez HTTPS en production (Let's Encrypt gratuit)
3. Remplacez le RIP fictif par votre vrai RIP BaridiMob
4. Ajoutez une v\u00e9rification email \u00e0 l'inscription
5. Utilisez bcrypt au lieu de md5 pour les mots de passe (en production)
6. Ajoutez un rate limiting sur les API
7. Validez les uploads c\u00f4t\u00e9 serveur plus strictement