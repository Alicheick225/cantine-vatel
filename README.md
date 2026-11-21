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
- **Menus** de la semaine (portions prévues et préparées) et **plats** (création, prix, photo, désactivation).
- **Alertes de rupture** : demande prévue supérieure aux portions prévues, plats presque épuisés.
- **Rapport d'activité** sur une période, exportable en **CSV** et imprimable en **PDF**.
- **Prévision** des repas, bouton « Appliquer au menu », suivi du **gaspillage** sur 6 semaines.
- **Journal d'audit** : qui, quoi, quand, comment, où.

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Convive (étudiant) | `etudiant.test@cantine-vatel.test` | `VatelJury2026` |

Vous pouvez aussi **créer votre propre compte** depuis la page d'inscription, en tant qu'étudiant, membre du personnel ou parent. Pour tester l'espace parent : créez un compte parent, puis saisissez le code généré dans « Profil > Lier un parent » du compte étudiant. Le compte **administrateur** est transmis séparément, dans le formulaire de soumission : par sécurité, personne ne peut s'inscrire en admin.

> Les menus sont publiés du lundi au vendredi. Les réservations d'un jour ferment à 8h ce jour-là : essayez de réserver pour un jour à venir.

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
- `supabase/tests/parent.sql` : 10 tests (liaison par code, le parent ne voit que son enfant, recharge tracée, refus d'un code invalide journalisé…).

**Résultat : 39 tests sur 39 réussis.** S'y ajoute l'analyse de sécurité de Supabase (`supabase db advisors`). Les seuls avertissements restants concernent les fonctions métier, volontairement ouvertes aux utilisateurs connectés et qui contrôlent elles-mêmes le rôle, ainsi qu'une option d'authentification réservée aux offres payantes.

## Prévision : comment elle fonctionne

- **Repas attendus** = réservations déjà faites + estimation des réservations à venir. L'estimation est la moyenne du même jour de semaine sur les 4 dernières semaines, et elle n'est ajoutée que tant que la réservation est ouverte.
- **Répartition par plat** selon la popularité des 6 dernières semaines, ajustée par la **note moyenne**.
- **À préparer** = attendus × taux de présence observé + 5 % de marge.

C'est une statistique simple et **explicable au chef de cuisine**. Avec de vraies données sur plusieurs mois, on passerait à un modèle de séries temporelles.

## Lancer le projet en local

```bash
npm install
cp .env.example .env.local   # URL et clé publique (publishable) du projet Supabase
npm run dev
```

Base de données (Supabase CLI) :

```bash
supabase link --project-ref <ref>
supabase db push                                            # migrations (supabase/migrations)
supabase db query --remote -f supabase/seed.sql             # créneaux, plats, menus
supabase db query --remote -f supabase/demo/historique.sql  # historique de démo
supabase db query --remote -f supabase/tests/securite.sql   # tests de sécurité
supabase db query --remote -f supabase/tests/metier.sql     # tests métier
supabase db query --remote -f supabase/tests/parent.sql     # tests de l'espace parent
```

## Organisation du dépôt

```
src/
  auth/        session et redirection selon le rôle
  layouts/     convive (barre en bas), admin (menu latéral)
  pages/       convive/ (menu, réservation, tickets, solde, profil), parent/ et admin/ (aujourd'hui, comptoir, menus, plats, prévision, journal)
  components/  éléments d'interface (ticket, plat, boutons…)
  lib/         client Supabase, accès aux données, temps réel, formats
supabase/
  migrations/  schéma, sécurité, fonctions métier, tableau de bord, prévision (SQL versionné)
  seed.sql     données de référence
  demo/        historique de démo et historique simulé (6 semaines, 150 convives fictifs)
  tests/       tests de sécurité, tests métier et tests de l'espace parent
```

## Ce qui est simulé (et comment le rendre réel)

| Simulé pour la démo | En production |
|---|---|
| Paiement Wave et Orange Money | Fonction serveur Supabase qui crée le paiement chez l'opérateur et reçoit sa confirmation |
| 6 semaines d'historique (150 convives fictifs, sans mot de passe) | La prévision se nourrit des vraies réservations |
| Confirmation de l'email désactivée | À réactiver, avec un serveur d'envoi dédié |

## Utilisation de l'IA

L'IA était autorisée par le règlement. **Ali Ouattara** a conçu le projet : choix du problème, parcours, modèle de données, règles métier et de sécurité (DICT), prévision et charte graphique. L'interface et le SQL ont été écrits avec **Claude Code** sous sa direction, en petites étapes testées et validées, avec un commit par fonctionnalité. Les règles critiques sont dans la base, testées automatiquement, et peuvent être montrées en direct.

## Crédits

- **Charte graphique :** inspirée de l'identité de Vatel Abidjan (bleu marine, bleu ciel, orange, corail), avec des contrastes corrigés pour la lisibilité.
- **Photos des plats** (Wikimedia Commons, licences libres, copies allégées dans `public/plats`) :
  - Le Garba, par Didierwiki (CC0) ;
  - Kédjénou de poulet sauce claire, par African Hope (CC BY-SA 4.0) ;
  - Aloko, par Krista (CC BY 2.0) ;
  - Sauce graine, par KONE IF (CC BY 4.0) ;
  - Attiéké poisson fumé, par Samigolden07 (CC0) ;
  - Placali à la sauce kôpê, par AZIMIE (CC BY-SA 4.0).

  Ces photos illustrent les plats : ce ne sont pas des photos de la cantine.
