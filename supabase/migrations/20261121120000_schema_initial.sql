-- =============================================================================
-- Cantine Vatel : schéma initial
-- Sécurité selon les critères DICT :
--   Intégrité      : contraintes, clés étrangères, listes fermées, montants entiers positifs
--   Confidentialité: RLS sur toutes les tables, aucune écriture directe sur l'argent
--   Traçabilité    : colonnes d'audit remplies par la base + journal_audit immuable
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Types (listes fermées de valeurs)
-- -----------------------------------------------------------------------------
create type public.role_utilisateur as enum ('convive', 'admin', 'parent');
create type public.categorie_convive as enum ('etudiant', 'personnel');
create type public.type_plat as enum ('plat', 'accompagnement', 'boisson', 'dessert');
create type public.statut_reservation as enum ('reservee', 'servie', 'annulee');
create type public.type_transaction as enum ('recharge', 'debit', 'remboursement');
create type public.moyen_paiement as enum ('wave', 'orange_money', 'simule');

-- Liste fermée des allergènes, partagée entre les plats et les utilisateurs.
create function public.allergenes_valides(liste text[])
returns boolean
language sql immutable
as $$
  select liste <@ array['arachide','gluten','lait','oeuf','poisson','crustaces','soja','sesame']::text[]
$$;

-- Date du jour à Abidjan (UTC+0, sans heure d'été).
create function public.aujourdhui()
returns date
language sql stable
as $$ select (now() at time zone 'Africa/Abidjan')::date $$;

-- -----------------------------------------------------------------------------
-- 2. Traçabilité : colonnes d'audit remplies par la base
--    Le navigateur ne peut pas falsifier cree_le / cree_par / modifie_le / modifie_par.
-- -----------------------------------------------------------------------------
create function public.fn_horodatage()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.cree_le := now();
    new.cree_par := auth.uid();
    new.modifie_le := null;
    new.modifie_par := null;
  else
    new.cree_le := old.cree_le;
    new.cree_par := old.cree_par;
    new.modifie_le := now();
    new.modifie_par := auth.uid();
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Tables
-- -----------------------------------------------------------------------------
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 80),
  email text,
  role public.role_utilisateur not null default 'convive',
  categorie public.categorie_convive,
  allergies text[] not null default '{}' check (public.allergenes_valides(allergies)),
  vegetarien boolean not null default false,
  solde integer not null default 0 check (solde >= 0),           -- FCFA, entier
  code_liaison text unique,                                      -- facultatif (parent)
  code_liaison_expire_le timestamptz,
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid,
  constraint convive_a_une_categorie check (role <> 'convive' or categorie is not null),
  constraint code_liaison_complet check ((code_liaison is null) = (code_liaison_expire_le is null))
);
comment on column public.profils.solde is 'Redondance volontaire : toujours égal à la somme des transactions, modifié uniquement par les fonctions.';

create table public.plats (
  id bigint generated always as identity primary key,
  nom text not null check (char_length(nom) between 2 and 80),
  description text check (char_length(description) <= 300),
  prix integer not null check (prix > 0),                        -- FCFA, prix unique subventionné
  type public.type_plat not null default 'plat',
  allergenes text[] not null default '{}' check (public.allergenes_valides(allergenes)),
  vegetarien boolean not null default false,
  photo_url text,
  actif boolean not null default true,                           -- on désactive, on ne supprime pas
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid
);

create table public.creneaux (
  id smallint generated always as identity primary key,
  heure_debut time not null unique,
  capacite integer not null check (capacite > 0),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid
);

create table public.menus_jour (
  id bigint generated always as identity primary key,
  jour date not null,
  plat_id bigint not null references public.plats (id),
  portions_prevues integer not null check (portions_prevues >= 0),
  portions_preparees integer check (portions_preparees >= 0),    -- saisies après le service
  prix_offre integer check (prix_offre > 0),                     -- offre de fin de service
  fin_offre timestamptz,
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid,
  unique (jour, plat_id),
  constraint offre_complete check ((prix_offre is null) = (fin_offre is null))
);

create table public.reservations (
  id bigint generated always as identity primary key,
  utilisateur_id uuid not null references public.profils (id),
  menu_jour_id bigint not null references public.menus_jour (id),
  creneau_id smallint not null references public.creneaux (id),
  jour date not null,                                            -- copie du jour du menu (règle RG1)
  prix_paye integer not null check (prix_paye >= 0),
  est_offre boolean not null default false,
  statut public.statut_reservation not null default 'reservee',
  jeton_qr text not null unique,                                 -- long, aléatoire, contenu du QR
  code_court text not null,                                      -- VTL-4827, saisie de secours
  scanne_le timestamptz,
  remis_le timestamptz,
  servi_par uuid references public.profils (id),
  annule_le timestamptz,
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid,
  unique (jour, code_court),
  constraint servie_coherente check ((statut = 'servie') = (scanne_le is not null)),
  constraint annulee_coherente check ((statut = 'annulee') = (annule_le is not null))
);
-- RG1 : au plus une réservation active par personne et par jour.
create unique index un_repas_par_jour on public.reservations (utilisateur_id, jour)
  where statut <> 'annulee';
