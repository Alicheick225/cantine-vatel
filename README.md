# Cantine Vatel

Application de gestion de la cantine de **Vatel Abidjan**, réalisée en une journée pendant le Hackathon Restauration Vatel × Epitech (21 novembre 2026).

**Démo en ligne : https://cantine-vatel.vercel.app** (installable sur téléphone comme une application)

## Le problème choisi

Dans une cantine, la cuisine découvre la demande au moment du service. Elle prépare trop, ce qui crée du **gaspillage**, ou pas assez, ce qui crée des **files d'attente** et des plats épuisés. Le paiement en espèces au comptoir ralentit encore la file.

**Fil rouge de la solution : Réserver → Prévoir → Écouler → Retirer vite.**

| Étape | Ce que fait l'application |
|---|---|
| **Réserver** | Le convive (étudiant ou personnel) réserve son plat et son créneau depuis son téléphone. Il paie d'avance avec son solde, rechargé par Mobile Money (simulé). |
| **Prévoir** | La prévision estime les repas attendus par jour et par plat, puis propose les portions à préparer. |
| **Écouler** | En fin de service, l'admin lance une **offre à −50 %** sur les portions en trop. Les convives la voient en direct. Le menu suggère aussi un « choix anti-gaspi ». |
| **Retirer vite** | Le convive montre un QR code. Au comptoir, l'écran devient **vert** (à servir, avec les allergies) ou **rouge** (déjà servi, annulé, autre jour). |

## Fonctionnalités

**Convive (étudiant ou personnel), sur téléphone**
- Menu de la semaine avec photos, prix, notes, portions restantes (« Plus que 8 »), plats végétariens, et **alerte d'allergie** croisée avec le profil.
- Réservation avec choix du créneau (places restantes), un repas par jour, annulation remboursée jusqu'à **8h le jour même**. Les offres anti-gaspillage restent achetables même après avoir réservé, et plusieurs fois, pour que les restes trouvent preneur.
- Ticket avec **QR code** et code court de secours.
- Solde, historique des transactions, recharge Wave ou Orange Money (simulée).
- Notation des repas servis, suggestion **« Pour vous »** selon ses goûts, **choix anti-gaspi**, offre de fin de service en temps réel.
- **Notifications** (offre anti-gaspi lancée, rappel 10 minutes avant le créneau) et **mode hors ligne** du ticket.
- **Français / anglais**, choix mémorisé.
- Profil : allergies et régime végétarien.

**Parent d'élève**
- Liaison avec son enfant par un **code de liaison** (valable 48 h, à usage unique) que l'enfant génère depuis son profil.
- Solde de l'enfant, alerte de solde bas, **recharge** (Wave ou Orange Money, simulée), derniers repas (mangé, réservé, absent).

**Administrateur, sur ordinateur et tablette**
- **Aujourd'hui** : chiffres clés, commandes par plat **en direct**, affluence par créneau, suggestion anti-gaspillage et lancement d'une offre de fin de service.
- **Comptoir** (tablette, plein écran) : scan du QR par caméra ou saisie du code court, puis écran **vert ou rouge**, avec une alerte si le plat contient un allergène déclaré. Deux organisations au choix : une personne scanne et sert, ou bien on scanne à l'entrée et l'**écran du passe** affiche en direct les plats à remettre.
- **Équipe du comptoir** : l'admin est le **super-admin** (il voit tout, peut scanner et servir) et nomme deux rôles limités : la **scanneuse**, qui ne voit que l'écran de contrôle à l'entrée, et la **serveuse**, qui ne voit que l'écran du passe. Moindre privilège imposé par la base, chaque nomination est journalisée.
- **Menus** de la semaine (portions prévues et préparées) et **plats** (création, **modification**, prix, photo, désactivation).
- **Alertes de rupture** : demande prévue supérieure aux portions prévues, plats presque épuisés.
- **Rapport d'activité** sur une période, exportable en **CSV** et imprimable en **PDF**.
- **Prévision** des repas, bouton « Appliquer au menu », suivi du **gaspillage** sur 6 semaines.
- **Journal d'audit** : qui, quoi, quand, comment, où.

## Tester l'application

