# Cantine Vatel

Application de gestion de la cantine de Vatel Abidjan, réalisée pendant le Hackathon Restauration Vatel × Epitech (21 novembre 2026).

**Fil rouge :** Réserver → Prévoir → Écouler → Retirer vite.

## Stack

- React + Vite + TypeScript, Tailwind CSS, TanStack Query, React Router
- Supabase : PostgreSQL, Auth, règles d'accès (RLS), fonctions SQL, Realtime
- Vercel (déploiement continu à chaque push sur `main`)
- GitHub Actions (CI : lint, vérification des types, build)

## Lancer le projet en local

```bash
npm install
cp .env.example .env.local   # puis remplir l'URL et la clé publique du projet Supabase
npm run dev
```

*README complété en fin de journée : fonctionnalités, comptes de démonstration, sécurité, crédits photo.*