create index reservations_menu on public.reservations (menu_jour_id);
create index reservations_jour_creneau on public.reservations (jour, creneau_id);

create table public.transactions (
  id bigint generated always as identity primary key,
  utilisateur_id uuid not null references public.profils (id),
  type public.type_transaction not null,
  montant integer not null check (montant > 0),                  -- toujours positif, le type donne le sens
  moyen public.moyen_paiement,                                   -- renseigné pour les recharges
  reservation_id bigint references public.reservations (id),
  solde_apres integer not null check (solde_apres >= 0),
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid,
  constraint recharge_a_un_moyen check ((type = 'recharge') = (moyen is not null)),
  constraint reservation_si_debit check (type = 'recharge' or reservation_id is not null)
);
create index transactions_utilisateur on public.transactions (utilisateur_id, cree_le desc);

create table public.notes (
  id bigint generated always as identity primary key,
  reservation_id bigint not null unique references public.reservations (id),
  valeur smallint not null check (valeur between 1 and 5),
  commentaire text check (char_length(commentaire) <= 280),
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid
);

create table public.liens_parent (
  parent_id uuid not null references public.profils (id) on delete cascade,
  enfant_id uuid not null references public.profils (id) on delete cascade,
  valide boolean not null default false,
  cree_le timestamptz not null default now(),
  cree_par uuid,
  modifie_le timestamptz,
  modifie_par uuid,
  primary key (parent_id, enfant_id),
  check (parent_id <> enfant_id)
);

-- Journal d'audit : qui, quoi, quand, comment, où. Immuable.
create table public.journal_audit (
  id bigint generated always as identity primary key,
  horodatage timestamptz not null default now(),                -- quand
  acteur uuid,                                                   -- qui
  role_acteur text,
  action text not null,                                          -- quoi : INSERT, UPDATE, DELETE, REFUS…
  table_nom text,
  ligne_id text,
  anciennes_valeurs jsonb,
  nouvelles_valeurs jsonb,
  operation text,                                                -- comment : fonction appelée
  details jsonb,
  ip text,                                                       -- où
  agent text
);
create index journal_audit_horodatage on public.journal_audit (horodatage desc);
create index journal_audit_ligne on public.journal_audit (table_nom, ligne_id);