### En ligne (aucune installation)

Ouvrez **https://cantine-vatel.vercel.app**, sur téléphone de préférence. L'application s'installe sur l'écran d'accueil : la page de connexion explique comment faire sur iPhone et sur Android.

| Rôle | Email | Mot de passe | Ce qu'on peut tester |
|---|---|---|---|
| Convive (étudiant) | `etudiant.test@cantine-vatel.test` | `VatelJury2026` | Menu, réservation, ticket QR, annulation, solde et recharge, historique, notation, profil (allergies, langue, notifications) |
| Administrateur, scanneuse, serveuse | transmis séparément | | Tableau de bord, menus, plats, prévision, rapports, équipe, journal ; comptoir (scan) ; écran du passe |

Vous pouvez aussi **créer votre propre compte** depuis la page d'inscription : étudiant, personnel ou parent. Personne ne peut s'inscrire en administrateur.

**Parcours conseillés :**
1. **Réserver :** en convive, choisissez un plat d'un jour à venir, puis un créneau. Le ticket QR apparaît dans « Tickets ». Les réservations d'un jour ferment à 8h ce jour-là.
2. **Scanner :** en scanneuse ou en admin, ouvrez le comptoir et scannez le QR (ou tapez les 4 chiffres du code). Le ticket du jour donne un écran **vert** ; scanné une deuxième fois, il donne un écran **rouge**. Des tickets de test couvrant chaque cas peuvent être créés avec `supabase/demo/tickets_scan.sql`.
3. **Espace parent :**
   - créez un compte parent ;
   - dans le compte étudiant, ouvrez « Profil > Lier un parent » pour générer un code ;
   - saisissez ce code dans l'espace parent : vous pouvez recharger le compte et suivre les repas.
4. **Notifications :** dans « Profil », activez les notifications puis touchez « M'envoyer une notification de test » et fermez l'application : la notification arrive quelques secondes plus tard. Sur iPhone, il faut d'abord installer l'application sur l'écran d'accueil (iOS 16.4 ou plus).

### En local, sur la base en ligne (2 minutes)

Il faut Node.js 20 ou plus.

```bash
git clone https://github.com/Alicheick225/cantine-vatel.git
cd cantine-vatel
npm install
cat > .env.local <<'ENV'
VITE_SUPABASE_URL=https://kpkbovgolgndcwiwpkhi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_79FSMGxq5muij3vpHO2QfA_vBr_vO_a
ENV
npm run dev            # http://localhost:5173, mêmes comptes que la version en ligne
```

La clé « publishable » est publique par nature : elle est déjà présente dans l'application en ligne. Toutes les données restent protégées par les règles d'accès de la base (RLS). Pour tester la version de production en local (service worker, mode hors ligne, notifications push) : `npm run build && npm run preview`.

### En local, avec votre propre base Supabase