-- -----------------------------------------------------------------------------
-- 4. Journalisation
-- -----------------------------------------------------------------------------
-- Contexte de la requête HTTP (en-têtes transmis par l'API Supabase).
create function public.entete_requete(nom text)
returns text
language plpgsql stable
as $$
begin
  return nullif(current_setting('request.headers', true), '')::json ->> nom;
exception when others then
  return null;
end;
$$;

-- Écrit une ligne dans le journal. Utilisée par les déclencheurs et par les fonctions (refus).
create function public.journaliser(
  p_action text,
  p_table text default null,
  p_ligne text default null,
  p_anciennes jsonb default null,
  p_nouvelles jsonb default null,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.journal_audit
    (acteur, role_acteur, action, table_nom, ligne_id, anciennes_valeurs, nouvelles_valeurs,
     operation, details, ip, agent)
  values
    (auth.uid(),
     coalesce((select p.role::text from public.profils p where p.id = auth.uid()), auth.role()),
     p_action, p_table, p_ligne, p_anciennes, p_nouvelles,
     nullif(current_setting('app.operation', true), ''),
     p_details,
     split_part(coalesce(public.entete_requete('x-forwarded-for'), public.entete_requete('x-real-ip'), ''), ',', 1),
     public.entete_requete('user-agent'));
end;
$$;
revoke execute on function public.journaliser(text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

create function public.fn_journal_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ligne text;
begin
  if tg_op = 'DELETE' then
    v_ligne := coalesce(to_jsonb(old) ->> 'id', concat(to_jsonb(old) ->> 'parent_id', '/', to_jsonb(old) ->> 'enfant_id'));
    perform public.journaliser(tg_op, tg_table_name, v_ligne, to_jsonb(old), null);
    return old;
  end if;
  v_ligne := coalesce(to_jsonb(new) ->> 'id', concat(to_jsonb(new) ->> 'parent_id', '/', to_jsonb(new) ->> 'enfant_id'));
  perform public.journaliser(tg_op, tg_table_name, v_ligne,
    case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end;
$$;

-- Interdit toute modification ou suppression (journal d'audit, transactions).
create function public.fn_interdire_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception 'La table % est en ajout seul : % interdit.', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

-- Pose les déclencheurs d'audit sur les tables métier.
do $$
declare
  t text;
begin
  foreach t in array array['profils','plats','creneaux','menus_jour','reservations','transactions','notes','liens_parent']
  loop
    execute format('create trigger horodatage before insert or update on public.%I
                    for each row execute function public.fn_horodatage()', t);
    execute format('create trigger journal after insert or update or delete on public.%I
                    for each row execute function public.fn_journal_audit()', t);
  end loop;
end;
$$;

create trigger ajout_seul before update or delete on public.transactions
  for each row execute function public.fn_interdire_modification();
create trigger ajout_seul before update or delete on public.journal_audit
  for each row execute function public.fn_interdire_modification();

-- -----------------------------------------------------------------------------
-- 5. Création automatique du profil à l'inscription
--    Le rôle n'est jamais 'admin' : seul un admin existant peut en créer un.
-- -----------------------------------------------------------------------------
create function public.fn_creer_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.role_utilisateur;
  v_categorie public.categorie_convive;
begin
  v_role := case when new.raw_user_meta_data ->> 'role' = 'parent' then 'parent' else 'convive' end;
  v_categorie := case
    when v_role = 'parent' then null
    when new.raw_user_meta_data ->> 'categorie' = 'personnel' then 'personnel'
    else 'etudiant'
  end;
  perform set_config('app.operation', 'inscription', true);
  insert into public.profils (id, nom, email, role, categorie)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''), split_part(new.email, '@', 1)),
          new.email, v_role, v_categorie);
  return new;
end;
$$;

create trigger creer_profil after insert on auth.users
  for each row execute function public.fn_creer_profil();

-- -----------------------------------------------------------------------------
-- 6. Confidentialité : règles d'accès (RLS)
-- -----------------------------------------------------------------------------
create function public.est_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profils where id = auth.uid() and role = 'admin')
$$;

create function public.est_parent_de(p_enfant uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.liens_parent
                 where parent_id = auth.uid() and enfant_id = p_enfant and valide)
$$;

alter table public.profils enable row level security;
alter table public.plats enable row level security;
alter table public.creneaux enable row level security;
alter table public.menus_jour enable row level security;
alter table public.reservations enable row level security;
alter table public.transactions enable row level security;
alter table public.notes enable row level security;
alter table public.liens_parent enable row level security;
alter table public.journal_audit enable row level security;

-- Les visiteurs non connectés n'ont accès à rien.
revoke all on all tables in schema public from anon;

-- Aucune écriture directe sur l'argent, les tickets, les notes et le journal : uniquement via les fonctions.
revoke insert, update, delete on public.reservations, public.transactions, public.notes,
  public.journal_audit, public.liens_parent from authenticated;
-- Profil : l'utilisateur ne peut modifier que son nom, ses allergies et son régime.
revoke insert, update, delete on public.profils from authenticated;
grant update (nom, allergies, vegetarien) on public.profils to authenticated;

-- profils
create policy profils_lecture on public.profils for select to authenticated
  using (id = auth.uid() or public.est_admin() or public.est_parent_de(id));
create policy profils_modification on public.profils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- plats, créneaux, menus : lisibles par les connectés, gérés par l'admin
create policy plats_lecture on public.plats for select to authenticated using (true);
create policy plats_gestion on public.plats for all to authenticated
  using (public.est_admin()) with check (public.est_admin());
create policy creneaux_lecture on public.creneaux for select to authenticated using (true);
create policy creneaux_gestion on public.creneaux for all to authenticated
  using (public.est_admin()) with check (public.est_admin());
create policy menus_lecture on public.menus_jour for select to authenticated using (true);
create policy menus_gestion on public.menus_jour for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- réservations, transactions : les siennes, celles de ses enfants (parent), ou toutes (admin)
create policy reservations_lecture on public.reservations for select to authenticated
  using (utilisateur_id = auth.uid() or public.est_admin() or public.est_parent_de(utilisateur_id));
create policy transactions_lecture on public.transactions for select to authenticated
  using (utilisateur_id = auth.uid() or public.est_admin() or public.est_parent_de(utilisateur_id));

-- notes : les siennes ou toutes (admin) ; les moyennes passent par une vue
create policy notes_lecture on public.notes for select to authenticated
  using (public.est_admin() or exists (
    select 1 from public.reservations r where r.id = reservation_id and r.utilisateur_id = auth.uid()));

-- liens parent : les parties concernées ou l'admin
create policy liens_lecture on public.liens_parent for select to authenticated
  using (parent_id = auth.uid() or enfant_id = auth.uid() or public.est_admin());

-- journal d'audit : admin seulement, en lecture
create policy journal_lecture on public.journal_audit for select to authenticated
  using (public.est_admin());