Il faut un compte Supabase et la [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase link --project-ref <ref-de-votre-projet>
supabase db push                                             # toutes les migrations (supabase/migrations)
supabase db query --remote -f supabase/seed.sql              # créneaux, plats, menus
supabase db query --remote -f supabase/demo/historique.sql   # historique de démo
supabase functions deploy push --no-verify-jwt               # envoi des notifications push
```

Ensuite :
1. Renseignez `.env.local` avec l'URL et la clé publishable de votre projet.
2. Créez un compte depuis l'application, puis nommez-le administrateur dans l'éditeur SQL de Supabase : `update public.profils set role = 'admin', categorie = null where email = 'vous@exemple.ci';`
3. Pour les notifications push, voir la section « Notifications push ».

**Tests automatisés de la base** (chaque fichier s'exécute dans une transaction annulée : aucune trace dans la base) :

```bash
supabase db query --remote -f supabase/tests/securite.sql   # sécurité
supabase db query --remote -f supabase/tests/metier.sql     # règles métier
supabase db query --remote -f supabase/tests/parent.sql     # espace parent
supabase db query --remote -f supabase/tests/equipe.sql     # rôles d'équipe
```

## Architecture

```
Téléphone (convive) ─┐
Ordinateur (admin) ──┼──> Application React (PWA) sur Vercel ──> Supabase
Tablette (comptoir) ─┘                                            ├─ Auth : connexion, rôles
                                                                  ├─ Tables protégées par RLS : lectures
                                                                  ├─ Fonctions SQL : argent, portions, tickets
                                                                  ├─ Realtime : écrans en direct
                                                                  └─ PostgreSQL
```

**Principe : le navigateur affiche et appelle, la base décide.** Toute règle qui touche à l'argent, aux portions ou aux tickets s'exécute dans PostgreSQL, sous forme de fonctions transactionnelles (« tout ou rien »). Ces fonctions verrouillent les lignes concernées : pendant le rush, une portion ne peut pas être vendue deux fois.

| Couche | Choix |
|---|---|
| Interface | React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Query, React Router, Tabler Icons |
| QR code | `qrcode.react` (génération), `html5-qrcode` (lecture par caméra) |
| Backend | Supabase : PostgreSQL, Auth, RLS, fonctions SQL, Realtime |
| Déploiement | Vercel (déploiement à chaque push sur `main`) |
| Intégration continue | GitHub Actions : lint, vérification des types, build |

## Sécurité : critères DICT

| Critère | Mesures |
|---|---|
| **Disponibilité** | Hébergeurs managés, CI à chaque push, retour instantané à une version précédente sur Vercel. |
| **Intégrité** | Contraintes en base (clés étrangères, listes fermées, montants entiers positifs, cohérence des statuts). Opérations transactionnelles avec verrous. Rôle et solde modifiables uniquement par les fonctions. **Transactions en ajout seul** : une erreur se corrige par une nouvelle transaction. Le solde est toujours égal à la somme des transactions. |
| **Confidentialité** | RLS sur toutes les tables : chacun ne voit que ses données, l'admin tout. Aucun accès sans connexion. Inscription toujours en convive. Fonctions internes dans un schéma privé. Aucune donnée personnelle dans le QR (jeton aléatoire de 64 caractères). Clé secrète jamais dans le front. |
| **Traçabilité** | Colonnes `cree_le`, `cree_par`, `modifie_le`, `modifie_par` **remplies par la base** sur toutes les tables métier. Table `journal_audit` **immuable** (qui, quoi, quand, comment, où), qui enregistre aussi les refus au comptoir. |

**Tests automatiques** (exécutés dans une transaction annulée, ils ne laissent aucune trace) :
- `supabase/tests/securite.sql` : 12 tests (inscription en admin impossible, lecture des données d'autrui, modification du solde ou du rôle, écriture directe d'une transaction, immuabilité du journal…) ;
- `supabase/tests/metier.sql` : 17 tests (recharge, réservation, limite de 8h, un repas par jour, annulation remboursée, scan vert puis rouge, cohérence solde / transactions…) ;
- `supabase/tests/parent.sql` : 10 tests (liaison par code, le parent ne voit que son enfant, recharge tracée, refus d'un code invalide journalisé…) ;
- `supabase/tests/equipe.sql` : 15 tests (la scanneuse valide sans pouvoir remettre ni gérer, la serveuse remet sans pouvoir scanner, personne ne devient admin depuis l'application ni ne change son propre rôle, nominations tracées…).

**Résultat : 54 tests sur 54 réussis.** S'y ajoute l'analyse de sécurité de Supabase (`supabase db advisors`). Les seuls avertissements restants concernent les fonctions métier, volontairement ouvertes aux utilisateurs connectés et qui contrôlent elles-mêmes le rôle, ainsi qu'une option d'authentification réservée aux offres payantes.

## Prévision : comment elle fonctionne

- **Repas attendus** = réservations déjà faites + estimation des réservations à venir. L'estimation est la moyenne du même jour de semaine sur les 4 dernières semaines, et elle n'est ajoutée que tant que la réservation est ouverte.
- **Répartition par plat** selon la popularité des 6 dernières semaines, ajustée par la **note moyenne**.
- **À préparer** = attendus × taux de présence observé + 5 % de marge.

C'est une statistique simple et **explicable au chef de cuisine**. Avec de vraies données sur plusieurs mois, on passerait à un modèle de séries temporelles.

## Notifications push

Les notifications arrivent **même quand l'application est fermée**, grâce au standard Web Push.

| Notification | Qui la reçoit | Déclencheur |
|---|---|---|
| Offre anti-gaspi | Tous les convives abonnés | L'admin lance une offre de fin de service |
| Rappel de créneau | Le convive | 10 minutes avant son créneau (vérification chaque minute par `pg_cron`) |
| Solde bas | Le parent | Le solde de l'enfant passe sous 2 000 F (une fois par jour) |
| Test | Soi-même | Bouton « M'envoyer une notification de test » dans le profil (8 secondes plus tard) |

**Fonctionnement :**
- **Abonnement :** l'appareil s'abonne au service push du navigateur. L'abonnement est enregistré par `enregistrer_abonnement`, et chacun ne voit que ses propres appareils.
- **Envoi :** la fonction serveur `supabase/functions/push` signe chaque message avec les clés VAPID, chiffre son contenu et l'envoie. Elle retire les abonnements expirés.
- **Protection :** la table `notifications_envoyees` évite les doublons. La fonction vérifie l'appelant : un admin pour une offre, un utilisateur connecté pour un test, et un secret pour `pg_cron`.

**Configuration (votre propre projet) :**
1. Générez une paire de clés VAPID.
2. Mettez la clé publique dans `src/lib/notifications.ts`.
3. Enregistrez les secrets :
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUJET=https://votre-site PUSH_CRON_SECRET=…
   ```
4. Enregistrez le même secret de `pg_cron` dans Vault, en SQL :
   ```sql
   select vault.create_secret('…', 'push_cron_secret');
   ```
5. Adaptez l'URL de la fonction dans la migration `20261121230000_notifications_push.sql`.

Les clés privées ne sont jamais dans le dépôt. Sur iPhone, le push demande d'installer l'application sur l'écran d'accueil (iOS 16.4 ou plus).

## Organisation du dépôt

```
src/
  auth/        session et redirection selon le rôle
  layouts/     convive (barre en bas), admin (menu latéral)
  pages/       convive/ (menu, réservation, tickets, solde, profil), parent/ et admin/ (aujourd'hui, comptoir, passe, menus, plats, prévision, rapports, équipe, journal)
  components/  éléments d'interface (ticket, plat, boutons…)
  lib/         client Supabase, accès aux données, temps réel, notifications, formats
supabase/
  migrations/  schéma, sécurité, fonctions métier, tableau de bord, prévision (SQL versionné)
  seed.sql     données de référence
  demo/        historique de démo et historique simulé (6 semaines, 150 convives fictifs)
  tests/       tests de sécurité, métier, espace parent et rôles d'équipe
  functions/   fonction serveur « push » (notifications push)
```

## Ce qui est simulé (et comment le rendre réel)

| Simulé pour la démo | En production |
|---|---|
| Paiement Wave et Orange Money | Fonction serveur Supabase qui crée le paiement chez l'opérateur et reçoit sa confirmation |
| 6 semaines d'historique (150 convives fictifs, sans mot de passe) | La prévision se nourrit des vraies réservations |
| Confirmation de l'email désactivée | À réactiver, avec un serveur d'envoi dédié |

## Crédits

- **Charte graphique :** inspirée de l'identité de Vatel Abidjan (bleu marine, bleu ciel, orange, corail), avec des contrastes corrigés pour la lisibilité.
- **Photos des plats** (copies allégées dans `public/plats`) :
  - Wikimedia Commons :
    - Le Garba, par Didierwiki (CC0) ;
    - Kédjénou de poulet sauce claire, par African Hope (CC BY-SA 4.0) ;
    - Aloko, par Krista (CC BY 2.0) ;
    - Placali à la sauce kôpê, par AZIMIE (CC BY-SA 4.0) ;
    - Attieke serves with fried carp, par Kod B (CC BY-SA 4.0) ;
    - Un plat de riz à la sauce graine 03, par Mognissan (CC BY-SA 4.0) ;
    - Alloco aux œufs, par Traorejci (CC BY-SA 4.0).
  - Pexels (licence Pexels) : Bissap, par Moisés Fonseca.

  Ces photos illustrent les plats : ce ne sont pas des photos de la cantine.
